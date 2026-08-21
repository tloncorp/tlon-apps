import { spawn } from 'node:child_process';

export const DEFAULT_TLON_CLI_TIMEOUT_MS = 45_000;

const EXPLICIT_CREDENTIAL_ENV_KEYS_TO_CLEAR = [
  'TLON_CONFIG_FILE',
  'URBIT_COOKIE',
  'TLON_COOKIE',
  'TLON_URL',
  'TLON_SHIP',
  'TLON_CODE',
] as const;

class TlonCommandError extends Error {
  readonly stdout: string;
  readonly stderr: string;

  constructor(
    message: string,
    options: { stdout?: string; stderr?: string } = {}
  ) {
    super(message);
    this.name = 'TlonCommandError';
    this.stdout = options.stdout ?? '';
    this.stderr = options.stderr ?? '';
  }
}

export type TlonCommandDeadlineOutput = {
  stdout: string;
  stderr: string;
};

export type TlonCommandRunnerOptions = {
  timeoutMs?: number;
  onDeadline?: (output: TlonCommandDeadlineOutput) => void;
  /** Abort the command and wait for its process tree to exit before settling. */
  signal?: AbortSignal;
};

const COMMAND_KILL_GRACE_MS = 2_000;
const COMMAND_KILL_CONFIRM_MS = 250;
const COMMAND_KILL_POLL_MS = 20;

/**
 * Run the tlon command and return the result.
 */
export function runTlonCommand(
  binary: string,
  args: string[],
  credentials?: { url: string; ship: string; code: string },
  options?: TlonCommandRunnerOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted) {
      reject(new TlonCommandError('tlon command aborted'));
      return;
    }

    const env = { ...process.env };
    if (credentials) {
      for (const key of EXPLICIT_CREDENTIAL_ENV_KEYS_TO_CLEAR) {
        delete env[key];
      }
      env.URBIT_SHIP = credentials.ship;
      env.URBIT_URL = credentials.url;
      env.URBIT_CODE = credentials.code;
    }

    // A dedicated process group lets timeout/abort terminate CLI descendants
    // too. Some commands synchronously spawn helpers that inherit stdout and
    // can otherwise keep the promise alive — or finish a mutation — after the
    // direct child has been killed.
    const hasProcessGroup = process.platform !== 'win32';
    const child = spawn(binary, args, { env, detached: hasProcessGroup });
    let stdout = '';
    let stderr = '';
    let completionSettled = false;
    let deadlineReported = false;
    let spawnError: Error | null = null;
    let termination:
      | { kind: 'abort'; message: string }
      | { kind: 'timeout'; message: string }
      | null = null;
    let terminationPromise: Promise<void> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TLON_CLI_TIMEOUT_MS;
    const onDeadline = options?.onDeadline;
    const signal = options?.signal;

    const onStdoutData = (data: Buffer | string) => {
      stdout += data.toString();
    };
    const onStderrData = (data: Buffer | string) => {
      stderr += data.toString();
    };
    const onChildError = (error: Error) => {
      spawnError = error;
    };
    const childHasExited = () =>
      child.exitCode !== null || child.signalCode !== null;
    const signalChildTree = (signalName: NodeJS.Signals) => {
      let signalledGroup = false;
      if (hasProcessGroup && child.pid) {
        try {
          process.kill(-child.pid, signalName);
          signalledGroup = true;
        } catch (error) {
          // Fall through to the direct child. ESRCH can briefly occur while
          // spawn is still establishing the new process group.
        }
      }
      if (!signalledGroup && !childHasExited()) {
        child.kill(signalName);
      }
    };
    const childTreeIsAlive = () => {
      if (hasProcessGroup && child.pid) {
        try {
          process.kill(-child.pid, 0);
          return true;
        } catch (error) {
          return (error as NodeJS.ErrnoException).code !== 'ESRCH';
        }
      }
      return !childHasExited();
    };
    const waitForChildTreeExit = async (waitMs: number) => {
      const deadline = Date.now() + waitMs;
      while (childTreeIsAlive() && Date.now() < deadline) {
        await new Promise<void>((resolveWait) =>
          setTimeout(resolveWait, COMMAND_KILL_POLL_MS)
        );
      }
      return !childTreeIsAlive();
    };
    const terminateChildTree = async (kind: 'abort' | 'timeout') => {
      // An outer run abort means a continuation can become available as soon
      // as this promise settles. Kill the whole group immediately so a helper
      // that ignores SIGTERM cannot commit a late mutation during a grace
      // window. Standalone command deadlines retain the historical graceful
      // TERM-then-KILL behavior.
      if (kind === 'abort') {
        signalChildTree('SIGKILL');
        await waitForChildTreeExit(COMMAND_KILL_CONFIRM_MS);
        return;
      }
      signalChildTree('SIGTERM');
      if (await waitForChildTreeExit(COMMAND_KILL_GRACE_MS)) {
        return;
      }
      signalChildTree('SIGKILL');
      // A successfully delivered SIGKILL makes further mutation impossible.
      // Briefly wait for process-group disappearance so inherited pipes and
      // zombies do not race command settlement.
      await waitForChildTreeExit(COMMAND_KILL_CONFIRM_MS);
    };
    const requestTermination = (kind: 'abort' | 'timeout', message: string) => {
      if (completionSettled || terminationPromise) {
        return;
      }
      // Preserve a command's real result if it already exited naturally and
      // abort merely raced its `close` event. We still terminate any lingering
      // descendants in the process group before allowing settlement.
      if (!childHasExited()) {
        termination = { kind, message };
      }
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      terminationPromise = terminateChildTree(kind);
    };
    const onAbort = () => {
      requestTermination('abort', 'tlon command aborted');
    };
    const teardownAfterClose = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      child.stdout.removeListener('data', onStdoutData);
      child.stderr.removeListener('data', onStderrData);
      child.removeListener('error', onChildError);
      child.removeListener('close', onChildClose);
      signal?.removeEventListener('abort', onAbort);
      stdout = '';
      stderr = '';
    };

    const onChildClose = (code: number | null) => {
      const completedStdout = stdout;
      const completedStderr = stderr;
      if (completionSettled) {
        return;
      }
      void (async () => {
        await terminationPromise;
        teardownAfterClose();
        if (completionSettled) {
          return;
        }
        completionSettled = true;
        if (termination) {
          reject(
            new TlonCommandError(termination.message, {
              stdout: completedStdout,
              stderr: completedStderr,
            })
          );
        } else if (spawnError) {
          reject(
            new TlonCommandError(`Failed to run tlon: ${spawnError.message}`, {
              stdout: completedStdout,
              stderr: completedStderr,
            })
          );
        } else if (code !== 0) {
          reject(
            new TlonCommandError(
              completedStderr.trim() ||
                completedStdout.trim() ||
                `tlon exited with code ${code}`,
              { stdout: completedStdout, stderr: completedStderr }
            )
          );
        } else {
          resolve(completedStdout);
        }
      })();
    };

    child.stdout.on('data', onStdoutData);
    child.stderr.on('data', onStderrData);
    child.on('error', onChildError);
    child.on('close', onChildClose);
    signal?.addEventListener('abort', onAbort, { once: true });

    // Close the race between the pre-spawn check and listener registration.
    if (signal?.aborted) {
      onAbort();
    }

    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        if (completionSettled || deadlineReported) {
          return;
        }
        deadlineReported = true;
        if (onDeadline) {
          onDeadline({ stdout, stderr });
          return;
        }
        requestTermination(
          'timeout',
          `tlon command timed out after ${timeoutMs}ms`
        );
      }, timeoutMs);
    }
  });
}

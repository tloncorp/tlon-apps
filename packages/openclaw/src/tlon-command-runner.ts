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
  environment?: Record<string, string | undefined>;
};

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
    const env = { ...process.env };
    for (const [key, value] of Object.entries(options?.environment ?? {})) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
    if (credentials) {
      for (const key of EXPLICIT_CREDENTIAL_ENV_KEYS_TO_CLEAR) {
        delete env[key];
      }
      env.URBIT_SHIP = credentials.ship;
      env.URBIT_URL = credentials.url;
      env.URBIT_CODE = credentials.code;
    }

    const child = spawn(binary, args, { env });
    let stdout = '';
    let stderr = '';
    let completionSettled = false;
    let deadlineReported = false;
    let spawnError: Error | null = null;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TLON_CLI_TIMEOUT_MS;
    const onDeadline = options?.onDeadline;

    const onStdoutData = (data: Buffer | string) => {
      stdout += data.toString();
    };
    const onStderrData = (data: Buffer | string) => {
      stderr += data.toString();
    };
    const onChildError = (error: Error) => {
      spawnError = error;
    };
    const teardownAfterClose = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
      child.stdout.removeListener('data', onStdoutData);
      child.stderr.removeListener('data', onStderrData);
      child.removeListener('error', onChildError);
      child.removeListener('close', onChildClose);
      stdout = '';
      stderr = '';
    };

    const onChildClose = (code: number | null) => {
      const completedStdout = stdout;
      const completedStderr = stderr;
      teardownAfterClose();
      if (completionSettled) {
        return;
      }
      completionSettled = true;
      if (spawnError) {
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
    };

    child.stdout.on('data', onStdoutData);
    child.stderr.on('data', onStderrData);
    child.on('error', onChildError);
    child.on('close', onChildClose);

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
        completionSettled = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
        reject(
          new TlonCommandError(`tlon command timed out after ${timeoutMs}ms`, {
            stdout,
            stderr,
          })
        );
      }, timeoutMs);
    }
  });
}

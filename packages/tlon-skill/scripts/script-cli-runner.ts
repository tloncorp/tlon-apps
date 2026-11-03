/**
 * Runs a script module that runs its CLI main() on import (channels.ts,
 * groups.ts) inside a unit test, against the preloaded '@tloncorp/api' mock.
 * Such a module reads process.argv and ends with process.exit, so `load` must
 * import a fresh instance each run, by putting `run` in a `?run=` query.
 */
import { __resetApiClientForTests } from './api-client';

// Every variable the credential resolver reads, cleared for the run so only
// the test ship below counts. It is ~zod, the ship the api mock acts as.
const CREDENTIAL_ENV_KEYS = [
  'TLON_CONFIG_FILE',
  'URBIT_URL',
  'TLON_URL',
  'URBIT_SHIP',
  'TLON_SHIP',
  'URBIT_COOKIE',
  'TLON_COOKIE',
  'URBIT_CODE',
  'TLON_CODE',
  'TLON_SKILL_DIR',
  'TLON_CACHE_DIR',
  'OPENCLAW_CONFIG',
];

const TEST_SHIP_ENV: Record<string, string> = {
  TLON_URL: 'https://zod.tlon.network',
  TLON_SHIP: '~zod',
  TLON_CODE: 'sampel-ticlyt-migfun-falmel',
};

let runCount = 0;

export type ScriptRun = {
  exitCode: number | undefined;
  stdout: string[];
  stderr: string[];
};

export async function runScriptCli(
  family: string,
  args: string[],
  load: (run: number) => Promise<unknown>
): Promise<ScriptRun> {
  const savedEnv = Object.fromEntries(
    CREDENTIAL_ENV_KEYS.map((key) => [key, process.env[key]])
  );
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];
  let finish: (code: number | undefined) => void = () => {};
  const exited = new Promise<number | undefined>((resolve) => {
    finish = resolve;
  });

  for (const key of CREDENTIAL_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, TEST_SHIP_ENV);
  __resetApiClientForTests();
  process.argv = ['tlon', family, ...args];
  process.exit = ((code?: number) => {
    finish(code);
    return undefined as never;
  }) as typeof process.exit;
  console.log = (...parts: unknown[]) => {
    stdout.push(parts.map(String).join(' '));
  };
  console.error = (...parts: unknown[]) => {
    stderr.push(parts.map(String).join(' '));
  };
  try {
    runCount += 1;
    await load(runCount);
    const exitCode = await exited;
    return { exitCode, stdout, stderr };
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalLog;
    console.error = originalError;
    for (const key of CREDENTIAL_ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    __resetApiClientForTests();
  }
}

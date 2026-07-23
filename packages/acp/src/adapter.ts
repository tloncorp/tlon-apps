import { spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

export type AdapterExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

export interface AcpAdapter {
  stdin: Writable;
  stdout: Readable;
  exited: Promise<AdapterExit>;
  stop(signal?: NodeJS.Signals): void;
}

export type SpawnAdapterOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export function spawnAdapter(options: SpawnAdapterOptions): AcpAdapter {
  const child = spawn(options.command, options.args ?? [], {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  if (!child.stdin || !child.stdout) {
    throw new Error('ACP adapter did not expose stdin and stdout');
  }

  const exited = new Promise<AdapterExit>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });

  return {
    stdin: child.stdin,
    stdout: child.stdout,
    exited,
    stop(signal = 'SIGTERM') {
      child.kill(signal);
    },
  };
}

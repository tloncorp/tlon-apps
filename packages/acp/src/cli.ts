#!/usr/bin/env node
import process from 'node:process';

import { spawnAdapter } from './adapter.js';
import { AcpPump } from './pump.js';
import { UrbitAcpTransport } from './urbit-transport.js';

type CliOptions = {
  url: string;
  ship: string;
  code: string;
  connection: string;
  verbose: boolean;
  command: string;
  args: string[];
};

async function main() {
  const options = parseArgs(process.argv.slice(2), process.env);
  const transport = new UrbitAcpTransport(options);
  await transport.connect();

  const adapter = spawnAdapter({
    command: options.command,
    args: options.args,
    env: process.env,
  });
  const pump = new AcpPump(transport, adapter);
  pump.on('frameToAgent', (sequence) => {
    if (options.verbose) {
      console.error(`[tlon-acp] delivered agent frame ${sequence}`);
    }
  });
  pump.on('frameToClient', () => {
    if (options.verbose) {
      console.error('[tlon-acp] queued client frame');
    }
  });
  pump.on('error', (error) => {
    console.error(`[tlon-acp] ${error.message}`);
    adapter.stop();
  });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const forceExit = setTimeout(() => process.exit(130), 2_000);
    void pump.stop().then(
      () => {
        clearTimeout(forceExit);
        process.exit(130);
      },
      (error: unknown) => {
        console.error(
          `[tlon-acp] shutdown failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        clearTimeout(forceExit);
        process.exit(1);
      }
    );
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const exit = await pump.run();
  if (exit.signal) {
    console.error(`[tlon-acp] adapter exited on ${exit.signal}`);
    process.exit(1);
  }
  process.exit(exit.code ?? 1);
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv): CliOptions {
  const separator = argv.indexOf('--');
  if (separator === -1 || !argv[separator + 1]) {
    throw new Error(`${usage()}\nMissing adapter command after --`);
  }

  const flags = argv.slice(0, separator);
  const adapter = argv.slice(separator + 1);
  const values = new Map<string, string>();
  let verbose = false;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--verbose') {
      verbose = true;
      continue;
    }
    if (!['--url', '--ship', '--code', '--connection'].includes(flag)) {
      throw new Error(`${usage()}\nUnknown option: ${flag}`);
    }
    const value = flags[index + 1];
    if (!value) {
      throw new Error(`${usage()}\nMissing value for ${flag}`);
    }
    values.set(flag, value);
    index += 1;
  }

  const url = values.get('--url') ?? env.URBIT_URL;
  const ship = values.get('--ship') ?? env.URBIT_SHIP;
  const code = values.get('--code') ?? env.URBIT_CODE;
  const connection = values.get('--connection') ?? env.ACP_CONNECTION;
  if (!url || !ship || !code || !connection) {
    throw new Error(
      `${usage()}\nShip URL, ship, code, and connection are required`
    );
  }

  return {
    url,
    ship,
    code,
    connection,
    verbose,
    command: adapter[0],
    args: adapter.slice(1),
  };
}

function usage() {
  return [
    'Usage: tlon-acp [options] -- <adapter> [adapter args...]',
    '',
    'Options (or environment variables):',
    '  --url URL               URBIT_URL',
    '  --ship ~ship            URBIT_SHIP',
    '  --code code             URBIT_CODE',
    '  --connection id         ACP_CONNECTION',
    '  --verbose',
  ].join('\n');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

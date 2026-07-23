#!/usr/bin/env node
import {
  AcpClient,
  AcpPump,
  UrbitAcpTransport,
  spawnAdapter,
} from '@tloncorp/acp';
import { once } from 'node:events';
import process from 'node:process';

import { readConfig } from './config.js';
import { adapterEnvironment } from './credentials.js';
import { TlonRouter } from './routing.js';
import { AcpSessionManager } from './session-manager.js';
import { FileSessionStore } from './session-store.js';
import { TlonMessenger } from './tlon-messenger.js';

async function main(): Promise<void> {
  const config = readConfig(process.argv.slice(2));
  const transportOptions = {
    url: config.url,
    ship: config.ship,
    code: config.code,
    connection: config.connection,
  };
  const pumpTransport = new UrbitAcpTransport(transportOptions);
  const clientTransport = new UrbitAcpTransport(transportOptions);
  await Promise.all([pumpTransport.connect(), clientTransport.connect()]);

  const adapter = spawnAdapter({
    command: config.adapterCommand,
    args: config.adapterArgs,
    cwd: config.cwd,
    env: adapterEnvironment(process.env, config.adapterHome),
  });
  const pump = new AcpPump(pumpTransport, adapter);
  pump.on('error', report);
  const ready = once(pump, 'ready');
  const pumpRun = pump.run();
  await ready;

  const client = new AcpClient(clientTransport, {
    name: 'tlon-acp',
    title: 'Tlon ACP bot',
    version: '0.0.1',
    permissionPolicy: config.permissionPolicy,
  });
  client.on('error', report);
  const initialize = await client.start();
  const manager = new AcpSessionManager(client, {
    cwd: config.cwd,
    store: new FileSessionStore(config.stateFile),
    agentCapabilities: record(initialize.agentCapabilities),
    mcpServers: config.mcpServers,
    toolInstructions: config.toolInstructions,
  });
  await manager.start();

  const messenger = new TlonMessenger({
    url: config.url,
    ship: config.ship,
    code: config.code,
    router: new TlonRouter(config.routing),
  });
  await messenger.start(async (message) => {
    const response = await manager.prompt(message);
    await messenger.send(message, response);
  });
  console.error(
    `[tlon-acp] ready as ~${config.ship} on ${config.connection} (${config.adapterCommand})`
  );

  let stopping = false;
  const stop = async (code: number): Promise<never> => {
    if (stopping) return await new Promise<never>(() => undefined);
    stopping = true;
    const force = setTimeout(() => process.exit(code), 2_000);
    manager.stop();
    await Promise.allSettled([messenger.stop(), client.stop(), pump.stop()]);
    clearTimeout(force);
    process.exit(code);
  };
  process.once('SIGINT', () => void stop(130));
  process.once('SIGTERM', () => void stop(143));

  const exit = await pumpRun;
  await stop(exit.code ?? 1);
}

function report(error: unknown): void {
  console.error(
    `[tlon-acp] ${error instanceof Error ? error.message : String(error)}`
  );
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

main().catch((error: unknown) => {
  report(error);
  process.exitCode = 1;
});

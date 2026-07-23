#!/usr/bin/env node
import { AcpClient, StdioAcpTransport, spawnAdapter } from '@tloncorp/acp';
import process from 'node:process';

import { readConfig } from './config.js';
import { adapterEnvironment } from './credentials.js';
import { AcpSessionManager } from './session-manager.js';
import { FileSessionStore } from './session-store.js';
import { TlonMessageBus } from './tlon-message-bus.js';

async function main(): Promise<void> {
  const config = readConfig(process.argv.slice(2));
  const adapter = spawnAdapter({
    command: config.adapterCommand,
    args: config.adapterArgs,
    cwd: config.cwd,
    env: adapterEnvironment(process.env, config.adapterHome),
  });
  const client = new AcpClient(new StdioAcpTransport(adapter), {
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

  const messageBus = new TlonMessageBus({
    url: config.url,
    ship: config.ship,
    code: config.code,
    routing: config.routing,
  });
  await messageBus.start(async (message) => {
    const response = await manager.prompt(message);
    await messageBus.reply(message.sequence, response);
  });
  console.error(
    `[tlon-acp] ready as ~${config.ship} (${config.adapterCommand})`
  );

  let stopping = false;
  const stop = async (code: number): Promise<never> => {
    if (stopping) return await new Promise<never>(() => undefined);
    stopping = true;
    const force = setTimeout(() => process.exit(code), 2_000);
    manager.stop();
    adapter.stop();
    await Promise.allSettled([messageBus.stop(), client.stop()]);
    clearTimeout(force);
    process.exit(code);
  };
  process.once('SIGINT', () => void stop(130));
  process.once('SIGTERM', () => void stop(143));

  const exit = await adapter.exited;
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

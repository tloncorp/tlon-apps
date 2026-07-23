import { isAbsolute, resolve } from 'node:path';

import { type RoutingPolicy, normalizeShip } from './messages.js';

export type BotConfig = {
  ship: string;
  url: string;
  code: string;
  cwd: string;
  stateFile: string;
  adapterHome?: string;
  adapterCommand: string;
  adapterArgs: string[];
  permissionPolicy: 'deny' | 'allow-once';
  mcpServers: unknown[];
  toolInstructions?: string;
  routing: RoutingPolicy;
};

export function readConfig(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): BotConfig {
  const separator = argv.indexOf('--');
  const adapter = separator >= 0 ? argv.slice(separator + 1) : [];
  if (!adapter.length) {
    throw new Error('Adapter command is required after --');
  }
  const ship = required(env.TLON_SHIP, 'TLON_SHIP');
  const ownerShip = required(env.TLON_ACP_OWNER, 'TLON_ACP_OWNER');
  const cwd = resolve(env.ACP_WORKSPACE ?? process.cwd());
  const adapterHome = env.ACP_ADAPTER_HOME;
  if (adapterHome && !isAbsolute(adapterHome)) {
    throw new Error('ACP_ADAPTER_HOME must be an absolute path');
  }
  return {
    ship: normalizeShip(ship),
    url: required(env.TLON_URL, 'TLON_URL'),
    code: required(env.TLON_CODE, 'TLON_CODE'),
    cwd,
    stateFile: resolve(env.ACP_STATE_FILE ?? '.tlon-acp/sessions.json'),
    adapterHome,
    adapterCommand: adapter[0],
    adapterArgs: adapter.slice(1),
    permissionPolicy:
      env.ACP_PERMISSION_POLICY === 'allow-once' ? 'allow-once' : 'deny',
    mcpServers: jsonArray(env.ACP_MCP_SERVERS_JSON, 'ACP_MCP_SERVERS_JSON'),
    toolInstructions:
      env.TLON_ACP_TOOLS === 'cli'
        ? 'The `tlon` CLI is available in PATH and is already configured for this bot ship. You may use it when the request requires Tlon tools.'
        : env.TLON_ACP_TOOL_INSTRUCTIONS,
    routing: {
      ownerShip,
      allowedDmShips: csv(env.TLON_ACP_DM_ALLOWLIST),
      allowedChannelShips: csv(env.TLON_ACP_CHANNEL_ALLOWLIST),
      channels: csv(env.TLON_ACP_CHANNELS),
      requireChannelMention: env.TLON_ACP_REQUIRE_MENTION !== 'false',
      ownerListen: env.TLON_ACP_OWNER_LISTEN !== 'false',
    },
  };
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function jsonArray(value: string | undefined, name: string): unknown[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${name} must be a JSON array`);
  return parsed;
}

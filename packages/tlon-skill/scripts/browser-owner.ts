import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function ship(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/^~/, '');
  return /^[a-z]+(?:-[a-z]+)*$/.test(normalized) ? normalized : undefined;
}

function configuredOwner(
  config: unknown,
  activeShip: string
): string | undefined {
  const root = object(config);
  const tlon = object(object(root.channels).tlon);
  if (Object.keys(tlon).length === 0) return undefined;

  const normalizedActiveShip = ship(activeShip);
  const baseOwner = ship(tlon.ownerShip);
  const baseShip = ship(tlon.ship);
  if (baseShip && baseShip === normalizedActiveShip) {
    return baseOwner ? `~${baseOwner}` : undefined;
  }

  const matches = Object.values(object(tlon.accounts))
    .map(object)
    .filter((account) => ship(account.ship) === normalizedActiveShip);
  if (matches.length !== 1) return undefined;
  const owner = ship(matches[0].ownerShip) ?? baseOwner;
  return owner ? `~${owner}` : undefined;
}

export type BrowserOwnerResolutionInput = {
  activeShip: string;
  env?: Record<string, string | undefined>;
  homeDir?: string;
  exists?: (filePath: string) => boolean;
  readFile?: (filePath: string) => string;
};

export function resolveBrowserOwnerShip(
  input: BrowserOwnerResolutionInput
): string {
  const env = input.env ?? process.env;
  const homeDir = input.homeDir ?? os.homedir();
  const exists = input.exists ?? fs.existsSync;
  const readFile =
    input.readFile ?? ((filePath) => fs.readFileSync(filePath, 'utf-8'));
  const explicitPath = env.OPENCLAW_CONFIG?.trim();
  const candidates = explicitPath
    ? [explicitPath]
    : [
        path.join(homeDir, '.openclaw', 'openclaw.json'),
        path.join(homeDir, '.clawdbot', 'moltbot.json'),
        path.join(homeDir, '.moltbot', 'moltbot.json'),
      ];

  for (const configPath of candidates) {
    if (!exists(configPath)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFile(configPath));
    } catch {
      if (explicitPath) {
        throw new Error(`could not read configured owner from ${configPath}`);
      }
      continue;
    }
    const owner = configuredOwner(parsed, input.activeShip);
    if (owner) return owner;
    if (explicitPath) {
      throw new Error(
        `OpenClaw has no owner configured for ~${ship(input.activeShip) ?? input.activeShip}`
      );
    }
  }

  throw new Error(
    `OpenClaw has no owner configured for ~${ship(input.activeShip) ?? input.activeShip}`
  );
}

import * as path from 'path';

import {
  type CliCredentialOverrides,
  getDefaultOpenClawConfigPaths,
} from '../credential-resolver';

export interface OwnerCredentialsInput {
  env: Record<string, string | undefined>;
  fileExists: (filePath: string) => boolean;
  readFile: (filePath: string) => string;
  homeDir: string;
  /** Ship of the current credential resolution, or null when none resolves. */
  currentShip: string | null;
}

export type OwnerCredentialsResolution =
  | {
      kind: 'overrides';
      overrides: CliCredentialOverrides;
      ownerShip: string;
    }
  | { kind: 'self' }
  | { kind: 'error'; message: string };

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeShipName(ship: string): string {
  return ship.replace(/^~/, '');
}

function ownerShipFromConfigFile(
  input: OwnerCredentialsInput,
  configPath: string
): string | undefined {
  try {
    const parsed = JSON.parse(input.readFile(configPath)) as {
      channels?: { tlon?: { ownerShip?: unknown } };
    };
    const ownerShip = parsed?.channels?.tlon?.ownerShip;
    return nonEmpty(ownerShip) ? ownerShip : undefined;
  } catch {
    return undefined;
  }
}

function ownerShipFromOpenClawConfig(
  input: OwnerCredentialsInput
): string | undefined {
  const configPath = input.env.OPENCLAW_CONFIG;
  if (nonEmpty(configPath)) {
    return ownerShipFromConfigFile(input, configPath);
  }
  // No explicit config path: discover the standard OpenClaw config locations,
  // mirroring the credential resolver's own best-effort default-path search.
  for (const defaultPath of getDefaultOpenClawConfigPaths(input.homeDir)) {
    if (!input.fileExists(defaultPath)) continue;
    const ownerShip = ownerShipFromConfigFile(input, defaultPath);
    if (ownerShip) return ownerShip;
  }
  return undefined;
}

export function resolveOwnerCredentials(
  input: OwnerCredentialsInput
): OwnerCredentialsResolution {
  const envOwnerShip = input.env.TLON_OWNER_SHIP?.trim();
  const rawOwnerShip = nonEmpty(envOwnerShip)
    ? envOwnerShip
    : ownerShipFromOpenClawConfig(input);

  if (!rawOwnerShip) {
    return {
      kind: 'error',
      message:
        "Could not determine the owner ship's identity. Checked TLON_OWNER_SHIP and channels.tlon.ownerShip in the OpenClaw config (OPENCLAW_CONFIG or the standard config paths). " +
        "Invite links are retrieved as the owner by default; use --self for the current ship's own link or pass explicit credential flags.",
    };
  }

  const ownerShip = normalizeShipName(rawOwnerShip);

  if (
    input.currentShip !== null &&
    normalizeShipName(input.currentShip) === ownerShip
  ) {
    return { kind: 'self' };
  }

  const skillDir = input.env.TLON_SKILL_DIR;
  if (nonEmpty(skillDir)) {
    const shipConfigPath = path.join(skillDir, 'ships', `${ownerShip}.json`);
    if (input.fileExists(shipConfigPath)) {
      return {
        kind: 'overrides',
        overrides: { kind: 'ship', ship: ownerShip },
        ownerShip,
      };
    }
  }

  const ownerUrl = input.env.TLON_OWNER_URL;
  const planetCode = nonEmpty(input.env.TLON_PLANET_CODE)
    ? input.env.TLON_PLANET_CODE
    : nonEmpty(input.env.URBIT_PLANET_CODE)
      ? input.env.URBIT_PLANET_CODE
      : undefined;
  if (nonEmpty(ownerUrl) && planetCode) {
    return {
      kind: 'overrides',
      overrides: {
        kind: 'code',
        url: ownerUrl,
        ship: ownerShip,
        code: planetCode,
      },
      ownerShip,
    };
  }

  const checkedShipConfig = nonEmpty(skillDir)
    ? path.join(skillDir, 'ships', `${ownerShip}.json`)
    : `$TLON_SKILL_DIR/ships/${ownerShip}.json`;
  return {
    kind: 'error',
    message:
      `No credentials found for owner ship ~${ownerShip}. ` +
      `Checked ${checkedShipConfig} and TLON_OWNER_URL with TLON_PLANET_CODE/URBIT_PLANET_CODE. ` +
      "Owner credentials are only provisioned on Tlon-hosted deployments; use --self for the current ship's own link or pass explicit credential flags.",
  };
}

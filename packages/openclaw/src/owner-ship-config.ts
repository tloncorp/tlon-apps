import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where a hosted deployment provisions the owner's CLI credentials
 * (`$TLON_SKILL_DIR/ships/<owner>.json`, written by tlawn). Topology only: the
 * path shape and whether the file is there. Callers word their own errors —
 * `/migrate` and the `tlon` tool report different failures to different
 * audiences — so this returns a discriminated location, not a message.
 */
export type OwnerShipConfigDeps = {
  env?: NodeJS.ProcessEnv;
  fileExists?: (path: string) => boolean;
};

export type OwnerShipConfigLocation =
  | { kind: 'found'; configPath: string }
  | { kind: 'no-skill-dir' }
  | { kind: 'no-config-file'; configPath: string };

export function locateOwnerShipConfig(
  ownerShip: string,
  deps: OwnerShipConfigDeps = {}
): OwnerShipConfigLocation {
  const skillDir = String(
    (deps.env ?? process.env).TLON_SKILL_DIR ?? ''
  ).trim();
  if (!skillDir) {
    return { kind: 'no-skill-dir' };
  }

  const configPath = join(
    skillDir,
    'ships',
    `${ownerShip.replace(/^~/, '')}.json`
  );
  return (deps.fileExists ?? existsSync)(configPath)
    ? { kind: 'found', configPath }
    : { kind: 'no-config-file', configPath };
}

// src/plugin.ts
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { ClientName } from './config';

export const CLIENTS: ClientName[] = ['claude', 'codex'];
export const CLIENT_NAMES: Record<ClientName, string> = { claude: 'Claude Code', codex: 'Codex' };
/**
 * The marketplace is the tlon-apps repo (.claude-plugin/marketplace.json at its root, which Codex reads too); the package's own
 * marketplace.json, for installing from a checkout, uses the same name, so the plugin id is the same either way.
 */
const MARKETPLACE = 'tlon-apps', REPO = 'tloncorp/tlon-apps', ID = `tlon-memory@${MARKETPLACE}`;

export const CODEX_TRUST_NOTE = 'Codex: after installing, run /hooks in Codex once to review and trust the tlon-memory hooks. They do not run until trusted.';

export const quote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`);

export function installCommand(client: ClientName): string {
  return `${client} plugin marketplace add ${REPO} && ${client} plugin ${client === 'claude' ? 'install' : 'add'} ${ID}`;
}

export function uninstallCommand(client: ClientName): string {
  return `${client} plugin ${client === 'claude' ? 'uninstall' : 'remove'} ${ID} && ${client} plugin marketplace remove ${MARKETPLACE}`;
}

export function onPath(cmd: string, path = process.env.PATH ?? ''): boolean {
  return path.split(delimiter).some((d) => {
    if (!d) return false;
    try { accessSync(join(d, cmd), constants.X_OK); return true; } catch { return false; }
  });
}

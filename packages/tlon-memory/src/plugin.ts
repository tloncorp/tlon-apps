// src/plugin.ts
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { ClientName } from './config';

export const CLIENTS: ClientName[] = ['claude', 'codex'];
export const CLIENT_NAMES: Record<ClientName, string> = { claude: 'Claude Code', codex: 'Codex' };
/** .claude-plugin/marketplace.json names the marketplace and its one plugin the same; Codex reads that file too. */
const NAME = 'tlon-memory', ID = `${NAME}@${NAME}`;

export const CODEX_TRUST_NOTE = 'Codex: after installing, run /hooks in Codex once to review and trust the tlon-memory hooks. They do not run until trusted.';

const quote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`);

export function installCommand(client: ClientName, root: string): string {
  return client === 'claude' ? `claude plugin install ${NAME} --marketplace ${quote(root)}`
    : `codex plugin marketplace add ${quote(root)} && codex plugin add ${ID}`;
}

export function uninstallCommand(client: ClientName): string {
  return `${client} plugin ${client === 'claude' ? 'uninstall' : 'remove'} ${ID} && ${client} plugin marketplace remove ${NAME}`;
}

export function onPath(cmd: string, path = process.env.PATH ?? ''): boolean {
  return path.split(delimiter).some((d) => {
    if (!d) return false;
    try { accessSync(join(d, cmd), constants.X_OK); return true; } catch { return false; }
  });
}

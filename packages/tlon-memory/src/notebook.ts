// src/notebook.ts
import { Config } from './config';
import { Note, NotesClient } from './notes-client';
import { parseFrontMatter, partOf } from './render';

export type NotebookInfo = NonNullable<Config['notebook']>;

/** Find-or-create the notebook (hosted by our ship, matching title) and its two folders. `created`: it did not exist. */
export async function ensureNotebook(c: NotesClient, title: string): Promise<NotebookInfo & { created: boolean }> {
  const ship = await c.hostName();
  const existing = (await c.listNotebooks()).find((n) => n.host === ship && n.notebook.title === title);
  const nb = existing
    ? { host: existing.host, flagName: existing.flagName, rootFolderId: existing.notebook.rootFolderId, title }
    : await c.createNotebook(title);
  const folders = await c.listFolders(nb.host, nb.flagName);
  const find = (name: string) => folders.find((f) => f.name === name && f.parentFolderId === nb.rootFolderId)?.id;
  const conversationsFolderId = find('conversations') ?? (await c.createFolder(nb.host, nb.flagName, 'conversations', nb.rootFolderId));
  const memoriesFolderId = find('memories') ?? (await c.createFolder(nb.host, nb.flagName, 'memories', nb.rootFolderId));
  return { host: nb.host, name: nb.flagName, title, rootFolderId: nb.rootFolderId, conversationsFolderId, memoriesFolderId, created: !existing };
}

export function noteUrl(shipUrl: string, nb: Pick<NotebookInfo, 'host' | 'name'>, noteId: number) {
  return `${notebookUrl(shipUrl, nb)}/n/${noteId}`;
}

export function notebookUrl(shipUrl: string, nb: Pick<NotebookInfo, 'host' | 'name'>) {
  return `${shipUrl.replace(/\/+$/, '')}/notes/nb/${nb.host}/${nb.name}`;
}

export interface SessionNote extends Note { part: number; parts: number; first?: string; last?: string }

/**
 * Conversation notes whose front matter names exactly this session key, one per part, ordered by part.
 * Substring search alone would also match keys that merely start with this one.
 */
export async function findSessionNotes(c: NotesClient, nb: NotebookInfo, key: string): Promise<SessionNote[]> {
  const hits = await c.searchText(nb.host, nb.name, `session_key: ${key}`, 50);
  const byPart = new Map<number, SessionNote>();
  for (const n of hits.filter((h) => h.folderId === nb.conversationsFolderId).sort((a, b) => a.id - b.id)) {
    const f = parseFrontMatter(n.bodyMd).fields;
    if (f['tlon-memory'] !== 'conversation/v1' || f.session_key !== key) continue;
    const p = partOf(f);
    if (!byPart.has(p.part)) byPart.set(p.part, { ...n, ...p, first: f.first, last: f.last });
  }
  return [...byPart.values()].sort((a, b) => a.part - b.part);
}

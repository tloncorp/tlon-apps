// src/notebook.ts
import { Config } from './config';
import { NotesClient } from './notes-client';

export type NotebookInfo = NonNullable<Config['notebook']>;

/** Find-or-create the notebook (hosted by our ship, matching title) and its two folders. */
export async function ensureNotebook(c: NotesClient, title: string): Promise<NotebookInfo> {
  const ship = await c.hostName();
  const existing = (await c.listNotebooks()).find((n) => n.host === ship && n.notebook.title === title);
  const nb = existing
    ? { host: existing.host, flagName: existing.flagName, rootFolderId: existing.notebook.rootFolderId, title }
    : await c.createNotebook(title);
  const folders = await c.listFolders(nb.host, nb.flagName);
  const find = (name: string) => folders.find((f) => f.name === name && f.parentFolderId === nb.rootFolderId)?.id;
  const conversationsFolderId = find('conversations') ?? (await c.createFolder(nb.host, nb.flagName, 'conversations', nb.rootFolderId));
  const memoriesFolderId = find('memories') ?? (await c.createFolder(nb.host, nb.flagName, 'memories', nb.rootFolderId));
  return { host: nb.host, name: nb.flagName, title, rootFolderId: nb.rootFolderId, conversationsFolderId, memoriesFolderId };
}

export function noteUrl(shipUrl: string, nb: Pick<NotebookInfo, 'host' | 'name'>, noteId: number) {
  return `${shipUrl.replace(/\/+$/, '')}/notes/nb/${nb.host}/${nb.name}/n/${noteId}`;
}

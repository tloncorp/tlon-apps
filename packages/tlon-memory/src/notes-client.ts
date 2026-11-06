// src/notes-client.ts
export type NotesErrorCode = 'key-rejected' | 'unreachable' | 'not-found' | 'conflict' | 'too-large' | 'bad-code' | 'protocol';
export class NotesError extends Error {
  constructor(public code: NotesErrorCode, message: string, public status?: number) { super(message); }
}

export interface NotebookRef { host: string; flagName: string; rootFolderId: number; title: string }
export interface Note { id: number; notebookId: number; folderId: number; title: string; bodyMd: string; revision: number; createdAt: number; updatedAt: number; createdBy: string }
export type UpdateResult =
  | { kind: 'updated'; revision: number }
  | { kind: 'no-change'; revision?: undefined }
  | { kind: 'conflict'; revision?: undefined };

const enc = (s: string) => encodeURIComponent(s);

export class NotesClient {
  shipUrl: string; private apiKey: string;
  constructor(o: { shipUrl: string; apiKey: string }) { this.shipUrl = o.shipUrl.replace(/\/+$/, ''); this.apiKey = o.apiKey; }

  private async req(method: string, path: string, body?: unknown): Promise<any> {
    let res: Response;
    try {
      res = await fetch(`${this.shipUrl}${path}`, {
        method, headers: { 'X-Api-Key': this.apiKey, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25_000),
      });
    } catch (e) { throw new NotesError('unreachable', `cannot reach ${this.shipUrl}: ${(e as Error).message}`); }
    if (res.status === 401 || res.status === 403) throw new NotesError('key-rejected', 'the ship rejected the API key', res.status);
    if (res.status === 404) throw new NotesError('not-found', `${method} ${path}: not found`, 404);
    if (res.status >= 500 || res.status === 429) throw new NotesError('unreachable', `${method} ${path}: HTTP ${res.status}`, res.status);
    if (!res.ok) throw new NotesError('protocol', `${method} ${path}: HTTP ${res.status}`, res.status);
    const text = await res.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  }

  private unwrap(r: any) {
    const b = r?.body;
    if (!b) throw new NotesError('protocol', 'missing response body');
    if (b.type === 'error') {
      if (b.errorType === 'conflict') throw new NotesError('conflict', 'revision conflict');
      if (b.errorType === 'not-found') throw new NotesError('not-found', 'not found');
      if (b.errorType === 'request-too-large') throw new NotesError('too-large', 'request too large');
      if (b.errorType === 'not-authorized') throw new NotesError('key-rejected', 'not authorized');
      throw new NotesError('protocol', `ship error: ${b.errorType}`);
    }
    if (b.type === 'pending') throw new NotesError('unreachable', `request still pending (${b.status})`);
    return b;
  }

  async hostName(): Promise<string> {
    const res = await fetch(`${this.shipUrl}/~/host`, { signal: AbortSignal.timeout(10_000) }).catch((e) => { throw new NotesError('unreachable', e.message); });
    if (!res.ok) throw new NotesError('unreachable', `/~/host HTTP ${res.status}`);
    const t = (await res.text()).trim();
    if (!/^~[a-z-]+$/.test(t)) throw new NotesError('protocol', `unexpected /~/host: ${t.slice(0, 40)}`);
    return t;
  }

  listNotebooks(): Promise<{ host: string; flagName: string; notebook: { id: number; title: string; rootFolderId: number } }[]> {
    return this.req('GET', '/notes/~/v1/notebooks');
  }
  async createNotebook(title: string): Promise<NotebookRef> {
    const b = this.unwrap(await this.req('POST', '/notes/~/v1/notebooks', { title }));
    if (b.type !== 'notebook') throw new NotesError('protocol', `expected notebook, got ${b.type}`);
    return { host: b.notebook.host, flagName: b.notebook.flagName, rootFolderId: b.notebook.notebook.rootFolderId, title: b.notebook.notebook.title };
  }
  listFolders(host: string, name: string): Promise<{ id: number; name: string; parentFolderId: number | null }[]> {
    return this.req('GET', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/folders`);
  }
  async createFolder(host: string, name: string, folderName: string, parent: number): Promise<number> {
    const b = this.unwrap(await this.req('POST', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/folders`, { folderName, parent }));
    const id = b.response?.update?.folderUpdate?.folder?.id ?? b.response?.update?.folderUpdate?.id;
    if (typeof id !== 'number') throw new NotesError('protocol', 'no folder id in response');
    return id;
  }
  listNotes(host: string, name: string): Promise<Note[]> {
    return this.req('GET', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes`);
  }
  getNote(host: string, name: string, id: number): Promise<Note> {
    return this.req('GET', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes/${id}`);
  }
  async createNote(host: string, name: string, folder: number, title: string, body: string): Promise<{ id: number; revision: number }> {
    const b = this.unwrap(await this.req('POST', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes`, { folder, title, body }));
    const n = b.response?.update?.noteUpdate?.note;
    if (!n || typeof n.id !== 'number') throw new NotesError('protocol', 'no note in response');
    return { id: n.id, revision: n.revision ?? 1 };
  }
  async updateNote(host: string, name: string, id: number, body: string, expectedRevision?: number): Promise<UpdateResult> {
    try {
      const b = this.unwrap(await this.req('PUT', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes/${id}`,
        { body, ...(expectedRevision !== undefined ? { expectedRevision } : {}) }));
      if (b.type === 'no-change') return { kind: 'no-change' };
      return { kind: 'updated', revision: b.response?.update?.noteUpdate?.note?.revision ?? (expectedRevision ?? 0) + 1 };
    } catch (e) { if (e instanceof NotesError && e.code === 'conflict') return { kind: 'conflict' }; throw e; }
  }
  async renameNote(host: string, name: string, id: number, title: string): Promise<void> {
    this.unwrap(await this.req('PUT', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes/${id}`, { title }));
  }
  async deleteNote(host: string, name: string, id: number): Promise<void> {
    this.unwrap(await this.req('DELETE', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes/${id}`));
  }
  /** Bounded substring search; pages until `last === 0` or `max` hits. */
  async searchText(host: string, name: string, needle: string, max = 25): Promise<Note[]> {
    const out: Note[] = []; let from = 0;
    for (let i = 0; i < 20; i++) {
      const r = await this.req('GET', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/search/bounded/text?needle=${enc(needle)}&from=${from}&tries=100`);
      out.push(...(r.notes ?? []));
      if (!r.last || out.length >= max) break;
      from = r.last;
    }
    return out.slice(0, max);
  }

  /** Setup only: exchange +code for the Notes API key. The cookie and code are discarded. */
  static async apiKeyFromCode(shipUrl: string, code: string): Promise<string> {
    const base = shipUrl.replace(/\/+$/, '');
    const login = await fetch(`${base}/~/login`, { method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `password=${encodeURIComponent(code)}&redirect=/` })
      .catch((e) => { throw new NotesError('unreachable', e.message); });
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    if (!cookie || !cookie.startsWith('urbauth-')) throw new NotesError('bad-code', 'login failed: wrong +code?');
    const h = { cookie };
    const scry = await fetch(`${base}/~/scry/notes/v0/api-key.json`, { headers: h });
    if (scry.status === 401 || scry.status === 403) throw new NotesError('bad-code', 'login cookie not accepted');
    if (!scry.ok) throw new NotesError('protocol', `api-key scry HTTP ${scry.status}`);
    let key = await scry.json();
    if (typeof key !== 'string' || !key) {
      const r = await fetch(`${base}/notes/~/v1`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ action: { type: 'regenerate-api-key' } }) });
      const j = await r.json();
      key = j?.body?.apiKey;
      if (typeof key !== 'string') throw new NotesError('protocol', 'could not mint an API key');
    }
    return key;
  }
  /** Rotate the key (disconnect --revoke-key). Needs +code because the old key may be lost. */
  static async regenerateWithCode(shipUrl: string, code: string): Promise<void> {
    const base = shipUrl.replace(/\/+$/, '');
    const login = await fetch(`${base}/~/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `password=${encodeURIComponent(code)}&redirect=/` });
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    if (!cookie?.startsWith('urbauth-')) throw new NotesError('bad-code', 'login failed');
    await fetch(`${base}/notes/~/v1`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: { type: 'regenerate-api-key' } }) });
  }
}

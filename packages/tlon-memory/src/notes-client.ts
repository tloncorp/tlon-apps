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
const REQUEST_TIMEOUT_MS = 25_000;
export const DEADLINE_EXCEEDED = 'deadline exceeded';
/** The caller's time budget ran out; not evidence about the ship's health. */
export const isDeadline = (e: unknown) => e instanceof NotesError && e.code === 'unreachable' && e.message === DEADLINE_EXCEEDED;
const CODE_TIMEOUT_MS = 10_000;

function asArray<T>(v: unknown, what: string): T[] {
  if (!Array.isArray(v)) throw new NotesError('protocol', `${what}: expected a list`);
  return v as T[];
}

export class NotesClient {
  shipUrl: string; private apiKey: string;
  /** Absolute ms timestamp; requests share it so a sync run cannot outlive its budget. */
  deadline?: number;
  constructor(o: { shipUrl: string; apiKey: string; deadline?: number }) {
    this.shipUrl = o.shipUrl.replace(/\/+$/, ''); this.apiKey = o.apiKey; this.deadline = o.deadline;
  }

  private signal(): AbortSignal {
    if (this.deadline === undefined) return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const left = this.deadline - Date.now();
    if (left <= 0) throw new NotesError('unreachable', DEADLINE_EXCEEDED);
    return AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, left));
  }

  private async req(method: string, path: string, body?: unknown): Promise<any> {
    // errors name the path only: the query string can carry a search needle taken from conversation text
    const where = `${method} ${path.split('?')[0]}`;
    const signal = this.signal();
    let res: Response;
    try {
      res = await fetch(`${this.shipUrl}${path}`, {
        method, headers: { 'X-Api-Key': this.apiKey, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined, signal,
      });
    } catch (e) {
      if (this.deadline !== undefined && Date.now() >= this.deadline) throw new NotesError('unreachable', DEADLINE_EXCEEDED);
      throw new NotesError('unreachable', `cannot reach ${this.shipUrl}: ${(e as Error).message}`);
    }
    if (res.status === 401 || res.status === 403) throw new NotesError('key-rejected', 'the ship rejected the API key', res.status);
    if (res.status === 404) throw new NotesError('not-found', `${where}: not found`, 404);
    if (res.status >= 500 || res.status === 429) throw new NotesError('unreachable', `${where}: HTTP ${res.status}`, res.status);
    if (!res.ok) throw new NotesError('protocol', `${where}: HTTP ${res.status}`, res.status);
    let text: string;
    try { text = await res.text(); } catch (e) { throw new NotesError('unreachable', `${where}: ${(e as Error).message}`); }
    if (!text) return null;
    try { return JSON.parse(text); } catch { throw new NotesError('protocol', `${where}: response is not JSON`, res.status); }
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
    const signal = this.signal();
    const res = await fetch(`${this.shipUrl}/~/host`, { signal }).catch((e) => { throw new NotesError('unreachable', e.message); });
    if (!res.ok) throw new NotesError('unreachable', `/~/host HTTP ${res.status}`);
    const t = (await res.text()).trim();
    if (!/^~[a-z-]+$/.test(t)) throw new NotesError('protocol', `unexpected /~/host: ${t.slice(0, 40)}`);
    return t;
  }

  async listNotebooks(): Promise<{ host: string; flagName: string; notebook: { id: number; title: string; rootFolderId: number } }[]> {
    return asArray(await this.req('GET', '/notes/~/v1/notebooks'), 'notebooks');
  }
  async createNotebook(title: string): Promise<NotebookRef> {
    const b = this.unwrap(await this.req('POST', '/notes/~/v1/notebooks', { title }));
    if (b.type !== 'notebook') throw new NotesError('protocol', `expected notebook, got ${b.type}`);
    return { host: b.notebook.host, flagName: b.notebook.flagName, rootFolderId: b.notebook.notebook.rootFolderId, title: b.notebook.notebook.title };
  }
  async listFolders(host: string, name: string): Promise<{ id: number; name: string; parentFolderId: number | null }[]> {
    return asArray(await this.req('GET', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/folders`), 'folders');
  }
  async createFolder(host: string, name: string, folderName: string, parent: number): Promise<number> {
    const b = this.unwrap(await this.req('POST', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/folders`, { folderName, parent }));
    const id = b.response?.update?.folderUpdate?.folder?.id ?? b.response?.update?.folderUpdate?.id;
    if (typeof id !== 'number') throw new NotesError('protocol', 'no folder id in response');
    return id;
  }
  async listNotes(host: string, name: string): Promise<Note[]> {
    return asArray(await this.req('GET', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes`), 'notes');
  }
  async getNote(host: string, name: string, id: number): Promise<Note> {
    const n = await this.req('GET', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes/${id}`);
    if (typeof n?.id !== 'number' || typeof n.revision !== 'number' || typeof n.bodyMd !== 'string') throw new NotesError('protocol', `note ${id}: unexpected shape`);
    return n;
  }
  async createNote(host: string, name: string, folder: number, title: string, body: string): Promise<{ id: number; revision: number }> {
    const b = this.unwrap(await this.req('POST', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes`, { folder, title, body }));
    const n = b.response?.update?.noteUpdate?.note;
    if (!n || typeof n.id !== 'number') throw new NotesError('protocol', 'no note in response');
    return { id: n.id, revision: n.revision ?? 1 };
  }
  async updateNote(host: string, name: string, id: number, body: string, expectedRevision?: number): Promise<UpdateResult> {
    try {
      const raw = await this.req('PUT', `/notes/~/v1/notebooks/${enc(host)}/${enc(name)}/notes/${id}`,
        { body, ...(expectedRevision !== undefined ? { expectedRevision } : {}) });
      // Older desks report a stale expectedRevision as errorType 'unknown'; the note's revision tells which it was.
      if (expectedRevision !== undefined && raw?.body?.type === 'error' && raw.body.errorType === 'unknown') {
        const cur = await this.getNote(host, name, id);
        if (cur.revision !== expectedRevision) return { kind: 'conflict' };
      }
      const b = this.unwrap(raw);
      if (b.type === 'no-change') return { kind: 'no-change' };
      const revision = b.response?.update?.noteUpdate?.note?.revision;
      if (typeof revision !== 'number') throw new NotesError('protocol', `note ${id}: update response has no revision`);
      return { kind: 'updated', revision };
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
      out.push(...asArray<Note>(r?.notes, 'search'));
      if (!r.last || out.length >= max) break;
      from = r.last;
    }
    return out.slice(0, max);
  }

  /** Setup only: exchange +code for the Notes API key. The cookie and code are discarded. */
  static async apiKeyFromCode(shipUrl: string, code: string): Promise<string> {
    const base = shipUrl.replace(/\/+$/, '');
    const cookie = await loginCookie(base, code);
    const scry = await codeFetch(`${base}/~/scry/notes/v0/api-key.json`, { headers: { cookie } });
    if (scry.status === 401 || scry.status === 403) throw new NotesError('bad-code', 'login cookie not accepted');
    if (!scry.ok) throw new NotesError('protocol', `api-key scry HTTP ${scry.status}`, scry.status);
    const key = await scry.json().catch(() => { throw new NotesError('protocol', 'api-key scry: response is not JSON'); });
    return typeof key === 'string' && key ? key : regenerate(base, cookie);
  }
  /** Rotate the key (disconnect --revoke-key) and return the new one. Needs +code because the old key may be lost. */
  static async regenerateWithCode(shipUrl: string, code: string): Promise<string> {
    const base = shipUrl.replace(/\/+$/, '');
    return regenerate(base, await loginCookie(base, code));
  }
}

async function codeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(CODE_TIMEOUT_MS) }); }
  catch (e) { throw new NotesError('unreachable', `cannot reach ${new URL(url).origin}: ${(e as Error).message}`); }
}

async function loginCookie(base: string, code: string): Promise<string> {
  const login = await codeFetch(`${base}/~/login`, { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `password=${encodeURIComponent(code)}&redirect=/` });
  if (login.status >= 500) throw new NotesError('unreachable', `/~/login HTTP ${login.status}`, login.status);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie || !cookie.startsWith('urbauth-')) throw new NotesError('bad-code', 'login failed: wrong +code?');
  return cookie;
}

async function regenerate(base: string, cookie: string): Promise<string> {
  const r = await codeFetch(`${base}/notes/~/v1`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ action: { type: 'regenerate-api-key' } }) });
  if (!r.ok) throw new NotesError(r.status >= 500 ? 'unreachable' : 'protocol', `regenerate-api-key HTTP ${r.status}`, r.status);
  const j = await r.json().catch(() => { throw new NotesError('protocol', 'regenerate-api-key: response is not JSON'); });
  if (j?.body?.type !== 'api-key' || typeof j.body.apiKey !== 'string' || !j.body.apiKey) throw new NotesError('protocol', 'could not mint an API key');
  return j.body.apiKey;
}

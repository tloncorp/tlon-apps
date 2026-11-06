// tests/fake-notes-server.ts
// In-process stand-in for a ship's /notes/~/v1 surface + /~/host + /~/login + api-key scry.
export interface FakeNote { id: number; notebookId: number; folderId: number; title: string; slug: null; bodyMd: string;
  createdBy: string; createdAt: number; updatedBy: string; updatedAt: number; revision: number }

export class FakeNotes {
  ship = '~zod'; apiKey = 'test-key'; code = 'lidlut-tabwed-pillex-ridrup';
  notebooks = new Map<string, { host: string; flagName: string; id: number; rootFolderId: number; title: string }>();
  folders = new Map<number, { id: number; notebookId: number; name: string; parentFolderId: number | null }>();
  notes = new Map<number, FakeNote>();
  requests: { method: string; path: string; body: any; headers: Headers }[] = [];
  failNext: number | null = null;   // set to an HTTP status to fail the next request once
  failNextOn: { path: string; status: number } | null = null; // fail the next request to this pathname once
  legacyConflict = false;           // older desks answer a stale expectedRevision with errorType 'unknown'
  unknownNext = false;              // answer the next note PUT with errorType 'unknown'
  scryNull = false;                 // the api-key scry returns null (no key minted yet)
  nextId = 100;
  server!: ReturnType<typeof Bun.serve>;
  get url() { return `http://127.0.0.1:${this.server.port}`; }

  start() { this.server = Bun.serve({ port: 0, fetch: (req) => this.handle(req) }); return this; }
  stop() { this.server.stop(true); }

  private rid() { return `0v${this.nextId.toString(32)}`; }
  private ok(update: any) { return Response.json({ requestId: this.rid(), body: { type: 'ok', response: { type: 'update', host: this.ship, flagName: 'x', time: 0, update } } }); }
  private err(errorType: string, status = 200) { return Response.json({ requestId: this.rid(), body: { type: 'error', errorType, message: [] } }, { status }); }

  private authed(req: Request) {
    const key = req.headers.get('x-api-key');
    const cookie = req.headers.get('cookie') ?? '';
    return key === this.apiKey || cookie.includes(`urbauth-${this.ship}=cookie-1`);
  }

  async handle(req: Request): Promise<Response> {
    const u = new URL(req.url);
    // Read the body once as text: /~/login needs the raw form, everything else JSON.
    const raw = req.method === 'GET' || req.method === 'DELETE' ? '' : await req.text();
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    this.requests.push({ method: req.method, path: u.pathname + u.search, body, headers: req.headers });
    if (this.failNext) { const s = this.failNext; this.failNext = null; return new Response('fail', { status: s }); }
    const p = u.pathname;
    if (this.failNextOn?.path === p) { const s = this.failNextOn.status; this.failNextOn = null; return new Response('fail', { status: s }); }
    if (p === '/~/host') return new Response(this.ship);
    if (p === '/~/login' && req.method === 'POST') {
      const form = new URLSearchParams(raw);
      if (form.get('password') !== this.code) return new Response('bad', { status: 400 });
      return new Response(null, { status: 303, headers: { 'set-cookie': `urbauth-${this.ship}=cookie-1; Path=/; Max-Age=1800` } });
    }
    if (!this.authed(req)) return new Response('unauthorized', { status: 401 });
    if (p === '/~/scry/notes/v0/api-key.json') return Response.json(this.scryNull ? null : this.apiKey);
    if (p === '/notes/~/v1' && req.method === 'POST') {
      if (body?.action?.type === 'regenerate-api-key') { this.apiKey = `key-${this.nextId++}`; return Response.json({ requestId: this.rid(), body: { type: 'api-key', apiKey: this.apiKey } }); }
      return this.err('unknown');
    }
    if (p === '/notes/~/v1/notebooks' && req.method === 'GET')
      return Response.json([...this.notebooks.values()].map((n) => ({ host: n.host, flagName: n.flagName, visibility: 'private', notebook: { id: n.id, title: n.title, rootFolderId: n.rootFolderId, createdBy: this.ship, createdAt: 0, updatedAt: 0, updatedBy: this.ship } })));
    if (p === '/notes/~/v1/notebooks' && req.method === 'POST') {
      const id = this.nextId++; const flagName = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + `-${id}`;
      const nb = { host: this.ship, flagName, id, rootFolderId: id + 1, title: body.title };
      this.notebooks.set(`${nb.host}/${flagName}`, nb); this.nextId++;
      this.folders.set(nb.rootFolderId, { id: nb.rootFolderId, notebookId: id, name: 'root', parentFolderId: null });
      return Response.json({ requestId: this.rid(), body: { type: 'notebook', notebook: { host: nb.host, flagName, visibility: 'private', notebook: { id, title: nb.title, rootFolderId: nb.rootFolderId, createdBy: this.ship, createdAt: 0, updatedAt: 0, updatedBy: this.ship } } } });
    }
    const m = /^\/notes\/~\/v1\/notebooks\/([^/]+)\/([^/]+)\/(folders|notes|search\/bounded\/text)(?:\/(\d+))?$/.exec(p);
    if (!m) return new Response('not found', { status: 404 });
    const nb = this.notebooks.get(`${decodeURIComponent(m[1])}/${m[2]}`);
    if (!nb) return new Response('not found', { status: 404 });
    const [, , , kind, idStr] = m; const id = idStr ? Number(idStr) : null;
    const inNb = (n: FakeNote) => n.notebookId === nb.id;
    if (kind === 'folders' && req.method === 'GET') return Response.json([...this.folders.values()].filter((f) => f.notebookId === nb.id));
    if (kind === 'folders' && req.method === 'POST') {
      if (!this.folders.has(body.parent)) return this.err('not-found');
      const f = { id: this.nextId++, notebookId: nb.id, name: body.folderName, parentFolderId: body.parent };
      this.folders.set(f.id, f);
      return this.ok({ type: 'folder-update', host: nb.host, flagName: nb.flagName, folderUpdate: { type: 'folder-created', id: f.id, folder: { ...f, createdBy: this.ship, createdAt: 0, updatedAt: 0, updatedBy: this.ship } } });
    }
    if (kind === 'notes' && req.method === 'GET' && id === null) return Response.json([...this.notes.values()].filter(inNb));
    if (kind === 'notes' && req.method === 'GET') { const n = this.notes.get(id!); return n && inNb(n) ? Response.json(n) : new Response('nf', { status: 404 }); }
    if (kind === 'notes' && req.method === 'POST') {
      if (typeof body.title !== 'string' || !this.folders.has(body.folder)) return new Response('bad', { status: 400 });
      if (Buffer.byteLength(body.body ?? '') > 1_000_000) return this.err('request-too-large');
      const n: FakeNote = { id: this.nextId++, notebookId: nb.id, folderId: body.folder, title: body.title, slug: null, bodyMd: body.body ?? '', createdBy: this.ship, createdAt: 1, updatedBy: this.ship, updatedAt: 1, revision: 1 };
      this.notes.set(n.id, n);
      return this.ok({ type: 'note-update', host: nb.host, flagName: nb.flagName, noteUpdate: { type: 'note-created', id: n.id, note: n } });
    }
    if (kind === 'notes' && req.method === 'PUT') {
      const n = this.notes.get(id!); if (!n || !inNb(n)) return this.err('not-found');
      if (this.unknownNext) { this.unknownNext = false; return this.err('unknown'); }
      if (typeof body.body === 'string') {
        if (body.expectedRevision != null && body.expectedRevision !== n.revision) return this.err(this.legacyConflict ? 'unknown' : 'conflict');
        if (body.body === n.bodyMd) return Response.json({ requestId: this.rid(), body: { type: 'no-change' } });
        n.bodyMd = body.body; n.revision++; n.updatedAt++;
      }
      if (typeof body.title === 'string') n.title = body.title;
      if (typeof body.folder === 'number') n.folderId = body.folder;
      return this.ok({ type: 'note-update', host: nb.host, flagName: nb.flagName, noteUpdate: { type: 'note-updated', id: n.id, note: n } });
    }
    if (kind === 'notes' && req.method === 'DELETE') {
      if (!this.notes.has(id!)) return this.err('not-found');
      this.notes.delete(id!); return this.ok({ type: 'note-update', host: nb.host, flagName: nb.flagName, noteUpdate: { type: 'note-deleted', id } });
    }
    if (kind === 'search/bounded/text') {
      const needle = u.searchParams.get('needle') ?? ''; const from = Number(u.searchParams.get('from') ?? 0); const tries = Number(u.searchParams.get('tries') ?? 100);
      const all = [...this.notes.values()].filter(inNb).sort((a, b) => b.id - a.id).filter((n) => from === 0 || n.id < from);
      const page = all.slice(0, tries);
      const hits = page.filter((n) => n.title.includes(needle) || n.bodyMd.includes(needle));
      const last = all.length > tries ? page[page.length - 1].id : 0;
      return Response.json({ last, notes: hits });
    }
    return new Response('not found', { status: 404 });
  }
}

// src/memory.ts
import { basename } from 'node:path';
import { Config } from './config';
import { ClientId } from './events';
import { noteUrl } from './notebook';
import { Note, NotesClient } from './notes-client';
import { Paths } from './paths';
import { Memory, MemoryStatus, MemoryType, parseFrontMatter, parseMemory, renderMemory } from './render';
import { listSessionStates } from './state';

export interface SaveInput { type: MemoryType; text: string; agent: ClientId; project: string; sessionKey?: string; event?: string }
export interface MemoryHit extends Memory { id: number; url: string; score: number; updatedAt: number }
export interface HistoryHit { noteId: number; sessionKey: string; client: string; title: string; snippet: string; url: string; updatedAt: number }

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9~_-]+/).filter((t) => t.length > 2));

export class MemoryStore {
  private c: NotesClient;
  constructor(private paths: Paths, private cfg: Config) { this.c = new NotesClient({ shipUrl: cfg.shipUrl, apiKey: cfg.apiKey }); }
  private get nb() { return this.cfg.notebook!; }
  private url(id: number) { return noteUrl(this.cfg.shipUrl, this.nb, id); }

  private async memoryNotes(): Promise<(Note & { memory: Memory })[]> {
    const notes = await this.c.listNotes(this.nb.host, this.nb.name);
    return notes.filter((n) => n.folderId === this.nb.memoriesFolderId)
      .map((n) => ({ ...n, memory: parseMemory(n.bodyMd)! })).filter((n) => n.memory);
  }
  private conversationNoteFor(sessionKey: string): number | undefined {
    const [client, ...rest] = sessionKey.split(':'); const sessionId = rest.join(':');
    return listSessionStates(this.paths).find((s) => s.client === client && s.sessionId === sessionId)?.noteIds[0];
  }

  /** Create a memory note; identical active text in the same project returns the existing note. */
  async save(i: SaveInput): Promise<{ id: number; url: string; created: boolean }> {
    const text = i.text.trim();
    if (!text) throw new Error('memory text is empty');
    const dup = (await this.memoryNotes()).find((n) => n.memory.status === 'active' && n.memory.project === i.project && n.memory.text === text);
    if (dup) return { id: dup.id, url: this.url(dup.id), created: false };
    const note = i.sessionKey ? this.conversationNoteFor(i.sessionKey) : undefined;
    const m: Memory = { type: i.type, status: 'active', agent: i.agent, project: i.project, created: new Date().toISOString(), text,
      ...(i.sessionKey ? { source: { session: i.sessionKey, ...(i.event ? { event: i.event } : {}), ...(note !== undefined ? { note, url: this.url(note) } : {}) } } : {}) };
    const title = text.split('\n')[0].slice(0, 120);
    const r = await this.c.createNote(this.nb.host, this.nb.name, this.nb.memoriesFolderId, title, renderMemory(m));
    return { id: r.id, url: this.url(r.id), created: true };
  }

  async update(id: number, patch: { text?: string; type?: MemoryType; status?: MemoryStatus }): Promise<{ revision: number }> {
    const n = await this.c.getNote(this.nb.host, this.nb.name, id);
    const m = parseMemory(n.bodyMd);
    if (!m) throw new Error(`note ${id} is not a memory`);
    const next: Memory = { ...m, ...(patch.text ? { text: patch.text.trim() } : {}), ...(patch.type ? { type: patch.type } : {}), ...(patch.status ? { status: patch.status } : {}) };
    const r = await this.c.updateNote(this.nb.host, this.nb.name, id, renderMemory(next), n.revision);
    if (patch.text) await this.c.renameNote(this.nb.host, this.nb.name, id, next.text.split('\n')[0].slice(0, 120));
    return { revision: r.kind === 'updated' ? r.revision : n.revision };
  }

  async search(q: { query: string; type?: MemoryType; project?: string; limit?: number; includeRetracted?: boolean }): Promise<MemoryHit[]> {
    const qt = tokens(q.query); const now = Date.now() / 1000;
    return (await this.memoryNotes())
      .filter((n) => (q.includeRetracted || n.memory.status === 'active') && (!q.type || n.memory.type === q.type) && (!q.project || n.memory.project === q.project))
      .map((n) => { const tt = tokens(n.memory.text + ' ' + n.memory.project); let overlap = 0; for (const t of qt) if (tt.has(t)) overlap++;
        const recency = 1 / (1 + Math.max(0, now - n.updatedAt) / 86_400 / 30);
        return { ...n.memory, id: n.id, url: this.url(n.id), updatedAt: n.updatedAt, score: overlap + 0.5 * recency }; })
      .filter((h) => qt.size === 0 || h.score > 0.5)
      .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
      .slice(0, Math.min(q.limit ?? 10, 25));
  }

  async listRecent(kind: 'memories' | 'conversations', limit = 10) {
    const notes = await this.c.listNotes(this.nb.host, this.nb.name);
    const folder = kind === 'memories' ? this.nb.memoriesFolderId : this.nb.conversationsFolderId;
    return notes.filter((n) => n.folderId === folder).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, Math.min(limit, 25))
      .map((n) => ({ id: n.id, title: n.title, url: this.url(n.id), updatedAt: n.updatedAt,
        ...(kind === 'memories' ? { memory: parseMemory(n.bodyMd) } : { sessionKey: parseFrontMatter(n.bodyMd).fields.session_key }) }));
  }

  async searchHistory(q: { query: string; client?: ClientId; limit?: number }): Promise<HistoryHit[]> {
    const hits = await this.c.searchText(this.nb.host, this.nb.name, q.query, 100);
    const out: HistoryHit[] = [];
    for (const n of hits) {
      if (n.folderId !== this.nb.conversationsFolderId) continue;
      const fm = parseFrontMatter(n.bodyMd).fields;
      if (q.client && fm.client !== q.client) continue;
      const i = n.bodyMd.toLowerCase().indexOf(q.query.toLowerCase());
      const snippet = i < 0 ? n.bodyMd.slice(0, 200) : n.bodyMd.slice(Math.max(0, i - 100), i + 100);
      out.push({ noteId: n.id, sessionKey: fm.session_key ?? '', client: fm.client ?? '', title: n.title, snippet: snippet.replace(/\s+/g, ' '), url: this.url(n.id), updatedAt: n.updatedAt });
    }
    return out.slice(0, Math.min(q.limit ?? 10, 25));
  }

  /** Bounded excerpt of a conversation note; `fromEvent` starts at that anchor. */
  async getConversation(q: { sessionKey?: string; noteId?: number; fromEvent?: string; maxChars?: number }): Promise<{ noteId: number; title: string; url: string; text: string; truncated: boolean }> {
    let id = q.noteId;
    if (id === undefined && q.sessionKey) {
      id = this.conversationNoteFor(q.sessionKey) ?? (await this.c.searchText(this.nb.host, this.nb.name, `session_key: ${q.sessionKey}`, 5))
        .filter((n) => n.folderId === this.nb.conversationsFolderId).sort((a, b) => a.id - b.id)[0]?.id;
    }
    if (id === undefined) throw new Error('conversation not found');
    const n = await this.c.getNote(this.nb.host, this.nb.name, id);
    const max = Math.min(q.maxChars ?? 8000, 20_000);
    let body = parseFrontMatter(n.bodyMd).body;
    if (q.fromEvent) { const at = body.indexOf(`## ${q.fromEvent} ·`); if (at >= 0) body = body.slice(at); }
    const truncated = body.length > max;
    return { noteId: n.id, title: n.title, url: this.url(n.id), text: truncated ? body.slice(0, max) + `\n…[truncated; ${body.length - max} more chars]` : body, truncated };
  }
}

export const projectOf = (cwd: string) => basename(cwd) || 'unknown';

// src/memory.ts
import { basename } from 'node:path';
import { Config } from './config';
import { ClientId } from './events';
import { findSessionNotes, noteUrl } from './notebook';
import { Note, NotesClient, NotesError } from './notes-client';
import { Paths } from './paths';
import { Memory, MemoryStatus, MemoryType, anchorInRange, parseFrontMatter, parseMemory, partOf, renderMemory } from './render';
import { listSessionStates, loadSessionState } from './state';
import { redact } from './redact';

export interface SaveInput { type: MemoryType; text: string; agent: ClientId; project: string; sessionKey?: string; event?: string }
export interface MemoryHit extends Memory { id: number; url: string; score: number; updatedAt: number }
export interface RecentRow { id: number; title: string; url: string; updatedAt: number; memory?: Memory; sessionKey?: string }
export interface HistoryHit { noteId: number; sessionKey: string; client: string; title: string; snippet: string; url: string; updatedAt: number }

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9~_-]+/).filter((t) => t.length >= 2));
const MAX_RESULTS = 25;
export const MEMORY_SCAN = 200;
const cap = (n: number | undefined, d: number) => Math.min(n ?? d, MAX_RESULTS);

/** One part of a conversation: its note id and the event anchors it holds. */
interface PartRef { id: number; first?: string; last?: string }

/*
 * Cost model: memory listing uses the ship's text search for the memory marker, which returns only matching
 * notes, so conversation bodies are never downloaded to rank memories. Recent conversations come from local
 * sync state; the ship is searched only when there is none.
 */
export class MemoryStore {
  private c: NotesClient;
  constructor(private paths: Paths, private cfg: Config) { this.c = new NotesClient({ shipUrl: cfg.shipUrl, apiKey: cfg.apiKey }); }
  private get nb() { return this.cfg.notebook!; }
  private url(id: number) { return noteUrl(this.cfg.shipUrl, this.nb, id); }

  /** Up to MEMORY_SCAN memory notes, found by text search so conversation bodies are not downloaded. */
  async memoryNotes(): Promise<(Note & { memory: Memory })[]> { return (await this.memoryScan()).notes; }
  /** memoryNotes, plus whether the search stopped at its horizon (older memories were not seen). */
  async memoryScan(): Promise<{ notes: (Note & { memory: Memory })[]; truncated: boolean }> {
    const r = await this.c.searchText(this.nb.host, this.nb.name, 'tlon-memory: memory/v1', MEMORY_SCAN);
    const notes = r.notes.filter((n) => n.folderId === this.nb.memoriesFolderId)
      .map((n) => ({ ...n, memory: parseMemory(n.bodyMd)! })).filter((n) => n.memory);
    return { notes, truncated: r.truncated };
  }

  /** The session's parts in order, from local sync state or, without it, from an exact session_key search. */
  private async partsFor(sessionKey: string): Promise<PartRef[]> {
    const [client, ...rest] = sessionKey.split(':'); const sessionId = rest.join(':');
    const st = client === 'claude-code' || client === 'codex' ? loadSessionState(this.paths, client, sessionId) : null;
    if (st && st.anchors?.length === st.noteIds.length && st.noteIds.every((id) => id != null))
      return st.noteIds.map((id, i) => ({ id, first: st.anchors![i][0], last: st.anchors![i][1] }));
    return (await findSessionNotes(this.c, this.nb, sessionKey)).map((n) => ({ id: n.id, first: n.first, last: n.last }));
  }

  /** The part holding `event`; an event past the synced range belongs to the last part (sessions only grow). */
  private async sourcePart(sessionKey: string, event?: string): Promise<number | undefined> {
    const parts = await this.partsFor(sessionKey);
    if (!parts.length) return undefined;
    if (!event) return parts[0].id;
    const hit = parts.find((p) => anchorInRange(event, p.first, p.last));
    if (hit) return hit.id;
    const last = parts[parts.length - 1];
    return last.last && Number(event.slice(1)) > Number(last.last.slice(1)) ? last.id : undefined;
  }

  /** Create a memory note; identical active text in the same project returns the existing note. */
  async save(i: SaveInput): Promise<{ id: number; url: string; created: boolean }> {
    const text = redact(i.text.trim(), [this.cfg.apiKey]);
    if (!text) throw new Error('memory text is empty');
    const dup = (await this.memoryNotes()).find((n) => n.memory.status === 'active' && n.memory.project === i.project && n.memory.text === text);
    if (dup) return { id: dup.id, url: this.url(dup.id), created: false };
    const note = i.sessionKey ? await this.sourcePart(i.sessionKey, i.event) : undefined;
    const m: Memory = { type: i.type, status: 'active', agent: i.agent, project: i.project, created: new Date().toISOString(), text,
      ...(i.sessionKey ? { source: { session: i.sessionKey, ...(i.event ? { event: i.event } : {}), ...(note !== undefined ? { note, url: this.url(note) } : {}) } } : {}) };
    const title = text.split('\n')[0].slice(0, 120);
    const r = await this.c.createNote(this.nb.host, this.nb.name, this.nb.memoriesFolderId, title, renderMemory(m));
    return { id: r.id, url: this.url(r.id), created: true };
  }

  async update(id: number, patch: { text?: string; type?: MemoryType; status?: MemoryStatus }): Promise<{ revision: number }> {
    if (patch.text === undefined && patch.type === undefined && patch.status === undefined) throw new Error('nothing to update: pass text, type or status');
    const text = patch.text === undefined ? undefined : redact(patch.text.trim(), [this.cfg.apiKey]);
    if (text === '') throw new Error('memory text is empty');
    const n = await this.c.getNote(this.nb.host, this.nb.name, id);
    const m = parseMemory(n.bodyMd);
    if (!m) throw new Error(`note ${id} is not a memory`);
    const next: Memory = { ...m, ...(text !== undefined ? { text } : {}), ...(patch.type ? { type: patch.type } : {}), ...(patch.status ? { status: patch.status } : {}) };
    const r = await this.c.updateNote(this.nb.host, this.nb.name, id, renderMemory(next), n.revision);
    if (r.kind === 'conflict') throw new NotesError('conflict', 'memory changed on the ship; re-read and retry');
    if (r.kind === 'updated' && text !== undefined) await this.c.renameNote(this.nb.host, this.nb.name, id, text.split('\n')[0].slice(0, 120));
    return { revision: r.kind === 'updated' ? r.revision : n.revision };
  }

  async search(q: { query: string; type?: MemoryType; project?: string; limit?: number; includeRetracted?: boolean }): Promise<MemoryHit[]> {
    const qt = tokens(q.query); const now = Date.now() / 1000;
    if (q.query.trim() && qt.size === 0) return []; // only one-letter words: nothing to match on
    return (await this.memoryNotes())
      .filter((n) => (q.includeRetracted || n.memory.status === 'active') && (!q.type || n.memory.type === q.type) && (!q.project || n.memory.project === q.project))
      .map((n) => { const tt = tokens(n.memory.text + ' ' + n.memory.project); let overlap = 0; for (const t of qt) if (tt.has(t)) overlap++;
        const recency = 1 / (1 + Math.max(0, now - n.updatedAt) / 86_400 / 30);
        return { ...n.memory, id: n.id, url: this.url(n.id), updatedAt: n.updatedAt, score: overlap + 0.5 * recency }; })
      .filter((h) => qt.size === 0 || h.score > 0.5)
      .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
      .slice(0, cap(q.limit, 10));
  }

  async listRecent(kind: 'memories' | 'conversations', limit = 10): Promise<RecentRow[]> {
    const n = cap(limit, 10);
    if (kind === 'memories') {
      return (await this.memoryNotes()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n)
        .map((m) => ({ id: m.id, title: m.title, url: this.url(m.id), updatedAt: m.updatedAt, memory: m.memory }));
    }
    const local = listSessionStates(this.paths).filter((s) => s.noteIds[0] != null);
    if (local.length) {
      return local.sort((a, b) => b.lastSynced.localeCompare(a.lastSynced)).slice(0, n)
        .map((s) => ({ id: s.noteIds[0], title: s.title, url: this.url(s.noteIds[0]), updatedAt: Math.floor(Date.parse(s.lastSynced) / 1000), sessionKey: `${s.client}:${s.sessionId}` }));
    }
    return (await this.c.searchText(this.nb.host, this.nb.name, 'tlon-memory: conversation/v1', n)).notes
      .filter((x) => x.folderId === this.nb.conversationsFolderId && partOf(parseFrontMatter(x.bodyMd).fields).part === 1)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((x) => ({ id: x.id, title: x.title, url: this.url(x.id), updatedAt: x.updatedAt, sessionKey: parseFrontMatter(x.bodyMd).fields.session_key }));
  }

  async searchHistory(q: { query: string; client?: ClientId; limit?: number }): Promise<HistoryHit[]> {
    const hits = (await this.c.searchText(this.nb.host, this.nb.name, q.query, cap(q.limit, 10))).notes;
    const out: HistoryHit[] = [];
    for (const n of hits) {
      if (n.folderId !== this.nb.conversationsFolderId) continue;
      const fm = parseFrontMatter(n.bodyMd).fields;
      if (q.client && fm.client !== q.client) continue;
      const i = n.bodyMd.toLowerCase().indexOf(q.query.toLowerCase());
      const snippet = i < 0 ? n.bodyMd.slice(0, 200) : n.bodyMd.slice(Math.max(0, i - 100), i + 100);
      out.push({ noteId: n.id, sessionKey: fm.session_key ?? '', client: fm.client ?? '', title: n.title, snippet: snippet.replace(/\s+/g, ' '), url: this.url(n.id), updatedAt: n.updatedAt });
    }
    return out;
  }

  /** Bounded excerpt of a conversation part: the one holding `fromEvent` (starting at it), else part 1. */
  async getConversation(q: { sessionKey?: string; noteId?: number; fromEvent?: string; maxChars?: number }): Promise<{ noteId: number; title: string; url: string; text: string; truncated: boolean }> {
    if (q.fromEvent !== undefined && !/^e\d+$/.test(q.fromEvent)) throw new Error(`unknown anchor ${q.fromEvent}`);
    let n: Note | undefined;
    let key = q.sessionKey;
    if (q.noteId !== undefined) {
      n = await this.c.getNote(this.nb.host, this.nb.name, q.noteId);
      const f = parseFrontMatter(n.bodyMd).fields;
      if (q.fromEvent && !anchorInRange(q.fromEvent, f.first, f.last) && f.session_key) { key = f.session_key; n = undefined; }
    }
    if (!n) {
      if (!key) throw new Error('conversation not found');
      const parts = await this.partsFor(key);
      if (!parts.length) throw new Error('conversation not found');
      const part = q.fromEvent ? parts.find((p) => anchorInRange(q.fromEvent!, p.first, p.last)) : parts[0];
      if (!part) throw new Error(`unknown anchor ${q.fromEvent}`);
      n = await this.c.getNote(this.nb.host, this.nb.name, part.id);
    }
    const { fields, body: full } = parseFrontMatter(n.bodyMd);
    const { part, parts } = partOf(fields);
    let body = full;
    if (q.fromEvent) {
      const at = new RegExp(`^## ${q.fromEvent} ·`, 'm').exec(body);
      if (!at) throw new Error(`unknown anchor ${q.fromEvent}`);
      body = body.slice(at.index);
    }
    const max = Math.min(q.maxChars ?? 8000, 20_000);
    const truncated = body.length > max;
    const text = `part ${part}/${parts}\n` + (truncated ? body.slice(0, max) + `\n…[truncated; ${body.length - max} more chars]` : body);
    return { noteId: n.id, title: n.title, url: this.url(n.id), text, truncated };
  }
}

export const projectOf = (cwd: string) => basename(cwd) || 'unknown';

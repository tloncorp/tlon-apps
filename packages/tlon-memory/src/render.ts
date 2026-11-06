// src/render.ts
import { basename } from 'node:path';
import { ClientId, Event, ParsedTranscript } from './events';

export const MAX_PART_BYTES = 180 * 1024; // notes >~200 KB are split; keep headroom

export const CLIENT_LABEL: Record<ClientId, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

export function sessionKey(t: Pick<ParsedTranscript, 'client' | 'sessionId'>) {
  return `${t.client}:${t.sessionId}`;
}

export function conversationTitle(t: ParsedTranscript): string {
  const d = new Date(t.started || Date.now());
  const stamp = d.toISOString().slice(0, 16).replace('T', ' ');
  return `${CLIENT_LABEL[t.client]} · ${basename(t.cwd) || 'unknown'} · ${stamp}`;
}

function fmtBytes(n: number) { return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`; }

function sizeNote(e: Event) {
  return e.truncated ? `${fmtBytes(e.truncated.shownBytes)} shown of ${fmtBytes(e.truncated.totalBytes)}` : fmtBytes(Buffer.byteLength(e.text));
}

/** A fence longer than any backtick run inside the text, so captured Markdown cannot close it early. */
function fence(text: string, lang = '') {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length));
  const f = '`'.repeat(Math.max(3, longest + 1));
  return `${f}${lang}\n${text}\n${f}\n`;
}

export function renderEvent(e: Event): string {
  const head = (label: string) => `## ${e.anchor} · ${label} · ${e.timestamp}\n`;
  switch (e.kind) {
    case 'tool_use': return head(`tool_use \`${e.tool}\` (${e.toolUseId ?? '-'})`) + `_${sizeNote(e)}_\n\n` + fence(e.text, 'json');
    case 'tool_result': return head(`tool_result (${e.toolUseId ?? '-'})`) + `_${sizeNote(e)}_\n\n` + fence(e.text);
    default: return head(e.kind) + (e.truncated ? `_${sizeNote(e)}_\n\n` : '') + `${e.text}\n`;
  }
}

function omittedLine(o: ParsedTranscript['omitted']) {
  return `thinking ${o.thinking}, sidechain ${o.sidechain}, attachments ${o.attachments}, system ${o.system}, other ${o.other}, redactions ${o.redactions}`;
}

/**
 * Part 1 carries the session totals; later parts carry identity and their anchor range only, so a growing
 * session rewrites part 1 and the last part but leaves the parts in between byte-identical.
 */
function frontMatter(t: ParsedTranscript, part: number, parts: number, first: string, last: string) {
  const id = ['---', 'tlon-memory: conversation/v1', `client: ${t.client}`, `session_id: ${t.sessionId}`, `session_key: ${sessionKey(t)}`];
  const range = [`part: ${part}/${parts}`, `first: ${first}`, `last: ${last}`];
  if (part > 1) return [...id, ...range, '---', ''].join('\n');
  const note = t.toolIo
    ? 'note: Tool inputs/outputs are truncated at 2 KB and messages at 64 KB; sizes are shown. Nothing is summarized.'
    : 'note: Tool inputs/outputs are not captured. Messages are truncated at 64 KB; sizes are shown. Nothing is summarized.';
  return [...id, `cwd: ${oneLine(t.cwd)}`, `started: ${t.started}`, `updated: ${t.updated}`, ...range,
    `captured: ${t.events.length} events`, `omitted: ${omittedLine(t.omitted)}`, note, '---', ''].join('\n');
}

export interface RenderedPart { title: string; body: string; part: number; parts: number; firstAnchor: string; lastAnchor: string }

/** Fixed allowance for front matter, so split points depend only on the events and never shift as counters grow. */
const FRONT_MATTER_ALLOWANCE = 1024;

/** Split events into parts whose rendered size stays under MAX_PART_BYTES. */
export function renderConversation(t: ParsedTranscript): RenderedPart[] {
  const title = conversationTitle(t);
  const rendered = t.events.map(renderEvent);
  const groups: number[][] = [[]];
  let size = FRONT_MATTER_ALLOWANCE;
  rendered.forEach((md, i) => {
    const b = Buffer.byteLength(md) + 1;
    if (size + b > MAX_PART_BYTES && groups[groups.length - 1].length > 0) { groups.push([]); size = FRONT_MATTER_ALLOWANCE; }
    groups[groups.length - 1].push(i); size += b;
  });
  const parts = groups.length;
  return groups.map((idx, gi) => {
    const part = gi + 1;
    const first = t.events[idx[0]]?.anchor ?? 'e0', last = t.events[idx[idx.length - 1]]?.anchor ?? 'e0';
    const body = frontMatter(t, part, parts, first, last) + idx.map((i) => rendered[i]).join('\n');
    return { title: part === 1 ? title : `${title} (part ${part})`, body, part, parts, firstAnchor: first, lastAnchor: last };
  });
}

/** Parsed `part: i/N` (1/1 when absent). */
export function partOf(fields: Record<string, string>): { part: number; parts: number } {
  const m = /^(\d+)\/(\d+)$/.exec(fields.part ?? '');
  return m ? { part: Number(m[1]), parts: Number(m[2]) } : { part: 1, parts: 1 };
}

/** Whether event anchor `e<n>` lies within [first, last]. */
export function anchorInRange(anchor: string, first?: string, last?: string): boolean {
  const n = (a?: string) => (a && /^e\d+$/.test(a) ? Number(a.slice(1)) : NaN);
  const a = n(anchor), f = n(first), l = n(last);
  return a >= f && a <= l;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ');

// ---------- front matter ----------
export function parseFrontMatter(md: string): { fields: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  if (!m) return { fields: {}, body: md };
  const fields: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fields, body: md.slice(m[0].length) };
}

// ---------- memories ----------
export type MemoryType = 'decision' | 'preference' | 'context' | 'next-step';
export type MemoryStatus = 'active' | 'retracted';
export interface MemorySource { session?: string; event?: string; note?: number; url?: string }
export interface Memory {
  type: MemoryType; status: MemoryStatus; agent: ClientId | 'unknown'; project: string;
  created: string; source?: MemorySource; text: string;
}
export const MEMORY_TYPES: MemoryType[] = ['decision', 'preference', 'context', 'next-step'];

export function renderMemory(m: Memory): string {
  const lines = ['---', 'tlon-memory: memory/v1', `type: ${m.type}`, `status: ${m.status}`,
    `agent: ${m.agent}`, `project: ${oneLine(m.project)}`, `created: ${oneLine(m.created)}`];
  if (m.source) {
    if (m.source.session) lines.push(`source_session: ${oneLine(m.source.session)}`);
    if (m.source.event) lines.push(`source_event: ${oneLine(m.source.event)}`);
    if (m.source.note !== undefined) lines.push(`source_note: ${m.source.note}`);
    if (m.source.url) lines.push(`source_url: ${oneLine(m.source.url)}`);
  }
  lines.push('---', '', m.text.trim(), '');
  return lines.join('\n');
}

export function parseMemory(md: string): Memory | null {
  const { fields: f, body } = parseFrontMatter(md);
  if (f['tlon-memory'] !== 'memory/v1') return null;
  const source: MemorySource = {};
  if (f.source_session) source.session = f.source_session;
  if (f.source_event) source.event = f.source_event;
  if (/^\d+$/.test(f.source_note ?? '')) source.note = Number(f.source_note);
  if (f.source_url) source.url = f.source_url;
  return {
    type: (MEMORY_TYPES.includes(f.type as MemoryType) ? f.type : 'context') as MemoryType,
    status: f.status === 'retracted' ? 'retracted' : 'active',
    agent: (f.agent === 'claude-code' || f.agent === 'codex') ? f.agent : 'unknown',
    project: f.project ?? '', created: f.created ?? '',
    ...(Object.keys(source).length ? { source } : {}),
    text: body.trim(),
  };
}

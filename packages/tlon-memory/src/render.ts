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

export function renderEvent(e: Event): string {
  const head = (label: string) => `## ${e.anchor} · ${label} · ${e.timestamp}\n`;
  switch (e.kind) {
    case 'tool_use': {
      const size = e.truncated ? `${fmtBytes(e.truncated.shownBytes)} shown of ${fmtBytes(e.truncated.totalBytes)}` : fmtBytes(Buffer.byteLength(e.text));
      return head(`tool_use \`${e.tool}\` (${e.toolUseId ?? '-'})`) + `_${size}_\n\n\`\`\`json\n${e.text}\n\`\`\`\n`;
    }
    case 'tool_result': {
      const size = e.truncated ? `${fmtBytes(e.truncated.shownBytes)} shown of ${fmtBytes(e.truncated.totalBytes)}` : fmtBytes(Buffer.byteLength(e.text));
      return head(`tool_result (${e.toolUseId ?? '-'})`) + `_${size}_\n\n\`\`\`\n${e.text}\n\`\`\`\n`;
    }
    default:
      return head(e.kind) + `${e.text}\n`;
  }
}

function omittedLine(o: ParsedTranscript['omitted']) {
  return `thinking ${o.thinking}, sidechain ${o.sidechain}, attachments ${o.attachments}, system ${o.system}, other ${o.other}, redactions ${o.redactions}`;
}

function frontMatter(t: ParsedTranscript, part: number, parts: number) {
  return [
    '---',
    'tlon-memory: conversation/v1',
    `client: ${t.client}`,
    `session_id: ${t.sessionId}`,
    `session_key: ${sessionKey(t)}`,
    `cwd: ${t.cwd}`,
    `started: ${t.started}`,
    `updated: ${t.updated}`,
    `part: ${part}/${parts}`,
    `captured: ${t.events.length} events`,
    `omitted: ${omittedLine(t.omitted)}`,
    'note: Tool inputs/outputs are truncated at 2 KB; sizes are shown. Nothing is summarized.',
    '---',
    '',
  ].join('\n');
}

export interface RenderedPart { title: string; body: string; part: number; parts: number; firstAnchor: string; lastAnchor: string }

/** Split events into parts whose rendered size stays under MAX_PART_BYTES. */
export function renderConversation(t: ParsedTranscript): RenderedPart[] {
  const title = conversationTitle(t);
  const rendered = t.events.map(renderEvent);
  const fmSize = Buffer.byteLength(frontMatter(t, 1, 1)) + 64;
  const groups: number[][] = [[]];
  let size = fmSize;
  rendered.forEach((md, i) => {
    const b = Buffer.byteLength(md) + 1;
    if (size + b > MAX_PART_BYTES && groups[groups.length - 1].length > 0) { groups.push([]); size = fmSize; }
    groups[groups.length - 1].push(i); size += b;
  });
  const parts = groups.length;
  return groups.map((idx, gi) => {
    const part = gi + 1;
    const body = frontMatter(t, part, parts) + idx.map((i) => rendered[i]).join('\n');
    const first = t.events[idx[0]]?.anchor ?? 'e0', last = t.events[idx[idx.length - 1]]?.anchor ?? 'e0';
    return { title: part === 1 ? title : `${title} (part ${part})`, body, part, parts, firstAnchor: first, lastAnchor: last };
  });
}

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
    `agent: ${m.agent}`, `project: ${m.project}`, `created: ${m.created}`];
  if (m.source) {
    if (m.source.session) lines.push(`source_session: ${m.source.session}`);
    if (m.source.event) lines.push(`source_event: ${m.source.event}`);
    if (m.source.note !== undefined) lines.push(`source_note: ${m.source.note}`);
    if (m.source.url) lines.push(`source_url: ${m.source.url}`);
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
  if (f.source_note) source.note = Number(f.source_note);
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

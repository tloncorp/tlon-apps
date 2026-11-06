// src/transcript/claude.ts
import { readFileSync } from 'node:fs';
import { Event, ParsedTranscript, TEXT_LIMIT, clip, emptyOmissions } from '../events';
import { redact } from '../redact';

type Block = { type: string; text?: string; name?: string; id?: string; input?: unknown;
  tool_use_id?: string; content?: string | Block[]; source?: { media_type?: string } };
type Rec = { type?: string; uuid?: string; isSidechain?: boolean; isMeta?: boolean; isCompactSummary?: boolean;
  sessionId?: string; cwd?: string; timestamp?: string; message?: { role?: string; content?: string | Block[] } };

export interface ParseOptions { toolIo?: boolean; known?: string[] }

export function parseClaudeTranscript(path: string, opts: ParseOptions = {}): ParsedTranscript {
  const toolIo = opts.toolIo ?? true;
  const omitted = emptyOmissions();
  const events: Event[] = [];
  let sessionId = '', cwd = '', started = '', updated = '';
  const r = (s: string) => { const o = redact(s, opts.known); if (o !== s) omitted.redactions++; return o; };
  const push = (e: Omit<Event, 'anchor'>) => events.push({ anchor: `e${events.length + 1}`, ...e });

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let rec: Rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!rec || typeof rec !== 'object') { omitted.other++; continue; }
    if (rec.type === 'system') { omitted.system++; continue; }
    if (rec.type !== 'user' && rec.type !== 'assistant') { omitted.other++; continue; }
    if (rec.isSidechain) { omitted.sidechain++; continue; }
    // Injected context (skill bodies, command output) and the compaction summary are not things anyone said.
    if (rec.isMeta === true || rec.isCompactSummary === true) { omitted.system++; continue; }
    const ts = rec.timestamp || updated || new Date(0).toISOString();
    sessionId ||= rec.sessionId ?? '';
    // A session can move (a scratch workspace to the repo); the hook reports the live cwd, so the last one wins.
    cwd = rec.cwd || cwd;
    started ||= ts; updated = ts;
    const role = rec.type;
    const content = rec.message?.content;
    const blocks: Block[] = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : [];
    for (const b of blocks) {
      switch (b?.type) {
        case 'text': {
          const text = r(typeof b.text === 'string' ? b.text : '');
          if (!text.trim()) break;
          const kind = /^\[Request interrupted by user/.test(text) ? 'interruption' : role;
          push({ sourceId: rec.uuid ?? '', kind, timestamp: ts, ...clip(text, TEXT_LIMIT) });
          break;
        }
        case 'thinking': case 'redacted_thinking': omitted.thinking++; break;
        case 'image': case 'document': {
          omitted.attachments++;
          push({ sourceId: rec.uuid ?? '', kind: 'attachment', timestamp: ts,
                 text: `[attachment omitted: ${b.source?.media_type ?? b.type}]` });
          break;
        }
        case 'tool_use': {
          if (!toolIo) { omitted.other++; break; }
          const c = clip(r(JSON.stringify(b.input ?? {})));
          push({ sourceId: rec.uuid ?? '', kind: 'tool_use', timestamp: ts, tool: b.name, toolUseId: b.id, ...c });
          break;
        }
        case 'tool_result': {
          if (!toolIo) { omitted.other++; break; }
          const raw = typeof b.content === 'string' ? b.content
            : (Array.isArray(b.content) ? b.content : []).map((x) => x?.type === 'text' ? (x.text ?? '') : `[${x?.type}]`).join('\n');
          const c = clip(r(raw));
          push({ sourceId: rec.uuid ?? '', kind: 'tool_result', timestamp: ts, toolUseId: b.tool_use_id, ...c });
          break;
        }
        default: omitted.other++;
      }
    }
  }
  return { client: 'claude-code', sessionId, cwd, started, updated, events, omitted, toolIo };
}

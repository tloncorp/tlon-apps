// src/transcript/codex.ts
import { readFileSync } from 'node:fs';
import { Event, ParsedTranscript, TEXT_LIMIT, clip, emptyOmissions } from '../events';
import { redact } from '../redact';
import { ParseOptions } from './claude';

type Rec = { timestamp?: string; ordinal?: number; type?: string; payload?: any };
const INJECTED = /^\s*<(environment_context|user_instructions|turn_aborted|permissions_instructions|collaboration_mode)/;

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c: any) => typeof c?.text === 'string' ? c.text : '').filter(Boolean).join('\n');
}
const imagesIn = (content: unknown) => Array.isArray(content) ? content.filter((c: any) => c?.type === 'input_image').length : 0;

export function parseCodexTranscript(path: string, opts: ParseOptions = {}): ParsedTranscript {
  const toolIo = opts.toolIo ?? true;
  const omitted = emptyOmissions();
  const events: Event[] = [];
  let sessionId = '', cwd = '', started = '', updated = '', lastTs = new Date(0).toISOString();
  const r = (s: string) => { const o = redact(s, opts.known); if (o !== s) omitted.redactions++; return o; };
  const push = (e: Omit<Event, 'anchor'>) => { events.push({ anchor: `e${events.length + 1}`, ...e }); };
  const mark = (ts: string) => { started ||= ts; updated = ts; };

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let rec: Rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!rec || typeof rec !== 'object') { omitted.other++; continue; }
    const ts = rec.timestamp || lastTs;
    lastTs = ts;
    const p = rec.payload ?? {};
    const src = `ordinal:${rec.ordinal ?? -1}`;
    if (rec.type === 'session_meta') { sessionId = String(p.session_id ?? ''); cwd = String(p.cwd ?? ''); continue; }
    if (rec.type === 'event_msg') {
      if (p.type === 'turn_aborted') { mark(ts); push({ sourceId: src, kind: 'interruption', timestamp: ts, text: `[turn aborted: ${p.reason ?? 'unknown'}]` }); }
      else omitted.other++;
      continue;
    }
    if (rec.type !== 'response_item') { omitted.other++; continue; }
    switch (p.type) {
      case 'message': {
        const text = r(textOf(p.content));
        if (p.role === 'developer' || p.role === 'system' || INJECTED.test(text)) { omitted.system++; break; }
        if (p.role !== 'user' && p.role !== 'assistant') { omitted.other++; break; }
        for (let i = imagesIn(p.content); i > 0; i--) {
          omitted.attachments++; mark(ts);
          push({ sourceId: src, kind: 'attachment', timestamp: ts, text: '[attachment omitted: image]' });
        }
        if (!text.trim()) break;
        mark(ts); push({ sourceId: src, kind: p.role, timestamp: ts, ...clip(text, TEXT_LIMIT) });
        break;
      }
      case 'reasoning': omitted.thinking++; break;
      case 'function_call': case 'custom_tool_call': {
        if (!toolIo) { omitted.other++; break; }
        const name = p.namespace ? `${p.namespace}.${p.name}` : String(p.name ?? 'tool');
        const raw = p.type === 'function_call' ? String(p.arguments ?? '') : String(p.input ?? '');
        mark(ts); push({ sourceId: src, kind: 'tool_use', timestamp: ts, tool: name, toolUseId: p.call_id, ...clip(r(raw)) });
        break;
      }
      case 'function_call_output': case 'custom_tool_call_output': {
        if (!toolIo) { omitted.other++; break; }
        mark(ts); push({ sourceId: src, kind: 'tool_result', timestamp: ts, toolUseId: p.call_id, ...clip(r(textOf(p.output))) });
        break;
      }
      default: omitted.other++;
    }
  }
  return { client: 'codex', sessionId, cwd, started, updated, events, omitted, toolIo };
}

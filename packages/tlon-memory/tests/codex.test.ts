// tests/codex.test.ts
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { parseCodexTranscript } from '../src/transcript/codex';

const fx = join(import.meta.dir, 'fixtures', 'codex-rollout.jsonl');

describe('codex parser', () => {
  const t = parseCodexTranscript(fx);
  it('identifies the session from session_meta', () => {
    expect(t.client).toBe('codex');
    expect(t.sessionId).toBe('01a1b2c3-d4e5-7f00-8000-000000000001');
    expect(t.cwd).toBe('/Users/bill/Projects/demo');
    expect(t.started).toBe('2026-11-05T15:00:01.000Z');
    expect(t.updated).toBe('2026-11-05T15:00:06.000Z');
  });
  it('captures messages, tool calls/outputs, and the abort marker in order', () => {
    expect(t.events.map((e) => e.kind)).toEqual([
      'user', 'tool_use', 'tool_result', 'tool_use', 'tool_result', 'assistant', 'interruption',
    ]);
    expect(t.events[1]).toMatchObject({ tool: 'mcp__tlon-memory.tlon_search_memory', toolUseId: 'c1', text: '{"query":"queue"}' });
    expect(t.events[2]).toMatchObject({ toolUseId: 'c1', text: '1 memory: use SQLite' });
    expect(t.events[3]).toMatchObject({ tool: 'shell', toolUseId: 'c2', text: 'ls' });
    expect(t.events[6].text).toBe('[turn aborted: interrupted]');
    expect(t.events[0].sourceId).toBe('ordinal:4');
  });
  it('omits developer/env injections, reasoning, bookkeeping; redacts', () => {
    expect(t.omitted).toEqual({ thinking: 1, sidechain: 0, attachments: 0, system: 2, other: 3, redactions: 1 });
    const all = JSON.stringify(t);
    expect(all).not.toContain('SECRET BASE');
    expect(all).not.toContain('developer injection');
    expect(all).not.toContain('environment_context');
    expect(all).not.toContain('gAAAA');
    expect(all).not.toContain('ghp_');
  });
});

describe('codex parser extras', () => {
  const { mkdtempSync, writeFileSync } = require('node:fs') as typeof import('node:fs');
  const { tmpdir } = require('node:os') as typeof import('node:os');
  it('marks input_image items, reuses the previous timestamp, counts skipped tool calls', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'tm-cx-')), 'r.jsonl');
    writeFileSync(f, [
      { timestamp: '2026-01-01T00:00:00Z', ordinal: 0, type: 'session_meta', payload: { session_id: 's', cwd: '/x' } },
      { ordinal: 1, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: 'data:AAAA' }, { type: 'input_text', text: 'look' }] } },
      { timestamp: '2026-01-01T00:00:05Z', ordinal: 2, type: 'response_item', payload: { type: 'function_call', name: 'shell', arguments: '{}', call_id: 'c' } },
    ].map((l) => JSON.stringify(l)).join('\n'));
    const t = parseCodexTranscript(f, { toolIo: false });
    expect(t.events.map((e) => [e.kind, e.text, e.timestamp])).toEqual([
      ['attachment', '[attachment omitted: image]', '2026-01-01T00:00:00Z'],
      ['user', 'look', '2026-01-01T00:00:00Z'],
    ]);
    expect(t.omitted.attachments).toBe(1);
    expect(t.omitted.other).toBe(1);
    expect(JSON.stringify(t)).not.toContain('data:AAAA');
  });
});

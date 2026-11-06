// tests/render.test.ts
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { parseClaudeTranscript } from '../src/transcript/claude';
import { renderConversation, parseFrontMatter, renderMemory, parseMemory, conversationTitle, MAX_PART_BYTES } from '../src/render';

const t = parseClaudeTranscript(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'));

describe('renderConversation', () => {
  const parts = renderConversation(t);
  it('is one part with front matter and anchored sections', () => {
    expect(parts.length).toBe(1);
    const md = parts[0].body;
    expect(md.startsWith('---\ntlon-memory: conversation/v1\n')).toBe(true);
    expect(md).toContain('client: claude-code');
    expect(md).toContain('session_id: 11111111-aaaa-4bbb-8ccc-222222222222');
    expect(md).toContain('session_key: claude-code:11111111-aaaa-4bbb-8ccc-222222222222');
    expect(md).toContain('captured: 8 events');
    expect(md).toContain('omitted: thinking 1, sidechain 2, attachments 1, system 1, other 4, redactions 1');
    expect(md).toContain('\n## e1 · user · 2026-11-05T14:02:11.000Z\n');
    expect(md).toContain('\n## e3 · tool_use `Bash` (toolu_01) · 2026-11-05T14:02:30.000Z\n');
    expect(md).toContain('```json\n{"command":"ls"}\n```');
    expect(md).toContain('\n## e7 · interruption · ');
  });
  it('titles parts by client, project and start time', () => {
    expect(conversationTitle(t)).toBe('Claude Code · demo · 2026-11-05 14:02');
    expect(parts[0].title).toBe('Claude Code · demo · 2026-11-05 14:02');
  });
  it('splits long transcripts into parts under the limit', () => {
    const big = { ...t, events: Array.from({ length: 400 }, (_, i) => ({
      ...t.events[0], anchor: `e${i + 1}`, text: 'x'.repeat(1000) })) };
    const ps = renderConversation(big);
    expect(ps.length).toBeGreaterThan(1);
    for (const p of ps) expect(Buffer.byteLength(p.body)).toBeLessThanOrEqual(MAX_PART_BYTES);
    expect(ps[1].title).toBe('Claude Code · demo · 2026-11-05 14:02 (part 2)');
    expect(ps[1].body).toContain(`part: 2/${ps.length}`);
    expect(ps[1].body).toContain('## e');
  });
  it('front matter parses back', () => {
    const fm = parseFrontMatter(parts[0].body);
    expect(fm.fields['tlon-memory']).toBe('conversation/v1');
    expect(fm.fields.session_key).toBe('claude-code:11111111-aaaa-4bbb-8ccc-222222222222');
    expect(fm.body).toContain('## e1');
  });
});

describe('memory notes', () => {
  const m = {
    type: 'decision' as const, status: 'active' as const, agent: 'claude-code' as const,
    project: 'demo', created: '2026-11-05T14:31:00Z',
    source: { session: 'claude-code:1111', event: 'e2', note: 42, url: 'https://zod.tlon.network/notes/nb/~zod/agent-memory/n/42' },
    text: 'Use SQLite for the local queue.',
  };
  it('renders and parses symmetrically', () => {
    const md = renderMemory(m);
    expect(md).toContain('tlon-memory: memory/v1');
    expect(md.trim().endsWith('Use SQLite for the local queue.')).toBe(true);
    expect(parseMemory(md)).toEqual(m);
  });
  it('parses a memory without a source', () => {
    const md = renderMemory({ ...m, source: undefined });
    expect(parseMemory(md)?.source).toBeUndefined();
  });
  it('returns null for non-memory notes', () => {
    expect(parseMemory('# hello')).toBeNull();
  });
});

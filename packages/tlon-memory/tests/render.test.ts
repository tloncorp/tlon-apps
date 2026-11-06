// tests/render.test.ts
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { parseClaudeTranscript } from '../src/transcript/claude';
import { renderConversation, renderEvent, parseFrontMatter, renderMemory, parseMemory, conversationTitle, MAX_PART_BYTES } from '../src/render';
import { clip, TEXT_LIMIT } from '../src/events';

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
    expect(md).toContain('omitted: thinking 1, sidechain 2, attachments 1, system 3, other 4, redactions 1');
    expect(md).toContain('\n## e1 · user · 2026-11-05T14:02:11.000Z\n');
    expect(md).toContain('\n## e3 · tool_use `Bash` (toolu_01) · 2026-11-05T14:02:30.000Z\n');
    expect(md).toContain('```json\n{"command":"ls"}\n```');
    expect(md).toContain('\n## e7 · interruption · ');
    expect(md).toContain('\npart: 1/1\nfirst: e1\nlast: e8\n');
    expect(md).toContain('truncated at 2 KB');
  });
  it('omits the tool I/O truncation note when tool I/O is off', () => {
    expect(renderConversation({ ...t, toolIo: false })[0].body).not.toContain('truncated at 2 KB');
  });
  it('fences tool output with a backtick run longer than any inside it', () => {
    const md = renderEvent({ anchor: 'e1', sourceId: 'x', kind: 'tool_result', timestamp: 't', text: 'a\n```\nb ```` c' });
    expect(md).toContain('\n`````\na\n```\nb ```` c\n`````\n');
  });
  it('shows sizes for clipped text events', () => {
    const md = renderEvent({ anchor: 'e1', sourceId: 'x', kind: 'user', timestamp: 't', ...clip('z'.repeat(70 * 1024), TEXT_LIMIT) });
    expect(md).toContain('_64.0 KB shown of 70.0 KB_');
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
    expect(parseFrontMatter(ps[1].body).fields).toEqual({ 'tlon-memory': 'conversation/v1', client: 'claude-code',
      session_id: t.sessionId, session_key: `claude-code:${t.sessionId}`, part: `2/${ps.length}`,
      first: ps[1].firstAnchor, last: ps[1].lastAnchor });
  });
  it('a single 300 KB message renders into parts within the limit', () => {
    const one = { ...t, events: [{ ...t.events[0], anchor: 'e1', ...clip('q'.repeat(300 * 1024), TEXT_LIMIT) }, { ...t.events[1], anchor: 'e2' }] };
    for (const p of renderConversation(one)) expect(Buffer.byteLength(p.body)).toBeLessThanOrEqual(MAX_PART_BYTES);
  });
  it('appending events leaves earlier part bodies and split points unchanged', () => {
    const mk = (n: number) => ({ ...t, events: Array.from({ length: n }, (_, i) => ({ ...t.events[0], anchor: `e${i + 1}`, text: 'x'.repeat(1000) })) });
    const a = renderConversation(mk(400)), b = renderConversation(mk(401));
    expect(b.length).toBe(a.length);
    const events = (md: string) => md.slice(md.indexOf('\n## e'));
    expect(events(b[0].body)).toBe(events(a[0].body));
    for (let i = 1; i < a.length - 1; i++) expect(b[i].body).toBe(a[i].body);
    expect(b[b.length - 1].body).not.toBe(a[a.length - 1].body);
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
  it('keeps single-line fields on one line and ignores a non-numeric source_note', () => {
    const md = renderMemory({ ...m, project: 'a\ninjected: yes', source: { ...m.source, session: 'k\r\nx' } });
    expect(md).toContain('project: a injected: yes\n');
    expect(parseMemory(md)?.project).toBe('a injected: yes');
    expect(parseMemory(md.replace('source_note: 42', 'source_note: abc'))?.source?.note).toBeUndefined();
  });
  it('returns null for non-memory notes', () => {
    expect(parseMemory('# hello')).toBeNull();
  });
});

// tests/claude.test.ts
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { parseClaudeTranscript } from '../src/transcript/claude';

const fx = join(import.meta.dir, 'fixtures', 'claude-session.jsonl');

describe('claude parser', () => {
  const t = parseClaudeTranscript(fx);
  it('identifies the session', () => {
    expect(t.client).toBe('claude-code');
    expect(t.sessionId).toBe('11111111-aaaa-4bbb-8ccc-222222222222');
    expect(t.cwd).toBe('/Users/bill/Projects/demo');
    expect(t.started).toBe('2026-11-05T14:02:11.000Z');
    expect(t.updated).toBe('2026-11-05T14:03:10.000Z');
  });
  it('keeps user/assistant text, tool_use, tool_result, attachment marker, interruption — in order', () => {
    expect(t.events.map((e) => e.kind)).toEqual([
      'user', 'assistant', 'tool_use', 'tool_result', 'attachment', 'user', 'interruption', 'assistant',
    ]);
    expect(t.events[0].text).toContain('SQLite');
    expect(t.events[2]).toMatchObject({ kind: 'tool_use', tool: 'Bash', toolUseId: 'toolu_01' });
    expect(t.events[3]).toMatchObject({ kind: 'tool_result', toolUseId: 'toolu_01', text: 'README.md\nsrc\n' });
    expect(t.events[4].text).toBe('[attachment omitted: image/png]');
    expect(t.events[6].text).toBe('[Request interrupted by user]');
  });
  it('assigns anchors and source ids', () => {
    expect(t.events.map((e) => e.anchor)).toEqual(['e1','e2','e3','e4','e5','e6','e7','e8']);
    expect(t.events[0].sourceId).toBe('u1');
  });
  it('counts omissions and never captures system prompts, blobs, sidechains, thinking', () => {
    expect(t.omitted).toEqual({ thinking: 1, sidechain: 2, attachments: 1, system: 1, other: 4, redactions: 1 });
    const all = JSON.stringify(t);
    expect(all).not.toContain('SECRET SYSTEM PROMPT');
    expect(all).not.toContain('blob must not');
    expect(all).not.toContain('subagent');
    expect(all).not.toContain('private reasoning');
  });
  it('redacts secrets in text', () => {
    expect(t.events[0].text).toContain('[redacted:urbit-code]');
    expect(t.events[0].text).not.toContain('lidlut');
  });
});

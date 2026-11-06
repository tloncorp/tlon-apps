// tests/transcripts.test.ts
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UsageError } from '../src/cli-util';
import { CLAUDE_ID, CODEX_ID, fakeHome } from './transcript-home';
import { detectClient, findTranscript, listTranscripts, peekTranscript } from '../src/transcripts';

describe('transcripts', () => {
  const { home, claude, codex } = fakeHome();
  it('detects the client from the first record', () => {
    expect(detectClient(claude)).toBe('claude');
    expect(detectClient(codex)).toBe('codex');
    const other = join(home, 'other.jsonl'); writeFileSync(other, '\n{"hello":1}\n');
    expect(() => detectClient(other)).toThrow(UsageError);
    expect(() => detectClient(other)).toThrow(other);
  });
  it('finds a transcript by session key', () => {
    expect(findTranscript(`claude-code:${CLAUDE_ID}`, home)).toBe(claude);
    expect(findTranscript(`codex:${CODEX_ID}`, home)).toBe(codex);
    expect(findTranscript('claude-code:nope', home)).toBeNull();
    expect(findTranscript('codex:nope', home)).toBeNull();
  });
  it('lists top-level Claude transcripts and Codex rollouts, not subagents', () => {
    expect(listTranscripts(home).sort((a, b) => a.path.localeCompare(b.path))).toEqual([{ client: 'claude', path: claude }, { client: 'codex', path: codex }]);
    expect(listTranscripts(mkdtempSync(join(tmpdir(), 'tm-empty-')))).toEqual([]);
  });
  it('peeks the ids without parsing the whole file', () => {
    expect(peekTranscript('claude', claude)).toEqual({ sessionId: CLAUDE_ID, cwd: '/Users/bill/Projects/demo' });
    expect(peekTranscript('codex', codex)).toEqual({ sessionId: CODEX_ID, cwd: '/Users/bill/Projects/demo' });
    const late = join(home, 'late.jsonl');
    writeFileSync(late, `${JSON.stringify({ type: 'x', pad: 'y'.repeat(70 * 1024) })}\n${JSON.stringify({ type: 'user', sessionId: 's', cwd: '/c' })}\n`);
    expect(peekTranscript('claude', late)).toBeNull();
  });
});

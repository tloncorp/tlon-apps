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
    const summaryFirst = join(home, 'summary-first.jsonl');
    writeFileSync(summaryFirst, [{ type: 'summary', summary: 'x' }, { type: 'file-history-snapshot', snapshot: {} }, { type: 'user', sessionId: 's', cwd: '/c' }].map((r) => JSON.stringify(r)).join('\n'));
    expect(detectClient(summaryFirst)).toBe('claude');
    const metaLater = join(home, 'meta-later.jsonl');
    writeFileSync(metaLater, [{ type: 'event_msg', payload: {} }, { type: 'session_meta', payload: { session_id: 'c', cwd: '/c' } }].map((r) => JSON.stringify(r)).join('\n'));
    expect(detectClient(metaLater)).toBe('codex');
    const other = join(home, 'other.jsonl'); writeFileSync(other, '\n{"hello":1}\n');
    expect(() => detectClient(other)).toThrow(UsageError);
    expect(() => detectClient(other)).toThrow(other);
  });
  it('finds a transcript by session key', () => {
    expect(findTranscript(`claude-code:${CLAUDE_ID}`, home)).toBe(claude);
    expect(findTranscript(`codex:${CODEX_ID}`, home)).toBe(codex);
    expect(findTranscript('claude-code:nope', home)).toBeNull();
    expect(findTranscript('codex:nope', home)).toBeNull();
    expect(findTranscript(`codex:${CODEX_ID.split('-').pop()}`, home)).toBeNull(); // a tail of the id is another session's
  });
  it('lists top-level Claude transcripts and Codex rollouts, not subagents', () => {
    expect(listTranscripts(home).sort((a, b) => a.path.localeCompare(b.path))).toEqual([{ client: 'claude', path: claude }, { client: 'codex', path: codex }]);
    expect(listTranscripts(mkdtempSync(join(tmpdir(), 'tm-empty-')))).toEqual([]);
  });
  it('peeks the ids without parsing the whole file', () => {
    expect(peekTranscript('claude', claude)).toEqual({ sessionId: CLAUDE_ID, cwd: '/Users/bill/Projects/demo' });
    expect(peekTranscript('codex', codex)).toEqual({ sessionId: CODEX_ID, cwd: '/Users/bill/Projects/demo' });
    // Real transcripts open with an api-request record (system prompt, tool definitions) well over 64 KB.
    const big = join(home, 'big.jsonl');
    writeFileSync(big, [{ type: 'queue-operation', sessionId: 's' }, { type: 'api-request', sessionId: 's', params: { system: 'y'.repeat(300 * 1024) } },
      { type: 'user', sessionId: 's', cwd: '/c' }].map((r) => JSON.stringify(r)).join('\n') + '\n');
    expect(peekTranscript('claude', big)).toEqual({ sessionId: 's', cwd: '/c' });
    const late = join(home, 'late.jsonl');
    writeFileSync(late, Array.from({ length: 60 }, () => JSON.stringify({ type: 'x', sessionId: 's' })).concat(JSON.stringify({ type: 'user', sessionId: 's', cwd: '/c' })).join('\n'));
    expect(peekTranscript('claude', late)).toBeNull();
  });
});

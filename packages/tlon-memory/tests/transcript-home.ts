// tests/transcript-home.ts
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeProjectsDir, codexSessionsDir } from '../src/transcripts';

export const CLAUDE_ID = '11111111-aaaa-4bbb-8ccc-222222222222';
export const CODEX_ID = '01a1b2c3-d4e5-7f00-8000-000000000001';
const fixture = (f: string) => join(import.meta.dir, 'fixtures', f);

/** A HOME holding both fixtures where the clients keep them, plus a subagent transcript Claude stores deeper. */
export function fakeHome(): { home: string; claude: string; codex: string } {
  const home = mkdtempSync(join(tmpdir(), 'tm-home-'));
  const project = join(claudeProjectsDir(home), '-Users-bill-Projects-demo');
  mkdirSync(join(project, CLAUDE_ID, 'subagents'), { recursive: true });
  const claude = join(project, `${CLAUDE_ID}.jsonl`); copyFileSync(fixture('claude-session.jsonl'), claude);
  copyFileSync(fixture('claude-session.jsonl'), join(project, CLAUDE_ID, 'subagents', 'agent-x.jsonl'));
  const day = join(codexSessionsDir(home), '2026', '11', '05'); mkdirSync(day, { recursive: true });
  const codex = join(day, `rollout-2026-11-05T15-00-00-${CODEX_ID}.jsonl`); copyFileSync(fixture('codex-rollout.jsonl'), codex);
  return { home, claude, codex };
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  MAX_INLINE_DIFF_BYTES,
  assessmentDiffContext,
  readInlineDiff,
} from './assessment-context.mjs';

const baseSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);

test('small PRs keep their full diff', () => {
  const diff = 'diff --git a/file b/file\n+change';
  assert.equal(
    assessmentDiffContext({
      diff,
      diffBytes: diff.length,
      stat: 'file | 1 +',
      baseSha,
      headSha,
    }),
    diff
  );
});

test('large PRs get a bounded inventory and an exact source inspection command', () => {
  const stat = 'packages/app/ChannelScreen.tsx | 100 +\n145 files changed';
  const context = assessmentDiffContext({
    diff: null,
    diffBytes: MAX_INLINE_DIFF_BYTES + 1,
    stat,
    baseSha,
    headSha,
  });

  assert.ok(context.includes(stat));
  assert.ok(context.includes(headSha));
  assert.ok(
    context.includes(
      `git diff --no-ext-diff --no-textconv ${baseSha}...${headSha} -- <path>`
    )
  );
  assert.ok(context.length < MAX_INLINE_DIFF_BYTES);
});

test('an unusually large inventory remains bounded and points to the full stat', () => {
  const context = assessmentDiffContext({
    diff: null,
    diffBytes: MAX_INLINE_DIFF_BYTES + 1,
    stat: 's'.repeat(MAX_INLINE_DIFF_BYTES),
    baseSha,
    headSha,
  });

  assert.ok(context.includes('Inventory truncated'));
  assert.ok(context.includes(`git diff --stat ${baseSha}...${headSha}`));
  assert.ok(context.length < MAX_INLINE_DIFF_BYTES);
});

test('a diff larger than the command output limit is never buffered', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-large-diff-test-'));
  try {
    const source = path.join(dir, 'source');
    const output = path.join(dir, 'pr.diff');
    execFileSync('git', ['init', '-q', source]);
    execFileSync('git', [
      '-C',
      source,
      'config',
      'user.email',
      'qa@example.com',
    ]);
    execFileSync('git', ['-C', source, 'config', 'user.name', 'QA']);
    writeFileSync(path.join(source, 'file.txt'), 'before\n');
    execFileSync('git', ['-C', source, 'add', 'file.txt']);
    execFileSync('git', ['-C', source, 'commit', '-qm', 'base']);
    writeFileSync(path.join(source, 'file.txt'), 'x'.repeat(17 * 1024 * 1024));
    execFileSync('git', ['-C', source, 'diff', `--output=${output}`], {
      maxBuffer: 16 * 1024 * 1024,
    });

    const result = readInlineDiff(output);
    assert.ok(result.bytes > 16 * 1024 * 1024);
    assert.equal(result.diff, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

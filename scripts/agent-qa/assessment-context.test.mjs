import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_INLINE_DIFF_CHARS,
  assessmentDiffContext,
} from './assessment-context.mjs';

const baseSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);

test('small PRs keep their full diff', () => {
  const diff = 'diff --git a/file b/file\n+change';
  assert.equal(
    assessmentDiffContext({ diff, stat: 'file | 1 +', baseSha, headSha }),
    diff
  );
});

test('large PRs get a bounded inventory and an exact source inspection command', () => {
  const diff = 'x'.repeat(MAX_INLINE_DIFF_CHARS + 1);
  const stat = 'packages/app/ChannelScreen.tsx | 100 +\n145 files changed';
  const context = assessmentDiffContext({ diff, stat, baseSha, headSha });

  assert.ok(context.includes(stat));
  assert.ok(context.includes(headSha));
  assert.ok(
    context.includes(
      `git diff --no-ext-diff --no-textconv ${baseSha}...${headSha} -- <path>`
    )
  );
  assert.ok(!context.includes(diff));
  assert.ok(context.length < MAX_INLINE_DIFF_CHARS);
});

test('an unusually large inventory remains bounded and points to the full stat', () => {
  const context = assessmentDiffContext({
    diff: 'x'.repeat(MAX_INLINE_DIFF_CHARS + 1),
    stat: 's'.repeat(MAX_INLINE_DIFF_CHARS),
    baseSha,
    headSha,
  });

  assert.ok(context.includes('Inventory truncated'));
  assert.ok(context.includes(`git diff --stat ${baseSha}...${headSha}`));
  assert.ok(context.length < MAX_INLINE_DIFF_CHARS);
});

import { readFileSync, statSync } from 'node:fs';

export const MAX_INLINE_DIFF_BYTES = 240_000;
const MAX_INLINE_INVENTORY_CHARS = 180_000;

export function readInlineDiff(file) {
  const bytes = statSync(file).size;
  return {
    bytes,
    diff:
      bytes <= MAX_INLINE_DIFF_BYTES ? readFileSync(file, 'utf8').trim() : null,
  };
}

export function assessmentDiffContext({
  diff,
  diffBytes,
  stat,
  baseSha,
  headSha,
}) {
  if (diff !== null) return diff;

  const inventory =
    stat.length <= MAX_INLINE_INVENTORY_CHARS
      ? stat
      : `${stat.slice(0, MAX_INLINE_INVENTORY_CHARS)}\n[Inventory truncated; inspect the full diff with git.]`;

  return `The PR diff is ${diffBytes} bytes, too large to include in one prompt. The complete source is checked out at ${headSha}; the base commit ${baseSha} is available locally. Do not decide from the file list alone. Use shell tools to inspect the relevant changes, especially iOS-visible behavior, with:
git diff --no-ext-diff --no-textconv ${baseSha}...${headSha} -- <path>

Changed-file summary (run git diff --stat ${baseSha}...${headSha} if truncated):
${inventory}`;
}

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AC #6: no mock conversation content anywhere in the onboarding flow.
 *
 * A grep rather than a render assertion, because the failure mode this guards
 * against is *reintroduction* — someone needing a plausible screenshot and
 * pasting a scripted exchange back in. Deleting the file made AC #6 true today;
 * this is what keeps it true.
 *
 * Phrases come from the deleted `mockConversation.ts`, which scripted a
 * broccoli-gardening exchange modelled on tlon.io's marketing page.
 */
const FORBIDDEN = [
  'MOCK_CONVERSATION',
  'MockMessage',
  'buildMockPost',
  'BotChatPreview',
  'broccoli',
  'seedlings',
  'harden them off',
];

// Package-relative rather than derived from import.meta: this package's
// tsconfig targets a module setting that disallows it.
const wayfindingDir = join(process.cwd(), 'ui/components/Wayfinding');
const selfPath = join(wayfindingDir, 'noMockConversation.test.ts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    // The guard would otherwise match its own forbidden list.
    if (full === selfPath) {
      return [];
    }
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe('the onboarding flow ships no mock conversation', () => {
  const files = sourceFiles(wayfindingDir);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)('%s', (file) => {
    const haystack = readFileSync(file, 'utf-8').toLowerCase();
    for (const token of FORBIDDEN) {
      expect(haystack, `${file} names "${token}"`).not.toContain(
        token.toLowerCase()
      );
    }
  });
});

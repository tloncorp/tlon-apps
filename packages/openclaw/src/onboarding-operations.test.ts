import { afterEach, describe, expect, test } from 'vitest';

import {
  clearOnboardingOperations,
  parseOnboardingNotesListing,
  readOnboardingNotebookNewestId,
  setOnboardingCommandRunner,
} from './onboarding-operations.js';

afterEach(() => clearOnboardingOperations());

describe('onboarding notebook reads', () => {
  test('recognizes an empty %notes notebook', () => {
    expect(parseOnboardingNotesListing('No notes.\n')).toBeNull();
  });

  test('uses the largest numeric note id as the newest baseline', () => {
    expect(
      parseOnboardingNotesListing(
        '#7  First note  (rev 1)\n#12  Newest note  (rev 3)\n#9  Middle note  (rev 2)\n'
      )
    ).toBe('12');
  });

  test('rejects output that cannot prove notebook state', () => {
    expect(() => parseOnboardingNotesListing('Notebook unavailable\n')).toThrow(
      'Unexpected output'
    );
  });

  test('queries the trusted %notes CLI command', async () => {
    const calls: string[][] = [];
    setOnboardingCommandRunner('~zod', async (args) => {
      calls.push(args);
      return '#42  Daily brief  (rev 1)\n';
    });

    await expect(
      readOnboardingNotebookNewestId('notes/~zod/daily')
    ).resolves.toBe('42');
    expect(calls).toEqual([['notes', 'notes', 'notes/~zod/daily']]);
  });

  test('uses the command runner for the notebook host', async () => {
    setOnboardingCommandRunner('~zod', async () => '#1  Zod  (rev 1)\n');
    setOnboardingCommandRunner('~nec', async () => '#9  Nec  (rev 1)\n');

    await expect(
      readOnboardingNotebookNewestId('notes/~zod/daily')
    ).resolves.toBe('1');
    await expect(
      readOnboardingNotebookNewestId('notes/~nec/daily')
    ).resolves.toBe('9');
  });
});

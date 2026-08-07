import { afterEach, describe, expect, test } from 'vitest';

import {
  armOnboardingResearchSession,
  clearOnboardingOperations,
  disarmOnboardingResearchForNest,
  disarmOnboardingResearchSession,
  isOnboardingResearchSession,
  parseOnboardingNotesListing,
  readOnboardingNotebookNewestId,
  registerOnboardingDraftHandler,
  setOnboardingCommandRunner,
  submitOnboardingDraft,
} from './onboarding-operations.js';

afterEach(() => clearOnboardingOperations());

describe('onboarding research boundary', () => {
  test('stays armed through draft submission until the agent turn ends', async () => {
    armOnboardingResearchSession('chat/~zod/home', 'agent:main:tlon');
    const unregister = registerOnboardingDraftHandler(
      'chat/~zod/home',
      async () => ({ ok: true, message: 'accepted' })
    );

    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(true);
    await expect(
      submitOnboardingDraft({
        nest: 'chat/~zod/home',
        title: 'Today',
        markdown: 'Draft',
      })
    ).resolves.toEqual({ ok: true, message: 'accepted' });
    unregister();
    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(true);

    disarmOnboardingResearchSession('agent:main:tlon');
    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(false);
  });

  test('can release a timed-out turn by nest', () => {
    armOnboardingResearchSession('chat/~zod/home', 'agent:main:tlon');
    disarmOnboardingResearchForNest('chat/~zod/home');
    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(false);
  });
});

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
    setOnboardingCommandRunner(async (args) => {
      calls.push(args);
      return '#42  Daily brief  (rev 1)\n';
    });

    await expect(
      readOnboardingNotebookNewestId('notes/~zod/daily')
    ).resolves.toBe('42');
    expect(calls).toEqual([['notes', 'notes', 'notes/~zod/daily']]);
  });
});

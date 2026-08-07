import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  armOnboardingResearchSession,
  clearOnboardingOperations,
  disarmOnboardingResearchForNest,
  disarmOnboardingResearchSession,
  enqueueAndWakeOnboardingResearch,
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

describe('onboarding research wake', () => {
  test('requests an immediate wake only after the directive is enqueued', () => {
    const enqueue = vi.fn(() => true);
    const wake = vi.fn();

    expect(enqueueAndWakeOnboardingResearch(enqueue, wake)).toEqual({
      enqueued: true,
      wakeRequested: true,
    });
    expect(enqueue).toHaveBeenCalledOnce();
    expect(wake).toHaveBeenCalledOnce();
  });

  test('does not wake a session when the directive was not enqueued', () => {
    const wake = vi.fn();

    expect(enqueueAndWakeOnboardingResearch(() => false, wake)).toEqual({
      enqueued: false,
      wakeRequested: false,
    });
    expect(wake).not.toHaveBeenCalled();
  });

  test('keeps an enqueued directive armed when the wake request throws', () => {
    const wakeError = new Error('heartbeat unavailable');

    expect(
      enqueueAndWakeOnboardingResearch(
        () => true,
        () => {
          throw wakeError;
        }
      )
    ).toEqual({
      enqueued: true,
      wakeRequested: false,
      wakeError,
    });
  });
});

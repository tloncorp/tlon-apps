import { describe, expect, it, vi } from 'vitest';

import {
  agentGroupOnboardingTesting,
  buildAgentGroupTitle,
} from './agentGroupOnboarding';

describe('buildAgentGroupTitle', () => {
  it('names each purpose from its selected topic', () => {
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-daily-digest',
        topics: ['Peptides'],
      })
    ).toBe('Peptides Digest');
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-learning',
        topics: ['Music theory'],
      })
    ).toBe('Learning Music theory');
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-research',
        topics: ['Open hardware'],
      })
    ).toBe('Open hardware Research');
  });

  it('summarizes multiple topics without creating an unbounded title', () => {
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-research',
        topics: ['Peptides', 'Mycology'],
      })
    ).toBe('Peptides + 1 more Research');
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-research',
        topics: ['Peptides', 'Mycology', 'Longevity'],
      })
    ).toBe('Peptides + 2 more Research');
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-daily-digest',
        topics: ['A'.repeat(200)],
      }).length
    ).toBeLessThanOrEqual(48);
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-daily-digest',
        topics: [
          'Chicago weather and school closures',
          'CTA delays and service changes',
        ],
      })
    ).toBe('Chicago weather and school clos… + 1 more Digest');
    expect(
      buildAgentGroupTitle({
        purposeId: 'agent-research',
        topics: ['Private equity ownership of Pennsylvania nursing homes'],
      })
    ).toBe('Private equity ownership of Pennsylvan… Research');
  });
});

describe('agent group furnishing retry', () => {
  it('chooses the same duplicate onboarding notebook on every client', () => {
    const first = { id: 'notes/~zod/zeta', title: 'Updates' } as never;
    const second = { id: 'notes/~zod/alpha', title: 'Updates' } as never;

    expect(
      agentGroupOnboardingTesting.splitOnboardingNotebookDuplicates([
        first,
        second,
      ])
    ).toEqual({ keeper: second, duplicates: [first] });
  });

  it('does not delete notebooks that are not onboarding duplicates', () => {
    expect(() =>
      agentGroupOnboardingTesting.splitOnboardingNotebookDuplicates([
        { id: 'notes/~zod/alpha', title: 'Updates' } as never,
        { id: 'notes/~zod/project', title: 'Project' } as never,
      ])
    ).toThrow('multiple notebooks');
  });

  it('waits for a pending create to return its authoritative chat', async () => {
    const groupWithoutChat = { id: '~zod/group', channels: [] } as never;
    const groupWithChat = {
      id: '~zod/group',
      channels: [{ id: 'chat/~zod/general', type: 'chat' }],
    } as never;
    const loadGroup = vi
      .fn()
      .mockResolvedValueOnce(groupWithoutChat)
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValueOnce(groupWithChat);

    await expect(
      agentGroupOnboardingTesting.waitForPendingGroupWithChat(loadGroup, {
        attempts: 3,
        delayMs: 0,
      })
    ).resolves.toBe(groupWithChat);
    expect(loadGroup).toHaveBeenCalledTimes(3);
  });

  it('does not accept an incomplete pending group', async () => {
    const loadGroup = vi.fn().mockResolvedValue({
      id: '~zod/group',
      channels: [],
    });

    await expect(
      agentGroupOnboardingTesting.waitForPendingGroupWithChat(loadGroup, {
        attempts: 2,
        delayMs: 0,
      })
    ).rejects.toThrow('still creating its chat');
    expect(loadGroup).toHaveBeenCalledTimes(2);
  });

  it('keeps furnishing single-flight until completion settles', async () => {
    let finish!: () => void;
    const complete = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const started = {
      group: {},
      chatChannel: {},
      agentShipId: '~bot',
      complete,
    } as never;
    const start = vi.fn(async () => started);
    const key = `test:${Math.random()}`;

    const first =
      await agentGroupOnboardingTesting.startAgentGroupFurnishingFlight(
        key,
        start
      );
    const second =
      await agentGroupOnboardingTesting.startAgentGroupFurnishingFlight(
        key,
        start
      );
    expect(start).toHaveBeenCalledTimes(1);
    expect(second.complete).toBe(first.complete);

    finish();
    await first.complete;
    await agentGroupOnboardingTesting.startAgentGroupFurnishingFlight(
      key,
      start
    );
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('continues to the required join when the cordon entry already exists', async () => {
    const add = vi.fn().mockRejectedValue(new Error('already allowed'));
    const join = vi.fn().mockResolvedValue(undefined);

    await expect(
      agentGroupOnboardingTesting.addCordonThenJoin(
        'hosted-ship',
        '~zod/home',
        'moon-zod',
        { add, join }
      )
    ).resolves.toBeUndefined();
    expect(join).toHaveBeenCalledWith('hosted-ship', '~zod/home', 'moon-zod');
  });

  it('retries the idempotent furnishing core once', async () => {
    const operation = vi
      .fn<[], Promise<string>>()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce('furnished');

    await expect(
      agentGroupOnboardingTesting.retryAgentGroupFurnishCore(operation, {
        groupId: 'group-id',
        delayMs: 0,
      })
    ).resolves.toBe('furnished');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not keep retrying after the second failure', async () => {
    const finalError = new Error('still unavailable');
    const operation = vi
      .fn<[], Promise<void>>()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockRejectedValueOnce(finalError);

    await expect(
      agentGroupOnboardingTesting.retryAgentGroupFurnishCore(operation, {
        groupId: 'group-id',
        delayMs: 0,
      })
    ).rejects.toBe(finalError);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries agent standing until it succeeds', async () => {
    const operation = vi
      .fn<[], Promise<void>>()
      .mockRejectedValueOnce(new Error('join pending'))
      .mockRejectedValueOnce(new Error('admin pending'))
      .mockResolvedValueOnce(undefined);
    await expect(
      agentGroupOnboardingTesting.retryAgentStanding(operation, 'group-id', {
        startingDelay: 0,
      })
    ).resolves.toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('stops repairing agent standing after the bounded attempts', async () => {
    const finalError = new Error('still unavailable');
    const operation = vi.fn().mockRejectedValue(finalError);
    await expect(
      agentGroupOnboardingTesting.retryAgentStanding(operation, 'group-id', {
        startingDelay: 0,
        maxAttempts: 3,
      })
    ).rejects.toBe(finalError);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});

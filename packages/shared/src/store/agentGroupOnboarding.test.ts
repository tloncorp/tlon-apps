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

describe('onboarding group title replacement', () => {
  const lock = {
    createdAt: 1,
    canRenameGroup: true,
    initialGroupTitle: 'My agent group',
    generatedGroupTitle: 'Peptides Digest',
  };

  it('allows placeholders and the last onboarding-generated title', () => {
    expect(
      agentGroupOnboardingTesting.isAgentGroupTitleRenameEligible(
        lock,
        'My agent group'
      )
    ).toBe(true);
    expect(
      agentGroupOnboardingTesting.isAgentGroupTitleRenameEligible(
        lock,
        'Peptides Digest'
      )
    ).toBe(true);
  });

  it('preserves genuine user edits', () => {
    expect(
      agentGroupOnboardingTesting.isAgentGroupTitleRenameEligible(
        lock,
        'Dan’s group'
      )
    ).toBe(false);
  });
});

describe('agent group furnishing retry', () => {
  it('deletes only this client’s proven-new notebook when it loses the race', () => {
    const first = { id: 'notes/~zod/zeta', title: 'Updates' } as never;
    const second = { id: 'notes/~zod/alpha', title: 'Updates' } as never;

    expect(
      agentGroupOnboardingTesting.chooseCreatedNotebookResolution(
        [first, second],
        'notes/~zod/zeta'
      )
    ).toEqual({ created: first, keeper: second });
  });

  it('never chooses an existing or unproven notebook for deletion', () => {
    expect(() =>
      agentGroupOnboardingTesting.chooseCreatedNotebookResolution(
        [
          { id: 'notes/~zod/alpha', title: 'Updates' } as never,
          { id: 'notes/~zod/project', title: 'Project' } as never,
        ],
        'notes/~zod/alpha'
      )
    ).toThrow('multiple notebooks');
    expect(() =>
      agentGroupOnboardingTesting.chooseCreatedNotebookResolution(
        [
          { id: 'notes/~zod/alpha', title: 'Updates' } as never,
          { id: 'notes/~zod/project', title: 'Project' } as never,
        ],
        'notes/~zod/missing'
      )
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

  it('separates explicit group creations while keeping remount retries stable', () => {
    const keyFor = agentGroupOnboardingTesting.agentGroupFurnishingFlightKey;
    expect(keyFor({}, '~zod')).toBe('new:~zod');
    expect(keyFor({ requestId: 'first' }, '~zod')).toBe('first');
    expect(keyFor({ requestId: 'second' }, '~zod')).toBe('second');
    expect(keyFor({ groupId: '~zod/group' }, '~zod')).toBe('~zod/group');
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

  it('reveals after membership and an accepted admin grant without waiting for read-back', async () => {
    let finishVerification!: (group: unknown) => void;
    const verification = new Promise((resolve) => {
      finishVerification = resolve;
    });
    const joinedGroup = {
      id: '~zod/group',
      members: [{ contactId: '~bot', status: 'joined', roles: [] }],
    } as never;
    const adminGroup = {
      id: '~zod/group',
      members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
    } as never;
    const getGroup = vi
      .fn()
      .mockResolvedValueOnce(joinedGroup)
      .mockReturnValueOnce(verification);
    const addMembersToRole = vi.fn().mockResolvedValue(undefined);
    const onReadyToReveal = vi.fn();

    const reconciliation = agentGroupOnboardingTesting.reconcileAgentStanding({
      groupId: '~zod/group',
      agentShipId: '~bot',
      hostedShipId: 'zod',
      onReadyToReveal,
      deps: { getGroup, addMembersToRole },
    });

    await vi.waitFor(() => expect(onReadyToReveal).toHaveBeenCalledOnce());
    expect(addMembersToRole).toHaveBeenCalledWith({
      groupId: '~zod/group',
      roleId: 'admin',
      ships: ['~bot'],
    });

    let verificationFinished = false;
    void reconciliation.then(() => {
      verificationFinished = true;
    });
    await Promise.resolve();
    expect(verificationFinished).toBe(false);

    finishVerification(adminGroup);
    await expect(reconciliation).resolves.toBeUndefined();
  });

  it('does not reveal before the bot joins and the admin grant is accepted', async () => {
    const absentGroup = {
      id: '~zod/group',
      members: [],
    } as never;
    const joinedGroup = {
      id: '~zod/group',
      members: [{ contactId: '~bot', status: 'joined', roles: [] }],
    } as never;
    const adminGroup = {
      id: '~zod/group',
      members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
    } as never;
    const getGroup = vi
      .fn()
      .mockResolvedValueOnce(absentGroup)
      .mockResolvedValueOnce(joinedGroup)
      .mockResolvedValueOnce(adminGroup);
    const addCordonThenJoin = vi.fn().mockResolvedValue(undefined);
    const addMembersToRole = vi.fn().mockResolvedValue(undefined);
    const onReadyToReveal = vi.fn();

    await expect(
      agentGroupOnboardingTesting.reconcileAgentStanding({
        groupId: '~zod/group',
        agentShipId: '~bot',
        hostedShipId: 'zod',
        onReadyToReveal,
        deps: { getGroup, addCordonThenJoin, addMembersToRole },
      })
    ).resolves.toBeUndefined();

    expect(addCordonThenJoin.mock.invocationCallOrder[0]).toBeLessThan(
      addMembersToRole.mock.invocationCallOrder[0]!
    );
    expect(addMembersToRole.mock.invocationCallOrder[0]).toBeLessThan(
      onReadyToReveal.mock.invocationCallOrder[0]!
    );
    expect(onReadyToReveal).toHaveBeenCalledOnce();
  });
});

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
    const sleep = vi.fn(async () => {});

    await expect(
      agentGroupOnboardingTesting.retryAgentStanding(
        operation,
        'group-id',
        sleep
      )
    ).resolves.toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000);
  });

  it('stops repairing agent standing after the bounded attempts', async () => {
    const finalError = new Error('still unavailable');
    const operation = vi.fn().mockRejectedValue(finalError);
    const sleep = vi.fn(async () => {});

    await expect(
      agentGroupOnboardingTesting.retryAgentStanding(
        operation,
        'group-id',
        sleep,
        3
      )
    ).rejects.toBe(finalError);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

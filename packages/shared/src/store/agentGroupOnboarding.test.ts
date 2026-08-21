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
});

import { describe, expect, it } from 'vitest';

import { buildAgentGroupTitle } from './agentGroupOnboarding';

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

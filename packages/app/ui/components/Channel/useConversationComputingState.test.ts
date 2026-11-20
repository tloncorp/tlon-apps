import { type PresenceStatus, serializeComputingStatus } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import { readComputingStatus } from './useConversationComputingState';

// Only the pure reader is under test; keep the hook's app context out.
vi.mock('@tloncorp/shared', () => ({ useConversationPresence: () => [] }));
vi.mock('../../contexts/appDataContext', () => ({
  useCalm: () => ({}),
  useContactIndex: () => ({}),
}));
vi.mock('../contactNameResolver', () => ({ resolveContactNameProps: vi.fn() }));

function presence(
  toolCalls: { toolName: string; label?: string }[],
  text: string | null = null
): PresenceStatus {
  return {
    key: { context: '/dm/~bot', ship: '~bot', topic: 'computing' },
    timing: { since: 0, timeout: '~m1' },
    display: {
      icon: null,
      text,
      blob: serializeComputingStatus({ thinking: true, toolCalls }),
    },
    contextId: '~bot',
  };
}

describe('readComputingStatus', () => {
  it('keeps a lone tool call that the label already names', () => {
    const state = readComputingStatus(
      presence([{ toolName: 'web_fetch', label: 'Checking the web' }])
    );
    expect(state?.label).toBe('Checking the web');
    expect(state?.toolCalls).toEqual([]);
    expect(state?.activeToolCalls).toHaveLength(1);
  });

  it('lists several tool calls in both', () => {
    const state = readComputingStatus(
      presence([
        { toolName: 'web_fetch', label: 'Checking the web' },
        { toolName: 'read', label: 'Reading a file' },
      ])
    );
    expect(state?.toolCalls).toHaveLength(2);
    expect(state?.activeToolCalls).toHaveLength(2);
  });

  it('ignores presence that is not computing', () => {
    const status = presence([]);
    expect(
      readComputingStatus({
        ...status,
        key: { ...status.key, topic: 'typing' },
      })
    ).toBeNull();
  });
});

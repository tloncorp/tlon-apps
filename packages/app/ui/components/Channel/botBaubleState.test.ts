import { describe, expect, it } from 'vitest';

import {
  getBotBaubleBeat,
  getBotBaubleState,
  getBotBaubleStatusText,
} from './botBaubleState';
import type { ConversationComputingState } from './useConversationComputingState';

const thinking: ConversationComputingState = {
  ships: [{ ship: '~bot', label: 'Thinking...', toolCalls: [] }],
  label: 'Thinking...',
  toolCalls: [],
};
const working: ConversationComputingState = {
  ships: [],
  label: 'Checking the web',
  toolCalls: [{ toolName: 'web_fetch', label: 'Checking the web' }],
};

describe('getBotBaubleState', () => {
  it('rests when connected with nothing in flight', () => {
    expect(
      getBotBaubleState({
        liveness: 'online',
        computing: null,
        connectionStatus: 'Connected',
      })
    ).toBe('idle');
  });

  it('tells thinking apart from tool use', () => {
    expect(
      getBotBaubleState({
        liveness: 'online',
        computing: thinking,
        connectionStatus: 'Connected',
      })
    ).toBe('thinking');
    expect(
      getBotBaubleState({
        liveness: null,
        computing: working,
        connectionStatus: 'Connected',
      })
    ).toBe('working');
  });

  it('shows an offline bot as offline even with stale presence', () => {
    expect(
      getBotBaubleState({
        liveness: 'offline',
        computing: thinking,
        connectionStatus: 'Connected',
      })
    ).toBe('offline');
  });

  it('puts our own reconnect ahead of what the bot reported', () => {
    expect(
      getBotBaubleState({
        liveness: 'offline',
        computing: thinking,
        connectionStatus: 'Reconnecting',
      })
    ).toBe('connecting');
  });
});

describe('getBotBaubleStatusText', () => {
  it('uses the computing label while busy and nothing at rest', () => {
    expect(getBotBaubleStatusText('working', working)).toBe('Checking the web');
    expect(getBotBaubleStatusText('idle', null)).toBeNull();
    expect(getBotBaubleStatusText('offline', null)).toBe('Offline');
  });
});

describe('getBotBaubleBeat', () => {
  it('ticks only while the bot works, a little faster when using tools', () => {
    expect(getBotBaubleBeat('working')!).toBeLessThan(
      getBotBaubleBeat('thinking')!
    );
    expect(getBotBaubleBeat('idle')).toBeNull();
    expect(getBotBaubleBeat('offline')).toBeNull();
    expect(getBotBaubleBeat('connecting')).toBeNull();
  });
});

import { A2UI } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import { isA2UISendMessageActionConsumed } from './a2uiActionConsumption';

describe('isA2UISendMessageActionConsumed', () => {
  const send = (text: string): A2UI.ButtonAction => ({
    event: { name: A2UI.action.sendMessage, context: { text } },
  });

  it('matches only the action that produced the durable owner reply', () => {
    expect(isA2UISendMessageActionConsumed(send('Research'), 'Research')).toBe(
      true
    );
    expect(
      isA2UISendMessageActionConsumed(send('A daily digest'), 'Research')
    ).toBe(false);
  });

  it('does not consume empty probe actions', () => {
    expect(isA2UISendMessageActionConsumed(send(''), 'Research')).toBe(false);
  });

  it('matches only owner replies after the current control', () => {
    const replyIndex = {
      lastIndexByText: new Map([
        ['Before', 0],
        ['After', 1],
      ]),
      start: 1,
    };
    expect(
      isA2UISendMessageActionConsumed(send('Before'), undefined, replyIndex)
    ).toBe(false);
    expect(
      isA2UISendMessageActionConsumed(send('After'), undefined, replyIndex)
    ).toBe(true);
  });
});

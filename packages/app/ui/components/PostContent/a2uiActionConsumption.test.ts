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
});

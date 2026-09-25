import { A2UI } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  isA2UISendMessageActionConsumed,
  shouldDismissKeyboardForChoice,
} from './a2uiActionConsumption';

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
});

describe('shouldDismissKeyboardForChoice', () => {
  it('dismisses only for an actionable, unconsumed choice', () => {
    expect(shouldDismissKeyboardForChoice(true, false)).toBe(true);
    expect(shouldDismissKeyboardForChoice(true, true)).toBe(false);
    expect(shouldDismissKeyboardForChoice(false, false)).toBe(false);
  });
});

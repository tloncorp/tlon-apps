import { A2UI } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  getSmallChoiceCompletionPresentation,
  getSmallChoiceMessageSelection,
  isA2UISendMessageActionConsumed,
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
});

describe('getSmallChoiceCompletionPresentation', () => {
  it('restores a remounted picker from its durable topics', () => {
    expect(
      getSmallChoiceCompletionPresentation({
        actionConsumed: true,
        consumedLocally: false,
        durableTopics: ['Astronomy', 'Geometry'],
        localTopics: [],
      })
    ).toEqual({ completed: true, topics: ['Astronomy', 'Geometry'] });
  });
});

describe('getSmallChoiceMessageSelection', () => {
  const component: A2UI.SmallChoice = {
    id: 'orientation',
    component: 'SmallChoice',
    options: [
      { id: 'groups', label: 'Groups and channels' },
      { id: 'computer', label: 'Your Tlon computer' },
    ],
    submitLabel: 'Continue',
    action: {
      event: { name: A2UI.action.sendMessage, context: { text: '' } },
    },
  };

  it('recovers selected labels from the durable owner message', () => {
    expect(
      getSmallChoiceMessageSelection(
        component,
        'Groups and channels, Your Tlon computer'
      )
    ).toEqual(['Groups and channels', 'Your Tlon computer']);
  });
});

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

  it('keeps an unconsumed picker expanded', () => {
    expect(
      getSmallChoiceCompletionPresentation({
        actionConsumed: false,
        consumedLocally: false,
        durableTopics: ['Astronomy'],
        localTopics: [],
      })
    ).toEqual({ completed: false, topics: [] });
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

  it('uses a manually typed answer as the compact completion', () => {
    expect(
      getSmallChoiceMessageSelection(component, 'Tell me about identities')
    ).toEqual(['Tell me about identities']);
  });

  it('keeps a quoted custom value containing commas intact', () => {
    expect(
      getSmallChoiceMessageSelection(
        component,
        'Groups and channels, "Research, development"'
      )
    ).toEqual(['Groups and channels', 'Research, development']);
  });
});

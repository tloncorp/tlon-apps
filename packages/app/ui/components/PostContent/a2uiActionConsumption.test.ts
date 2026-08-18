import { A2UI } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  getSmallChoiceCompletionPresentation,
  getSmallChoiceMessageSelection,
  isConsumableA2UIAction,
} from './a2uiActionConsumption';

function action(name: A2UI.ButtonAction['event']['name']) {
  return { event: { name, context: {} } } as A2UI.ButtonAction;
}

describe('isConsumableA2UIAction', () => {
  it('consumes owner-response actions', () => {
    expect(isConsumableA2UIAction(action(A2UI.action.sendMessage))).toBe(true);
    expect(isConsumableA2UIAction(action(A2UI.action.provisionAgent))).toBe(
      true
    );
  });

  it('keeps client-local actions reusable', () => {
    expect(isConsumableA2UIAction(action(A2UI.action.navigate))).toBe(false);
    expect(isConsumableA2UIAction(action(A2UI.action.inviteLink))).toBe(false);
  });
});

describe('getSmallChoiceCompletionPresentation', () => {
  it('collapses a remounted picker from its durable topics', () => {
    expect(
      getSmallChoiceCompletionPresentation({
        actionConsumed: true,
        consumedLocally: false,
        durableTopics: ['Astronomy', 'Geometry'],
        localTopics: [],
      })
    ).toEqual({
      collapsed: true,
      topics: ['Astronomy', 'Geometry'],
    });
  });

  it('keeps an unconsumed picker expanded', () => {
    expect(
      getSmallChoiceCompletionPresentation({
        actionConsumed: false,
        consumedLocally: false,
        durableTopics: ['Astronomy'],
        localTopics: [],
      })
    ).toEqual({ collapsed: false, topics: [] });
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
});

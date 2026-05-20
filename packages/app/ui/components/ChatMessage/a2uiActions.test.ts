import type { A2UI } from '@tloncorp/shared/logic';
import { describe, expect, test } from 'vitest';

import {
  getA2UIConfirmationDescription,
  getA2UIDestinationLabel,
  getA2UIPokePayload,
  getA2UISendText,
  isA2UIRenderableChatContext,
} from './a2uiActions';

const sendMessageAction = (text?: string): A2UI.Button['action'] => ({
  event: {
    name: 'tlon.sendMessage',
    context: text === undefined ? undefined : { text },
  },
});

const pokeAction = (): A2UI.Button['action'] => ({
  event: {
    name: 'tlon.poke',
    context: {
      app: 'a2ui',
      mark: 'a2ui-action',
      json: { userAction: { name: 'lore.compile.confirm' } },
    },
  },
});

describe('A2UI chat actions', () => {
  test('renders in chat-like channel contexts and DMs, but not search', () => {
    expect(
      isA2UIRenderableChatContext({
        channel: { type: 'chat' },
        postChannelId: 'chat/~zod/general',
      })
    ).toBe(true);
    expect(
      isA2UIRenderableChatContext({
        channel: { type: 'notebook' },
        postChannelId: 'diary/~zod/notes',
      })
    ).toBe(false);
    expect(
      isA2UIRenderableChatContext({
        postChannelId: '~sampel-palnet',
      })
    ).toBe(true);
    expect(
      isA2UIRenderableChatContext({
        postChannelId: 'chat/~zod/general',
      })
    ).toBe(false);
    expect(
      isA2UIRenderableChatContext({
        channel: { type: 'chat' },
        postChannelId: 'chat/~zod/general',
        searchQuery: 'allow',
      })
    ).toBe(false);
  });

  test('uses explicit action context text as the send text', () => {
    expect(getA2UISendText(sendMessageAction('/allow c3d4e'), 'Allow')).toBe(
      '/allow c3d4e'
    );
    expect(getA2UISendText(sendMessageAction(), 'Allow')).toBe('Allow');
  });

  test('describes hidden send text and destination in the confirmation copy', () => {
    const destination = getA2UIDestinationLabel({
      channel: { id: 'chat/~zod/design', type: 'chat', title: 'Design' },
      group: { id: '~zod/garden', title: 'Garden Club' },
    });

    expect(destination).toBe('Design in Garden Club');
    expect(
      getA2UIConfirmationDescription({
        actionName: 'tlon.sendMessage',
        buttonLabel: 'Allow',
        sendText: '/allow c3d4e',
        destination,
      })
    ).toContain('Will send: /allow c3d4e');
  });

  test('describes direct poke actions with app, mark, and JSON', () => {
    const action = pokeAction();
    const json = getA2UIPokePayload(action);

    expect(json).toContain('lore.compile.confirm');
    expect(
      getA2UIConfirmationDescription({
        actionName: 'tlon.poke',
        buttonLabel: 'Compile now',
        app: 'a2ui',
        mark: 'a2ui-action',
        json,
      })
    ).toContain('App: %a2ui');
  });
});

import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';
import { expect, test, vi } from 'vitest';

import {
  actionButtonErrorMessage,
  fireActionButtonPoke,
} from './actionButtonPoke';

const actionButton: PostBlobDataEntryActionButton = {
  type: 'action-button',
  version: 1,
  label: 'Approve',
  pokeApp: 'permissions',
  pokeMark: 'json',
  pokeJson: { allow: true, requestId: 'req-123' },
};

test('fireActionButtonPoke sends the action-button payload through poke', async () => {
  const poke = vi.fn().mockResolvedValue(undefined);

  await fireActionButtonPoke(actionButton, {}, poke);

  expect(poke).toHaveBeenCalledWith({
    app: 'permissions',
    mark: 'json',
    json: { allow: true, requestId: 'req-123' },
  });
});

test('fireActionButtonPoke resolves template variables from context', async () => {
  const poke = vi.fn().mockResolvedValue(undefined);
  const templatedButton: PostBlobDataEntryActionButton = {
    type: 'action-button',
    version: 1,
    label: 'Reply',
    pokeApp: 'chat',
    pokeMark: 'chat-dm-action-1',
    pokeJson: {
      ship: '{{targetUser}}',
      channel: '{{currentChannel}}',
      target: '{{targetChannel}}',
    },
  };

  await fireActionButtonPoke(
    templatedButton,
    {
      targetUser: '~zod',
      currentChannel: '~bus/tlon/channel/chat/~bus/lobby',
      targetChannel: '~dev/urbit-meta/channel/chat/~dev/general',
    },
    poke
  );

  expect(poke).toHaveBeenCalledWith({
    app: 'chat',
    mark: 'chat-dm-action-1',
    json: {
      ship: '~zod',
      channel: '~bus/tlon/channel/chat/~bus/lobby',
      target: '~dev/urbit-meta/channel/chat/~dev/general',
    },
  });
});

test('actionButtonErrorMessage includes the underlying error when available', () => {
  expect(actionButtonErrorMessage(new Error('network down'))).toBe(
    'Failed to send action: network down'
  );
});

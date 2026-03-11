import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';
import { parsePostBlob } from '@tloncorp/api/lib/content-helpers';
import { expect, test, vi } from 'vitest';

import {
  actionButtonErrorMessage,
  fireActionButtonPoke,
  sendActionResponse,
} from './actionButtonPoke';

const pokeActionButton: PostBlobDataEntryActionButton = {
  type: 'action-button',
  version: 1,
  label: 'Approve',
  action: {
    type: 'poke',
    app: 'permissions',
    mark: 'json',
    json: { allow: true, requestId: 'req-123' },
  },
};

test('fireActionButtonPoke sends the poke action payload through poke', async () => {
  const poke = vi.fn().mockResolvedValue(undefined);

  await fireActionButtonPoke(pokeActionButton, {}, poke);

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
    action: {
      type: 'poke',
      app: 'chat',
      mark: 'chat-dm-action-1',
      json: {
        ship: '{{targetUser}}',
        channel: '{{currentChannel}}',
        target: '{{targetChannel}}',
      },
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

test('fireActionButtonPoke does nothing for response-type action buttons', async () => {
  const poke = vi.fn().mockResolvedValue(undefined);
  const responseButton: PostBlobDataEntryActionButton = {
    type: 'action-button',
    version: 1,
    label: 'Approve',
    action: { type: 'response', text: 'approve' },
  };

  await fireActionButtonPoke(responseButton, {}, poke);

  expect(poke).not.toHaveBeenCalled();
});

const mockGetCurrentUserId = () => '~zod';

test('sendActionResponse sends a post with action-response blob when action type is response', async () => {
  const sendPost = vi.fn().mockResolvedValue(undefined);
  const responseButton: PostBlobDataEntryActionButton = {
    type: 'action-button',
    version: 1,
    label: 'Approve',
    action: { type: 'response', text: 'approve' },
  };

  await sendActionResponse(
    responseButton,
    {
      currentChannel: 'chat/~zod/test',
      sourcePostId: '170141184506828851385935487131294105600',
    },
    sendPost,
    mockGetCurrentUserId
  );

  expect(sendPost).toHaveBeenCalledTimes(1);
  const call = sendPost.mock.calls[0][0];
  expect(call.channelId).toBe('chat/~zod/test');
  expect(call.authorId).toBe('~zod');
  expect(call.content).toEqual([{ inline: ['approve'] }]);
  expect(call.blob).toBeDefined();

  const blobEntries = parsePostBlob(call.blob);
  expect(blobEntries).toHaveLength(1);
  expect(blobEntries[0]).toMatchObject({
    type: 'action-response',
    version: 1,
    sourcePostId: '170141184506828851385935487131294105600',
    actionLabel: 'Approve',
    senderHidden: true,
  });
});

test('sendActionResponse does nothing for poke-type action buttons', async () => {
  const sendPost = vi.fn().mockResolvedValue(undefined);

  await sendActionResponse(
    pokeActionButton,
    { currentChannel: 'chat/~zod/test', sourcePostId: 'post-1' },
    sendPost
  );

  expect(sendPost).not.toHaveBeenCalled();
});

test('sendActionResponse does nothing when currentChannel is missing', async () => {
  const sendPost = vi.fn().mockResolvedValue(undefined);
  const responseButton: PostBlobDataEntryActionButton = {
    type: 'action-button',
    version: 1,
    label: 'Approve',
    action: { type: 'response', text: 'approve' },
  };

  await sendActionResponse(responseButton, {}, sendPost);

  expect(sendPost).not.toHaveBeenCalled();
});

test('sendActionResponse respects hidden=false on response action', async () => {
  const sendPost = vi.fn().mockResolvedValue(undefined);
  const responseButton: PostBlobDataEntryActionButton = {
    type: 'action-button',
    version: 1,
    label: 'Approve',
    action: { type: 'response', text: 'approve', hidden: false },
  };

  await sendActionResponse(
    responseButton,
    {
      currentChannel: 'chat/~zod/test',
      sourcePostId: 'post-1',
    },
    sendPost,
    mockGetCurrentUserId
  );

  const blobEntries = parsePostBlob(sendPost.mock.calls[0][0].blob);
  expect(blobEntries[0]).toMatchObject({
    senderHidden: false,
  });
});

test('actionButtonErrorMessage includes the underlying error when available', () => {
  expect(actionButtonErrorMessage(new Error('network down'))).toBe(
    'Failed to send action: network down'
  );
});

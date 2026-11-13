import { afterEach, expect, test, vi } from 'vitest';

import { channelActionIdsFor } from '../types/ChannelActions';
import {
  DurableClient,
  configureDurableClient,
  durablePostId,
} from '../client/durable';
import {
  durableHiddenPostIds,
  durableLinkPreview,
  durableReferencedMessage,
  isDurableHidden,
  isLinkedImage,
  isRemoteUrl,
  setDurableHidden,
  withoutRemoteImages,
} from '../client/durableMessages';

const origin = 'https://slab.example';

function client() {
  const value = new DurableClient('token', origin);
  value.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [],
    bot: null,
    revision: 0,
    groups: [],
    rooms: [
      {
        id: 'group-room',
        channelId: 'chat/~sampel-palnet/general',
        title: 'General',
        members: ['brian'],
        groupId: 'group',
        kind: 'channel',
      },
    ],
  };
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
  configureDurableClient(undefined as unknown as DurableClient);
});

test('remote images render as links and previews drop remote thumbnails', () => {
  const stored = `${origin}/v1/rooms/r/attachments/x/content`;
  const content = withoutRemoteImages(
    [
      { block: { image: { src: 'https://cdn.example/a.png', alt: '' } } },
      { block: { image: { src: stored, alt: '' } } },
      {
        block: {
          link: {
            url: 'https://site.example',
            meta: {
              title: 'Site',
              siteIconUrl: 'https://site.example/icon.png',
              previewImageUrl: 'https://site.example/og.png',
              previewImageWidth: '10',
            },
          },
        },
      },
      {
        block: {
          link: {
            url: 'https://site.example',
            meta: { title: 'Site', previewImageUrl: '/v1/rooms/r/a/b' },
          },
        },
      },
    ],
    origin
  );
  expect(content[0]).toEqual({
    inline: [
      {
        link: {
          href: 'https://cdn.example/a.png',
          content: 'https://cdn.example/a.png',
        },
      },
    ],
  });
  expect(content[1]).toEqual({ block: { image: { src: stored, alt: '' } } });
  expect(content[2]).toEqual({
    block: { link: { url: 'https://site.example', meta: { title: 'Site' } } },
  });
  expect(content[3]).toEqual({
    block: {
      link: {
        url: 'https://site.example',
        meta: { title: 'Site', previewImageUrl: '/v1/rooms/r/a/b' },
      },
    },
  });
});

test('hidden messages map to the post IDs of rooms this account sees', () => {
  const local = client();
  const state = {
    revision: 1,
    reads: {},
    pins: [],
    settings: {},
    hidden: ['group-room/msg-1', 'gone-room/msg-2'],
  };
  setDurableHidden(state);
  expect(durableHiddenPostIds(local, state)).toEqual([
    durablePostId('chat/~sampel-palnet/general', 'msg-1'),
  ]);
  expect(isDurableHidden(local, 'chat/~sampel-palnet/general', 'msg-1')).toBe(
    true
  );
  expect(isDurableHidden(local, 'chat/~sampel-palnet/general', 'msg-2')).toBe(
    false
  );
});

test('a reference asks the room for the post ID and is unavailable outside it', async () => {
  const local = client();
  const request = vi
    .spyOn(local, 'request')
    .mockResolvedValue({ id: 'msg-1' } as never);
  await durableReferencedMessage(
    local,
    'chat/~sampel-palnet/general',
    '123.456'
  );
  expect(request).toHaveBeenCalledWith('/rooms/group-room/message?id=123456');
  await expect(
    durableReferencedMessage(local, 'chat/~zod/elsewhere', '123')
  ).rejects.toThrow('unavailable');
});

test('link previews come from the account server; image links become images', async () => {
  const local = client();
  const request = vi.spyOn(local, 'request').mockResolvedValueOnce({
    url: 'https://site.example',
    type: 'page',
    title: 'Site',
    description: '',
    siteName: 'Example',
    previewImageUrl: 'https://site.example/og.png',
  } as never);
  expect(await durableLinkPreview(local, 'https://site.example')).toEqual({
    type: 'page',
    url: 'https://site.example',
    title: 'Site',
    description: undefined,
    siteName: 'Example',
    previewImageUrl: 'https://site.example/og.png',
  });
  expect(request).toHaveBeenCalledWith(
    '/link-preview?url=https%3A%2F%2Fsite.example'
  );
  request.mockResolvedValueOnce({ type: 'image' } as never);
  expect(await durableLinkPreview(local, 'https://cdn.example/a.png')).toEqual({
    type: 'file',
    url: 'https://cdn.example/a.png',
    mime: 'image/*',
    isImage: true,
  });
});

test('durable mode offers no report action', () => {
  const channel = { id: 'c', type: 'chat' } as never;
  expect(channelActionIdsFor({ channel })).toContain('report');
  configureDurableClient(client());
  expect(channelActionIdsFor({ channel })).not.toContain('report');
  expect(channelActionIdsFor({ channel })).toContain('visibility');
});

test('malformed or relative remote image URLs render as links', () => {
  // An http page, as a local server serves it: `https:/host` is absolute there.
  const origin = 'http://127.0.0.1:4358';
  for (const src of [
    'https:/evil.example/p.png',
    'https:\\\\evil.example\\p.png',
    '//evil.example/p.png',
    ' https://evil.example/p.png',
  ]) {
    expect(isRemoteUrl(src, origin)).toBe(true);
    expect(
      withoutRemoteImages([{ block: { image: { src, alt: '' } } }], origin)
    ).toEqual([{ inline: [{ link: { href: src, content: src } }] }]);
  }
  expect(isRemoteUrl('/v1/rooms/r/attachments/x/content', origin)).toBe(false);
  expect(isRemoteUrl(`${origin}/v1/rooms/r/a/b`, origin)).toBe(false);
});

test('only http links count as linked images for upload', () => {
  expect(isLinkedImage('https://cdn.example/a.png', origin)).toBe(true);
  expect(isLinkedImage('blob:https://slab.example/1234', origin)).toBe(false);
  expect(isLinkedImage('data:image/png;base64,AAAA', origin)).toBe(false);
  expect(isLinkedImage(`${origin}/x.png`, origin)).toBe(false);
});

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  SURFACE_POST_KIND_TAILS,
  isSurfacePostKindTail,
} from '../client/surface/kinds';
import { toPostEssay } from '../client/apiUtils';
import { editPost, sendPost } from '../client/postsApi';
import { poke } from '../client/urbit';
import type * as ub from '../urbit';

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');
  return {
    ...actual,
    poke: vi.fn(),
    scry: vi.fn(),
    subscribeOnce: vi.fn(),
  };
});

const pokeMock = poke as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  pokeMock.mockReset();
});

const content: ub.Story = [{ inline: ['surface record'] }];

describe('kind tail allowlist', () => {
  test('accepts exactly the surface tails', () => {
    expect(SURFACE_POST_KIND_TAILS).toEqual([
      'surface/spec',
      'surface/event',
      'surface/snapshot',
    ]);
    for (const tail of SURFACE_POST_KIND_TAILS) {
      expect(isSurfacePostKindTail(tail)).toBe(true);
    }
  });

  test('rejects anything else', () => {
    for (const bad of [
      'surface',
      'surface/',
      'surface/event/extra',
      '/surface/event',
      'Surface/event',
      'diary',
      'chat/surface/event',
      '../surface/event',
      '',
      42,
      null,
      undefined,
      {},
    ]) {
      expect(isSurfacePostKindTail(bad)).toBe(false);
    }
  });
});

describe('toPostEssay kind tails', () => {
  const base = {
    content,
    authorId: '~zod',
    sentAt: 1701275662689,
  };

  test('builds /chat/surface/* kinds in chat channels', () => {
    for (const tail of SURFACE_POST_KIND_TAILS) {
      const essay = toPostEssay({
        ...base,
        channelType: 'chat',
        kindTail: tail,
      });
      expect(essay.kind).toBe(`/chat/${tail}`);
    }
  });

  test('leaves the kind untouched when no tail is given', () => {
    expect(toPostEssay({ ...base, channelType: 'chat' }).kind).toBe('/chat');
    expect(toPostEssay({ ...base, channelType: 'notebook' }).kind).toBe(
      '/diary'
    );
    expect(toPostEssay({ ...base, channelType: 'gallery' }).kind).toBe('/heap');
  });

  test('throws on a non-allowlisted tail', () => {
    expect(() =>
      toPostEssay({
        ...base,
        channelType: 'chat',
        // @ts-expect-error deliberately invalid tail
        kindTail: 'surface/evil/../../escape',
      })
    ).toThrow(/invalid post kind tail/);
  });

  test('throws on a tail outside chat channels', () => {
    for (const channelType of ['notebook', 'gallery'] as const) {
      expect(() =>
        toPostEssay({
          ...base,
          channelType,
          kindTail: 'surface/event',
        })
      ).toThrow(/only supported in chat channels/);
    }
  });
});

describe('sendPost kind tails', () => {
  test('sends a /chat/surface/event post to a group chat channel', async () => {
    await sendPost({
      channelId: 'chat/~zod/dashboard',
      authorId: '~zod',
      sentAt: 1701275662689,
      content,
      blob: JSON.stringify([]),
      kindTail: 'surface/event',
    });

    expect(pokeMock).toHaveBeenCalledTimes(1);
    const action = pokeMock.mock.calls[0][0];
    const essay = action.json.channel.action.post.add;
    expect(essay.kind).toBe('/chat/surface/event');
  });

  test('rejects kind tails in DMs without poking', async () => {
    await expect(
      sendPost({
        channelId: '~ten',
        authorId: '~zod',
        sentAt: 1701275662689,
        content,
        kindTail: 'surface/event',
      })
    ).rejects.toThrow(/not supported in DMs/);
    expect(pokeMock).not.toHaveBeenCalled();
  });
});

describe('editPost kind tails', () => {
  test('preserves the surface kind on edit', async () => {
    await editPost({
      channelId: 'chat/~zod/dashboard',
      postId: '170141184506535164684262900635183087616',
      authorId: '~zod',
      sentAt: 1701275662689,
      content,
      kindTail: 'surface/event',
    });

    expect(pokeMock).toHaveBeenCalledTimes(1);
    const action = pokeMock.mock.calls[0][0];
    const essay = action.json.channel.action.post.edit.essay;
    expect(essay.kind).toBe('/chat/surface/event');
  });

  test('rejects kind tails on reply edits', async () => {
    await expect(
      editPost({
        channelId: 'chat/~zod/dashboard',
        postId: '170141184506535164684262900635183087616',
        parentId: '170141184506535164684262900635183087617',
        authorId: '~zod',
        sentAt: 1701275662689,
        content,
        kindTail: 'surface/event',
      })
    ).rejects.toThrow(/not supported on replies/);
    expect(pokeMock).not.toHaveBeenCalled();
  });
});

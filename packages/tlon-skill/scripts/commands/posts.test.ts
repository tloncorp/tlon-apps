import { describe, expect, it } from 'bun:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  DIARY_REMOVED,
  NOTES_CHANNEL_CONTENT_UNSUPPORTED,
  dmWritTime,
} from '../cli-utils';
import type { StoryVerse } from '../markdown';
import { type MediaProbe, probeGuardedMedia } from '../media-guard';
import { commandError } from './command';
import {
  type ChannelState,
  type ExistingPost,
  type ExistingReply,
  type ExistingThread,
  POSTS_COMMAND_HELP,
  POSTS_HELP,
  POSTS_REACT_HELP,
  type PostAuthApp,
  type PostDeleteInput,
  type PostEditInput,
  type PostLookupQuery,
  type PostLookupResult,
  type PostReactionInput,
  type PostReactionRemoveInput,
  type PostReplyInput,
  type PostSendInput,
  type PostThreadQuery,
  type PostsDeps,
  type ReplyDeleteInput,
  run,
} from './posts';

// The suffix walkers name a stray token by position only (it may be a
// signed URL or blob JSON).
const unexpectedAt = (position: number) =>
  `Error: Unexpected argument ${position} (counting the channel as 1): it is not an option or an option's value. Put a message that contains a flag word in quotes; give each URL its own flag.`;

const IMAGE_VERSE: StoryVerse = {
  block: { image: { src: 'https://x/y.png', width: 10, height: 20, alt: 'y' } },
};

interface MakeDepsOptions {
  currentUserId?: string;
  now?: number;
  authenticate?: (apps: PostAuthApp[]) => Promise<void>;
  addReaction?: (input: PostReactionInput) => Promise<void>;
  removeReaction?: (input: PostReactionRemoveInput) => Promise<void>;
  deletePost?: (input: PostDeleteInput) => Promise<void>;
  editPost?: (input: PostEditInput) => Promise<void>;
  sendPost?: (input: PostSendInput) => Promise<void>;
  sendReply?: (input: PostReplyInput) => Promise<void>;
  getChannelPosts?: (query: PostLookupQuery) => Promise<PostLookupResult>;
  buildImageVerse?: (url: string) => Promise<StoryVerse>;
  probeMedia?: (url: string) => Promise<MediaProbe>;
  // Successive reads return successive entries (the last one repeats); an
  // Error entry is thrown.
  channelStates?: Array<ChannelState | Error>;
  threads?: Array<ExistingThread | Error>;
  assertCanAdminister?: (
    groupId: string,
    action: string,
    nest: string
  ) => Promise<void>;
  setOrder?: (channelId: string, order: string[]) => Promise<void>;
  deleteReply?: (input: ReplyDeleteInput) => Promise<void>;
  // The group's role ids, or an Error to throw.
  groupRoleIds?: string[] | Error;
}

function sequence<T>(entries: Array<T | Error> | undefined, fallback: () => T) {
  let index = 0;
  return (): T => {
    if (!entries || entries.length === 0) return fallback();
    const entry = entries[Math.min(index, entries.length - 1)];
    index += 1;
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

// The read-back compares content keys; tests use the story's JSON, which is
// what a test thread's `contentKey` is built from.
const contentKeyOf = (story: unknown) => JSON.stringify(story);

function makeDeps(options: MakeDepsOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    authenticateApps: [] as PostAuthApp[][],
    getCurrentUserId: 0,
    now: 0,
    buildImageVerse: [] as string[],
    probeMedia: [] as string[],
    addReaction: [] as PostReactionInput[],
    removeReaction: [] as PostReactionRemoveInput[],
    deletePost: [] as PostDeleteInput[],
    editPost: [] as PostEditInput[],
    sendPost: [] as PostSendInput[],
    sendReply: [] as PostReplyInput[],
    getChannelPosts: [] as PostLookupQuery[],
    getChannelState: [] as string[],
    getGroupRoleIds: [] as string[],
    assertCanAdminister: [] as Array<[string, string]>,
    getPostWithReplies: [] as PostThreadQuery[],
    deleteReply: [] as ReplyDeleteInput[],
    setOrder: [] as Array<[string, string[]]>,
    sleep: [] as number[],
    order: [] as string[],
  };
  const nextChannelState = sequence<ChannelState>(
    options.channelStates,
    () => ({ joined: true, groupId: '~host/group', order: [] })
  );
  const nextThread = sequence<ExistingThread>(options.threads, () => {
    throw new Error('no thread');
  });

  const deps: PostsDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async (apps) => {
      calls.authenticate += 1;
      calls.authenticateApps.push(apps);
      calls.order.push('authenticate');
      await options.authenticate?.(apps);
    },
    getCurrentUserId: () => {
      calls.getCurrentUserId += 1;
      calls.order.push('getCurrentUserId');
      return options.currentUserId ?? '~zod';
    },
    now: () => {
      calls.now += 1;
      calls.order.push('now');
      return options.now ?? 1700000000000;
    },
    buildImageVerse: async (url) => {
      calls.buildImageVerse.push(url);
      calls.order.push('buildImageVerse');
      if (options.buildImageVerse) return options.buildImageVerse(url);
      return IMAGE_VERSE;
    },
    probeMedia: async (url) => {
      calls.probeMedia.push(url);
      calls.order.push('probeMedia');
      if (options.probeMedia) return options.probeMedia(url);
      return { size: -1 };
    },
    postsApi: {
      addReaction: async (input) => {
        calls.addReaction.push(input);
        calls.order.push('addReaction');
        await options.addReaction?.(input);
      },
      removeReaction: async (input) => {
        calls.removeReaction.push(input);
        calls.order.push('removeReaction');
        await options.removeReaction?.(input);
      },
      deletePost: async (input) => {
        calls.deletePost.push(input);
        calls.order.push('deletePost');
        await options.deletePost?.(input);
      },
      editPost: async (input) => {
        calls.editPost.push(input);
        calls.order.push('editPost');
        await options.editPost?.(input);
      },
      sendPost: async (input) => {
        calls.sendPost.push(input);
        calls.order.push('sendPost');
        await options.sendPost?.(input);
      },
      sendReply: async (input) => {
        calls.sendReply.push(input);
        calls.order.push('sendReply');
        await options.sendReply?.(input);
      },
      getChannelPosts: async (query) => {
        calls.getChannelPosts.push(query);
        calls.order.push('getChannelPosts');
        return (await options.getChannelPosts?.(query)) ?? { posts: [] };
      },
      getPostWithReplies: async (query) => {
        calls.getPostWithReplies.push(query);
        calls.order.push('getPostWithReplies');
        return nextThread();
      },
      deleteReply: async (input) => {
        calls.deleteReply.push(input);
        calls.order.push('deleteReply');
        await options.deleteReply?.(input);
      },
      setOrder: async (channelId, order) => {
        calls.setOrder.push([channelId, order]);
        calls.order.push('setOrder');
        await options.setOrder?.(channelId, order);
      },
    },
    getChannelState: async (nest) => {
      calls.getChannelState.push(nest);
      calls.order.push('getChannelState');
      return nextChannelState();
    },
    getGroupRoleIds: async (groupId) => {
      calls.getGroupRoleIds.push(groupId);
      calls.order.push('getGroupRoleIds');
      if (options.groupRoleIds instanceof Error) throw options.groupRoleIds;
      return options.groupRoleIds ?? [];
    },
    assertCanAdminister: async (groupId, action, nest) => {
      calls.assertCanAdminister.push([groupId, action]);
      calls.order.push('assertCanAdminister');
      await options.assertCanAdminister?.(groupId, action, nest);
    },
    contentKeyOf,
    // Lookups and read-backs sleep between attempts; tests record, not wait.
    sleep: async (ms) => {
      calls.sleep.push(ms);
    },
  };

  return {
    deps,
    calls,
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

function expectNoAuthOrApi(context: ReturnType<typeof makeDeps>) {
  expect(context.calls.authenticate).toBe(0);
  expect(context.calls.getCurrentUserId).toBe(0);
  expect(context.calls.addReaction).toEqual([]);
  expect(context.calls.removeReaction).toEqual([]);
  expect(context.calls.deletePost).toEqual([]);
  expect(context.calls.editPost).toEqual([]);
  expect(context.calls.sendPost).toEqual([]);
  expect(context.calls.sendReply).toEqual([]);
  expect(context.calls.getChannelPosts).toEqual([]);
  expect(context.calls.buildImageVerse).toEqual([]);
  expect(context.calls.probeMedia).toEqual([]);
  expect(context.calls.getChannelState).toEqual([]);
  expect(context.calls.getGroupRoleIds).toEqual([]);
  expect(context.calls.assertCanAdminister).toEqual([]);
  expect(context.calls.getPostWithReplies).toEqual([]);
  expect(context.calls.deleteReply).toEqual([]);
  expect(context.calls.setOrder).toEqual([]);
}

describe('posts command help and shell', () => {
  it('prints family help for posts --help and -h without auth/API work', async () => {
    for (const flag of ['--help', '-h']) {
      const context = makeDeps();
      const exitCode = await run([flag], context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${POSTS_HELP}\n`);
      expect(context.stderr()).toBe('');
      expectNoAuthOrApi(context);
    }
  });

  it('prints per-subcommand help for help tokens after the subcommand', async () => {
    const cases = [
      { args: ['send', '--help'], help: POSTS_COMMAND_HELP.send },
      { args: ['reply', '-h'], help: POSTS_COMMAND_HELP.reply },
      { args: ['react', '--help'], help: POSTS_COMMAND_HELP.react },
      { args: ['unreact', '-h'], help: POSTS_COMMAND_HELP.unreact },
      { args: ['delete', '--help'], help: POSTS_COMMAND_HELP.delete },
      { args: ['edit', '--help'], help: POSTS_COMMAND_HELP.edit },
      {
        args: ['unreact', 'chat/~host/channel', '--help'],
        help: POSTS_COMMAND_HELP.unreact,
      },
    ];

    for (const testCase of cases) {
      const context = makeDeps();
      const exitCode = await run(testCase.args, context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${testCase.help}\n`);
      expect(context.stderr()).toBe('');
      expectNoAuthOrApi(context);
    }
  });

  it('prints family help for unknown subcommands with a help token', async () => {
    const context = makeDeps();
    const exitCode = await run(['bogus', '--help'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(`${POSTS_HELP}\n`);
    expect(context.stderr()).toBe('');
    expectNoAuthOrApi(context);
  });

  it('documents the gallery-only send title option', () => {
    expect(POSTS_HELP).toContain('--title <text>');
    expect(POSTS_COMMAND_HELP.send).toContain('--title <text>');
    expect(POSTS_HELP).toContain('heap/~host/gallery');
  });

  it('returns a family usage error for bare posts without auth/API work', async () => {
    const context = makeDeps();
    const exitCode = await run([], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_HELP}\n`);
    expectNoAuthOrApi(context);
  });

  it('returns a family usage error for unknown subcommands without auth/API work', async () => {
    const context = makeDeps();
    const exitCode = await run(['bogus'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_HELP}\n`);
    expectNoAuthOrApi(context);
  });
});

describe('posts send', () => {
  it('fails missing channel/message before auth or API work', async () => {
    for (const args of [['send'], ['send', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('rejects a malformed --image flag before auth', async () => {
    const missingValue = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', 'hi', '--image'],
        missingValue.deps
      )
    ).toBe(1);
    expect(missingValue.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);
    expectNoAuthOrApi(missingValue);

    const invalidScheme = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', '--image', 'ftp://x/y.png'],
        invalidScheme.deps
      )
    ).toBe(1);
    expect(invalidScheme.stderr()).toBe(
      'Error: Invalid media URL — pass a public https URL. If this is a local ' +
        'file, upload it first (e.g. `tlon upload <path>`) and resend with the ' +
        'returned https URL.\n'
    );
    expectNoAuthOrApi(invalidScheme);

    // The outbound-media contract classifies each rejected shape separately;
    // every one of them fails before auth and before any network call.
    const plainHttp = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', '--image', 'http://x/y.png'],
        plainHttp.deps
      )
    ).toBe(1);
    expect(plainHttp.stderr()).toBe(
      'Error: Only https media URLs are supported.\n'
    );
    expectNoAuthOrApi(plainHttp);

    const localPath = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', '--image', '/pier/generated.png'],
        localPath.deps
      )
    ).toBe(1);
    expect(localPath.stderr()).toBe(
      'Error: Local file paths are not supported for --image — upload the file ' +
        'first (e.g. `tlon upload <path>`) and pass the returned https URL.\n'
    );
    expectNoAuthOrApi(localPath);

    const userinfo = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', '--image', 'https://u:p@x/y.png'],
        userinfo.deps
      )
    ).toBe(1);
    expect(userinfo.stderr()).toBe(
      'Error: Media URLs with embedded credentials are not supported.\n'
    );
    expectNoAuthOrApi(userinfo);
  });

  it('rejects a malformed --blob flag before auth', async () => {
    const missingValue = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', 'hi', '--blob'],
        missingValue.deps
      )
    ).toBe(1);
    expect(missingValue.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);

    const nonArray = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', 'hi', '--blob', '{"a":1}'],
        nonArray.deps
      )
    ).toBe(1);
    expect(nonArray.stderr()).toBe(
      'Error: --blob must be a JSON array of post-blob entries\n'
    );
    expectNoAuthOrApi(nonArray);
  });

  it('sends a plain message and authenticates against channels', async () => {
    const context = makeDeps({ currentUserId: '~nec', now: 42 });
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'Hello', 'there'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(
      '✓ Message sent\n  Share: the host assigns the post ID, so none is returned here; find its ID with `messages channel chat/~host/channel --limit 5`, then put /1/chan/chat/~host/channel/msg/<id> in your reply to post a tappable card.\n'
    );
    expect(context.stderr()).toBe('');
    expect(context.calls.authenticateApps).toEqual([['channels']]);
    expect(context.calls.sendPost).toEqual([
      {
        channelId: 'chat/~host/channel',
        authorId: '~nec',
        sentAt: 42,
        content: [{ inline: ['Hello there'] }],
        blob: undefined,
      },
    ]);
  });

  it('sends a markdown list as a listing block', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '- a\n- b'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [{ item: ['a'] }, { item: ['b'] }],
            },
          },
        },
      },
    ]);
  });

  it('sends a ship mention with its ~ sigil', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'hi ~sampel-palnet'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      { inline: ['hi ', { ship: '~sampel-palnet' }] },
    ]);
  });

  it('fails loudly when the message converts to nothing', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '<div>hello</div>'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('unsupported Markdown');
    expect(context.calls.sendPost).toEqual([]);
  });

  it('fails loudly when the message converts to an empty wrapper shell', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '> [l][i]\n\n[i]: https://x'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('unsupported Markdown');
    expect(context.calls.sendPost).toEqual([]);
  });

  it('fails loudly when the message is a whitespace-labeled link', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '[ ](https://example.com)'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('unsupported Markdown');
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses an image mixed into a text line', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'caption ![alt](https://x/y.png)'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('own line');
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses an image inside header content', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '# head ![a](https://u/i.png)'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('own line');
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a standalone image with a relative target', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '![plot](./plot.png)'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('http(s)');
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a standalone image with a file:// target', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '![plot](file:///tmp/x.png)'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('http(s)');
    expect(context.calls.sendPost).toEqual([]);
  });

  it('still sends a standalone image line as an image block', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '![alt](https://x/y.png)'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      {
        block: {
          image: { src: 'https://x/y.png', alt: 'alt', width: 0, height: 0 },
        },
      },
    ]);
  });

  it('sends a link with a real label', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '[real](https://example.com)'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      { inline: [{ link: { href: 'https://example.com', content: 'real' } }] },
    ]);
  });

  it('still sends a bare horizontal rule with no text leaves', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', '---'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      { block: { rule: null } },
    ]);
  });

  it('authenticates against chat for DM and group-DM targets', async () => {
    for (const target of ['~sampel-palnet', '0v5.abcde']) {
      const context = makeDeps();
      await run(['send', target, 'hi'], context.deps);
      expect(context.calls.authenticateApps).toEqual([['chat']]);
    }
  });

  it('fetches the image after auth and puts the block before the caption', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'caption', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.order).toEqual([
      'authenticate',
      'buildImageVerse',
      'getCurrentUserId',
      'now',
      'sendPost',
    ]);
    expect(context.calls.buildImageVerse).toEqual(['https://x/y.png']);
    expect(context.calls.sendPost[0].content).toEqual([
      IMAGE_VERSE,
      { inline: ['caption'] },
    ]);
  });

  it('sends an image-only post with no caption', async () => {
    const context = makeDeps();
    await run(
      ['send', 'chat/~host/channel', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(context.calls.sendPost[0].content).toEqual([IMAGE_VERSE]);
  });

  it('passes a validated --blob through to the payload as given', async () => {
    // The unknown field is one the schema would strip; validation must not.
    const blob =
      '[{"type":"tlon-context-lens","version":1,"lensId":"L1","extra":true}]';
    const context = makeDeps();
    await run(
      ['send', 'chat/~host/channel', 'hi', '--blob', blob],
      context.deps
    );

    expect(context.calls.sendPost[0].blob).toBe(blob);
  });

  it('passes a gallery title through as post metadata', async () => {
    const context = makeDeps({ currentUserId: '~nec', now: 42 });
    const exitCode = await run(
      [
        'send',
        'heap/~host/gallery',
        'Gallery caption',
        '--title',
        'Gallery title',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost).toEqual([
      {
        channelId: 'heap/~host/gallery',
        authorId: '~nec',
        sentAt: 42,
        content: [{ inline: ['Gallery caption'] }],
        blob: undefined,
        metadata: { title: 'Gallery title' },
      },
    ]);
  });

  it('rejects --title outside gallery nests before auth', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'caption', '--title', 'Chat title'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain(
      '--title is only supported for gallery (heap/) posts'
    );
    expectNoAuthOrApi(context);
  });

  it('rejects a --title flag with no value before auth', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'heap/~host/gallery', 'caption', '--title'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);
    expectNoAuthOrApi(context);
  });

  it('rejects a --title value that is itself an option token before auth', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'heap/~zod/gallery', 'caption', '--title', '--sent-at', '1234'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);
    expectNoAuthOrApi(context);
  });

  it('honors --sent-at over the clock', async () => {
    const context = makeDeps({ now: 999 });
    await run(
      ['send', 'chat/~host/channel', 'hi', '--sent-at', '1234'],
      context.deps
    );
    expect(context.calls.sendPost[0].sentAt).toBe(1234);
    // and it does not leak into the message text
    expect(context.calls.sendPost[0].content).toEqual([{ inline: ['hi'] }]);
  });

  it('rejects a non-positive --sent-at', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'hi', '--sent-at', 'nope'],
      context.deps
    );
    expect(exitCode).toBe(1);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('wraps image fetch failures as a stable command error after auth', async () => {
    const context = makeDeps({
      buildImageVerse: async () => {
        throw new Error('Failed to fetch image: 404');
      },
    });

    const exitCode = await run(
      ['send', 'chat/~host/channel', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      'Error: Failed to fetch image: 404 (--image #1 (x))\n'
    );
    expect(context.stderr()).not.toContain('    at ');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.sendPost).toEqual([]);
  });
});

describe('posts reply', () => {
  it('fails missing args before auth or API work', async () => {
    const cases = [
      ['reply'],
      ['reply', 'chat/~host/channel'],
      ['reply', 'chat/~host/channel', '170.141'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.reply}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('fails a --author flag with no value before auth', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['reply', 'chat/~host/channel', '170.141', 'hi', '--author'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.reply}\n`);
    expectNoAuthOrApi(context);
  });

  it('replies, formatting the parent id and defaulting the parent author', async () => {
    const context = makeDeps({ currentUserId: '~nec', now: 7 });
    const exitCode = await run(
      ['reply', 'chat/~host/channel', '~sampel/170141184', 'Thread', 'reply'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(
      "✓ Reply sent\n  Share: the host assigns the post ID, so none is returned here; find the reply's ID with `messages post chat/~host/channel 170.141.184`, then put /1/chan/chat/~host/channel/msg/170.141.184/<id> in your reply to post a tappable card.\n"
    );
    expect(context.calls.authenticateApps).toEqual([['channels']]);
    expect(context.calls.sendReply).toEqual([
      {
        channelId: 'chat/~host/channel',
        parentId: '170.141.184',
        parentAuthor: '~nec',
        content: [{ inline: ['Thread reply'] }],
        sentAt: 7,
        authorId: '~nec',
      },
    ]);
  });

  it('replies to a gallery post with the exact heap target input', async () => {
    const context = makeDeps({ currentUserId: '~nec', now: 7 });
    const exitCode = await run(
      ['reply', 'heap/~host/gallery', '170141184', 'Gallery comment'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendReply).toEqual([
      {
        channelId: 'heap/~host/gallery',
        parentId: '170.141.184',
        parentAuthor: '~nec',
        content: [{ inline: ['Gallery comment'] }],
        sentAt: 7,
        authorId: '~nec',
      },
    ]);
  });

  it('uses an explicit --author as the parent author', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    await run(
      ['reply', 'chat/~host/channel', '170.141', 'hi', '--author', '~bus'],
      context.deps
    );

    expect(context.calls.sendReply[0].parentAuthor).toBe('~bus');
  });

  it('stamps a validated --blob without folding it into the message', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      [
        'reply',
        'chat/~host/channel',
        '170.141',
        'hello there',
        '--blob',
        '[{"type":"tlon-context-lens","version":1,"lensId":"L1"}]',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendReply[0].content).toEqual([
      { inline: ['hello there'] },
    ]);
    expect(context.calls.sendReply[0].blob).toBe(
      '[{"type":"tlon-context-lens","version":1,"lensId":"L1"}]'
    );
  });

  it('rejects a malformed reply --blob', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['reply', 'chat/~host/channel', '170.141', 'hi', '--blob', '{"a":1}'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.calls.sendReply).toEqual([]);
  });

  it('defaults the parent author to a one-to-one DM target', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    await run(['reply', '~sampel-palnet', '170.141', 'hi'], context.deps);

    expect(context.calls.authenticateApps).toEqual([['chat']]);
    expect(context.calls.sendReply[0].parentAuthor).toBe('~sampel-palnet');
    // DMs have no reference card, so no share hint.
    expect(context.stdout()).toBe('✓ Reply sent\n');
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      sendReply: async () => {
        throw commandError('reply failed');
      },
    });

    const exitCode = await run(
      ['reply', 'chat/~host/channel', '170.141', 'hi'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: reply failed\n');
  });
});

describe('posts bot author flags', () => {
  it('sends with a bare --bot as a bot with an empty profile', async () => {
    const context = makeDeps({ currentUserId: '~bot', now: 42 });
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'beep', '--bot'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost).toEqual([
      {
        channelId: 'chat/~host/channel',
        authorId: '~bot',
        sentAt: 42,
        content: [{ inline: ['beep'] }],
        blob: undefined,
        botProfile: { nickname: null, avatar: null },
      },
    ]);
  });

  it('accepts an option following --bot', async () => {
    const context = makeDeps({ currentUserId: '~bot' });
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'beep', '--bot', '--sent-at', '99'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost).toEqual([
      {
        channelId: 'chat/~host/channel',
        authorId: '~bot',
        sentAt: 99,
        content: [{ inline: ['beep'] }],
        blob: undefined,
        botProfile: { nickname: null, avatar: null },
      },
    ]);
  });

  it('omits botProfile entirely without a bot flag', async () => {
    const context = makeDeps();
    await run(['send', 'chat/~host/channel', 'beep'], context.deps);

    expect('botProfile' in context.calls.sendPost[0]).toBe(false);
  });

  it('replies as a bot', async () => {
    const context = makeDeps({ currentUserId: '~bot', now: 7 });
    const exitCode = await run(
      ['reply', 'chat/~host/channel', '~sampel/170141184', 'boop', '--bot'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendReply).toEqual([
      {
        channelId: 'chat/~host/channel',
        parentId: '170.141.184',
        parentAuthor: '~bot',
        content: [{ inline: ['boop'] }],
        sentAt: 7,
        authorId: '~bot',
        blob: undefined,
        botProfile: { nickname: null, avatar: null },
      },
    ]);
  });

  it('keeps a trailing bot flag out of the message text', async () => {
    const send = makeDeps();
    await run(
      ['send', 'chat/~host/channel', 'hello', 'there', 'friend', '--bot'],
      send.deps
    );
    expect(send.calls.sendPost[0].content).toEqual([
      { inline: ['hello there friend'] },
    ]);

    const reply = makeDeps();
    await run(
      [
        'reply',
        'chat/~host/channel',
        '170.141',
        'hello',
        'there',
        'friend',
        '--bot',
      ],
      reply.deps
    );
    expect(reply.calls.sendReply[0].content).toEqual([
      { inline: ['hello there friend'] },
    ]);
  });

  it('rejects a value on the valueless --bot flag before auth', async () => {
    const cases: [string[], string][] = [
      [
        ['send', 'chat/~host/channel', 'hi', '--bot=Botly'],
        POSTS_COMMAND_HELP.send,
      ],
      [
        ['reply', 'chat/~host/channel', '170.141', 'hi', '--bot=Botly'],
        POSTS_COMMAND_HELP.reply,
      ],
      // The separated form used to parse, and since the flag is a message
      // boundary the post went out truncated with the value discarded.
      [
        ['send', 'chat/~host/channel', 'hello', 'world', '--bot', 'Botly'],
        POSTS_COMMAND_HELP.send,
      ],
      [
        [
          'reply',
          'chat/~host/channel',
          '170.141',
          'hello',
          'world',
          '--bot',
          'Botly',
        ],
        POSTS_COMMAND_HELP.reply,
      ],
    ];

    for (const [args, usage] of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${usage}\n`);
      expectNoAuthOrApi(context);
    }
  });
});

describe('posts react', () => {
  it('fails missing react args before auth or API work', async () => {
    const cases = [
      ['react'],
      ['react', 'chat/~host/channel'],
      ['react', 'chat/~host/channel', '170.141'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_REACT_HELP}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('builds reaction payloads for dotted, undotted, and author-prefixed ids', async () => {
    const cases = [
      { rawPostId: '170.141.184', expectedPostId: '170.141.184' },
      { rawPostId: '170141184', expectedPostId: '170.141.184' },
      { rawPostId: '~sampel/170141184', expectedPostId: '170.141.184' },
    ];

    for (const testCase of cases) {
      const context = makeDeps({ currentUserId: '~bus' });
      const exitCode = await run(
        ['react', 'chat/~host/channel', testCase.rawPostId, '👍'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe('✓ Reaction added\n');
      expect(context.calls.addReaction).toEqual([
        {
          channelId: 'chat/~host/channel',
          postId: testCase.expectedPostId,
          emoji: '👍',
          our: '~bus',
          postAuthor: '~bus',
        },
      ]);
    }
  });

  it('authenticates once before reacting and ignores extra args', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['react', 'chat/~host/channel', '170141184', '🔥', 'ignored'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reaction added\n');
    expect(context.calls.order).toEqual([
      'authenticate',
      'getCurrentUserId',
      'addReaction',
    ]);
    expect(context.calls.addReaction[0]).toMatchObject({
      postId: '170.141.184',
      emoji: '🔥',
      our: '~nec',
      postAuthor: '~nec',
    });
  });

  it('passes --parent through for thread-reply reactions', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['react', 'chat/~host/channel', '170142', '🔥', '--parent', '170141'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.addReaction).toEqual([
      {
        channelId: 'chat/~host/channel',
        postId: '170.142',
        emoji: '🔥',
        our: '~nec',
        postAuthor: '~nec',
        parentId: '170.141',
      },
    ]);
  });

  it('passes a gallery comment reaction parent through exactly', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['react', 'heap/~host/gallery', '170142', '🔥', '--parent', '170141'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.addReaction).toEqual([
      {
        channelId: 'heap/~host/gallery',
        postId: '170.142',
        emoji: '🔥',
        our: '~nec',
        postAuthor: '~nec',
        parentId: '170.141',
      },
    ]);
  });

  it('rejects a --parent value that is itself an option token', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['react', 'chat/~host/channel', '170141', '🔥', '--parent', '--bogus'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.react}\n`);
    expectNoAuthOrApi(context);
  });

  it('rejects a duplicate --parent flag', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      [
        'react',
        'chat/~host/channel',
        '170142',
        '🔥',
        '--parent',
        '170141',
        '--parent',
        '170140',
      ],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.react}\n`);
    expectNoAuthOrApi(context);
  });

  it('rejects an omitted emoji that lets --parent fill the emoji slot', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['react', 'chat/~host/chan', '170.142', '--parent', '170.141'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.react}\n`);
    expectNoAuthOrApi(context);
  });

  it('rejects an unconsumed option token before auth', async () => {
    for (const stray of ['--parent=170141', '--bogus']) {
      const context = makeDeps({ currentUserId: '~nec' });
      const exitCode = await run(
        ['react', 'chat/~host/channel', '170142', '🔥', stray],
        context.deps
      );

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        `Error: Unexpected argument: ${stray}\n\n${POSTS_COMMAND_HELP.react}\n`
      );
      expectNoAuthOrApi(context);
    }
  });
});

describe('posts unreact', () => {
  it('fails missing args before auth or API work', async () => {
    for (const args of [['unreact'], ['unreact', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.unreact}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('removes a reaction with postAuthor set to the current user', async () => {
    const cases = [
      { rawPostId: '170.141.184', expectedPostId: '170.141.184' },
      { rawPostId: '170141184', expectedPostId: '170.141.184' },
      { rawPostId: '~sampel/170141184', expectedPostId: '170.141.184' },
    ];

    for (const testCase of cases) {
      const context = makeDeps({ currentUserId: '~bus' });
      const exitCode = await run(
        ['unreact', 'chat/~host/channel', testCase.rawPostId, 'extra'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe('✓ Reaction removed\n');
      expect(context.stderr()).toBe('');
      expect(context.calls.order).toEqual([
        'authenticate',
        'getCurrentUserId',
        'removeReaction',
      ]);
      expect(context.calls.removeReaction).toEqual([
        {
          channelId: 'chat/~host/channel',
          postId: testCase.expectedPostId,
          our: '~bus',
          postAuthor: '~bus',
        },
      ]);
    }
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      removeReaction: async () => {
        throw commandError('remove failed');
      },
    });

    const exitCode = await run(
      ['unreact', 'chat/~host/channel', '170141184'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: remove failed\n');
  });

  it('passes --parent through for thread-reply reaction removal', async () => {
    const context = makeDeps({ currentUserId: '~bus' });
    const exitCode = await run(
      ['unreact', 'chat/~host/channel', '170142', '--parent', '170141'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.removeReaction).toEqual([
      {
        channelId: 'chat/~host/channel',
        postId: '170.142',
        our: '~bus',
        postAuthor: '~bus',
        parentId: '170.141',
      },
    ]);
  });

  it('rejects a --parent value that is itself an option token', async () => {
    const context = makeDeps({ currentUserId: '~bus' });
    const exitCode = await run(
      ['unreact', 'chat/~host/channel', '170141', '--parent', '--bogus'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.unreact}\n`);
    expectNoAuthOrApi(context);
  });

  it('rejects a duplicate --parent flag', async () => {
    const context = makeDeps({ currentUserId: '~bus' });
    const exitCode = await run(
      [
        'unreact',
        'chat/~host/channel',
        '170142',
        '--parent',
        '170141',
        '--parent',
        '170140',
      ],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.unreact}\n`);
    expectNoAuthOrApi(context);
  });

  it('rejects an omitted id that lets --parent fill the id slot', async () => {
    const context = makeDeps({ currentUserId: '~bus' });
    const exitCode = await run(
      ['unreact', 'chat/~host/chan', '--parent', '170.141'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.unreact}\n`);
    expectNoAuthOrApi(context);
  });

  it('rejects an unconsumed option token before auth', async () => {
    for (const stray of ['--parent=170141', '--bogus']) {
      const context = makeDeps({ currentUserId: '~nec' });
      const exitCode = await run(
        ['unreact', 'chat/~host/channel', '170142', stray],
        context.deps
      );

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        `Error: Unexpected argument: ${stray}\n\n${POSTS_COMMAND_HELP.unreact}\n`
      );
      expectNoAuthOrApi(context);
    }
  });
});

describe('posts delete', () => {
  it('fails missing args before auth or API work', async () => {
    for (const args of [['delete'], ['delete', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.delete}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('deletes a post with the formatted id and current user as author', async () => {
    const cases = [
      { rawPostId: '170.141.184', expectedPostId: '170.141.184' },
      { rawPostId: '170141184', expectedPostId: '170.141.184' },
      { rawPostId: '~sampel/170141184', expectedPostId: '170.141.184' },
    ];

    for (const testCase of cases) {
      const context = makeDeps({ currentUserId: '~nec' });
      const exitCode = await run(
        ['delete', 'chat/~host/channel', testCase.rawPostId, 'ignored'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe('✓ Post deleted\n');
      expect(context.stderr()).toBe('');
      expect(context.calls.order).toEqual([
        'authenticate',
        'getCurrentUserId',
        'deletePost',
      ]);
      expect(context.calls.deletePost).toEqual([
        {
          channelId: 'chat/~host/channel',
          postId: testCase.expectedPostId,
          authorId: '~nec',
        },
      ]);
    }
  });

  it('deletes a gallery post with the exact heap target input', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['delete', 'heap/~host/gallery', '170141184'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.deletePost).toEqual([
      {
        channelId: 'heap/~host/gallery',
        postId: '170.141.184',
        authorId: '~nec',
      },
    ]);
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      deletePost: async () => {
        throw commandError('delete failed');
      },
    });

    const exitCode = await run(
      ['delete', 'chat/~host/channel', '170141184'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: delete failed\n');
  });

  it('rejects an unconsumed option token before auth', async () => {
    for (const stray of ['--parent=170141', '--bogus']) {
      const context = makeDeps({ currentUserId: '~nec' });
      const exitCode = await run(
        ['delete', 'chat/~host/channel', '170142', stray],
        context.deps
      );

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        `Error: Unexpected argument: ${stray}\n\n${POSTS_COMMAND_HELP.delete}\n`
      );
      expectNoAuthOrApi(context);
    }
  });

  it('rejects a stray option after a consumed --parent before auth', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['delete', 'chat/~host/channel', '170142', '--parent', '170141', '--x'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Unexpected argument: --x\n\n${POSTS_COMMAND_HELP.delete}\n`
    );
    expectNoAuthOrApi(context);
  });
});

describe('posts edit', () => {
  const existing: ExistingPost = {
    id: '170.141.184',
    sentAt: 1111,
    title: 'Old Title',
    image: 'https://example.com/old.jpg',
    description: 'old description',
    cover: 'https://example.com/old-cover.jpg',
  };

  function withExistingPost(post: ExistingPost | null) {
    return async (): Promise<PostLookupResult> => ({
      posts: post ? [post] : [],
    });
  }

  // Edits refuse to proceed when the post cannot be read, so tests exercising
  // anything *else* about edit need the lookup to succeed.
  const READABLE_POST: ExistingPost = {
    id: '170.141.184',
    sentAt: 1111,
    isBot: false,
  };
  const lookupSucceeds = () => withExistingPost(READABLE_POST);

  it('fails missing channel/post id before auth or API work', async () => {
    for (const args of [['edit'], ['edit', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.edit}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('requires a message before auth or API work', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.edit}\n`);
    expectNoAuthOrApi(context);
  });

  it('refuses the removed --title/--image/--content flags before auth', async () => {
    const cases = [
      ['edit', 'chat/~host/channel', '170.141', 'Body', '--title', 'T'],
      [
        'edit',
        'chat/~host/channel',
        '170.141',
        'Body',
        '--image',
        'https://x/y.png',
      ],
      ['edit', 'chat/~host/channel', '170.141', '--content', 'article.json'],
      // A help token does not rescue a removed flag — it still refuses.
      ['edit', 'chat/~host/channel', '170.141', '--title', '--help'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain(
        'no longer supports --title/--image/--content'
      );
      expect(context.stderr()).not.toContain('Usage:');
      expectNoAuthOrApi(context);
    }
  });

  it('refuses to erase a post when the message converts to nothing', async () => {
    const context = makeDeps({ getChannelPosts: lookupSucceeds() });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', '<div>hello</div>'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('unsupported Markdown');
    expect(context.calls.editPost).toEqual([]);
  });

  it('refuses to erase a post when the message converts to an empty wrapper shell', async () => {
    const context = makeDeps({ getChannelPosts: withExistingPost(existing) });

    const exitCode = await run(
      [
        'edit',
        'chat/~host/channel',
        '170.141.184',
        '**[label][id]**\n\n[id]: https://example.com',
      ],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('unsupported Markdown');
    expect(context.calls.editPost).toEqual([]);
  });

  it('edits with a markdown message and preserves existing metadata', async () => {
    const context = makeDeps({
      currentUserId: '~nec',
      now: 1234,
      getChannelPosts: withExistingPost(existing),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Updated', 'message'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post edited\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.getChannelPosts).toEqual([
      {
        channelId: 'chat/~host/channel',
        cursor: '170.141.184',
        mode: 'around',
        count: 1,
        includeReplies: false,
      },
    ]);
    expect(context.calls.editPost).toHaveLength(1);
    const payload = context.calls.editPost[0];
    expect(payload.channelId).toBe('chat/~host/channel');
    expect(payload.postId).toBe('170.141.184');
    expect(payload.authorId).toBe('~nec');
    // The existing post's sent time, not the clock: %edit stores it as given.
    expect(payload.sentAt).toBe(1111);
    expect(context.calls.now).toBe(0);
    expect('blob' in payload).toBe(false);
    expect(payload.metadata).toEqual({
      title: 'Old Title',
      image: 'https://example.com/old.jpg',
      description: 'old description',
      cover: 'https://example.com/old-cover.jpg',
    });
    expect(payload.content).toEqual([{ inline: ['Updated message'] }]);
  });

  it('preserves existing metadata as-is without flag overrides', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost(existing),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].metadata).toEqual({
      title: 'Old Title',
      image: 'https://example.com/old.jpg',
      description: 'old description',
      cover: 'https://example.com/old-cover.jpg',
    });
  });

  it('refuses to edit a post it cannot read, rather than wiping it', async () => {
    // %edit submits the whole essay, so editing on a failed lookup silently
    // replaces authorship and metadata with nothing. Retried once, then refused.
    const context = makeDeps({
      getChannelPosts: withExistingPost(null),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.calls.editPost).toHaveLength(0);
    expect(context.calls.getChannelPosts).toHaveLength(2);
    expect(context.stderr()).toContain('may not be readable yet');
  });

  it('refuses the edit when the lookup throws, not just when it misses', async () => {
    // A thrown lookup is indistinguishable from an absent post, and both mean
    // the authorship and metadata to preserve are unknown.
    const context = makeDeps({
      getChannelPosts: async () => {
        throw new Error('lookup boom');
      },
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.calls.editPost).toHaveLength(0);
    expect(context.stderr()).toContain('may not be readable yet');
  });

  // An edit resubmits the whole essay, so the CLI must hand back the existing
  // post's authorship shape or a bot post silently loses its Bot tag.
  it('preserves bot authorship when editing a bot-authored post', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost({ ...existing, isBot: true }),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].botProfile).toEqual({
      nickname: null,
      avatar: null,
    });
  });

  it("carries a bot post's nickname and avatar through the edit unchanged", async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost({
        ...existing,
        isBot: true,
        botProfile: { nickname: 'Botty', avatar: 'https://x.test/botty.png' },
      }),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].botProfile).toEqual({
      nickname: 'Botty',
      avatar: 'https://x.test/botty.png',
    });
  });

  it('leaves a human-authored post bare-authored on edit', async () => {
    for (const post of [
      { ...existing, isBot: false },
      // A record with no isBot at all must not be upgraded either.
      existing,
    ]) {
      const context = makeDeps({ getChannelPosts: withExistingPost(post) });

      const exitCode = await run(
        ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect('botProfile' in context.calls.editPost[0]).toBe(false);
    }
  });

  it('recovers when the post becomes readable on the retry', async () => {
    // The window this retry exists for: %channels proxies the add to the host
    // and the scry only sees it once that returns, so a post created moments
    // ago misses the first look and lands on the second.
    let attempt = 0;
    const context = makeDeps({
      getChannelPosts: async () => {
        attempt += 1;
        return attempt === 1
          ? { posts: [] }
          : {
              posts: [{ id: '170.141.184', sentAt: 1111, isBot: true }],
            };
      },
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.getChannelPosts).toHaveLength(2);
    // And the authorship the retry recovered is the whole point.
    expect(context.calls.editPost[0].botProfile).toEqual({
      nickname: null,
      avatar: null,
    });
  });

  it('treats every token after the post id as the message', async () => {
    const context = makeDeps({ getChannelPosts: lookupSucceeds() });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'keep', 'this', 'message'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].content).toEqual([
      { inline: ['keep this message'] },
    ]);
  });

  it('treats --help in the message slot as edit content reaching the API', async () => {
    const context = makeDeps({ getChannelPosts: lookupSucceeds() });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', '--help'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post edited\n');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.editPost[0].content).toEqual([{ inline: ['--help'] }]);
  });

  it("preserves the existing post's sentAt and blob", async () => {
    const blob = '[{"type":"file","version":1,"fileUri":"https://x/f.pdf"}]';
    const context = makeDeps({
      now: 999,
      getChannelPosts: withExistingPost({ ...existing, sentAt: 111, blob }),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].sentAt).toBe(111);
    expect(context.calls.editPost[0].blob).toBe(blob);
    expect(context.calls.now).toBe(0);
  });

  it('sends no blob when the existing post has none, and never the reply path', async () => {
    for (const post of [existing, { ...existing, blob: null }]) {
      const context = makeDeps({ getChannelPosts: withExistingPost(post) });

      const exitCode = await run(
        ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect('blob' in context.calls.editPost[0]).toBe(false);
      expect('parentId' in context.calls.editPost[0]).toBe(false);
      expect(context.calls.getPostWithReplies).toEqual([]);
    }
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      getChannelPosts: lookupSucceeds(),
      editPost: async () => {
        throw commandError('edit failed');
      },
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: edit failed\n');
  });
});

const NEST = 'chat/~host/channel';
const GROUP = '~host/group';
const X = '170.141.184.507';
const Y = '170.141.184.508';
const Z = '170.141.184.509';
const W = '170.141.184.510';

function joined(order: string[], groupId = GROUP): ChannelState {
  return { joined: true, groupId, order };
}

function topLevel(id = X, over: Partial<ExistingThread> = {}): ExistingThread {
  return { id, authorId: '~host', replies: [], ...over };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('posts pin', () => {
  it('passes the channel nest to the admin check', async () => {
    const seen: string[] = [];
    const context = makeDeps({
      channelStates: [joined([Y, Z]), joined([Y, Z]), joined([X, Y, Z])],
      threads: [topLevel()],
      assertCanAdminister: async (_groupId, _action, nest) => {
        seen.push(nest);
      },
    });

    expect(await run(['pin', 'chat/host/channel', X], context.deps)).toBe(0);
    expect(seen).toEqual([NEST]);
  });

  it('pins after the admin check, a target read and a fresh read, keeping the old pin second', async () => {
    const context = makeDeps({
      channelStates: [joined([Y, Z]), joined([Y, Z]), joined([X, Y, Z])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post pinned\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.order).toEqual([
      'authenticate',
      'getChannelState',
      'assertCanAdminister',
      'getPostWithReplies',
      'getChannelState',
      'setOrder',
      'getChannelState',
    ]);
    expect(context.calls.authenticateApps).toEqual([['channels']]);
    expect(context.calls.assertCanAdminister).toEqual([[GROUP, 'pin posts']]);
    expect(context.calls.getPostWithReplies).toEqual([
      { channelId: NEST, postId: X },
    ]);
    expect(context.calls.setOrder).toEqual([[NEST, [X, Y, Z]]]);
    expect(context.calls.sleep).toEqual([]);
  });

  it('writes [X] as the first pin in a channel with an empty order', async () => {
    const context = makeDeps({
      channelStates: [joined([]), joined([]), joined([X])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post pinned\n');
    expect(context.calls.setOrder).toEqual([[NEST, [X]]]);
  });

  it('moves an already-arranged post to the front without duplicating it', async () => {
    const context = makeDeps({
      channelStates: [joined([Y, X, Z]), joined([Y, X, Z]), joined([X, Y, Z])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.setOrder).toEqual([[NEST, [X, Y, Z]]]);
  });

  it('succeeds without a write when the post is already pinned, after the admin check', async () => {
    const context = makeDeps({
      channelStates: [joined([X, Y]), joined([X, Y])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post already pinned\n');
    expect(context.calls.assertCanAdminister).toEqual([[GROUP, 'pin posts']]);
    expect(context.calls.setOrder).toEqual([]);
  });

  it('composes the write from the fresh read, not the first snapshot', async () => {
    const context = makeDeps({
      channelStates: [joined([Y]), joined([W, Y]), joined([X, W, Y])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.setOrder).toEqual([[NEST, [X, W, Y]]]);
  });

  it('decides "already pinned" on the fresh read, not the first snapshot', async () => {
    const context = makeDeps({
      channelStates: [joined([X]), joined([Y]), joined([X, Y])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post pinned\n');
    expect(context.calls.setOrder).toEqual([[NEST, [X, Y]]]);
  });

  it('refuses when the channel was left or re-grouped while checking', async () => {
    for (const fresh of [
      { joined: false } as ChannelState,
      joined([Y], '~other/group'),
    ]) {
      const context = makeDeps({
        channelStates: [joined([Y]), fresh],
        threads: [topLevel()],
      });

      const exitCode = await run(['pin', NEST, X], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stderr()).toBe(
        `Error: Channel state for ${NEST} changed while checking; nothing changed. Retry.\n`
      );
      expect(context.calls.setOrder).toEqual([]);
    }
  });

  it('reports a non-admin refusal with no target read and no write', async () => {
    const context = makeDeps({
      channelStates: [joined([Y])],
      assertCanAdminister: async () => {
        throw commandError(
          "Can't pin posts in ~host/group: you (~zod) are not an admin of this group."
        );
      },
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain(
      "Can't pin posts in ~host/group: you (~zod) are not an admin"
    );
    expect(context.calls.getPostWithReplies).toEqual([]);
    expect(context.calls.setOrder).toEqual([]);
  });

  it('reports a silent host rejection as unconfirmed after five read-backs and four sleeps', async () => {
    const context = makeDeps({
      channelStates: [joined([Y])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Pin of ${X} in ${NEST} was sent but is not confirmed: the channel order is now [${Y}], expected [${X}, ${Y}]. The channel host may have refused it, or another change landed at the same time.\n`
    );
    expect(context.calls.setOrder).toEqual([[NEST, [X, Y]]]);
    // 2 reads before the write, 5 after.
    expect(context.calls.getChannelState).toHaveLength(7);
    expect(context.calls.sleep).toEqual([500, 500, 500, 500]);
  });

  it('confirms when the host update arrives on a later read-back', async () => {
    const context = makeDeps({
      channelStates: [joined([Y]), joined([Y]), joined([Y]), joined([X, Y])],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post pinned\n');
    expect(context.calls.sleep).toEqual([500]);
  });

  it('never confirms on a read error, an unjoined channel or a partial order', async () => {
    const cases: Array<{ readBack: ChannelState | Error; observed: string }> = [
      {
        readBack: new Error('scry 500'),
        observed: 'unreadable, expected',
      },
      {
        readBack: { joined: false },
        observed: 'unreadable (the channel is not joined)',
      },
      { readBack: joined([X]), observed: `[${X}], expected` },
    ];
    for (const { readBack, observed } of cases) {
      const context = makeDeps({
        channelStates: [joined([Y]), joined([Y]), readBack],
        threads: [topLevel()],
      });

      const exitCode = await run(['pin', NEST, X], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain('was sent but is not confirmed');
      expect(context.stderr()).toContain(observed);
      if (readBack instanceof Error) {
        expect(context.stderr()).toContain('(last read error: scry 500)');
      } else {
        expect(context.stderr()).not.toContain('last read error');
      }
    }
  });

  it('does not confirm the exact order read back under a different group', async () => {
    const context = makeDeps({
      channelStates: [joined([Y]), joined([Y]), joined([X, Y], '~other/group')],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain(
      `the channel order is now [${X}, ${Y}] under group ~other/group`
    );
  });

  it('surfaces a setOrder failure without reading back', async () => {
    const context = makeDeps({
      channelStates: [joined([Y])],
      threads: [topLevel()],
      setOrder: async () => {
        throw commandError('poke failed');
      },
    });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: poke failed\n');
    expect(context.calls.getChannelState).toHaveLength(2);
  });

  it('refuses an unjoined channel before the admin check', async () => {
    const context = makeDeps({ channelStates: [{ joined: false }] });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(
      `Error: ${NEST} is not a channel this ship has joined; join it first.\n`
    );
    expect(context.calls.assertCanAdminister).toEqual([]);
  });

  it('reports a failed channel-state read', async () => {
    const context = makeDeps({ channelStates: [new Error('scry 500')] });

    const exitCode = await run(['pin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not read channel state for ${NEST}: scry 500\n`
    );
  });

  it('refuses a target it cannot read, or a deleted one, without writing', async () => {
    for (const threads of [
      [new Error('not found')],
      [topLevel(X, { isDeleted: true })],
    ]) {
      const context = makeDeps({ channelStates: [joined([Y])], threads });

      const exitCode = await run(['pin', NEST, X], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stderr()).toBe(
        `Error: Could not read post ${X} in ${NEST}; only an existing top-level post can be pinned.\n`
      );
      expect(context.calls.setOrder).toEqual([]);
    }
    // An unreadable target is looked up twice, with one retry delay.
    const missing = makeDeps({
      channelStates: [joined([Y])],
      threads: [new Error('not found')],
    });
    await run(['pin', NEST, X], missing.deps);
    expect(missing.calls.getPostWithReplies).toHaveLength(2);
    expect(missing.calls.sleep).toEqual([1500]);
  });

  it('canonicalizes undotted scry ids before comparing and writing', async () => {
    const undotted = (id: string) => id.replace(/\./g, '');
    const context = makeDeps({
      channelStates: [
        joined([undotted(Y), undotted(X)]),
        joined([undotted(Y), undotted(X)]),
        joined([undotted(X), undotted(Y)]),
      ],
      threads: [topLevel()],
    });

    const exitCode = await run(['pin', NEST, undotted(X)], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.getPostWithReplies).toEqual([
      { channelId: NEST, postId: X },
    ]);
    expect(context.calls.setOrder).toEqual([[NEST, [X, Y]]]);
  });

  it('does not write until the admin check resolves', async () => {
    const gate = deferred();
    const context = makeDeps({
      channelStates: [joined([Y]), joined([Y]), joined([X, Y])],
      threads: [topLevel()],
      assertCanAdminister: () => gate.promise,
    });

    const pending = run(['pin', NEST, X], context.deps);
    await Bun.sleep(5);
    expect(context.calls.order.at(-1)).toBe('assertCanAdminister');
    expect(context.calls.setOrder).toEqual([]);
    gate.resolve();

    expect(await pending).toBe(0);
    expect(context.calls.setOrder).toEqual([[NEST, [X, Y]]]);
  });

  it('prints no confirmation until the read-back resolves', async () => {
    const gate = deferred();
    const context = makeDeps({
      channelStates: [joined([Y]), joined([Y]), joined([X, Y])],
      threads: [topLevel()],
    });
    const read = context.deps.getChannelState;
    context.deps.getChannelState = async (nest) => {
      if (context.calls.setOrder.length > 0) await gate.promise;
      return read(nest);
    };

    let settled = false;
    const pending = run(['pin', NEST, X], context.deps).finally(() => {
      settled = true;
    });
    await Bun.sleep(5);
    expect(context.calls.setOrder).toHaveLength(1);
    expect(context.stdout()).toBe('');
    expect(settled).toBe(false);
    gate.resolve();

    expect(await pending).toBe(0);
    expect(context.stdout()).toBe('✓ Post pinned\n');
  });
});

describe('posts unpin', () => {
  it('drops the pin and names the post that resurfaces', async () => {
    const context = makeDeps({
      channelStates: [joined([X, Y]), joined([X, Y]), joined([Y])],
    });

    const exitCode = await run(['unpin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(`✓ Post unpinned\n  Now pinned: ${Y}\n`);
    expect(context.calls.order).toEqual([
      'authenticate',
      'getChannelState',
      'assertCanAdminister',
      'getChannelState',
      'setOrder',
      'getChannelState',
    ]);
    expect(context.calls.assertCanAdminister).toEqual([[GROUP, 'unpin posts']]);
    expect(context.calls.setOrder).toEqual([[NEST, [Y]]]);
    expect(context.calls.getPostWithReplies).toEqual([]);
  });

  it('prints no "Now pinned" line when nothing resurfaces', async () => {
    const context = makeDeps({
      channelStates: [joined([X]), joined([X]), joined([])],
    });

    const exitCode = await run(['unpin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post unpinned\n');
    expect(context.calls.setOrder).toEqual([[NEST, []]]);
  });

  it('refuses when nothing or another post is pinned, without writing', async () => {
    const cases: Array<[string[], string]> = [
      [
        [],
        `Post ${X} is not pinned in ${NEST}: nothing is pinned. Nothing changed.`,
      ],
      [[Y, X], `Post ${X} is not pinned in ${NEST}: ${Y} is. Nothing changed.`],
    ];
    for (const [order, message] of cases) {
      const context = makeDeps({ channelStates: [joined(order)] });

      const exitCode = await run(['unpin', NEST, X], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stderr()).toBe(`Error: ${message}\n`);
      expect(context.calls.setOrder).toEqual([]);
    }
  });

  it('reports a rejected unpin as unconfirmed when another post still leads', async () => {
    const context = makeDeps({
      channelStates: [joined([X, Y]), joined([X, Y]), joined([Y, X])],
    });

    const exitCode = await run(['unpin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain(
      `Unpin of ${X} in ${NEST} was sent but is not confirmed: the channel order is now [${Y}, ${X}], expected [${Y}]`
    );
    expect(context.calls.sleep).toEqual([500, 500, 500, 500]);
  });

  it('decides on the fresh read, not the first snapshot', async () => {
    const context = makeDeps({
      channelStates: [joined([X, Y]), joined([Y, X])],
    });

    const exitCode = await run(['unpin', NEST, X], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain(`${Y} is. Nothing changed.`);
    expect(context.calls.setOrder).toEqual([]);
  });

  it('confirms a delayed exact state', async () => {
    const context = makeDeps({
      channelStates: [
        joined([X, Y]),
        joined([X, Y]),
        joined([X, Y]),
        joined([Y]),
      ],
    });

    const exitCode = await run(['unpin', NEST, X], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.sleep).toEqual([500]);
  });
});

describe('posts pin and thread-reply targets', () => {
  const P = '170.141.184.500';
  const R = '170.141.184.501';

  it('refuses DM targets before auth', async () => {
    for (const target of ['~bus', '0v1.abc']) {
      const cases: Array<[string[], string]> = [
        [
          ['pin', target, X],
          `Pins are for group channels (chat/ or heap/); ${target} is a DM.`,
        ],
        [
          ['unpin', target, X],
          `Pins are for group channels (chat/ or heap/); ${target} is a DM.`,
        ],
        [
          ['edit', target, R, 'text', '--parent', P],
          `Editing or deleting a thread reply is supported in group channels only; ${target} is a DM.`,
        ],
        [
          ['delete', target, R, '--parent', P],
          `Editing or deleting a thread reply is supported in group channels only; ${target} is a DM.`,
        ],
      ];
      for (const [args, message] of cases) {
        const context = makeDeps();
        const exitCode = await run(args, context.deps);

        expect(exitCode).toBe(1);
        expect(context.stdout()).toBe('');
        expect(context.stderr()).toBe(`Error: ${message}\n`);
        expectNoAuthOrApi(context);
      }
    }
  });

  it('refuses non-group nests before auth, keeping the diary and notes messages', async () => {
    for (const target of ['buckets/~host/files', 'chat/~host']) {
      const cases: Array<[string[], string]> = [
        [
          ['pin', target, X],
          `Pins are for group chat/ and heap/ channels; ${target} is not one.`,
        ],
        [
          ['unpin', target, X],
          `Pins are for group chat/ and heap/ channels; ${target} is not one.`,
        ],
        [
          ['edit', target, R, 'text', '--parent', P],
          `Thread replies can be edited or deleted only in group chat/ and heap/ channels; ${target} is not one.`,
        ],
        [
          ['delete', target, R, '--parent', P],
          `Thread replies can be edited or deleted only in group chat/ and heap/ channels; ${target} is not one.`,
        ],
      ];
      for (const [args, message] of cases) {
        const context = makeDeps();
        const exitCode = await run(args, context.deps);

        expect(exitCode).toBe(1);
        expect(context.stderr()).toBe(`Error: ${message}\n`);
        expectNoAuthOrApi(context);
      }
    }
    for (const [nest, message] of [
      ['diary/~host/blog', DIARY_REMOVED],
      ['notes/~host/blog', NOTES_CHANNEL_CONTENT_UNSUPPORTED],
    ]) {
      for (const args of [
        ['pin', nest, X],
        ['unpin', nest, X],
        ['edit', nest, R, 'text', '--parent', P],
        ['delete', nest, R, '--parent', P],
      ]) {
        const context = makeDeps();
        const exitCode = await run(args, context.deps);

        expect(exitCode).toBe(1);
        expect(context.stderr()).toBe(`Error: ${message}\n`);
        expectNoAuthOrApi(context);
      }
    }
  });

  it('rejects malformed pin, edit --parent and delete --parent invocations before auth', async () => {
    const cases: Array<[string[], string]> = [
      [['pin', NEST], POSTS_COMMAND_HELP.pin],
      [['unpin', NEST], POSTS_COMMAND_HELP.unpin],
      [['pin', NEST, '--x'], POSTS_COMMAND_HELP.pin],
      [['pin', '--x', X], POSTS_COMMAND_HELP.pin],
      [['edit', NEST, R, 'text', '--parent'], POSTS_COMMAND_HELP.edit],
      [
        ['edit', NEST, R, 'text', '--parent', P, '--parent', P],
        POSTS_COMMAND_HELP.edit,
      ],
      [['edit', NEST, R, 'text', '--parent', '--x'], POSTS_COMMAND_HELP.edit],
      [['edit', NEST, '--parent', P, 'text'], POSTS_COMMAND_HELP.edit],
      [['edit', NEST, R, '--parent', P], POSTS_COMMAND_HELP.edit],
      [['delete', NEST, '--parent', P], POSTS_COMMAND_HELP.delete],
      [['delete', NEST, R, '--parent'], POSTS_COMMAND_HELP.delete],
    ];
    for (const [args, help] of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${help}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('rejects an extra pin/unpin token, including --parent, before auth', async () => {
    for (const command of ['pin', 'unpin'] as const) {
      for (const extra of ['more', '--parent']) {
        const context = makeDeps();
        const exitCode = await run([command, NEST, X, extra, P], context.deps);

        expect(exitCode).toBe(1);
        expect(context.stderr()).toBe(
          `Error: Unexpected argument: ${extra}\n\n${POSTS_COMMAND_HELP[command]}\n`
        );
        expectNoAuthOrApi(context);
      }
    }
  });

  it('canonicalizes a host without ~ for pin and edit --parent', async () => {
    const pin = makeDeps({
      channelStates: [joined([]), joined([]), joined([X])],
      threads: [topLevel()],
    });
    expect(await run(['pin', 'chat/host/channel', X], pin.deps)).toBe(0);
    expect(pin.calls.getChannelState).toEqual([NEST, NEST, NEST]);
    expect(pin.calls.getPostWithReplies[0].channelId).toBe(NEST);
    expect(pin.calls.setOrder[0][0]).toBe(NEST);

    const original: ExistingReply = {
      id: R,
      authorId: '~zod',
      sentAt: 1,
      contentKey: '[]',
    };
    const edited = {
      ...original,
      contentKey: contentKeyOf([{ inline: ['t'] }]),
    };
    const edit = makeDeps({
      threads: [
        { id: P, authorId: '~host', replies: [original] },
        { id: P, authorId: '~host', replies: [edited] },
      ],
    });
    expect(
      await run(['edit', 'chat/host/channel', R, 't', '--parent', P], edit.deps)
    ).toBe(0);
    expect(edit.calls.getPostWithReplies.map((q) => q.channelId)).toEqual([
      NEST,
      NEST,
    ]);
    expect(edit.calls.editPost[0].channelId).toBe(NEST);
  });
});

describe('posts edit --parent (thread reply)', () => {
  const P = '170.141.184.500';
  const R = '170.141.184.501';
  const OLD_KEY = contentKeyOf([{ inline: ['old text'] }]);
  const NEW_KEY = contentKeyOf([{ inline: ['new text'] }]);

  function reply(over: Partial<ExistingReply> = {}): ExistingReply {
    return {
      id: R,
      authorId: '~zod',
      sentAt: 4242,
      contentKey: OLD_KEY,
      ...over,
    };
  }

  function thread(...replies: ExistingReply[]): ExistingThread {
    return { id: P, authorId: '~host', replies };
  }

  it('edits the reply under its parent, preserving sentAt and blob, then confirms', async () => {
    const original = reply({ blob: '[{"type":"x"}]' });
    const context = makeDeps({
      now: 999,
      threads: [thread(original), thread({ ...original, contentKey: NEW_KEY })],
    });

    const exitCode = await run(
      ['edit', NEST, R, 'new', 'text', '--parent', P],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reply edited\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.getPostWithReplies).toEqual([
      { channelId: NEST, postId: P },
      { channelId: NEST, postId: P },
    ]);
    expect(context.calls.editPost).toEqual([
      {
        channelId: NEST,
        postId: R,
        parentId: P,
        authorId: '~zod',
        sentAt: 4242,
        content: [{ inline: ['new text'] }],
        blob: '[{"type":"x"}]',
      },
    ]);
    expect(context.calls.now).toBe(0);
    expect(context.calls.getChannelPosts).toEqual([]);
    expect(context.calls.assertCanAdminister).toEqual([]);
  });

  it('keeps --parent out of the text wherever it appears', async () => {
    const context = makeDeps({
      threads: [thread(reply()), thread(reply({ contentKey: NEW_KEY }))],
    });

    const exitCode = await run(
      ['edit', NEST, R, '--parent', P, 'new', 'text'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].content).toEqual([
      { inline: ['new text'] },
    ]);
  });

  it('keeps the Bot tag on a bot reply and invents none on a human reply', async () => {
    const bot = makeDeps({
      threads: [
        thread(reply({ isBot: true })),
        thread(reply({ isBot: true, contentKey: NEW_KEY })),
      ],
    });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], bot.deps)
    ).toBe(0);
    expect(bot.calls.editPost[0].botProfile).toEqual({
      nickname: null,
      avatar: null,
    });

    const human = makeDeps({
      threads: [thread(reply()), thread(reply({ contentKey: NEW_KEY }))],
    });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], human.deps)
    ).toBe(0);
    expect('botProfile' in human.calls.editPost[0]).toBe(false);
    expect('blob' in human.calls.editPost[0]).toBe(false);
    expect('metadata' in human.calls.editPost[0]).toBe(false);
  });

  it("carries a bot reply's nickname and avatar through the edit unchanged", async () => {
    const profile = { nickname: 'Botty', avatar: 'https://x.test/botty.png' };
    const context = makeDeps({
      threads: [
        thread(reply({ isBot: true, botProfile: profile })),
        thread(
          reply({ isBot: true, botProfile: profile, contentKey: NEW_KEY })
        ),
      ],
    });

    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], context.deps)
    ).toBe(0);
    expect(context.calls.editPost[0].botProfile).toEqual(profile);
  });

  it("refuses to edit another author's reply, and normalizes ship names", async () => {
    const other = makeDeps({ threads: [thread(reply({ authorId: '~nec' }))] });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], other.deps)
    ).toBe(1);
    expect(other.stderr()).toBe(
      `Error: Can't edit reply ${R} in ${NEST}: it was written by ~nec, not this ship (~zod). Only a reply's author can edit it.\n`
    );
    expect(other.calls.editPost).toEqual([]);

    const own = makeDeps({
      currentUserId: '~zod',
      threads: [
        thread(reply({ authorId: 'zod' })),
        thread(reply({ authorId: 'zod', contentKey: NEW_KEY })),
      ],
    });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], own.deps)
    ).toBe(0);
  });

  it('retries a missing reply once, then refuses; a reply found on the retry proceeds', async () => {
    const missing = makeDeps({ threads: [thread()] });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], missing.deps)
    ).toBe(1);
    expect(missing.stderr()).toBe(
      `Error: Could not read reply ${R} under ${P} in ${NEST} to preserve its authorship; it may not be readable yet. Retry the edit.\n`
    );
    expect(missing.calls.getPostWithReplies).toHaveLength(2);
    expect(missing.calls.sleep).toEqual([1500]);
    expect(missing.calls.editPost).toEqual([]);

    const late = makeDeps({
      threads: [
        thread(),
        thread(reply()),
        thread(reply({ contentKey: NEW_KEY })),
      ],
    });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], late.deps)
    ).toBe(0);
    expect(late.calls.editPost).toHaveLength(1);
  });

  it('refuses to edit a deleted reply', async () => {
    const context = makeDeps({ threads: [thread(reply({ isDeleted: true }))] });

    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], context.deps)
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Reply ${R} in ${NEST} is deleted; nothing to edit.\n`
    );
    expect(context.calls.editPost).toEqual([]);
  });

  it('reports a silently rejected edit as unconfirmed, mentioning hooks', async () => {
    const context = makeDeps({ threads: [thread(reply())] });

    const exitCode = await run(
      ['edit', NEST, R, 'new text', '--parent', P],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Edit of reply ${R} in ${NEST} was sent but is not confirmed: the reply does not show the new content. The channel host may have refused it (for example, this ship may no longer be allowed to write in the channel), or a channel hook may have accepted it but transformed the content.\n`
    );
    expect(context.calls.editPost).toHaveLength(1);
    expect(context.calls.getPostWithReplies).toHaveLength(6);
    expect(context.calls.sleep).toEqual([500, 500, 500, 500]);
  });

  it('never confirms on a read error or a reply that turned into a tombstone', async () => {
    const failing = makeDeps({
      threads: [thread(reply()), new Error('scry 500')],
    });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], failing.deps)
    ).toBe(1);
    expect(failing.stderr()).toContain(
      'not confirmed: the thread could not be read back (scry 500)'
    );

    const deleted = makeDeps({
      threads: [thread(reply()), thread(reply({ isDeleted: true }))],
    });
    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], deleted.deps)
    ).toBe(1);
    expect(deleted.stderr()).toContain(
      'not confirmed: the reply is now deleted'
    );
  });

  it('does not confirm matching content when a preserved field changed', async () => {
    const original = reply({
      blob: 'b1',
      isBot: true,
      botProfile: { nickname: 'Botty', avatar: null },
    });
    const cases: Array<[Partial<ExistingReply>, string]> = [
      [{ sentAt: 1 }, "the reply's sent time changed"],
      [{ blob: 'b2' }, "the reply's attachment data changed"],
      [{ blob: null }, "the reply's attachment data changed"],
      [{ isBot: false }, "the reply's Bot authorship changed"],
      [
        { botProfile: { nickname: 'Other', avatar: null } },
        "the reply's bot nickname or avatar changed",
      ],
      [
        { botProfile: { nickname: 'Botty', avatar: 'https://x.test/b.png' } },
        "the reply's bot nickname or avatar changed",
      ],
    ];
    for (const [change, reason] of cases) {
      const context = makeDeps({
        threads: [
          thread(original),
          thread({ ...original, contentKey: NEW_KEY, ...change }),
        ],
      });

      expect(
        await run(['edit', NEST, R, 'new text', '--parent', P], context.deps)
      ).toBe(1);
      expect(context.stderr()).toContain(`not confirmed: ${reason}`);
    }
  });

  it('confirms once a later read-back shows the edit', async () => {
    const context = makeDeps({
      threads: [
        thread(reply()),
        thread(reply()),
        new Error('blip'),
        thread(reply({ contentKey: NEW_KEY })),
      ],
    });

    expect(
      await run(['edit', NEST, R, 'new text', '--parent', P], context.deps)
    ).toBe(0);
    expect(context.calls.getPostWithReplies).toHaveLength(4);
    expect(context.calls.sleep).toEqual([500, 500]);
  });

  it('formats undotted parent and reply ids', async () => {
    const context = makeDeps({
      threads: [thread(reply()), thread(reply({ contentKey: NEW_KEY }))],
    });

    expect(
      await run(
        ['edit', NEST, '170141184501', 'new text', '--parent', '170141184500'],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.getPostWithReplies[0].postId).toBe(P);
    expect(context.calls.editPost[0].postId).toBe(R);
    expect(context.calls.editPost[0].parentId).toBe(P);
  });
});

describe('posts delete --parent (thread reply)', () => {
  const P = '170.141.184.500';
  const R = '170.141.184.501';

  function reply(over: Partial<ExistingReply> = {}): ExistingReply {
    return { id: R, authorId: '~zod', sentAt: 4242, contentKey: '[]', ...over };
  }

  function thread(...replies: ExistingReply[]): ExistingThread {
    return { id: P, authorId: '~host', replies };
  }

  it('deletes its own reply under the parent and confirms the tombstone', async () => {
    const context = makeDeps({
      threads: [thread(reply()), thread(reply({ isDeleted: true }))],
    });

    const exitCode = await run(
      ['delete', NEST, R, '--parent', P],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reply deleted\n');
    expect(context.calls.deleteReply).toEqual([
      {
        channelId: NEST,
        parentId: P,
        parentAuthorId: '~host',
        postId: R,
        authorId: '~zod',
      },
    ]);
    expect(context.calls.deletePost).toEqual([]);
    expect(context.calls.assertCanAdminister).toEqual([]);
    expect(context.calls.getChannelState).toEqual([]);
  });

  it("checks admin before deleting another member's reply", async () => {
    const context = makeDeps({
      channelStates: [joined([])],
      threads: [
        thread(reply({ authorId: '~nec' })),
        thread(reply({ authorId: '~nec', isDeleted: true })),
      ],
    });

    const exitCode = await run(
      ['delete', NEST, R, '--parent', P],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.order).toEqual([
      'authenticate',
      'getPostWithReplies',
      'getCurrentUserId',
      'getChannelState',
      'assertCanAdminister',
      'deleteReply',
      'getPostWithReplies',
    ]);
    expect(context.calls.assertCanAdminister).toEqual([
      [GROUP, "delete other members' replies"],
    ]);
    expect(context.calls.deleteReply[0].authorId).toBe('~nec');
  });

  it("refuses another member's reply when not an admin or not joined", async () => {
    const nonAdmin = makeDeps({
      channelStates: [joined([])],
      threads: [thread(reply({ authorId: '~nec' }))],
      assertCanAdminister: async () => {
        throw commandError(
          "Can't delete other members' replies in ~host/group"
        );
      },
    });
    expect(await run(['delete', NEST, R, '--parent', P], nonAdmin.deps)).toBe(
      1
    );
    expect(nonAdmin.stderr()).toContain("Can't delete other members' replies");
    expect(nonAdmin.calls.deleteReply).toEqual([]);

    const unjoined = makeDeps({
      channelStates: [{ joined: false }],
      threads: [thread(reply({ authorId: '~nec' }))],
    });
    expect(await run(['delete', NEST, R, '--parent', P], unjoined.deps)).toBe(
      1
    );
    expect(unjoined.stderr()).toContain(
      'is not a channel this ship has joined'
    );
    expect(unjoined.calls.assertCanAdminister).toEqual([]);
    expect(unjoined.calls.deleteReply).toEqual([]);
  });

  it('refuses an unreadable reply instead of reporting a false success', async () => {
    const context = makeDeps({ threads: [thread()] });

    const exitCode = await run(
      ['delete', NEST, R, '--parent', P],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Could not read reply ${R} under ${P} in ${NEST}; nothing was deleted.\n`
    );
    expect(context.calls.deleteReply).toEqual([]);
    expect(context.calls.deletePost).toEqual([]);
  });

  it('reports an already-deleted reply without writing', async () => {
    const context = makeDeps({ threads: [thread(reply({ isDeleted: true }))] });

    const exitCode = await run(
      ['delete', NEST, R, '--parent', P],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reply already deleted\n');
    expect(context.calls.deleteReply).toEqual([]);
  });

  it('reports a silently rejected delete as unconfirmed', async () => {
    const context = makeDeps({ threads: [thread(reply())] });

    const exitCode = await run(
      ['delete', NEST, R, '--parent', P],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Delete of reply ${R} in ${NEST} was sent but is not confirmed: the reply is still live. The channel host may have refused it.\n`
    );
    expect(context.calls.getPostWithReplies).toHaveLength(6);
    expect(context.calls.sleep).toEqual([500, 500, 500, 500]);
  });

  it('never treats a vanished reply or a read error as deleted', async () => {
    for (const [readBack, reason] of [
      [thread(), 'the reply is no longer listed in the thread'],
      [new Error('scry 500'), 'the thread could not be read back (scry 500)'],
    ] as const) {
      const context = makeDeps({ threads: [thread(reply()), readBack] });

      expect(await run(['delete', NEST, R, '--parent', P], context.deps)).toBe(
        1
      );
      expect(context.stderr()).toContain(`not confirmed: ${reason}`);
    }
  });

  it('confirms a tombstone that appears on a later read-back', async () => {
    const context = makeDeps({
      threads: [
        thread(reply()),
        thread(reply()),
        thread(reply({ isDeleted: true })),
      ],
    });

    expect(await run(['delete', NEST, R, '--parent', P], context.deps)).toBe(0);
    expect(context.calls.sleep).toEqual([500]);
  });

  it('surfaces a deleteReply failure without reading back', async () => {
    const context = makeDeps({
      threads: [thread(reply())],
      deleteReply: async () => {
        throw commandError('poke failed');
      },
    });

    expect(await run(['delete', NEST, R, '--parent', P], context.deps)).toBe(1);
    expect(context.stderr()).toBe('Error: poke failed\n');
    expect(context.calls.getPostWithReplies).toHaveLength(1);
  });

  it('keeps delete without --parent on the top-level path', async () => {
    const context = makeDeps();

    expect(await run(['delete', NEST, R], context.deps)).toBe(0);
    expect(context.stdout()).toBe('✓ Post deleted\n');
    expect(context.calls.deletePost).toHaveLength(1);
    expect(context.calls.getPostWithReplies).toEqual([]);
    expect(context.calls.deleteReply).toEqual([]);
  });

  it("does not delete another member's reply until the admin check resolves", async () => {
    const gate = deferred();
    const context = makeDeps({
      channelStates: [joined([])],
      threads: [
        thread(reply({ authorId: '~nec' })),
        thread(reply({ authorId: '~nec', isDeleted: true })),
      ],
      assertCanAdminister: () => gate.promise,
    });

    const pending = run(['delete', NEST, R, '--parent', P], context.deps);
    await Bun.sleep(5);
    expect(context.calls.order.at(-1)).toBe('assertCanAdminister');
    expect(context.calls.deleteReply).toEqual([]);
    gate.resolve();

    expect(await pending).toBe(0);
    expect(context.calls.deleteReply).toHaveLength(1);
  });

  it('prints no confirmation until the tombstone read-back resolves', async () => {
    const gate = deferred();
    const context = makeDeps({
      threads: [thread(reply()), thread(reply({ isDeleted: true }))],
    });
    const read = context.deps.postsApi.getPostWithReplies;
    context.deps.postsApi.getPostWithReplies = async (query) => {
      if (context.calls.deleteReply.length > 0) await gate.promise;
      return read(query);
    };

    let settled = false;
    const pending = run(
      ['delete', NEST, R, '--parent', P],
      context.deps
    ).finally(() => {
      settled = true;
    });
    await Bun.sleep(5);
    expect(context.calls.deleteReply).toHaveLength(1);
    expect(context.stdout()).toBe('');
    expect(settled).toBe(false);
    gate.resolve();

    expect(await pending).toBe(0);
    expect(context.stdout()).toBe('✓ Reply deleted\n');
  });
});

describe('posts diary nest refusal', () => {
  const cases: Array<[string, string[]]> = [
    ['send', ['send', 'diary/~host/blog', 'hi']],
    ['reply', ['reply', 'diary/~host/blog', '170.141', 'hi']],
    ['react', ['react', 'diary/~host/blog', '170.141', '👍']],
    ['unreact', ['unreact', 'diary/~host/blog', '170.141']],
    ['delete', ['delete', 'diary/~host/blog', '170.141']],
    ['edit', ['edit', 'diary/~host/blog', '170.141', 'Body']],
    // A diary nest with an *incidental* arg problem still refuses with
    // DIARY_REMOVED — the diary check precedes per-subcommand validation.
    ['react missing emoji', ['react', 'diary/~host/blog', '170.141']],
    [
      'edit removed flag',
      ['edit', 'diary/~host/blog', '170.141', '--title', 'T'],
    ],
  ];

  for (const [name, args] of cases) {
    it(`refuses a diary nest on ${name} before auth or API work`, async () => {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`Error: ${DIARY_REMOVED}\n`);
      expectNoAuthOrApi(context);
    });
  }
});

describe('posts notes nest refusal', () => {
  const cases: Array<[string, string[]]> = [
    ['send', ['send', 'notes/~host/blog', 'hi']],
    ['reply', ['reply', 'notes/~host/blog', '170.141', 'hi']],
    ['react', ['react', 'notes/~host/blog', '170.141', '👍']],
    ['unreact', ['unreact', 'notes/~host/blog', '170.141']],
    ['delete', ['delete', 'notes/~host/blog', '170.141']],
    ['edit', ['edit', 'notes/~host/blog', '170.141', 'Body']],
    // Match diary behavior: the notes-target refusal wins over incidental arg
    // validation errors on the same command.
    ['react missing emoji', ['react', 'notes/~host/blog', '170.141']],
  ];

  for (const [name, args] of cases) {
    it(`refuses a notes nest on ${name} before auth or API work`, async () => {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        `Error: ${NOTES_CHANNEL_CONTENT_UNSUPPORTED}\n`
      );
      expectNoAuthOrApi(context);
    });
  }
});

describe('posts unexpected errors', () => {
  it('leaves unexpected exceptions for the adapter formatter', async () => {
    const context = makeDeps({
      addReaction: async () => {
        throw new Error('unexpected reaction failure');
      },
    });

    await expect(
      run(['react', 'chat/~host/channel', '170141184', '👍'], context.deps)
    ).rejects.toThrow('unexpected reaction failure');

    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('');
  });
});

// Quote and forward tests assert the PostSendInput/PostReplyInput handed to the
// api; the poke envelope around them is built by the shared @tloncorp/api
// sendPost/sendReply, which the app also calls.
const SRC = 'chat/~nec/general';
const S = '170.141.184.507.208.218.934.405.025.845.542.912.000';
const S_UD = '170141184507208218934405025845542912000';
const R = '170.141.184.507.208.300.000.000.000.000.000.000.000';
const R_UD = '170141184507208300000000000000000000000';
const TEAM = 'chat/~zod/team';
const P = '170.141.184.507.300.000.000.000.000.000.000.000.000';
const P_UD = '170141184507300000000000000000000000000';
const SENT = 1700000000000;
const NEW_ID = '170.141.184.507.400.000.000.000.000.000.000.000.000';
const NEW_UD = '170141184507400000000000000000000000000';
const CITE = {
  block: { cite: { chan: { nest: SRC, where: `/msg/${S_UD}` } } },
};
const CITER = {
  block: { cite: { chan: { nest: SRC, where: `/msg/${S_UD}/${R_UD}` } } },
};
const DM_TIME = dmWritTime(SENT);

function source(over: Partial<ExistingThread> = {}): ExistingThread {
  return { id: S, authorId: '~nec', replies: [], ...over };
}

function sourceReply(over: Partial<ExistingReply> = {}): ExistingReply {
  return { id: R, authorId: '~nec', sentAt: 1, contentKey: '', ...over };
}

// What the read-back finds for a post this ship just sent with `content`.
function sentPost(content: unknown, over: Partial<ExistingPost> = {}) {
  return {
    id: NEW_ID,
    authorId: '~zod',
    sentAt: SENT,
    contentKey: contentKeyOf(content),
    ...over,
  };
}

function sentReply(content: unknown, over: Partial<ExistingReply> = {}) {
  return {
    id: NEW_ID,
    authorId: '~zod',
    sentAt: SENT,
    contentKey: contentKeyOf(content),
    ...over,
  };
}

function channelReadBack(...posts: ExistingPost[]) {
  return async () => ({ posts });
}

// The caption of a quote goes through the same mention parsing as a plain
// send, checked against the target's group, not the source's.
describe('posts quote mentions', () => {
  const SOURCE_GROUP = '~nec/source-group';
  const TARGET_GROUP = '~zod/target-group';
  // Reads in order: the target (role check), the source, the target again.
  const channelStates = [
    { joined: true, groupId: TARGET_GROUP, order: [] },
    { joined: true, groupId: SOURCE_GROUP, order: [] },
    { joined: true, groupId: TARGET_GROUP, order: [] },
  ];
  const content = [CITE, { inline: ['hi ', { sect: 'admin' }] }];

  const cases = [
    {
      name: 'send',
      args: (caption: string) => ['send', TEAM, caption, '--quote', SRC, S],
      stdout: `✓ Message sent\n  Ref: /1/chan/${TEAM}/msg/${NEW_UD}\n`,
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost(content)),
      sent: (context: ReturnType<typeof makeDeps>) =>
        context.calls.sendPost.map((input) => input.content),
    },
    {
      name: 'reply',
      args: (caption: string) => ['reply', TEAM, P, caption, '--quote', SRC, S],
      stdout: `✓ Reply sent\n  Ref: /1/chan/${TEAM}/msg/${P_UD}/${NEW_UD}\n`,
      threads: [
        source(),
        { id: P, authorId: '~zod', replies: [sentReply(content)] },
      ],
      getChannelPosts: undefined,
      sent: (context: ReturnType<typeof makeDeps>) =>
        context.calls.sendReply.map((input) => input.content),
    },
  ];

  for (const c of cases) {
    it(`${c.name} --quote parses a target-group role in the caption`, async () => {
      const context = makeDeps({
        channelStates,
        threads: c.threads,
        getChannelPosts: c.getChannelPosts,
        groupRoleIds: ['admin'],
      });

      const exitCode = await run(c.args('hi @admin'), context.deps);

      expect(exitCode).toBe(0);
      expect(context.stderr()).toBe('');
      expect(context.stdout()).toBe(c.stdout);
      expect(c.sent(context)).toEqual([content]);
      expect(context.calls.getChannelState).toEqual([TEAM, SRC, TEAM]);
      expect(context.calls.getGroupRoleIds).toEqual([TARGET_GROUP]);
    });

    it(`${c.name} --quote refuses an unknown role before reading the source`, async () => {
      const context = makeDeps({
        channelStates,
        threads: c.threads,
        groupRoleIds: ['admin'],
      });

      const exitCode = await run(c.args('hi @nope'), context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain(
        `Unknown role mention @nope in ${TEAM}. Role ids in group ${TARGET_GROUP}: @admin;`
      );
      expect(context.calls.getGroupRoleIds).toEqual([TARGET_GROUP]);
      expect(context.calls.getPostWithReplies).toEqual([]);
      expect(context.calls.sendPost).toEqual([]);
      expect(context.calls.sendReply).toEqual([]);
    });
  }
});

describe('posts quote', () => {
  it('quotes a chat post before the text in a chat send', async () => {
    const content = [CITE, { inline: ['Look at this'] }];
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });

    const exitCode = await run(
      ['send', TEAM, 'Look at this', '--quote', SRC, S],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stderr()).toBe('');
    expect(context.stdout()).toBe(
      `✓ Message sent\n  Ref: /1/chan/${TEAM}/msg/${NEW_UD}\n`
    );
    expect(context.calls.authenticateApps).toEqual([['channels']]);
    expect(context.calls.getChannelState).toEqual([SRC, TEAM]);
    expect(context.calls.getPostWithReplies).toEqual([
      { channelId: SRC, postId: S },
    ]);
    expect(context.calls.sendPost).toEqual([
      {
        channelId: TEAM,
        authorId: '~zod',
        sentAt: SENT,
        content,
        blob: undefined,
      },
    ]);
    expect(context.calls.getChannelPosts).toEqual([
      { channelId: TEAM, mode: 'newest', count: 20, includeReplies: false },
    ]);
  });

  it('quotes a reply source with /msg/<parent>/<reply> before the text in a thread reply', async () => {
    const content = [CITER, { inline: ['Agreed'] }];
    const context = makeDeps({
      threads: [
        source({ replies: [sourceReply()] }),
        { id: P, authorId: '~zod', replies: [sentReply(content)] },
      ],
    });

    const exitCode = await run(
      ['reply', TEAM, P, 'Agreed', '--quote', SRC, R, '--quote-parent', S],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stderr()).toBe('');
    expect(context.stdout()).toBe(
      `✓ Reply sent\n  Ref: /1/chan/${TEAM}/msg/${P_UD}/${NEW_UD}\n`
    );
    expect(context.calls.sendReply).toEqual([
      {
        channelId: TEAM,
        parentId: P,
        parentAuthor: '~zod',
        content,
        sentAt: SENT,
        authorId: '~zod',
        blob: undefined,
      },
    ]);
    expect(context.calls.getPostWithReplies).toEqual([
      { channelId: SRC, postId: S },
      { channelId: TEAM, postId: P },
    ]);
  });

  it('puts the cite after the text in a gallery send', async () => {
    const gallery = 'heap/~zod/gallery';
    const content = [{ inline: ['Worth a look'] }, CITE];
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });

    const exitCode = await run(
      ['send', gallery, 'Worth a look', '--quote', SRC, S],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual(content);
    expect(context.stdout()).toBe(
      `✓ Message sent\n  Ref: /1/chan/${gallery}/msg/${NEW_UD}\n`
    );
  });

  it('quotes a heap post, and leads with the cite in a thread reply to a gallery post', async () => {
    const gallerySrc = 'heap/~nec/pics';
    const cite = {
      block: { cite: { chan: { nest: gallerySrc, where: `/msg/${S_UD}` } } },
    };
    const content = [cite, { inline: ['nice'] }];
    const context = makeDeps({
      threads: [
        source(),
        { id: P, authorId: '~zod', replies: [sentReply(content)] },
      ],
    });

    const exitCode = await run(
      ['reply', 'heap/~zod/gallery', P, 'nice', '--quote', gallerySrc, S],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendReply[0].content).toEqual(content);
  });

  it('puts the cite after the text in a DM send and confirms by the deterministic id', async () => {
    const content = [{ inline: ['x'] }, CITE];
    const context = makeDeps({
      threads: [
        source(),
        {
          id: DM_TIME,
          authorId: '~zod',
          contentKey: contentKeyOf(content),
          replies: [],
        },
      ],
    });

    const exitCode = await run(
      ['send', '~bus', 'x', '--quote', SRC, S],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stderr()).toBe('');
    expect(context.stdout()).toBe(`✓ Message sent\n  ID: ~zod/${DM_TIME}\n`);
    expect(context.calls.authenticateApps).toEqual([['chat', 'channels']]);
    // Only the source is a channel; a DM target has no joined state.
    expect(context.calls.getChannelState).toEqual([SRC]);
    expect(context.calls.sendPost[0]).toMatchObject({
      channelId: '~bus',
      content,
    });
    expect(context.calls.getPostWithReplies[1]).toEqual({
      channelId: '~bus',
      postId: DM_TIME,
      authorId: '~zod',
    });
  });

  it('sends a quote with no message', async () => {
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost([CITE])),
    });

    const exitCode = await run(['send', TEAM, '--quote', SRC, S], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([CITE]);
  });

  it('uses undotted ids in the cite whether typed dotted or not', async () => {
    for (const id of [S, S_UD]) {
      const context = makeDeps({
        threads: [source()],
        getChannelPosts: channelReadBack(sentPost([CITE])),
      });

      expect(await run(['send', TEAM, '--quote', SRC, id], context.deps)).toBe(
        0
      );
      const cite = context.calls.sendPost[0].content[0] as typeof CITE;
      expect(cite.block.cite.chan.where).toMatch(/^\/msg\/\d+$/);
      expect(cite.block.cite.chan.where).toBe(`/msg/${S_UD}`);
      // The source read takes the dotted form either way.
      expect(context.calls.getPostWithReplies[0].postId).toBe(S);
    }
  });

  it('canonicalizes a host without ~ in the cite nest and the target', async () => {
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost([CITE])),
    });

    expect(
      await run(
        ['send', 'chat/zod/team', '--quote', 'chat/nec/general', S],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.getChannelState).toEqual([SRC, TEAM]);
    expect(context.calls.sendPost[0]).toMatchObject({
      channelId: TEAM,
      content: [CITE],
    });
  });

  it('passes the other send options through with a quote', async () => {
    const content = [{ inline: ['caption'] }, CITE];
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });

    const exitCode = await run(
      [
        'send',
        'heap/~zod/gallery',
        'caption',
        '--title',
        'T',
        '--quote',
        SRC,
        S,
        '--blob',
        '[]',
        '--sent-at',
        String(SENT),
        '--bot',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost).toEqual([
      {
        channelId: 'heap/~zod/gallery',
        authorId: '~zod',
        sentAt: SENT,
        content,
        blob: '[]',
        metadata: { title: 'T' },
        botProfile: { nickname: null, avatar: null },
      },
    ]);
    expect(context.calls.now).toBe(0);
  });

  it('sends a message that is only --help before --quote as literal text', async () => {
    const content = [CITE, { inline: ['--help'] }];
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });

    expect(
      await run(['send', TEAM, '--help', '--quote', SRC, S], context.deps)
    ).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual(content);
  });
});

describe('posts quote source validation', () => {
  it('refuses an unreadable source after one retry; a deleted post is unreadable', async () => {
    const context = makeDeps({ threads: [new Error('scry 404')] });

    expect(
      await run(['send', TEAM, 'x', '--quote', SRC, S], context.deps)
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not read post ${S} in ${SRC}; nothing was sent.\n`
    );
    expect(context.calls.getPostWithReplies).toHaveLength(2);
    expect(context.calls.sleep).toEqual([1500]);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a source read as a tombstone', async () => {
    const context = makeDeps({ threads: [source({ isDeleted: true })] });

    expect(
      await run(['send', TEAM, 'x', '--quote', SRC, S], context.deps)
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Post ${S} in ${SRC} is deleted; nothing was sent.\n`
    );
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a deleted reply source', async () => {
    const context = makeDeps({
      threads: [source({ replies: [sourceReply({ isDeleted: true })] })],
    });

    expect(
      await run(
        ['send', TEAM, 'x', '--quote', SRC, R, '--quote-parent', S],
        context.deps
      )
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Reply ${R} in ${SRC} is deleted; nothing was sent.\n`
    );
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a reply source missing from its thread after one retry', async () => {
    const context = makeDeps({ threads: [source()] });

    expect(
      await run(
        ['send', TEAM, 'x', '--quote', SRC, R, '--quote-parent', S],
        context.deps
      )
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not read reply ${R} under ${S} in ${SRC}; nothing was sent.\n`
    );
    expect(context.calls.sleep).toEqual([1500]);
  });

  it('refuses a source in a channel this ship has not joined, before reading it', async () => {
    const context = makeDeps({ channelStates: [{ joined: false }] });

    expect(
      await run(['send', TEAM, 'x', '--quote', SRC, S], context.deps)
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: ${SRC} is not a channel this ship has joined; join it first.\n`
    );
    expect(context.calls.getPostWithReplies).toEqual([]);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('reports a failed channel-state read', async () => {
    const context = makeDeps({ channelStates: [new Error('scry failed')] });

    expect(
      await run(['send', TEAM, 'x', '--quote', SRC, S], context.deps)
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not read channel state for ${SRC}: scry failed\n`
    );
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a channel target that is not joined, without sending', async () => {
    const context = makeDeps({
      threads: [source()],
      channelStates: [
        { joined: true, groupId: '~nec/g', order: [] },
        { joined: false },
      ],
    });

    expect(
      await run(['send', TEAM, 'x', '--quote', SRC, S], context.deps)
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: ${TEAM} is not a channel this ship has joined; join it first.\n`
    );
    expect(context.calls.sendPost).toEqual([]);
  });
});

describe('posts quote from a DM', () => {
  const DM_SRC_ID = '170.141.184.507.500.000.000.000.000.000.000.000.000';

  function dmSource(over: Partial<ExistingThread> = {}): ExistingThread {
    return {
      id: DM_SRC_ID,
      authorId: '~bus',
      quoteText: 'line one\nline two',
      replies: [],
      ...over,
    };
  }

  it('quotes a DM source as a first-line blockquote and no cite', async () => {
    const content = [
      { inline: [{ blockquote: ['line one'] }] },
      { inline: ['+1'] },
    ];
    const context = makeDeps({
      threads: [dmSource()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });

    const exitCode = await run(
      ['send', TEAM, '+1', '--quote', '~bus', `~bus/${DM_SRC_ID}`],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual(content);
    expect(context.calls.authenticateApps).toEqual([['channels', 'chat']]);
    // A DM has no joined state; only the target channel is checked.
    expect(context.calls.getChannelState).toEqual([TEAM]);
    expect(context.calls.getPostWithReplies[0]).toEqual({
      channelId: '~bus',
      postId: DM_SRC_ID,
      authorId: '~bus',
    });
  });

  it('quotes a DM post into another DM', async () => {
    const content = [
      { inline: [{ blockquote: ['line one'] }] },
      { inline: ['fyi'] },
    ];
    const context = makeDeps({
      threads: [
        dmSource(),
        {
          id: DM_TIME,
          authorId: '~zod',
          contentKey: contentKeyOf(content),
          replies: [],
        },
      ],
    });

    expect(
      await run(
        ['send', '~nec', 'fyi', '--quote', '~bus', `~bus/${DM_SRC_ID}`],
        context.deps
      )
    ).toBe(0);
    expect(context.stdout()).toBe(`✓ Message sent\n  ID: ~zod/${DM_TIME}\n`);
    expect(context.calls.authenticateApps).toEqual([['chat']]);
    expect(context.calls.getChannelState).toEqual([]);
    expect(context.calls.sendPost[0]).toMatchObject({
      channelId: '~nec',
      content,
    });
  });

  it('leads with the DM quote in a gallery send', async () => {
    const content = [
      { inline: [{ blockquote: ['line one'] }] },
      { inline: ['caption'] },
    ];
    const context = makeDeps({
      threads: [dmSource()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });

    expect(
      await run(
        ['send', 'heap/~zod/gallery', 'caption', '--quote', '~bus', DM_SRC_ID],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual(content);
  });

  it('tries the DM peer, then us, for a bare DM id; a failed read only moves on', async () => {
    const content = [{ inline: [{ blockquote: ['line one'] }] }];
    const context = makeDeps({
      // The peer read rejects (a scry miss), ours succeeds.
      threads: [new Error('scry 404'), dmSource({ authorId: '~zod' })],
      getChannelPosts: channelReadBack(sentPost(content)),
    });

    expect(
      await run(['send', TEAM, '--quote', '~bus', DM_SRC_ID], context.deps)
    ).toBe(0);
    expect(context.calls.getPostWithReplies).toEqual([
      { channelId: '~bus', postId: DM_SRC_ID, authorId: '~bus' },
      { channelId: '~bus', postId: DM_SRC_ID, authorId: '~zod' },
    ]);
    expect(context.calls.sleep).toEqual([]);
  });

  it('tries only us for a bare group-DM id, and the named author for ~author/<id>', async () => {
    const content = [{ inline: [{ blockquote: ['line one'] }] }];
    const bare = makeDeps({
      threads: [dmSource()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });
    expect(
      await run(['send', TEAM, '--quote', '0v4.abc', DM_SRC_ID], bare.deps)
    ).toBe(0);
    expect(bare.calls.getPostWithReplies[0]).toEqual({
      channelId: '0v4.abc',
      postId: DM_SRC_ID,
      authorId: '~zod',
    });

    const named = makeDeps({
      threads: [dmSource()],
      getChannelPosts: channelReadBack(sentPost(content)),
    });
    expect(
      await run(
        ['send', TEAM, '--quote', '0v4.abc', `~nec/${DM_SRC_ID}`],
        named.deps
      )
    ).toBe(0);
    expect(named.calls.getPostWithReplies[0]).toEqual({
      channelId: '0v4.abc',
      postId: DM_SRC_ID,
      authorId: '~nec',
    });
  });

  it('refuses an unreadable DM source after every author and one retry', async () => {
    const context = makeDeps({ threads: [new Error('scry 404')] });

    expect(
      await run(['send', TEAM, 'x', '--quote', '~bus', DM_SRC_ID], context.deps)
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not read post ${DM_SRC_ID} in ~bus; nothing was sent.\n`
    );
    expect(context.calls.getPostWithReplies).toHaveLength(4);
    expect(context.calls.sleep).toEqual([1500]);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('names the author form for an unreadable group-DM source', async () => {
    const context = makeDeps({ threads: [new Error('scry 404')] });

    expect(
      await run(
        ['send', TEAM, 'x', '--quote', '0v4.abc', DM_SRC_ID],
        context.deps
      )
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not read post ${DM_SRC_ID} in 0v4.abc; nothing was sent. Another member's post in a group DM needs its author: ~author/${DM_SRC_ID}.\n`
    );
    expect(context.calls.getPostWithReplies).toHaveLength(2);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a DM source with no text, or a deleted one', async () => {
    for (const [thread, message] of [
      [
        dmSource({ quoteText: '' }),
        `Post ${DM_SRC_ID} in ~bus has no text to quote; nothing was sent.`,
      ],
      [
        dmSource({ quoteText: '\n' }),
        `Post ${DM_SRC_ID} in ~bus has no text to quote; nothing was sent.`,
      ],
      [
        dmSource({ isDeleted: true }),
        `Post ${DM_SRC_ID} in ~bus is deleted; nothing was sent.`,
      ],
    ] as const) {
      const context = makeDeps({ threads: [thread] });
      expect(
        await run(
          ['send', TEAM, 'x', '--quote', '~bus', DM_SRC_ID],
          context.deps
        )
      ).toBe(1);
      expect(context.stderr()).toBe(`Error: ${message}\n`);
      expect(context.calls.sendPost).toEqual([]);
    }
  });

  it('refuses --quote-parent with a DM source before auth', async () => {
    const context = makeDeps();

    expect(
      await run(
        ['send', TEAM, 'x', '--quote', '~bus', DM_SRC_ID, '--quote-parent', S],
        context.deps
      )
    ).toBe(1);
    expect(context.stderr()).toBe(
      'Error: --quote-parent is for thread replies in group channels; ~bus is a DM.\n'
    );
    expectNoAuthOrApi(context);
  });
});

describe('posts quote to DM targets', () => {
  it('replies in a DM thread, reading back under the parent author', async () => {
    const content = [CITE, { inline: ['ok'] }];
    const context = makeDeps({
      threads: [
        source(),
        { id: P, authorId: '~bus', replies: [sentReply(content)] },
      ],
    });

    const exitCode = await run(
      ['reply', '~bus', P, 'ok', '--quote', SRC, S],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(`✓ Reply sent\n  ID: ~zod/${DM_TIME}\n`);
    expect(context.calls.sendReply[0]).toMatchObject({
      channelId: '~bus',
      parentAuthor: '~bus',
      content,
    });
    expect(context.calls.getPostWithReplies[1]).toEqual({
      channelId: '~bus',
      postId: P,
      authorId: '~bus',
    });
  });

  it('replies in a group-DM thread with an explicit parent author', async () => {
    const content = [CITE, { inline: ['ok'] }];
    const context = makeDeps({
      threads: [
        source(),
        { id: P, authorId: '~nec', replies: [sentReply(content)] },
      ],
    });

    expect(
      await run(
        ['reply', '0v4.abc', P, 'ok', '--author', '~nec', '--quote', SRC, S],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.sendReply[0].parentAuthor).toBe('~nec');
    expect(context.calls.getPostWithReplies[1]).toEqual({
      channelId: '0v4.abc',
      postId: P,
      authorId: '~nec',
    });
  });

  it('names the DM thread check, with its parent author, when unconfirmed', async () => {
    const context = makeDeps({
      threads: [source(), { id: P, authorId: '~nec', replies: [] }],
    });

    expect(
      await run(
        ['reply', '0v4.abc', P, 'ok', '--author', '~nec', '--quote', SRC, S],
        context.deps
      )
    ).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Reply to 0v4.abc was sent but is not confirmed: no reply by ~zod with this sent time is in the thread yet. It may still arrive. Do not send it again; check first with \`messages post 0v4.abc ${P} --author ~nec\`\n`
    );
  });
});

describe('posts forward', () => {
  it('forwards a chat post as a cite-only post', async () => {
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost([CITE])),
    });

    const exitCode = await run(['forward', SRC, S, TEAM], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stderr()).toBe('');
    expect(context.stdout()).toBe(
      `✓ Post forwarded\n  Ref: /1/chan/${TEAM}/msg/${NEW_UD}\n`
    );
    expect(context.calls.authenticateApps).toEqual([['channels']]);
    expect(context.calls.getChannelState).toEqual([SRC, TEAM]);
    expect(context.calls.sendPost).toEqual([
      { channelId: TEAM, authorId: '~zod', sentAt: SENT, content: [CITE] },
    ]);
    for (const key of ['metadata', 'blob', 'botProfile']) {
      expect(key in context.calls.sendPost[0]).toBe(false);
    }
  });

  it('forwards a heap post to a heap channel', async () => {
    const cite = {
      block: {
        cite: { chan: { nest: 'heap/~nec/pics', where: `/msg/${S_UD}` } },
      },
    };
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost([cite])),
    });

    expect(
      await run(
        ['forward', 'heap/~nec/pics', S, 'heap/~zod/gallery'],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.sendPost[0]).toMatchObject({
      channelId: 'heap/~zod/gallery',
      content: [cite],
    });
  });

  it('forwards a thread reply with --parent', async () => {
    const context = makeDeps({
      threads: [source({ replies: [sourceReply()] })],
      getChannelPosts: channelReadBack(sentPost([CITER])),
    });

    expect(
      await run(['forward', SRC, R, TEAM, '--parent', S], context.deps)
    ).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([CITER]);
  });

  it('forwards to a DM', async () => {
    const context = makeDeps({
      threads: [
        source(),
        {
          id: DM_TIME,
          authorId: '~zod',
          contentKey: contentKeyOf([CITE]),
          replies: [],
        },
      ],
    });

    expect(await run(['forward', SRC, S, '~bus'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(`✓ Post forwarded\n  ID: ~zod/${DM_TIME}\n`);
    expect(context.calls.authenticateApps).toEqual([['channels', 'chat']]);
    expect(context.calls.getChannelState).toEqual([SRC]);
    expect(context.calls.sendPost).toEqual([
      { channelId: '~bus', authorId: '~zod', sentAt: SENT, content: [CITE] },
    ]);
  });

  it('forwards to a group DM', async () => {
    const context = makeDeps({
      threads: [
        source(),
        {
          id: DM_TIME,
          authorId: '~zod',
          contentKey: contentKeyOf([CITE]),
          replies: [],
        },
      ],
    });

    expect(await run(['forward', SRC, S, '0v4.abc'], context.deps)).toBe(0);
    expect(context.calls.sendPost[0].channelId).toBe('0v4.abc');
    expect(context.calls.getPostWithReplies[1]).toEqual({
      channelId: '0v4.abc',
      postId: DM_TIME,
      authorId: '~zod',
    });
  });

  it('refuses a forward target channel that is not joined', async () => {
    const context = makeDeps({
      threads: [source()],
      channelStates: [
        { joined: true, groupId: '~nec/g', order: [] },
        { joined: false },
      ],
    });

    expect(await run(['forward', SRC, S, TEAM], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: ${TEAM} is not a channel this ship has joined; join it first.\n`
    );
    expect(context.calls.sendPost).toEqual([]);
  });

  it('prints POSTS_COMMAND_HELP.forward for forward --help', async () => {
    const context = makeDeps();

    expect(await run(['forward', '--help'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(`${POSTS_COMMAND_HELP.forward}\n`);
    expectNoAuthOrApi(context);
  });
});

describe('posts quote and forward read-back', () => {
  it("confirms a channel send by author, sent time and content, skipping another ship's post", async () => {
    const content = [CITE, { inline: ['x'] }];
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(
        sentPost(content, { id: '170.141.999', authorId: '~nec' }),
        sentPost(content)
      ),
    });

    expect(
      await run(['send', TEAM, 'x', '--quote', SRC, S], context.deps)
    ).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Message sent\n  Ref: /1/chan/${TEAM}/msg/${NEW_UD}\n`
    );
  });

  it('reports sent-but-not-confirmed without inviting a resend', async () => {
    const context = makeDeps({ threads: [source()] });

    expect(
      await run(['send', TEAM, 'x', '--quote', SRC, S], context.deps)
    ).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Message to ${TEAM} was sent but is not confirmed: no post by ~zod with this sent time is among the channel's newest 20 posts yet. It may still arrive. Do not send it again; check first with \`messages channel ${TEAM} --limit 5\`\n`
    );
    expect(context.calls.getChannelPosts).toHaveLength(5);
    expect(context.calls.sleep).toEqual([500, 500, 500, 500]);
    expect(context.calls.sendPost).toHaveLength(1);
  });

  it('does not confirm our post with another sent time', async () => {
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost([CITE], { sentAt: SENT - 1 })),
    });

    expect(await run(['forward', SRC, S, TEAM], context.deps)).toBe(1);
    expect(context.stderr()).toContain(
      "was sent but is not confirmed: no post by ~zod with this sent time is among the channel's newest 20 posts yet."
    );
  });

  it('reports a DM read-back with other content, or deleted, as not confirmed', async () => {
    for (const [readBack, reason] of [
      [
        { contentKey: contentKeyOf([{ inline: ['changed'] }]) },
        'the post shows different content (a channel hook may have changed it)',
      ],
      [
        { contentKey: contentKeyOf([CITE]), isDeleted: true },
        'the post is deleted',
      ],
    ] as const) {
      const context = makeDeps({
        threads: [
          source(),
          { id: DM_TIME, authorId: '~zod', replies: [], ...readBack },
        ],
      });

      expect(await run(['forward', SRC, S, '~bus'], context.deps)).toBe(1);
      expect(context.stderr()).toBe(
        `Error: Forward to ~bus was sent but is not confirmed: ${reason}. It may still arrive. Do not send it again; check first with \`messages dm ~bus --limit 5\`\n`
      );
      expect(context.calls.sendPost).toHaveLength(1);
    }
  });

  it('reports a contentKey mismatch as not confirmed', async () => {
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost([{ inline: ['changed'] }])),
    });

    expect(await run(['forward', SRC, S, TEAM], context.deps)).toBe(1);
    expect(context.stderr()).toContain(
      `Error: Forward to ${TEAM} was sent but is not confirmed: the post shows different content (a channel hook may have changed it).`
    );
  });

  it('reports a deleted read-back as not confirmed', async () => {
    const context = makeDeps({
      threads: [source()],
      getChannelPosts: channelReadBack(sentPost([CITE], { isDeleted: true })),
    });

    expect(await run(['forward', SRC, S, TEAM], context.deps)).toBe(1);
    expect(context.stderr()).toContain(
      'was sent but is not confirmed: the post is deleted.'
    );
  });

  it('confirms after a thrown read-back, and keeps the read error when it never recovers', async () => {
    let reads = 0;
    const recovered = makeDeps({
      threads: [source()],
      getChannelPosts: async () => {
        reads += 1;
        if (reads === 1) throw new Error('scry timeout');
        return { posts: [sentPost([CITE])] };
      },
    });
    expect(await run(['forward', SRC, S, TEAM], recovered.deps)).toBe(0);
    expect(recovered.calls.sleep).toEqual([500]);

    const failing = makeDeps({
      threads: [source(), new Error('scry 404')],
    });
    expect(await run(['forward', SRC, S, '~bus'], failing.deps)).toBe(1);
    expect(failing.stderr()).toBe(
      `Error: Forward to ~bus was sent but is not confirmed: the DM could not be read back (scry 404). It may still arrive. Do not send it again; check first with \`messages dm ~bus --limit 5\`\n`
    );
  });

  it('names the thread check for an unconfirmed channel reply', async () => {
    const context = makeDeps({
      threads: [source(), { id: P, authorId: '~zod', replies: [] }],
    });

    expect(
      await run(['reply', TEAM, P, 'x', '--quote', SRC, S], context.deps)
    ).toBe(1);
    expect(context.stderr()).toContain(
      `check first with \`messages post ${TEAM} ${P}\``
    );
  });

  it('names messages channel for an unconfirmed group-DM send', async () => {
    const context = makeDeps({ threads: [source(), new Error('scry 404')] });

    expect(await run(['forward', SRC, S, '0v4.abc'], context.deps)).toBe(1);
    expect(context.stderr()).toContain(
      'check first with `messages channel 0v4.abc --limit 5`'
    );
  });
});

describe('posts quote and forward refusals before auth', () => {
  const FORWARD_TARGET_REFUSAL = (target: string) =>
    `Can't forward to ${target}: posts can be forwarded only to chat/ and heap/ channels, DMs (~ship) and group DMs (0v…).`;

  const cases: Array<{ name: string; args: string[]; stderr: string }> = [
    {
      name: 'forward to a notes channel',
      args: ['forward', SRC, S, 'notes/~zod/n'],
      stderr: `Error: ${FORWARD_TARGET_REFUSAL('notes/~zod/n')}\n`,
    },
    {
      name: 'forward to a buckets channel',
      args: ['forward', SRC, S, 'buckets/~zod/b'],
      stderr: `Error: ${FORWARD_TARGET_REFUSAL('buckets/~zod/b')}\n`,
    },
    {
      name: 'forward to a notebook',
      args: ['forward', SRC, S, 'diary/~zod/blog'],
      stderr: `Error: ${DIARY_REMOVED}\n`,
    },
    {
      name: 'forward from a notebook',
      args: ['forward', 'diary/~zod/blog', S, TEAM],
      stderr: `Error: ${DIARY_REMOVED}\n`,
    },
    {
      name: 'forward from a notes channel to a notebook (notes wins)',
      args: ['forward', 'notes/~zod/n', S, 'diary/~zod/blog'],
      stderr: `Error: ${NOTES_CHANNEL_CONTENT_UNSUPPORTED}\n`,
    },
    {
      name: 'quote into a notes channel from a notebook (notes wins)',
      args: ['send', 'notes/~zod/n', 'x', '--quote', 'diary/~zod/blog', S],
      stderr: `Error: ${NOTES_CHANNEL_CONTENT_UNSUPPORTED}\n`,
    },
    {
      name: 'forward a DM post',
      args: ['forward', '~bus', S, TEAM],
      stderr:
        'Error: Only posts in group chat/ and heap/ channels can be forwarded; ~bus is a DM.\n',
    },
    {
      name: 'forward a notes-like non-group source',
      args: ['forward', 'buckets/~zod/b', S, TEAM],
      stderr:
        'Error: Only posts in group chat/ and heap/ channels can be forwarded; buckets/~zod/b is not one.\n',
    },
    {
      name: 'quote a notebook post',
      args: ['send', TEAM, 'x', '--quote', 'diary/~zod/blog', S],
      stderr: `Error: ${DIARY_REMOVED}\n`,
    },
    {
      name: 'quote a notebook post in a reply',
      args: ['reply', TEAM, P, 'x', '--quote', 'diary/~zod/blog', S],
      stderr: `Error: ${DIARY_REMOVED}\n`,
    },
    {
      name: 'a quoted send into a buckets channel',
      args: ['send', 'buckets/~zod/files', 'hi', '--quote', SRC, S],
      stderr: `Error: Can't quote into buckets/~zod/files: --quote is supported for chat/ and heap/ channels, DMs (~ship) and group DMs (0v…).\n`,
    },
    {
      name: 'a quoted reply into a buckets channel',
      args: ['reply', 'buckets/~zod/files', P, 'hi', '--quote', SRC, S],
      stderr: `Error: Can't quote into buckets/~zod/files: --quote is supported for chat/ and heap/ channels, DMs (~ship) and group DMs (0v…).\n`,
    },
    {
      name: 'a quoted send into a notebook (diary wins)',
      args: ['send', 'diary/~zod/blog', 'hi', '--quote', SRC, S],
      stderr: `Error: ${DIARY_REMOVED}\n`,
    },
    {
      name: 'quote a notes post',
      args: ['send', TEAM, 'x', '--quote', 'notes/~zod/n', S],
      stderr:
        'Error: --quote takes a post in a group chat/ or heap/ channel, a DM (~ship) or a group DM (0v…); notes/~zod/n is not one.\n',
    },
  ];

  for (const { name, args, stderr } of cases) {
    it(`refuses ${name}`, async () => {
      const context = makeDeps();

      expect(await run(args, context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(stderr);
      expectNoAuthOrApi(context);
    });
  }
});

describe('posts quote and forward usage errors', () => {
  const send = POSTS_COMMAND_HELP.send;
  const reply = POSTS_COMMAND_HELP.reply;
  const forward = POSTS_COMMAND_HELP.forward;

  const cases: Array<{ name: string; args: string[]; stderr: string }> = [
    {
      name: 'a missing quote post id',
      args: ['send', TEAM, 'x', '--quote', SRC],
      stderr: `${send}\n`,
    },
    {
      name: 'a missing quote source',
      args: ['send', TEAM, 'x', '--quote'],
      stderr: `${send}\n`,
    },
    {
      name: 'an option as the quote source',
      args: ['send', TEAM, 'x', '--quote', '--bot', S],
      stderr: `${send}\n`,
    },
    {
      name: 'a duplicate --quote',
      args: ['send', TEAM, 'x', '--quote', SRC, S, '--quote', SRC, S],
      stderr: `${send}\n`,
    },
    {
      name: 'a repeated --sent-at after --quote',
      args: [
        'send',
        TEAM,
        'x',
        '--quote',
        SRC,
        S,
        '--sent-at',
        '1',
        '--sent-at',
        '2',
      ],
      stderr: `${send}\n`,
    },
    {
      name: 'a missing --quote-parent value',
      args: ['send', TEAM, 'x', '--quote', SRC, R, '--quote-parent'],
      stderr: `${send}\n`,
    },
    {
      name: 'a duplicate --quote-parent',
      args: [
        'reply',
        TEAM,
        P,
        'x',
        '--quote',
        SRC,
        R,
        '--quote-parent',
        S,
        '--quote-parent',
        S,
      ],
      stderr: `${reply}\n`,
    },
    {
      name: '--quote-parent without --quote',
      args: ['send', TEAM, 'x', '--quote-parent', S],
      stderr: `Error: --quote-parent needs --quote\n\n${send}\n`,
    },
    {
      name: '--quote with --image',
      args: ['send', TEAM, '--image', 'https://x/y.png', '--quote', SRC, S],
      stderr: `Error: --quote cannot be combined with --image\n\n${send}\n`,
    },
    {
      name: 'text after the quote values',
      args: ['send', TEAM, '--quote', SRC, S, 'trailing', 'text'],
      stderr: `${unexpectedAt(5)}\n\n${send}\n`,
    },
    {
      name: 'text after --quote-parent',
      args: ['send', TEAM, '--quote', SRC, R, '--quote-parent', S, 'more'],
      stderr: `${unexpectedAt(7)}\n\n${send}\n`,
    },
    {
      name: 'a trailing --self',
      args: ['send', TEAM, 'x', '--quote', SRC, S, '--self'],
      stderr: `${unexpectedAt(6)}\n\n${send}\n`,
    },
    {
      name: 'a trailing credential-looking flag',
      args: ['reply', TEAM, P, 'x', '--quote', SRC, S, '--code', 'abc'],
      stderr: `${unexpectedAt(7)}\n\n${reply}\n`,
    },
    {
      name: 'a quote in the reply post-id slot',
      args: ['reply', TEAM, '--quote', SRC, S],
      stderr: `${reply}\n`,
    },
    {
      name: 'a non-numeric quote post id',
      args: ['send', TEAM, 'x', '--quote', SRC, 'abc'],
      stderr: `${send}\n`,
    },
    {
      name: 'a non-numeric reply parent with a quote',
      args: ['reply', TEAM, 'abc', 'x', '--quote', SRC, S],
      stderr: `${reply}\n`,
    },
    {
      name: 'forward with a missing target',
      args: ['forward', SRC, S],
      stderr: `${forward}\n`,
    },
    {
      name: 'forward with an unknown option',
      args: ['forward', SRC, S, TEAM, '--bogus'],
      stderr: `Error: Unexpected argument: --bogus\n\n${forward}\n`,
    },
    {
      name: 'forward with --quote',
      args: ['forward', SRC, S, TEAM, '--quote', SRC, S],
      stderr: `Error: Unexpected argument: --quote\n\n${forward}\n`,
    },
    {
      name: 'forward with an extra word',
      args: ['forward', SRC, S, TEAM, 'extra'],
      stderr: `Error: Unexpected argument: extra\n\n${forward}\n`,
    },
    {
      name: 'forward with an option-like --parent value',
      args: ['forward', SRC, S, TEAM, '--parent', '--x'],
      stderr: `${forward}\n`,
    },
    {
      name: 'forward with a non-numeric id',
      args: ['forward', SRC, 'abc', TEAM],
      stderr: `${forward}\n`,
    },
  ];

  for (const { name, args, stderr } of cases) {
    it(`rejects ${name} before auth`, async () => {
      const context = makeDeps();

      expect(await run(args, context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(stderr);
      expectNoAuthOrApi(context);
    });
  }
});

describe('posts role mentions', () => {
  const CHANNEL = 'chat/~host/channel';
  const GROUP = '~host/group';
  const ROLES = ['admin', 'moderators'];

  function expectNoRoleLookup(context: ReturnType<typeof makeDeps>) {
    expect(context.calls.getChannelState).toEqual([]);
    expect(context.calls.getGroupRoleIds).toEqual([]);
  }

  it('sends a role mention as a literal sect inline', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(['send', CHANNEL, 'hi @admin'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      { inline: ['hi ', { sect: 'admin' }] },
    ]);
    expect(context.calls.getChannelState).toEqual([CHANNEL]);
    expect(context.calls.getGroupRoleIds).toEqual([GROUP]);
  });

  it('sends @all as sect null without a role lookup', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(['send', CHANNEL, 'see @ALL'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      { inline: ['see ', { sect: null }] },
    ]);
    expectNoRoleLookup(context);
  });

  it('sends a ship and a role mention in one message', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(
      ['send', CHANNEL, 'hey ~sampel-palnet and @Admin, see @all'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      {
        inline: [
          'hey ',
          { ship: '~sampel-palnet' },
          ' and ',
          { sect: 'admin' },
          ', see ',
          { sect: null },
        ],
      },
    ]);
  });

  it('normalizes @Admin to the role id', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    await run(['send', CHANNEL, '**@Admin**'], context.deps);

    expect(context.calls.sendPost[0].content).toEqual([
      { inline: [{ bold: [{ sect: 'admin' }] }] },
    ]);
  });

  it("refuses an unknown role and lists the group's role ids", async () => {
    const context = makeDeps({ groupRoleIds: ['moderators', 'admin'] });
    const exitCode = await run(
      ['send', 'chat/host/channel', 'ping @mods and @admin'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      'Error: Unknown role mention @mods in chat/~host/channel. Role ids in group ~host/group: @admin, @moderators; @all mentions every member. Use the role id, not its title. To send @mods as plain text, wrap it in backticks: `@mods`. If the role was just created, retry in a moment.\n'
    );
    expect(context.calls.getChannelState).toEqual([CHANNEL]);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('lists several unknown tokens once each, in typed spelling', async () => {
    const context = makeDeps({ groupRoleIds: [] });
    const exitCode = await run(
      ['send', CHANNEL, '@Mods @here @mods @all'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(
      'Error: Unknown role mentions @Mods, @here in chat/~host/channel. Role ids in group ~host/group: none; @all mentions every member. Use the role id, not its title. To send @Mods as plain text, wrap it in backticks: `@Mods`. If the role was just created, retry in a moment.\n'
    );
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses a role title that is not its id', async () => {
    const context = makeDeps({ groupRoleIds: ['mods'] });
    const exitCode = await run(
      ['send', CHANNEL, 'ping @moderators'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain(
      'Unknown role mention @moderators in chat/~host/channel. Role ids in group ~host/group: @mods;'
    );
    expect(context.calls.sendPost).toEqual([]);
  });

  it('refuses before fetching an image', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(
      ['send', CHANNEL, 'see @mods', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.calls.buildImageVerse).toEqual([]);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('sends a role-bearing image caption after the role check', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(
      ['send', CHANNEL, 'see @admin', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      IMAGE_VERSE,
      { inline: ['see ', { sect: 'admin' }] },
    ]);
    expect(context.calls.order).toEqual([
      'authenticate',
      'getChannelState',
      'getGroupRoleIds',
      'buildImageVerse',
      'getCurrentUserId',
      'now',
      'sendPost',
    ]);
  });

  it('refuses an unknown role in a task item or a nested heading', async () => {
    for (const message of ['- [ ] ping @mods', '> ## ping @mods']) {
      const context = makeDeps({ groupRoleIds: ROLES });
      const exitCode = await run(['send', CHANNEL, message], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stderr()).toContain('Unknown role mention @mods in');
      expect(context.calls.sendPost).toEqual([]);
    }
  });

  it('reads a trailing hyphen as part of the role id', async () => {
    const refused = makeDeps({ groupRoleIds: ROLES });
    expect(await run(['send', CHANNEL, 'hi @admin-'], refused.deps)).toBe(1);
    expect(refused.stderr()).toContain('Unknown role mention @admin- in');

    const sent = makeDeps({ groupRoleIds: ['admin-'] });
    expect(await run(['send', CHANNEL, 'hi @admin-'], sent.deps)).toBe(0);
    expect(sent.calls.sendPost[0].content).toEqual([
      { inline: ['hi ', { sect: 'admin-' }] },
    ]);
  });

  it('sends code and links in a table cell with no lookup', async () => {
    const context = makeDeps();
    const exitCode = await run(
      [
        'send',
        CHANNEL,
        '| pkg | docs |\n| - | - |\n| `@types/node` | [@mods](https://x) |',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost).toHaveLength(1);
    expectNoRoleLookup(context);
  });

  it('sends an escaped \\@word literally with no refusal or lookup', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(['send', CHANNEL, 'ask \\@mods'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      { inline: ['ask @mods'] },
    ]);
    expectNoRoleLookup(context);
  });

  it('sends a backticked @word literally with no lookup', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', CHANNEL, 'use `@types/node`'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendPost[0].content).toEqual([
      { inline: ['use ', { 'inline-code': '@types/node' }] },
    ]);
    expectNoRoleLookup(context);
  });

  it('does no role lookup for text without @', async () => {
    const context = makeDeps();
    await run(['send', CHANNEL, 'plain'], context.deps);

    expect(context.calls.sendPost).toHaveLength(1);
    expectNoRoleLookup(context);
  });

  it('posts send to a DM: @all converts, a named role is refused', async () => {
    for (const target of ['~sampel-palnet', '0v5.abcde']) {
      const allContext = makeDeps();
      expect(await run(['send', target, 'hi @all'], allContext.deps)).toBe(0);
      expect(allContext.calls.sendPost[0].content).toEqual([
        { inline: ['hi ', { sect: null }] },
      ]);

      const context = makeDeps({ groupRoleIds: ROLES });
      const exitCode = await run(['send', target, 'hi @admin'], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stderr()).toBe(
        `Error: Unknown role mention @admin: ${target} is a DM, and roles exist only in group channels, so only @all is available here. To send @admin as plain text, wrap it in backticks: \`@admin\`.\n`
      );
      expect(context.calls.sendPost).toEqual([]);
      expectNoRoleLookup(context);
    }
  });

  it('posts reply to a DM refuses a named role', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(
      ['reply', '~sampel-palnet', '170.141', 'hi @admin'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain('~sampel-palnet is a DM');
    expect(context.calls.sendReply).toEqual([]);
    expectNoRoleLookup(context);
  });

  it('refuses role mentions in an unjoined channel', async () => {
    const context = makeDeps({ channelStates: [{ joined: false }] });
    const exitCode = await run(['send', CHANNEL, 'hi @admin'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(
      'Error: Cannot check role mentions: chat/~host/channel is not a channel this ship has joined; join it first.\n'
    );
    expect(context.calls.getGroupRoleIds).toEqual([]);
    expect(context.calls.sendPost).toEqual([]);
  });

  it('reports channel-state and role-read failures', async () => {
    const stateFails = makeDeps({ channelStates: [new Error('scry 500')] });
    expect(await run(['send', CHANNEL, 'hi @admin'], stateFails.deps)).toBe(1);
    expect(stateFails.stderr()).toBe(
      'Error: Could not read channel state for chat/~host/channel: scry 500\n'
    );

    const rolesFail = makeDeps({ groupRoleIds: new Error('scry 404') });
    expect(await run(['send', CHANNEL, 'hi @admin'], rolesFail.deps)).toBe(1);
    expect(rolesFail.stderr()).toBe(
      'Error: Could not read roles for group ~host/group to check role mentions: scry 404\n'
    );
    expect(rolesFail.calls.sendPost).toEqual([]);
  });

  it('reply sends a role mention', async () => {
    const context = makeDeps({ groupRoleIds: ROLES });
    const exitCode = await run(
      ['reply', CHANNEL, '170.141', 'cc @moderators'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.sendReply[0].content).toEqual([
      { inline: ['cc ', { sect: 'moderators' }] },
    ]);
  });

  describe('edits', () => {
    const lookupSucceeds = async (): Promise<PostLookupResult> => ({
      posts: [{ id: '170.141.184', sentAt: 1111, isBot: false }],
    });

    it('edit parses role mentions like send', async () => {
      const context = makeDeps({
        groupRoleIds: ROLES,
        getChannelPosts: lookupSucceeds,
      });
      const exitCode = await run(
        ['edit', CHANNEL, '170.141.184', 'now @admin'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.calls.editPost[0].content).toEqual([
        { inline: ['now ', { sect: 'admin' }] },
      ]);
    });

    it('edit refuses an unknown role', async () => {
      const context = makeDeps({
        groupRoleIds: ROLES,
        getChannelPosts: lookupSucceeds,
      });
      const exitCode = await run(
        ['edit', CHANNEL, '170.141.184', 'now @mods'],
        context.deps
      );

      expect(exitCode).toBe(1);
      expect(context.stderr()).toContain('Unknown role mention @mods');
      expect(context.calls.editPost).toEqual([]);
    });

    it('edit refuses a role the group has since deleted', async () => {
      // The post was sent while `@oldrole` existed; the edit re-validates.
      const context = makeDeps({
        groupRoleIds: ['admin'],
        getChannelPosts: lookupSucceeds,
      });
      const exitCode = await run(
        ['edit', CHANNEL, '170.141.184', 'hi @oldrole'],
        context.deps
      );

      expect(exitCode).toBe(1);
      expect(context.stderr()).toContain('Unknown role mention @oldrole');
      expect(context.calls.editPost).toEqual([]);
    });

    const P = '170.141.184.500';
    const R = '170.141.184.501';
    const original: ExistingReply = {
      id: R,
      authorId: '~zod',
      sentAt: 4242,
      contentKey: contentKeyOf([{ inline: ['old'] }]),
    };
    const thread = (reply: ExistingReply): ExistingThread => ({
      id: P,
      authorId: '~host',
      replies: [reply],
    });

    it('edit --parent refuses an unknown or since-deleted role', async () => {
      for (const message of ['now @mods', 'still @oldrole']) {
        const context = makeDeps({
          groupRoleIds: ROLES,
          threads: [thread(original)],
        });
        const exitCode = await run(
          ['edit', CHANNEL, R, message, '--parent', P],
          context.deps
        );

        expect(exitCode).toBe(1);
        expect(context.stderr()).toContain('Unknown role mention @');
        expect(context.calls.editPost).toEqual([]);
      }
    });

    it('edit --parent with a role mention confirms the read-back', async () => {
      const content = [{ inline: ['now ', { sect: 'admin' }] }];
      const context = makeDeps({
        groupRoleIds: ROLES,
        threads: [
          thread(original),
          thread({ ...original, contentKey: contentKeyOf(content) }),
        ],
      });

      const exitCode = await run(
        ['edit', CHANNEL, R, 'now @admin', '--parent', P],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe('✓ Reply edited\n');
      expect(context.calls.editPost[0].content).toEqual(content);
    });
  });
});

describe('posts send attachments', () => {
  const CHAT = 'chat/~host/channel';
  const HEAP = 'heap/~host/gallery';
  const IMG_A = 'https://x/a.png';
  const IMG_B = 'https://x/b.png';
  const FILE = 'https://cdn.example.com/docs/my%20report.pdf?sig=SECRET';
  const VIDEO = 'https://cdn.example.com/clips/clip.mp4';
  const send = POSTS_COMMAND_HELP.send;
  const GALLERY_RULE =
    'galleries take one attachment per post; send one `posts send` per attachment';

  const imageVerse = (src: string): StoryVerse => ({
    block: { image: { src, width: 10, height: 20, alt: 'i' } },
  });
  const byUrl = async (url: string) => imageVerse(url);

  async function sendOk(args: string[], options: MakeDepsOptions = {}) {
    const context = makeDeps({ buildImageVerse: byUrl, ...options });
    const exitCode = await run(['send', ...args], context.deps);
    expect(context.stderr()).toBe('');
    expect(exitCode).toBe(0);
    return context;
  }

  async function refusedBeforeAuth(args: string[], stderr: string) {
    const context = makeDeps();
    expect(await run(['send', ...args], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(stderr);
    expectNoAuthOrApi(context);
  }

  describe('chat and DM composition', () => {
    it('fetches repeated images in parallel and puts them first, in order', async () => {
      // Each fetch waits for both to have started: sequential fetching would
      // never finish.
      let started = 0;
      let release: () => void = () => {};
      const bothStarted = new Promise<void>((resolve) => {
        release = resolve;
      });
      const context = await sendOk(
        [CHAT, 'caption', '--image', IMG_A, '--image', IMG_B],
        {
          buildImageVerse: async (url) => {
            started += 1;
            if (started === 2) release();
            await bothStarted;
            return imageVerse(url);
          },
        }
      );

      expect(context.calls.buildImageVerse).toEqual([IMG_A, IMG_B]);
      expect(context.calls.sendPost[0].content).toEqual([
        imageVerse(IMG_A),
        imageVerse(IMG_B),
        { inline: ['caption'] },
      ]);
      expect(context.calls.sendPost[0].metadata).toBeUndefined();
    });

    it('accepts the --image= form among repeated images', async () => {
      const context = await sendOk([
        CHAT,
        `--image=${IMG_A}`,
        '--image',
        IMG_B,
      ]);
      expect(context.calls.buildImageVerse).toEqual([IMG_A, IMG_B]);
    });

    it('appends file and video entries after --blob entries, in flag order', async () => {
      const lens =
        '{"type":"tlon-context-lens","version":1,"lensId":"L1","x":1}';
      const context = await sendOk(
        [
          CHAT,
          'caption',
          '--video',
          VIDEO,
          '--blob',
          `[${lens}]`,
          '--image',
          IMG_A,
          '--file',
          FILE,
        ],
        {
          probeMedia: async (url) =>
            url === VIDEO
              ? { mimeType: 'video/mp4', size: 2048 }
              : { mimeType: 'application/pdf', size: 1234 },
        }
      );

      expect(context.calls.probeMedia).toEqual([VIDEO, FILE]);
      const payload = context.calls.sendPost[0];
      expect(payload.content).toEqual([
        imageVerse(IMG_A),
        { inline: ['caption'] },
      ]);
      expect(JSON.parse(payload.blob ?? '')).toEqual([
        JSON.parse(lens),
        {
          type: 'video',
          version: 1,
          fileUri: VIDEO,
          mimeType: 'video/mp4',
          name: 'clip.mp4',
          size: 2048,
        },
        {
          type: 'file',
          version: 1,
          fileUri: FILE,
          mimeType: 'application/pdf',
          name: 'my report.pdf',
          size: 1234,
        },
      ]);
    });

    it('writes size -1 and no type when the probe learned nothing', async () => {
      const context = await sendOk([CHAT, '--file', 'https://x/100%.bin']);

      expect(context.calls.sendPost[0].content).toEqual([]);
      expect(JSON.parse(context.calls.sendPost[0].blob ?? '')).toEqual([
        // The segment does not decode, so the raw segment is the name.
        {
          type: 'file',
          version: 1,
          fileUri: 'https://x/100%.bin',
          name: '100%.bin',
          size: -1,
        },
      ]);
    });

    it('sends an attachment-only DM', async () => {
      const context = await sendOk(['~sampel-palnet', '--video', VIDEO]);
      expect(context.calls.authenticateApps).toEqual([['chat']]);
      expect(JSON.parse(context.calls.sendPost[0].blob ?? '')[0].type).toBe(
        'video'
      );
    });

    it('sends an attachment that is only a --blob file entry', async () => {
      const blob = `[{"type":"file","version":1,"fileUri":"${VIDEO}","size":-1}]`;
      const context = await sendOk([CHAT, '--blob', blob]);
      expect(context.calls.sendPost[0].blob).toBe(blob);
    });

    for (const status of [404, 410]) {
      it(`refuses a --file the real probe finds gone (HTTP ${status}); nothing is sent`, async () => {
        const server = http.createServer((req, res) => {
          res.writeHead(status);
          res.end();
        });
        await new Promise<void>((resolve) =>
          server.listen(0, '127.0.0.1', () => resolve())
        );
        try {
          const { port } = server.address() as AddressInfo;
          const context = makeDeps({
            // The guarded HEAD itself, pinned to the local server.
            probeMedia: () =>
              probeGuardedMedia(`http://gone.invalid:${port}/x.pdf`, {
                deadlineMs: 5_000,
                resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
                allowAddress: (address) => address === '127.0.0.1',
              }),
          });
          expect(await run(['send', CHAT, '--file', FILE], context.deps)).toBe(
            1
          );
          expect(context.stderr()).toBe(
            'Error: Could not fetch media from the provided URL. (--file #1 (cdn.example.com))\n'
          );
          expect(context.calls.sendPost).toEqual([]);
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      });
    }

    it('refuses a host-policy rejection from the probe; nothing is sent', async () => {
      const context = makeDeps({
        probeMedia: async () => {
          throw commandError('Could not fetch media from the provided URL.');
        },
      });
      expect(await run(['send', CHAT, '--file', FILE], context.deps)).toBe(1);
      expect(context.stderr()).toBe(
        'Error: Could not fetch media from the provided URL. (--file #1 (cdn.example.com))\n'
      );
      expect(context.calls.sendPost).toEqual([]);
    });

    it("names the attachment, never its path or query, when its guard's deadline runs out", async () => {
      // The image guard's own deadline is the only bound; its fixed text
      // carries the attachment's label.
      const context = makeDeps({
        buildImageVerse: async (url) => {
          if (url === IMG_A) return imageVerse(url);
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw commandError('Could not fetch media from the provided URL.');
        },
      });
      expect(
        await run(
          [
            'send',
            CHAT,
            '--image',
            IMG_A,
            '--image',
            'https://img.example/b.png?sig=SECRET',
          ],
          context.deps
        )
      ).toBe(1);
      expect(context.stderr()).toBe(
        'Error: Could not fetch media from the provided URL. (--image #2 (img.example))\n'
      );
      expect(context.calls.sendPost).toEqual([]);
    });
  });

  describe('gallery composition', () => {
    it('puts the image after the caption and sets metadata.image without a title', async () => {
      const context = await sendOk([HEAP, 'caption', '--image', IMG_A]);

      expect(context.calls.sendPost[0].content).toEqual([
        { inline: ['caption'] },
        imageVerse(IMG_A),
      ]);
      expect(context.calls.sendPost[0].metadata).toEqual({ image: IMG_A });
    });

    it('sets both title and image', async () => {
      const context = await sendOk([HEAP, '--image', IMG_A, '--title', 'T']);

      expect(context.calls.sendPost[0].content).toEqual([imageVerse(IMG_A)]);
      expect(context.calls.sendPost[0].metadata).toEqual({
        title: 'T',
        image: IMG_A,
      });
    });

    it('sends a file post as caption text plus a blob entry', async () => {
      const context = await sendOk([HEAP, 'notes', '--file', FILE]);

      expect(context.calls.sendPost[0].content).toEqual([
        { inline: ['notes'] },
      ]);
      expect(context.calls.sendPost[0].metadata).toBeUndefined();
      expect(JSON.parse(context.calls.sendPost[0].blob ?? '')).toHaveLength(1);
    });

    it('sends a link post as exactly one link block', async () => {
      const bare = await sendOk([HEAP, '--link', 'https://example.com/a']);
      expect(bare.calls.sendPost[0]).toEqual({
        channelId: HEAP,
        authorId: '~zod',
        sentAt: 1700000000000,
        content: [
          { block: { link: { url: 'https://example.com/a', meta: {} } } },
        ],
        blob: undefined,
      });

      const titled = await sendOk([
        HEAP,
        '--link',
        'http://example.com/b',
        '--title',
        'A site',
      ]);
      expect(titled.calls.sendPost[0].content).toEqual([
        {
          block: {
            link: { url: 'http://example.com/b', meta: { title: 'A site' } },
          },
        },
      ]);
      expect(titled.calls.sendPost[0].metadata).toEqual({ title: 'A site' });
    });

    describe('--link bare card', () => {
      const LINK = 'https://example.com/a';

      it('carries only the URL, with no post image, and fetches nothing', async () => {
        const context = await sendOk([HEAP, '--link', LINK]);
        expect(context.calls.sendPost[0].content).toEqual([
          { block: { link: { url: LINK, meta: {} } } },
        ]);
        expect(context.calls.sendPost[0].metadata).toBeUndefined();
        expect(context.calls.buildImageVerse).toEqual([]);
        expect(context.calls.probeMedia).toEqual([]);
      });

      it('puts --title in meta.title and nothing else', async () => {
        const context = await sendOk([HEAP, '--link', LINK, '--title', 'Mine']);
        expect(context.calls.sendPost[0].content).toEqual([
          { block: { link: { url: LINK, meta: { title: 'Mine' } } } },
        ]);
        expect(context.calls.sendPost[0].metadata).toEqual({ title: 'Mine' });
      });
    });

    it('counts a metadata-only blob entry as no attachment', async () => {
      const context = await sendOk([
        HEAP,
        '--file',
        FILE,
        '--blob',
        '[{"type":"tlon-context-lens","version":1,"lensId":"L"}]',
      ]);
      expect(JSON.parse(context.calls.sendPost[0].blob ?? '')).toHaveLength(2);
    });

    const twoAttachments: Array<[string, string[]]> = [
      ['two images', ['--image', IMG_A, '--image', IMG_B]],
      ['an image and a file', ['--image', IMG_A, '--file', FILE]],
      ['two files', ['--file', FILE, '--file', FILE]],
      ['two videos', ['--video', VIDEO, '--video', VIDEO]],
      ['a link and an image', ['--link', 'https://e.com', '--image', IMG_A]],
      [
        'a video and a blob voice memo',
        [
          '--video',
          VIDEO,
          '--blob',
          `[{"type":"voicememo","version":1,"fileUri":"${VIDEO}","size":1}]`,
        ],
      ],
    ];
    for (const [name, flags] of twoAttachments) {
      it(`refuses ${name} in one gallery post before any fetch`, async () => {
        await refusedBeforeAuth(
          [HEAP, ...flags],
          `Error: ${GALLERY_RULE}\n\n${send}\n`
        );
      });
    }
  });

  describe('refusals before auth', () => {
    const cases: Array<[string, string[], string]> = [
      [
        'a plain-http file',
        [CHAT, '--file', 'http://x/f.pdf'],
        'Error: Only https media URLs are supported.\n',
      ],
      [
        'a local video path',
        [CHAT, '--video', '/pier/clip.mp4'],
        'Error: Local file paths are not supported for --video — upload the file first (e.g. `tlon upload <path>`) and pass the returned https URL.\n',
      ],
      [
        'a file URL with credentials',
        [CHAT, '--file', 'https://u:p@x/f.pdf'],
        'Error: Media URLs with embedded credentials are not supported.\n',
      ],
      ['a missing --file value', [CHAT, 'hi', '--file'], `${send}\n`],
      [
        'an option as the --video value',
        [CHAT, 'hi', '--video', '--bot'],
        `${send}\n`,
      ],
      [
        'a link outside a gallery',
        [CHAT, '--link', 'https://e.com'],
        `Error: --link is only supported for gallery (heap/) posts\n\n${send}\n`,
      ],
      [
        'a link with a caption',
        [HEAP, 'look', '--link', 'https://e.com'],
        `Error: a gallery link post has no caption; put the text in --title\n\n${send}\n`,
      ],
      [
        'a non-http link',
        [HEAP, '--link', 'ftp://e.com/x'],
        'Error: --link takes an http(s) URL.\n',
      ],
      [
        'a link that is not a URL',
        [HEAP, '--link', 'example.com'],
        'Error: --link takes an http(s) URL.\n',
      ],
      [
        'a repeated --title',
        [HEAP, 'x', '--title', 'a', '--title', 'b'],
        `${send}\n`,
      ],
      [
        'a repeated --link',
        [HEAP, '--link', 'https://a.com', '--link', 'https://b.com'],
        `${send}\n`,
      ],
      [
        'a repeated --blob',
        [CHAT, 'x', '--blob', '[]', '--blob', '[]'],
        `${send}\n`,
      ],
      [
        'a repeated --sent-at',
        [CHAT, 'x', '--sent-at', '1', '--sent-at', '2'],
        `${send}\n`,
      ],
      [
        'trailing text after the options',
        [HEAP, 'hi', '--title', 'T', 'extra'],
        `${unexpectedAt(5)}\n\n${send}\n`,
      ],
      [
        'a flag word in an unquoted message',
        [CHAT, 'please', 'use', '--file', 'for', 'uploads'],
        `${unexpectedAt(6)}\n\n${send}\n`,
      ],
      [
        'a second URL after one --image',
        [CHAT, '--image', IMG_A, 'https://x/b.png?sig=SECRET'],
        `${unexpectedAt(4)}\n\n${send}\n`,
      ],
      [
        'a trailing --file= token with a signed URL',
        [CHAT, 'hi', '--bot', '--file=https://x/f?token=SECRET'],
        `${unexpectedAt(4)}\n\n${send}\n`,
      ],
      [
        'a trailing blob JSON with no flag',
        [CHAT, 'hi', '--title', 'T', '[{"token":"SECRET"}]'],
        `${unexpectedAt(5)}\n\n${send}\n`,
      ],
      ['an empty --title', [HEAP, 'hi', '--title', ''], `${send}\n`],
      ['an empty --image', [CHAT, 'hi', '--image', ''], `${send}\n`],
      ['an empty --file', [CHAT, 'hi', '--file', ''], `${send}\n`],
      ['an empty --blob', [CHAT, 'hi', '--blob', ''], `${send}\n`],
      [
        'more than four images',
        [
          CHAT,
          ...[1, 2, 3, 4, 5].flatMap((n) => ['--image', `https://x/${n}.png`]),
        ],
        `Error: at most 4 --image attachments per send\n\n${send}\n`,
      ],
      [
        'a metadata-only blob with no message',
        [
          CHAT,
          '--blob',
          '[{"type":"tlon-context-lens","version":1,"lensId":"L"}]',
        ],
        `${send}\n`,
      ],
    ];
    for (const [name, args, stderr] of cases) {
      it(`refuses ${name}`, async () => {
        await refusedBeforeAuth(args, stderr);
      });
    }

    for (const flag of ['--file', '--video']) {
      it(`refuses ${flag} with --quote`, async () => {
        await refusedBeforeAuth(
          [TEAM, flag, VIDEO, '--quote', SRC, S],
          `Error: --quote cannot be combined with ${flag}\n\n${send}\n`
        );
      });
    }

    it('refuses --link with --quote', async () => {
      await refusedBeforeAuth(
        [HEAP, '--link', 'https://e.com', '--quote', SRC, S],
        `Error: --quote cannot be combined with --link\n\n${send}\n`
      );
    });
  });

  describe('--blob entry validation', () => {
    const KNOWN =
      'Known types: file, voicememo, video, metadata, tlon-context-lens, tlon-agent-intro-request, tlon-agent-provision, tlon-agent-provider-config, tlon-agent-provision-ack, tlon-agent-post-marker, tlon-a2ui-selection, a2ui.';
    const cases: Array<[string, string, string]> = [
      [
        'an unknown type',
        '[{"type":"tlon-context-lens","version":1,"lensId":"L"},{"type":"image","src":"https://x/SECRET.png"}]',
        `Error: --blob entry 1 has no known type. ${KNOWN}\n`,
      ],
      [
        'a non-object entry',
        '["SECRET"]',
        `Error: --blob entry 0 has no known type. ${KNOWN}\n`,
      ],
      [
        'a missing required field',
        '[{"type":"file","version":1,"fileUri":"https://x/SECRET.pdf"}]',
        `Error: --blob entry 0 is not a valid file entry (check: size). ${KNOWN}\n`,
      ],
      [
        'a wrong version',
        '[{"type":"tlon-context-lens","version":2,"lensId":"SECRET"}]',
        `Error: --blob entry 0 is not a valid tlon-context-lens entry (check: version). ${KNOWN}\n`,
      ],
    ];
    for (const [name, blob, stderr] of cases) {
      it(`refuses ${name} on send, naming the index and never a value`, async () => {
        await refusedBeforeAuth([CHAT, 'hi', '--blob', blob], stderr);
      });
    }

    // a2ui's schema is refined (superRefine), not a plain object schema: it
    // must validate like any other registered entry.
    const A2UI_MESSAGES = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's', catalogId: 'tlon.a2ui.basic.v2' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's',
          root: 't',
          components: [{ id: 't', component: 'Text', text: 'hi' }],
        },
      },
    ];

    it('passes a valid refined a2ui entry through as given', async () => {
      const blob = JSON.stringify([
        { type: 'a2ui', version: 1, messages: A2UI_MESSAGES },
      ]);
      const context = await sendOk([CHAT, 'hi', '--blob', blob]);
      expect(context.calls.sendPost[0].blob).toBe(blob);
    });

    it("refuses an a2ui entry that fails the schema's refinement", async () => {
      const blob = JSON.stringify([
        {
          type: 'a2ui',
          version: 1,
          messages: [A2UI_MESSAGES[0], { version: 'v0.9', SECRET: true }],
        },
      ]);
      await refusedBeforeAuth(
        [CHAT, 'hi', '--blob', blob],
        `Error: --blob entry 0 is not a valid a2ui entry (check: messages). ${KNOWN}\n`
      );
    });

    it('refuses an invalid entry on reply too (shared validation)', async () => {
      const context = makeDeps();
      expect(
        await run(
          [
            'reply',
            CHAT,
            '170.141',
            'hi',
            '--blob',
            '[{"type":"tlon-context-lens","lensId":"L1"}]',
          ],
          context.deps
        )
      ).toBe(1);
      expect(context.stderr()).toBe(
        `Error: --blob entry 0 is not a valid tlon-context-lens entry (check: version). ${KNOWN}\n`
      );
      expectNoAuthOrApi(context);
    });
  });

  describe('help and literal text', () => {
    it('treats --help after a media flag as help', async () => {
      const context = makeDeps();
      expect(
        await run(['send', CHAT, '--file', FILE, '--help'], context.deps)
      ).toBe(0);
      expect(context.stdout()).toBe(`${send}\n`);
      expectNoAuthOrApi(context);
    });

    it('keeps --help before a media flag as message text', async () => {
      const context = await sendOk([CHAT, '--help', '--file', FILE]);
      expect(context.calls.sendPost[0].content).toEqual([
        { inline: ['--help'] },
      ]);
    });

    it('keeps an unknown --word in the message', async () => {
      const context = await sendOk([CHAT, 'try', '--verbose', 'mode']);
      expect(context.calls.sendPost[0].content).toEqual([
        { inline: ['try --verbose mode'] },
      ]);
    });
  });
});

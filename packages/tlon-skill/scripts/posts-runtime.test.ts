import { afterEach, describe, expect, it, spyOn } from 'bun:test';

import { CommandError } from './commands/command';
import * as groupAdmin from './group-admin';
import { markdownToStory } from './markdown';
import { FETCH_FAILED_ERROR, isMediaPolicyRejection } from './media-guard';
import { createPostsDeps } from './posts-runtime';
import {
  mockedDeleteReply,
  mockedGetChannelPosts,
  mockedGetGroup,
  mockedGetPostWithReplies,
  mockedScry,
  mockedSetOrder,
} from './tloncorp-api-mock';

const defaultGetChannelPosts = mockedGetChannelPosts.impl;
const originalGetGroup = mockedGetGroup.impl;

afterEach(() => {
  mockedGetChannelPosts.impl = defaultGetChannelPosts;
  mockedGetGroup.impl = originalGetGroup;
  mockedGetPostWithReplies.impl = async () => undefined;
  mockedDeleteReply.impl = async () => undefined;
  mockedSetOrder.impl = async () => undefined;
  mockedScry.impl = async () => undefined;
});

// What `toPostReplyData` stores in a reply's `content`: the JSON of the
// converted story. Built by hand here, in the desk's key order, so the test
// does not reuse the projection under test.
const DESK_IMAGE_CONTENT = JSON.stringify([
  {
    block: {
      image: { width: 0, alt: 'cat', src: 'https://x.test/cat.png', height: 0 },
    },
  },
]);

describe('createPostsDeps().postsApi.getPostWithReplies', () => {
  it('projects the thread and every reply field the read-back compares', async () => {
    const received: unknown[] = [];
    mockedGetPostWithReplies.impl = async (...args: unknown[]) => {
      received.push(args[0]);
      return {
        id: '170.141.184.500',
        authorId: '~host',
        isDeleted: false,
        sentAt: 1700,
        // Two paragraphs, the first with a line break.
        content: JSON.stringify([
          { inline: ['line ', { bold: ['one'] }, { break: null }, 'line two'] },
          { inline: ['second paragraph'] },
        ]),
        replies: [
          {
            id: '170.141.184.501',
            authorId: '~zod',
            isBot: true,
            botProfile: { nickname: 'Botty', avatar: 'https://x.test/b.png' },
            sentAt: 4242,
            blob: '[{"type":"x"}]',
            content: JSON.stringify([{ inline: ['hello'] }]),
          },
          {
            id: '170.141.184.502',
            authorId: '~nec',
            isBot: false,
            isDeleted: true,
            sentAt: 9,
          },
        ],
      };
    };

    const thread = await createPostsDeps().postsApi.getPostWithReplies({
      channelId: 'chat/~host/channel',
      postId: '170.141.184.500',
    });

    expect(received).toEqual([
      {
        channelId: 'chat/~host/channel',
        postId: '170.141.184.500',
        authorId: '~zod',
      },
    ]);
    expect(thread).toEqual({
      id: '170.141.184.500',
      authorId: '~host',
      isDeleted: false,
      sentAt: 1700,
      contentKey:
        '[{"inline":["line ",{"bold":["one"]},{"break":null},"line two"]},{"inline":["second paragraph"]}]',
      quoteText: 'line one\nline two',
      replies: [
        {
          id: '170.141.184.501',
          authorId: '~zod',
          isBot: true,
          botProfile: { nickname: 'Botty', avatar: 'https://x.test/b.png' },
          isDeleted: undefined,
          sentAt: 4242,
          blob: '[{"type":"x"}]',
          contentKey: '[{"inline":["hello"]}]',
        },
        {
          id: '170.141.184.502',
          authorId: '~nec',
          isBot: false,
          isDeleted: true,
          sentAt: 9,
          blob: undefined,
          contentKey: 'null',
        },
      ],
    });
  });

  it('passes an explicit authorId, defaulting to the acting ship', async () => {
    const received: unknown[] = [];
    mockedGetPostWithReplies.impl = async (...args: unknown[]) => {
      received.push(args[0]);
      return { id: '1', authorId: '~bus', replies: [] };
    };
    const api = createPostsDeps().postsApi;

    await api.getPostWithReplies({
      channelId: '~bus',
      postId: '170.141',
      authorId: '~bus',
    });
    await api.getPostWithReplies({ channelId: '~bus', postId: '170.141' });

    expect(received).toEqual([
      { channelId: '~bus', postId: '170.141', authorId: '~bus' },
      { channelId: '~bus', postId: '170.141', authorId: '~zod' },
    ]);
  });

  it('quotes only the first paragraph, keeping tasks and group mentions, and reads no text from a reference or image', async () => {
    const cases: Array<[unknown, string]> = [
      [JSON.stringify([{ inline: ['one'] }, { inline: ['two'] }]), 'one'],
      [
        JSON.stringify([
          { block: { image: { src: 'https://x.test/a.png' } } },
          {
            inline: [
              { ship: '~nec' },
              ' see ',
              { link: { href: 'https://x.test', content: 'this' } },
            ],
          },
        ]),
        '~nec see this',
      ],
      [
        JSON.stringify([
          { inline: [{ task: { checked: false, content: ['pay invoice'] } }] },
        ]),
        '[ ] pay invoice',
      ],
      [JSON.stringify([{ inline: [{ sect: null }, ' hello'] }]), '@all hello'],
      [
        JSON.stringify([
          {
            type: 'reference',
            referenceType: 'channel',
            channelId: 'chat/~host/c',
            postId: '1',
          },
        ]),
        '',
      ],
      [null, ''],
      ['not json', ''],
    ];
    for (const [content, quoteText] of cases) {
      mockedGetPostWithReplies.impl = async () => ({
        id: '1',
        authorId: '~bus',
        content,
        replies: [],
      });
      const thread = await createPostsDeps().postsApi.getPostWithReplies({
        channelId: '~bus',
        postId: '1',
      });
      expect(thread.quoteText).toBe(quoteText);
    }
  });

  it('passes read errors through raw for the command to interpret', async () => {
    mockedGetPostWithReplies.impl = async () => {
      throw new Error('scry 404');
    };

    await expect(
      createPostsDeps().postsApi.getPostWithReplies({
        channelId: 'chat/~host/channel',
        postId: '1',
      })
    ).rejects.toThrow('scry 404');
  });
});

describe('createPostsDeps().postsApi.getChannelPosts', () => {
  it('adds the read-back contentKey to each post', async () => {
    const received: unknown[] = [];
    mockedGetChannelPosts.impl = async (...args: unknown[]) => {
      received.push(args[0]);
      return {
        posts: [
          {
            id: '170.141.184.600',
            authorId: '~zod',
            sentAt: 1700,
            isDeleted: false,
            content: JSON.stringify([{ inline: ['hi'] }]),
          },
          { id: '170.141.184.601', authorId: '~nec', sentAt: 1701 },
        ],
        older: null,
      };
    };
    const query = {
      channelId: 'chat/~host/channel',
      mode: 'newest' as const,
      count: 20,
      includeReplies: false,
    };

    const result = await createPostsDeps().postsApi.getChannelPosts(query);

    expect(received).toEqual([query]);
    // The api's fields pass through untouched, so the result is wider than
    // ExistingPost.
    expect(result as unknown).toEqual({
      posts: [
        {
          id: '170.141.184.600',
          authorId: '~zod',
          sentAt: 1700,
          isDeleted: false,
          content: JSON.stringify([{ inline: ['hi'] }]),
          contentKey: '[{"inline":["hi"]}]',
        },
        {
          id: '170.141.184.601',
          authorId: '~nec',
          sentAt: 1701,
          contentKey: 'null',
        },
      ],
    });
  });

  it('keys a stored, converted reference like the cite story that was sent', async () => {
    const cite = {
      block: {
        cite: {
          chan: {
            nest: 'chat/~nec/general',
            where: '/msg/170141184507208218934405025845542912000',
          },
        },
      },
    };
    // What the api stores for that cite: the converted reference, in the
    // desk's key order rather than the story's.
    const stored = JSON.stringify([
      {
        postId: '170.141.184.507.208.218.934.405.025.845.542.912.000',
        referenceType: 'channel',
        type: 'reference',
        channelId: 'chat/~nec/general',
      },
      { inline: ['Look at this'] },
    ]);
    mockedGetChannelPosts.impl = async () => ({
      posts: [{ id: '1', authorId: '~zod', sentAt: 1, content: stored }],
    });
    const deps = createPostsDeps();

    const result = await deps.postsApi.getChannelPosts({
      channelId: 'chat/~zod/team',
      mode: 'newest',
      count: 20,
      includeReplies: false,
    });

    expect(result.posts[0].contentKey).toBe(
      deps.contentKeyOf([cite, { inline: ['Look at this'] }])
    );
  });
});

describe('createPostsDeps().contentKeyOf', () => {
  it('matches the read-back projection of the same story in another key order', async () => {
    const story = markdownToStory('![cat](https://x.test/cat.png)');
    mockedGetPostWithReplies.impl = async () => ({
      id: '1',
      authorId: '~host',
      replies: [
        { id: '2', authorId: '~zod', sentAt: 1, content: DESK_IMAGE_CONTENT },
      ],
    });
    const deps = createPostsDeps();
    const thread = await deps.postsApi.getPostWithReplies({
      channelId: 'chat/~host/channel',
      postId: '1',
    });

    // Sanity: the two sides really do differ in key order.
    expect(JSON.stringify(story)).not.toBe(DESK_IMAGE_CONTENT);
    expect(thread.replies[0].contentKey).toBe(deps.contentKeyOf(story));
  });

  it('matches the read-back of a story with role mentions', async () => {
    const story = markdownToStory('hi @admin and @all', {
      roleIds: new Set(['admin']),
    });
    mockedGetPostWithReplies.impl = async () => ({
      id: '1',
      authorId: '~host',
      replies: [
        {
          id: '2',
          authorId: '~zod',
          sentAt: 1,
          content: JSON.stringify([
            { inline: ['hi ', { sect: 'admin' }, ' and ', { sect: null }] },
          ]),
        },
      ],
    });
    const deps = createPostsDeps();
    const thread = await deps.postsApi.getPostWithReplies({
      channelId: 'chat/~host/channel',
      postId: '1',
    });

    expect(thread.replies[0].contentKey).toBe(deps.contentKeyOf(story));
  });

  it('distinguishes a changed image URL or text', () => {
    const deps = createPostsDeps();
    const base = deps.contentKeyOf(
      markdownToStory('![cat](https://x.test/cat.png)')
    );

    expect(
      deps.contentKeyOf(markdownToStory('![cat](https://x.test/dog.png)'))
    ).not.toBe(base);
    expect(deps.contentKeyOf(markdownToStory('hello'))).not.toBe(
      deps.contentKeyOf(markdownToStory('hello there'))
    );
  });
});

describe('createPostsDeps() error mapping', () => {
  it('turns plain errors from setOrder, deleteReply and the order scry into CommandErrors', async () => {
    mockedSetOrder.impl = async () => {
      throw new Error('order poke failed');
    };
    mockedDeleteReply.impl = async () => {
      throw new Error('delete poke failed');
    };
    mockedScry.impl = async () => {
      throw new Error('scry failed');
    };
    const deps = createPostsDeps();

    const failures = await Promise.allSettled([
      deps.postsApi.setOrder('chat/~host/channel', ['1']),
      deps.postsApi.deleteReply({
        channelId: 'chat/~host/channel',
        parentId: '1',
        parentAuthorId: '~host',
        postId: '2',
        authorId: '~zod',
      }),
      deps.getChannelState('chat/~host/channel'),
    ]);

    expect(
      failures.map((result) =>
        result.status === 'rejected'
          ? [result.reason instanceof CommandError, result.reason.message]
          : null
      )
    ).toEqual([
      [true, 'order poke failed'],
      [true, 'delete poke failed'],
      [true, 'scry failed'],
    ]);
  });

  it('forwards setOrder and deleteReply arguments to the api', async () => {
    const orders: unknown[] = [];
    const deletes: unknown[] = [];
    mockedSetOrder.impl = async (...args: unknown[]) => {
      orders.push(args);
    };
    mockedDeleteReply.impl = async (...args: unknown[]) => {
      deletes.push(args[0]);
    };
    const deps = createPostsDeps();
    const input = {
      channelId: 'chat/~host/channel',
      parentId: '1',
      parentAuthorId: '~host',
      postId: '2',
      authorId: '~zod',
    };

    await deps.postsApi.setOrder('chat/~host/channel', ['1', '2']);
    await deps.postsApi.deleteReply(input);

    expect(orders).toEqual([['chat/~host/channel', ['1', '2']]]);
    expect(deletes).toEqual([input]);
  });

  it('wraps an admin refusal as a CommandError with its message', async () => {
    // Stubbed so the helper's real retry loop (5 reads, 500 ms apart) never runs.
    const helper = spyOn(
      groupAdmin,
      'assertActingShipCanAdminister'
    ).mockImplementation(async () => {
      throw new Error("Can't pin posts in ~host/group: not an admin");
    });
    try {
      const refusal = await createPostsDeps()
        .assertCanAdminister('~host/group', 'pin posts', 'chat/~host/channel')
        .catch((error: unknown) => error);

      expect(helper.mock.calls).toEqual([['~host/group', 'pin posts']]);
      expect(refusal).toBeInstanceOf(CommandError);
      expect((refusal as CommandError).message).toBe(
        "Can't pin posts in ~host/group: not an admin"
      );
    } finally {
      helper.mockRestore();
    }
  });

  it('runs the group admin check when the channel host is another ship', async () => {
    const helper = spyOn(
      groupAdmin,
      'assertActingShipCanAdminister'
    ).mockImplementation(async () => undefined);
    try {
      await createPostsDeps().assertCanAdminister(
        '~zod/group',
        'pin posts',
        'chat/~host/channel'
      );

      expect(helper.mock.calls).toEqual([['~zod/group', 'pin posts']]);
    } finally {
      helper.mockRestore();
    }
  });

  it('admits the channel host (the acting ship) without the group admin check', async () => {
    // The mocked acting ship is ~zod; the group is hosted elsewhere and the
    // group check would refuse, but ~zod hosts the channel.
    const helper = spyOn(
      groupAdmin,
      'assertActingShipCanAdminister'
    ).mockImplementation(async () => {
      throw new Error("Can't pin posts in ~host/group: not an admin");
    });
    try {
      for (const nest of ['chat/~zod/channel', 'heap/zod/gallery']) {
        await expect(
          createPostsDeps().assertCanAdminister(
            '~host/group',
            'pin posts',
            nest
          )
        ).resolves.toBeUndefined();
      }
      expect(helper.mock.calls).toEqual([]);
    } finally {
      helper.mockRestore();
    }
  });
});

describe('createPostsDeps().getGroupRoleIds', () => {
  it('maps getGroup roles to ids', async () => {
    const requested: unknown[] = [];
    mockedGetGroup.impl = async (...args: unknown[]) => {
      requested.push(args[0]);
      return {
        roles: [
          { id: 'admin', title: 'Admins' },
          { id: 'moderators', title: 'Mods' },
        ],
      };
    };

    expect(await createPostsDeps().getGroupRoleIds('~host/group')).toEqual([
      'admin',
      'moderators',
    ]);
    expect(requested).toEqual(['~host/group']);
  });

  it('returns no ids for a group without roles', async () => {
    mockedGetGroup.impl = async () => ({});

    expect(await createPostsDeps().getGroupRoleIds('~host/group')).toEqual([]);
  });

  it('passes a read failure through raw for the command to word', async () => {
    mockedGetGroup.impl = async () => {
      throw new Error('scry 404');
    };

    await expect(
      createPostsDeps().getGroupRoleIds('~host/group')
    ).rejects.toThrow('scry 404');
  });
});

describe('createPostsDeps().probeMedia', () => {
  it('is the guarded HEAD: a denied host is refused before any request', async () => {
    const error = await createPostsDeps()
      .probeMedia('https://localhost/report.pdf')
      .catch((caught: unknown) => caught);

    expect((error as Error).message).toBe(FETCH_FAILED_ERROR);
    expect(isMediaPolicyRejection(error)).toBe(true);
  });
});

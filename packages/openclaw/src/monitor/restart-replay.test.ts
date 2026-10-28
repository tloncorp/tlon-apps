import type { ActivityInit, ChangesV11 } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import { collectMissedMessages } from './restart-replay.js';

const NEST = 'chat/~zod/general';
const META = { replyCount: 0, lastRepliers: [], lastReply: null };
const essay = (sent: number) => ({
  content: [{ inline: [`msg ${sent}`] }],
  author: '~bus',
  sent,
});
const post = (
  id: string,
  sent: number,
  replies: Record<string, unknown> = {}
) => ({
  seal: { id, replies, reacts: {}, meta: META },
  essay: essay(sent),
  type: 'post',
});
const reply = (id: string, parentId: string, sent: number) => ({
  seal: { id, 'parent-id': parentId, reacts: {} },
  'reply-essay': { ...essay(sent), blob: null },
});

function unreads(options: {
  sources?: Record<string, string | null>;
  threads?: { channelId: string; threadId: string; first: string }[];
}): ActivityInit {
  return {
    groupUnreads: [],
    channelUnreads: Object.entries(options.sources ?? {}).map(
      ([channelId, firstUnreadPostId]) => ({
        channelId,
        type: 'channel',
        updatedAt: 1,
        count: firstUnreadPostId ? 1 : 0,
        notify: false,
        countWithoutThreads: firstUnreadPostId ? 1 : 0,
        firstUnreadPostId,
      })
    ),
    threadActivity: (options.threads ?? []).map((t) => ({
      channelId: t.channelId,
      threadId: t.threadId,
      updatedAt: 1,
      count: 1,
      notify: false,
      firstUnreadPostId: t.first,
    })),
  } as ActivityInit;
}

const changes = (input: { channels?: unknown; chat?: unknown }) =>
  ({ channels: input.channels ?? {}, chat: input.chat ?? {} }) as Pick<
    ChangesV11,
    'channels' | 'chat'
  >;

describe('restart replay', () => {
  it('replays channel posts at or after the first unread, as firehose post events', () => {
    const items = collectMissedMessages(
      changes({
        channels: {
          [NEST]: {
            '170.141.184.100': post('170.141.184.100', 1),
            '170.141.184.200': post('170.141.184.200', 2),
            '170.141.184.300': post('170.141.184.300', 3),
          },
        },
      }),
      unreads({ sources: { [NEST]: '170.141.184.200' } })
    );

    expect(items.map((i) => i.event)).toEqual([
      {
        nest: NEST,
        response: {
          post: {
            id: '170.141.184.200',
            'r-post': { set: post('170.141.184.200', 2) },
          },
        },
      },
      {
        nest: NEST,
        response: {
          post: {
            id: '170.141.184.300',
            'r-post': { set: post('170.141.184.300', 3) },
          },
        },
      },
    ]);
  });

  it('skips sources with nothing unread, so already-handled posts never replay', () => {
    const items = collectMissedMessages(
      changes({
        channels: { [NEST]: { '170.141.184.100': post('170.141.184.100', 1) } },
        chat: {
          '~bus': { '~bus/170.141.184.100': post('~bus/170.141.184.100', 1) },
        },
      }),
      unreads({ sources: { [NEST]: null } })
    );

    expect(items).toEqual([]);
  });

  it('replays unread thread replies by their thread anchor, with the parent meta', () => {
    const parent = '170.141.184.100';
    const items = collectMissedMessages(
      changes({
        channels: {
          [NEST]: {
            [parent]: post(parent, 1, {
              '170.141.184.150': reply('170.141.184.150', parent, 2),
              '170.141.184.250': reply('170.141.184.250', parent, 3),
            }),
          },
        },
      }),
      unreads({
        threads: [
          { channelId: NEST, threadId: parent, first: '170.141.184.250' },
        ],
      })
    );

    expect(items).toHaveLength(1);
    expect(items[0].event).toEqual({
      nest: NEST,
      response: {
        post: {
          id: parent,
          'r-post': {
            reply: {
              id: '170.141.184.250',
              meta: META,
              'r-reply': { set: reply('170.141.184.250', parent, 3) },
            },
          },
        },
      },
    });
  });

  it('drops old posts that only appear because they were edited or reacted to', () => {
    const items = collectMissedMessages(
      changes({
        channels: {
          [NEST]: {
            '170.141.184.1': post('170.141.184.1', 1),
            '170.141.184.900': post('170.141.184.900', 9),
          },
        },
      }),
      unreads({ sources: { [NEST]: '170.141.184.900' } })
    );

    expect(items.map((i) => i.sent)).toEqual([9]);
  });

  it('replays unread DM writs and DM thread replies as chat firehose events', () => {
    const writ = (
      id: string,
      sent: number,
      replies: Record<string, unknown> = {}
    ) => ({
      seal: { id, time: '170.141.184.999', replies, reacts: {}, meta: META },
      essay: essay(sent),
      type: 'writ',
    });
    const parent = '~bus/170.141.184.100';
    const items = collectMissedMessages(
      changes({
        chat: {
          '~bus': {
            [parent]: writ(parent, 1, {
              '~bus/170.141.184.150': reply('~bus/170.141.184.150', parent, 2),
            }),
            '~bus/170.141.184.300': writ('~bus/170.141.184.300', 3),
          },
        },
      }),
      unreads({
        sources: { '~bus': '170.141.184.300' },
        threads: [
          {
            channelId: '~bus',
            threadId: '170.141.184.100',
            first: '170.141.184.150',
          },
        ],
      })
    );

    expect(items.map((i) => i.event)).toEqual([
      {
        whom: '~bus',
        id: parent,
        response: {
          reply: {
            id: '~bus/170.141.184.150',
            meta: META,
            delta: {
              add: {
                'reply-essay': reply('~bus/170.141.184.150', parent, 2)[
                  'reply-essay'
                ],
                time: null,
              },
            },
          },
        },
      },
      {
        whom: '~bus',
        id: '~bus/170.141.184.300',
        response: { add: { essay: essay(3), time: '170.141.184.999' } },
      },
    ]);
  });

  it('orders everything oldest first across channels and DMs', () => {
    const items = collectMissedMessages(
      changes({
        channels: {
          [NEST]: { '170.141.184.500': post('170.141.184.500', 30) },
        },
        chat: {
          '~bus': { '~bus/170.141.184.500': post('~bus/170.141.184.500', 10) },
        },
      }),
      unreads({ sources: { [NEST]: '170.141.184.1', '~bus': '170.141.184.1' } })
    );

    expect(items.map((i) => i.kind)).toEqual(['chat', 'channel']);
    expect(items.map((i) => i.key)).toEqual(['dm/~bus', `channel/${NEST}`]);
  });

  it('ignores tombstones and deleted channels', () => {
    const items = collectMissedMessages(
      changes({
        channels: {
          [NEST]: {
            '170.141.184.500': {
              type: 'tombstone',
              seal: { id: '170.141.184.500' },
            },
          },
          'chat/~zod/gone': null,
        },
      }),
      unreads({ sources: { [NEST]: '170.141.184.1' } })
    );

    expect(items).toEqual([]);
  });
});

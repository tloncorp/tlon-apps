import { describe, expect, it } from 'vitest';

import { collectMissedMessages, unreadAnchors } from './restart-replay.js';

const NEST = 'chat/~zod/general';
const essay = (sent: number, text = `msg ${sent}`) => ({
  content: [{ inline: [text] }],
  author: '~bus',
  sent,
});
const post = (
  id: string,
  sent: number,
  replies: Record<string, unknown> | null = null
) => ({
  seal: { id, replies, reacts: {} },
  essay: essay(sent),
  type: 'post',
});
const reply = (id: string, parentId: string, sent: number) => ({
  seal: { id, 'parent-id': parentId, reacts: {} },
  'reply-essay': { ...essay(sent), blob: null },
});

const anchors = (options: {
  channels?: Record<string, string>;
  threads?: { channelId: string; threadId: string; first: string }[];
}) =>
  unreadAnchors({
    channelUnreads: Object.entries(options.channels ?? {}).map(
      ([channelId, firstUnreadPostId]) => ({ channelId, firstUnreadPostId })
    ),
    threadActivity: (options.threads ?? []).map((t) => ({
      channelId: t.channelId,
      threadId: t.threadId,
      firstUnreadPostId: t.first,
    })),
  });

describe('restart replay', () => {
  it('replays channel posts at or after the first unread, as firehose post events', () => {
    const items = collectMissedMessages({
      channels: {
        [NEST]: {
          '170.141.184.100': post('170.141.184.100', 1),
          '170.141.184.200': post('170.141.184.200', 2),
          '170.141.184.300': post('170.141.184.300', 3),
        },
      },
      chat: {},
      anchors: anchors({ channels: { [NEST]: '170.141.184.200' } }),
    });

    expect(items.map((i) => i.event.response)).toEqual([
      {
        post: {
          id: '170.141.184.200',
          'r-post': { set: post('170.141.184.200', 2) },
        },
      },
      {
        post: {
          id: '170.141.184.300',
          'r-post': { set: post('170.141.184.300', 3) },
        },
      },
    ]);
    expect(items[0]).toMatchObject({ kind: 'channel', event: { nest: NEST } });
  });

  it('skips sources with nothing unread, so already-handled posts never replay', () => {
    const items = collectMissedMessages({
      channels: { [NEST]: { '170.141.184.100': post('170.141.184.100', 1) } },
      chat: {
        '~bus': { '~bus/170.141.184.100': post('~bus/170.141.184.100', 1) },
      },
      anchors: anchors({}),
    });

    expect(items).toEqual([]);
  });

  it('replays unread thread replies by their thread anchor, as reply events', () => {
    const parent = '170.141.184.100';
    const items = collectMissedMessages({
      channels: {
        [NEST]: {
          [parent]: post(parent, 1, {
            '170.141.184.150': reply('170.141.184.150', parent, 2),
            '170.141.184.250': reply('170.141.184.250', parent, 3),
          }),
        },
      },
      chat: {},
      anchors: anchors({
        threads: [
          { channelId: NEST, threadId: parent, first: '170.141.184.250' },
        ],
      }),
    });

    expect(items).toHaveLength(1);
    expect(items[0].event.response).toEqual({
      post: {
        id: parent,
        'r-post': {
          reply: {
            id: '170.141.184.250',
            'r-reply': { set: reply('170.141.184.250', parent, 3) },
          },
        },
      },
    });
  });

  it('drops old posts that only appear because they were edited or reacted to', () => {
    const items = collectMissedMessages({
      channels: {
        [NEST]: {
          '170.141.184.1': post('170.141.184.1', 1),
          '170.141.184.900': post('170.141.184.900', 9),
        },
      },
      chat: {},
      anchors: anchors({ channels: { [NEST]: '170.141.184.900' } }),
    });

    expect(items.map((i) => i.sent)).toEqual([9]);
  });

  it('replays unread DM writs and DM thread replies as chat firehose events', () => {
    const writ = (
      id: string,
      sent: number,
      replies: Record<string, unknown> | null = null
    ) => ({
      seal: { id, time: '170.141.184.999', replies, reacts: {} },
      essay: essay(sent),
      type: 'writ',
    });
    const parent = '~bus/170.141.184.100';
    const items = collectMissedMessages({
      channels: {},
      chat: {
        '~bus': {
          [parent]: writ(parent, 1, {
            '~bus/170.141.184.150': reply('~bus/170.141.184.150', parent, 2),
          }),
          '~bus/170.141.184.300': writ('~bus/170.141.184.300', 3),
        },
      },
      anchors: anchors({
        channels: { '~bus': '170.141.184.300' },
        threads: [
          {
            channelId: '~bus',
            threadId: '170.141.184.100',
            first: '170.141.184.150',
          },
        ],
      }),
    });

    expect(items.map((i) => i.event)).toEqual([
      {
        whom: '~bus',
        id: parent,
        response: {
          reply: {
            id: '~bus/170.141.184.150',
            delta: {
              add: {
                'reply-essay': reply('~bus/170.141.184.150', parent, 2)[
                  'reply-essay'
                ],
              },
            },
          },
        },
      },
      {
        whom: '~bus',
        id: '~bus/170.141.184.300',
        response: {
          add: { essay: essay(3), time: '170.141.184.999' },
        },
      },
    ]);
  });

  it('orders everything oldest first across channels and DMs', () => {
    const items = collectMissedMessages({
      channels: { [NEST]: { '170.141.184.500': post('170.141.184.500', 30) } },
      chat: {
        '~bus': { '~bus/170.141.184.500': post('~bus/170.141.184.500', 10) },
      },
      anchors: anchors({
        channels: { [NEST]: '170.141.184.1', '~bus': '170.141.184.1' },
      }),
    });

    expect(items.map((i) => i.kind)).toEqual(['chat', 'channel']);
  });

  it('ignores tombstones and deleted channels', () => {
    const items = collectMissedMessages({
      channels: {
        [NEST]: {
          '170.141.184.500': {
            type: 'tombstone',
            seal: { id: '170.141.184.500' },
          },
        },
        'chat/~zod/gone': null,
      },
      chat: {},
      anchors: anchors({ channels: { [NEST]: '170.141.184.1' } }),
    });

    expect(items).toEqual([]);
  });
});

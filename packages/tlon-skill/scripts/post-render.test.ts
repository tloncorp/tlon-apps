import { describe, expect, it } from 'bun:test';

import {
  type RenderablePost,
  type WritePostListOptions,
  TARGET_ABSENT_NOTICE,
  renderPostBody,
  writePostBody,
  writePostList,
} from './post-render';

const POST_ID = '170.141.184.507.799.231.400.135.497.023.488.000.000';
const REPLY_ID = '170.141.184.507.799.231.500.000.000.000.000.000.000';

function post(
  story: unknown,
  extra: Partial<RenderablePost> = {}
): RenderablePost {
  return { content: JSON.stringify(story), ...extra };
}

function lines(input: RenderablePost): string[] {
  return renderPostBody(input).lines;
}

function blob(entries: unknown[]): string {
  return JSON.stringify(entries);
}

describe('renderPostBody', () => {
  it('renders a chat text post as text, not JSON', () => {
    expect(
      lines(
        post([{ inline: ['hello ', { bold: ['world'] }, { break: null }] }])
      )
    ).toEqual(['hello world']);
  });

  it('renders inline links, mentions and line breaks', () => {
    expect(
      lines(
        post([
          {
            inline: [
              'hi ',
              { ship: '~zod' },
              ' ',
              { sect: 'admin' },
              ' ',
              { link: { href: 'https://a.io', content: 'site' } },
              ' ',
              { link: { href: 'https://b.io', content: 'https://b.io' } },
              { break: null },
              'second line',
            ],
          },
        ])
      )
    ).toEqual([
      'hi ~zod @admin site (https://a.io) https://b.io',
      'second line',
    ]);
  });

  it('renders a chat image block with its URL', () => {
    expect(
      lines(
        post([
          { inline: ['look'] },
          {
            block: {
              image: {
                src: 'https://cdn.example/cat.png',
                alt: 'cat.png',
                width: 10,
                height: 10,
              },
            },
          },
        ])
      )
    ).toEqual(['look', '🖼 https://cdn.example/cat.png']);
  });

  it('renders a heap image post with title, caption and alt', () => {
    expect(
      lines(
        post(
          [
            {
              block: {
                image: {
                  src: 'https://cdn.example/a.jpg',
                  alt: 'a sunset',
                  width: 1,
                  height: 1,
                },
              },
            },
            { inline: ['caption text'] },
          ],
          { title: 'Sunset' }
        )
      )
    ).toEqual([
      'Title: Sunset',
      '🖼 https://cdn.example/a.jpg (a sunset)',
      'caption text',
    ]);
  });

  it('renders a heap link block with and without a title', () => {
    expect(
      lines(
        post([
          {
            block: {
              link: {
                url: 'https://site.example/a',
                meta: { title: 'A page' },
              },
            },
          },
          { block: { link: { url: 'https://site.example/b', meta: {} } } },
        ])
      )
    ).toEqual([
      '🔗 https://site.example/a — A page',
      '🔗 https://site.example/b',
    ]);
  });

  it('renders file blobs with unknown and zero sizes', () => {
    expect(
      lines(
        post([], {
          blob: blob([
            {
              type: 'file',
              version: 1,
              fileUri: 'https://cdn.example/report.pdf',
              mimeType: 'application/pdf',
              name: 'report.pdf',
              size: -1,
            },
            {
              type: 'file',
              version: 1,
              fileUri: 'https://cdn.example/empty.txt',
              mimeType: 'text/plain',
              name: 'empty.txt',
              size: 0,
            },
          ]),
        })
      )
    ).toEqual([
      '📎 [report.pdf] (application/pdf, unknown)',
      '   https://cdn.example/report.pdf',
      '📎 [empty.txt] (text/plain, 0KB)',
      '   https://cdn.example/empty.txt',
    ]);
  });

  it('renders a heap video post: story video block and blob fileUri', () => {
    expect(
      lines(
        post(
          [
            {
              block: {
                image: {
                  src: 'https://cdn.example/clip.mp4',
                  alt: 'clip',
                  width: 1,
                  height: 1,
                },
              },
            },
          ],
          {
            blob: blob([
              {
                type: 'video',
                version: 1,
                fileUri: 'https://cdn.example/clip.mp4',
                mimeType: 'video/mp4',
                name: 'clip.mp4',
                size: 2048,
              },
            ]),
          }
        )
      )
    ).toEqual([
      '🎬 https://cdn.example/clip.mp4',
      '🎬 [clip.mp4] (video/mp4)',
      '   https://cdn.example/clip.mp4',
    ]);
  });

  it('renders a DM blob alongside the text', () => {
    expect(
      lines(
        post([{ inline: ['see attached'] }], {
          blob: blob([
            {
              type: 'voicememo',
              version: 1,
              fileUri: 'https://cdn.example/memo.m4a',
              size: 100,
              duration: 4.4,
              transcription: 'hi there',
            },
          ]),
        })
      )
    ).toEqual(['see attached', '🎙️ [voice memo] (4s)', '   "hi there"']);
  });

  it('renders references as reusable /1/ paths and collects channel refs', () => {
    const channelRef = {
      type: 'reference',
      referenceType: 'channel',
      channelId: 'chat/~zod/general',
      postId: POST_ID,
      replyId: REPLY_ID,
    };
    const rendered = renderPostBody(
      post([
        channelRef,
        { type: 'reference', referenceType: 'group', groupId: '~zod/club' },
      ])
    );

    expect(rendered.lines).toEqual([
      `(Ref: /1/chan/chat/~zod/general/msg/${POST_ID}/${REPLY_ID})`,
      '(Ref: /1/group/~zod/club)',
    ]);
    expect(rendered.channelReferences).toEqual([channelRef as never]);
  });

  it('puts a styled quote on its own line', () => {
    expect(
      lines(
        post([
          { inline: ['before', { bold: [{ blockquote: ['q'] }] }, 'after'] },
        ])
      )
    ).toEqual(['before', '> q', 'after']);
  });

  it('prefixes every line of a quote with hard breaks', () => {
    expect(
      lines(
        post([
          { inline: [{ blockquote: ['one', { break: null }, 'two'] }] },
          {
            inline: [
              'before',
              { bold: [{ blockquote: ['three', { break: null }, 'four'] }] },
              'after',
            ],
          },
        ])
      )
    ).toEqual(['> one', '> two', 'before', '> three', '> four', 'after']);
  });

  it('shows the upgrade notice for unknown blob entries', () => {
    expect(
      lines(
        post([{ inline: ['text'] }], {
          blob: blob([
            { type: 'file', version: 1, fileUri: '' },
            { type: 'hologram', version: 1, src: 'https://cdn.example/h' },
            {
              type: 'file',
              version: 1,
              fileUri: 'https://cdn.example/ok.pdf',
              mimeType: 'application/pdf',
              name: 'ok.pdf',
              size: 2048,
            },
          ]),
        })
      )
    ).toEqual([
      'text',
      'Upgrade your app to see this post',
      'Upgrade your app to see this post',
      '📎 [ok.pdf] (application/pdf, 2KB)',
      '   https://cdn.example/ok.pdf',
    ]);
  });

  it('keeps an empty one-column table row', () => {
    expect(
      lines(
        post([
          {
            inline: [
              '| a |',
              { break: null },
              '|---|',
              { break: null },
              '|  |',
              { break: null },
              '| b |',
            ],
          },
        ])
      )
    ).toEqual(['a', '---', '', 'b']);
  });

  it('renders every table row with empty cells preserved', () => {
    expect(
      lines(
        post([
          {
            inline: [
              '| a | b |',
              { break: null },
              '|---|---|',
              { break: null },
              '| 1 |  |',
              { break: null },
              '| [x](https://x.io) | 2 |',
            ],
          },
        ])
      )
    ).toEqual(['a | b', '--- | ---', '1 | ', 'x (https://x.io) | 2']);
  });

  it('falls back to textContent on malformed content and keeps blob lines', () => {
    const input: RenderablePost = {
      content: '{not json',
      textContent: 'preview text',
      blob: blob([
        {
          type: 'file',
          version: 1,
          fileUri: 'https://cdn.example/a.zip',
          mimeType: 'application/zip',
          name: 'a.zip',
          size: 4096,
        },
      ]),
    };

    expect(lines(input)).toEqual([
      'preview text',
      '📎 [a.zip] (application/zip, 4KB)',
      '   https://cdn.example/a.zip',
    ]);
  });

  it('falls back on a story that fails conversion, never printing JSON', () => {
    const input = post([{ block: { mystery: { x: 1 } } }], {
      textContent: 'fallback',
    });
    expect(lines(input)).toEqual(['fallback']);
    expect(lines({ ...input, textContent: null })).toEqual([]);
  });

  it('renders a search-result row the same as a listing row', () => {
    expect(
      lines(
        post([{ inline: ['found ', { 'inline-code': 'needle' }] }], {
          title: '',
        })
      )
    ).toEqual(['found needle']);
  });
});

describe('writePostBody', () => {
  const quoted = post([
    { inline: ['quoting'] },
    {
      type: 'reference',
      referenceType: 'channel',
      channelId: 'chat/~zod/general',
      postId: POST_ID,
      replyId: REPLY_ID,
    },
    { type: 'reference', referenceType: 'group', groupId: '~zod/club' },
  ]);

  it('writes indented lines and resolves only channel references', async () => {
    const written: string[] = [];
    const requested: unknown[] = [];

    await writePostBody(quoted, {
      write: (line) => written.push(line),
      indent: '  ',
      getPostReference: async (reference) => {
        requested.push(reference);
        return post([
          {
            block: {
              image: {
                src: 'https://cdn.example/q.png',
                alt: '',
                width: 1,
                height: 1,
              },
            },
          },
        ]);
      },
    });

    expect(requested).toEqual([
      { channelId: 'chat/~zod/general', postId: POST_ID, replyId: REPLY_ID },
    ]);
    expect(written).toEqual([
      '  quoting',
      `  (Ref: /1/chan/chat/~zod/general/msg/${POST_ID}/${REPLY_ID})`,
      '  (Ref: /1/group/~zod/club)',
      '  > 🖼 https://cdn.example/q.png',
    ]);
  });

  it('makes no lookups without a resolver and skips failed lookups', async () => {
    const written: string[] = [];
    await writePostBody(quoted, { write: (line) => written.push(line) });
    expect(written).toHaveLength(3);

    const afterFailure: string[] = [];
    await writePostBody(quoted, {
      write: (line) => afterFailure.push(line),
      getPostReference: async () => {
        throw new Error('timeout');
      },
    });
    expect(afterFailure).toEqual(written);
  });

  it('writes a messages-post root with its blob, then the replies', async () => {
    const root = post([{ inline: ['root text'] }], {
      title: 'Root',
      blob: blob([
        {
          type: 'file',
          version: 1,
          fileUri: 'https://cdn.example/root.pdf',
          mimeType: 'application/pdf',
          name: 'root.pdf',
          size: 1024,
        },
      ]),
    });
    const reply = post([{ inline: ['a reply'] }]);
    const written: string[] = [];

    await writePostBody(root, { write: (line) => written.push(line) });
    await writePostBody(reply, {
      write: (line) => written.push(line),
      indent: '  ',
    });

    expect(written).toEqual([
      'Title: Root',
      'root text',
      '📎 [root.pdf] (application/pdf, 1KB)',
      '   https://cdn.example/root.pdf',
      '  a reply',
    ]);
  });
});
describe('writePostList', () => {
  const LIMIT_WARNING =
    '⚠ receipt order ≠ sent order in this window: messages sent within this span may be missing — increase --limit to verify.';
  const SPAN_WARNING =
    '⚠ receipt order ≠ sent order in this span (late-delivered messages are marked with "received" where receipt times are available).';
  const LAG_WARNING =
    '⚠ sent and received times diverge materially in this window: messages sent within this span may fall outside it — increase --limit to verify.';
  const GAP_NOTE =
    "⚠ 1 sequence number(s) in this window's range have no record — moderation-blocked or deleted posts, or records the ship did not return.";

  const DA_SECOND = BigInt('18446744073709551616');
  const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000');
  /** Inverse of the runtime's @da conversion, as in messages-runtime.test.ts. */
  const unixMsToUd = (unixMs: number): string => {
    const offset = DA_SECOND / BigInt(2000);
    const daNum =
      DA_UNIX_EPOCH - offset + (BigInt(unixMs) * DA_SECOND) / BigInt(1000);
    return daNum.toString(10).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const T0 = 1_750_000_000_000;
  const HOUR = 60 * 60 * 1000;

  const windowPost = (
    id: string,
    seq: number,
    sentAt: number,
    receivedAt: number
  ) =>
    ({
      id,
      authorId: '~zod',
      sentAt,
      sequenceNum: seq,
      backendTime: unixMsToUd(receivedAt),
      parentId: null,
      blob: null,
      content: JSON.stringify([{ inline: [id] }]),
    }) as never;

  /** Probe (prompt, receipt-oldest) + three writs delivered ~10h late. */
  const skewedPage = () => [
    windowPost('probe-10', 10, T0, T0 + 400),
    windowPost('late-11', 11, T0 - 12 * HOUR, T0 + 600_000),
    windowPost('late-12', 12, T0 - 11 * HOUR, T0 + 600_100),
    windowPost('late-13', 13, T0 - 10 * HOUR, T0 + 600_200),
  ];

  const cleanPage = () => [
    windowPost('writ-1', 1, T0, T0 + 200),
    windowPost('writ-2', 2, T0 + 60_000, T0 + 60_300),
  ];

  /** Internally ordered, but every writ delivered ~10h after it was sent. */
  const laggedPage = () => [
    windowPost('lag-1', 1, T0 - 10 * HOUR, T0),
    windowPost('lag-2', 2, T0 - 10 * HOUR + 60_000, T0 + 60_000),
  ];

  /** Clean order with sequence number 2 missing from the window's range. */
  const gappedPage = () => [
    windowPost('gap-1', 1, T0, T0 + 200),
    windowPost('gap-3', 3, T0 + 60_000, T0 + 60_300),
  ];

  async function run(
    posts: ReturnType<typeof cleanPage>,
    options: Omit<WritePostListOptions, 'write'> = {}
  ): Promise<string[]> {
    const written: string[] = [];
    await writePostList(posts, {
      write: (line) => written.push(line),
      ...options,
    });
    return written;
  }

  const idLines = (written: string[]) =>
    written.filter((line) => line.startsWith('  ID: '));

  it('leads with the warning and marks divergent posts in place', async () => {
    const written = await run(skewedPage(), {
      window: { truncated: true },
      displayLimit: 3,
    });

    expect(written[0]).toBe(LIMIT_WARNING);
    expect(written[1]).toBe('');
    // Receipt (seq) order, probe trimmed from display.
    expect(idLines(written)).toEqual([
      '  ID: late-11',
      '  ID: late-12',
      '  ID: late-13',
    ]);
    // The (received ...) line sits between the author line and the ID line.
    const authorIdx = written.findIndex((line) => line.startsWith('- ~zod @ '));
    expect(written[authorIdx + 1]).toStartWith('  (received ');
    expect(written[authorIdx + 2]).toBe('  ID: late-11');
    // The post body still renders through `renderPostBody`, indented.
    expect(written[authorIdx + 3]).toBe('  late-11');
  });

  it('warns without the limit advice when the window is complete', async () => {
    const written = await run(skewedPage(), { window: { truncated: false } });

    expect(written[0]).toBe(SPAN_WARNING);
    expect(idLines(written)).toEqual([
      '  ID: probe-10',
      '  ID: late-11',
      '  ID: late-12',
      '  ID: late-13',
    ]);
  });

  it('warns on material lag alone when a truncated window looks ordered', async () => {
    const written = await run(laggedPage(), { window: { truncated: true } });

    expect(written[0]).toBe(LAG_WARNING);
    expect(idLines(written)).toEqual(['  ID: lag-1', '  ID: lag-2']);
  });

  it('notes sequence numbers the window never returned', async () => {
    const written = await run(gappedPage(), { window: { truncated: false } });

    expect(written[0]).toBe(GAP_NOTE);
    expect(written[1]).toBe('');
    expect(idLines(written)).toEqual(['  ID: gap-1', '  ID: gap-3']);
  });

  it('stays quiet on a clean window and keeps sent order', async () => {
    const written = await run(cleanPage(), { window: { truncated: false } });

    expect(written.some((line) => line.startsWith('⚠'))).toBe(false);
    expect(written.some((line) => line.includes('(received '))).toBe(false);
    expect(idLines(written)).toEqual(['  ID: writ-1', '  ID: writ-2']);
  });

  it('reports a target the window does not contain', async () => {
    const written = await run(cleanPage(), {
      window: { truncated: true },
      highlightId: 'not-here',
    });

    expect(written[0]).toBe(TARGET_ABSENT_NOTICE);
    expect(written[1]).toBe('');
    expect(idLines(written)).toEqual(['  ID: writ-1', '  ID: writ-2']);

    // Present targets are marked instead, with no notice.
    const found = await run(cleanPage(), {
      window: { truncated: true },
      highlightId: 'writ-2',
    });
    expect(found).not.toContain(TARGET_ABSENT_NOTICE);
    expect(found.some((line) => line.endsWith(' ◀ TARGET'))).toBe(true);
  });

  it('reports an absent target on an empty page too', async () => {
    expect(await run([], { highlightId: 'not-here' })).toEqual([
      TARGET_ABSENT_NOTICE,
      '',
      'No messages found.',
    ]);
    expect(await run([])).toEqual(['No messages found.']);
  });

  it('falls back to sent order without a window context', async () => {
    // Search results and a post's replies: no receipt-order analysis, so no
    // warning and no probe trimming even on an oversized page.
    const written = await run(skewedPage(), { displayLimit: 3 });

    expect(written.some((line) => line.startsWith('⚠'))).toBe(false);
    expect(idLines(written)).toEqual([
      '  ID: late-11',
      '  ID: late-12',
      '  ID: late-13',
      '  ID: probe-10',
    ]);
  });
});

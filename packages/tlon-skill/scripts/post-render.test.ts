import { describe, expect, it } from 'bun:test';

import {
  type RenderablePost,
  renderPostBody,
  writePostBody,
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

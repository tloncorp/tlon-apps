import type { ContentReference } from '@tloncorp/api';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
// (bun resolves it fine at runtime and in tests)
import { markdownToStory } from '@tloncorp/api/client/markdown';
import { describe, expect, it } from 'bun:test';

import {
  type FetchRef,
  createRefBudget,
  extractPostText,
  extractReferences,
  formatBodyLines,
  formatQuoteLines,
  parsePostContent,
  formatTime,
  renderPostJsonLine,
  renderPostLines,
  renderPostListJsonLines,
  renderPostListLines,
  renderRefLines,
  sanitizeInlineField,
} from './message-content';

function groupRef(groupId: unknown): ContentReference {
  return {
    type: 'reference',
    referenceType: 'group',
    groupId,
  } as unknown as ContentReference;
}

function channelRef(postId: string, replyId?: string): ContentReference {
  return {
    type: 'reference',
    referenceType: 'channel',
    channelId: 'chat/~host/general',
    postId,
    ...(replyId === undefined ? {} : { replyId }),
  } as ContentReference;
}

/** Stand-in for the `getPostReference` call `messages.ts` injects. */
function recordingFetchRef(
  body: (ref: { postId: string }) => string = () => 'quoted body'
) {
  const calls: {
    channelId: string;
    postId: string;
    replyId?: string;
  }[] = [];
  const fetchRef: FetchRef = async (ref) => {
    calls.push(ref);
    return { content: JSON.stringify([{ inline: [body(ref)] }]) };
  };
  return { fetchRef, calls };
}

function rejectingFetchRef() {
  const calls: { postId: string }[] = [];
  const fetchRef: FetchRef = async (ref) => {
    calls.push(ref);
    throw new Error('reference did not hydrate');
  };
  return { fetchRef, calls };
}

describe('parsePostContent', () => {
  it('parses the stringified content the fetchers return', () => {
    expect(parsePostContent(JSON.stringify([{ inline: ['hi'] }]))).toEqual([
      { inline: ['hi'] },
    ] as never);
  });

  it('passes story arrays through and unwraps a story wrapper', () => {
    const story = [{ inline: ['hi'] }];
    expect(parsePostContent(story)).toBe(story as never);
    expect(parsePostContent({ story })).toBe(story as never);
  });

  it('returns null for anything that is not a story array', () => {
    for (const input of [
      'null',
      '{}',
      '"hi"',
      '42',
      'not json at all',
      { a: 1 },
      0,
      false,
      '',
      null,
      undefined,
    ]) {
      expect(parsePostContent(input)).toBeNull();
    }
  });
});

describe('extractPostText', () => {
  it('renders stringified story content as plaintext', () => {
    const content = JSON.stringify([{ inline: ['a'] }, { inline: ['b'] }]);
    expect(extractPostText(content)).toBe('a\nb');
  });

  it('renders a group-ref-only post as a ref marker', () => {
    const content = JSON.stringify([groupRef('~host/slug')]);
    expect(extractPostText(content)).toBe('(Ref)');
  });

  it('renders reference verses alongside ur-format inline verses', () => {
    const content = JSON.stringify([
      groupRef('~host/slug'),
      { inline: ['check out this group'] },
    ]);
    expect(extractPostText(content)).toBe('(Ref)\ncheck out this group');
  });

  it('preserves the previous fallbacks for non-story content', () => {
    expect(extractPostText('null')).toBe('null');
    expect(extractPostText('{}')).toBe('{}');
    expect(extractPostText('"hi"')).toBe('"hi"');
    expect(extractPostText('not json at all')).toBe('not json at all');
    expect(extractPostText({ a: 1 })).toBe('{"a":1}');
    expect(extractPostText({ story: [{ inline: ['hi'] }] })).toBe('hi');
    expect(extractPostText(0)).toBe('');
    expect(extractPostText(false)).toBe('');
    expect(extractPostText('')).toBe('');
    expect(extractPostText(undefined)).toBe('');
  });

  it('falls back to the raw form when a verse element is malformed', () => {
    // `getTextContent` evaluates `'type' in verse` per element, which throws
    // on a null/scalar element.
    expect(extractPostText('[null]')).toBe('[null]');
    expect(extractPostText('[1,"two"]')).toBe('[1,"two"]');
  });
});

describe('url fidelity', () => {
  const story = (...verses: unknown[]) => JSON.stringify(verses);
  const link = (href: unknown, content: unknown) => ({
    link: { href, content },
  });

  it('renders a labeled inline link as markdown', () => {
    expect(
      extractPostText(
        story({ inline: ['see ', link('https://x.test/doc', 'the doc')] })
      )
    ).toBe('see [the doc](https://x.test/doc)');
  });

  it('renders a self-labeled or unlabeled link as the url alone', () => {
    // `[url](url)` is noise; a label-less link has nothing to put in front.
    expect(
      extractPostText(
        story({ inline: [link('https://x.test/a', 'https://x.test/a')] })
      )
    ).toBe('https://x.test/a');
    expect(
      extractPostText(story({ inline: [link('https://x.test/b', '')] }))
    ).toBe('https://x.test/b');
    expect(
      extractPostText(
        story({ inline: [{ link: { href: 'https://x.test/c' } }] })
      )
    ).toBe('https://x.test/c');
  });

  it('rewrites a link nested inside formatting', () => {
    expect(
      extractPostText(
        story({
          inline: [{ bold: ['read ', link('https://x.test/doc', 'the doc')] }],
        })
      )
    ).toBe('read [the doc](https://x.test/doc)');
    expect(
      extractPostText(
        story({
          inline: [
            { blockquote: [{ italics: [link('https://x.test/d', 'deep')] }] },
          ],
        })
      )
    ).toBe('> [deep](https://x.test/d)');
  });

  it('leaves a link whose href is not a string to the preview renderer', () => {
    expect(extractPostText(story({ inline: [link(123, 'the doc')] }))).toBe(
      'the doc'
    );
    // Fully degenerate link: the transform declines it and the preview
    // renderer's own pre-existing output stands (`content ?? href`).
    expect(extractPostText(story({ inline: [link(null, null)] }))).toBe('null');
  });

  it('renders an image block as its src instead of `(Image)`', () => {
    expect(
      extractPostText(
        story({
          block: {
            image: {
              src: 'https://x.test/i.png',
              alt: 'pic',
              width: 10,
              height: 10,
            },
          },
        })
      )
    ).toBe('https://x.test/i.png (pic)');
    expect(
      extractPostText(
        story({
          block: {
            image: {
              src: 'https://x.test/i.png',
              alt: '',
              width: 1,
              height: 1,
            },
          },
        })
      )
    ).toBe('https://x.test/i.png');
  });

  it('renders a link block instead of nothing', () => {
    expect(
      extractPostText(
        story({
          block: {
            link: { url: 'https://x.test/page', meta: { title: 'Some Title' } },
          },
        })
      )
    ).toBe('https://x.test/page (Some Title)');
    expect(
      extractPostText(
        story({ block: { link: { url: 'https://x.test/page', meta: {} } } })
      )
    ).toBe('https://x.test/page');
  });

  // Shapes straight from the production converter: a link in a header, a list
  // item, or a task sits one level below the verse, where the flat inline walk
  // never reached it.
  const fromMarkdown = (source: string) =>
    JSON.stringify(markdownToStory(source));

  it('rewrites a link inside a header', () => {
    expect(extractPostText(fromMarkdown('# [doc](https://x.test/h)'))).toBe(
      '[doc](https://x.test/h)'
    );
  });

  it('rewrites a link inside a list item', () => {
    expect(
      extractPostText(fromMarkdown('- [doc](https://x.test/l)'))
    ).toContain('[doc](https://x.test/l)');
  });

  it('rewrites a link inside a task item', () => {
    expect(
      extractPostText(fromMarkdown('- [ ] [doc](https://x.test/t)'))
    ).toContain('[ ] [doc](https://x.test/t)');
  });

  it('rewrites a link nested in a sub-list', () => {
    expect(
      extractPostText(
        story({
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [
                  {
                    list: {
                      type: 'unordered',
                      contents: ['outer'],
                      items: [{ item: [link('https://x.test/n', 'nested')] }],
                    },
                  },
                ],
              },
            },
          },
        })
      )
    ).toContain('[nested](https://x.test/n)');
  });

  it('leaves cites, references, and other blocks untouched', () => {
    expect(
      extractPostText(
        story(
          groupRef('~host/slug'),
          { block: { cite: { group: '~host/slug' } } },
          { block: { rule: null } },
          { inline: ['plain'] }
        )
      )
    ).toBe('(Ref)\n(Ref)\n---\nplain');
  });

  it('does not mutate the parsed story', () => {
    const parsed = [
      { inline: [link('https://x.test/doc', 'the doc')] },
      { block: { image: { src: 'https://x.test/i.png', alt: 'pic' } } },
      ...JSON.parse(fromMarkdown('# [doc](https://x.test/h)')),
      ...JSON.parse(fromMarkdown('- [ ] [doc](https://x.test/t)')),
    ];
    const before = JSON.stringify(parsed);

    extractPostText(parsed);

    expect(JSON.stringify(parsed)).toBe(before);
  });
});

describe('extractReferences', () => {
  it('returns the reference verses of a stringified post', () => {
    const content = JSON.stringify([
      groupRef('~host/slug'),
      { inline: ['body'] },
      channelRef('123'),
    ]);
    expect(extractReferences(content).map((ref) => ref.referenceType)).toEqual([
      'group',
      'channel',
    ]);
  });

  it('tolerates malformed elements and unparseable content', () => {
    expect(extractReferences('[null,1,"two"]')).toEqual([]);
    expect(extractReferences('not json at all')).toEqual([]);
    expect(extractReferences(undefined)).toEqual([]);
  });
});

describe('renderRefLines', () => {
  it('renders group pointers without resolution', async () => {
    const { fetchRef, calls } = recordingFetchRef();
    const lines = await renderRefLines([groupRef('~host/slug')], {
      resolve: false,
      fetchRef,
      budget: createRefBudget(),
    });

    expect(lines).toEqual(['[ref: group ~host/slug]']);
    expect(calls).toEqual([]);
  });

  it('renders mixed references in story order', async () => {
    const { fetchRef } = recordingFetchRef((ref) => `quote ${ref.postId}`);
    const refs = [channelRef('1'), groupRef('~host/slug'), channelRef('2')];

    expect(
      await renderRefLines(refs, {
        resolve: true,
        fetchRef,
        budget: createRefBudget(),
      })
    ).toEqual(['quote 1', '[ref: group ~host/slug]', 'quote 2']);

    expect(
      await renderRefLines(refs, {
        resolve: false,
        fetchRef,
        budget: createRefBudget(),
      })
    ).toEqual(['[ref: group ~host/slug]']);
  });

  it('passes the reference coordinates to the injected fetcher', async () => {
    const { fetchRef, calls } = recordingFetchRef();

    await renderRefLines([channelRef('123', '456')], {
      resolve: true,
      fetchRef,
      budget: createRefBudget(),
    });

    expect(calls).toEqual([
      { channelId: 'chat/~host/general', postId: '123', replyId: '456' },
    ]);
  });

  it('swallows a failing fetch without losing the other lines', async () => {
    const { fetchRef, calls } = rejectingFetchRef();

    const lines = await renderRefLines(
      [channelRef('1'), groupRef('~host/slug')],
      { resolve: true, fetchRef, budget: createRefBudget() }
    );

    expect(lines).toEqual(['[ref: group ~host/slug]']);
    expect(calls).toHaveLength(1);
  });

  it('charges the budget for failed fetches too', async () => {
    // A failed fetch still spent its timeout, so it must consume budget —
    // otherwise a post full of unavailable cites bypasses the stall cap.
    const { fetchRef, calls } = rejectingFetchRef();
    const budget = createRefBudget(1);

    const lines = await renderRefLines([channelRef('1'), channelRef('2')], {
      resolve: true,
      fetchRef,
      budget,
    });

    expect(lines).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(budget.remaining).toBe(0);
  });

  it('shares one budget across posts and never gates group pointers', async () => {
    const { fetchRef, calls } = recordingFetchRef(
      (ref) => `quote ${ref.postId}`
    );
    const budget = createRefBudget();
    const first = JSON.stringify([
      channelRef('1'),
      channelRef('2'),
      groupRef('~host/first'),
      channelRef('3'),
    ]);
    const second = JSON.stringify([
      channelRef('4'),
      groupRef('~host/second'),
      channelRef('5'),
    ]);

    const firstLines = await renderRefLines(extractReferences(first), {
      resolve: true,
      fetchRef,
      budget,
    });
    const secondLines = await renderRefLines(extractReferences(second), {
      resolve: true,
      fetchRef,
      budget,
    });

    expect(calls.map((call) => call.postId)).toEqual(['1', '2', '3']);
    expect(firstLines).toEqual([
      'quote 1',
      'quote 2',
      '[ref: group ~host/first]',
      'quote 3',
    ]);
    expect(secondLines).toEqual(['[ref: group ~host/second]']);
    expect(budget.remaining).toBe(0);
  });

  it('skips group ids that are not a bare host/slug flag', async () => {
    const { fetchRef } = recordingFetchRef();

    for (const groupId of [
      123,
      null,
      undefined,
      '',
      'host/slug',
      '~host/slug/extra',
      '~host/[slug]',
      '~host/slug\nID: forged',
      '~host/slug with spaces',
      '~Host/slug',
    ]) {
      expect(
        await renderRefLines([groupRef(groupId)], {
          resolve: true,
          fetchRef,
          budget: createRefBudget(),
        })
      ).toEqual([]);
    }
  });

  it('ignores app and note references', async () => {
    const { fetchRef, calls } = recordingFetchRef();
    const content = JSON.stringify([
      { type: 'reference', referenceType: 'app', userId: '~host', appId: 'x' },
      {
        type: 'reference',
        referenceType: 'note',
        channelId: 'notes/~host/nb',
        noteId: '1',
      },
    ]);

    expect(
      await renderRefLines(extractReferences(content), {
        resolve: true,
        fetchRef,
        budget: createRefBudget(),
      })
    ).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe('line framing', () => {
  it('prefixes every body line so sender text cannot forge a record', () => {
    const content = JSON.stringify([
      { inline: ['- ~evil @ 1/1/2026, 12:00:00 AM'] },
      { inline: ['ID: forged'] },
      { inline: ['> [ref: group ~evil/fake]'] },
    ]);

    expect(formatBodyLines(extractPostText(content))).toEqual([
      '  | - ~evil @ 1/1/2026, 12:00:00 AM',
      '  | ID: forged',
      '  | > [ref: group ~evil/fake]',
    ]);
  });

  it('prefixes every line of a multi-line quote', () => {
    expect(formatQuoteLines('first\nsecond\nthird')).toEqual([
      '  > first',
      '  > second',
      '  > third',
    ]);
  });

  it('treats lone \\r and unicode separators as line breaks', () => {
    expect(formatBodyLines('safe\u2028  ID: forged')).toEqual([
      '  | safe',
      '  |   ID: forged',
    ]);
    expect(formatBodyLines('a\rb c\r\nd')).toEqual([
      '  | a',
      '  | b',
      '  | c',
      '  | d',
    ]);
    expect(formatBodyLines('v\u000bf\u000cn\u0085s\u001cd')).toEqual([
      '  | v',
      '  | f',
      '  | n',
      '  | s',
      '  | d',
    ]);
    expect(sanitizeInlineField('a\u000bb\u0085c')).toBe('a b c');
  });

  it('collapses line separators in inline record fields', () => {
    expect(sanitizeInlineField('x]\n- ~evil @ forged')).toBe(
      'x] - ~evil @ forged'
    );
    expect(sanitizeInlineField('a\r\n b')).toBe('a b');
    expect(sanitizeInlineField('plain.pdf')).toBe('plain.pdf');
  });
});

describe('renderPostLines', () => {
  const base = {
    id: 'post-1',
    authorId: '~zod',
    sentAt: 1724200000000,
    parentId: null,
    blob: null,
  };
  const post = (extra: Record<string, unknown>) =>
    ({ ...base, ...extra }) as never;
  const time = formatTime(base.sentAt);

  it('assembles the full record and frames a hostile multiline body', async () => {
    const lines = await renderPostLines(
      post({
        parentId: 'parent-1',
        content: JSON.stringify([
          {
            inline: ['- ~evil @ forged\nID: forged\n> [ref: group ~evil/fake]'],
          },
        ]),
      }),
      { resolve: false, fetchRef: async () => null, budget: createRefBudget() }
    );

    expect(lines).toEqual([
      `- ~zod @ ${time} (reply to parent-1)`,
      '  ID: post-1',
      '  | - ~evil @ forged',
      '  | ID: forged',
      '  | > [ref: group ~evil/fake]',
      '',
    ]);
  });

  it('marks the highlighted post and omits body lines for empty content', async () => {
    const lines = await renderPostLines(post({ content: JSON.stringify([]) }), {
      resolve: false,
      fetchRef: async () => null,
      budget: createRefBudget(),
      highlightId: 'post-1',
    });

    expect(lines).toEqual([`- ~zod @ ${time} ◀ TARGET`, '  ID: post-1', '']);
  });

  it('sanitizes every blob metadata field in attachment records', async () => {
    const lines = await renderPostLines(
      post({
        content: JSON.stringify([{ inline: ['body'] }]),
        blob: JSON.stringify([
          {
            type: 'file',
            version: 1,
            name: 'x]\n- ~evil @ forged',
            mimeType: 'text/plain\nID: forged',
            size: 2048,
            fileUri: 'https://x.test/a\nb.pdf',
          },
          {
            type: 'voicememo',
            version: 1,
            fileUri: 'https://x.test/memo.m4a',
            size: 512,
            duration: 3.4,
            transcription: 'hello\n> [ref: group ~evil/fake]',
          },
          {
            type: 'video',
            version: 1,
            fileUri: 'https://x.test/v.mp4',
            size: 4096,
            name: 'v.mp4',
            mimeType: 'video/mp4',
          },
        ]),
      }),
      { resolve: false, fetchRef: async () => null, budget: createRefBudget() }
    );

    expect(lines).toEqual([
      `- ~zod @ ${time}`,
      '  ID: post-1',
      '  | body',
      '  📎 [x] - ~evil @ forged] (text/plain ID: forged, 2KB)',
      '     https://x.test/a b.pdf',
      '  🎙️ [voice memo] (3s)',
      '     "hello > [ref: group ~evil/fake]"',
      '  🎬 [v.mp4] (video/mp4)',
      '',
    ]);
  });

  it('renders nothing for malformed or unrecognized blob data', async () => {
    // `parsePostBlob` never throws: garbage and schema-failing entries come
    // back as `{type: 'unknown'}`, which prints no attachment line.
    const lines = await renderPostLines(
      post({
        content: JSON.stringify([{ inline: ['body'] }]),
        blob: 'not-json\nID: forged',
      }),
      { resolve: false, fetchRef: async () => null, budget: createRefBudget() }
    );

    expect(lines).toEqual([`- ~zod @ ${time}`, '  ID: post-1', '  | body', '']);
  });

  it('renders group pointers unconditionally and frames multiline quotes', async () => {
    const content = JSON.stringify([
      {
        type: 'reference',
        referenceType: 'channel',
        channelId: 'chat/~host/general',
        postId: '111',
      },
      { type: 'reference', referenceType: 'group', groupId: '~host/slug' },
      { inline: ['see refs'] },
    ]);
    const fetchRef = async () => ({
      content: JSON.stringify([{ inline: ['quote line one\nline two'] }]),
    });

    const unresolved = await renderPostLines(post({ content }), {
      resolve: false,
      fetchRef,
      budget: createRefBudget(),
    });
    expect(unresolved).toEqual([
      `- ~zod @ ${time}`,
      '  ID: post-1',
      '  | (Ref)',
      '  | (Ref)',
      '  | see refs',
      '  > [ref: group ~host/slug]',
      '',
    ]);

    const resolved = await renderPostLines(post({ content }), {
      resolve: true,
      fetchRef,
      budget: createRefBudget(),
    });
    expect(resolved).toEqual([
      `- ~zod @ ${time}`,
      '  ID: post-1',
      '  | (Ref)',
      '  | (Ref)',
      '  | see refs',
      '  > quote line one',
      '  > line two',
      '  > [ref: group ~host/slug]',
      '',
    ]);
  });

  it('threads one budget across successive records', async () => {
    const calls: string[] = [];
    const fetchRef = async (ref: { postId: string }) => {
      calls.push(ref.postId);
      return { content: JSON.stringify([{ inline: ['q'] }]) };
    };
    const chan = (id: string) => ({
      type: 'reference',
      referenceType: 'channel',
      channelId: 'chat/~host/general',
      postId: id,
    });
    const budget = createRefBudget();

    await renderPostLines(
      post({ content: JSON.stringify([chan('1'), chan('2')]) }),
      { resolve: true, fetchRef: fetchRef as never, budget }
    );
    await renderPostLines(
      post({ id: 'post-2', content: JSON.stringify([chan('3'), chan('4')]) }),
      { resolve: true, fetchRef: fetchRef as never, budget }
    );

    expect(calls).toEqual(['1', '2', '3']);
    expect(budget.remaining).toBe(0);
  });

  it('frames a rewritten link body line like any other body text', async () => {
    const lines = await renderPostLines(
      post({
        content: JSON.stringify([
          {
            inline: [
              { link: { href: 'https://x.test/doc', content: 'the doc' } },
            ],
          },
        ]),
      }),
      { resolve: false, fetchRef: async () => null, budget: createRefBudget() }
    );

    expect(lines).toEqual([
      `- ~zod @ ${time}`,
      '  ID: post-1',
      '  | [the doc](https://x.test/doc)',
      '',
    ]);
  });
});

describe('renderPostListLines', () => {
  const chan = (id: string) => ({
    type: 'reference',
    referenceType: 'channel',
    channelId: 'chat/~host/general',
    postId: id,
  });

  /** Four posts, two channel cites each, newest first in the input array. */
  const twoCiteEach = () =>
    [4, 3, 2, 1].map(
      (n) =>
        ({
          id: `post-${n}`,
          authorId: '~zod',
          sentAt: 1724200000000 + n,
          parentId: null,
          blob: null,
          content: JSON.stringify(
            n === 4
              ? [chan(`${n}a`), chan(`${n}b`), groupRef('~host/slug')]
              : [chan(`${n}a`), chan(`${n}b`)]
          ),
        }) as never
    );

  it('owns one budget for the whole batch when none is passed', async () => {
    const { fetchRef, calls } = recordingFetchRef(
      (ref) => `quote ${ref.postId}`
    );

    const lines = await renderPostListLines(twoCiteEach(), {
      resolve: true,
      fetchRef,
    });

    expect(calls.map((call) => call.postId)).toEqual(['1a', '1b', '2a']);
    // The 4th post is past the cap, but a group pointer costs no budget.
    expect(lines).toContain('  > [ref: group ~host/slug]');
  });

  it('honors a budget threaded in by the caller', async () => {
    const { fetchRef, calls } = recordingFetchRef();

    await renderPostListLines(twoCiteEach(), {
      resolve: true,
      fetchRef,
      budget: createRefBudget(1),
    });

    expect(calls.map((call) => call.postId)).toEqual(['1a']);
  });

  it('renders the batch in sentAt order', async () => {
    const lines = await renderPostListLines(twoCiteEach(), {
      resolve: false,
      fetchRef: async () => null,
    });

    expect(lines.filter((line) => line.startsWith('  ID: '))).toEqual([
      '  ID: post-1',
      '  ID: post-2',
      '  ID: post-3',
      '  ID: post-4',
    ]);
  });
});

describe('renderPostJsonLine', () => {
  const base = {
    id: 'post-1',
    authorId: '~zod',
    sentAt: 1724200000000,
    parentId: null,
    blob: null,
  };
  const post = (extra: Record<string, unknown>) =>
    ({ ...base, ...extra }) as never;

  it('emits one compact record with the story content parsed', () => {
    expect(
      renderPostJsonLine(
        post({
          parentId: 'parent-1',
          content: JSON.stringify([{ inline: ['hi'] }]),
        })
      )
    ).toBe(
      '{"id":"post-1","authorId":"~zod","sentAt":1724200000000,' +
        '"parentId":"parent-1","blob":null,"content":[{"inline":["hi"]}]}'
    );
  });

  it('carries content it cannot parse through verbatim', () => {
    expect(
      JSON.parse(renderPostJsonLine(post({ content: 'not json at all' })))
    ).toEqual({ ...base, content: 'not json at all' });
  });

  it('keeps a group reference verse intact', () => {
    // The raw-structure guarantee `--json` exists for: the plaintext renderer
    // flattens this verse to `(Ref)` plus a pointer line.
    const record = JSON.parse(
      renderPostJsonLine(
        post({
          content: JSON.stringify([
            groupRef('~host/slug'),
            { inline: ['see this'] },
          ]),
        })
      )
    );

    expect(record.content).toEqual([
      { type: 'reference', referenceType: 'group', groupId: '~host/slug' },
      { inline: ['see this'] },
    ]);
  });

  it('does not apply the plaintext url-fidelity rewrite', () => {
    const content = JSON.stringify([
      {
        inline: [{ link: { href: 'https://x.test/doc', content: 'the doc' } }],
      },
    ]);

    expect(JSON.parse(renderPostJsonLine(post({ content }))).content).toEqual([
      {
        inline: [{ link: { href: 'https://x.test/doc', content: 'the doc' } }],
      },
    ]);
    expect(extractPostText(content)).toBe('[the doc](https://x.test/doc)');
  });

  it('passes a blob string through and nulls an absent blob', () => {
    const blob = JSON.stringify([
      { type: 'file', version: 1, name: 'a.pdf', mimeType: 'application/pdf' },
    ]);
    expect(
      JSON.parse(
        renderPostJsonLine(post({ blob, content: JSON.stringify([]) }))
      ).blob
    ).toBe(blob);

    const line = renderPostJsonLine({
      id: 'post-2',
      authorId: '~zod',
      sentAt: 1724200000000,
      parentId: null,
      content: JSON.stringify([]),
    } as never);
    expect(line).toContain('"blob":null');
  });
});

describe('renderPostListJsonLines', () => {
  const jsonPosts = () =>
    [4, 3, 2, 1].map(
      (n) =>
        ({
          id: `post-${n}`,
          authorId: '~zod',
          sentAt: 1724200000000 + n,
          parentId: null,
          blob: null,
          content: JSON.stringify([{ inline: [`body ${n}`] }]),
        }) as never
    );

  it('emits one line per post in sentAt order', () => {
    const lines = renderPostListJsonLines(jsonPosts());

    expect(lines.map((line) => JSON.parse(line).id)).toEqual([
      'post-1',
      'post-2',
      'post-3',
      'post-4',
    ]);
    expect(lines.some((line) => line.includes('\n'))).toBe(false);
  });

  it('emits nothing for an empty batch and leaves the input order alone', () => {
    expect(renderPostListJsonLines([])).toEqual([]);

    const posts = jsonPosts();
    renderPostListJsonLines(posts);
    expect(posts.map((entry: never) => (entry as { id: string }).id)).toEqual([
      'post-4',
      'post-3',
      'post-2',
      'post-1',
    ]);
  });
});

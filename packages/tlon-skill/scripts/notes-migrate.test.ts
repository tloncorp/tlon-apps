import { toUrbitStory } from '@tloncorp/api';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { storyToMarkdown, storyToMdast } from '@tloncorp/api/client/markdown';
import { describe, expect, it } from 'bun:test';

import {
  type ConvertedNote,
  type MigrationDeps,
  type SourcePost,
  archiveTitle,
  assembleNoteBody,
  buildAttributionLine,
  buildProvenanceFooter,
  canonicalizeNest,
  chunkNotes,
  computeWriteWidening,
  convertPost,
  countArchiveOnlyMetrics,
  deriveNoteTitle,
  deriveTargetTitle,
  filterEligiblePosts,
  measureEnvelopeBytes,
  normalizeTitle,
  parseNest,
  sortPostsBySequence,
  truncateTitle,
  validateImageUrl,
} from './notes-migrate';

const DAY = Date.UTC(2025, 2, 14, 12);
const CTX = { flag: '~zod/book', folder: 17, requestId: '0v12345' };

function source(overrides: Partial<SourcePost> = {}): SourcePost {
  return {
    id: '170.141',
    sequenceNum: 1,
    title: 'A title',
    image: '',
    sentAt: DAY,
    authorId: '~sampel-palnet',
    content: [{ inline: ['Hello'] }],
    isDeleted: false,
    isSequenceStub: false,
    replyCount: 0,
    reactionCount: 0,
    ...overrides,
  };
}

const conversionDeps: Pick<
  MigrationDeps,
  'storyToMarkdown' | 'storyToMdastStrict' | 'toUrbitStory'
> = {
  toUrbitStory: (content) => toUrbitStory(content as never),
  storyToMdastStrict: (story) => {
    storyToMdast(story, { strict: true });
  },
  storyToMarkdown,
};

function note(id: string, title: string, body: string): ConvertedNote {
  return { postId: id, sequenceNum: Number(id), title, body };
}

describe('migration nest and title helpers', () => {
  it('canonicalizes a missing ship sigil', () => {
    expect(canonicalizeNest('diary/zod/blog')).toBe('diary/~zod/blog');
    expect(parseNest('diary/~zod/blog')).toEqual({
      kind: 'diary',
      host: '~zod',
      name: 'blog',
    });
  });

  for (const invalid of [
    'diary/~zod',
    'diary//blog',
    '/~zod/blog',
    'diary/~zod/',
    'diary/~zod/blog/extra',
    'diary/~zod/my blog',
  ]) {
    it(`rejects malformed nest ${JSON.stringify(invalid)}`, () => {
      expect(() => parseNest(invalid)).toThrow('Invalid nest format');
    });
  }

  it('NFC-normalizes and collapses target-title whitespace', () => {
    expect(normalizeTitle('  Cafe\u0301 \n Notes  ')).toBe('Café Notes');
    expect(deriveTargetTitle(' \n ', 'field-notes')).toBe('field-notes');
  });

  it('truncates by code point to 80 including the ellipsis', () => {
    const result = truncateTitle('😀'.repeat(81));
    expect([...result]).toHaveLength(80);
    expect(result).toEndWith('…');
  });

  it('uses explicit title, first Markdown line, then dated fallback', () => {
    expect(deriveNoteTitle(source({ title: ' Named ' }), 'ignored')).toBe(
      'Named'
    );
    expect(
      deriveNoteTitle(source({ title: '' }), '\n  First line \nnext')
    ).toBe('First line');
    expect(deriveNoteTitle(source({ title: '' }), '')).toBe(
      'Untitled — 2025-03-14'
    );
  });

  it('appends the archive suffix at most once with nest fallback', () => {
    expect(archiveTitle('Field Notes', 'field-notes')).toBe(
      'Field Notes-ARCHIVE'
    );
    expect(archiveTitle('Field Notes-ARCHIVE', 'field-notes')).toBe(
      'Field Notes-ARCHIVE'
    );
    expect(archiveTitle(' ', 'field-notes')).toBe('field-notes-ARCHIVE');
  });
});

describe('body assembly and conversion', () => {
  it('writes attribution, image, Markdown, and provenance in order', () => {
    const body = assembleNoteBody({
      attributionLine: buildAttributionLine('sampel-palnet', DAY),
      headerImageUrl: 'https://example.test/header.png',
      convertedMarkdown: 'Hello',
      provenanceFooter: buildProvenanceFooter(
        'diary/~sampel-palnet/blog',
        '170.141'
      ),
    });
    expect(body).toBe(
      '*Originally posted by ~sampel-palnet on 2025-03-14 12:00:00 UTC.*\n\n' +
        '![](<https://example.test/header.png>)\n\n' +
        'Hello\n\n' +
        '<!-- tlon-migrate: diary/~sampel-palnet/blog 170.141 -->\n'
    );
    expect(body.endsWith('\n\n')).toBe(false);
  });

  const imageCases = [
    ['https://example.test/a.png', true],
    ['https://example.test/a b.png', false],
    ['https://example.test/<a>.png', false],
    ['https://example.test/a\\b.png', false],
    ['https://example.test/a\u0007b.png', false],
    ['https://example.test/a\u0080b.png', false],
  ] as const;
  for (const [url, valid] of imageCases) {
    it(`${valid ? 'accepts' : 'rejects'} image URL ${JSON.stringify(url)}`, () => {
      expect(validateImageUrl(url)).toBe(valid);
    });
  }

  it('rejects a bad image before returning a note', () => {
    expect(() =>
      convertPost(
        source({ image: 'https://example.test/bad image.png' }),
        'diary/~zod/blog',
        conversionDeps
      )
    ).toThrow(/header image URL/);
  });

  it('parses serialized null-or-array content', () => {
    const converted = convertPost(
      source({ content: JSON.stringify([{ inline: ['Serialized'] }]) }),
      'diary/~zod/blog',
      conversionDeps
    );
    expect(converted.body).toContain('Serialized');
    expect(() =>
      convertPost(
        source({ content: '{"not":"an array"}' }),
        'diary/~zod/blog',
        conversionDeps
      )
    ).toThrow('content must be null or array');
  });

  it('preserves Sect, Tag, and BlockReference as plain text', () => {
    const converted = convertPost(
      source({
        content: [
          {
            inline: [
              { sect: 'writers' },
              ' ',
              { tag: '#field-notes' },
              ' ',
              { block: { index: 2, text: 'quoted block' } },
            ],
          },
        ],
      }),
      'diary/~zod/blog',
      conversionDeps
    );
    expect(converted.body).toContain('@writers #field-notes quoted block');
  });

  it('renders a backend-shaped ship mention with exactly one sigil', () => {
    const converted = convertPost(
      source({
        content: [{ inline: ['Hello ', { ship: '~zod' }, '!'] }],
      }),
      'diary/~zod/blog',
      conversionDeps
    );
    expect(converted.body).toContain('Hello ~zod!');
    expect(converted.body).not.toContain('~~zod');
  });

  it('strictly rejects an unknown inline recursively inside Bold', () => {
    expect(() =>
      convertPost(
        source({
          content: [{ inline: [{ bold: [{ futureVariant: 'unsafe' }] }] }],
        }),
        'diary/~zod/blog',
        conversionDeps
      )
    ).toThrow(/conversion failed/i);
  });

  it('wraps malformed JSON with the post id', () => {
    expect(() =>
      convertPost(
        source({ id: 'bad-post', content: '[' }),
        'diary/~zod/blog',
        conversionDeps
      )
    ).toThrow(/^Post bad-post:/);
  });
});

describe('eligibility, metrics, and ordering', () => {
  it('separates live posts, tombstones, and synthetic stubs', () => {
    const live = source({ id: 'live' });
    const deleted = source({ id: 'deleted', isDeleted: true });
    const stub = source({ id: 'stub', isSequenceStub: true });
    expect(filterEligiblePosts([live, deleted, stub])).toEqual({
      eligible: [live],
      tombstones: [deleted],
      stubs: [stub],
    });
  });

  it('sorts globally by ascending sequence number', () => {
    expect(
      sortPostsBySequence([
        source({ id: '3', sequenceNum: 3 }),
        source({ id: '1', sequenceNum: 1 }),
        source({ id: '2', sequenceNum: 2 }),
      ]).map((post) => post.id)
    ).toEqual(['1', '2', '3']);
  });

  it('counts normalized cites, link blocks, and recursive group mentions', () => {
    const metrics = countArchiveOnlyMetrics([
      source({
        replyCount: 4,
        reactionCount: 3,
        content: [
          {
            type: 'reference',
            referenceType: 'channel',
            channelId: 'diary/~zod/other',
            postId: '1',
          },
          { block: { link: { url: 'https://example.test' } } },
          {
            inline: [
              { sect: 'all' },
              { bold: [{ sect: 'writers' }] },
              { task: { checked: false, content: [{ sect: null }] } },
            ],
          },
        ],
      }),
    ]);
    expect(metrics).toEqual({
      totalComments: 4,
      totalReactions: 3,
      citeCount: 1,
      linkBlockCount: 1,
      groupMentionCount: 3,
      flattenedInlineCount: 0,
    });
  });

  it('counts tags and inline block references as flattened, not dropped', () => {
    // Both survive migration as their visible text but lose what they were.
    // Before this was counted, the plan reported nothing at all for either,
    // so an owner was told the post migrated intact. Wire shapes are taken
    // from hand-authored-wire-exact-story-variants.json.
    const metrics = countArchiveOnlyMetrics([
      source({
        content: [
          { inline: ['tag ', { tag: 'wire-exact-tag' }] },
          {
            inline: [
              'reference ',
              { block: { index: 0, text: 'wire-exact-block-reference' } },
            ],
          },
        ],
      }),
    ]);
    expect(metrics.flattenedInlineCount).toBe(2);
    // They are not cites or link blocks; those counts stay untouched.
    expect(metrics.citeCount).toBe(0);
    expect(metrics.linkBlockCount).toBe(0);
  });

  it('counts a tag nested inside a header', () => {
    const metrics = countArchiveOnlyMetrics([
      source({
        content: [
          {
            block: {
              header: { tag: 'h2', content: [{ tag: 'nested-tag' }] },
            },
          },
        ],
      }),
    ]);
    expect(metrics.flattenedInlineCount).toBe(1);
  });

  it('counts a group mention in a header', () => {
    const metrics = countArchiveOnlyMetrics([
      source({
        content: [
          {
            block: {
              header: {
                tag: 'h2',
                content: [{ sect: 'members' }],
              },
            },
          },
        ],
      }),
    ]);
    expect(metrics.groupMentionCount).toBe(1);
  });

  it('counts a group mention inside an arbitrarily nested list item', () => {
    const metrics = countArchiveOnlyMetrics([
      source({
        content: [
          {
            block: {
              listing: {
                list: {
                  type: 'unordered',
                  contents: [],
                  items: [
                    {
                      list: {
                        type: 'ordered',
                        contents: [],
                        items: [
                          {
                            item: [
                              {
                                bold: [{ sect: 'members' }],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      }),
    ]);
    expect(metrics.groupMentionCount).toBe(1);
  });

  it('counts a group mention in a list’s own contents', () => {
    const metrics = countArchiveOnlyMetrics([
      source({
        content: [
          {
            block: {
              listing: {
                list: {
                  type: 'unordered',
                  contents: [{ sect: 'members' }],
                  items: [],
                },
              },
            },
          },
        ],
      }),
    ]);
    expect(metrics.groupMentionCount).toBe(1);
  });

  it('counts a raw pre-normalization cite block', () => {
    expect(
      countArchiveOnlyMetrics([
        source({ content: [{ block: { cite: { group: '~zod/g' } } }] }),
      ]).citeCount
    ).toBe(1);
  });
});

describe('write-widening predicate', () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof computeWriteWidening>[0];
    widening: boolean;
  }> = [
    {
      name: 'restricted readers authorized by writers',
      input: {
        readerRoles: ['writers'],
        writerRoles: ['writers'],
        admins: [],
        privacy: 'private',
      },
      widening: false,
    },
    {
      name: 'empty writers means all readers already write',
      input: {
        readerRoles: ['members'],
        writerRoles: [],
        admins: [],
        privacy: 'private',
      },
      widening: false,
    },
    {
      name: 'admin reader role authorizes writing',
      input: {
        readerRoles: ['moderators'],
        writerRoles: ['writers'],
        admins: ['moderators'],
        privacy: 'secret',
      },
      widening: false,
    },
    {
      name: 'open readers with restricted writers',
      input: {
        readerRoles: [],
        writerRoles: ['writers'],
        admins: [],
        privacy: 'private',
      },
      widening: true,
    },
    {
      name: 'reader-only role',
      input: {
        readerRoles: ['members'],
        writerRoles: ['writers'],
        admins: ['admins'],
        privacy: 'private',
      },
      widening: true,
    },
    {
      name: 'public and open',
      input: {
        readerRoles: [],
        writerRoles: [],
        admins: [],
        privacy: 'public',
      },
      widening: true,
    },
  ];
  for (const testCase of cases) {
    it(testCase.name, () => {
      const result = computeWriteWidening(testCase.input);
      expect(result.widening).toBe(testCase.widening);
      expect(result.reasons.length > 0).toBe(testCase.widening);
    });
  }
});

describe('escaped envelope measurement and chunking', () => {
  it('measures the exact escaped UTF-8 JSON envelope', () => {
    const notes = [{ title: '"😀"', body: 'line\nsecond\\line' }];
    const expected = Buffer.byteLength(
      JSON.stringify({
        requestId: CTX.requestId,
        action: {
          type: 'notebook',
          flag: CTX.flag,
          action: {
            type: 'batch-import',
            folder: CTX.folder,
            notes,
          },
        },
      }),
      'utf8'
    );
    expect(measureEnvelopeBytes(notes, CTX)).toBe(expected);
  });

  it('keeps an exact-boundary chunk together', () => {
    const notes = [note('1', 'one', 'a'), note('2', 'two', 'b')];
    const cap = measureEnvelopeBytes(notes, CTX);
    expect(chunkNotes(notes, cap, CTX)).toEqual([notes]);
  });

  it('splits before crossing the escaped-byte boundary', () => {
    const notes = [note('1', 'one', 'a'), note('2', 'two', 'b')];
    const cap = measureEnvelopeBytes(notes, CTX) - 1;
    expect(chunkNotes(notes, cap, CTX)).toEqual([[notes[0]], [notes[1]]]);
  });

  it('rejects an oversized single note', () => {
    const oversized = note('9', 'large', 'x'.repeat(200));
    const cap = measureEnvelopeBytes([oversized], CTX) - 1;
    expect(() => chunkNotes([oversized], cap, CTX)).toThrow(
      /Note 9 exceeds byte cap/
    );
  });
});

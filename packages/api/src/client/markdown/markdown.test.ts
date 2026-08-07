import { describe, expect, it } from 'vitest';

import type { Story } from '../../urbit/channel';
import { convertContent } from '../postContent';
import { parseGroupMentions } from './groupMentionPlugin';
import { markdownToStory } from './parse';
import {
  blockToMarkdown,
  inlinesToMarkdown,
  storyToMarkdown,
} from './serialize';

describe('ship mention parsing', () => {
  it('keeps text without ships as a single text inline', () => {
    expect(markdownToStory('Hello world')).toEqual([
      { inline: ['Hello world'] },
    ]);
  });
});

describe('parseGroupMentions', () => {
  it('parses an isolated term-shaped role mention', () => {
    expect(parseGroupMentions('Hello @admin!')).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'groupMention', value: 'admin' },
      { type: 'text', value: '!' },
    ]);
  });
});

describe('markdownToStory', () => {
  describe('empty input handling', () => {
    it('returns empty array for empty string', () => {
      expect(markdownToStory('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(markdownToStory('   \n\t  ')).toEqual([]);
    });

    it('returns empty array for null/undefined', () => {
      expect(markdownToStory(null as unknown as string)).toEqual([]);
      expect(markdownToStory(undefined as unknown as string)).toEqual([]);
    });
  });

  describe('paragraph conversion', () => {
    it('converts single paragraph to VerseInline', () => {
      const result = markdownToStory('Hello world');
      expect(result).toEqual([{ inline: ['Hello world'] }]);
    });

    it('converts multiple paragraphs to multiple VerseInlines', () => {
      const result = markdownToStory('First paragraph\n\nSecond paragraph');
      expect(result).toEqual([
        { inline: ['First paragraph'] },
        { inline: ['Second paragraph'] },
      ]);
    });

    it('preserves inline formatting in paragraphs', () => {
      const result = markdownToStory('**bold** and *italic* text');
      expect(result).toEqual([
        {
          inline: [
            { bold: ['bold'] },
            ' and ',
            { italics: ['italic'] },
            ' text',
          ],
        },
      ]);
    });

    it('converts ship mentions in paragraphs', () => {
      const result = markdownToStory('Hello ~sampel-palnet!');
      expect(result).toEqual([
        { inline: ['Hello ', { ship: '~sampel-palnet' }, '!'] },
      ]);
    });
  });

  describe('inline formatting', () => {
    it('converts **bold** to Bold inline', () => {
      const result = markdownToStory('**bold text**');
      expect(result).toEqual([{ inline: [{ bold: ['bold text'] }] }]);
    });

    it('converts *italic* to Italics inline', () => {
      const result = markdownToStory('*italic text*');
      expect(result).toEqual([{ inline: [{ italics: ['italic text'] }] }]);
    });

    it('converts ~~strike~~ to Strikethrough inline', () => {
      const result = markdownToStory('~~struck text~~');
      expect(result).toEqual([{ inline: [{ strike: ['struck text'] }] }]);
    });

    it('converts `code` to InlineCode', () => {
      const result = markdownToStory('`inline code`');
      expect(result).toEqual([{ inline: [{ 'inline-code': 'inline code' }] }]);
    });

    it('converts [text](url) to Link inline', () => {
      const result = markdownToStory('[click here](https://example.com)');
      expect(result).toEqual([
        {
          inline: [
            {
              link: {
                href: 'https://example.com',
                content: 'click here',
              },
            },
          ],
        },
      ]);
    });

    it('preserves a ship mention in a link label', () => {
      const result = markdownToStory('[~zod](https://example.com)');
      expect(result).toEqual([
        {
          inline: [
            {
              link: {
                href: 'https://example.com',
                content: '~zod',
              },
            },
          ],
        },
      ]);
    });

    it('handles nested formatting (bold inside italic)', () => {
      const result = markdownToStory('*italic **bold** text*');
      expect(result).toEqual([
        {
          inline: [
            {
              italics: ['italic ', { bold: ['bold'] }, ' text'],
            },
          ],
        },
      ]);
    });
  });

  describe('ship mentions', () => {
    it('handles galaxy names', () => {
      const result = markdownToStory('~zod');
      expect(result).toEqual([{ inline: [{ ship: '~zod' }] }]);
    });

    it('handles star names', () => {
      const result = markdownToStory('~marzod');
      expect(result).toEqual([{ inline: [{ ship: '~marzod' }] }]);
    });

    it('handles planet names', () => {
      const result = markdownToStory('~sampel-palnet');
      expect(result).toEqual([{ inline: [{ ship: '~sampel-palnet' }] }]);
    });

    it('handles moon names', () => {
      const result = markdownToStory('~dozzod-dozzod-sampel-palnet');
      expect(result).toEqual([
        { inline: [{ ship: '~dozzod-dozzod-sampel-palnet' }] },
      ]);
    });

    it('handles multiple ship mentions', () => {
      const result = markdownToStory('~zod and ~bus are ships');
      expect(result).toEqual([
        {
          inline: [{ ship: '~zod' }, ' and ', { ship: '~bus' }, ' are ships'],
        },
      ]);
    });

    it('handles ship mention with formatting', () => {
      const result = markdownToStory('Hello **~sampel-palnet**!');
      expect(result).toEqual([
        {
          inline: ['Hello ', { bold: [{ ship: '~sampel-palnet' }] }, '!'],
        },
      ]);
    });
  });

  describe('escaped and referenced tildes stay literal', () => {
    it('keeps a backslash-escaped ship literal (the issue example)', () => {
      expect(markdownToStory('; \\~ripdys is your neighbor')).toEqual([
        { inline: ['; ~ripdys is your neighbor'] },
      ]);
    });

    it('keeps an escaped ship inside bold literal', () => {
      expect(markdownToStory('**\\~zod**')).toEqual([
        { inline: [{ bold: ['~zod'] }] },
      ]);
    });

    it('keeps an escaped ship in a link label literal', () => {
      expect(markdownToStory('[\\~zod](https://example.com)')).toEqual([
        {
          inline: [{ link: { href: 'https://example.com', content: '~zod' } }],
        },
      ]);
    });

    it('keeps an escaped ship in a header literal', () => {
      expect(markdownToStory('# \\~zod')).toEqual([
        { block: { header: { tag: 'h1', content: ['~zod'] } } },
      ]);
    });

    it.each(['&#126;zod hello', '&#x7E;zod hello'])(
      'keeps the character reference %s literal',
      (markdown) => {
        expect(markdownToStory(markdown)).toEqual([{ inline: ['~zod hello'] }]);
      }
    );

    it('keeps an escaped ship in a table cell literal', () => {
      const story = markdownToStory('| h |\n| --- |\n| \\~zod |');
      expect(JSON.stringify(story)).not.toContain('"ship"');
      expect(story).toEqual([{ inline: ['| h  |\n| ----- |\n| \\~zod |'] }]);
    });

    it('preserves the sigil in image alt text', () => {
      expect(markdownToStory('![~zod](https://x.test/i.png)')).toEqual([
        {
          block: {
            image: {
              src: 'https://x.test/i.png',
              alt: '~zod',
              width: 0,
              height: 0,
            },
          },
        },
      ]);
    });
  });

  describe('trailing boundary enforcement', () => {
    it.each([
      '~zod2 hello',
      'ping ~foo-bar ok',
      '~zodabcx',
      '~zod-monster',
      '~zod-ab',
      '~zo',
      '~ZOD',
      '~zodA',
      '~zod9',
    ])('keeps %s fully literal', (markdown) => {
      expect(markdownToStory(markdown)).toEqual([{ inline: [markdown] }]);
    });

    it('still permits a mention before punctuation', () => {
      expect(markdownToStory('~zod.')).toEqual([
        { inline: [{ ship: '~zod' }, '.'] },
      ]);
    });

    it('still permits a mention inside parentheses', () => {
      expect(markdownToStory('(~zod)')).toEqual([
        { inline: ['(', { ship: '~zod' }, ')'] },
      ]);
    });

    it('still permits two adjacent mentions', () => {
      expect(markdownToStory('~zod~bus')).toEqual([
        { inline: [{ ship: '~zod' }, { ship: '~bus' }] },
      ]);
    });

    it('still permits a mid-word mention (no left boundary)', () => {
      expect(markdownToStory('abc~zod')).toEqual([
        { inline: ['abc', { ship: '~zod' }] },
      ]);
    });
  });

  describe('comet names', () => {
    const comet = '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod';

    it('parses a full comet as one mention', () => {
      expect(markdownToStory(`hi ${comet} bye`)).toEqual([
        { inline: ['hi ', { ship: comet }, ' bye'] },
      ]);
    });

    it('parses a --joined comet-shaped name as one mention', () => {
      // Documented delta: the old scanner split this into ~zod plus text.
      expect(markdownToStory('~zod--wordly')).toEqual([
        { inline: [{ ship: '~zod--wordly' }] },
      ]);
    });

    it.each(['~zod--', '~zod--word'])(
      'keeps the incomplete comet tail %s fully literal',
      (markdown) => {
        expect(markdownToStory(markdown)).toEqual([{ inline: [markdown] }]);
      }
    );

    it('round-trips a comet mention byte-stably', () => {
      const story: Story = [{ inline: [{ ship: comet }] }];
      const once = storyToMarkdown(story);
      expect(markdownToStory(once)).toEqual(story);
      expect(storyToMarkdown(markdownToStory(once))).toBe(once);
    });
  });

  describe('email-autolink coexistence', () => {
    it('does not splice a mention into an autolinked URL path', () => {
      const result = markdownToStory('see https://x.test/~zod/page ok');
      expect(result).toEqual([
        {
          inline: [
            'see ',
            {
              link: {
                href: 'https://x.test/~zod/page',
                content: 'https://x.test/~zod/page',
              },
            },
            ' ok',
          ],
        },
      ]);
    });

    it.each([
      ['~zod@example.com', '~', 'zod@example.com'],
      ['foo~zod@example.com', 'foo~', 'zod@example.com'],
      ['~zod.bar@example.com', '~', 'zod.bar@example.com'],
      ['~zod+x@example.com', '~', 'zod+x@example.com'],
      ['~zod-foo@example.com', '~', 'zod-foo@example.com'],
      ['~zod_x@example.com', '~', 'zod_x@example.com'],
    ])(
      'preserves the autolink and creates no mention for %s',
      (markdown, prefix, email) => {
        expect(markdownToStory(markdown)).toEqual([
          {
            inline: [
              prefix,
              { link: { href: `mailto:${email}`, content: email } },
            ],
          },
        ]);
      }
    );

    it('keeps a non-autolinking @-tail fully literal (documented divergence)', () => {
      // The base promoted a mention here; with no dotted domain no GFM
      // autolink forms, and the guard goes literal instead.
      expect(markdownToStory('~zod@example')).toEqual([
        { inline: ['~zod@example'] },
      ]);
    });

    it('keeps the mention when no @ follows the local-part run', () => {
      expect(markdownToStory('~zod.bar hello')).toEqual([
        { inline: [{ ship: '~zod' }, '.bar hello'] },
      ]);
      expect(markdownToStory('~zod_foo hello')).toEqual([
        { inline: [{ ship: '~zod' }, '_foo hello'] },
      ]);
    });
  });

  describe('strikethrough interplay', () => {
    it('parses a mention followed by a lone tilde', () => {
      expect(markdownToStory('~zod~ hi')).toEqual([
        { inline: [{ ship: '~zod' }, '~ hi'] },
      ]);
    });

    it('keeps an unpaired double-tilde run fully literal', () => {
      // Deliberate delta: the old post-parse scan promoted ~zod out of the
      // literal ~~zod text; the tokenizer consumes the run as close-only
      // strikethrough data and never re-attempts the ship construct.
      expect(markdownToStory('~~zod')).toEqual([{ inline: ['~~zod'] }]);
    });
  });

  describe('header conversion', () => {
    it('converts h1 header to VerseBlock', () => {
      const result = markdownToStory('# Header One');
      expect(result).toEqual([
        { block: { header: { tag: 'h1', content: ['Header One'] } } },
      ]);
    });

    it('converts multiple header levels', () => {
      const result = markdownToStory('# H1\n\n## H2\n\n### H3');
      expect(result).toEqual([
        { block: { header: { tag: 'h1', content: ['H1'] } } },
        { block: { header: { tag: 'h2', content: ['H2'] } } },
        { block: { header: { tag: 'h3', content: ['H3'] } } },
      ]);
    });

    it('preserves formatting in headers', () => {
      const result = markdownToStory('# **Bold** Header');
      expect(result).toEqual([
        {
          block: {
            header: { tag: 'h1', content: [{ bold: ['Bold'] }, ' Header'] },
          },
        },
      ]);
    });
  });

  describe('code block conversion', () => {
    it('converts fenced code block to VerseBlock with language', () => {
      const result = markdownToStory('```js\nconst x = 1;\n```');
      expect(result).toEqual([
        { block: { code: { code: 'const x = 1;', lang: 'js' } } },
      ]);
    });

    it('handles code block without language (defaults to text)', () => {
      const result = markdownToStory('```\nplain code\n```');
      expect(result).toEqual([
        { block: { code: { code: 'plain code', lang: 'text' } } },
      ]);
    });
  });

  describe('horizontal rule conversion', () => {
    it('converts --- to VerseBlock with Rule', () => {
      const result = markdownToStory('---');
      expect(result).toEqual([{ block: { rule: null } }]);
    });
  });

  describe('image conversion', () => {
    it('converts standalone image to VerseBlock', () => {
      const result = markdownToStory('![alt text](image.png)');
      expect(result).toEqual([
        {
          block: {
            image: { src: 'image.png', alt: 'alt text', height: 0, width: 0 },
          },
        },
      ]);
    });
  });

  describe('list conversion', () => {
    it('converts unordered list to VerseBlock', () => {
      const result = markdownToStory('- item1\n- item2');
      expect(result).toEqual([
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [{ item: ['item1'] }, { item: ['item2'] }],
              },
            },
          },
        },
      ]);
    });

    it('converts ordered list to VerseBlock', () => {
      const result = markdownToStory('1. first\n2. second');
      expect(result).toEqual([
        {
          block: {
            listing: {
              list: {
                type: 'ordered',
                contents: [],
                items: [{ item: ['first'] }, { item: ['second'] }],
              },
            },
          },
        },
      ]);
    });

    it('converts task list to VerseBlock', () => {
      const result = markdownToStory('- [ ] todo\n- [x] done');
      expect(result).toEqual([
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  { item: [{ task: { checked: false, content: ['todo'] } }] },
                  { item: [{ task: { checked: true, content: ['done'] } }] },
                ],
              },
            },
          },
        },
      ]);
    });

    it('preserves a checked item after a plain item', () => {
      expect(markdownToStory('- plain\n- [x] done')).toEqual([
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  { item: ['plain'] },
                  { item: [{ task: { checked: true, content: ['done'] } }] },
                ],
              },
            },
          },
        },
      ]);
    });

    // A checked parent task containing a sub-list takes a different code path
    // from a flat task item, and that path previously had no coverage of its
    // checked state.
    it('preserves the checked state of a parent task with a nested list', () => {
      const result = markdownToStory('- [x] parent task\n  - child') as never;
      const parent = (result as any)[0].block.listing.list.items[0];
      expect(parent.list.contents[0]).toEqual({
        task: { checked: true, content: ['parent task'] },
      });
      expect(parent.list.items).toEqual([{ item: ['child'] }]);
    });

    it('keeps a plain item after a checked item plain', () => {
      expect(markdownToStory('- [x] done\n- plain')).toEqual([
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  { item: [{ task: { checked: true, content: ['done'] } }] },
                  { item: ['plain'] },
                ],
              },
            },
          },
        },
      ]);
    });

    it('preserves checked and unchecked items mixed with plain items', () => {
      expect(
        markdownToStory('- plain before\n- [ ] todo\n- [x] done\n- plain after')
      ).toEqual([
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  { item: ['plain before'] },
                  { item: [{ task: { checked: false, content: ['todo'] } }] },
                  { item: [{ task: { checked: true, content: ['done'] } }] },
                  { item: ['plain after'] },
                ],
              },
            },
          },
        },
      ]);
    });

    it('classifies a nested list as a task list when only its last item is checked', () => {
      expect(
        markdownToStory(
          '- parent\n  - first plain\n  - second plain\n  - [x] last'
        )
      ).toEqual([
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [
                  {
                    list: {
                      type: 'tasklist',
                      contents: ['parent'],
                      items: [
                        { item: ['first plain'] },
                        { item: ['second plain'] },
                        {
                          item: [
                            { task: { checked: true, content: ['last'] } },
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
      ]);
    });
  });

  describe('blockquote conversion', () => {
    it('converts blockquote to VerseInline with Blockquote', () => {
      const result = markdownToStory('> quoted text');
      expect(result).toEqual([{ inline: [{ blockquote: ['quoted text'] }] }]);
    });

    it('preserves formatting in blockquotes', () => {
      const result = markdownToStory('> **bold** quote');
      expect(result).toEqual([
        { inline: [{ blockquote: [{ bold: ['bold'] }, ' quote'] }] },
      ]);
    });

    it('preserves a quoted list as visible Markdown', () => {
      const result = markdownToStory('> - first\n> - second');
      expect(result).toEqual([
        { inline: [{ blockquote: ['* first\n* second'] }] },
      ]);
    });

    it('preserves a quoted heading as visible Markdown', () => {
      const result = markdownToStory('> ## Quoted heading');
      expect(result).toEqual([
        { inline: [{ blockquote: ['## Quoted heading'] }] },
      ]);
    });

    it('preserves a quoted rule as visible Markdown', () => {
      const result = markdownToStory('> ---');
      expect(result).toEqual([{ inline: [{ blockquote: ['***'] }] }]);
    });

    it('preserves a quoted table as visible Markdown', () => {
      const result = markdownToStory(
        '> | A | B |\n> | :--- | ---: |\n> | 1 | 2 |'
      );
      expect(result).toEqual([
        {
          inline: [
            {
              blockquote: ['| A | B |\n| :--- | ---: |\n| 1 | 2 |'],
            },
          ],
        },
      ]);
    });

    it('preserves a quoted HTML block as visible text', () => {
      const result = markdownToStory('> <div>quoted html</div>');
      expect(result).toEqual([
        { inline: [{ blockquote: ['<div>quoted html</div>'] }] },
      ]);
    });

    it('separates surrounding paragraphs from a quoted block child', () => {
      const result = markdownToStory('> intro\n>\n> - listed\n>\n> outro');
      expect(result).toEqual([
        {
          inline: [
            {
              blockquote: [
                'intro',
                { break: null },
                '* listed',
                { break: null },
                'outro',
              ],
            },
          ],
        },
      ]);
    });
  });

  describe('table conversion', () => {
    it('preserves renderable table syntax and alignment', () => {
      const markdown = '| A | B |\n| :--- | ---: |\n| 1 | 2 |';
      const story = markdownToStory(markdown);

      expect(story).toEqual([{ inline: [markdown] }]);
      expect(convertContent(story, null)).toEqual([
        {
          type: 'table',
          header: {
            cells: [
              { content: [{ type: 'text', text: 'A' }] },
              { content: [{ type: 'text', text: 'B' }] },
            ],
          },
          rows: [
            {
              cells: [
                { content: [{ type: 'text', text: '1' }] },
                { content: [{ type: 'text', text: '2' }] },
              ],
            },
          ],
          align: ['left', 'right'],
        },
      ]);
    });

    it('preserves literal markdown syntax and pipes in table cells', () => {
      const story = markdownToStory(
        '| Value |\n| --- |\n| \\*literal\\* |\n| a \\| b |'
      );

      expect(convertContent(story, null)).toEqual([
        {
          type: 'table',
          header: {
            cells: [{ content: [{ type: 'text', text: 'Value' }] }],
          },
          rows: [
            {
              cells: [{ content: [{ type: 'text', text: '*literal*' }] }],
            },
            {
              cells: [{ content: [{ type: 'text', text: 'a | b' }] }],
            },
          ],
          align: [null],
        },
      ]);
    });
  });

  describe('parse-side flattener boundaries', () => {
    it('separates a mention from text fused by a character reference in a table', () => {
      // The character reference is a token boundary, so the cell parses as
      // mention ~zod plus text abc; the flattener must not re-fuse them.
      const story = markdownToStory('| h |\n| --- |\n| ~zod&#97;bc |');
      expect(JSON.stringify(story)).toContain('~zod<!-- -->abc');
      expect(JSON.stringify(story)).not.toContain('~zodabc');
    });

    it('separates a mention in a quoted list flattened to markdown', () => {
      const story = markdownToStory('> - ~zod&#97;bc');
      expect(JSON.stringify(story)).toContain('~zod<!-- -->abc');
      expect(JSON.stringify(story)).not.toContain('~zodabc');
    });
  });

  describe('mixed content', () => {
    it('converts mixed inline and block content', () => {
      const result = markdownToStory(
        '# Title\n\nA paragraph with **bold**.\n\n- list item\n\n> quote'
      );
      expect(result).toEqual([
        { block: { header: { tag: 'h1', content: ['Title'] } } },
        { inline: ['A paragraph with ', { bold: ['bold'] }, '.'] },
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [{ item: ['list item'] }],
              },
            },
          },
        },
        { inline: [{ blockquote: ['quote'] }] },
      ]);
    });
  });
});

describe('Story to Markdown to Story structural round trips', () => {
  function expectRoundTrip(story: Story, expected: Story = story): void {
    expect(markdownToStory(storyToMarkdown(story, { strict: true }))).toEqual(
      expected
    );
  }

  it('preserves a nested quote with a block separator', () => {
    expectRoundTrip(
      [
        {
          inline: [
            {
              blockquote: ['outer', { blockquote: ['inner'] }],
            },
          ],
        },
      ],
      [
        {
          inline: [
            {
              blockquote: ['outer', { break: null }, { blockquote: ['inner'] }],
            },
          ],
        },
      ]
    );
  });

  it('preserves code inside a quote with block separators', () => {
    expectRoundTrip(
      [
        {
          inline: [
            {
              blockquote: [
                'before quoted code',
                { code: 'quoted-code()' },
                'after quoted code',
              ],
            },
          ],
        },
      ],
      [
        {
          inline: [
            {
              blockquote: [
                'before quoted code',
                { break: null },
                { code: 'quoted-code()' },
                { break: null },
                'after quoted code',
              ],
            },
          ],
        },
      ]
    );
  });

  it('preserves code inside a list item with block separators', () => {
    expectRoundTrip(
      [
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [
                  {
                    item: [
                      'before listed code',
                      { code: 'listed-code()' },
                      'after listed code',
                    ],
                  },
                ],
              },
            },
          },
        },
      ],
      [
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [
                  {
                    item: [
                      'before listed code',
                      { break: null },
                      { code: 'listed-code()' },
                      { break: null },
                      'after listed code',
                    ],
                  },
                ],
              },
            },
          },
        },
      ]
    );
  });

  it('preserves code inside task content with block separators', () => {
    expectRoundTrip(
      [
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  {
                    item: [
                      {
                        task: {
                          checked: true,
                          content: [
                            'before task code',
                            { code: 'task-code()' },
                            'after task code',
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      ],
      [
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  {
                    item: [
                      {
                        task: {
                          checked: true,
                          content: [
                            'before task code',
                            { break: null },
                            { code: 'task-code()' },
                            { break: null },
                            'after task code',
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      ]
    );
  });

  it('preserves a quoted ship mention', () => {
    expectRoundTrip([
      {
        inline: [
          {
            blockquote: ['quoted ', { ship: '~zod' }],
          },
        ],
      },
    ]);
  });

  it('preserves a backend-wire-shaped ship mention', () => {
    expectRoundTrip([{ inline: [{ ship: '~zod' }] }]);
  });

  it('preserves ship and group mentions in a link label', () => {
    expectRoundTrip([
      {
        inline: [
          {
            link: {
              href: 'https://example.com',
              content: '~zod and @wire-admin',
            },
          },
        ],
      },
    ]);
  });

  // Story link content is a plain string, so raw inline HTML in a label has
  // nowhere to go. remark yields the tags as sibling `html` nodes around the
  // visible `text`; emitting their values would surface `<span>label</span>`
  // to the reader as the link's text.
  it('drops raw inline HTML from a link label, keeping the visible text', () => {
    expect(
      markdownToStory('[<span>label</span>](https://example.com)')
    ).toEqual([
      {
        inline: [{ link: { href: 'https://example.com', content: 'label' } }],
      },
    ]);
  });

  it('keeps image alt text as the visible content of a link label', () => {
    expect(
      markdownToStory('[![diagram](image.png)](https://example.com)')
    ).toEqual([
      {
        inline: [
          {
            link: { href: 'https://example.com', content: 'diagram' },
          },
        ],
      },
    ]);
  });

  // KNOWN LIMITATION, pinned deliberately. `%sect` now survives Story → Markdown
  // as `@all` / `@role` text (previously it was deleted outright), but the
  // Markdown parser does not install the group-mention plugin, so it returns as
  // plain text rather than a `%sect` inline. Installing that plugin would make
  // every isolated `@word` in ordinary prose a role mention across the whole
  // app, which nothing in this change needs. If that trade is revisited, the
  // narrow fix is an allowed-role-ID option supplied by each caller.
  it.each([
    {
      name: 'null sect',
      story: [{ inline: [{ sect: null }] }] as Story,
      text: '@all',
    },
    {
      name: 'named sect',
      story: [{ inline: [{ sect: 'wire-admin' }] }] as Story,
      text: '@wire-admin',
    },
  ])(
    'renders $name forward but returns it as plain text',
    ({ story, text }) => {
      const markdown = storyToMarkdown(story);
      expect(markdown.trim()).toBe(text);
      expect(markdownToStory(markdown)).toEqual([{ inline: [text] }]);
    }
  );

  it('preserves a hard break inside a blockquote', () => {
    expectRoundTrip([
      {
        inline: [
          {
            blockquote: ['a', { break: null }, 'b'],
          },
        ],
      },
    ]);
  });

  it.each([
    {
      name: 'unordered parent with ordered child',
      story: [
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
                      contents: ['unordered parent'],
                      items: [{ item: ['ordered child'] }],
                    },
                  },
                ],
              },
            },
          },
        },
      ] as Story,
    },
    {
      name: 'ordered parent with unordered child',
      story: [
        {
          block: {
            listing: {
              list: {
                type: 'ordered',
                contents: [],
                items: [
                  {
                    list: {
                      type: 'unordered',
                      contents: ['ordered parent'],
                      items: [{ item: ['unordered child'] }],
                    },
                  },
                ],
              },
            },
          },
        },
      ] as Story,
    },
    {
      name: 'tasklist parent with ordered child',
      story: [
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  {
                    item: [
                      {
                        task: {
                          checked: true,
                          content: ['task item'],
                        },
                      },
                    ],
                  },
                  {
                    list: {
                      type: 'ordered',
                      contents: ['tasklist parent'],
                      items: [{ item: ['ordered child'] }],
                    },
                  },
                ],
              },
            },
          },
        },
      ] as Story,
    },
  ])('preserves mixed list types: $name', ({ story }) => {
    expectRoundTrip(story);
  });
});

describe('storyToMarkdown', () => {
  it('converts empty story', () => {
    expect(storyToMarkdown([])).toBe('');
  });

  it('handles null/undefined story gracefully', () => {
    expect(storyToMarkdown(null as any)).toBe('');
    expect(storyToMarkdown(undefined as any)).toBe('');
  });

  it('converts single VerseInline', () => {
    expect(storyToMarkdown([{ inline: ['Hello, world!'] }])).toBe(
      'Hello, world!'
    );
  });

  it('converts Bold to **text**', () => {
    expect(storyToMarkdown([{ inline: [{ bold: ['bold text'] }] }])).toBe(
      '**bold text**'
    );
  });

  it('converts Italics to *text*', () => {
    expect(storyToMarkdown([{ inline: [{ italics: ['italic text'] }] }])).toBe(
      '*italic text*'
    );
  });

  it('converts ship mention', () => {
    expect(storyToMarkdown([{ inline: [{ ship: 'zod' }] }])).toBe('~zod');
  });

  it('converts a backend-shaped ship mention with exactly one sigil', () => {
    expect(storyToMarkdown([{ inline: [{ ship: '~zod' }] }])).toBe('~zod');
  });
});

describe('inlinesToMarkdown', () => {
  it('converts plain string', () => {
    expect(inlinesToMarkdown(['Hello, world!'])).toBe('Hello, world!');
  });

  it('converts Bold to **text**', () => {
    expect(inlinesToMarkdown([{ bold: ['bold text'] }])).toBe('**bold text**');
  });

  it('converts ship mention', () => {
    expect(inlinesToMarkdown([{ ship: 'zod' }])).toBe('~zod');
  });

  it('converts a backend-shaped ship mention with exactly one sigil', () => {
    expect(inlinesToMarkdown([{ ship: '~zod' }])).toBe('~zod');
  });
});

describe('blockToMarkdown', () => {
  it('converts Header h1', () => {
    expect(
      blockToMarkdown({ header: { tag: 'h1', content: ['Heading 1'] } })
    ).toBe('# Heading 1');
  });

  it('converts Code block', () => {
    expect(
      blockToMarkdown({ code: { code: 'const x = 1;', lang: 'js' } })
    ).toBe('```js\nconst x = 1;\n```');
  });

  it('converts Rule', () => {
    expect(blockToMarkdown({ rule: null })).toBe('---');
  });
});

import { describe, expect, it, test } from 'vitest';

import { Story } from '../../urbit/channel';
import {
  Block,
  Blockquote,
  Bold,
  Break,
  Code,
  Header,
  Image,
  Inline,
  InlineCode,
  Italics,
  Link,
  ListingBlock,
  Rule,
  Ship,
  Strikethrough,
  Task,
} from '../../urbit/content';
import { blockToMarkdown, inlinesToMarkdown, storyToMarkdown } from './index';
import { markdownToStory } from './parse';

describe('inlinesToMarkdown', () => {
  test('converts plain string', () => {
    const inlines: Inline[] = ['Hello, world!'];
    expect(inlinesToMarkdown(inlines)).toBe('Hello, world!');
  });

  test('converts Bold to **text**', () => {
    const inlines: Inline[] = [{ bold: ['bold text'] } as Bold];
    expect(inlinesToMarkdown(inlines)).toBe('**bold text**');
  });

  test('converts Italics to *text*', () => {
    const inlines: Inline[] = [{ italics: ['italic text'] } as Italics];
    expect(inlinesToMarkdown(inlines)).toBe('*italic text*');
  });

  test('converts Strikethrough to ~~text~~', () => {
    const inlines: Inline[] = [{ strike: ['struck text'] } as Strikethrough];
    expect(inlinesToMarkdown(inlines)).toBe('~~struck text~~');
  });

  test('converts InlineCode to `code`', () => {
    const inlines: Inline[] = [{ 'inline-code': 'const x = 1' } as InlineCode];
    expect(inlinesToMarkdown(inlines)).toBe('`const x = 1`');
  });

  test('converts Link to [content](href)', () => {
    const inlines: Inline[] = [
      { link: { href: 'https://example.com', content: 'Example' } } as Link,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('[Example](https://example.com)');
  });

  test('converts Ship to ~ship-name', () => {
    const inlines: Inline[] = [{ ship: 'zod' } as Ship];
    expect(inlinesToMarkdown(inlines)).toBe('~zod');
  });

  test('converts a backend-shaped Ship with exactly one sigil', () => {
    const inlines: Inline[] = [{ ship: '~zod' } as Ship];
    expect(inlinesToMarkdown(inlines)).toBe('~zod');
  });

  test('converts Break to newline', () => {
    const inlines: Inline[] = ['line 1', { break: null } as Break, 'line 2'];
    // remark-stringify uses backslash for hard breaks
    expect(inlinesToMarkdown(inlines)).toBe('line 1\\\nline 2');
  });

  test('drops a trailing Break at the paragraph boundary', () => {
    const story: Story = [{ inline: ['a', { break: null } as Break] }];
    expect(storyToMarkdown(story)).toBe('a');
  });

  test('handles nested inlines: bold within italic', () => {
    const inlines: Inline[] = [
      {
        italics: [{ bold: ['bold and italic'] } as Bold],
      } as Italics,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('***bold and italic***');
  });

  test('handles nested inlines: italic within bold', () => {
    const inlines: Inline[] = [
      {
        bold: [{ italics: ['italic and bold'] } as Italics],
      } as Bold,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('***italic and bold***');
  });

  test('handles multiple inline types', () => {
    const inlines: Inline[] = [
      'Hello ',
      { bold: ['world'] } as Bold,
      ', welcome to ',
      { link: { href: 'https://urbit.org', content: 'Urbit' } } as Link,
      '!',
    ];
    expect(inlinesToMarkdown(inlines)).toBe(
      'Hello **world**, welcome to [Urbit](https://urbit.org)!'
    );
  });

  test('handles deeply nested inlines', () => {
    const inlines: Inline[] = [
      {
        bold: [
          {
            italics: [{ strike: ['nested'] } as Strikethrough],
          } as Italics,
        ],
      } as Bold,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('***~~nested~~***');
  });

  test('pins content-neutral comments around strike inside bold phrasing', () => {
    const inlines: Inline[] = [
      {
        bold: ['a', { strike: ['b'] } as Strikethrough, 'c'],
      } as Bold,
    ];

    expect(inlinesToMarkdown(inlines)).toBe('**a<!-- -->~~b~~<!-- -->c**');
  });

  test.each([
    {
      name: 'link in italics',
      story: [
        {
          inline: [
            'before',
            {
              italics: [
                {
                  link: { href: 'https://x.test', content: 'link' },
                } as Link,
                { break: null } as Break,
                'after',
              ],
            } as Italics,
          ],
        },
      ] as Story,
      markdown: 'before<!-- -->*[link](https://x.test)*\\\n*after*',
    },
    {
      name: 'mention in bold',
      story: [
        {
          inline: [
            'before',
            {
              bold: [
                { ship: '~zod' } as Ship,
                { break: null } as Break,
                'after',
              ],
            } as Bold,
          ],
        },
      ] as Story,
      markdown: 'before<!-- -->**~zod**\\\n**after**',
    },
    {
      name: 'inline code in italics',
      story: [
        {
          inline: [
            'word',
            {
              italics: [
                { 'inline-code': 'x' } as InlineCode,
                { break: null } as Break,
                'after',
              ],
            } as Italics,
          ],
        },
      ] as Story,
      markdown: 'word<!-- -->*`x`*\\\n*after*',
    },
  ])(
    'stabilizes an unmarked-to-marked boundary ending at a break: $name',
    ({ story, markdown }) => {
      expect(storyToMarkdown(story)).toBe(markdown);
      expect(storyToMarkdown(markdownToStory(markdown))).toBe(markdown);
      expect(markdown).not.toMatch(/&#(?:x[\da-f]+|\d+);/i);
    }
  );

  test.each([
    {
      name: 'link-leading italics',
      leading: {
        link: { href: 'https://x.test', content: 'link' },
      } as Link,
      markdown: '**first**<!-- -->*[link](https://x.test)*\\\n*after*',
    },
    {
      name: 'inline-code-leading italics',
      leading: { 'inline-code': 'x' } as InlineCode,
      markdown: '**first**<!-- -->*`x`*\\\n*after*',
    },
    {
      name: 'punctuation-leading italics',
      leading: '!leading' as Inline,
      markdown: '**first**<!-- -->*!leading*\\\n*after*',
    },
  ])(
    'stabilizes adjacent marks before a lifted break: $name',
    ({ leading, markdown }) => {
      const story: Story = [
        {
          inline: [
            { bold: ['first'] } as Bold,
            {
              italics: [leading, { break: null } as Break, 'after'],
            } as Italics,
          ],
        },
      ];
      const canonicalStory: Story = [
        {
          inline: [
            { bold: ['first'] } as Bold,
            { italics: [leading] } as Italics,
            { break: null } as Break,
            { italics: ['after'] } as Italics,
          ],
        },
      ];

      expect(storyToMarkdown(story)).toBe(markdown);
      expect(markdownToStory(markdown)).toEqual(canonicalStory);
      expect(storyToMarkdown(markdownToStory(markdown))).toBe(markdown);
    }
  );

  test.each([
    {
      name: 'marked before unmarked phrasing',
      story: [
        {
          inline: [
            {
              italics: [
                {
                  link: { href: 'https://x.test', content: 'link' },
                } as Link,
              ],
            } as Italics,
            'after',
            { break: null } as Break,
            'tail',
          ],
        },
      ] as Story,
    },
    {
      name: 'mark not before a break',
      story: [
        {
          inline: [
            'before',
            {
              italics: [
                {
                  link: { href: 'https://x.test', content: 'link' },
                } as Link,
              ],
            } as Italics,
            'after',
          ],
        },
      ] as Story,
    },
    {
      name: 'marked boundary at paragraph start',
      story: [
        {
          inline: [
            {
              italics: [
                {
                  link: { href: 'https://x.test', content: 'link' },
                } as Link,
                { break: null } as Break,
                'after',
              ],
            } as Italics,
          ],
        },
      ] as Story,
    },
    {
      name: 'adjacent marks with a word-leading second segment',
      story: [
        {
          inline: [
            { bold: ['first'] } as Bold,
            {
              italics: ['second', { break: null } as Break, 'after'],
            } as Italics,
          ],
        },
      ] as Story,
    },
  ])('keeps the near-miss comment-free: $name', ({ story }) => {
    const markdown = storyToMarkdown(story);

    expect(markdown).not.toContain('<!-- -->');
    expect(storyToMarkdown(markdownToStory(markdown))).toBe(markdown);
  });

  test('handles empty inlines array', () => {
    expect(inlinesToMarkdown([])).toBe('');
  });

  test('converts Task inline with checked state', () => {
    const inlines: Inline[] = [
      { task: { checked: true, content: ['completed task'] } } as Task,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('[x] completed task');
  });

  test('converts Task inline with unchecked state', () => {
    const inlines: Inline[] = [
      { task: { checked: false, content: ['pending task'] } } as Task,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('[ ] pending task');
  });
});

describe('blockToMarkdown', () => {
  test('converts Header h1', () => {
    const block: Header = {
      header: { tag: 'h1', content: ['Heading 1'] },
    };
    expect(blockToMarkdown(block)).toBe('# Heading 1');
  });

  test('converts Header h2', () => {
    const block: Header = {
      header: { tag: 'h2', content: ['Heading 2'] },
    };
    expect(blockToMarkdown(block)).toBe('## Heading 2');
  });

  test('converts Header h3', () => {
    const block: Header = {
      header: { tag: 'h3', content: ['Heading 3'] },
    };
    expect(blockToMarkdown(block)).toBe('### Heading 3');
  });

  test('converts Header h4', () => {
    const block: Header = {
      header: { tag: 'h4', content: ['Heading 4'] },
    };
    expect(blockToMarkdown(block)).toBe('#### Heading 4');
  });

  test('converts Header h5', () => {
    const block: Header = {
      header: { tag: 'h5', content: ['Heading 5'] },
    };
    expect(blockToMarkdown(block)).toBe('##### Heading 5');
  });

  test('converts Header h6', () => {
    const block: Header = {
      header: { tag: 'h6', content: ['Heading 6'] },
    };
    expect(blockToMarkdown(block)).toBe('###### Heading 6');
  });

  test('converts Header with inline formatting', () => {
    const block: Header = {
      header: {
        tag: 'h1',
        content: ['Welcome to ', { bold: ['Urbit'] } as Bold],
      },
    };
    expect(blockToMarkdown(block)).toBe('# Welcome to **Urbit**');
  });

  test('converts Code block with language', () => {
    const block: Code = {
      code: { code: 'const x = 1;', lang: 'typescript' },
    };
    expect(blockToMarkdown(block)).toBe('```typescript\nconst x = 1;\n```');
  });

  test('converts Code block without language', () => {
    const block: Code = {
      code: { code: 'plain code', lang: '' },
    };
    expect(blockToMarkdown(block)).toBe('```\nplain code\n```');
  });

  test('converts Code block with multiline code', () => {
    const block: Code = {
      code: {
        code: 'function hello() {\n  return "world";\n}',
        lang: 'javascript',
      },
    };
    expect(blockToMarkdown(block)).toBe(
      '```javascript\nfunction hello() {\n  return "world";\n}\n```'
    );
  });

  test('converts Image', () => {
    const block: Image = {
      image: {
        src: 'https://example.com/image.png',
        alt: 'An example image',
        width: 100,
        height: 100,
      },
    };
    expect(blockToMarkdown(block)).toBe(
      '![An example image](https://example.com/image.png)'
    );
  });

  test('converts Image with empty alt', () => {
    const block: Image = {
      image: {
        src: 'https://example.com/image.png',
        alt: '',
        width: 100,
        height: 100,
      },
    };
    expect(blockToMarkdown(block)).toBe('![](https://example.com/image.png)');
  });

  test('converts Rule', () => {
    const block: Rule = { rule: null };
    expect(blockToMarkdown(block)).toBe('---');
  });

  test('converts unordered List with items', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'unordered',
          contents: [],
          items: [{ item: ['First item'] }, { item: ['Second item'] }],
        },
      },
    };
    expect(blockToMarkdown(block)).toBe('- First item\n- Second item');
  });

  test('emits backend root list contents before child listings', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'unordered',
          contents: ['Root contents'],
          items: [{ item: ['Child item'] }],
        },
      },
    };

    expect(blockToMarkdown(block)).toBe('Root contents\n\n- Child item');
  });

  test('converts ordered List with items', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'ordered',
          contents: [],
          items: [{ item: ['First item'] }, { item: ['Second item'] }],
        },
      },
    };
    expect(blockToMarkdown(block)).toBe('1. First item\n2. Second item');
  });

  test('converts tasklist with checked and unchecked items', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'tasklist',
          contents: [],
          items: [
            {
              item: [
                { task: { checked: true, content: ['Done task'] } } as Task,
              ],
            },
            {
              item: [
                { task: { checked: false, content: ['Todo task'] } } as Task,
              ],
            },
          ],
        },
      },
    };
    expect(blockToMarkdown(block)).toBe('- [x] Done task\n- [ ] Todo task');
  });

  test('preserves inlines following a backend task in a list item', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'tasklist',
          contents: [],
          items: [
            {
              item: [
                { task: { checked: true, content: ['Task body'] } } as Task,
                ' and sibling text',
              ],
            },
          ],
        },
      },
    };

    expect(blockToMarkdown(block)).toBe('- [x] Task body and sibling text');
  });

  test('preserves inlines following a backend task in nested list contents', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'tasklist',
          contents: [],
          items: [
            {
              list: {
                type: 'tasklist',
                contents: [
                  {
                    task: { checked: false, content: ['Parent task'] },
                  } as Task,
                  ' and sibling text',
                ],
                items: [
                  {
                    item: [
                      {
                        task: { checked: true, content: ['Child task'] },
                      } as Task,
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    };

    expect(blockToMarkdown(block)).toBe(
      '- [ ] Parent task and sibling text\n  - [x] Child task'
    );
  });

  test('converts nested unordered lists', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'unordered',
          contents: [],
          items: [
            { item: ['Parent item'] },
            {
              list: {
                type: 'unordered',
                contents: ['Nested parent'],
                items: [{ item: ['Nested child'] }],
              },
            },
          ],
        },
      },
    };
    expect(blockToMarkdown(block)).toBe(
      '- Parent item\n- Nested parent\n  - Nested child'
    );
  });

  test('converts nested ordered lists', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'ordered',
          contents: [],
          items: [
            { item: ['First'] },
            {
              list: {
                type: 'ordered',
                contents: ['Second with subitems'],
                items: [{ item: ['Sub-first'] }, { item: ['Sub-second'] }],
              },
            },
          ],
        },
      },
    };
    expect(blockToMarkdown(block)).toBe(
      '1. First\n2. Second with subitems\n   1. Sub-first\n   2. Sub-second'
    );
  });

  test('converts List items with inline formatting', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'unordered',
          contents: [],
          items: [
            { item: ['Plain text'] },
            { item: [{ bold: ['Bold text'] } as Bold] },
            {
              item: ['Mixed ', { italics: ['italic'] } as Italics, ' text'],
            },
          ],
        },
      },
    };
    expect(blockToMarkdown(block)).toBe(
      '- Plain text\n- **Bold text**\n- Mixed *italic* text'
    );
  });

  test('pins a multi-paragraph plain list item', () => {
    const block: ListingBlock = {
      listing: {
        list: {
          type: 'unordered',
          contents: [],
          items: [{ item: ['a', { break: null } as Break, 'b'] }],
        },
      },
    };

    expect(blockToMarkdown(block)).toBe('- a\n\n  b');
  });

  test('returns empty string for unhandled block types', () => {
    const block = { cite: { group: 'test-flag' } } as Block;
    expect(blockToMarkdown(block)).toBe('');
  });
});

describe('inlinesToMarkdown - Blockquote', () => {
  test('converts simple Blockquote to > prefixed lines', () => {
    const inlines: Inline[] = [
      { blockquote: ['This is a quote'] } as Blockquote,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('> This is a quote');
  });

  test('converts Blockquote with multiple lines', () => {
    const inlines: Inline[] = [
      {
        blockquote: ['Line 1', { break: null } as Break, 'Line 2'],
      } as Blockquote,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('> Line 1\\\n> Line 2');
  });

  test('converts Blockquote with inline formatting', () => {
    const inlines: Inline[] = [
      {
        blockquote: ['Quote with ', { bold: ['bold'] } as Bold, ' text'],
      } as Blockquote,
    ];
    expect(inlinesToMarkdown(inlines)).toBe('> Quote with **bold** text');
  });

  test('converts Blockquote with italics containing links', () => {
    const inlines: Inline[] = [
      {
        blockquote: [
          {
            italics: [
              'Text before ',
              { link: { href: 'https://example.com', content: 'link text' } },
              ' text after',
            ],
          } as Italics,
        ],
      } as Blockquote,
    ];
    expect(inlinesToMarkdown(inlines)).toBe(
      '> *Text before [link text](https://example.com) text after*'
    );
  });

  test('preserves a ship mention in a structural blockquote', () => {
    const inlines: Inline[] = [
      {
        blockquote: ['quoted ', { ship: '~zod' } as Ship],
      } as Blockquote,
    ];

    expect(inlinesToMarkdown(inlines)).toBe('> quoted ~zod');
  });

  test('renders nested blockquotes without flattening them', () => {
    const story: Story = [
      {
        inline: [
          {
            blockquote: ['outer', { blockquote: ['inner'] } as Blockquote],
          } as Blockquote,
        ],
      },
    ];

    expect(storyToMarkdown(story, { strict: true })).toBe(
      '> outer\n>\n> > inner'
    );
  });
});

describe('storyToMarkdown', () => {
  test('converts empty story', () => {
    const story: Story = [];
    expect(storyToMarkdown(story)).toBe('');
  });

  test('handles null/undefined story gracefully', () => {
    expect(storyToMarkdown(null as unknown as Story)).toBe('');
    expect(storyToMarkdown(undefined as unknown as Story)).toBe('');
  });

  test('converts single VerseInline', () => {
    const story: Story = [{ inline: ['Hello, world!'] }];
    expect(storyToMarkdown(story)).toBe('Hello, world!');
  });

  test('converts single VerseBlock with header', () => {
    const story: Story = [
      {
        block: {
          header: { tag: 'h1', content: ['My Title'] },
        } as Header,
      },
    ];
    expect(storyToMarkdown(story)).toBe('# My Title');
  });

  test('converts multiple VerseInlines with paragraph separation', () => {
    const story: Story = [
      { inline: ['First paragraph'] },
      { inline: ['Second paragraph'] },
    ];
    expect(storyToMarkdown(story)).toBe('First paragraph\n\nSecond paragraph');
  });

  test('converts mixed inline and block verses', () => {
    const story: Story = [
      {
        block: {
          header: { tag: 'h1', content: ['Document Title'] },
        } as Header,
      },
      { inline: ['This is the introduction.'] },
      {
        block: {
          code: { code: 'const x = 1;', lang: 'javascript' },
        } as Code,
      },
      { inline: ['Conclusion paragraph.'] },
    ];
    expect(storyToMarkdown(story)).toBe(
      '# Document Title\n\nThis is the introduction.\n\n```javascript\nconst x = 1;\n```\n\nConclusion paragraph.'
    );
  });

  test('converts VerseInline with blockquote', () => {
    const story: Story = [
      {
        inline: [{ blockquote: ['This is a quoted text'] } as Blockquote],
      },
    ];
    expect(storyToMarkdown(story)).toBe('> This is a quoted text');
  });

  test('collapses consecutive breaks before a lifted blockquote', () => {
    const story: Story = [
      {
        inline: [
          'intro',
          { break: null } as Break,
          { break: null } as Break,
          { blockquote: ['q'] } as Blockquote,
        ],
      },
    ];

    const markdown = storyToMarkdown(story);
    expect(markdown).toBe('intro\n\n> q');
    expect(storyToMarkdown(markdownToStory(markdown))).toBe(markdown);
  });

  test('collapses a marked break before a lifted blockquote', () => {
    const story: Story = [
      {
        inline: [
          {
            italics: [
              'a',
              { break: null } as Break,
              { blockquote: ['b'] } as Blockquote,
            ],
          } as Italics,
        ],
      },
    ];

    const markdown = storyToMarkdown(story);
    expect(markdown).toBe('*a*\n\n> *b*');
    expect(markdown).not.toContain('&#xA;');
    expect(storyToMarkdown(markdownToStory(markdown))).toBe(markdown);
  });

  test('preserves lang when lifting a block-shaped code inline', () => {
    const story = [
      {
        inline: [
          {
            code: { code: 'const value = 1;', lang: 'js' },
          } as unknown as Inline,
        ],
      },
    ] as Story;

    const markdown = storyToMarkdown(story);
    expect(markdown).toBe('```js\nconst value = 1;\n```');
    expect(storyToMarkdown(markdownToStory(markdown))).toBe(markdown);
  });

  test('converts story with list blocks', () => {
    const story: Story = [
      { inline: ['Shopping list:'] },
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [{ item: ['Apples'] }, { item: ['Bananas'] }],
            },
          },
        } as ListingBlock,
      },
    ];
    expect(storyToMarkdown(story)).toBe(
      'Shopping list:\n\n- Apples\n- Bananas'
    );
  });

  test('converts story with inline formatting', () => {
    const story: Story = [
      {
        inline: [
          'This has ',
          { bold: ['bold'] } as Bold,
          ' and ',
          { italics: ['italic'] } as Italics,
          ' text.',
        ],
      },
    ];
    expect(storyToMarkdown(story)).toBe('This has **bold** and *italic* text.');
  });

  test('converts story with ship mentions', () => {
    const story: Story = [
      {
        inline: [
          'Hello ',
          { ship: 'zod' } as Ship,
          ' and ',
          { ship: 'bus' } as Ship,
          '!',
        ],
      },
    ];
    expect(storyToMarkdown(story)).toBe('Hello ~zod and ~bus!');
  });

  test('converts backend-shaped story ship mentions with one sigil each', () => {
    const story: Story = [
      {
        inline: [
          'Hello ',
          { ship: '~zod' } as Ship,
          ' and ',
          { ship: '~bus' } as Ship,
          '!',
        ],
      },
    ];
    expect(storyToMarkdown(story)).toBe('Hello ~zod and ~bus!');
  });

  test('skips empty verses', () => {
    const story: Story = [
      { inline: ['First'] },
      { inline: [] },
      { inline: ['Second'] },
    ];
    expect(storyToMarkdown(story)).toBe('First\n\nSecond');
  });

  test('converts complex mixed story', () => {
    const story: Story = [
      {
        block: {
          header: { tag: 'h1', content: ['Welcome'] },
        } as Header,
      },
      {
        inline: ['This is an intro with ', { bold: ['emphasis'] } as Bold, '.'],
      },
      { block: { rule: null } as Rule },
      {
        block: {
          listing: {
            list: {
              type: 'ordered',
              contents: [],
              items: [{ item: ['Step one'] }, { item: ['Step two'] }],
            },
          },
        } as ListingBlock,
      },
      {
        inline: [{ blockquote: ['Important note'] } as Blockquote],
      },
    ];
    expect(storyToMarkdown(story)).toBe(
      '# Welcome\n\nThis is an intro with **emphasis**.\n\n---\n\n1. Step one\n2. Step two\n\n> Important note'
    );
  });
});

describe('ship mention serialization', () => {
  function expectIdentity(story: Story, markdown: string): void {
    expect(storyToMarkdown(story)).toBe(markdown);
    expect(markdownToStory(markdown)).toEqual(story);
  }

  it('serializes literal ship-shaped text escaped, without promotion', () => {
    expect(storyToMarkdown([{ inline: ['~zod'] }])).toBe('\\~zod');
  });

  it('round-trips the issue example identically', () => {
    const story: Story = [{ inline: ['; ~ripdys is your neighbor'] }];
    expect(markdownToStory(storyToMarkdown(story))).toEqual(story);
  });

  it('round-trips a real mention to itself', () => {
    expectIdentity([{ inline: [{ ship: '~zod' } as Ship] }], '~zod');
  });

  describe('adjacency separators', () => {
    it('separates a mention from fusable lowercase text', () => {
      expectIdentity(
        [{ inline: [{ ship: '~zod' } as Ship, 'abc'] }],
        '~zod<!-- -->abc'
      );
    });

    it('separates a mention from digit-leading text', () => {
      expectIdentity(
        [{ inline: [{ ship: '~zod' } as Ship, '2fast'] }],
        '~zod<!-- -->2fast'
      );
    });

    it('separates a mention from hyphen-leading text', () => {
      expectIdentity(
        [{ inline: [{ ship: '~zod' } as Ship, '-monster'] }],
        '~zod<!-- -->-monster'
      );
    });

    it('separates a mention from uppercase text', () => {
      expectIdentity(
        [{ inline: [{ ship: '~zod' } as Ship, 'ABC'] }],
        '~zod<!-- -->ABC'
      );
    });

    it('separates a mention from an email-trigger follower', () => {
      const story: Story = [
        { inline: [{ ship: '~zod' } as Ship, '.foo@example.com'] },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toContain('~zod<!-- -->');
      // The follower may legitimately autolink on reparse/reserialize, so
      // assert mention survival rather than byte identity.
      const reparsed = markdownToStory(markdown);
      expect(JSON.stringify(reparsed)).toContain('"ship":"~zod"');
      expect(JSON.stringify(reparsed)).not.toContain('~zod.foo');
    });

    it('does not separate a mention from space-leading text', () => {
      expectIdentity(
        [{ inline: [{ ship: '~zod' } as Ship, ' after'] }],
        '~zod after'
      );
    });

    it('does not separate adjacent mentions', () => {
      expectIdentity(
        [{ inline: [{ ship: '~zod' } as Ship, { ship: '~bus' } as Ship] }],
        '~zod~bus'
      );
    });

    it('does not separate text before a mention', () => {
      expectIdentity(
        [{ inline: ['abc', { ship: '~zod' } as Ship] }],
        'abc~zod'
      );
    });

    it('does not separate text ending in an escaped tilde before a mention', () => {
      expectIdentity(
        [{ inline: ['x~', { ship: '~zod' } as Ship] }],
        'x\\~~zod'
      );
    });

    it('separates despite a zero-width text node between', () => {
      const story: Story = [{ inline: [{ ship: '~zod' } as Ship, '', 'abc'] }];
      expect(storyToMarkdown(story)).toBe('~zod<!-- -->abc');
      // The zero-width inline is unrepresentable and dropped on reparse.
      expect(markdownToStory('~zod<!-- -->abc')).toEqual([
        { inline: [{ ship: '~zod' }, 'abc'] },
      ]);
    });
  });

  describe('mark-sibling separators', () => {
    it('separates a mention from punctuation-leading bold', () => {
      const story: Story = [
        { inline: [{ ship: '~zod' } as Ship, { bold: ['!lead'] } as Bold] },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toBe('~zod<!-- -->**!lead**');
      expect(markdown).not.toMatch(/&#/);
      expect(markdownToStory(markdown)).toEqual(story);
    });

    it('separates a mention from punctuation-leading italics', () => {
      const story: Story = [
        {
          inline: [{ ship: '~zod' } as Ship, { italics: ['!lead'] } as Italics],
        },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toBe('~zod<!-- -->*!lead*');
      expect(markdown).not.toMatch(/&#/);
      expect(markdownToStory(markdown)).toEqual(story);
    });

    it('separates a mention from bold containing a mention', () => {
      const story: Story = [
        {
          inline: [
            { ship: '~zod' } as Ship,
            { bold: [{ ship: '~bus' } as Ship] } as Bold,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toContain('~zod<!-- -->**');
      expect(markdown).not.toMatch(/&#/);
      expect(markdownToStory(markdown)).toEqual(story);
    });

    it('separates a mention from a nested-mark first child', () => {
      const story: Story = [
        {
          inline: [
            { ship: '~zod' } as Ship,
            { bold: [{ italics: ['word'] } as Italics] } as Bold,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toContain('~zod<!-- -->');
      expect(markdown).not.toMatch(/&#/);
      // ***-combined runs legitimately reparse with nesting swapped; assert
      // convergence and mention survival rather than story identity.
      const reparsed = markdownToStory(markdown);
      expect(JSON.stringify(reparsed)).toContain('"ship":"~zod"');
      expect(JSON.stringify(reparsed)).toContain('word');
      expect(storyToMarkdown(reparsed)).toBe(markdown);
    });

    it('separates a mention from a strike containing a mention', () => {
      const story: Story = [
        {
          inline: [
            { ship: '~zod' } as Ship,
            { strike: [{ ship: '~bus' } as Ship] } as Strikethrough,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toContain('~zod<!-- -->~~');
      expect(markdownToStory(markdown)).toEqual(story);
    });

    it('separates a mention from a strike containing bold', () => {
      const story: Story = [
        {
          inline: [
            { ship: '~zod' } as Ship,
            { strike: [{ bold: ['word'] } as Bold] } as Strikethrough,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toContain('~zod<!-- -->~~');
      const reparsed = markdownToStory(markdown);
      expect(JSON.stringify(reparsed)).toContain('"ship":"~zod"');
      expect(JSON.stringify(reparsed)).toContain('"strike"');
      expect(storyToMarkdown(reparsed)).toBe(markdown);
    });

    it('keeps word-leading bold unchanged', () => {
      expectIdentity(
        [{ inline: [{ ship: '~zod' } as Ship, { bold: ['word'] } as Bold] }],
        '~zod**word**'
      );
    });

    it('keeps word-leading strike unchanged', () => {
      expectIdentity(
        [
          {
            inline: [
              { ship: '~zod' } as Ship,
              { strike: ['gone'] } as Strikethrough,
            ],
          },
        ],
        '~zod~~gone~~'
      );
    });
  });

  describe('empty-text pruning', () => {
    it('wraps a mention inside a strike despite an empty text inline', () => {
      const story: Story = [
        {
          inline: [{ strike: ['', { ship: '~zod' } as Ship] } as Strikethrough],
        },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toBe('~~<span>~zod</span>~~');
      const reparsed = markdownToStory(markdown);
      expect(JSON.stringify(reparsed)).toContain('"strike"');
      expect(JSON.stringify(reparsed)).toContain('"ship":"~zod"');
    });

    it('keeps a strike and a following mention from merging tilde runs', () => {
      const story: Story = [
        {
          inline: [
            { strike: ['gone'] } as Strikethrough,
            '',
            { ship: '~zod' } as Ship,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      expect(markdown).toBe('~~gone~~<span>~zod</span>');
      const reparsed = markdownToStory(markdown);
      expect(JSON.stringify(reparsed)).toContain('"strike"');
      expect(JSON.stringify(reparsed)).toContain('"ship":"~zod"');
    });

    it('prunes empty text in the independent inlinesToMarkdown pipeline', () => {
      expect(
        inlinesToMarkdown([{ strike: ['', { ship: '~zod' } as Ship] }])
      ).toBe('~~<span>~zod</span>~~');
    });
  });

  describe('inlinesToMarkdown pipeline', () => {
    it('serializes literal ship-shaped text escaped, without promotion', () => {
      expect(inlinesToMarkdown(['~zod'])).toBe('\\~zod');
    });

    it('inserts the adjacency separator', () => {
      expect(inlinesToMarkdown([{ ship: '~zod' } as Ship, 'abc'])).toBe(
        '~zod<!-- -->abc'
      );
    });
  });
});

describe('blockquote ownership in list items', () => {
  function listStory(
    listType: 'unordered' | 'tasklist',
    content: Inline[]
  ): Story {
    return [
      {
        block: {
          listing: {
            list: {
              type: listType,
              contents: [],
              items: [
                {
                  item:
                    listType === 'tasklist'
                      ? [{ task: { checked: true, content } } as Task]
                      : content,
                },
              ],
            },
          },
        },
      },
    ];
  }

  test.each([
    {
      name: 'plain list quote then text',
      listType: 'unordered' as const,
      tail: 'after' as Inline,
      markdown: '- > quote\n\n  after',
    },
    {
      name: 'plain list quote then marked text',
      listType: 'unordered' as const,
      tail: { bold: ['after'] } as Bold,
      markdown: '- > quote\n\n  **after**',
    },
    {
      name: 'task list quote then text',
      listType: 'tasklist' as const,
      tail: 'after' as Inline,
      markdown: '- [x] <!-- -->\n\n  > quote\n\n  after',
    },
    {
      name: 'task list quote then marked text',
      listType: 'tasklist' as const,
      tail: { bold: ['after'] } as Bold,
      markdown: '- [x] <!-- -->\n\n  > quote\n\n  **after**',
    },
  ])('preserves quote ownership for $name', ({ listType, tail, markdown }) => {
    const story = listStory(listType, [{ blockquote: ['quote'] }, tail]);
    const canonicalStory = listStory(listType, [
      { blockquote: ['quote'] },
      { break: null },
      tail,
    ]);

    expect(storyToMarkdown(story, { strict: true })).toBe(markdown);
    expect(markdownToStory(markdown)).toEqual(canonicalStory);
    expect(storyToMarkdown(canonicalStory, { strict: true })).toBe(markdown);
  });

  test.each([
    {
      name: 'plain list',
      listType: 'unordered' as const,
      markdown: '- > quote\n  ```\n  x\n  ```\n  after',
    },
    {
      name: 'task list',
      listType: 'tasklist' as const,
      markdown: '- [x] <!-- -->\n  > quote\n  ```\n  x\n  ```\n  after',
    },
  ])(
    'keeps quote then code then paragraph tight for $name',
    ({ listType, markdown }) => {
      // Inline %code is string-only on the wire, so a nested fence carries
      // no language; the tightness of the surrounding list is what these
      // cases pin.
      const code: Inline = { code: 'x' };
      const story = listStory(listType, [
        { blockquote: ['quote'] },
        code,
        'after',
      ]);
      const canonicalStory = listStory(listType, [
        { blockquote: ['quote'] },
        { break: null },
        code,
        { break: null },
        'after',
      ]);

      expect(storyToMarkdown(story, { strict: true })).toBe(markdown);
      expect(markdownToStory(markdown)).toEqual(canonicalStory);
      expect(storyToMarkdown(canonicalStory, { strict: true })).toBe(markdown);
    }
  );
});

describe('strict mode rejects tasks outside task-list items', () => {
  const inVerse = [
    { inline: [{ task: { checked: true, content: ['label'] } }] },
  ] as Story;
  const inHeader = [
    {
      block: {
        header: {
          tag: 'h2',
          content: [{ task: { checked: false, content: ['x'] } }],
        },
      },
    },
  ] as Story;

  test('throws for a bare task in an inline verse', () => {
    expect(() => storyToMarkdown(inVerse, { strict: true })).toThrow(
      /task faithfully outside a task-list item/
    );
  });

  test('throws for a task inside a header', () => {
    expect(() => storyToMarkdown(inHeader, { strict: true })).toThrow(
      /task faithfully outside a task-list item/
    );
  });

  test('non-strict keeps the checkbox-text degradation', () => {
    expect(storyToMarkdown(inVerse)).toBe('[x] label');
    expect(storyToMarkdown(inHeader)).toBe('## [ ] x');
  });
});

describe('nested fenced code stays wire-legal', () => {
  test('a tagged fence in a blockquote parses to string %code, lang dropped', () => {
    const story = markdownToStory('> ```js\n> x\n> ```');
    expect(JSON.stringify(story)).not.toContain('"lang"');
    expect(JSON.stringify(story)).toContain('"code":"x"');
    const md = storyToMarkdown(story);
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });
});

describe('phrasing survives around marked block inlines', () => {
  test('text before and after a bold-wrapped blockquote stays joined', () => {
    const story = [
      {
        inline: [
          'prefix ',
          { bold: ['before', { blockquote: ['q'] }, 'after'] },
          ' suffix',
        ],
      },
    ] as Story;
    const md = storyToMarkdown(story);
    expect(md).toBe('prefix **before**\n\n> **q**\n\n**after** suffix');
    expect(md).not.toMatch(/&#(?:x[\da-f]+|\d+);/i);
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });
});

describe('non-leading tasks in plain list items', () => {
  const story = [
    {
      block: {
        listing: {
          list: {
            type: 'unordered',
            contents: [],
            items: [
              {
                item: [
                  'prefix ',
                  { task: { checked: true, content: ['done'] } },
                ],
              },
            ],
          },
        },
      },
    },
  ] as unknown as Story;

  test('strict mode rejects: only a leading checkbox reparses as a task', () => {
    expect(() => storyToMarkdown(story, { strict: true })).toThrow(
      /task faithfully outside a task-list item/
    );
  });

  test('non-strict keeps the text degradation', () => {
    expect(storyToMarkdown(story)).toBe('- prefix [x] done');
  });
});

describe('task-position validation does not tear paragraphs', () => {
  const item = (inlines: unknown[]) =>
    [
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [{ item: inlines }],
            },
          },
        },
      },
    ] as unknown as Story;

  test('leading task with a tail stays one line in strict mode', () => {
    expect(
      storyToMarkdown(
        item([{ task: { checked: true, content: ['done'] } }, ' tail']),
        { strict: true }
      )
    ).toBe('- [x] done tail');
  });

  test('a task nested inside the exempt leading task rejects', () => {
    expect(() =>
      storyToMarkdown(
        item([
          {
            task: {
              checked: true,
              content: [
                'outer ',
                { task: { checked: false, content: ['inner'] } },
              ],
            },
          },
        ]),
        { strict: true }
      )
    ).toThrow(/task faithfully/);
  });

  test('a task after a leading break rejects', () => {
    expect(() =>
      storyToMarkdown(
        item([{ break: null }, { task: { checked: true, content: ['done'] } }]),
        { strict: true }
      )
    ).toThrow(/task faithfully/);
  });
});

describe('block-only marked spans keep boundaries entity-free', () => {
  test('mark containing only a block trims unrepresentable boundary spaces', () => {
    const md = storyToMarkdown(
      [
        { inline: ['pre ', { bold: [{ blockquote: ['q'] }] }, ' post'] },
      ] as Story,
      { strict: true }
    );
    expect(md).toBe('pre\n\n> **q**\n\npost');
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });

  test('space-leading marked sibling after a block-only lift trims cleanly', () => {
    const md = storyToMarkdown(
      [
        {
          inline: [{ bold: [{ blockquote: ['q'] }] }, { italics: [' after'] }],
        },
      ] as Story,
      { strict: true }
    );
    expect(md).toBe('> **q**\n\n*after*');
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });

  test('the lift path leading join honors a pending leading trim', () => {
    const md = storyToMarkdown(
      [
        {
          inline: [
            { bold: [{ blockquote: ['q'] }] },
            { italics: [' x', { blockquote: ['b'] }] },
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(md).toBe('> **q**\n\n*x*\n\n> *b*');
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });

  test('direct block lifts trim boundary spaces like marked ones', () => {
    const leading = storyToMarkdown(
      [{ inline: [{ blockquote: ['q'] }, ' after'] }] as Story,
      { strict: true }
    );
    expect(leading).toBe('> q\n\nafter');
    expect(storyToMarkdown(markdownToStory(leading))).toBe(leading);

    const trailing = storyToMarkdown(
      [{ inline: ['pre ', { blockquote: ['q'] }] }] as Story,
      { strict: true }
    );
    expect(trailing).toBe('pre\n\n> q');
    expect(storyToMarkdown(markdownToStory(trailing))).toBe(trailing);

    const marked = storyToMarkdown(
      [{ inline: [{ blockquote: ['q'] }, { italics: [' after'] }] }] as Story,
      { strict: true }
    );
    expect(marked).toBe('> q\n\n*after*');
    expect(storyToMarkdown(markdownToStory(marked))).toBe(marked);

    // The code-lift shape shares the trim; its round trip is excluded here
    // because the parser defaults a bare fence to lang "text" (pre-existing,
    // independent of boundary handling).
    const code = storyToMarkdown(
      [{ inline: [{ code: 'x = 1' }, ' after'] }] as Story,
      { strict: true }
    );
    expect(code).toBe('```\nx = 1\n```\n\nafter');
  });

  test('a trailing break cannot shield a boundary space from the trim', () => {
    const direct = storyToMarkdown(
      [{ inline: ['pre ', { break: null }, { blockquote: ['q'] }] }] as Story,
      { strict: true }
    );
    expect(direct).toBe('pre\n\n> q');
    expect(storyToMarkdown(markdownToStory(direct))).toBe(direct);

    const marked = storyToMarkdown(
      [
        {
          inline: ['pre ', { break: null }, { bold: [{ blockquote: ['q'] }] }],
        },
      ] as Story,
      { strict: true }
    );
    expect(marked).toBe('pre\n\n> **q**');
    expect(storyToMarkdown(markdownToStory(marked))).toBe(marked);
  });

  test('discarded inlines do not consume a pending boundary trim', () => {
    const viaBreak = storyToMarkdown(
      [{ inline: [{ blockquote: ['q'] }, { break: null }, ' after'] }] as Story,
      { strict: true }
    );
    expect(viaBreak).toBe('> q\n\nafter');
    expect(storyToMarkdown(markdownToStory(viaBreak))).toBe(viaBreak);

    const viaEmptyString = storyToMarkdown(
      [{ inline: [{ blockquote: ['q'] }, '', ' after'] }] as Story,
      { strict: true }
    );
    expect(viaEmptyString).toBe('> q\n\nafter');

    const viaEmptiedMark = storyToMarkdown(
      [{ inline: [{ blockquote: ['q'] }, { bold: [' '] }, ' after'] }] as Story,
      { strict: true }
    );
    expect(viaEmptiedMark).toBe('> q\n\nafter');

    const viaBreakThenMark = storyToMarkdown(
      [
        {
          inline: [
            { blockquote: ['q'] },
            { break: null },
            { italics: [' after'] },
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(viaBreakThenMark).toBe('> q\n\n*after*');
    expect(storyToMarkdown(markdownToStory(viaBreakThenMark))).toBe(
      viaBreakThenMark
    );
  });

  test('the list-item break split trims the seams it hides', () => {
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [
                { item: [{ blockquote: ['q'] }, { break: null }, ' after'] },
              ],
            },
          },
        },
      },
    ] as Story;
    const md = storyToMarkdown(story, { strict: true });
    expect(md).toBe('- > q\n\n  after');
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });

  test('boundary whitespace split across nodes is trimmed exhaustively', () => {
    const trailing = storyToMarkdown(
      [
        {
          inline: [
            'lead ',
            { bold: ['word '] },
            { italics: [' '] },
            { blockquote: ['q'] },
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(trailing).toBe('lead **word**\n\n> q');
    expect(storyToMarkdown(markdownToStory(trailing))).toBe(trailing);

    const leading = storyToMarkdown(
      [{ inline: [{ blockquote: ['q'] }, { bold: [' ', ' after'] }] }] as Story,
      { strict: true }
    );
    expect(leading).toBe('> q\n\n**after**');
    expect(storyToMarkdown(markdownToStory(leading))).toBe(leading);

    const mirrored = storyToMarkdown(
      [
        {
          inline: [
            { blockquote: ['q'] },
            { strike: [' ', { bold: [' b'] }, 'c'] },
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(mirrored).toBe('> q\n\n~~**b**<!-- -->c~~');
    expect(storyToMarkdown(markdownToStory(mirrored))).toBe(mirrored);
  });

  test('empty text-like inlines leave the boundary open', () => {
    const viaTag = storyToMarkdown(
      [{ inline: [{ blockquote: ['q'] }, { tag: '' }, ' after'] }] as Story,
      { strict: true }
    );
    expect(viaTag).toBe('> q\n\nafter');
    expect(storyToMarkdown(markdownToStory(viaTag))).toBe(viaTag);

    const viaBlockRef = storyToMarkdown(
      [
        {
          inline: [
            { blockquote: ['q'] },
            { block: { index: 0, text: '' } },
            ' after',
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(viaBlockRef).toBe('> q\n\nafter');

    // Control: an empty link still emits visible Markdown syntax, so it
    // correctly consumes the pending trim and the space stays mid-paragraph.
    const viaLink = storyToMarkdown(
      [
        {
          inline: [
            { blockquote: ['q'] },
            { link: { href: 'https://example.com', content: '' } },
            ' after',
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(viaLink).toBe('> q\n\n[](https://example.com) after');
  });

  test('a break exposed by the trailing trim keeps the trim going', () => {
    const shallow = storyToMarkdown(
      [
        {
          inline: [
            'lead ',
            { bold: ['word ', { break: null }, ' '] },
            { blockquote: ['q'] },
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(shallow).toBe('lead **word**\n\n> q');
    expect(storyToMarkdown(markdownToStory(shallow))).toBe(shallow);

    const deep = storyToMarkdown(
      [
        {
          inline: [
            'lead ',
            {
              bold: [
                { italics: [{ strike: ['word ', { break: null }, ' '] }] },
              ],
            },
            { blockquote: ['q'] },
          ],
        },
      ] as Story,
      { strict: true }
    );
    expect(deep).toBe('lead ***~~word~~***\n\n> q');
    expect(storyToMarkdown(markdownToStory(deep))).toBe(deep);
  });
});

describe('mirror delimiter comments fire only on compact adjacency', () => {
  test('whitespace-separated marks under strike stay comment-free', () => {
    expect(
      storyToMarkdown([
        { inline: [{ strike: ['a ', { bold: ['b'] }, ' c'] }] },
      ] as Story)
    ).toBe('~~a **b** c~~');
  });
});

describe('final delimiter-edge completions', () => {
  test('adjacent marks: ship-mention-leading second mark gets the separator', () => {
    const story = [
      {
        inline: [
          { bold: ['first'] },
          { italics: [{ ship: '~zod' }, { break: null }, 'after'] },
        ],
      },
    ] as Story;
    const md = storyToMarkdown(story);
    expect(md).toContain('<!-- -->');
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });

  test('trailing space inside a terminal mark trims at a no-join boundary', () => {
    const story = [
      {
        inline: [{ bold: ['prefix '] }, { italics: [{ blockquote: ['q'] }] }],
      },
    ] as Story;
    const md = storyToMarkdown(story);
    expect(md).not.toMatch(/&#(?:x[\da-f]+|\d+);/i);
    expect(storyToMarkdown(markdownToStory(md))).toBe(md);
  });
});

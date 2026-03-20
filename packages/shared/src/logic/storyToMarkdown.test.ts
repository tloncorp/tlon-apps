import { describe, expect, test } from 'vitest';

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
} from '@tloncorp/api/urbit/content';
import { Story } from '@tloncorp/api/urbit/channel';
import {
  blockToMarkdown,
  inlinesToMarkdown,
  storyToMarkdown,
} from './markdown';

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

  test('converts Break to newline', () => {
    const inlines: Inline[] = [
      'line 1',
      { break: null } as Break,
      'line 2',
    ];
    // remark-stringify uses backslash for hard breaks
    expect(inlinesToMarkdown(inlines)).toBe('line 1\\\nline 2');
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
              item: [
                'Mixed ',
                { italics: ['italic'] } as Italics,
                ' text',
              ],
            },
          ],
        },
      },
    };
    expect(blockToMarkdown(block)).toBe(
      '- Plain text\n- **Bold text**\n- Mixed *italic* text'
    );
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
    expect(inlinesToMarkdown(inlines)).toBe('> Line 1\n> Line 2');
  });

  test('converts Blockquote with inline formatting', () => {
    const inlines: Inline[] = [
      {
        blockquote: [
          'Quote with ',
          { bold: ['bold'] } as Bold,
          ' text',
        ],
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
      { inline: ['This is an intro with ', { bold: ['emphasis'] } as Bold, '.'] },
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

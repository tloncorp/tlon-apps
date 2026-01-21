import { describe, it, expect } from 'vitest';
import { storyToMarkdown, inlinesToMarkdown } from './storyToMarkdown';
import { markdownToStory } from './markdownToStory';
import { Story, VerseInline, VerseBlock } from '../urbit/channel';
import {
  Bold,
  Italics,
  Strikethrough,
  InlineCode,
  Link,
  Ship,
  Header,
  Code,
  Image,
  Rule,
  ListingBlock,
  Inline,
  Task,
  Blockquote,
} from '../urbit/content';

/**
 * Known Lossy Conversions:
 *
 * 1. Cite blocks - Not supported by Markdown, will be lost in round-trip
 * 2. Link content formatting - Link content in Story is plain string, nested
 *    formatting in link text will be flattened to plain text
 * 3. Image dimensions - Story Image has width/height, Markdown doesn't preserve them
 * 4. BlockReference - Not supported by Markdown
 * 5. BlockCode - Different from Code block, not in standard Markdown
 * 6. Sect/Tag inlines - Not supported by Markdown
 * 7. Whitespace normalization - Some whitespace may be normalized differently
 */

describe('Round-trip conversion: Markdown → Story → Markdown', () => {
  describe('paragraphs', () => {
    it('preserves simple paragraph text', () => {
      const markdown = 'Hello, world!';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves multiple paragraphs', () => {
      const markdown = 'First paragraph.\n\nSecond paragraph.';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('headers', () => {
    it('preserves h1', () => {
      const markdown = '# Heading 1';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves h2', () => {
      const markdown = '## Heading 2';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves h3-h6', () => {
      const levels = ['###', '####', '#####', '######'];
      for (const prefix of levels) {
        const markdown = `${prefix} Heading`;
        const story = markdownToStory(markdown);
        const result = storyToMarkdown(story);
        expect(result).toBe(markdown);
      }
    });

    it('preserves headers with inline formatting', () => {
      const markdown = '## **Bold** and *italic* heading';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('inline formatting', () => {
    it('preserves bold text', () => {
      const markdown = '**bold text**';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves italic text', () => {
      const markdown = '*italic text*';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves strikethrough text', () => {
      const markdown = '~~struck text~~';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves inline code', () => {
      const markdown = '`code here`';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves mixed inline formatting', () => {
      const markdown = 'Text with **bold** and *italic* and `code`';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('links', () => {
    it('preserves basic links', () => {
      const markdown = '[Example](https://example.com)';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves links in paragraph text', () => {
      const markdown = 'Visit [our site](https://example.com) for more info.';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('ship mentions (@mentions)', () => {
    it('preserves galaxy', () => {
      const markdown = '~zod';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves star', () => {
      const markdown = '~marzod';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves planet', () => {
      const markdown = '~sampel-palnet';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves moon', () => {
      const markdown = '~dister-sampel-palnet';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves ship in sentence', () => {
      const markdown = 'Hello ~sampel-palnet how are you?';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves multiple ships', () => {
      const markdown = 'CC ~zod and ~bus';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('lists', () => {
    it('preserves unordered list', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves ordered list', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves nested unordered lists', () => {
      const markdown = '- Parent\n  - Child 1\n  - Child 2';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('task lists', () => {
    it('preserves unchecked task', () => {
      const markdown = '- [ ] Todo item';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves checked task', () => {
      const markdown = '- [x] Done item';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves mixed task list', () => {
      const markdown = '- [x] Done\n- [ ] Todo\n- [x] Also done';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('code blocks', () => {
    it('preserves fenced code block without language', () => {
      const markdown = '```\nconst x = 1;\n```';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves fenced code block with language', () => {
      const markdown = '```typescript\nconst x: number = 1;\n```';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves multi-line code block', () => {
      const markdown = '```javascript\nfunction hello() {\n  console.log("hi");\n}\n```';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('images', () => {
    it('preserves basic image', () => {
      const markdown = '![alt text](https://example.com/image.png)';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });

    it('preserves image with empty alt', () => {
      const markdown = '![](https://example.com/image.png)';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('horizontal rules', () => {
    it('preserves horizontal rule', () => {
      const markdown = '---';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('blockquotes', () => {
    it('preserves simple blockquote', () => {
      const markdown = '> This is a quote';
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });

  describe('complex documents', () => {
    it('preserves document with multiple element types', () => {
      const markdown = `# Document Title

This is a paragraph with **bold** and *italic* text.

## Section 1

- Item 1
- Item 2

\`\`\`typescript
const code = "example";
\`\`\`

---

> A quote to remember

Contact ~sampel-palnet for more info.`;
      const story = markdownToStory(markdown);
      const result = storyToMarkdown(story);
      expect(result).toBe(markdown);
    });
  });
});

describe('Round-trip conversion: Story → Markdown → Story', () => {
  describe('paragraphs', () => {
    it('preserves paragraph with plain text', () => {
      const story: Story = [{ inline: ['Hello, world!'] }];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves multiple paragraphs', () => {
      const story: Story = [
        { inline: ['First paragraph.'] },
        { inline: ['Second paragraph.'] },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('inline formatting', () => {
    it('preserves Bold', () => {
      const story: Story = [
        { inline: [{ bold: ['bold text'] } as Bold] },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves Italics', () => {
      const story: Story = [
        { inline: [{ italics: ['italic text'] } as Italics] },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves Strikethrough', () => {
      const story: Story = [
        { inline: [{ strike: ['struck text'] } as Strikethrough] },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves InlineCode', () => {
      const story: Story = [
        { inline: [{ 'inline-code': 'code here' } as InlineCode] },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves Link', () => {
      const story: Story = [
        {
          inline: [
            { link: { href: 'https://example.com', content: 'Example' } } as Link,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves mixed inline formatting', () => {
      const story: Story = [
        {
          inline: [
            'Hello ',
            { bold: ['world'] } as Bold,
            ' and ',
            { italics: ['friend'] } as Italics,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('ship mentions (@mentions)', () => {
    it('preserves Ship inline', () => {
      const story: Story = [{ inline: [{ ship: 'zod' } as Ship] }];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves Ship in sentence', () => {
      const story: Story = [
        {
          inline: [
            'Hello ',
            { ship: 'sampel-palnet' } as Ship,
            ' how are you?',
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves multiple Ships', () => {
      const story: Story = [
        {
          inline: [
            'CC ',
            { ship: 'zod' } as Ship,
            ' and ',
            { ship: 'bus' } as Ship,
          ],
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('headers', () => {
    it('preserves Header block', () => {
      const story: Story = [
        {
          block: {
            header: { tag: 'h1', content: ['Heading 1'] },
          } as Header,
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves Header with inline formatting', () => {
      const story: Story = [
        {
          block: {
            header: {
              tag: 'h2',
              content: [
                { bold: ['Bold'] } as Bold,
                ' heading',
              ],
            },
          } as Header,
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('code blocks', () => {
    it('preserves Code block', () => {
      const story: Story = [
        {
          block: {
            code: { code: 'const x = 1;', lang: 'typescript' },
          } as Code,
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves Code block without language', () => {
      const story: Story = [
        {
          block: {
            code: { code: 'plain code', lang: '' },
          } as Code,
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('images', () => {
    it('preserves Image block (alt text only, dimensions are lossy)', () => {
      const originalStory: Story = [
        {
          block: {
            image: {
              src: 'https://example.com/image.png',
              alt: 'alt text',
              width: 100,
              height: 200,
            },
          } as Image,
        },
      ];
      const markdown = storyToMarkdown(originalStory);
      const result = markdownToStory(markdown);

      const expectedStory: Story = [
        {
          block: {
            image: {
              src: 'https://example.com/image.png',
              alt: 'alt text',
              width: 0,
              height: 0,
            },
          } as Image,
        },
      ];
      expect(result).toEqual(expectedStory);
    });
  });

  describe('rules', () => {
    it('preserves Rule block', () => {
      const story: Story = [{ block: { rule: null } as Rule }];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('lists', () => {
    it('preserves unordered list', () => {
      const story: Story = [
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [
                  { item: ['Item 1'] },
                  { item: ['Item 2'] },
                ],
              },
            },
          } as ListingBlock,
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });

    it('preserves ordered list', () => {
      const story: Story = [
        {
          block: {
            listing: {
              list: {
                type: 'ordered',
                contents: [],
                items: [
                  { item: ['First'] },
                  { item: ['Second'] },
                ],
              },
            },
          } as ListingBlock,
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('task lists', () => {
    it('preserves task list with checked/unchecked items', () => {
      const story: Story = [
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  {
                    item: [
                      { task: { checked: true, content: ['Done'] } } as Task,
                    ],
                  },
                  {
                    item: [
                      { task: { checked: false, content: ['Todo'] } } as Task,
                    ],
                  },
                ],
              },
            },
          } as ListingBlock,
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('blockquotes', () => {
    it('preserves Blockquote inline', () => {
      const story: Story = [
        {
          inline: [{ blockquote: ['This is a quote'] } as Blockquote],
        },
      ];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual(story);
    });
  });

  describe('empty content', () => {
    it('handles empty story', () => {
      const story: Story = [];
      const markdown = storyToMarkdown(story);
      const result = markdownToStory(markdown);
      expect(result).toEqual([]);
    });
  });
});

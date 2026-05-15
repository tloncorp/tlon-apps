import {
  markdownToStory,
  storyToMarkdown,
} from '@tloncorp/api/client/markdown';
import { JSONContent } from '@tloncorp/api/urbit';
import { Story, constructStory } from '@tloncorp/api/urbit/channel';
import {
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
import { describe, expect, it } from 'vitest';

import { JSONToInlines } from './tiptap';

/**
 * Round-trip conversion tests for Markdown ↔ Story conversion.
 *
 * Known lossy conversions:
 * - Cite blocks: Story Cite type has no Markdown equivalent, lost on conversion
 * - BlockReference: No Markdown equivalent
 * - Link content: Nested formatting in links is flattened to plain text
 * - Image dimensions: width/height are lost when converting to Markdown
 * - BlockCode: Different from fenced code blocks, may not round-trip perfectly
 * - Sect (sections): No direct Markdown equivalent
 * - Tag: No direct Markdown equivalent
 */

describe('Round-trip: Markdown → Story → Markdown', () => {
  describe('paragraphs', () => {
    it('preserves simple paragraph text', () => {
      const md = 'Hello world';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves multiple paragraphs', () => {
      const md = 'First paragraph\n\nSecond paragraph';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('inline formatting', () => {
    it('preserves bold text', () => {
      const md = 'This is **bold** text';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves italic text', () => {
      const md = 'This is *italic* text';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves strikethrough text', () => {
      const md = 'This is ~~struck~~ text';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves inline code', () => {
      const md = 'Use `const x = 1` in code';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves mixed inline formatting', () => {
      const md = 'Text with **bold** and *italic* and `code`';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves nested formatting (bold inside italic)', () => {
      const md = '*italic **bold** text*';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('links', () => {
    it('preserves simple links', () => {
      const md = '[Example](https://example.com)';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves links with surrounding text', () => {
      const md = 'Visit [the site](https://example.com) for more';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('ship mentions (@mentions)', () => {
    it('preserves simple ship mention', () => {
      const md = 'Hello ~zod';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves multiple ship mentions', () => {
      const md = '~zod and ~bus are ships';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves planet name ship mention', () => {
      const md = 'Hello ~sampel-palnet!';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves moon name ship mention', () => {
      const md = 'Message from ~dozzod-dozzod-sampel-palnet';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('headers', () => {
    it('preserves h1 header', () => {
      const md = '# Header One';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves all header levels', () => {
      const md = '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves formatting in headers', () => {
      const md = '# **Bold** Header';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('code blocks', () => {
    it('preserves fenced code block with language', () => {
      const md = '```javascript\nconst x = 1;\n```';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves fenced code block without language (defaults to text)', () => {
      const md = '```\nplain code\n```';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      // No language specified defaults to 'text'
      expect(result).toBe('```text\nplain code\n```');
    });

    it('preserves multiline code block with language', () => {
      const md = '```ts\nfunction hello() {\n  return "world";\n}\n```';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('images', () => {
    it('preserves image with alt text', () => {
      const md = '![alt text](https://example.com/image.png)';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves image without alt text', () => {
      const md = '![](https://example.com/image.png)';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('lists', () => {
    it('preserves unordered list', () => {
      const md = '- item one\n- item two\n- item three';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves ordered list', () => {
      const md = '1. first\n2. second\n3. third';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('task lists', () => {
    it('preserves unchecked task', () => {
      const md = '- [ ] todo item';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves checked task', () => {
      const md = '- [x] done item';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves mixed task list', () => {
      const md = '- [ ] pending\n- [x] completed\n- [ ] another pending';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('horizontal rules', () => {
    it('preserves horizontal rule', () => {
      const md = '---';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('blockquotes', () => {
    it('preserves simple blockquote', () => {
      const md = '> quoted text';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });

    it('preserves blockquote with formatting', () => {
      const md = '> **bold** quote';
      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      expect(result).toBe(md);
    });
  });

  describe('mixed content', () => {
    it('preserves complex document (lang stripped from code blocks)', () => {
      const md = `# Welcome

This is **intro** text with ~zod mention.

## Features

- Feature one
- Feature two

\`\`\`js
const x = 1;
\`\`\`

---

> Important note`;

      const story = markdownToStory(md);
      const result = storyToMarkdown(story);
      // Language is preserved in code blocks
      const expected = `# Welcome

This is **intro** text with ~zod mention.

## Features

- Feature one
- Feature two

\`\`\`js
const x = 1;
\`\`\`

---

> Important note`;
      expect(result).toBe(expected);
    });
  });
});

describe('Round-trip: Story → Markdown → Story', () => {
  describe('paragraphs', () => {
    it('preserves simple paragraph structure', () => {
      const story: Story = [{ inline: ['Hello world'] }];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves multiple paragraphs', () => {
      const story: Story = [
        { inline: ['First paragraph'] },
        { inline: ['Second paragraph'] },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('inline formatting', () => {
    it('preserves Bold structure', () => {
      const story: Story = [{ inline: [{ bold: ['bold text'] } as Bold] }];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves Italics structure', () => {
      const story: Story = [
        { inline: [{ italics: ['italic text'] } as Italics] },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves Strikethrough structure', () => {
      const story: Story = [
        { inline: [{ strike: ['struck text'] } as Strikethrough] },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves InlineCode structure', () => {
      const story: Story = [
        { inline: [{ 'inline-code': 'const x = 1' } as InlineCode] },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves mixed inline formatting', () => {
      const story: Story = [
        {
          inline: [
            'Text with ',
            { bold: ['bold'] } as Bold,
            ' and ',
            { italics: ['italic'] } as Italics,
          ],
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves nested formatting', () => {
      const story: Story = [
        {
          inline: [
            {
              italics: ['italic ', { bold: ['bold'] } as Bold, ' text'],
            } as Italics,
          ],
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('links', () => {
    it('preserves Link structure', () => {
      const story: Story = [
        {
          inline: [
            {
              link: { href: 'https://example.com', content: 'Example' },
            } as Link,
          ],
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('ship mentions (@mentions)', () => {
    it('preserves Ship structure', () => {
      const story: Story = [{ inline: ['Hello ', { ship: 'zod' } as Ship] }];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves multiple Ship structures', () => {
      const story: Story = [
        {
          inline: [
            { ship: 'zod' } as Ship,
            ' and ',
            { ship: 'bus' } as Ship,
            ' are ships',
          ],
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves planet name Ship', () => {
      const story: Story = [
        { inline: ['Hello ', { ship: 'sampel-palnet' } as Ship, '!'] },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('headers', () => {
    it('preserves Header h1 structure', () => {
      const story: Story = [
        { block: { header: { tag: 'h1', content: ['Title'] } } as Header },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves Header with formatting', () => {
      const story: Story = [
        {
          block: {
            header: {
              tag: 'h2',
              content: [{ bold: ['Bold'] } as Bold, ' Title'],
            },
          } as Header,
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('code blocks', () => {
    it('preserves Code block code content and language', () => {
      const story: Story = [
        {
          block: { code: { code: 'const x = 1;', lang: 'javascript' } } as Code,
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual([
        { block: { code: { code: 'const x = 1;', lang: 'javascript' } } },
      ]);
    });

    it('preserves Code block without language (defaults to text)', () => {
      const story: Story = [
        { block: { code: { code: 'plain code', lang: '' } } as Code },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      // Empty lang in input becomes 'text' default on round-trip
      expect(result).toEqual([
        { block: { code: { code: 'plain code', lang: 'text' } } },
      ]);
    });
  });

  describe('images', () => {
    it('preserves Image block structure (alt and src only)', () => {
      const story: Story = [
        {
          block: {
            image: {
              src: 'https://example.com/img.png',
              alt: 'An image',
              width: 0,
              height: 0,
            },
          } as Image,
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      // Note: width/height are lost in Markdown, converted back as 0
      expect(result).toEqual(story);
    });
  });

  describe('lists', () => {
    it('preserves unordered List structure', () => {
      const story: Story = [
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [{ item: ['item one'] }, { item: ['item two'] }],
              },
            },
          } as ListingBlock,
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves ordered List structure', () => {
      const story: Story = [
        {
          block: {
            listing: {
              list: {
                type: 'ordered',
                contents: [],
                items: [{ item: ['first'] }, { item: ['second'] }],
              },
            },
          } as ListingBlock,
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('task lists', () => {
    it('preserves tasklist structure with Task inlines', () => {
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
                      {
                        task: { checked: false, content: ['pending'] },
                      } as Task,
                    ],
                  },
                  {
                    item: [
                      { task: { checked: true, content: ['done'] } } as Task,
                    ],
                  },
                ],
              },
            },
          } as ListingBlock,
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('horizontal rules', () => {
    it('preserves Rule structure', () => {
      const story: Story = [{ block: { rule: null } as Rule }];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('blockquotes', () => {
    it('preserves Blockquote structure', () => {
      const story: Story = [
        { inline: [{ blockquote: ['quoted text'] } as Blockquote] },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });

    it('preserves Blockquote with formatting', () => {
      const story: Story = [
        {
          inline: [
            {
              blockquote: [{ bold: ['bold'] } as Bold, ' quote'],
            } as Blockquote,
          ],
        },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });

  describe('normalizeInline merging', () => {
    it('merges adjacent italics containing links (fixes Tiptap split spans)', () => {
      // This simulates what happens when Tiptap represents "*italic [link](url) text*"
      // as three separate text nodes with different marks
      const story: Story = [
        {
          inline: [
            {
              italics: [
                'italic text ',
                {
                  link: { href: 'http://example.com', content: 'link' },
                } as Link,
                ' more',
              ],
            } as Italics,
          ],
        },
      ];
      const md = storyToMarkdown(story);
      expect(md).toBe('*italic text [link](http://example.com) more*');
    });

    it('merges adjacent bold containing links', () => {
      const story: Story = [
        {
          inline: [
            {
              bold: [
                'bold text ',
                {
                  link: { href: 'http://example.com', content: 'link' },
                } as Link,
                ' more',
              ],
            } as Bold,
          ],
        },
      ];
      const md = storyToMarkdown(story);
      expect(md).toBe('**bold text [link](http://example.com) more**');
    });
  });

  describe('mixed content', () => {
    it('preserves complex Story structure', () => {
      const story: Story = [
        { block: { header: { tag: 'h1', content: ['Welcome'] } } as Header },
        { inline: ['Hello ', { ship: 'zod' } as Ship, '!'] },
        { block: { rule: null } as Rule },
        {
          block: {
            listing: {
              list: {
                type: 'unordered',
                contents: [],
                items: [{ item: ['One'] }, { item: ['Two'] }],
              },
            },
          } as ListingBlock,
        },
        { inline: [{ blockquote: ['Important'] } as Blockquote] },
      ];
      const md = storyToMarkdown(story);
      const result = markdownToStory(md);
      expect(result).toEqual(story);
    });
  });
});

describe('TipTap JSON → Story → Markdown', () => {
  it('preserves italic links without HTML entities', () => {
    // Simulate TipTap JSON with italic text containing a link
    const tiptapJson: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Text before ',
                  marks: [{ type: 'italic' }],
                },
                {
                  type: 'text',
                  text: 'link text',
                  marks: [
                    { type: 'italic' },
                    { type: 'link', attrs: { href: 'https://example.com' } },
                  ],
                },
                {
                  type: 'text',
                  text: ' text after',
                  marks: [{ type: 'italic' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const inlines = JSONToInlines(tiptapJson, false, true);
    const story = constructStory(inlines);
    const markdown = storyToMarkdown(story);

    // Should NOT contain HTML entities like &#x20;
    expect(markdown).not.toContain('&#x20;');
    expect(markdown).not.toContain('&');

    // Should have proper markdown with italics around the whole content
    expect(markdown).toContain('*Text before');
    expect(markdown).toContain('[link text](https://example.com)');
    expect(markdown).toContain('text after*');
  });
});

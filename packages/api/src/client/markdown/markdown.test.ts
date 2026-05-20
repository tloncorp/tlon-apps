import { describe, expect, it } from 'vitest';

import { markdownToStory } from './parse';
import {
  blockToMarkdown,
  inlinesToMarkdown,
  storyToMarkdown,
} from './serialize';
import { parseShipMentions } from './shipMentionPlugin';

describe('parseShipMentions', () => {
  it('parses single ship mention', () => {
    const result = parseShipMentions('Hello ~zod!');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', value: 'Hello ' });
    expect(result[1]).toEqual({ type: 'shipMention', value: 'zod' });
    expect(result[2]).toEqual({ type: 'text', value: '!' });
  });

  it('parses multiple ship mentions', () => {
    const result = parseShipMentions('~zod and ~bus');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'shipMention', value: 'zod' });
    expect(result[1]).toEqual({ type: 'text', value: ' and ' });
    expect(result[2]).toEqual({ type: 'shipMention', value: 'bus' });
  });

  it('parses planet names', () => {
    const result = parseShipMentions('~sampel-palnet');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'shipMention', value: 'sampel-palnet' });
  });

  it('parses moon names', () => {
    const result = parseShipMentions('~dozzod-dozzod-sampel-palnet');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'shipMention',
      value: 'dozzod-dozzod-sampel-palnet',
    });
  });

  it('returns text node for text without ships', () => {
    const result = parseShipMentions('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', value: 'Hello world' });
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
        { inline: ['Hello ', { ship: 'sampel-palnet' }, '!'] },
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
      expect(result).toEqual([{ inline: [{ ship: 'zod' }] }]);
    });

    it('handles star names', () => {
      const result = markdownToStory('~marzod');
      expect(result).toEqual([{ inline: [{ ship: 'marzod' }] }]);
    });

    it('handles planet names', () => {
      const result = markdownToStory('~sampel-palnet');
      expect(result).toEqual([{ inline: [{ ship: 'sampel-palnet' }] }]);
    });

    it('handles moon names', () => {
      const result = markdownToStory('~dozzod-dozzod-sampel-palnet');
      expect(result).toEqual([
        { inline: [{ ship: 'dozzod-dozzod-sampel-palnet' }] },
      ]);
    });

    it('handles multiple ship mentions', () => {
      const result = markdownToStory('~zod and ~bus are ships');
      expect(result).toEqual([
        {
          inline: [{ ship: 'zod' }, ' and ', { ship: 'bus' }, ' are ships'],
        },
      ]);
    });

    it('handles ship mention with formatting', () => {
      const result = markdownToStory('Hello **~sampel-palnet**!');
      expect(result).toEqual([
        {
          inline: ['Hello ', { bold: [{ ship: 'sampel-palnet' }] }, '!'],
        },
      ]);
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
  });

  describe('table conversion', () => {
    it('converts table to VerseInline with text representation', () => {
      const result = markdownToStory('| A | B |\n|---|---|\n| 1 | 2 |');
      expect(result).toEqual([{ inline: ['| A | B |\n| 1 | 2 |'] }]);
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

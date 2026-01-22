import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import { tokensToInlines, tokenToBlock, markdownToStory } from './markdownToStory';

const md = new MarkdownIt();
const mdWithTasks = new MarkdownIt().use(taskLists);

function getInlineTokens(markdown: string) {
  const tokens = md.parse(markdown, {});
  const inlineToken = tokens.find((t) => t.type === 'inline');
  return inlineToken?.children || [];
}

describe('tokensToInlines', () => {
  describe('text tokens', () => {
    it('converts plain text to string', () => {
      const tokens = getInlineTokens('Hello world');
      const result = tokensToInlines(tokens);
      expect(result).toEqual(['Hello world']);
    });

    it('handles empty text', () => {
      const result = tokensToInlines([]);
      expect(result).toEqual([]);
    });
  });

  describe('strong (bold) tokens', () => {
    it('converts **bold** to Bold inline', () => {
      const tokens = getInlineTokens('**bold text**');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ bold: ['bold text'] }]);
    });

    it('handles bold with surrounding text', () => {
      const tokens = getInlineTokens('before **bold** after');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'before ',
        { bold: ['bold'] },
        ' after',
      ]);
    });
  });

  describe('em (italics) tokens', () => {
    it('converts *italic* to Italics inline', () => {
      const tokens = getInlineTokens('*italic text*');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ italics: ['italic text'] }]);
    });

    it('handles italics with surrounding text', () => {
      const tokens = getInlineTokens('before *italic* after');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'before ',
        { italics: ['italic'] },
        ' after',
      ]);
    });
  });

  describe('strikethrough tokens', () => {
    it('converts ~~strike~~ to Strikethrough inline', () => {
      const tokens = getInlineTokens('~~struck text~~');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ strike: ['struck text'] }]);
    });

    it('handles strikethrough with surrounding text', () => {
      const tokens = getInlineTokens('before ~~strike~~ after');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'before ',
        { strike: ['strike'] },
        ' after',
      ]);
    });
  });

  describe('code_inline tokens', () => {
    it('converts `code` to InlineCode', () => {
      const tokens = getInlineTokens('`inline code`');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ 'inline-code': 'inline code' }]);
    });

    it('handles inline code with surrounding text', () => {
      const tokens = getInlineTokens('before `code` after');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'before ',
        { 'inline-code': 'code' },
        ' after',
      ]);
    });
  });

  describe('link tokens', () => {
    it('converts [text](url) to Link inline', () => {
      const tokens = getInlineTokens('[click here](https://example.com)');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        {
          link: {
            href: 'https://example.com',
            content: 'click here',
          },
        },
      ]);
    });

    it('handles links with surrounding text', () => {
      const tokens = getInlineTokens('before [link](https://test.com) after');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'before ',
        { link: { href: 'https://test.com', content: 'link' } },
        ' after',
      ]);
    });
  });

  describe('ship mentions', () => {
    it('detects ~ship-name pattern in text and converts to Ship', () => {
      const tokens = getInlineTokens('Hello ~sampel-palnet!');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'Hello ',
        { ship: 'sampel-palnet' },
        '!',
      ]);
    });

    it('handles multiple ship mentions', () => {
      const tokens = getInlineTokens('~zod and ~bus are ships');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        { ship: 'zod' },
        ' and ',
        { ship: 'bus' },
        ' are ships',
      ]);
    });

    it('handles galaxy names', () => {
      const tokens = getInlineTokens('~zod');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ ship: 'zod' }]);
    });

    it('handles star names', () => {
      const tokens = getInlineTokens('~marzod');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ ship: 'marzod' }]);
    });

    it('handles planet names', () => {
      const tokens = getInlineTokens('~sampel-palnet');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ ship: 'sampel-palnet' }]);
    });

    it('handles moon names', () => {
      const tokens = getInlineTokens('~dozzod-dozzod-sampel-palnet');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([{ ship: 'dozzod-dozzod-sampel-palnet' }]);
    });
  });

  describe('break tokens', () => {
    it('converts softbreak to Break inline', () => {
      const tokens = getInlineTokens('line one\nline two');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'line one',
        { break: null },
        'line two',
      ]);
    });
  });

  describe('nested formatting', () => {
    it('handles bold inside italic', () => {
      const tokens = getInlineTokens('*italic **bold** text*');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        {
          italics: [
            'italic ',
            { bold: ['bold'] },
            ' text',
          ],
        },
      ]);
    });

    it('handles italic inside bold', () => {
      const tokens = getInlineTokens('**bold *italic* text**');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        {
          bold: [
            'bold ',
            { italics: ['italic'] },
            ' text',
          ],
        },
      ]);
    });
  });

  describe('complex combinations', () => {
    it('handles multiple inline types in sequence', () => {
      const tokens = getInlineTokens('**bold** and *italic* and `code`');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        { bold: ['bold'] },
        ' and ',
        { italics: ['italic'] },
        ' and ',
        { 'inline-code': 'code' },
      ]);
    });

    it('handles ship mention with formatting', () => {
      const tokens = getInlineTokens('Hello **~sampel-palnet**!');
      const result = tokensToInlines(tokens);
      expect(result).toEqual([
        'Hello ',
        { bold: [{ ship: 'sampel-palnet' }] },
        '!',
      ]);
    });
  });
});

describe('tokenToBlock', () => {
  describe('heading tokens', () => {
    it('converts # to h1 Header', () => {
      const tokens = md.parse('# Hello World', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        header: { tag: 'h1', content: ['Hello World'] },
      });
    });

    it('converts ## to h2 Header', () => {
      const tokens = md.parse('## Level 2', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        header: { tag: 'h2', content: ['Level 2'] },
      });
    });

    it('converts ### to h6 Headers correctly', () => {
      const tokens = md.parse('###### Level 6', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        header: { tag: 'h6', content: ['Level 6'] },
      });
    });

    it('handles header with inline formatting', () => {
      const tokens = md.parse('# Hello **bold** world', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        header: {
          tag: 'h1',
          content: ['Hello ', { bold: ['bold'] }, ' world'],
        },
      });
    });

    it('returns correct endIndex for headers', () => {
      const tokens = md.parse('# Header\n\nParagraph', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.endIndex).toBe(2); // heading_open, inline, heading_close
    });
  });

  describe('fence (code block) tokens', () => {
    it('converts fenced code block to Code with language', () => {
      const tokens = md.parse('```js\nconst x = 1;\n```', {});
      const fenceIdx = tokens.findIndex((t) => t.type === 'fence');
      const result = tokenToBlock(tokens, fenceIdx);
      expect(result.block).toEqual({
        code: { code: 'const x = 1;', lang: 'js' },
      });
    });

    it('handles code block without language (defaults to text)', () => {
      const tokens = md.parse('```\nplain code\n```', {});
      const fenceIdx = tokens.findIndex((t) => t.type === 'fence');
      const result = tokenToBlock(tokens, fenceIdx);
      expect(result.block).toEqual({
        code: { code: 'plain code', lang: 'text' },
      });
    });

    it('preserves multiline code content with default lang', () => {
      const tokens = md.parse('```\nline1\nline2\nline3\n```', {});
      const fenceIdx = tokens.findIndex((t) => t.type === 'fence');
      const result = tokenToBlock(tokens, fenceIdx);
      expect(result.block).toEqual({
        code: { code: 'line1\nline2\nline3', lang: 'text' },
      });
    });
  });

  describe('hr (horizontal rule) tokens', () => {
    it('converts --- to Rule', () => {
      const tokens = md.parse('---', {});
      const hrIdx = tokens.findIndex((t) => t.type === 'hr');
      const result = tokenToBlock(tokens, hrIdx);
      expect(result.block).toEqual({ rule: null });
    });
  });

  describe('image tokens', () => {
    it('converts ![alt](src) to Image block', () => {
      const tokens = md.parse('![alt text](image.png)', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        image: { src: 'image.png', alt: 'alt text', height: 0, width: 0 },
      });
    });

    it('handles image with empty alt', () => {
      const tokens = md.parse('![](image.png)', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        image: { src: 'image.png', alt: '', height: 0, width: 0 },
      });
    });
  });

  describe('bullet_list tokens', () => {
    it('converts unordered list to ListingBlock', () => {
      const tokens = md.parse('- item1\n- item2', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        listing: {
          list: {
            type: 'unordered',
            contents: [],
            items: [{ item: ['item1'] }, { item: ['item2'] }],
          },
        },
      });
    });

    it('handles list items with formatting', () => {
      const tokens = md.parse('- **bold** item\n- *italic* item', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        listing: {
          list: {
            type: 'unordered',
            contents: [],
            items: [
              { item: [{ bold: ['bold'] }, ' item'] },
              { item: [{ italics: ['italic'] }, ' item'] },
            ],
          },
        },
      });
    });
  });

  describe('ordered_list tokens', () => {
    it('converts ordered list to ListingBlock', () => {
      const tokens = md.parse('1. first\n2. second', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        listing: {
          list: {
            type: 'ordered',
            contents: [],
            items: [{ item: ['first'] }, { item: ['second'] }],
          },
        },
      });
    });
  });

  describe('task list tokens', () => {
    it('converts task list with unchecked item', () => {
      const tokens = mdWithTasks.parse('- [ ] unchecked task', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        listing: {
          list: {
            type: 'tasklist',
            contents: [],
            items: [
              {
                item: [{ task: { checked: false, content: ['unchecked task'] } }],
              },
            ],
          },
        },
      });
    });

    it('converts task list with checked item', () => {
      const tokens = mdWithTasks.parse('- [x] checked task', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        listing: {
          list: {
            type: 'tasklist',
            contents: [],
            items: [
              {
                item: [{ task: { checked: true, content: ['checked task'] } }],
              },
            ],
          },
        },
      });
    });

    it('handles mixed checked and unchecked items', () => {
      const tokens = mdWithTasks.parse('- [ ] todo\n- [x] done', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
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
      });
    });
  });

  describe('nested lists', () => {
    it('handles nested unordered list', () => {
      const tokens = md.parse('- parent\n  - child', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        listing: {
          list: {
            type: 'unordered',
            contents: [],
            items: [
              {
                list: {
                  type: 'unordered',
                  contents: ['parent'],
                  items: [{ item: ['child'] }],
                },
              },
            ],
          },
        },
      });
    });

    it('handles nested ordered list inside unordered', () => {
      const tokens = md.parse('- parent\n  1. numbered child', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toEqual({
        listing: {
          list: {
            type: 'unordered',
            contents: [],
            items: [
              {
                list: {
                  type: 'unordered',
                  contents: ['parent'],
                  items: [{ item: ['numbered child'] }],
                },
              },
            ],
          },
        },
      });
    });
  });

  describe('blockquote tokens', () => {
    it('converts blockquote to VerseInline with Blockquote', () => {
      const tokens = md.parse('> quoted text', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.verse).toEqual({
        inline: [{ blockquote: ['quoted text'] }],
      });
      expect(result.block).toBeNull();
    });

    it('handles blockquote with formatting', () => {
      const tokens = md.parse('> **bold** quote', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.verse).toEqual({
        inline: [{ blockquote: [{ bold: ['bold'] }, ' quote'] }],
      });
    });
  });

  describe('unhandled tokens', () => {
    it('returns null block for paragraph without image', () => {
      const tokens = md.parse('Just text', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toBeNull();
    });

    it('returns null block for unknown token types', () => {
      const tokens = md.parse('<!-- comment -->', {});
      const result = tokenToBlock(tokens, 0);
      expect(result.block).toBeNull();
    });
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
        { block: { header: { tag: 'h1', content: [{ bold: ['Bold'] }, ' Header'] } } },
      ]);
    });
  });

  describe('code block conversion', () => {
    it('converts fenced code block to VerseBlock with language', () => {
      const result = markdownToStory('```js\nconst x = 1;\n```');
      expect(result).toEqual([{ block: { code: { code: 'const x = 1;', lang: 'js' } } }]);
    });

    it('handles code block without language (defaults to text)', () => {
      const result = markdownToStory('```\nplain code\n```');
      expect(result).toEqual([{ block: { code: { code: 'plain code', lang: 'text' } } }]);
    });

    it('converts indented code block to VerseBlock (defaults to text)', () => {
      const result = markdownToStory('    // Some comments\n    line 1 of code');
      expect(result).toEqual([
        { block: { code: { code: '// Some comments\nline 1 of code', lang: 'text' } } },
      ]);
    });
  });

  describe('table conversion', () => {
    it('converts table to VerseInline with text representation', () => {
      const result = markdownToStory('| A | B |\n|---|---|\n| 1 | 2 |');
      expect(result).toEqual([
        { inline: ['| A | B |\n| 1 | 2 |'] },
      ]);
    });

    it('handles tables with multiple rows', () => {
      const result = markdownToStory('| Header1 | Header2 |\n|---------|--------|\n| Cell1   | Cell2   |\n| Cell3   | Cell4   |');
      expect(result).toEqual([
        { inline: ['| Header1 | Header2 |\n| Cell1 | Cell2 |\n| Cell3 | Cell4 |'] },
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
        { block: { image: { src: 'image.png', alt: 'alt text', height: 0, width: 0 } } },
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

    it('handles complex document structure', () => {
      const markdown = `# Welcome

This is **intro** text.

## Features

- Feature one
- Feature two

\`\`\`js
const x = 1;
\`\`\`

---

> Important note`;

      const result = markdownToStory(markdown);
      expect(result.length).toBe(7);
      expect(result[0]).toEqual({ block: { header: { tag: 'h1', content: ['Welcome'] } } });
      expect(result[1]).toEqual({ inline: ['This is ', { bold: ['intro'] }, ' text.'] });
      expect(result[2]).toEqual({ block: { header: { tag: 'h2', content: ['Features'] } } });
      expect(result[3]).toHaveProperty('block.listing');
      expect(result[4]).toEqual({ block: { code: { code: 'const x = 1;', lang: 'js' } } });
      expect(result[5]).toEqual({ block: { rule: null } });
      expect(result[6]).toEqual({ inline: [{ blockquote: ['Important note'] }] });
    });
  });
});

import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import { tokensToInlines, tokenToBlock } from './markdownToStory';

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
    it('converts fenced code block to Code', () => {
      const tokens = md.parse('```js\nconst x = 1;\n```', {});
      const fenceIdx = tokens.findIndex((t) => t.type === 'fence');
      const result = tokenToBlock(tokens, fenceIdx);
      expect(result.block).toEqual({
        code: { code: 'const x = 1;', lang: 'js' },
      });
    });

    it('handles code block without language', () => {
      const tokens = md.parse('```\nplain code\n```', {});
      const fenceIdx = tokens.findIndex((t) => t.type === 'fence');
      const result = tokenToBlock(tokens, fenceIdx);
      expect(result.block).toEqual({
        code: { code: 'plain code', lang: '' },
      });
    });

    it('preserves multiline code content', () => {
      const tokens = md.parse('```\nline1\nline2\nline3\n```', {});
      const fenceIdx = tokens.findIndex((t) => t.type === 'fence');
      const result = tokenToBlock(tokens, fenceIdx);
      expect(result.block).toEqual({
        code: { code: 'line1\nline2\nline3', lang: '' },
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

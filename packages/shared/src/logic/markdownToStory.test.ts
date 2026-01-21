import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import { tokensToInlines } from './markdownToStory';

const md = new MarkdownIt();

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

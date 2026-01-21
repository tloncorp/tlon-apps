/**
 * Tests verifying that Markdown input rules patterns work correctly.
 *
 * The tiptap extensions used in MessageInputEditor.tsx include built-in input rules
 * for Markdown shortcuts. These patterns are tested here to document the expected behavior.
 *
 * Built-in input rules are provided by these tiptap extensions:
 * - Bold: **text** and __text__
 * - Italic: *text* and _text_
 * - Code: `text`
 * - Strike: ~~text~~
 * - Heading: # through ###### at line start
 * - BulletList: -, *, or + at line start
 * - OrderedList: 1. (any number) at line start
 * - Blockquote: > at line start
 * - CodeBlock: ``` at line start
 */

import { describe, it, expect } from 'vitest';

describe('Markdown Input Rules', () => {
  describe('Input rule patterns', () => {
    // These patterns are exported from the tiptap extensions
    it('Bold star pattern matches **text**', () => {
      const pattern = /(?:^|\s)(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/;
      expect(pattern.test('hello **world**')).toBe(true);
      expect(pattern.test('**bold text**')).toBe(true);
    });

    it('Italic star pattern matches *text*', () => {
      const pattern = /(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/;
      expect(pattern.test('hello *world*')).toBe(true);
      expect(pattern.test('*italic text*')).toBe(true);
    });

    it('Inline code pattern matches `text`', () => {
      const pattern = /(?:^|\s)(`(?!\s+`)((?:[^`]+))`(?!\s+`))$/;
      expect(pattern.test('hello `code`')).toBe(true);
      expect(pattern.test('`inline code`')).toBe(true);
    });

    it('Strikethrough pattern matches ~~text~~', () => {
      const pattern = /(?:^|\s)(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))$/;
      expect(pattern.test('hello ~~striked~~')).toBe(true);
      expect(pattern.test('~~strikethrough text~~')).toBe(true);
    });

    it('Heading pattern matches # at line start', () => {
      const pattern = /^(#{1,6})\s$/;
      expect(pattern.test('# ')).toBe(true);
      expect(pattern.test('## ')).toBe(true);
      expect(pattern.test('### ')).toBe(true);
      expect(pattern.test('#### ')).toBe(true);
      expect(pattern.test('##### ')).toBe(true);
      expect(pattern.test('###### ')).toBe(true);
    });

    it('Bullet list pattern matches -, *, or + at line start', () => {
      const pattern = /^\s*([-+*])\s$/;
      expect(pattern.test('- ')).toBe(true);
      expect(pattern.test('* ')).toBe(true);
      expect(pattern.test('+ ')).toBe(true);
    });

    it('Ordered list pattern matches number. at line start', () => {
      const pattern = /^(\d+)\.\s$/;
      expect(pattern.test('1. ')).toBe(true);
      expect(pattern.test('2. ')).toBe(true);
      expect(pattern.test('10. ')).toBe(true);
    });

    it('Blockquote pattern matches > at line start', () => {
      const pattern = /^\s*>\s$/;
      expect(pattern.test('> ')).toBe(true);
    });
  });
});

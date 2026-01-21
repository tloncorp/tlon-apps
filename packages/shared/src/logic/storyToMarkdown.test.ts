import { describe, expect, test } from 'vitest';

import {
  Bold,
  Break,
  Inline,
  InlineCode,
  Italics,
  Link,
  Ship,
  Strikethrough,
} from '../urbit/content';
import { inlinesToMarkdown } from './storyToMarkdown';

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
    expect(inlinesToMarkdown(inlines)).toBe('line 1\nline 2');
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
});

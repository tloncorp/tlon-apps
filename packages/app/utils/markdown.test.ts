import { Verse, VerseBlock, VerseInline } from '@tloncorp/shared/urbit/channel';
import { describe, expect, it } from 'vitest';

import { markdownToStory } from './markdown';

// Type guard functions
function isVerseBlock(verse: Verse): verse is VerseBlock {
  return 'block' in verse;
}

function isVerseInline(verse: Verse): verse is VerseInline {
  return 'inline' in verse;
}

function hasHeader(block: VerseBlock) {
  return 'header' in block.block;
}

function hasCode(block: VerseBlock) {
  return 'code' in block.block;
}

// Test helper assertions
function assertIsHeader(verse: Verse, level: string, content: string) {
  expect(isVerseBlock(verse)).toBe(true);
  if (isVerseBlock(verse)) {
    expect(hasHeader(verse)).toBe(true);
    if ('header' in verse.block) {
      expect(verse.block.header.tag).toBe(level);
      expect(typeof verse.block.header.content[0]).toBe('string');
      expect(verse.block.header.content[0]).toBe(content);
    }
  }
}

function assertIsCodeBlock(verse: Verse, lang: string, code: string) {
  expect(isVerseBlock(verse)).toBe(true);
  if (isVerseBlock(verse)) {
    expect(hasCode(verse)).toBe(true);
    if ('code' in verse.block) {
      expect(verse.block.code.lang).toBe(lang);
      expect(verse.block.code.code).toBe(code);
    }
  }
}

describe('markdownToStory', () => {
  it('converts headings correctly', () => {
    const markdown = '# Heading 1\n\n## Heading 2';
    const story = markdownToStory(markdown);

    expect(story).toHaveLength(2);
    assertIsHeader(story[0], 'h1', 'Heading 1');
    assertIsHeader(story[1], 'h2', 'Heading 2');
  });

  it('converts paragraphs with formatting', () => {
    const markdown = 'This is **bold** and *italic* text';
    const story = markdownToStory(markdown);

    expect(story).toHaveLength(1);
    expect(isVerseInline(story[0])).toBe(true);

    if (isVerseInline(story[0])) {
      const inlines = story[0].inline;
      expect(inlines.length).toBeGreaterThan(0);

      // Check for bold
      const boldItem = inlines.find(
        (item) => typeof item === 'object' && 'bold' in item
      );
      expect(boldItem).toBeDefined();
      if (boldItem && 'bold' in boldItem) {
        expect(boldItem.bold[0]).toBe('bold');
      }

      // Check for italic
      const italicItem = inlines.find(
        (item) => typeof item === 'object' && 'italics' in item
      );
      expect(italicItem).toBeDefined();
      if (italicItem && 'italics' in italicItem) {
        expect(italicItem.italics[0]).toBe('italic');
      }
    }
  });

  it('converts code blocks', () => {
    const markdown = '```javascript\nconst x = 1;\n```';
    const story = markdownToStory(markdown);

    expect(story).toHaveLength(1);
    assertIsCodeBlock(story[0], 'javascript', 'const x = 1;');
  });

  it('converts lists', () => {
    const markdown = '1. First item\n2. Second item\n  - Nested item';
    const story = markdownToStory(markdown);

    expect(story.length).toBeGreaterThan(0);

    // Check first item is inline with list marker
    expect(isVerseInline(story[0])).toBe(true);
    if (isVerseInline(story[0])) {
      const firstItemContent = story[0].inline[0];
      expect(typeof firstItemContent).toBe('string');
      expect(firstItemContent).toContain('1.');
    }

    // Check second item
    if (story.length > 1) {
      expect(isVerseInline(story[1])).toBe(true);
      if (isVerseInline(story[1])) {
        const secondItemContent = story[1].inline[0];
        expect(typeof secondItemContent).toBe('string');
        expect(secondItemContent).toContain('2.');
      }
    }
  });

  it('converts blockquotes', () => {
    const markdown = '> This is a quote';
    const story = markdownToStory(markdown);

    expect(story).toHaveLength(1);
    expect(isVerseInline(story[0])).toBe(true);

    if (isVerseInline(story[0])) {
      const inlines = story[0].inline;
      expect(inlines.length).toBeGreaterThan(0);

      // Check for blockquote
      const blockquoteItem = inlines.find(
        (item) => typeof item === 'object' && 'blockquote' in item
      );
      expect(blockquoteItem).toBeDefined();
      if (blockquoteItem && 'blockquote' in blockquoteItem) {
        expect(blockquoteItem.blockquote[0]).toBe('This is a quote');
      }
    }
  });

  it('converts links', () => {
    const markdown = 'Check [this link](https://example.com)';
    const story = markdownToStory(markdown);

    expect(story).toHaveLength(1);
    expect(isVerseInline(story[0])).toBe(true);

    if (isVerseInline(story[0])) {
      const inlines = story[0].inline;

      // First item should be text "Check "
      const textItem = inlines[0];
      expect(typeof textItem).toBe('string');
      expect(textItem).toBe('Check ');

      // Second item should be link
      const linkItem = inlines.find(
        (item) => typeof item === 'object' && 'link' in item
      );
      expect(linkItem).toBeDefined();
      if (linkItem && 'link' in linkItem) {
        expect(linkItem.link.href).toBe('https://example.com');
        expect(linkItem.link.content).toBe('this link');
      }
    }
  });

  it('handles complex nested formatting', () => {
    const markdown = '**Bold with [a link](https://example.com) inside**';
    const story = markdownToStory(markdown);

    expect(story).toHaveLength(1);
    expect(isVerseInline(story[0])).toBe(true);

    if (isVerseInline(story[0])) {
      const inlines = story[0].inline;

      // Should have a bold item
      const boldItem = inlines.find(
        (item) => typeof item === 'object' && 'bold' in item
      );
      expect(boldItem).toBeDefined();

      // The bold item should contain a link
      if (boldItem && 'bold' in boldItem) {
        const boldContent = boldItem.bold;
        const containsLink = boldContent.some(
          (item) => typeof item === 'object' && 'link' in item
        );
        expect(containsLink).toBe(true);
      }
    }
  });

  it('handles deeply nested lists with safety limits', () => {
    // Create a deeply nested list that exceeds our 5-level limit
    const markdown =
      '- Level 1\n' +
      '  - Level 2\n' +
      '    - Level 3\n' +
      '      - Level 4\n' +
      '        - Level 5\n' +
      '          - Level 6\n' +
      '            - Level 7\n';

    // This should not crash or throw an error
    const story = markdownToStory(markdown);

    // Verify we got some output
    expect(story.length).toBeGreaterThan(0);

    // The implementation might flatten the list or use different approaches
    // to handle excessive nesting, but we just need to ensure it produces
    // valid output without crashing
    for (const verse of story) {
      // Every verse should be a valid structure
      expect(isVerseInline(verse) || isVerseBlock(verse)).toBeTruthy();
    }
  });

  it('handles recursive markdown safely', () => {
    // This attempts to create complex nested structures that could cause stack overflow
    // but our depth limits should prevent issues
    const complexMarkdown =
      '> Blockquote with **bold that has _italic that has `code` and [a link](https://example.com)_ text** and more text\n\n' +
      '- List that has\n' +
      '  - Nested item with **bold**\n' +
      '    - Even more nested with *italic*\n' +
      '      - And another level with `code`\n' +
      '        - Getting deeper with [a link](https://example.com)\n' +
      '          - Too deep now\n' +
      '            - Way too deep\n' +
      '              - This is just excessive';

    // This should complete without errors
    const story = markdownToStory(complexMarkdown);
    expect(story.length).toBeGreaterThan(0);
  });

  it('handles nested lists correctly', () => {
    const markdown = `
- Level 1
  - Level 2
    - Level 3
      - Level 4
  - Another Level 2
    `;
    const story = markdownToStory(markdown);

    expect(story.length).toBeGreaterThan(3);

    // Check for proper nesting
    expect(isVerseInline(story[0])).toBe(true);
    if (isVerseInline(story[0])) {
      expect(typeof story[0].inline[0]).toBe('string');
      expect(story[0].inline[0]).toContain('• '); // Level 1
    }

    expect(isVerseInline(story[1])).toBe(true);
    if (isVerseInline(story[1])) {
      expect(typeof story[1].inline[0]).toBe('string');
      expect(story[1].inline[0]).toContain('  • '); // Level 2 (indented)
    }

    expect(isVerseInline(story[2])).toBe(true);
    if (isVerseInline(story[2])) {
      expect(typeof story[2].inline[0]).toBe('string');
      expect(story[2].inline[0]).toContain('    • '); // Level 3 (more indented)
    }
  });

  it('handles nested blockquotes correctly', () => {
    const markdown = `
> Outer quote
> > Nested quote
> > > Deeply nested quote
    `;
    const story = markdownToStory(markdown);

    expect(story.length).toBeGreaterThan(0);
    expect(isVerseInline(story[0])).toBe(true);

    if (isVerseInline(story[0])) {
      const inlines = story[0].inline;

      // There should be a blockquote
      const blockquoteItem = inlines.find(
        (item) => typeof item === 'object' && 'blockquote' in item
      );
      expect(blockquoteItem).toBeDefined();

      if (blockquoteItem && 'blockquote' in blockquoteItem) {
        const blockquoteContent = blockquoteItem.blockquote;
        expect(blockquoteContent.length).toBeGreaterThan(0);

        // The blockquote should contain the nested content
        const contentAsString = blockquoteContent
          .map((item) =>
            typeof item === 'string' ? item : JSON.stringify(item)
          )
          .join('');

        // It should include the outer quote text
        expect(contentAsString).toContain('Outer quote');

        // It should have some indication of nesting (e.g., > prefix or special formatting)
        // This checks that nested quotes are preserved in some form
        expect(contentAsString).toContain('Nested quote');
      }
    }
  });

  it('handles nested lists with multiple levels correctly', () => {
    const markdown = `
* Item 1
* Item 2
  * Nested item 2.1
  * Nested item 2.2
    * Deeply nested item
    * Another deeply nested item
  * Nested item 2.3
* Item 3
  `;
    const story = markdownToStory(markdown);

    // We should have all items rendered with proper indentation
    // 3 top-level items + 3 second-level + 2 third-level = 8 items total
    expect(story.length).toBe(8);

    // Check some items at each level for proper indentation

    // Top level items
    expect(isVerseInline(story[0])).toBe(true);
    if (isVerseInline(story[0])) {
      expect(typeof story[0].inline[0]).toBe('string');
      expect(story[0].inline[0]).toBe('• '); // Level 1, Item 1
    }

    // Second level items (with 2-space indentation)
    expect(isVerseInline(story[2])).toBe(true);
    if (isVerseInline(story[2])) {
      expect(typeof story[2].inline[0]).toBe('string');
      expect(story[2].inline[0]).toBe('  • '); // Level 2, Nested item 2.1
    }

    // Third level items (with 4-space indentation)
    expect(isVerseInline(story[4])).toBe(true);
    if (isVerseInline(story[4])) {
      expect(typeof story[4].inline[0]).toBe('string');
      expect(story[4].inline[0]).toBe('    • '); // Level 3, Deeply nested item
    }
  });

  it('handles deeply nested list structures with at least 5 levels', () => {
    const markdown = `
* Level 1 item
  * Level 2 item
    * Level 3 item
      * Level 4 item
        * Level 5 item
          * Level 6 item if supported
* Another level 1 item
  * With level 2
    * And mixed content with **bold** and [links](https://example.com)
      * Even deeper with mixed *italic* content
        * And more nesting
* Level 1 with nested ordered list
  1. First ordered
     1. Nested ordered
        1. Deep nested ordered
           1. Very deep ordered
              1. Extremely deep ordered
`;

    const story = markdownToStory(markdown);

    // Verify we got a reasonable output with multiple nesting levels
    expect(story.length).toBeGreaterThan(10);

    // Test level 1
    expect(isVerseInline(story[0])).toBe(true);
    if (isVerseInline(story[0])) {
      expect(typeof story[0].inline[0]).toBe('string');
      expect(story[0].inline[0]).toBe('• '); // Level 1 marker
    }

    // Test level 2
    expect(isVerseInline(story[1])).toBe(true);
    if (isVerseInline(story[1])) {
      expect(typeof story[1].inline[0]).toBe('string');
      expect(story[1].inline[0]).toBe('  • '); // Level 2 (2-space indent)
    }

    // Test level 5 (at least 5 levels should be preserved)
    expect(isVerseInline(story[4])).toBe(true);
    if (isVerseInline(story[4])) {
      expect(typeof story[4].inline[0]).toBe('string');
      expect(story[4].inline[0]).toBe('        • '); // Level 5 (8-space indent)
    }

    // Test ordered list with nesting
    const orderedListIndex = story.findIndex(
      (verse) =>
        isVerseInline(verse) &&
        verse.inline[0] &&
        typeof verse.inline[0] === 'string' &&
        verse.inline[0].includes('1.')
    );
    expect(orderedListIndex).toBeGreaterThan(0);

    // Verify ordered list nesting (next item should be indented ordered list)
    if (orderedListIndex > 0 && orderedListIndex + 1 < story.length) {
      const nextVerse = story[orderedListIndex + 1];
      expect(isVerseInline(nextVerse)).toBe(true);
      if (isVerseInline(nextVerse)) {
        const firstInline = nextVerse.inline[0];
        expect(typeof firstInline).toBe('string');
        if (typeof firstInline === 'string') {
          expect(firstInline).toContain('1.'); // Nested ordered
          expect(firstInline.startsWith('  ')).toBe(true); // Should be indented
        }
      }
    }
  });
});

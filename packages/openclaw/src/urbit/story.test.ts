import { describe, expect, it } from 'vitest';

import { hasMarkdown, markdownToStory } from './story.js';

describe('markdownToStory', () => {
  describe('reference paths', () => {
    it('hoists a group reference to a cite block', () => {
      expect(markdownToStory('/1/group/~ten/workspace')).toEqual([
        { block: { cite: { group: '~ten/workspace' } } },
      ]);
    });

    it('hoists a channel reference to a cite block', () => {
      expect(markdownToStory('/1/chan/chat/~ten/general')).toEqual([
        {
          block: { cite: { chan: { nest: 'chat/~ten/general', where: '/' } } },
        },
      ]);
    });

    it('keeps the surrounding prose as inline text', () => {
      // The reference renders as its own card, so the sentence introducing it
      // has to survive alongside rather than being swallowed.
      expect(markdownToStory('Continue here: /1/group/~ten/workspace')).toEqual(
        [
          { inline: ['Continue here: '] },
          { block: { cite: { group: '~ten/workspace' } } },
        ]
      );
    });

    it('keeps a reference inside bold as text rather than a stray marker', () => {
      // Only a top-level inline can be hoisted to a cite block; a marker left
      // inside bold would go out as an inline Tlon does not have.
      const story = markdownToStory('**/1/group/~ten/workspace**');
      expect(story).toEqual([
        { inline: [{ bold: ['/1/group/~ten/workspace'] }] },
      ]);
      expect(JSON.stringify(story)).not.toContain('__cite');
    });

    it('keeps a reference in a heading or blockquote as text', () => {
      for (const md of [
        '# /1/group/~ten/workspace',
        '> /1/group/~ten/workspace',
      ]) {
        const serialized = JSON.stringify(markdownToStory(md));
        expect(serialized).not.toContain('__cite');
        expect(serialized).not.toContain('"cite"');
        expect(serialized).toContain('/1/group/~ten/workspace');
      }
    });

    it('keeps sentence punctuation out of the reference, as text', () => {
      // The period stays in the paragraph's inline verse; blocks are hoisted
      // after it, as images already are.
      expect(markdownToStory('See /1/group/~ten/workspace.')).toEqual([
        { inline: ['See ', '.'] },
        { block: { cite: { group: '~ten/workspace' } } },
      ]);
    });

    it('keeps a closing quotation mark out of the reference, as text', () => {
      expect(markdownToStory('See "/1/group/~ten/workspace".')).toEqual([
        { inline: ['See "', '".'] },
        { block: { cite: { group: '~ten/workspace' } } },
      ]);
      expect(markdownToStory('See “/1/group/~ten/workspace”.')).toEqual([
        { inline: ['See “', '”.'] },
        { block: { cite: { group: '~ten/workspace' } } },
      ]);
    });

    it('leaves a path that is not a reference as literal text', () => {
      expect(markdownToStory('/1/nonsense/workspace')).toEqual([
        { inline: ['/1/nonsense/workspace'] },
      ]);
    });
  });
  describe('ship mentions', () => {
    it('converts plain ship mention', () => {
      const story = markdownToStory('~zod is cool');
      expect(story).toEqual([
        {
          inline: [{ ship: '~zod' }, ' is cool'],
        },
      ]);
    });

    it('converts a valid planet name', () => {
      expect(markdownToStory('Hello ~sampel-palnet')).toEqual([
        {
          inline: ['Hello ', { ship: '~sampel-palnet' }],
        },
      ]);
    });

    it.each(['~word', '~thanks', '~foo-bar', '~zod2'])(
      'keeps invalid ship candidate %s as plain text',
      (candidate) => {
        expect(markdownToStory(`Say ${candidate} here`)).toEqual([
          {
            inline: [`Say ${candidate} here`],
          },
        ]);
      }
    );

    it('keeps an invalid ship candidate as plain text inside formatting', () => {
      expect(markdownToStory('**~word**')).toEqual([
        {
          inline: [{ bold: ['~word'] }],
        },
      ]);
    });

    it('converts ship name wrapped in bold', () => {
      // **~sidwyn-nimnev-nocsyx-lassul/d4parq4f**
      const story = markdownToStory(
        '**~sidwyn-nimnev-nocsyx-lassul/d4parq4f**'
      );
      expect(story).toHaveLength(1);
      expect(story[0]).toHaveProperty('inline');

      const inlines = (story[0] as { inline: unknown[] }).inline;
      expect(inlines).toHaveLength(1);

      // First element should be bold
      const first = inlines[0] as { bold?: unknown[] };
      expect(first).toHaveProperty('bold');
      expect(first.bold).toBeDefined();

      // Bold content should contain ship and path
      const boldContent = first.bold as unknown[];
      const hasShip = boldContent.some(
        (i) => typeof i === 'object' && i !== null && 'ship' in i
      );
      expect(hasShip).toBe(true);
    });

    it('converts ship name wrapped in italics', () => {
      const story = markdownToStory('*~zod*');
      expect(story).toHaveLength(1);
      expect(story[0]).toHaveProperty('inline');

      const inlines = (story[0] as { inline: unknown[] }).inline;
      expect(inlines).toHaveLength(1);

      const first = inlines[0] as { italics?: unknown[] };
      expect(first).toHaveProperty('italics');
    });

    it('converts ship name in bold with surrounding text', () => {
      const story = markdownToStory(
        'Check out **~sidwyn-nimnev-nocsyx-lassul/d4parq4f** for details.'
      );
      expect(story).toHaveLength(1);
      expect(story[0]).toHaveProperty('inline');

      const inlines = (story[0] as { inline: unknown[] }).inline;
      // Should have: "Check out ", {bold: [ship, /path]}, " for details."
      expect(inlines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('hasMarkdown', () => {
    it('detects bold formatting', () => {
      expect(hasMarkdown('**bold text**')).toBe(true);
    });

    it('detects double underscore bold', () => {
      expect(hasMarkdown('__bold text__')).toBe(true);
    });

    it('detects strikethrough', () => {
      expect(hasMarkdown('~~strikethrough~~')).toBe(true);
    });

    it('detects code blocks', () => {
      expect(hasMarkdown('```js\ncode\n```')).toBe(true);
    });

    it('detects headers', () => {
      expect(hasMarkdown('# H1')).toBe(true);
      expect(hasMarkdown('## H2')).toBe(true);
    });

    it('detects blockquotes', () => {
      expect(hasMarkdown('> quote')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(hasMarkdown('plain text')).toBe(false);
    });
  });

  describe('URL linkification', () => {
    it('linkifies a bare URL in plain text', () => {
      const story = markdownToStory('https://example.com/path');

      expect(story).toEqual([
        {
          inline: [
            {
              link: {
                href: 'https://example.com/path',
                content: 'https://example.com/path',
              },
            },
          ],
        },
      ]);
    });

    it('linkifies a bare URL when preceded by list punctuation', () => {
      const story = markdownToStory('- https://example.com/path');

      expect(story).toEqual([
        {
          inline: [
            '- ',
            {
              link: {
                href: 'https://example.com/path',
                content: 'https://example.com/path',
              },
            },
          ],
        },
      ]);
    });
  });
});

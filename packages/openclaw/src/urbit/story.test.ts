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
      expect(markdownToStory('/1/chan/chat/~ten/general/msg/123')).toEqual([
        {
          block: {
            cite: {
              chan: { nest: 'chat/~ten/general', where: '/msg/123' },
            },
          },
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

    it('keeps an incomplete reference literal, its ship unmentioned', () => {
      const story = markdownToStory('See /1/group/~zod today');
      const serialized = JSON.stringify(story);
      expect(serialized).toContain('/1/group/~zod');
      expect(serialized).not.toContain('"ship"');
      expect(story.some((verse) => 'block' in verse)).toBe(false);
    });

    it('leaves a path that is not a reference as literal text', () => {
      expect(markdownToStory('/1/nonsense/workspace')).toEqual([
        { inline: ['/1/nonsense/workspace'] },
      ]);
    });

    it('hoists a validated group reference', () => {
      expect(markdownToStory('/1/group/~zod/test')).toEqual([
        { block: { cite: { group: '~zod/test' } } },
      ]);
    });

    it('hoists a chat post reference', () => {
      expect(
        markdownToStory(
          '/1/chan/chat/~zod/general/msg/170.141.184.505.979.681.243.072.382.329.337.971.474'
        )
      ).toEqual([
        {
          block: {
            cite: {
              chan: {
                nest: 'chat/~zod/general',
                where:
                  '/msg/170.141.184.505.979.681.243.072.382.329.337.971.474',
              },
            },
          },
        },
      ]);
    });

    it('hoists a chat thread reply reference', () => {
      expect(markdownToStory('/1/chan/chat/~zod/general/msg/123/456')).toEqual([
        {
          block: {
            cite: {
              chan: { nest: 'chat/~zod/general', where: '/msg/123/456' },
            },
          },
        },
      ]);
    });

    it('hoists a legacy authored-post reference', () => {
      expect(
        markdownToStory('/1/chan/chat/~zod/general/msg/~sampel-palnet/123')
      ).toEqual([
        {
          block: {
            cite: {
              chan: {
                nest: 'chat/~zod/general',
                where: '/msg/~sampel-palnet/123',
              },
            },
          },
        },
      ]);
    });

    it('hoists a heap curio reference', () => {
      expect(
        markdownToStory(
          '/1/chan/heap/~zod/gallery/curio/170.141.184.505.979.681.243.072.382.329.337.971.474'
        )
      ).toEqual([
        {
          block: {
            cite: {
              chan: {
                nest: 'heap/~zod/gallery',
                where:
                  '/curio/170.141.184.505.979.681.243.072.382.329.337.971.474',
              },
            },
          },
        },
      ]);
    });

    it('hoists a diary note reference', () => {
      expect(markdownToStory('/1/chan/diary/~zod/journal/note/123')).toEqual([
        {
          block: {
            cite: {
              chan: { nest: 'diary/~zod/journal', where: '/note/123' },
            },
          },
        },
      ]);
    });

    it('hoists a notebook note reference', () => {
      expect(markdownToStory('/1/chan/notes/~zod/nb/note/3')).toEqual([
        {
          block: {
            cite: {
              chan: { nest: 'notes/~zod/nb', where: '/note/3' },
            },
          },
        },
      ]);
    });

    it('hoists a diary note reply reference', () => {
      expect(markdownToStory('/1/chan/diary/~zod/blog/note/123/456')).toEqual([
        {
          block: {
            cite: {
              chan: { nest: 'diary/~zod/blog', where: '/note/123/456' },
            },
          },
        },
      ]);
    });

    it('hoists a heap curio reply reference', () => {
      expect(markdownToStory('/1/chan/heap/~zod/gallery/curio/5/6')).toEqual([
        {
          block: {
            cite: {
              chan: { nest: 'heap/~zod/gallery', where: '/curio/5/6' },
            },
          },
        },
      ]);
    });

    it.each([
      '/1/group/~zod/Bad_Name',
      '/1/group/~zod/x_',
      '/1/group/~foobar/test',
      '/1/desk/~zod/app',
      '/1/chan/chat/~zod/general',
      '/1/chan/chat/~zod/general/note/3',
      '/1/chan/chat/~zod/general/curio/5',
      '/1/chan/notes/~zod/nb/note/1..2',
      '/1/chan/notes/~zod/nb/note/1/2/3',
      '/1/chan/notes/~zod/nb/note/3/4',
      '/1/chan/chat/~zod/general/msg/0.001',
      '/1/chan/chat/~zod/Bad_Name/msg/123',
      '/1/chan/chat/~foobar/general/msg/123',
    ])('keeps wire-invalid path %s literal, its ship unmentioned', (path) => {
      // An invalid cite would fail the whole poke (bad sym), render an error
      // card (desk) or render nothing (bare channel, non-canonical id), so the
      // path stays text — and the ~ship inside it must not become a mention.
      expect(markdownToStory(path)).toEqual([{ inline: [path] }]);
    });
  });

  describe('heading-like lines', () => {
    it('returns a bare # as a paragraph', () => {
      expect(markdownToStory('#')).toEqual([{ inline: ['#'] }]);
    });

    it('terminates on a # line without a space, keeping it literal', () => {
      // Neither the heading branch nor any other branch consumes such a line,
      // so it must fall into the paragraph collector rather than spin.
      expect(markdownToStory('#no-space')).toEqual([{ inline: ['#no-space'] }]);
    });

    it('collects a # line without a space into the paragraph, ending it at a real heading', () => {
      // Regression: the paragraph collector must not treat '#no-space' as a
      // heading terminator (it would spin) nor swallow the real heading that
      // follows; the paragraph ends at '# Heading', which becomes its block.
      expect(markdownToStory('before\n#no-space\n# Heading\nafter')).toEqual([
        { inline: ['before', { break: null }, '#no-space'] },
        { block: { header: { tag: 'h1', content: ['Heading'] } } },
        { inline: ['after'] },
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

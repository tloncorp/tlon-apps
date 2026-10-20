import { describe, expect, it } from 'vitest';

import {
  ALL_ONLY,
  type RoleMentionScope,
  type StoryInline,
  hasMarkdown,
  markdownToStory,
  roleMentionCandidates,
} from './story.js';

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

describe('role mentions', () => {
  const roles = (...ids: string[]): RoleMentionScope => ({
    roleIds: new Set(ids),
  });
  const inline = (
    markdown: string,
    roleMentions?: RoleMentionScope
  ): StoryInline[] => {
    const [verse] = markdownToStory(markdown, { roleMentions });
    return 'inline' in verse ? verse.inline : [];
  };

  describe('without options', () => {
    it('leaves @all and @admin as text', () => {
      expect(markdownToStory('see @all and @admin')).toEqual([
        { inline: ['see @all and @admin'] },
      ]);
      expect(markdownToStory('see @all and **@admin**', {})).toEqual([
        { inline: ['see @all and ', { bold: ['@admin'] }] },
      ]);
    });

    it('is unchanged for links, mixed formatting, quotes and headings', () => {
      expect(
        markdownToStory(
          '# Hi @all\n\n**bold @admin** and [@all](https://x) ~zod\nnext\n\n> quote @all'
        )
      ).toEqual([
        { block: { header: { tag: 'h1', content: ['Hi @all'] } } },
        {
          inline: [
            { bold: ['bold @admin'] },
            ' and ',
            { link: { href: 'https://x', content: '@all' } },
            ' ',
            { ship: '~zod' },
            { break: null },
            'next',
          ],
        },
        { inline: [{ blockquote: ['quote @all'] }] },
      ]);
    });
  });

  it('converts @all with ALL_ONLY', () => {
    expect(inline('see @all', ALL_ONLY)).toEqual(['see ', { sect: null }]);
  });

  it('converts a known role and normalizes case', () => {
    expect(inline('ping @Admin and @ALL', roles('admin'))).toEqual([
      'ping ',
      { sect: 'admin' },
      ' and ',
      { sect: null },
    ]);
  });

  it('passes through an unknown @token as typed', () => {
    expect(inline('ping @Mods', roles('admin'))).toEqual(['ping @Mods']);
    expect(inline('ping @admin', ALL_ONLY)).toEqual(['ping @admin']);
  });

  it('leaves @types/node-style text literal', () => {
    expect(inline('install @types/node', roles('admin'))).toEqual([
      'install @types/node',
    ]);
    expect(inline('install `@types/node`', roles('types'))).toEqual([
      'install ',
      { 'inline-code': '@types/node' },
    ]);
  });

  it('leaves emails, link labels and code blocks alone', () => {
    expect(inline('mail a@admin.io', roles('admin'))).toEqual([
      'mail a@admin.io',
    ]);
    expect(inline('[@ALL](https://x)', roles('admin'))).toEqual([
      { link: { href: 'https://x', content: '@ALL' } },
    ]);
    expect(inline('https://x.io/@admin', roles('admin'))).toEqual([
      { link: { href: 'https://x.io/@admin', content: 'https://x.io/@admin' } },
    ]);
    expect(
      markdownToStory('```\n@all @admin\n```', { roleMentions: roles('admin') })
    ).toEqual([
      { block: { code: { code: '@all @admin', lang: 'plaintext' } } },
    ]);
  });

  it('mixes ship and role mentions', () => {
    expect(
      inline('hey ~sampel-palnet and @Admin, see @all', roles('admin'))
    ).toEqual([
      'hey ',
      { ship: '~sampel-palnet' },
      ' and ',
      { sect: 'admin' },
      ', see ',
      { sect: null },
    ]);
  });

  it('converts inside bold, italics, strike, blockquote and heading', () => {
    expect(
      markdownToStory(
        '# Hey @admin\n\n**see @all** *@admin* ~~@all~~\n\n> ping @admin',
        { roleMentions: roles('admin') }
      )
    ).toEqual([
      {
        block: {
          header: { tag: 'h1', content: ['Hey ', { sect: 'admin' }] },
        },
      },
      {
        inline: [
          { bold: ['see ', { sect: null }] },
          ' ',
          { italics: [{ sect: 'admin' }] },
          ' ',
          { strike: [{ sect: null }] },
        ],
      },
      { inline: [{ blockquote: ['ping ', { sect: 'admin' }] }] },
    ]);
  });

  it('treats a break, inline code and a link as boundaries', () => {
    expect(inline('one\n@all', ALL_ONLY)).toEqual([
      'one',
      { break: null },
      { sect: null },
    ]);
    expect(inline('`x`@all', ALL_ONLY)).toEqual([
      { 'inline-code': 'x' },
      { sect: null },
    ]);
    expect(inline('[@label](https://x)@foo', roles('foo'))).toEqual([
      { link: { href: 'https://x', content: '@label' } },
      { sect: 'foo' },
    ]);
  });

  describe('token boundaries across inlines', () => {
    const scope = roles('admin', 'admin-team');
    // Each case alone, then beside an independent token that would trigger a
    // role lookup on its own: the boundary decision must not change.
    const cases: [string, StoryInline[]][] = [
      ['@all-_team', ['@all-_team']],
      ['@admin-team_more', ['@admin-team_more']],
      ['@admin__team__', ['@admin', { bold: ['team'] }]],
      ['@all__team__', ['@all', { bold: ['team'] }]],
      ['~zod@all', [{ ship: '~zod' }, '@all']],
      ['~zod@admin', [{ ship: '~zod' }, '@admin']],
      ['**~zod**@all', [{ bold: [{ ship: '~zod' }] }, '@all']],
      ['~zod @all', [{ ship: '~zod' }, ' ', { sect: null }]],
      ['**hello!**@all', [{ bold: ['hello!'] }, { sect: null }]],
      ['@admin-team.', [{ sect: 'admin-team' }, '.']],
    ];

    it.each(cases)('%s', (markdown, expected) => {
      expect(inline(markdown, scope)).toEqual(expected);
    });

    it.each(cases)(
      '%s beside a lookup-triggering token',
      (markdown, expected) => {
        const withTrigger = inline(`@admin ${markdown}`, scope);
        expect(withTrigger[0]).toEqual({ sect: 'admin' });
        const rest = withTrigger.slice(1);
        const [first, ...others] = expected;
        expect(rest).toEqual(
          typeof first === 'string'
            ? [` ${first}`, ...others]
            : [' ', first, ...others]
        );
      }
    );
  });

  it('never converts a token the raw-text gate did not see', () => {
    // The scanner splits `@adminhttps://x` before the URL, but the raw text
    // names `@adminhttps`, so the gate would not have looked `admin` up.
    expect(inline('@adminhttps://x', roles('admin'))).toEqual([
      '@admin',
      { link: { href: 'https://x', content: 'https://x' } },
    ]);
  });

  describe('eligibility is per occurrence', () => {
    it('converts an eligible occurrence beside a cut-short one', () => {
      expect(inline('@admin @adminhttps://x', roles('admin'))).toEqual([
        { sect: 'admin' },
        ' @admin',
        { link: { href: 'https://x', content: 'https://x' } },
      ]);
    });

    it.each([
      ['code before', '`@all` @all__!__'],
      ['code after', '@all__!__ `@all`'],
      ['link label before', '[@all](https://x) @all__!__'],
      ['link label after', '@all__!__ [@all](https://x)'],
    ])(
      'does not let an occurrence in %s enable a rejected one',
      (_name, markdown) => {
        expect(
          JSON.stringify(markdownToStory(markdown, { roleMentions: ALL_ONLY }))
        ).not.toContain('sect');
      }
    );

    it('keeps the code and link spellings', () => {
      expect(inline('`@all` @all__!__', ALL_ONLY)).toEqual([
        { 'inline-code': '@all' },
        ' @all',
        { bold: ['!'] },
      ]);
      expect(inline('[@ALL](https://x)@allhttps://y', ALL_ONLY)).toEqual([
        { link: { href: 'https://x', content: '@ALL' } },
        '@all',
        { link: { href: 'https://y', content: 'https://y' } },
      ]);
    });
  });

  it('converts top-level mentions in task and table syntax, but not code cells', () => {
    // This parser has no task or table blocks: both stay paragraph text,
    // so a mention there is top-level and notifies.
    expect(inline('- [ ] ping @all', ALL_ONLY)).toEqual([
      '- [ ] ping ',
      { sect: null },
    ]);
    expect(inline('| @admin | `@admin` |', roles('admin'))).toEqual([
      '| ',
      { sect: 'admin' },
      ' | ',
      { 'inline-code': '@admin' },
      ' |',
    ]);
  });

  it('converts a token beside a formatted link label', () => {
    expect(
      inline('[**@label**](https://x)@foo', roles('foo', 'label'))
    ).toEqual([
      { link: { href: 'https://x', content: '**@label**' } },
      { sect: 'foo' },
    ]);
  });

  describe('roleMentionCandidates', () => {
    it('returns lowercase tokens other than all', () => {
      expect(
        roleMentionCandidates('hi @Admin, @all and @types/node; mail a@b.co')
      ).toEqual(new Set(['admin', 'types']));
    });

    it('is empty for text without a role token', () => {
      expect(roleMentionCandidates('plain text')).toEqual(new Set());
      expect(roleMentionCandidates('see @ALL')).toEqual(new Set());
    });

    it('rejects the same partial words the conversion does', () => {
      for (const text of [
        '@all-_team',
        '@admin-team_more',
        '@admin__team__',
        '~zod@admin',
        '@admin_team',
      ]) {
        expect(roleMentionCandidates(text), text).toEqual(new Set());
      }
    });
  });
});

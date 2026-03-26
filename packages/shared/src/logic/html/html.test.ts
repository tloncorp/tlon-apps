import { describe, expect, it } from 'vitest';
import { storyToHtml } from './storyToHtml';
import { htmlToStory } from './htmlToStory';
import type { Story } from '@tloncorp/api/urbit/channel';

describe('storyToHtml', () => {
  it('converts a simple paragraph', () => {
    const story: Story = [{ inline: ['Hello world'] }];
    expect(storyToHtml(story)).toBe('<p>Hello world</p>');
  });

  it('converts bold, italic, strikethrough', () => {
    const story: Story = [
      {
        inline: [
          { bold: ['bold'] },
          ' ',
          { italics: ['italic'] },
          ' ',
          { strike: ['strike'] },
        ],
      },
    ];
    expect(storyToHtml(story)).toBe(
      '<p><strong>bold</strong> <em>italic</em> <del>strike</del></p>'
    );
  });

  it('converts inline code', () => {
    const story: Story = [{ inline: ['some ', { 'inline-code': 'code' }] }];
    expect(storyToHtml(story)).toBe('<p>some <code>code</code></p>');
  });

  it('converts links', () => {
    const story: Story = [
      { inline: [{ link: { href: 'https://example.com', content: 'click here' } }] },
    ];
    expect(storyToHtml(story)).toBe(
      '<p><a href="https://example.com">click here</a></p>'
    );
  });

  it('converts headers', () => {
    const story: Story = [
      { block: { header: { tag: 'h1', content: ['Title'] } } },
      { block: { header: { tag: 'h2', content: ['Subtitle'] } } },
    ];
    expect(storyToHtml(story)).toBe('<h1>Title</h1><h2>Subtitle</h2>');
  });

  it('converts code blocks', () => {
    const story: Story = [
      { block: { code: { code: 'const x = 1;', lang: 'js' } } },
    ];
    expect(storyToHtml(story)).toBe(
      '<pre><code>const x = 1;</code></pre>'
    );
  });

  it('converts unordered lists', () => {
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              items: [{ item: ['item 1'] }, { item: ['item 2'] }],
              contents: [],
            },
          },
        },
      },
    ];
    expect(storyToHtml(story)).toBe(
      '<ul><li>item 1</li><li>item 2</li></ul>'
    );
  });

  it('converts ordered lists', () => {
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'ordered',
              items: [{ item: ['first'] }, { item: ['second'] }],
              contents: [],
            },
          },
        },
      },
    ];
    expect(storyToHtml(story)).toBe(
      '<ol><li>first</li><li>second</li></ol>'
    );
  });

  it('converts blockquotes', () => {
    const story: Story = [
      { inline: [{ blockquote: ['quoted text'] }] },
    ];
    expect(storyToHtml(story)).toBe(
      '<blockquote><p>quoted text</p></blockquote>'
    );
  });

  it('converts images', () => {
    const story: Story = [
      { block: { image: { src: 'https://example.com/img.png', height: 100, width: 200, alt: 'test' } } },
    ];
    expect(storyToHtml(story)).toBe(
      '<p><img src="https://example.com/img.png" alt="test"></p>'
    );
  });

  it('converts ship mentions as mention tags', () => {
    const story: Story = [
      { inline: ['hello ', { ship: 'zod' }, ' welcome'] },
    ];
    expect(storyToHtml(story)).toBe(
      '<p>hello <mention text="zod" indicator="~" id="~zod">~zod</mention> welcome</p>'
    );
  });

  it('converts horizontal rules', () => {
    const story: Story = [{ block: { rule: null } }];
    expect(storyToHtml(story)).toBe('<hr>');
  });

  it('escapes HTML characters in text', () => {
    const story: Story = [{ inline: ['<script>alert("xss")</script>'] }];
    expect(storyToHtml(story)).toBe(
      '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>'
    );
  });

  it('returns empty string for empty story', () => {
    expect(storyToHtml([])).toBe('');
  });
});

describe('htmlToStory', () => {
  it('converts a simple paragraph', () => {
    const story = htmlToStory('<p>Hello world</p>');
    expect(story).toEqual([{ inline: ['Hello world'] }]);
  });

  it('converts bold, italic, strikethrough', () => {
    const story = htmlToStory(
      '<p><strong>bold</strong> <em>italic</em> <del>strike</del></p>'
    );
    expect(story).toEqual([
      {
        inline: [
          { bold: ['bold'] },
          ' ',
          { italics: ['italic'] },
          ' ',
          { strike: ['strike'] },
        ],
      },
    ]);
  });

  it('converts inline code', () => {
    const story = htmlToStory('<p>some <code>code</code></p>');
    expect(story).toEqual([
      { inline: ['some ', { 'inline-code': 'code' }] },
    ]);
  });

  it('converts links', () => {
    const story = htmlToStory(
      '<p><a href="https://example.com">click here</a></p>'
    );
    expect(story).toEqual([
      { inline: [{ link: { href: 'https://example.com', content: 'click here' } }] },
    ]);
  });

  it('converts headers', () => {
    const story = htmlToStory('<h1>Title</h1><h2>Subtitle</h2>');
    expect(story).toEqual([
      { block: { header: { tag: 'h1', content: ['Title'] } } },
      { block: { header: { tag: 'h2', content: ['Subtitle'] } } },
    ]);
  });

  it('converts code blocks', () => {
    const story = htmlToStory(
      '<pre><code>const x = 1;</code></pre>'
    );
    expect(story).toEqual([
      { block: { code: { code: 'const x = 1;', lang: '' } } },
    ]);
  });

  it('converts unordered lists', () => {
    const story = htmlToStory(
      '<ul><li>item 1</li><li>item 2</li></ul>'
    );
    expect(story).toEqual([
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              items: [{ item: ['item 1'] }, { item: ['item 2'] }],
              contents: [],
            },
          },
        },
      },
    ]);
  });

  it('converts ordered lists', () => {
    const story = htmlToStory(
      '<ol><li>first</li><li>second</li></ol>'
    );
    expect(story).toEqual([
      {
        block: {
          listing: {
            list: {
              type: 'ordered',
              items: [{ item: ['first'] }, { item: ['second'] }],
              contents: [],
            },
          },
        },
      },
    ]);
  });

  it('converts blockquotes', () => {
    const story = htmlToStory(
      '<blockquote><p>quoted text</p></blockquote>'
    );
    expect(story).toEqual([
      { inline: [{ blockquote: ['quoted text'] }] },
    ]);
  });

  it('converts mention tags to ship inlines', () => {
    const story = htmlToStory(
      '<p>hello <mention text="zod" indicator="~" id="~zod">~zod</mention> welcome</p>'
    );
    expect(story).toEqual([
      { inline: ['hello ', { ship: 'zod' }, ' welcome'] },
    ]);
  });

  it('converts horizontal rules', () => {
    const story = htmlToStory('<hr>');
    expect(story).toEqual([{ block: { rule: null } }]);
  });

  it('unescapes HTML entities', () => {
    const story = htmlToStory('<p>&lt;tag&gt; &amp; &quot;quote&quot;</p>');
    expect(story).toEqual([{ inline: ['<tag> & "quote"'] }]);
  });

  it('returns empty array for empty input', () => {
    expect(htmlToStory('')).toEqual([]);
  });
});

describe('round-trip: storyToHtml → htmlToStory', () => {
  const testCases: [string, Story][] = [
    ['paragraph', [{ inline: ['Hello world'] }]],
    ['bold', [{ inline: [{ bold: ['bold text'] }] }]],
    ['italic', [{ inline: [{ italics: ['italic text'] }] }]],
    ['inline code', [{ inline: ['text ', { 'inline-code': 'code' }] }]],
    ['link', [{ inline: [{ link: { href: 'https://example.com', content: 'link' } }] }]],
    ['header', [{ block: { header: { tag: 'h1', content: ['Title'] } } }]],
    ['code block', [{ block: { code: { code: 'x = 1', lang: '' } } }]],
    ['horizontal rule', [{ block: { rule: null } }]],
    ['ship mention', [{ inline: ['hi ', { ship: 'zod' }] }]],
  ];

  for (const [name, story] of testCases) {
    it(`round-trips ${name}`, () => {
      const html = storyToHtml(story);
      const result = htmlToStory(html);
      expect(result).toEqual(story);
    });
  }
});

import type { Story } from '@tloncorp/api/urbit/channel';
import { describe, expect, it } from 'vitest';

import { htmlToStory } from './htmlToStory';
import { storyToHtml } from './storyToHtml';

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
      '<p><b>bold</b> <i>italic</i> <s>strike</s></p>'
    );
  });

  it('converts inline code', () => {
    const story: Story = [{ inline: ['some ', { 'inline-code': 'code' }] }];
    expect(storyToHtml(story)).toBe('<p>some <code>code</code></p>');
  });

  it('converts links', () => {
    const story: Story = [
      {
        inline: [
          { link: { href: 'https://example.com', content: 'click here' } },
        ],
      },
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
      '<codeblock><p>const x = 1;</p></codeblock>'
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
    expect(storyToHtml(story)).toBe('<ul><li>item 1</li><li>item 2</li></ul>');
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
    expect(storyToHtml(story)).toBe('<ol><li>first</li><li>second</li></ol>');
  });

  it('converts blockquotes', () => {
    const story: Story = [{ inline: [{ blockquote: ['quoted text'] }] }];
    expect(storyToHtml(story)).toBe(
      '<blockquote><p>quoted text</p></blockquote>'
    );
  });

  it('converts images', () => {
    const story: Story = [
      {
        block: {
          image: {
            src: 'https://example.com/img.png',
            height: 100,
            width: 200,
            alt: 'test',
          },
        },
      },
    ];
    expect(storyToHtml(story)).toBe(
      '<p><img src="https://example.com/img.png" alt="test"></p>'
    );
  });

  it('converts ship mentions as mention tags', () => {
    const story: Story = [{ inline: ['hello ', { ship: 'zod' }, ' welcome'] }];
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
    const story = htmlToStory('<p><b>bold</b> <i>italic</i> <s>strike</s></p>');
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
    expect(story).toEqual([{ inline: ['some ', { 'inline-code': 'code' }] }]);
  });

  it('converts links', () => {
    const story = htmlToStory(
      '<p><a href="https://example.com">click here</a></p>'
    );
    expect(story).toEqual([
      {
        inline: [
          { link: { href: 'https://example.com', content: 'click here' } },
        ],
      },
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
    const story = htmlToStory('<codeblock><p>const x = 1;</p></codeblock>');
    expect(story).toEqual([{ inline: [{ code: 'const x = 1;' }] }]);
  });

  it('converts unordered lists', () => {
    const story = htmlToStory('<ul><li>item 1</li><li>item 2</li></ul>');
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
    const story = htmlToStory('<ol><li>first</li><li>second</li></ol>');
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
    const story = htmlToStory('<blockquote><p>quoted text</p></blockquote>');
    expect(story).toEqual([{ inline: [{ blockquote: ['quoted text'] }] }]);
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
    [
      'link',
      [
        {
          inline: [{ link: { href: 'https://example.com', content: 'link' } }],
        },
      ],
    ],
    ['header', [{ block: { header: { tag: 'h1', content: ['Title'] } } }]],
    ['code block', [{ inline: [{ code: 'x = 1' }] }]],
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

// Helpers for building list stories concisely.
const ul = (...items: string[]): Story[number] => ({
  block: {
    listing: {
      list: {
        type: 'unordered',
        items: items.map((i) => ({ item: [i] })),
        contents: [],
      },
    },
  },
});
const ol = (...items: string[]): Story[number] => ({
  block: {
    listing: {
      list: {
        type: 'ordered',
        items: items.map((i) => ({ item: [i] })),
        contents: [],
      },
    },
  },
});
const para = (...inline: any[]): Story[number] => ({ inline });
const breakVerse: Story[number] = { inline: [{ break: null }] };

describe('round-trip story→html→story (structure)', () => {
  const cases: [string, Story][] = [
    ['unordered list', [ul('Aaa', 'Bbb', 'Ccc')]],
    ['ordered list', [ol('one', 'two')]],
    [
      'two lists with a blank line between',
      [ul('Aaa', 'Bbb', 'Ccc'), breakVerse, ul('Lala', 'Lala', 'Lala')],
    ],
    ['two lists back to back', [ul('Aaa'), ul('Bbb')]],
    ['paragraph then list', [para('intro'), ul('a', 'b')]],
    ['list then paragraph', [ul('a', 'b'), para('outro')]],
    [
      'blank line between paragraphs',
      [para('first'), breakVerse, para('second')],
    ],
    [
      'header then paragraph then list',
      [
        { block: { header: { tag: 'h2', content: ['Title'] } } },
        para('body'),
        ul('x', 'y'),
      ],
    ],
    ['ordered then unordered', [ol('1', '2'), breakVerse, ul('a', 'b')]],
    [
      'list, blank, paragraph, blank, list',
      [ul('a'), breakVerse, para('mid'), breakVerse, ul('b')],
    ],
  ];

  for (const [name, story] of cases) {
    it(`preserves: ${name}`, () => {
      const html = storyToHtml(story);
      const result = htmlToStory(html);
      expect(result).toEqual(story);
    });
  }
});

describe('round-trip html→story→html (real editor output shapes)', () => {
  // These are shapes react-native-enriched actually emits via getHTML().
  const cases: [string, string][] = [
    ['simple unordered list', '<ul>\n<li>Aaa</li>\n<li>Bbb</li>\n</ul>'],
    [
      'list items wrapped in <p>',
      '<ul>\n<li><p>Aaa</p></li>\n<li><p>Bbb</p></li>\n</ul>',
    ],
    [
      'empty <li> between items (the bug)',
      '<ul>\n<li>Ccc</li>\n<li></li>\n<li>Lala</li>\n</ul>',
    ],
    [
      'two lists separated by <br>',
      '<ul>\n<li>Aaa</li>\n</ul>\n<br>\n<ul>\n<li>Lala</li>\n</ul>',
    ],
    [
      'two lists separated by empty <p>',
      '<ul>\n<li>Aaa</li>\n</ul>\n<p></p>\n<ul>\n<li>Lala</li>\n</ul>',
    ],
    ['paragraph, empty p, paragraph', '<p>first</p>\n<p></p>\n<p>second</p>'],
    ['paragraph, br, paragraph', '<p>first</p>\n<br>\n<p>second</p>'],
  ];

  for (const [name, html] of cases) {
    it(`stable round-trip: ${name}`, () => {
      const story = htmlToStory(html);
      const html2 = storyToHtml(story);
      const story2 = htmlToStory(html2);
      // Converting again should be a fixed point (no further drift).
      expect(story2).toEqual(story);
    });
  }
});

describe('blank line preservation (the reported bug)', () => {
  it('empty line between two bullet lists is NOT turned into an empty bullet', () => {
    // Editor output when the user puts a real blank line between two lists.
    const html = '<ul>\n<li>Ccc</li>\n</ul>\n<br>\n<ul>\n<li>Lala</li>\n</ul>';
    const story = htmlToStory(html);
    // Should be: list, blank-line, list — NOT one list with an empty item.
    expect(story).toEqual([ul('Ccc'), breakVerse, ul('Lala')]);
  });

  it('an empty <li> in the middle of a list splits it with a blank line', () => {
    const html = '<ul>\n<li>Ccc</li>\n<li></li>\n<li>Lala</li>\n</ul>';
    const story = htmlToStory(html);
    expect(story).toEqual([ul('Ccc'), breakVerse, ul('Lala')]);
    // And no empty bullet survives on the way back out.
    expect(storyToHtml(story)).not.toContain('<li></li>');
  });

  it('multi-item lists split at an empty <li> (the exact reported note)', () => {
    const html =
      '<ul>\n<li>Aaa</li>\n<li>Bbb</li>\n<li>Ccc</li>\n<li></li>\n<li>Lala</li>\n<li>Lala</li>\n<li>Lala</li>\n</ul>';
    const story = htmlToStory(html);
    expect(story).toEqual([
      ul('Aaa', 'Bbb', 'Ccc'),
      breakVerse,
      ul('Lala', 'Lala', 'Lala'),
    ]);
  });

  it('drops a trailing empty <li> (no dangling blank line)', () => {
    const html = '<ul>\n<li>Aaa</li>\n<li>Bbb</li>\n<li></li>\n</ul>';
    const story = htmlToStory(html);
    expect(story).toEqual([ul('Aaa', 'Bbb')]);
  });

  it('drops a leading empty <li>', () => {
    const html = '<ul>\n<li></li>\n<li>Aaa</li>\n</ul>';
    const story = htmlToStory(html);
    expect(story).toEqual([ul('Aaa')]);
  });

  it('checkbox list with an empty item stays a single list (not split)', () => {
    const html =
      '<ul data-type="checkbox">\n<li checked>done</li>\n<li></li>\n<li>todo</li>\n</ul>';
    const story = htmlToStory(html);
    expect(story.length).toBe(1);
    const block = (story[0] as any).block.listing.list;
    expect(block.type).toBe('tasklist');
    expect(block.items.length).toBe(3);
  });
});

describe('round-trip fixed point over realistic editor HTML', () => {
  // For each editor HTML shape, htmlToStory then storyToHtml then htmlToStory
  // again must reach a fixed point — nothing lost or added on subsequent saves.
  const shapes: [string, string][] = [
    ['plain paragraph', '<p>Hello world</p>'],
    ['bold + italic + strike', '<p><b>b</b> <i>i</i> <s>s</s></p>'],
    ['nested bold/italic', '<p><b><i>bi</i></b></p>'],
    ['inline code', '<p>text <code>code</code> more</p>'],
    ['link', '<p>see <a href="https://x.com">here</a></p>'],
    [
      'ship mention',
      '<p>hi <mention text="zod" indicator="~" id="~zod">~zod</mention></p>',
    ],
    ['heading with bold', '<h1><b>Title</b></h1>'],
    [
      'all headings',
      '<h1>a</h1><h2>b</h2><h3>c</h3><h4>d</h4><h5>e</h5><h6>f</h6>',
    ],
    ['image', '<p><img src="https://x.com/i.png" alt="alt"></p>'],
    ['horizontal rule', '<p>a</p><hr><p>b</p>'],
    ['unordered list', '<ul><li>a</li><li>b</li></ul>'],
    ['ordered list', '<ol><li>1</li><li>2</li></ol>'],
    [
      'list items with formatting',
      '<ul><li><b>bold</b> item</li><li>plain</li></ul>',
    ],
    [
      'list item with link',
      '<ul><li><a href="https://x.com">link</a></li></ul>',
    ],
    [
      'nested list',
      '<ul><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul>',
    ],
    [
      'checkbox list',
      '<ul data-type="checkbox"><li checked>done</li><li>todo</li></ul>',
    ],
    [
      'multi-line blockquote',
      '<blockquote><p>line one</p><p>line two</p></blockquote>',
    ],
    [
      'blockquote with formatting',
      '<blockquote><p>quoted <b>bold</b></p></blockquote>',
    ],
    ['multi-line codeblock', '<codeblock><p>line1</p><p>line2</p></codeblock>'],
    [
      'two lists back to back (different types)',
      '<ul><li>a</li></ul><ol><li>1</li></ol>',
    ],
    ['blank line via br between paragraphs', '<p>a</p><br><p>b</p>'],
    ['list, blank line, list', '<ul><li>a</li></ul><br><ul><li>b</li></ul>'],
    ['empty li splits list', '<ul><li>a</li><li></li><li>b</li></ul>'],
    [
      'large mixed document',
      '<h1>Title</h1><p>intro <b>bold</b></p><ul><li>one</li><li>two</li></ul>' +
        '<p>middle</p><ol><li>first</li><li>second</li></ol>' +
        '<blockquote><p>a quote</p></blockquote><codeblock><p>code()</p></codeblock><hr><p>end</p>',
    ],
  ];

  for (const [name, html] of shapes) {
    it(`fixed point: ${name}`, () => {
      const story1 = htmlToStory(html);
      const html2 = storyToHtml(story1);
      const story2 = htmlToStory(html2);
      const html3 = storyToHtml(story2);
      // Once normalized, the story and html must stop changing.
      expect(story2).toEqual(story1);
      expect(html3).toBe(html2);
    });
  }
});

describe('round-trip stability over many saves (no slow drift/accumulation)', () => {
  const complexShapes: [string, string][] = [
    [
      'deeply nested list (3 levels)',
      '<ul><li>a<ul><li>a1<ul><li>a1a</li></ul></li></ul></li></ul>',
    ],
    ['multi-paragraph list item', '<ul><li><p>p1</p><p>p2</p></li></ul>'],
    ['double blank line', '<p>a</p><br><br><p>b</p>'],
    [
      'checkbox after content (the <br> case)',
      '<p>intro</p><ul data-type="checkbox"><li checked>x</li><li>y</li></ul>',
    ],
    [
      'kitchen sink',
      '<h1>Title</h1><p>intro <b>bold</b></p><ul><li>a</li><li></li><li>b</li></ul>' +
        '<ul data-type="checkbox"><li checked>x</li><li>y</li></ul>' +
        '<blockquote><p>q</p></blockquote><codeblock><p>c1</p><p>c2</p></codeblock><hr><p>end</p>',
    ],
  ];

  for (const [name, html] of complexShapes) {
    it(`stabilizes over 6 saves: ${name}`, () => {
      // Normalize once, then every subsequent save must be a no-op.
      let cur = storyToHtml(htmlToStory(html));
      for (let i = 0; i < 6; i++) {
        const next = storyToHtml(htmlToStory(cur));
        expect(next).toBe(cur);
        cur = next;
      }
    });
  }
});

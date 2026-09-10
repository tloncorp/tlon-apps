import { expect, test } from 'vitest';

import {
  PlaintextPreviewConfig,
  convertContent,
  plaintextPreviewOf,
} from '../client/postContent';

test('convertContent renders a nested blockquote as a blockquote inline', () => {
  const content = convertContent(
    [
      {
        inline: [
          { blockquote: ['outer quote', { blockquote: ['inner quote'] }] },
        ],
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'blockquote',
      content: [
        { type: 'text', text: 'outer quote' },
        {
          type: 'blockquote',
          children: [{ type: 'text', text: 'inner quote' }],
        },
      ],
    },
  ]);
  expect(JSON.stringify(content)).not.toContain('Unknown content type');
});

test('convertContent recurses through depth-3 nested blockquotes', () => {
  const content = convertContent(
    [
      {
        inline: [
          {
            blockquote: [
              'one',
              { blockquote: ['two', { blockquote: ['three'] }] },
            ],
          },
        ],
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'blockquote',
      content: [
        { type: 'text', text: 'one' },
        {
          type: 'blockquote',
          children: [
            { type: 'text', text: 'two' },
            {
              type: 'blockquote',
              children: [{ type: 'text', text: 'three' }],
            },
          ],
        },
      ],
    },
  ]);
});

test('convertContent renders a blockquote nested inside bold', () => {
  const content = convertContent(
    [
      {
        inline: [{ bold: ['before quote', { blockquote: ['quoted'] }] }],
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'paragraph',
      content: [
        {
          type: 'style',
          style: 'bold',
          children: [
            { type: 'text', text: 'before quote' },
            {
              type: 'blockquote',
              children: [{ type: 'text', text: 'quoted' }],
            },
          ],
        },
      ],
    },
  ]);
});

test('convertContent renders a nested blockquote after a break (PR #6216 shape)', () => {
  const content = convertContent(
    [
      {
        inline: [
          {
            blockquote: ['outer', { break: null }, { blockquote: ['inner'] }],
          },
        ],
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'blockquote',
      content: [
        { type: 'text', text: 'outer' },
        { type: 'lineBreak' },
        {
          type: 'blockquote',
          children: [{ type: 'text', text: 'inner' }],
        },
      ],
    },
  ]);
});

test('convertContent renders nested block code as a code-styled inline (PR #6216 shape)', () => {
  const content = convertContent(
    [
      {
        inline: [
          {
            blockquote: [
              'before quoted code',
              { break: null },
              { code: 'quoted_code()' },
            ],
          },
        ],
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'blockquote',
      content: [
        { type: 'text', text: 'before quoted code' },
        { type: 'lineBreak' },
        {
          type: 'style',
          style: 'code',
          children: [{ type: 'text', text: 'quoted_code()' }],
        },
      ],
    },
  ]);
});

test('convertContent renders a blockquote nested in a list item (PR #6216 shape)', () => {
  const content = convertContent(
    [
      {
        block: {
          listing: {
            item: ['item ', { break: null }, { blockquote: ['quoted'] }],
          },
        },
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'list',
      list: {
        content: [
          { type: 'text', text: 'item ' },
          { type: 'lineBreak' },
          {
            type: 'blockquote',
            children: [{ type: 'text', text: 'quoted' }],
          },
        ],
      },
    },
  ]);
});

test('plaintext preview separates a nested quote from preceding text', () => {
  const story = [
    {
      inline: [
        { blockquote: ['outer quote', { blockquote: ['inner quote'] }] },
      ],
    },
  ];
  const content = convertContent(story, null);

  expect(plaintextPreviewOf(content)).toBe('> outer quote\n> inner quote');
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    '> outer quote > inner quote'
  );
});

test('plaintext preview does not stack a separator on an adjacent break', () => {
  const story = [
    {
      inline: [
        {
          blockquote: ['outer', { break: null }, { blockquote: ['inner'] }],
        },
      ],
    },
  ];
  const content = convertContent(story, null);

  expect(plaintextPreviewOf(content)).toBe('> outer\n> inner');
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    '> outer\n> inner'
  );
});

test('plaintext preview keeps text after a nested quote separated', () => {
  const story = [
    {
      inline: [
        {
          blockquote: [
            'before',
            { break: null },
            { blockquote: ['inner'] },
            { break: null },
            'after',
          ],
        },
      ],
    },
  ];
  const content = convertContent(story, null);

  expect(plaintextPreviewOf(content)).toBe('> before\n> inner\nafter');
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    '> before\n> inner\nafter'
  );
});

test('plaintext preview separates text on both sides of a break-free nested quote', () => {
  const story = [
    {
      inline: [
        {
          blockquote: ['before', { blockquote: ['inner'] }, 'after'],
        },
      ],
    },
  ];
  const content = convertContent(story, null);

  expect(plaintextPreviewOf(content)).toBe('> before\n> inner\nafter');
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    '> before > inner after'
  );
});

test('plaintext preview of content without blockquotes is unchanged', () => {
  const story = [
    {
      inline: [
        'Hello ',
        { bold: ['bold'] },
        ' & ',
        { italics: ['italic'] },
        { break: null },
        'See ',
        { link: { href: 'https://example.com', content: 'example' } },
        ' ',
        { ship: '~zod' },
      ],
    },
    {
      inline: [{ task: { checked: true, content: ['done'] } }],
    },
  ];
  const content = convertContent(story, null);

  expect(plaintextPreviewOf(content)).toBe(
    'Hello bold & italic\nSee example ~zod\n[x] done'
  );
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    'Hello bold & italic\nSee example ~zod [x] done'
  );
});

// `style` and `task` flatten their children into the surrounding string, so a
// quote sitting at a wrapper's edge is adjacent in the *output* even though it
// is not an adjacent sibling in the tree. Boundary detection has to see
// through the wrapper, or the quote runs into its neighbours.

test('plaintext preview separates a quote at the leading edge of a style wrapper', () => {
  const content = convertContent(
    [{ inline: ['before', { bold: [{ blockquote: ['q'] }] }, 'after'] }],
    null
  );

  expect(plaintextPreviewOf(content)).toBe('before\n> q\nafter');
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    'before > q after'
  );
});

test('plaintext preview separates a quote at the trailing edge of a style wrapper', () => {
  const content = convertContent(
    [{ inline: [{ bold: ['b', { blockquote: ['q'] }] }, 'after'] }],
    null
  );

  expect(plaintextPreviewOf(content)).toBe('b\n> q\nafter');
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    'b > q after'
  );
});

test('plaintext preview lets a wrapped leading break own the boundary', () => {
  const content = convertContent(
    [
      {
        inline: [
          {
            blockquote: [
              'a',
              { blockquote: ['q'] },
              { bold: [{ break: null }, 'x'] },
            ],
          },
        ],
      },
    ],
    null
  );

  // The bold opens with a break, which already delimits: no stacked separator.
  expect(plaintextPreviewOf(content)).toBe('> a\n> q\nx');
  expect(plaintextPreviewOf(content, PlaintextPreviewConfig.inlineConfig)).toBe(
    '> a > q\nx'
  );
});

import { expect, test, describe } from 'vitest';

import { Block, Inline, JSONContent } from '@tloncorp/api/urbit';
import { JSONToInlines } from './tiptap';

test('tiptap: test mixed text, inline code and code block with langs', () => {
  const json: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Hello, world!',
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: {
          language: 'plaintext',
        },
        content: [{ type: 'text', text: 'const x = 42;' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: "here's more to the message. ",
          },
          {
            type: 'text',
            text: 'this is inline code',
            marks: [
              {
                type: 'code',
              },
            ],
          },
          {
            type: 'text',
            text: 'with some text after it.',
          },
        ],
      },
    ],
  };

  const verses = JSONToInlines(json, true, true);
  const exampleVerses: (Inline | Block)[] = [
    'Hello, world!',
    { break: null },
    {
      code: {
        lang: 'plaintext',
        code: 'const x = 42;',
      },
    },
    "here's more to the message. ",
    { 'inline-code': 'this is inline code' },
    'with some text after it.',
    { break: null },
  ];
  expect(verses).toEqual(exampleVerses);
});

test('tiptap: test mixed text, inline code and code block without langs', () => {
  const json: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Hello, world!',
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: {
          language: 'plaintext',
        },
        content: [{ type: 'text', text: 'const x = 42;' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: "here's more to the message. ",
          },
          {
            type: 'text',
            text: 'this is inline code',
            marks: [
              {
                type: 'code',
              },
            ],
          },
          {
            type: 'text',
            text: 'with some text after it.',
          },
        ],
      },
    ],
  };

  const verses = JSONToInlines(json);
  const exampleVerses: (Inline | Block)[] = [
    'Hello, world!',
    { break: null },
    {
      code: 'const x = 42;',
    },
    "here's more to the message. ",
    { 'inline-code': 'this is inline code' },
    'with some text after it.',
    { break: null },
  ];
  expect(verses).toEqual(exampleVerses);
});

describe('JSONToInlines - links with marks', () => {
  test('preserves italic mark on links', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'link text',
              marks: [
                { type: 'italic' },
                { type: 'link', attrs: { href: 'https://example.com' } },
              ],
            },
          ],
        },
      ],
    };

    const result = JSONToInlines(json);
    expect(result).toEqual([
      {
        italics: [
          { link: { href: 'https://example.com', content: 'link text' } },
        ],
      },
      { break: null },
    ]);
  });

  test('preserves bold mark on links', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold link',
              marks: [
                { type: 'bold' },
                { type: 'link', attrs: { href: 'https://example.com' } },
              ],
            },
          ],
        },
      ],
    };

    const result = JSONToInlines(json);
    expect(result).toEqual([
      {
        bold: [
          { link: { href: 'https://example.com', content: 'bold link' } },
        ],
      },
      { break: null },
    ]);
  });

  test('preserves multiple marks on links', () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'styled link',
              marks: [
                { type: 'bold' },
                { type: 'italic' },
                { type: 'link', attrs: { href: 'https://example.com' } },
              ],
            },
          ],
        },
      ],
    };

    const result = JSONToInlines(json);
    // Should be wrapped in both bold and italic
    expect(result).toEqual([
      {
        italics: [
          {
            bold: [
              { link: { href: 'https://example.com', content: 'styled link' } },
            ],
          },
        ],
      },
      { break: null },
    ]);
  });
});

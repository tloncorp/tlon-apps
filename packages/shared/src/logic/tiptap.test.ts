import { expect, test } from 'vitest';

import { Block, Inline, JSONContent } from '../urbit';
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

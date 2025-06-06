import { expect, test } from 'vitest';

import { Mention, textAndMentionsToContent } from './content-helpers';

test('textAndMentionsToContent: multiline mentions', () => {
  const text = "User One Hello, world! here's more to the message.\nUser Two";
  const mentions: Mention[] = [
    { id: 'user1', display: 'User One', start: 0, end: 7 },
    { id: 'user2', display: 'User Two', start: 51, end: 59 },
  ];

  const result = textAndMentionsToContent(text, mentions);

  expect(result).toEqual({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: 'user1',
            },
          },
          {
            type: 'text',
            text: "  Hello, world! here's more to the message. ",
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: 'user2',
            },
          },
          {
            type: 'text',
            text: ' ',
          },
        ],
      },
    ],
  });
});

test('textAndMentionsToContent: code blocks without mentions', () => {
  const text = 'This is a code block:\n```\nconst x = 42;\n```';
  const mentions: Mention[] = [];

  const result = textAndMentionsToContent(text, mentions);

  expect(result).toEqual({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is a code block: ',
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: {
          language: 'plaintext',
        },
        content: [
          {
            type: 'text',
            text: 'const x = 42;',
          },
        ],
      },
    ],
  });
});

test('textAndMentionsToContent: mixed text mentions with code blocks in between', () => {
  const text =
    'This is a code block:\n```\nconst x = 42;\n```\nUser One Hello, world!';
  const mentions: Mention[] = [
    { id: 'user1', display: 'User One', start: 45, end: 52 },
  ];

  const result = textAndMentionsToContent(text, mentions);

  expect(result).toEqual({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is a code block: ',
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: {
          language: 'plaintext',
        },
        content: [
          {
            type: 'text',
            text: 'const x = 42;',
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: 'user1',
            },
          },
          {
            type: 'text',
            text: ' Hello, world! ',
          },
        ],
      },
    ],
  });
});

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
  const text = 'This is a code block:\n```\n  const x = 42;\n```';
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
            text: '  const x = 42;',
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

test('textAndMentionsToContent: inline code with punctuation after closing backtick', () => {
  const text = '`some text that should be in an inline code block`, more text';
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
            text: 'some text that should be in an inline code block',
            marks: [{ type: 'code' }],
          },
          {
            type: 'text',
            text: ', more text ',
          },
        ],
      },
    ],
  });
});

test('textAndMentionsToContent: inline code with various punctuation', () => {
  const text = 'Here is `code`. And `more code`! Also `code`; works';
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
            text: 'Here is ',
          },
          {
            type: 'text',
            text: 'code',
            marks: [{ type: 'code' }],
          },
          {
            type: 'text',
            text: '. And ',
          },
          {
            type: 'text',
            text: 'more code',
            marks: [{ type: 'code' }],
          },
          {
            type: 'text',
            text: '! Also ',
          },
          {
            type: 'text',
            text: 'code',
            marks: [{ type: 'code' }],
          },
          {
            type: 'text',
            text: '; works ',
          },
        ],
      },
    ],
  });
});

test('textAndMentionsToContent: inline code followed by space', () => {
  const text = 'This is `code` with space after';
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
            text: 'This is ',
          },
          {
            type: 'text',
            text: 'code',
            marks: [{ type: 'code' }],
          },
          {
            type: 'text',
            text: ' with space after ',
          },
        ],
      },
    ],
  });
});

test('textAndMentionsToContent: inline code followed multipl chars', () => {
  const text =
    'This is `code`!! with multiple characters in the same word after';
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
            text: 'This is ',
          },
          {
            type: 'text',
            text: 'code',
            marks: [{ type: 'code' }],
          },
          {
            type: 'text',
            text: '!! with multiple characters in the same word after ',
          },
        ],
      },
    ],
  });
});

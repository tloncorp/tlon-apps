import { expect, test } from 'vitest';

import { Mention, textAndMentionsToContent } from './content-helpers';

test('textAndMentionsToContent', () => {
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

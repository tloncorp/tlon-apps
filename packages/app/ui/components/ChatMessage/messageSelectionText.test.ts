import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { messageSelectionText } from './messageSelectionText';

function post(content: unknown, textContent = 'Stored preview') {
  return { content, textContent, blob: null, isDeleted: false } as db.Post;
}

describe('messageSelectionText', () => {
  test('preserves paragraphs, links, emoji and mentions without inline formatting', () => {
    expect(
      messageSelectionText(
        post([
          { inline: ['Hello ', { bold: ['Vince'] }, ' 🙏'] },
          {
            inline: [
              'See ',
              { link: { href: 'https://tlon.io', content: 'Tlon' } },
              ' and ',
              { ship: '~zod' },
            ],
          },
        ])
      )
    ).toBe('Hello Vince 🙏\nSee Tlon and ~zod');
  });

  test('preserves the full message instead of using the inline stored preview', () => {
    const text = 'A long message with selectable text. '.repeat(500);
    expect(
      messageSelectionText(
        post(
          [{ inline: [text] }, { inline: ['Last paragraph'] }],
          'A long message…'
        )
      )
    ).toBe(text.trim() + '\nLast paragraph');
  });

  test('keeps code text without adding markdown fences', () => {
    expect(
      messageSelectionText(
        post([
          {
            block: {
              code: { code: 'first();\nsecond();', lang: 'javascript' },
            },
          },
        ])
      )
    ).toBe('first();\nsecond();');
  });

  test('excludes attachment placeholders from the selectable message', () => {
    expect(
      messageSelectionText(
        post(
          [
            {
              block: {
                image: {
                  src: 'https://example.com/image.png',
                  alt: '',
                  width: 100,
                  height: 100,
                },
              },
            },
          ],
          '(Image)'
        )
      )
    ).toBe('');
    expect(
      messageSelectionText(
        post([
          { inline: ['Photo caption'] },
          {
            block: {
              image: {
                src: 'https://example.com/image.png',
                alt: '',
                width: 100,
                height: 100,
              },
            },
          },
        ])
      )
    ).toBe('Photo caption');
  });

  test('offers no text for deleted, empty, or whitespace-only messages', () => {
    expect(
      messageSelectionText({
        ...post([{ inline: ['Removed'] }]),
        isDeleted: true,
      })
    ).toBe('');
    expect(messageSelectionText(post(null, '')).trim()).toBe('');
    expect(messageSelectionText(post([{ inline: ['   '] }])).trim()).toBe('');
  });

  test('falls back to stored text when message content cannot be decoded', () => {
    expect(
      messageSelectionText(post('{invalid json', 'New message text'))
    ).toBe('New message text');
  });
});

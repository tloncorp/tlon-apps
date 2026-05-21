import { describe, expect, it } from 'vitest';

import {
  PostNotificationTextConfig,
  getPostNotificationText,
} from './postNotificationText';

describe('postNotificationText', () => {
  it('extracts plain text from story content without a DOM-backed parser', () => {
    expect(
      getPostNotificationText([
        {
          inline: [
            'hello ',
            { bold: ['there'] },
            { break: null },
            'friend',
            { break: null },
          ],
        },
      ])
    ).toBe('hello there\nfriend');
  });

  it('leaves markdown table syntax as text for notification previews', () => {
    expect(
      getPostNotificationText(
        [
          {
            inline: [
              '| A | B |',
              { break: null },
              '|---|---|',
              { break: null },
              '| 1 | 2 |',
              { break: null },
            ],
          },
        ],
        PostNotificationTextConfig.inlineConfig
      )
    ).toBe('| A | B |\n|---|---|\n| 1 | 2 |');
  });

  it('skips inline verses that only contain a trailing break', () => {
    expect(
      getPostNotificationText([
        { inline: ['hi'] },
        { inline: [{ break: null }] },
        { inline: ['bye'] },
      ])
    ).toBe('hi\nbye');
  });
});

import { describe, expect, it } from 'vitest';

import { PlaintextPreviewConfig, getTextContent } from './postContentText';

describe('postContentText', () => {
  it('extracts plain text from story content without a DOM-backed parser', () => {
    expect(
      getTextContent([
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
      getTextContent(
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
        PlaintextPreviewConfig.inlineConfig
      )
    ).toBe('| A | B |\n|---|---|\n| 1 | 2 |');
  });
});

import { describe, expect, it } from 'bun:test';

import { markdownToStory, textToStory } from './story';

describe('markdownToStory', () => {
  it('treats literal hashtag lines as paragraph text', () => {
    expect(markdownToStory('#todo')).toEqual([{ inline: ['#todo'] }]);
  });

  it('still starts a new block for markdown headings after paragraph text', () => {
    expect(markdownToStory('intro\n# Heading\nbody')).toEqual([
      { inline: ['intro'] },
      { block: { header: { tag: 'h1', content: ['Heading'] } } },
      { inline: ['body'] },
    ]);
  });

  it('converts a valid ship mention', () => {
    expect(markdownToStory('Hello ~sampel-palnet')).toEqual([
      {
        inline: ['Hello ', { ship: '~sampel-palnet' }],
      },
    ]);
  });

  for (const candidate of ['~word', '~thanks', '~foo-bar', '~zod2']) {
    it(`keeps invalid ship candidate ${candidate} as plain text`, () => {
      expect(markdownToStory(`Say ${candidate} here`)).toEqual([
        {
          inline: [`Say ${candidate} here`],
        },
      ]);
    });
  }

  it('keeps an invalid ship candidate as plain text inside formatting', () => {
    expect(markdownToStory('**~word**')).toEqual([
      {
        inline: [{ bold: ['~word'] }],
      },
    ]);
  });
});

describe('textToStory', () => {
  it('converts a valid ship mention', () => {
    expect(textToStory('Hello ~sampel-palnet')).toEqual([
      {
        inline: ['Hello ', { ship: '~sampel-palnet' }],
      },
    ]);
  });

  it('keeps an invalid ship candidate as plain text', () => {
    expect(textToStory('Say ~foo-bar here')).toEqual([
      {
        inline: ['Say ', '~foo-bar', ' here'],
      },
    ]);
  });
});

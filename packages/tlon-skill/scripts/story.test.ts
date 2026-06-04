import { describe, expect, it } from 'bun:test';

import { markdownToStory } from './story';

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
});

import { describe, expect, test } from 'vitest';

import { storyToMarkdown } from './index';
import { markdownToStory } from './parse';

// The live-markdown editor's edit/save loop is: story -> storyToMarkdown (load)
// -> markdownToStory (save). This asserts that loop is a fixed point (no content
// or formatting lost) by starting from markdown, building the initial story, and
// checking the story is unchanged after a story->markdown->story round-trip.
function expectRoundTrip(markdown: string) {
  const story0 = markdownToStory(markdown);
  const story1 = markdownToStory(storyToMarkdown(story0));
  expect(story1).toEqual(story0);
}

describe('story <-> markdown edit/save round-trip', () => {
  test('plain paragraph', () => {
    expectRoundTrip('hello world');
  });
  test('inline emphasis', () => {
    expectRoundTrip('a **bold** b *italic* c ~~strike~~ d `code` e');
  });
  test('headings h1-h6', () => {
    expectRoundTrip(
      '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6'
    );
  });
  test('blockquote', () => {
    expectRoundTrip('> a quoted line');
  });
  test('fenced code block', () => {
    expectRoundTrip('```js\nconst x = 1;\nconst y = 2;\n```');
  });
  test('unordered list', () => {
    expectRoundTrip('- one\n- two\n- three');
  });
  test('ordered list', () => {
    expectRoundTrip('1. one\n2. two\n3. three');
  });
  test('link', () => {
    expectRoundTrip('see [the docs](https://example.com) here');
  });
  test('ship mention', () => {
    expectRoundTrip('hey ~finned-palmer and ~zod');
  });
  test('group mention', () => {
    expectRoundTrip('ping @all and @admin');
  });
  test('mixed document', () => {
    expectRoundTrip(
      '# Title\n\nSome **bold** intro with ~zod.\n\n- first\n- second\n\n> a quote\n\n```\ncode\n```'
    );
  });
});

describe('storyToMarkdown: non-text content is skipped, not crashed', () => {
  test('a verse with neither inline nor block (e.g. a reference) is skipped', () => {
    const story = [
      { inline: ['before'] },
      { type: 'reference', reference: {} },
      { inline: ['after'] },
    ] as unknown as Parameters<typeof storyToMarkdown>[0];
    expect(() => storyToMarkdown(story)).not.toThrow();
    expect(storyToMarkdown(story)).toBe('before\n\nafter');
  });

  test('a cite block (no Markdown equivalent) is dropped without crashing', () => {
    const story = [
      { inline: ['note'] },
      { block: { cite: { chan: { nest: 'chat/~zod/general', where: '' } } } },
    ] as unknown as Parameters<typeof storyToMarkdown>[0];
    expect(() => storyToMarkdown(story)).not.toThrow();
    expect(storyToMarkdown(story)).toBe('note');
  });
});

describe('intra-word _ and @ round-trip as literal text', () => {
  // The live-markdown editor unescapes `\_` (intra-word) and `\@` for display;
  // assert they parse back to the same literal text so unescaping is safe.
  test('snake_case stays literal', () => {
    expect(
      markdownToStory('snake_case_name', { parseMentions: false })
    ).toEqual([{ inline: ['snake_case_name'] }]);
  });
  test('@ stays literal', () => {
    expect(markdownToStory('a.b@c', { parseMentions: false })).toEqual([
      { inline: ['a.b@c'] },
    ]);
  });
});

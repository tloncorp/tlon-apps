import { describe, expect, test } from 'vitest';

import { markdownToStory } from '../client/markdown';
import { convertContent } from '../client/postContent';

const SRC = 'https://example.com/a.png';

describe('convertContent with inline markdown images', () => {
  test('splits an image that shares a line with text into its own block', () => {
    const content = convertContent(
      markdownToStory(`Before ![diagram](${SRC}) after.`),
      null
    );
    expect(content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Before ' }] },
      { type: 'image', src: SRC, alt: 'diagram', width: 0, height: 0 },
      { type: 'paragraph', content: [{ type: 'text', text: ' after.' }] },
    ]);
  });

  test('renders an image inside a list item as a link to it', () => {
    const content = convertContent(
      markdownToStory(`- see ![diagram](${SRC})`),
      null
    );
    expect(JSON.stringify(content)).toContain(
      JSON.stringify({ type: 'link', href: SRC, text: 'diagram' })
    );
    expect(JSON.stringify(content)).not.toContain('Unknown content type');
  });

  test('falls back to the image URL when there is no alt text', () => {
    const content = convertContent(
      markdownToStory(`> quoted ![](${SRC})`),
      null
    );
    expect(JSON.stringify(content)).toContain(
      JSON.stringify({ type: 'link', href: SRC, text: SRC })
    );
  });
});

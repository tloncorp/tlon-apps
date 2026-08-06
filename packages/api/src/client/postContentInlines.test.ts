import { afterEach, describe, expect, test, vi } from 'vitest';

import type { Inline } from '../urbit/content';
import { convertInlineContent } from './postContentInlines';

describe('convertInlineContent malformed block-shaped inlines', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    ['null blockquote', { blockquote: null }],
    ['numeric blockquote', { blockquote: 123 }],
    ['null code', { code: null }],
    ['code without a string payload', { code: {} }],
  ])('degrades a %s through the unknown-content fallback', (_, inline) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(convertInlineContent([inline as unknown as Inline])).toStrictEqual([
      { type: 'text', text: 'Unknown content type' },
    ]);
    expect(warning).toHaveBeenCalledWith('Unhandled inline type:', { inline });
  });
});

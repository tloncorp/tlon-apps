import { describe, expect, it } from 'vitest';

import {
  floatingComposerEstimatedHeight,
  floatingPinnedPostBannerClearance,
  getConversationContentInsets,
} from './conversationInsets';

describe('getConversationContentInsets', () => {
  it.each([
    {
      name: 'uses the measured iOS header and composer',
      input: {
        platform: 'ios' as const,
        headerHeight: 103,
        bottomSafeArea: 34,
        measuredComposerHeight: 98,
        hasFloatingComposer: true,
        hasTransparentHeader: true,
        hasFloatingPinnedPostBanner: true,
      },
      expected: {
        top: 103 + floatingPinnedPostBannerClearance,
        bottom: 98,
      },
    },
    {
      name: 'adapts to a compact iOS header',
      input: {
        platform: 'ios' as const,
        headerHeight: 52,
        bottomSafeArea: 21,
        measuredComposerHeight: null,
        hasFloatingComposer: true,
        hasTransparentHeader: true,
        hasFloatingPinnedPostBanner: false,
      },
      expected: {
        top: 52,
        bottom: floatingComposerEstimatedHeight + 21,
      },
    },
    {
      name: 'reserves only the composer on Android',
      input: {
        platform: 'android' as const,
        headerHeight: 80,
        bottomSafeArea: 24,
        measuredComposerHeight: 88,
        hasFloatingComposer: true,
        hasTransparentHeader: true,
        hasFloatingPinnedPostBanner: true,
      },
      expected: { top: 0, bottom: 88 },
    },
    {
      name: 'leaves web content inline',
      input: {
        platform: 'web' as const,
        headerHeight: 80,
        bottomSafeArea: 0,
        measuredComposerHeight: 64,
        hasFloatingComposer: true,
        hasTransparentHeader: true,
        hasFloatingPinnedPostBanner: true,
      },
      expected: { top: 0, bottom: 0 },
    },
  ])('$name', ({ input, expected }) => {
    expect(getConversationContentInsets(input)).toEqual(expected);
  });
});

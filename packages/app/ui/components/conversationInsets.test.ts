import { describe, expect, it } from 'vitest';

import {
  floatingComposerEstimatedHeight,
  floatingPinnedPostBannerClearance,
  getConversationContentInsets,
  getPostCollectionTopInset,
  unobscuredConversationBottomGap,
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
        hasBottomSafeAreaClearance: false,
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
        hasBottomSafeAreaClearance: false,
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
        hasBottomSafeAreaClearance: false,
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
        hasBottomSafeAreaClearance: false,
        hasTransparentHeader: true,
        hasFloatingPinnedPostBanner: true,
      },
      expected: { top: 0, bottom: 0 },
    },
  ])('$name', ({ input, expected }) => {
    expect(getConversationContentInsets(input)).toEqual(expected);
  });

  it('keeps unobscured native content above the bottom safe area', () => {
    expect(
      getConversationContentInsets({
        platform: 'ios',
        headerHeight: 103,
        bottomSafeArea: 34,
        measuredComposerHeight: null,
        hasFloatingComposer: false,
        hasBottomSafeAreaClearance: true,
        hasTransparentHeader: true,
        hasFloatingPinnedPostBanner: false,
      }).bottom
    ).toBe(34 + unobscuredConversationBottomGap);
  });
});

describe('getPostCollectionTopInset', () => {
  it('keeps the full inset in the scroll content when no fixed notice is visible', () => {
    expect(
      getPostCollectionTopInset({
        contentTopInset: 155,
        fixedLeadingContentOwnsInset: false,
        sharedTopInset: 155,
      })
    ).toBe(155);
  });

  it('does not duplicate clearance owned by a fixed leading notice', () => {
    expect(
      getPostCollectionTopInset({
        contentTopInset: 155,
        fixedLeadingContentOwnsInset: true,
        sharedTopInset: 155,
      })
    ).toBe(0);
  });
});

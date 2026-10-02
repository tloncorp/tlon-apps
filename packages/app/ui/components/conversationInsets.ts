import type { Platform } from 'react-native';

export type ConversationContentInsets = {
  top: number;
  bottom: number;
};

/** Shared geometry for floating conversation controls and list clearance. */
export const floatingChromeMetrics = {
  controlSize: 48,
  controlRadius: 24,
  rowGap: 8,
  rowPaddingHorizontal: 12,
  rowPaddingVertical: 8,
} as const;

export const floatingComposerEstimatedHeight =
  floatingChromeMetrics.controlSize +
  2 * floatingChromeMetrics.rowPaddingVertical;
export const floatingScrollControlClearance =
  floatingChromeMetrics.controlSize + floatingChromeMetrics.rowGap;
export const floatingPinnedPostBannerHeight = 44;
export const floatingPinnedPostBannerGap = 8;
export const floatingPinnedPostBannerClearance =
  floatingPinnedPostBannerHeight + floatingPinnedPostBannerGap;
export const unobscuredConversationBottomGap = 8;

export function getPostCollectionTopInset({
  contentTopInset,
  fixedLeadingContentOwnsInset,
  sharedTopInset,
}: {
  contentTopInset: number;
  fixedLeadingContentOwnsInset: boolean;
  sharedTopInset: number;
}) {
  return Math.max(
    0,
    contentTopInset - (fixedLeadingContentOwnsInset ? sharedTopInset : 0)
  );
}

export function getConversationContentInsets({
  platform,
  headerHeight,
  bottomSafeArea,
  measuredComposerHeight,
  hasFloatingComposer,
  hasBottomSafeAreaClearance,
  hasTransparentHeader,
  hasFloatingPinnedPostBanner,
}: {
  platform: typeof Platform.OS;
  headerHeight: number;
  bottomSafeArea: number;
  measuredComposerHeight: number | null;
  hasFloatingComposer: boolean;
  hasBottomSafeAreaClearance: boolean;
  hasTransparentHeader: boolean;
  hasFloatingPinnedPostBanner: boolean;
}): ConversationContentInsets {
  const usesNativeFloatingChrome = platform !== 'web';
  const usesIOSScrollEdgeChrome = platform === 'ios';

  return {
    top: usesIOSScrollEdgeChrome
      ? (hasTransparentHeader ? headerHeight : 0) +
        (hasFloatingPinnedPostBanner ? floatingPinnedPostBannerClearance : 0)
      : 0,
    bottom:
      usesNativeFloatingChrome && hasFloatingComposer
        ? (measuredComposerHeight ??
          floatingComposerEstimatedHeight + bottomSafeArea)
        : usesNativeFloatingChrome && hasBottomSafeAreaClearance
          ? bottomSafeArea + unobscuredConversationBottomGap
          : 0,
  };
}

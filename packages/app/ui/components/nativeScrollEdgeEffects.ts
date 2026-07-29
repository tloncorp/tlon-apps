import { Platform } from 'react-native';

const iosMajorVersion = Number.parseInt(String(Platform.Version), 10);

export const supportsNativeScrollEdgeEffects =
  Platform.OS === 'ios' && iosMajorVersion >= 26;

// Keep screen-level edge effects generic so every transparent native header
// uses the same platform behavior. Individual floating elements additionally
// connect themselves to a scroll view with ScrollEdgeElementContainer.
export const topScrollEdgeEffects = {
  top: 'soft',
  bottom: 'hidden',
  left: 'hidden',
  right: 'hidden',
} as const;

/**
 * Identifies the conversation list's scroll view to the native scroll-edge
 * module, which registers floating elements (composer, pinned banner) against
 * it via `ScrollEdgeElementContainer`.
 *
 * This is applied as a `testID`, because the native side locates the scroll
 * view by matching `accessibilityIdentifier` - which React Native populates
 * from `testID`, not from `nativeID`. That makes this string load-bearing for a
 * production visual effect, not just for tests: renaming it, reusing it, or
 * stripping testIDs from release builds silently disables the iOS 26 scroll
 * edge effect on the conversation screen, with no error.
 *
 * PostList must apply it to every conversation list. If the native lookup ever
 * moves to a real `nativeID`, update `ScrollEdgeViewFinder.findTaggedView` in
 * the tlon-scroll-edge-effect module at the same time.
 */
export const conversationScrollViewNativeID =
  'tlon-conversation-scroll-edge-content';

export const conversationNavigationBarHeight = 44;
export const floatingPinnedPostBannerHeight = 44;
export const floatingPinnedPostBannerGap = 8;
export const floatingPinnedPostBannerClearance =
  floatingPinnedPostBannerHeight + floatingPinnedPostBannerGap;

export const conversationScrollEdgeEffects = {
  top: 'soft',
  bottom: 'soft',
  left: 'hidden',
  right: 'hidden',
} as const;

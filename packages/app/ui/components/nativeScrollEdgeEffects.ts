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

export const verticalScrollEdgeEffects = {
  top: 'soft',
  bottom: 'soft',
  left: 'hidden',
  right: 'hidden',
} as const;

export const conversationScrollViewNativeID =
  'tlon-conversation-scroll-edge-content';

export const conversationNavigationBarHeight = 44;
export const floatingPinnedPostBannerHeight = 44;
export const floatingPinnedPostBannerGap = 8;
export const floatingPinnedPostBannerClearance =
  floatingPinnedPostBannerHeight + floatingPinnedPostBannerGap;

export const supportsConversationScrollEdgeEffects =
  supportsNativeScrollEdgeEffects;
export const conversationScrollEdgeEffects = {
  top: 'soft',
  bottom: 'soft',
  left: 'hidden',
  right: 'hidden',
} as const;

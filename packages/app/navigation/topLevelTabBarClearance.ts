// iOS 26 draws the tab bar as a floating pill (~60pt) inset from the bottom
// edge, so the band it occludes subsumes the home indicator rather than
// stacking on top of it. Earlier iOS keeps the 49pt bar above the safe area,
// and Android's bar sits directly above its own.
export const IOS_FLOATING_TAB_BAR_CLEARANCE = 84;
export const IOS_TAB_BAR_HEIGHT = 49;
export const ANDROID_TAB_BAR_HEIGHT = 80;

/** Height of the band the tab bar occludes, measured up from the screen edge. */
export function getTopLevelTabBarClearance({
  platform,
  floatingTabBar,
  bottomInset,
}: {
  platform: string;
  /** The iOS 26 pill, which arrives with the same chrome as the floating header. */
  floatingTabBar: boolean;
  bottomInset: number;
}) {
  switch (platform) {
    case 'ios':
      return floatingTabBar
        ? IOS_FLOATING_TAB_BAR_CLEARANCE
        : IOS_TAB_BAR_HEIGHT + bottomInset;
    case 'android':
      return ANDROID_TAB_BAR_HEIGHT + bottomInset;
    default:
      return 0;
  }
}

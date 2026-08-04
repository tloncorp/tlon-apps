const NATIVE_TAB_BAR_HEIGHT: Record<'ios' | 'android', number> = {
  ios: 49,
  android: 80,
};

export function getTopLevelTabBarContentInset(
  platform: string,
  safeAreaBottom: number,
  contentSpacing: number
) {
  if (platform !== 'ios' && platform !== 'android') {
    return contentSpacing;
  }

  // Android's Material bar includes its own spacing; the floating iOS bar
  // needs an additional content gap above it.
  return (
    NATIVE_TAB_BAR_HEIGHT[platform] +
    safeAreaBottom +
    (platform === 'ios' ? contentSpacing : 0)
  );
}

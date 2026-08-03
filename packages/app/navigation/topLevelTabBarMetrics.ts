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

  return (
    NATIVE_TAB_BAR_HEIGHT[platform] +
    safeAreaBottom +
    (platform === 'ios' ? contentSpacing : 0)
  );
}

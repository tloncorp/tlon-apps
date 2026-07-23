/**
 * Native bottom tabs are unavailable on web. RootStack only renders this
 * component on iOS and Android, while this fallback keeps web bundling safe.
 */
export function NativeTabNavigator() {
  return null;
}

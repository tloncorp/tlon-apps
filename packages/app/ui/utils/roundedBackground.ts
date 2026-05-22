// Workaround for facebook/react-native#52415:
// Android Fabric can lose border radius when a rounded view mounts with a
// transparent/empty background and later becomes opaque. The upstream fix is
// tracked in facebook/react-native#56588. Keying small rounded badge/dot views
// by their resolved background forces a fresh native view for that transition.
export function getAndroidRoundedBackgroundKey(backgroundColor: unknown) {
  return `android-rounded-background:${
    backgroundColor == null || backgroundColor === false
      ? 'empty'
      : String(backgroundColor)
  }`;
}

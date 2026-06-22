// Native entry: the modern object-oriented expo-media-library API (SDK 56+).
// The Next API has no web build, so the web counterpart (mediaLibrary.web.ts) is
// a no-op — every call site in MediaViewerScreen is behind `if (isWeb) return`
// (web saves via download), so it's only ever used on native. Re-exported here so
// web resolves to the stub instead of pulling expo-media-library into its bundle.
export { Asset, requestPermissionsAsync } from 'expo-media-library';

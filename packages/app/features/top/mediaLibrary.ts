// Native entry: the modern object-oriented expo-media-library API (SDK 56+).
// The Next API has no web build, so the web counterpart (mediaLibrary.web.ts) is
// a no-op — every call site in MediaViewerScreen is behind `if (isWeb) return`
// (web saves via download), so it's only ever used on native.
import { Asset, requestPermissionsAsync } from 'expo-media-library';

export { requestPermissionsAsync };

// The Next API replaced the legacy saveToLibraryAsync(uri) with Asset.create(uri).
export async function saveToLibraryAsync(localUri: string): Promise<void> {
  await Asset.create(localUri);
}

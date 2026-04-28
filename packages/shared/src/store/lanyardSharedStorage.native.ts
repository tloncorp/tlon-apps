import { NativeModules, Platform } from 'react-native';

// Mirrors the most recent lanyard query result into App Group shared
// storage so the iOS silent-push handler (LanyardMatchPushHandler) can
// compare an incoming match-event push against the latest client-side
// digest and decide whether to surface a user-visible notification.
//
// Android currently no-ops; the equivalent on that side will use a FCM
// data-message + WorkManager handler with its own shared-storage path.
export function setLanyardMatchState(hash: string, count: number): void {
  if (Platform.OS !== 'ios') return;
  const mod = NativeModules.UrbitModule;
  if (mod?.setLanyardMatchState == null) return;
  try {
    mod.setLanyardMatchState(hash, count);
  } catch {
    // best effort — the comparison still works on a fresh device, the
    // first push just won't be suppressed against a stale local state
  }
}

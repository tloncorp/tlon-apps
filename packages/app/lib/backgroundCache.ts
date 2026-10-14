// Shared contract for the iOS notification-extension cache bridge. The optional
// acknowledgement method distinguishes binaries with the safe handoff protocol.
export interface BackgroundCacheSpec {
  setLastSyncTimestamp(timestamp: number): Promise<void>;
  retrieveBackgroundData(): Promise<string | null>;
  acknowledgeBackgroundData?(cacheId: string): Promise<boolean>;
}

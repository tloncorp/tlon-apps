export interface UrbitModuleSpec {
  setPostHogApiKey(key: string): void;
  clearUrbit(): void;
  setUrbit(ship: string, url: string, authCookie: string): void;
  updateBadgeCount(count: number, uid: string): void;
  signalJsReady(): void;
  // Caches whether the connected backend's %activity supports reactions, so the
  // native notification extension can pick the v9 (activity-event-1) vs v8
  // (activity-event) fetch without scrying for a version itself.
  setActivitySupportsReactions(supported: boolean): void;
}

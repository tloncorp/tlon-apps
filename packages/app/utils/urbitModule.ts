export interface UrbitModuleSpec {
  setPostHogApiKey(key: string): void;
  clearUrbit(): void;
  setUrbit(ship: string, url: string, authCookie: string): void;
  // Refreshes just the stored auth cookie, without the rest of what setUrbit
  // does. setUrbit is a new-login operation -- it also rotates the channel url
  // and clears the cached activity capabilities -- so it must not be reused to
  // push a cookie obtained by a mid-session reauth.
  //
  // The ship and url the cookie was minted for are passed so the native side
  // can drop it if the device has since been pointed at a different ship; only
  // it can check and write in one step.
  setAuthCookie(shipName: string, shipUrl: string, authCookie: string): void;
  updateBadgeCount(count: number, uid: string): void;
  signalJsReady(): void;
  // Caches whether the connected backend's %activity supports reactions, so the
  // native notification extension can pick the v9 (activity-event-1) vs v8
  // (activity-event) fetch without scrying for a version itself.
  setActivitySupportsReactions(supported: boolean): void;
  // Same pattern for notes activity: gates the v10 (activity-event-2) fetch.
  setActivitySupportsNotes(supported: boolean): void;
}

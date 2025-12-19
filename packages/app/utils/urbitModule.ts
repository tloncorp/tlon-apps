export interface UrbitModuleSpec {
  setPostHogApiKey(key: string): void;
  clearUrbit(): void;
  setUrbit(ship: string, url: string, authCookie: string): void;
  updateBadgeCount(count: number, uid: string): void;
  signalJsReady(): void;
}

export interface UrbitModuleSpec {
  setPostHogApiKey(key: string): void;
  clearUrbit(): void;
  setUrbit(ship: string, url: string, authCookie: string): void;
}

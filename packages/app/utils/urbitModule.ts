import { Platform, TurboModule, TurboModuleRegistry } from 'react-native';

export interface UrbitModuleSpec extends TurboModule {
  setPostHogApiKey(key: string): void;
  clearUrbit(): void;
  setUrbit(ship: string, url: string, authCookie: string): void;
  updateBadgeCount(count: number, uid: string): void;
  signalJsReady(): void;
}

export const UrbitModule =
  Platform.OS !== 'web'
    ? TurboModuleRegistry.get<UrbitModuleSpec>('UrbitModule')
    : null;

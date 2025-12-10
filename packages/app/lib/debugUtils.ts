import { AppState, AppStateStatus, Platform } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

import { UrbitModuleSpec } from '../utils/urbitModule';

const UrbitModule =
  Platform.OS !== 'web'
    ? (TurboModuleRegistry.get('UrbitModule') as UrbitModuleSpec)
    : null;

/**
 * Freezes the JS thread for testing. Call from debugger: global.debugFreezeJS(5000)
 */
export function debugFreezeJS(durationMs: number): void {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    // Busy wait
  }
}

(global as any).debugFreezeJS = debugFreezeJS;

function signalJsReady(): void {
  try {
    UrbitModule?.signalJsReady?.();
  } catch (e) {
    // Ignore errors
  }
}

signalJsReady();

if (Platform.OS !== 'web') {
  let lastAppState: AppStateStatus = AppState.currentState;

  AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (lastAppState.match(/inactive|background/) && nextAppState === 'active') {
      signalJsReady();
    }
    lastAppState = nextAppState;
  });
}

import { Platform } from 'react-native';

import { ENV_VARS } from '../constants';

const TLON_NAMESPACE = 'tlonEnv';

// Should be called as early as possible
export function loadConstants(): void {
  if (Platform.OS === 'web') {
    (window as any)[TLON_NAMESPACE] = ENV_VARS;
  } else {
    (global as any)[TLON_NAMESPACE] = ENV_VARS;
  }
}

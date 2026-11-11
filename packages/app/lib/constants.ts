import { setPostClientMetadata } from '@tloncorp/shared';
import { Platform } from 'react-native';

import { ENV_VARS } from '../constants';
import { getPostClientMetadata } from './postClientMetadata';

const TLON_NAMESPACE = 'tlonEnv';

// Should be called as early as possible
export function loadConstants(): void {
  setPostClientMetadata(getPostClientMetadata());
  if (Platform.OS === 'web') {
    (window as any)[TLON_NAMESPACE] = ENV_VARS;
  } else {
    (global as any)[TLON_NAMESPACE] = ENV_VARS;
  }
}

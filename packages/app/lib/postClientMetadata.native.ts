import type { PostClientMetadata } from '@tloncorp/api/client/content-helpers';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { GIT_HASH } from '../constants';

export function getPostClientMetadata(): PostClientMetadata {
  return {
    version: 1,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    appVersion: Application.nativeApplicationVersion ?? undefined,
    build: Application.nativeBuildVersion ?? undefined,
    gitHash: GIT_HASH,
  };
}

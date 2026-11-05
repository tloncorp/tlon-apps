import type { PostClientMetadata } from '@tloncorp/api/client/content-helpers';

import { GIT_HASH } from '../constants';

export function getPostClientMetadata(): PostClientMetadata {
  return { version: 1, platform: 'web', gitHash: GIT_HASH };
}

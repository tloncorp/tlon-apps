import type { PostClientMetadata } from '@tloncorp/api/client/content-helpers';

// Advance when adding renderer capabilities that senders need to gate;
// each revision retains the capabilities of earlier revisions.
export const CLIENT_RENDERER_REVISION = 1;

export function getPostClientMetadata(): PostClientMetadata {
  return { version: 1, rendererRevision: CLIENT_RENDERER_REVISION };
}

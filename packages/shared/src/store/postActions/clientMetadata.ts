import {
  appendToPostBlob,
  type PostClientMetadata,
} from '@tloncorp/api/client/content-helpers';

let clientMetadata: PostClientMetadata | undefined;

export function setPostClientMetadata(
  metadata: PostClientMetadata | undefined
) {
  clientMetadata = metadata;
}

export function appendPostClientMetadata(blob: string | undefined) {
  if (!clientMetadata) {
    return blob;
  }
  return appendToPostBlob(blob, {
    type: 'metadata',
    version: 1,
    data: { 'tlon.client': clientMetadata },
  });
}

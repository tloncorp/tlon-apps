import { A2UI, appendToPostBlob } from '@tloncorp/api';

export function serializeContextLensReferenceBlob(
  lensId: string,
  botShip?: string
): string {
  return JSON.stringify([
    {
      type: 'tlon-context-lens',
      version: 1,
      lensId,
      ...(botShip ? { botShip } : {}),
    },
  ]);
}

export const TLON_A2UI_CATALOG_ID = 'tlon.a2ui.basic.v1';
/**
 * Adds the `Choice` component. Clients that predate it fail validation on the
 * unknown component and fall back to the post's story text, so only send v2
 * for surfaces whose text fallback stands on its own.
 */
export const TLON_A2UI_CATALOG_V2 = 'tlon.a2ui.basic.v2';
export type TlonA2UIBlob = A2UI.BlobEntry;

export function makeA2UIBlob(
  surfaceId: string,
  root: string,
  components: A2UI.Component[],
  catalogId: string = TLON_A2UI_CATALOG_ID
): TlonA2UIBlob {
  const blob: TlonA2UIBlob = {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId },
      },
      {
        version: 'v0.9',
        updateComponents: { surfaceId, root, components },
      },
    ],
  };
  if (!A2UI.validateBlobEntry(blob)) {
    throw new Error('invalid a2ui blob');
  }
  return blob;
}

export function serializeBlobField(entry: TlonA2UIBlob): string {
  return appendToPostBlob(undefined, entry);
}

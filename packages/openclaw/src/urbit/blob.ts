import { A2UI } from './a2ui.js';

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
export type TlonA2UIBlob = A2UI.BlobEntry;

export function makeA2UIBlob(
  surfaceId: string,
  root: string,
  components: A2UI.Component[]
): TlonA2UIBlob {
  const blob: TlonA2UIBlob = {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: TLON_A2UI_CATALOG_ID },
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
  return JSON.stringify([entry]);
}

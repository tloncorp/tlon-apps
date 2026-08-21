import { A2UI, appendToPostBlob } from '@tloncorp/api';
import {
  type ParticipantAgentActivityProjectionV1,
  ParticipantAgentActivityProjectionV1Schema,
} from '@tloncorp/api/client/participantAgentActivity';

export function serializeContextLensReferenceBlob(
  lensId: string,
  botShip?: string,
  delivery?: 'final' | 'intermediate',
  outcome?: 'completed' | 'failed',
  participantActivity?: ParticipantAgentActivityProjectionV1
): string {
  const publicProjection = participantActivity
    ? ParticipantAgentActivityProjectionV1Schema.parse(participantActivity)
    : undefined;
  return JSON.stringify([
    {
      type: 'tlon-context-lens',
      version: 1,
      lensId,
      ...(botShip ? { botShip } : {}),
      ...(delivery ? { delivery } : {}),
      ...(outcome ? { outcome } : {}),
      ...(publicProjection ? { participantActivity: publicProjection } : {}),
    },
  ]);
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * Replace only the public projection on one existing Context Lens reference.
 * Other blob entries and extension fields are preserved verbatim as data.
 */
export function replaceContextLensParticipantActivityInBlob(
  blob: string,
  lensId: string,
  participantActivity: ParticipantAgentActivityProjectionV1
): string {
  const projection =
    ParticipantAgentActivityProjectionV1Schema.parse(participantActivity);
  let entries: unknown;
  try {
    entries = JSON.parse(blob);
  } catch {
    throw new Error('Invalid post blob JSON');
  }
  if (!Array.isArray(entries)) {
    throw new Error('Post blob must be a JSON array');
  }

  const matches = entries.flatMap((entry, index) =>
    isJsonRecord(entry) &&
    entry.type === 'tlon-context-lens' &&
    entry.version === 1 &&
    entry.lensId === lensId
      ? [index]
      : []
  );
  if (matches.length === 0) {
    throw new Error(`Context Lens reference not found: ${lensId}`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous Context Lens reference: ${lensId}`);
  }

  const matchIndex = matches[0];
  return JSON.stringify(
    entries.map((entry, index) =>
      index === matchIndex && isJsonRecord(entry)
        ? { ...entry, participantActivity: projection }
        : entry
    )
  );
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
  return appendToPostBlob(undefined, entry);
}

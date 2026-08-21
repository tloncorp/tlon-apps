import type { ParticipantAgentActivityProjectionV1 } from '@tloncorp/api/client/participantAgentActivity';
import { describe, expect, it } from 'vitest';

import {
  replaceContextLensParticipantActivityInBlob,
  serializeContextLensReferenceBlob,
} from './blob.js';

function projection(
  surface: ParticipantAgentActivityProjectionV1['surface'] = 'carrier'
): ParticipantAgentActivityProjectionV1 {
  return {
    schemaVersion: 1,
    surface,
    publicRunId: 'run_abcdefghijklmnopqrstuvwxyz',
    revision: surface === 'carrier' ? 2 : 3,
    triggerPostId: '~sampel-palnet/170.141.184.507.123',
    state: surface === 'carrier' ? 'working' : 'completed',
    createdAt: 1_000,
    updatedAt: surface === 'carrier' ? 1_500 : 2_000,
    ...(surface === 'final' ? { completedAt: 2_000 } : {}),
    steps: [
      {
        id: 'step_abcdefghijklmnopqrstuvwxyz',
        title: 'Verify the result',
        status: surface === 'carrier' ? 'running' : 'completed',
      },
    ],
  };
}

describe('Context Lens participant activity blobs', () => {
  it('serializes the projection as an additive Lens v1 field', () => {
    expect(
      JSON.parse(
        serializeContextLensReferenceBlob(
          'lens-123',
          '~zod',
          'final',
          'completed',
          projection('final')
        )
      )
    ).toEqual([
      {
        type: 'tlon-context-lens',
        version: 1,
        lensId: 'lens-123',
        botShip: '~zod',
        delivery: 'final',
        outcome: 'completed',
        participantActivity: projection('final'),
      },
    ]);
  });

  it('replaces only the matching projection in a combined blob', () => {
    const untouchedEntry = {
      type: 'future-extension',
      version: 9,
      nested: { preserve: ['all', 'fields'] },
    };
    const otherLens = {
      type: 'tlon-context-lens',
      version: 1,
      lensId: 'lens-other',
      participantActivity: projection('carrier'),
    };
    const matchingLens = {
      type: 'tlon-context-lens',
      version: 1,
      lensId: 'lens-123',
      delivery: 'final',
      outcome: 'completed',
      customExtension: { must: 'survive' },
      participantActivity: projection('carrier'),
    };
    const blob = JSON.stringify([untouchedEntry, matchingLens, otherLens]);

    const replaced = JSON.parse(
      replaceContextLensParticipantActivityInBlob(
        blob,
        'lens-123',
        projection('final')
      )
    );

    expect(replaced[0]).toEqual(untouchedEntry);
    expect(replaced[1]).toEqual({
      ...matchingLens,
      participantActivity: projection('final'),
    });
    expect(replaced[2]).toEqual(otherLens);
  });

  it('rejects missing, ambiguous, and malformed replacements', () => {
    const reference = {
      type: 'tlon-context-lens',
      version: 1,
      lensId: 'lens-123',
    };
    expect(() =>
      replaceContextLensParticipantActivityInBlob(
        JSON.stringify([reference]),
        'missing',
        projection()
      )
    ).toThrow('not found');
    expect(() =>
      replaceContextLensParticipantActivityInBlob(
        JSON.stringify([reference, reference]),
        'lens-123',
        projection()
      )
    ).toThrow('Ambiguous');
    expect(() =>
      replaceContextLensParticipantActivityInBlob(
        JSON.stringify([reference]),
        'lens-123',
        {
          ...projection(),
          botShip: '~forged',
        } as ParticipantAgentActivityProjectionV1
      )
    ).toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import { appendToPostBlob, parsePostBlob } from '../client/content-helpers';
import {
  MAX_PARTICIPANT_AGENT_ACTIVITY_STEPS,
  MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS,
  type ParticipantAgentActivityProjectionV1,
  ParticipantAgentActivityProjectionV1Schema,
} from '../client/participantAgentActivity';

function projection(): ParticipantAgentActivityProjectionV1 {
  return {
    schemaVersion: 1,
    surface: 'final',
    publicRunId: 'run_abcdefghijklmnopqrstuvwxyz',
    revision: 4,
    triggerPostId: '~sampel-palnet/170.141.184.507.123',
    threadRootId: '~sampel-palnet/170.141.184.500.100',
    retryOf: 'run_zyxwvutsrqponmlkjihgfedcba',
    continuation: {
      kind: 'request_input',
      parentPublicRunId: 'run_parentabcdefghijklmnopq',
    },
    state: 'completed',
    createdAt: 1_000,
    updatedAt: 2_000,
    completedAt: 2_000,
    steps: [
      {
        id: 'step_abcdefghijklmnopqrstuvwxyz',
        title: 'Compare the records',
        status: 'completed',
        update: 'Matched every requested city.',
        actions: { total: 12, completed: 12 },
      },
    ],
  };
}

describe('ParticipantAgentActivityProjectionV1Schema', () => {
  it('parses the bounded public contract', () => {
    expect(
      ParticipantAgentActivityProjectionV1Schema.parse(projection())
    ).toEqual(projection());
  });

  it('keeps continuation lineage opaque and rejects owner Lens identifiers', () => {
    expect(projection().continuation).toEqual({
      kind: 'request_input',
      parentPublicRunId: 'run_parentabcdefghijklmnopq',
    });
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        continuation: {
          kind: 'request_input',
          parentPublicRunId: 'run_parentabcdefghijklmnopq',
          parentLensId: 'owner-lens-secret',
        },
      }).success
    ).toBe(false);
  });

  it('rejects identity, private detail, and unknown nested fields', () => {
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        botShip: '~zod',
      }).success
    ).toBe(false);
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        channelId: 'chat/~zod/private',
      }).success
    ).toBe(false);
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        steps: [
          {
            ...projection().steps[0],
            toolArguments: '--token very-secret',
          },
        ],
      }).success
    ).toBe(false);
  });

  it('enforces text, count, chronology, and aggregate bounds', () => {
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        steps: [
          {
            ...projection().steps[0],
            title: 'x'.repeat(MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS + 1),
          },
        ],
      }).success
    ).toBe(false);
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        steps: Array.from(
          { length: MAX_PARTICIPANT_AGENT_ACTIVITY_STEPS + 1 },
          (_, index) => ({
            id: `step_${index}`,
            title: `Step ${index}`,
            status: 'pending',
          })
        ),
      }).success
    ).toBe(false);
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        updatedAt: 999,
      }).success
    ).toBe(false);
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        steps: [
          {
            ...projection().steps[0],
            actions: { total: 1, completed: 2 },
          },
        ],
      }).success
    ).toBe(false);
  });

  it('does not allow terminal metadata on an active projection', () => {
    expect(
      ParticipantAgentActivityProjectionV1Schema.safeParse({
        ...projection(),
        state: 'working',
      }).success
    ).toBe(false);
  });

  it('round-trips as an optional field on the existing Lens v1 blob entry', () => {
    const participantActivity = projection();
    const blob = appendToPostBlob(undefined, {
      type: 'tlon-context-lens',
      version: 1,
      lensId: 'owner-lens-123',
      delivery: 'final',
      participantActivity,
    });

    expect(parsePostBlob(blob)).toEqual([
      {
        type: 'tlon-context-lens',
        version: 1,
        lensId: 'owner-lens-123',
        delivery: 'final',
        participantActivity,
      },
    ]);
  });
});

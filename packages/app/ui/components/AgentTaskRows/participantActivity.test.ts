import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import type { ContextLensEvent } from '../Channel/ContextLens/types';
import {
  PARTICIPANT_CARRIER_STALE_MS,
  type ParticipantTaskProjection,
  authenticatedParticipantCarrierPostIds,
  mergeOwnerAndParticipantEvents,
  participantActivityRecordsForPosts,
  participantCarrierPostIds,
  participantCarrierPostIdsForExperiment,
  participantContextLensEventAtTime,
  participantContextLensEvents,
  shouldSuppressParticipantActivityEditedIndicator,
} from './participantActivity';

const CHANNEL_ID = 'chat/~host/group-channel';

function post(id: string, overrides: Partial<db.Post> = {}): db.Post {
  return {
    id,
    authorId: '~requester',
    channelId: CHANNEL_ID,
    type: 'chat',
    receivedAt: 100,
    sentAt: 100,
    isDeleted: false,
    isBot: false,
    replyCount: 0,
    ...overrides,
  };
}

function projection(
  overrides: Partial<ParticipantTaskProjection> = {}
): ParticipantTaskProjection {
  return {
    schemaVersion: 1,
    surface: 'carrier',
    publicRunId: 'public_run_1',
    revision: 1,
    triggerPostId: '1.000',
    state: 'working',
    createdAt: 100,
    updatedAt: 200,
    steps: [
      {
        id: 'research',
        title: 'Research the request',
        status: 'running',
        update: 'Checking the primary sources now.',
        actions: { total: 3, completed: 2 },
      },
    ],
    ...overrides,
  };
}

function activityPost(
  id: string,
  activity: ParticipantTaskProjection,
  overrides: Partial<db.Post> = {}
) {
  return post(id, {
    authorId: '~agent',
    isBot: true,
    blob: JSON.stringify([
      {
        type: 'tlon-context-lens',
        version: 1,
        lensId: 'private-lens-id',
        botShip: '~agent',
        delivery: activity.surface === 'carrier' ? 'intermediate' : 'final',
        participantActivity: activity,
      },
    ]),
    ...overrides,
  });
}

describe('participant agent activity', () => {
  it('classifies an authenticated carrier before its trigger page loads', () => {
    const carrier = activityPost('2.000', projection(), {
      textContent: 'Working…',
    });

    expect(
      participantActivityRecordsForPosts([carrier], CHANNEL_ID)
    ).toHaveLength(0);
    expect(
      authenticatedParticipantCarrierPostIds([carrier], CHANNEL_ID)
    ).toEqual(new Set(['2.000']));
  });

  it('does not hide wrong-channel, forged, or invalid carrier posts', () => {
    const wrongChannel = activityPost('2.000', projection(), {
      channelId: 'chat/other-channel',
    });
    const forged = activityPost('3.000', projection(), {
      authorId: '~imposter',
    });
    const invalid = activityPost('4.000', projection(), {
      blob: '{not-json',
    });

    expect(
      authenticatedParticipantCarrierPostIds(
        [wrongChannel, forged, invalid],
        CHANNEL_ID
      )
    ).toEqual(new Set());
  });

  it('keeps carrier fallback text visible when the experiment is off', () => {
    const carrier = activityPost('2.000', projection(), {
      textContent: 'Working…',
    });

    expect(
      participantCarrierPostIdsForExperiment([carrier], CHANNEL_ID, false)
    ).toEqual(new Set());
    expect(
      participantCarrierPostIdsForExperiment([carrier], CHANNEL_ID, true)
    ).toEqual(new Set(['2.000']));
  });

  it('suppresses metadata-only edit labels only for valid bot projections', () => {
    const validFinal = activityPost(
      '2.000',
      projection({
        surface: 'final',
        state: 'completed',
        updatedAt: 300,
        completedAt: 300,
      }),
      { isEdited: true }
    );
    const nonBot = activityPost('3.000', projection(), {
      isBot: false,
      isEdited: true,
    });
    const malformed = activityPost('4.000', projection(), {
      blob: '{not-json',
      isEdited: true,
    });

    expect(shouldSuppressParticipantActivityEditedIndicator(validFinal)).toBe(
      true
    );
    expect(shouldSuppressParticipantActivityEditedIndicator(nonBot)).toBe(
      false
    );
    expect(shouldSuppressParticipantActivityEditedIndicator(malformed)).toBe(
      false
    );
  });

  it('derives a root-channel participant event from authenticated posts', () => {
    const trigger = post('1.000', {
      authorId: '~requester',
      textContent: 'Research this for the group.',
    });
    const carrier = activityPost('2.000', projection());

    const records = participantActivityRecordsForPosts(
      [trigger, carrier],
      CHANNEL_ID
    );
    const [event] = participantContextLensEvents(records);

    expect(records).toHaveLength(1);
    expect(participantCarrierPostIds(records)).toEqual(new Set(['2.000']));
    expect(event).toMatchObject({
      phase: 'participant-carrier',
      participantActivity: {
        publicRunId: 'public_run_1',
        surface: 'carrier',
        carrierPostId: '2.000',
        triggerPostId: '1.000',
      },
      lens: {
        lensId: 'private-lens-id',
        botShip: '~agent',
        messageId: '1.000',
        chatType: 'channel',
        visibility: 'participants',
        status: 'tool_running',
        triggerDetails: {
          authorShip: '~requester',
          conversationId: CHANNEL_ID,
        },
        context: { sources: [] },
        persistence: { events: [] },
        tools: { ownerOnlyAvailable: [], called: [], runs: [] },
        outputs: [],
      },
    });
    expect(event.lens.expiresAt).toBe(200 + PARTICIPANT_CARRIER_STALE_MS);
  });

  it('accepts a projection only within the exact loaded thread root', () => {
    const root = post('1.000');
    const trigger = post('1.100', {
      type: 'reply',
      parentId: root.id,
    });
    const carrier = activityPost(
      '1.200',
      projection({ triggerPostId: trigger.id, threadRootId: root.id }),
      { type: 'reply', parentId: root.id }
    );

    expect(
      participantActivityRecordsForPosts([root, trigger, carrier], CHANNEL_ID)
    ).toHaveLength(1);

    const otherRootCarrier = activityPost(
      '2.200',
      projection({ triggerPostId: trigger.id, threadRootId: '2.000' }),
      { type: 'reply', parentId: '2.000' }
    );
    expect(
      participantActivityRecordsForPosts(
        [root, trigger, otherRootCarrier],
        CHANNEL_ID
      )
    ).toHaveLength(0);
  });

  it('rejects cross-channel triggers even when both posts are loaded', () => {
    const trigger = post('1.000', { channelId: 'chat/other-channel' });
    const carrier = activityPost('2.000', projection());

    expect(
      participantActivityRecordsForPosts([trigger, carrier], CHANNEL_ID)
    ).toHaveLength(0);
  });

  it('rejects forged and non-bot carrier authors', () => {
    const trigger = post('1.000');
    const forged = activityPost('2.000', projection(), {
      authorId: '~imposter',
    });
    const nonBot = activityPost('3.000', projection(), { isBot: false });

    expect(
      participantActivityRecordsForPosts([trigger, forged, nonBot], CHANNEL_ID)
    ).toHaveLength(0);
  });

  it('prefers the durable final surface while retaining its carrier identity', () => {
    const trigger = post('1.000');
    const carrier = activityPost('2.000', projection({ revision: 4 }));
    const final = activityPost(
      '3.000',
      projection({
        surface: 'final',
        revision: 3,
        state: 'completed',
        updatedAt: 300,
        completedAt: 300,
        steps: [
          {
            id: 'research',
            title: 'Research the request',
            status: 'completed',
          },
        ],
      }),
      { textContent: 'Here are the results.', sentAt: 300 }
    );

    const [event] = participantContextLensEvents(
      participantActivityRecordsForPosts([trigger, carrier, final], CHANNEL_ID)
    );

    expect(event.participantActivity).toMatchObject({
      surface: 'final',
      carrierPostId: '2.000',
    });
    expect(event.lens).toMatchObject({
      status: 'completed',
      outputs: [{ messageId: '3.000' }],
    });
  });

  it('preserves the public waiting audience for deterministic copy', () => {
    for (const [state, waitingAudience] of [
      ['waiting_owner', 'owner'],
      ['waiting_requester', 'requester'],
    ] as const) {
      const trigger = post('1.000');
      const carrier = activityPost(
        '2.000',
        projection({
          state,
          steps: [
            {
              id: 'gate',
              title: 'Input required',
              status: 'waiting',
            },
          ],
        })
      );
      const [event] = participantContextLensEvents(
        participantActivityRecordsForPosts([trigger, carrier], CHANNEL_ID)
      );

      expect(event.participantActivity.waitingAudience).toBe(waitingAudience);
    }
  });

  it('keeps the full owner Lens event when both projections identify the run', () => {
    const trigger = post('1.000');
    const carrier = activityPost('2.000', projection());
    const [participant] = participantContextLensEvents(
      participantActivityRecordsForPosts([trigger, carrier], CHANNEL_ID)
    );
    const owner: ContextLensEvent = {
      seq: 9,
      at: 201,
      phase: 'owner-snapshot',
      lens: {
        ...participant.lens,
        visibility: 'owner',
        context: {
          ...participant.lens.context,
          sources: [
            { kind: 'memory', label: 'Private memory', included: true },
          ],
        },
        persistence: {
          ...participant.lens.persistence,
          events: [
            {
              kind: 'memory',
              action: 'read',
              location: 'openclaw',
              status: 'ok',
              at: 201,
            },
          ],
        },
        tools: {
          ...participant.lens.tools,
          ownerOnlyAvailable: ['tlon'],
          called: ['tlon'],
        },
      },
    };

    expect('participantActivity' in owner).toBe(false);
    expect(mergeOwnerAndParticipantEvents([owner], [participant])).toEqual([
      owner,
    ]);
  });

  it('turns a stale working carrier into a stable aborted receipt snapshot', () => {
    const trigger = post('1.000');
    const carrier = activityPost('2.000', projection());
    const [event] = participantContextLensEvents(
      participantActivityRecordsForPosts([trigger, carrier], CHANNEL_ID)
    );
    const stale = participantContextLensEventAtTime(
      event,
      event.lens.expiresAt!
    );

    expect(stale).toMatchObject({
      phase: 'participant-carrier-stale',
      participantActivity: { carrierPostId: '2.000' },
      lens: { status: 'aborted' },
    });
    expect(stale.lens.error).toContain('expired');
  });

  it('preserves a terminal no-reply carrier instead of making it spin', () => {
    const trigger = post('1.000');
    const carrier = activityPost(
      '2.000',
      projection({
        state: 'timed_out',
        updatedAt: 300,
        completedAt: 300,
        terminalReason: 'timeout',
      })
    );
    const [event] = participantContextLensEvents(
      participantActivityRecordsForPosts([trigger, carrier], CHANNEL_ID)
    );

    expect(event.lens).toMatchObject({
      status: 'timed_out',
      error: 'The run timed out.',
    });
    expect(event.lens.expiresAt).toBeUndefined();
  });
});

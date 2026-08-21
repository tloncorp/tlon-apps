import { describe, expect, it } from 'vitest';

import type { ContextLens } from './context-lens.js';
import {
  buildParticipantAgentActivityProjection,
  participantAgentPublicRunId,
} from './participant-agent-activity.js';
import { serializeContextLensReferenceBlob } from './urbit/blob.js';

const SECRET = 'SENTINEL_PRIVATE_7d3f86';
const RAW_STEP_ID = `raw-step-${SECRET}`;

function rawLens(): ContextLens {
  return {
    lensId: 'owner-lens-123',
    botShip: SECRET,
    runId: SECRET,
    messageId: '~requester/170.141.184.507.123',
    sessionKeyHash: SECRET,
    chatType: 'channel',
    runKind: 'conversation',
    visibility: 'owner',
    trigger: 'thread',
    triggerDetails: {
      type: 'thread',
      messageId: '~requester/170.141.184.507.123',
      authorShip: SECRET,
      conversationId: SECRET,
      conversationKind: 'channel',
      receivedAt: 1_000,
      preview: SECRET,
    },
    retryOf: `parent-lens-${SECRET}`,
    continuation: {
      kind: 'request_input',
      parentLensId: `waiting-parent-${SECRET}`,
      requestInputId: `request-input-${SECRET}`,
      workflowId: `workflow-${SECRET}`,
      linkedAt: 1_000,
    },
    retrySeed: {
      messageText: SECRET,
      blobField: JSON.stringify({ token: SECRET }),
      messageContent: { privateStory: SECRET },
      parentId: '~requester/170.141.184.500.100',
      isThreadReply: true,
      replyParentId: null,
      cachesHistory: true,
    },
    model: SECRET,
    provider: SECRET,
    context: {
      currentMessage: true,
      threadMessages: 4,
      channelMessages: 10,
      citedPosts: 2,
      attachments: 1,
      pendingNudge: false,
      sources: [
        {
          kind: 'memory',
          label: SECRET,
          sourceId: SECRET,
          included: true,
          reason: SECRET,
          tokenEstimate: 99,
          preview: SECRET,
        },
      ],
    },
    persistence: {
      postsReply: true,
      updatesSettings: true,
      writesMedia: true,
      emitsTelemetry: true,
      cachesHistory: true,
      events: [
        {
          kind: 'artifact',
          action: 'created',
          location: 'external',
          status: 'ok',
          key: SECRET,
          reason: SECRET,
          at: 1_100,
        },
      ],
    },
    tools: {
      ownerOnlyAvailable: [SECRET],
      called: [SECRET],
      callCount: 1,
      lastStartedAt: 1_100,
      runs: [
        {
          id: SECRET,
          toolCallId: SECRET,
          callIndex: 1,
          name: SECRET,
          phase: SECRET,
          startedAt: 1_100,
          completedAt: 1_200,
          durationMs: 100,
          status: 'completed',
          argumentSummary: SECRET,
          argumentDetail: SECRET,
          resultSummary: SECRET,
          error: SECRET,
        },
      ],
    },
    outputs: [
      {
        messageId: SECRET,
        conversationId: SECRET,
        kind: 'channel',
        sentAt: 1_300,
        preview: SECRET,
      },
    ],
    activity: {
      schemaVersion: 1,
      eventCount: 8,
      lastEventAt: 1_250,
      truncated: false,
      plan: {
        explanation: SECRET,
        steps: [
          {
            id: RAW_STEP_ID,
            title: 'Compare the requested records',
            status: 'running',
          },
        ],
        updatedAt: 1_050,
      },
      items: [
        {
          id: `commentary-${SECRET}`,
          kind: 'commentary',
          title: 'Progress',
          status: 'running',
          planStepId: RAW_STEP_ID,
          startedAt: 1_050,
          updatedAt: 1_200,
          completedAt: null,
          progressText: 'Checking each requested record now.',
        },
        {
          id: SECRET,
          kind: 'tool',
          title: SECRET,
          status: 'completed',
          planStepId: RAW_STEP_ID,
          startedAt: 1_100,
          updatedAt: 1_150,
          completedAt: 1_150,
          progressText: SECRET,
          name: SECRET,
          toolCallId: SECRET,
          source: SECRET,
        },
        {
          id: `approval-${SECRET}`,
          kind: 'approval',
          title: SECRET,
          status: 'completed',
          planStepId: RAW_STEP_ID,
          startedAt: 1_150,
          updatedAt: 1_175,
          completedAt: 1_175,
          progressText: SECRET,
        },
        {
          id: `error-${SECRET}`,
          kind: 'error',
          title: SECRET,
          status: 'error',
          planStepId: RAW_STEP_ID,
          startedAt: 1_180,
          updatedAt: 1_190,
          completedAt: 1_190,
          progressText: SECRET,
        },
      ],
    },
    lifecycle: {
      queuedAt: 1_000,
      queuedMs: 20,
      dispatchStartedAt: 1_020,
      firstToolStartedAt: 1_100,
      completedAt: null,
      durationMs: null,
      timeoutMs: 180_000,
      timedOut: false,
      deliveredMessageCount: 0,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
    },
    status: 'tool_running',
    error: SECRET,
    createdAt: 1_000,
    updatedAt: 1_300,
    expiresAt: 30_000,
  };
}

describe('buildParticipantAgentActivityProjection', () => {
  it('serializes only the public allowlist from a fully seeded private Lens', () => {
    const lens = rawLens();
    const projection = buildParticipantAgentActivityProjection({
      lens,
      surface: 'carrier',
      revision: 8,
    });

    expect(projection).toMatchObject({
      schemaVersion: 1,
      surface: 'carrier',
      revision: 8,
      triggerPostId: '~requester/170.141.184.507.123',
      threadRootId: '~requester/170.141.184.500.100',
      state: 'working',
      createdAt: 1_000,
      updatedAt: 1_300,
      steps: [
        {
          title: 'Compare the requested records',
          status: 'running',
          update: 'Checking each requested record now.',
          actions: { total: 3, completed: 2 },
        },
      ],
    });
    expect(projection?.publicRunId).toBe(
      participantAgentPublicRunId(lens.lensId)
    );
    expect(projection?.publicRunId).not.toBe(lens.lensId);
    expect(projection?.retryOf).toBe(
      participantAgentPublicRunId(lens.retryOf!)
    );
    expect(projection?.continuation).toEqual({
      kind: 'request_input',
      parentPublicRunId: participantAgentPublicRunId(
        lens.continuation!.parentLensId
      ),
    });
    expect(projection).not.toHaveProperty('botShip');
    expect(projection).not.toHaveProperty('channelId');

    const publicJson = JSON.stringify(projection);
    expect(publicJson).not.toContain(SECRET);
    expect(publicJson).not.toContain(RAW_STEP_ID);

    const blob = serializeContextLensReferenceBlob(
      lens.lensId,
      '~safe-bot',
      'intermediate',
      undefined,
      projection!
    );
    expect(blob).not.toContain(SECRET);
    expect(JSON.parse(blob)[0].participantActivity).toEqual(projection);
  });

  it('settles stale running rows on a final incomplete reply', () => {
    const lens = rawLens();
    lens.activity.plan!.steps = [
      { id: 'done', title: 'Collect data', status: 'completed' },
      { id: 'open', title: 'Verify the result', status: 'running' },
    ];
    lens.activity.items = [];
    lens.status = 'delivering';

    const projection = buildParticipantAgentActivityProjection({
      lens,
      surface: 'final',
      revision: 9,
    });

    expect(projection?.state).toBe('incomplete');
    expect(projection?.completedAt).toBe(1_300);
    expect(projection?.steps.map((step) => step.status)).toEqual([
      'completed',
      'pending',
    ]);
  });

  it('keeps requester and owner waits open without copying approval text', () => {
    const requesterLens = rawLens();
    requesterLens.activity.plan!.steps[0].status = 'waiting';
    requesterLens.activity.items = [];
    requesterLens.status = 'completed';
    const requesterProjection = buildParticipantAgentActivityProjection({
      lens: requesterLens,
      surface: 'final',
      revision: 10,
    });
    expect(requesterProjection?.state).toBe('waiting_requester');
    expect(requesterProjection?.completedAt).toBeUndefined();

    const ownerLens = rawLens();
    ownerLens.activity.items = [
      {
        id: 'approval-private',
        kind: 'approval',
        title: SECRET,
        status: 'waiting',
        planStepId: RAW_STEP_ID,
        startedAt: 1_100,
        updatedAt: 1_200,
        completedAt: null,
        progressText: SECRET,
      },
    ];
    const ownerProjection = buildParticipantAgentActivityProjection({
      lens: ownerLens,
      surface: 'carrier',
      revision: 11,
    });
    expect(ownerProjection?.state).toBe('waiting_owner');
    expect(ownerProjection?.steps[0].status).toBe('waiting');
    expect(JSON.stringify(ownerProjection)).not.toContain(SECRET);
  });

  it('projects only an explicit request-input item as an uncounted requester gate', () => {
    const lens = rawLens();
    lens.activity.plan = null;
    lens.activity.items = [
      {
        id: 'request-input:tool-call-1',
        kind: 'request_input',
        title: 'Which group should I create?',
        status: 'waiting',
        startedAt: 1_200,
        updatedAt: 1_250,
        completedAt: null,
        source: 'tlon_request_input',
        toolCallId: 'tool-call-1',
      },
    ];
    lens.tools.callCount = 0;
    lens.tools.called = [];
    lens.tools.runs = [];
    lens.status = 'completed';

    const projection = buildParticipantAgentActivityProjection({
      lens,
      surface: 'final',
      revision: 12,
    });

    expect(projection).toMatchObject({
      state: 'waiting_requester',
      steps: [
        {
          title: 'Which group should I create?',
          status: 'waiting',
        },
      ],
    });
    expect(projection?.completedAt).toBeUndefined();
    expect(projection?.steps[0]).not.toHaveProperty('actions');
  });

  it('refuses to produce participant projections for direct messages', () => {
    const lens = rawLens();
    lens.chatType = 'dm';
    lens.triggerDetails.conversationKind = 'dm';
    expect(
      buildParticipantAgentActivityProjection({
        lens,
        surface: 'carrier',
        revision: 1,
      })
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import {
  agentPlanAnswerEvidenceMatches,
  findConsumedProvisionSelection,
  hasAnsweredApproachChoice,
  hasNewerOwnerPost,
  isCurrentOwnerInterview,
  resolveAgentProvisionId,
  resolveAgentProvisionButtonLabel,
  resolveAgentProvisionTimezone,
} from './agentProvision';

describe('agentPlanAnswerEvidenceMatches', () => {
  const evidence = {
    focus: 'Robotics',
    recurrence: 'Yes, make it daily',
    time: '8 AM',
    approach: 'Compare expert perspectives',
  };

  it('keeps automatic retries bound to the same owner answers', () => {
    expect(agentPlanAnswerEvidenceMatches(evidence, { ...evidence })).toBe(
      true
    );
    expect(
      agentPlanAnswerEvidenceMatches(evidence, {
        ...evidence,
        time: '9 AM',
      })
    ).toBe(false);
    expect(agentPlanAnswerEvidenceMatches(evidence, undefined)).toBe(false);
  });
});

describe('findConsumedProvisionSelection', () => {
  const failedSelection = {
    type: 'tlon-a2ui-selection' as const,
    version: 1 as const,
    sourcePostId: 'plan-post',
    surfaceId: 'agent-task-plan-1',
    componentId: 'auto-provision',
    values: ['Rescue-dog patterns'],
  };

  it('does not consume automatic provisioning from a failed-only selection', () => {
    expect(
      findConsumedProvisionSelection({
        sourcePostId: 'plan-post',
        surfaceId: 'agent-task-plan-1',
        componentId: 'auto-provision',
        selections: [failedSelection],
        successfulProvisionSelections: [],
      })
    ).toBeUndefined();
  });

  it('consumes automatic provisioning after a successful typed receipt', () => {
    expect(
      findConsumedProvisionSelection({
        sourcePostId: 'plan-post',
        surfaceId: 'agent-task-plan-1',
        componentId: 'auto-provision',
        selections: [failedSelection],
        successfulProvisionSelections: [failedSelection],
      })
    ).toBe(failedSelection);
  });
});

const approachMarkerBlob = JSON.stringify([
  {
    type: 'tlon-agent-post-marker',
    version: 1,
    key: 'agent-choice-dimension:approach',
    interviewStartMessageId: 'interview-start',
  },
]);

describe('automatic provision evidence', () => {
  const planPost = {
    id: 'plan',
    authorId: 'bot',
    channelId: 'chat',
    receivedAt: 300,
    sequenceNum: 3,
  };
  const approachPost = {
    id: 'approach-question',
    authorId: 'bot',
    channelId: 'chat',
    receivedAt: 100,
    sequenceNum: 1,
    blob: approachMarkerBlob,
  };
  const interviewStart = {
    id: 'interview-start',
    authorId: 'owner',
    channelId: 'chat',
    receivedAt: 50,
    sequenceNum: 1,
  };
  const approachAnswer = {
    id: 'approach-answer',
    authorId: 'owner',
    channelId: 'chat',
    receivedAt: 200,
    sequenceNum: 2,
  };
  const selection = {
    type: 'tlon-a2ui-selection' as const,
    version: 1 as const,
    sourcePostId: approachPost.id,
    surfaceId: 'agent-choice-approach-1',
    componentId: 'choices',
    values: ['Compare expert perspectives'],
  };

  it('requires the owner answer matching a prior bot-authored approach question', () => {
    expect(
      hasAnsweredApproachChoice({
        approach: 'Compare expert perspectives',
        interviewStartMessageId: undefined,
        interviewMessageId: approachAnswer.id,
        channelPosts: [
          interviewStart,
          approachPost,
          {
            ...approachAnswer,
            blob: JSON.stringify([selection]),
          },
        ],
        planPost,
        botAuthorId: 'bot',
        ownerId: 'owner',
      })
    ).toBe(true);
    expect(
      hasAnsweredApproachChoice({
        approach: 'Broad curated scan',
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: approachAnswer.id,
        channelPosts: [
          interviewStart,
          approachPost,
          {
            ...approachAnswer,
            blob: JSON.stringify([selection]),
          },
        ],
        planPost,
        botAuthorId: 'bot',
        ownerId: 'owner',
      })
    ).toBe(false);
    expect(
      hasAnsweredApproachChoice({
        approach: 'Compare expert perspectives',
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: approachAnswer.id,
        channelPosts: [
          interviewStart,
          { ...approachPost, authorId: 'owner' },
          {
            ...approachAnswer,
            blob: JSON.stringify([selection]),
          },
        ],
        planPost,
        botAuthorId: 'bot',
        ownerId: 'owner',
      })
    ).toBe(false);
  });

  it('accepts an approach answer before the final interview answer', () => {
    const finalAnswer = {
      id: 'context-answer',
      authorId: 'owner',
      channelId: 'chat',
      receivedAt: 250,
      sequenceNum: 3,
    };
    const laterPlan = { ...planPost, receivedAt: 300, sequenceNum: 4 };
    const channelPosts = [
      interviewStart,
      approachPost,
      { ...approachAnswer, blob: JSON.stringify([selection]) },
      finalAnswer,
    ];
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: finalAnswer.id,
        planPost: laterPlan,
        ownerId: 'owner',
        channelPosts,
      })
    ).toBe(true);
    expect(
      hasAnsweredApproachChoice({
        approach: 'Compare expert perspectives',
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: finalAnswer.id,
        channelPosts,
        planPost: laterPlan,
        botAuthorId: 'bot',
        ownerId: 'owner',
      })
    ).toBe(true);
  });

  it('detects a correction posted after the plan', () => {
    expect(
      hasNewerOwnerPost({
        planPost,
        ownerId: 'owner',
        channelPosts: [
          { ...approachPost, authorId: 'owner' },
          {
            id: 'correction',
            authorId: 'owner',
            channelId: 'chat',
            receivedAt: 400,
            sequenceNum: 4,
          },
        ],
      })
    ).toBe(true);
    expect(
      hasNewerOwnerPost({
        planPost,
        ownerId: 'owner',
        channelPosts: [{ ...approachPost, authorId: 'owner' }],
      })
    ).toBe(false);
  });

  it('requires the plan to come from the latest owner interview post', () => {
    const interviewPost = {
      id: 'owner-interview',
      authorId: 'owner',
      channelId: 'chat',
      receivedAt: 200,
      sequenceNum: 2,
    };
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewPost.id,
        interviewMessageId: interviewPost.id,
        planPost,
        ownerId: 'owner',
        channelPosts: [interviewPost],
      })
    ).toBe(true);
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewPost.id,
        interviewMessageId: interviewPost.id,
        planPost,
        ownerId: 'owner',
        channelPosts: [
          interviewPost,
          {
            id: 'owner-correction-before-plan',
            authorId: 'owner',
            channelId: 'chat',
            receivedAt: 250,
            sequenceNum: 3,
          },
        ],
      })
    ).toBe(false);
  });

  it('matches raw and canonical Urbit post ids', () => {
    const rawId = '170141184508164136620680233968906272768';
    const canonicalId =
      '170.141.184.508.164.136.620.680.233.968.906.272.768';
    const interviewPost = {
      id: canonicalId,
      authorId: 'owner',
      channelId: 'chat',
      receivedAt: 200,
      sequenceNum: 2,
    };

    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: rawId,
        interviewMessageId: rawId,
        planPost,
        ownerId: 'owner',
        channelPosts: [interviewPost],
      })
    ).toBe(true);
  });

  it('ignores a failed automatic provision transport when retrying the plan', () => {
    const interviewPost = {
      id: 'owner-interview',
      authorId: 'owner',
      channelId: 'chat',
      receivedAt: 200,
      sequenceNum: 2,
    };
    const automaticTransport = {
      id: 'auto-transport',
      authorId: 'owner',
      channelId: 'chat',
      receivedAt: 400,
      sequenceNum: 4,
      deliveryStatus: 'failed',
      blob: JSON.stringify([
        {
          type: 'tlon-agent-provision',
          version: 1,
          provisionId: 'auto-plan',
          groupId: 'group',
          purposeId: 'agent-research',
          purpose: 'Research',
          topics: ['Robotics'],
          timezone: 'UTC',
          scheduleHour: 8,
          scheduleMinute: 30,
          notebookNest: 'notes/group/updates',
        },
        {
          type: 'tlon-a2ui-selection',
          version: 1,
          sourcePostId: planPost.id,
          surfaceId: 'agent-task-plan',
          componentId: 'auto-provision',
          values: ['Robotics'],
        },
      ]),
    };

    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewPost.id,
        interviewMessageId: interviewPost.id,
        planPost,
        ownerId: 'owner',
        channelPosts: [interviewPost, automaticTransport],
      })
    ).toBe(true);
  });
});

describe('resolveAgentProvisionId', () => {
  it('uses the source plan post as the stable automatic request id', () => {
    const first = resolveAgentProvisionId(
      '~bot/plan-123',
      'auto-provision',
      'random-1',
      'same-payload'
    );
    const remount = resolveAgentProvisionId(
      '~bot/plan-123',
      'auto-provision',
      'random-2',
      'same-payload'
    );
    expect(first).toContain('~bot/plan-123');
    expect(remount).toBe(first);
    expect(
      resolveAgentProvisionId(
        '~bot/plan-123',
        'auto-provision',
        'random-3',
        'changed-timezone'
      )
    ).not.toBe(first);
    expect(resolveAgentProvisionId('~bot/plan-123', 'confirm', 'random')).toBe(
      'random'
    );
  });
});

describe('resolveAgentProvisionTimezone', () => {
  it('defaults to the live client timezone instead of the host timezone', () => {
    expect(
      resolveAgentProvisionTimezone(undefined, 'America/Los_Angeles')
    ).toBe('America/Los_Angeles');
  });

  it('honors an explicit owner timezone override', () => {
    expect(
      resolveAgentProvisionTimezone('Europe/London', 'America/Los_Angeles')
    ).toBe('Europe/London');
  });

  it('falls back safely when the client cannot resolve a timezone', () => {
    expect(resolveAgentProvisionTimezone(undefined, undefined)).toBe('UTC');
  });
});

describe('resolveAgentProvisionButtonLabel', () => {
  it('acknowledges a request while sending and after acceptance', () => {
    expect(resolveAgentProvisionButtonLabel('Create task', true, false)).toBe(
      'Creating…'
    );
    expect(resolveAgentProvisionButtonLabel('Create task', false, true)).toBe(
      'Request sent'
    );
    expect(resolveAgentProvisionButtonLabel('Create task', false, false)).toBe(
      'Create task'
    );
  });
});

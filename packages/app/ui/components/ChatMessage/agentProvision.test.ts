import { describe, expect, it } from 'vitest';

import {
  findConsumedProvisionSelection,
  hasAnsweredApproachChoice,
  hasNewerOwnerPost,
  resolveAgentProvisionId,
  resolveAgentProvisionButtonLabel,
  resolveAgentProvisionTimezone,
} from './agentProvision';

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
        selections: [selection],
        sourcePosts: [approachPost],
        planPost,
        botAuthorId: 'bot',
      })
    ).toBe(true);
    expect(
      hasAnsweredApproachChoice({
        approach: 'Broad curated scan',
        selections: [selection],
        sourcePosts: [approachPost],
        planPost,
        botAuthorId: 'bot',
      })
    ).toBe(false);
    expect(
      hasAnsweredApproachChoice({
        approach: 'Compare expert perspectives',
        selections: [selection],
        sourcePosts: [{ ...approachPost, authorId: 'owner' }],
        planPost,
        botAuthorId: 'bot',
      })
    ).toBe(false);
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

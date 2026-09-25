import { describe, expect, it } from 'vitest';

import {
  findConsumedProvisionSelection,
  isCurrentOwnerInterview,
  resolveAgentProvisionButtonLabel,
  resolveAgentProvisionId,
  resolveAgentProvisionTimezone,
} from './agentProvision';

describe('findConsumedProvisionSelection', () => {
  const selection = {
    type: 'tlon-a2ui-selection' as const,
    version: 1 as const,
    sourcePostId: 'plan-post',
    surfaceId: 'agent-task-plan-1',
    componentId: 'auto-provision',
    values: ['Daily cleanup'],
  };

  it('consumes automatic provisioning only after a successful receipt', () => {
    expect(
      findConsumedProvisionSelection({
        sourcePostId: 'plan-post',
        surfaceId: 'agent-task-plan-1',
        componentId: 'auto-provision',
        selections: [selection],
        successfulProvisionSelections: [],
      })
    ).toBeUndefined();
    expect(
      findConsumedProvisionSelection({
        sourcePostId: 'plan-post',
        surfaceId: 'agent-task-plan-1',
        componentId: 'auto-provision',
        selections: [selection],
        successfulProvisionSelections: [selection],
      })
    ).toBe(selection);
  });

  it('uses ordinary selections for visible controls', () => {
    expect(
      findConsumedProvisionSelection({
        sourcePostId: 'plan-post',
        surfaceId: 'agent-task-plan-1',
        componentId: 'choices',
        selections: [{ ...selection, componentId: 'choices' }],
        successfulProvisionSelections: [],
      })
    ).toEqual(expect.objectContaining({ componentId: 'choices' }));
  });
});

describe('isCurrentOwnerInterview', () => {
  const interviewStart = {
    id: 'interview-start',
    authorId: 'owner',
    channelId: 'chat',
    receivedAt: 100,
    sequenceNum: 1,
  };
  const interviewEnd = {
    id: 'interview-end',
    authorId: 'owner',
    channelId: 'chat',
    receivedAt: 200,
    sequenceNum: 2,
  };
  const planPost = {
    id: 'plan',
    authorId: 'bot',
    channelId: 'chat',
    receivedAt: 300,
    sequenceNum: 3,
  };

  it('accepts a plan bound to the current owner turn', () => {
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: interviewEnd.id,
        planPost,
        channelPosts: [interviewStart, interviewEnd],
        ownerId: 'owner',
      })
    ).toBe(true);
  });

  it('rejects missing, cross-channel, and superseded owner turns', () => {
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: 'missing',
        planPost,
        channelPosts: [interviewStart, interviewEnd],
        ownerId: 'owner',
      })
    ).toBe(false);
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: interviewEnd.id,
        planPost,
        channelPosts: [
          interviewStart,
          { ...interviewEnd, channelId: 'other-chat' },
        ],
        ownerId: 'owner',
      })
    ).toBe(false);
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: interviewEnd.id,
        planPost,
        channelPosts: [
          interviewStart,
          interviewEnd,
          {
            id: 'correction',
            authorId: 'owner',
            channelId: 'chat',
            receivedAt: 250,
            sequenceNum: 3,
          },
        ],
        ownerId: 'owner',
      })
    ).toBe(false);
  });

  it('ignores the automatic provision transport when retrying the same plan', () => {
    const transport = {
      id: 'transport',
      authorId: 'owner',
      channelId: 'chat',
      receivedAt: 350,
      sequenceNum: 4,
      blob: JSON.stringify([
        {
          type: 'tlon-agent-provision',
          version: 1,
          provisionId: 'provision',
          groupId: 'group',
          purposeId: 'agent-learning',
          purpose: 'Learn',
          topics: ['testing'],
          timezone: 'America/New_York',
          scheduleHour: 8,
          scheduleMinute: 0,
          notebookNest: 'notes',
          notebookTitle: 'Updates',
        },
        {
          type: 'tlon-a2ui-selection',
          version: 1,
          sourcePostId: 'plan',
          surfaceId: 'agent-task-plan-1',
          componentId: 'auto-provision',
          values: ['Learn'],
        },
      ]),
    };
    expect(
      isCurrentOwnerInterview({
        interviewStartMessageId: interviewStart.id,
        interviewMessageId: interviewEnd.id,
        planPost,
        channelPosts: [interviewStart, interviewEnd, transport],
        ownerId: 'owner',
      })
    ).toBe(true);
  });
});

describe('provision helpers', () => {
  it('uses a stable automatic request id and random ids elsewhere', () => {
    expect(
      resolveAgentProvisionId('post', 'auto-provision', 'fallback', 'a')
    ).toBe(resolveAgentProvisionId('post', 'auto-provision', 'different', 'a'));
    expect(
      resolveAgentProvisionId('post', 'auto-provision', 'fallback', 'a')
    ).not.toBe(
      resolveAgentProvisionId('post', 'auto-provision', 'fallback', 'b')
    );
    expect(resolveAgentProvisionId('post', 'choices', 'fallback')).toBe(
      'fallback'
    );
  });

  it('resolves explicit, device, and fallback timezones in order', () => {
    expect(
      resolveAgentProvisionTimezone('Europe/Paris', 'America/New_York')
    ).toBe('Europe/Paris');
    expect(resolveAgentProvisionTimezone(undefined, 'America/New_York')).toBe(
      'America/New_York'
    );
    expect(resolveAgentProvisionTimezone(undefined, undefined)).toBe('UTC');
  });

  it('shows sending and accepted button states', () => {
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

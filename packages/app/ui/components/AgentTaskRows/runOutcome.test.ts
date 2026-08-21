import { describe, expect, it } from 'vitest';

import type { ContextLensEvent } from '../Channel/ContextLens/types';
import { agentChatWaitingLabel } from './activitySemantics';
import { agentChatRunOutcome } from './runOutcome';

function event(status: ContextLensEvent['lens']['status']): ContextLensEvent {
  return {
    seq: 1,
    at: 1,
    phase: status,
    lens: {
      lensId: 'run-1',
      botShip: '~bus',
      messageId: 'request-1',
      chatType: 'channel',
      trigger: 'message',
      model: null,
      provider: null,
      status,
      error: null,
      createdAt: 1,
      updatedAt: 1,
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 0,
        citedPosts: 0,
        attachments: 0,
        pendingNudge: false,
      },
      persistence: {
        postsReply: false,
        updatesSettings: false,
        writesMedia: false,
        emitsTelemetry: false,
        cachesHistory: false,
      },
      tools: {
        ownerOnlyAvailable: [],
        called: [],
        callCount: 0,
        lastStartedAt: null,
      },
      lifecycle: {
        queuedMs: 0,
        durationMs: 1,
        timeoutMs: null,
        timedOut: false,
        deliveredMessageCount: 1,
        queuedFinal: false,
        queuedFinalCount: 0,
        queuedBlockCount: 0,
      },
    },
  };
}

describe('agent chat run outcome', () => {
  it('treats an explicit waiting plan step as waiting', () => {
    const waiting = event('completed');
    waiting.lens.activity = {
      schemaVersion: 1,
      eventCount: 1,
      lastEventAt: 1,
      truncated: false,
      plan: {
        updatedAt: 1,
        steps: [
          { id: 'confirm', title: 'Confirm the name', status: 'waiting' },
          { id: 'create', title: 'Create the group', status: 'pending' },
        ],
      },
      items: [],
    };

    expect(agentChatRunOutcome(waiting)).toBe('waiting');
  });

  it('requires every planned step to be complete for a completed receipt', () => {
    const completed = event('completed');
    completed.lens.activity = {
      schemaVersion: 1,
      eventCount: 1,
      lastEventAt: 1,
      truncated: false,
      plan: {
        updatedAt: 1,
        steps: [{ id: 'done', title: 'Create the group', status: 'completed' }],
      },
      items: [],
    };

    expect(agentChatRunOutcome(completed)).toBe('completed');
    expect(agentChatRunOutcome(event('error'))).toBe('failed');
  });

  it('keeps a terminal reply neutral when its plan finished incomplete', () => {
    const completed = event('completed');
    completed.lens.activity = {
      schemaVersion: 1,
      eventCount: 1,
      lastEventAt: 1,
      truncated: false,
      plan: {
        updatedAt: 1,
        steps: [
          { id: 'done', title: 'Collect the records', status: 'completed' },
          { id: 'stale', title: 'Publish the report', status: 'pending' },
        ],
      },
      items: [],
    };

    expect(agentChatRunOutcome(completed)).toBe('incomplete');
  });

  it('does not infer a gate from a question in reply prose', () => {
    const banter = event('completed');
    banter.lens.outputs = [
      {
        messageId: 'reply-1',
        conversationId: '~bus',
        kind: 'dm',
        sentAt: 2,
        preview: 'Doing well—how are you?',
      },
    ];

    expect(agentChatRunOutcome(banter)).toBe('completed');
  });

  it('does not turn an optional follow-up offer into a blocked run', () => {
    const completed = event('completed');
    completed.lens.outputs = [
      {
        messageId: 'reply-1',
        conversationId: '~bus',
        kind: 'dm',
        sentAt: 2,
        preview: 'The report is ready. Would you like a CSV too?',
      },
    ];

    expect(agentChatRunOutcome(completed)).toBe('completed');
  });

  it('uses only structured request-input and approval items as item gates', () => {
    for (const kind of ['request_input', 'approval'] as const) {
      const waiting = event('completed');
      waiting.lens.activity = {
        schemaVersion: 1,
        eventCount: 1,
        lastEventAt: 1,
        truncated: false,
        plan: null,
        items: [
          {
            id: `${kind}-1`,
            kind,
            title: 'Input needed',
            status: 'waiting',
            startedAt: 1,
            updatedAt: 1,
            completedAt: null,
          },
        ],
      };

      expect(agentChatRunOutcome(waiting)).toBe('waiting');
      expect(agentChatWaitingLabel(waiting)).toBe(
        kind === 'approval' ? 'Waiting for approval' : 'Waiting on you'
      );
    }
  });

  it('does not turn a generic waiting item or input-like title into a gate', () => {
    const generic = event('completed');
    generic.lens.activity = {
      schemaVersion: 1,
      eventCount: 1,
      lastEventAt: 1,
      truncated: false,
      plan: {
        updatedAt: 1,
        steps: [
          {
            id: 'confirm',
            title: 'Please confirm the group name',
            status: 'running',
          },
        ],
      },
      items: [
        {
          id: 'generic-wait',
          kind: 'item',
          title: 'Waiting',
          status: 'waiting',
          startedAt: 1,
          updatedAt: 1,
          completedAt: null,
        },
      ],
    };

    expect(agentChatRunOutcome(generic)).toBe('incomplete');
  });
});

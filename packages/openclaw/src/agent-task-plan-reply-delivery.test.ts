import { beforeEach, describe, expect, it } from 'vitest';

import {
  recordSuccessfulAgentOnboardingSurface,
  resetAgentOnboardingSurfaceReplyDeliveryForTests,
  suppressReplyAfterSuccessfulAgentOnboardingSurface,
} from './agent-task-plan-reply-delivery.js';

const toolContext = {
  channelId: 'tlon',
  runId: 'run-1',
  sessionKey: 'agent:main:tlon:channel:test',
  toolName: 'tlon_agent_task_plan',
};

function recordSuccess(
  toolName = 'tlon_agent_task_plan',
  context = toolContext
) {
  recordSuccessfulAgentOnboardingSurface(
    {
      toolName,
      result: { content: [{ type: 'text', text: 'Surface posted.' }] },
    },
    context
  );
}

function finalEvent(
  overrides: Partial<
    Parameters<typeof suppressReplyAfterSuccessfulAgentOnboardingSurface>[0]
  > = {}
) {
  return {
    payload: { text: 'Extra prose' },
    kind: 'final' as const,
    channel: 'tlon',
    runId: 'run-1',
    ...overrides,
  };
}

function suppress(
  overrides: Parameters<typeof finalEvent>[0] = {},
  context: Parameters<
    typeof suppressReplyAfterSuccessfulAgentOnboardingSurface
  >[1] = toolContext
) {
  return suppressReplyAfterSuccessfulAgentOnboardingSurface(
    finalEvent(overrides),
    context
  );
}

describe('agent task plan reply delivery', () => {
  beforeEach(() => resetAgentOnboardingSurfaceReplyDeliveryForTests());

  it('suppresses final model prose after a successful plan post', () => {
    recordSuccess();

    expect(suppress()).toEqual({
      cancel: true,
      reason: 'tlon_onboarding_surface_owns_reply',
    });
  });

  it('suppresses final model prose after a successful choice post', () => {
    recordSuccess('tlon_agent_choice');

    expect(suppress()).toEqual({
      cancel: true,
      reason: 'tlon_onboarding_surface_owns_reply',
    });
  });

  it('consumes the marker once', () => {
    recordSuccess();
    expect(suppress()).toBeDefined();
    expect(suppress()).toBeUndefined();
  });

  it('suppresses by session when the final reply omits its run id', () => {
    recordSuccess();

    expect(
      suppress(
        { runId: undefined, sessionKey: toolContext.sessionKey },
        { channelId: 'tlon', sessionKey: toolContext.sessionKey }
      )
    ).toEqual({
      cancel: true,
      reason: 'tlon_onboarding_surface_owns_reply',
    });
  });

  it('preserves recovery prose when the plan tool failed', () => {
    recordSuccessfulAgentOnboardingSurface(
      {
        toolName: 'tlon_agent_task_plan',
        params: {},
        result: {
          content: [{ type: 'text', text: 'Error: invalid daily schedule' }],
          details: { error: true },
        },
      },
      toolContext
    );

    expect(
      suppressReplyAfterSuccessfulAgentOnboardingSurface(
        {
          payload: { text: 'Please choose a daily time.' },
          kind: 'final',
          channel: 'tlon',
          runId: 'run-1',
        },
        toolContext
      )
    ).toBeUndefined();
  });

  it('does not suppress another run or channel', () => {
    recordSuccess();

    expect(suppress({ runId: 'run-2' })).toBeUndefined();
    expect(suppress({ channel: 'webchat' })).toBeUndefined();
  });

  it('queues session fallbacks when successful runs overlap', () => {
    recordSuccess();
    const secondContext = { ...toolContext, runId: 'run-2' };
    recordSuccess('tlon_agent_task_plan', secondContext);
    const sessionEvent = {
      runId: undefined,
      sessionKey: toolContext.sessionKey,
    };
    const sessionContext = {
      channelId: 'tlon',
      sessionKey: toolContext.sessionKey,
    };
    expect(suppress(sessionEvent, sessionContext)).toBeDefined();
    expect(suppress(sessionEvent, sessionContext)).toBeDefined();
    expect(suppress(sessionEvent, sessionContext)).toBeUndefined();
  });
});

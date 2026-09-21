import { beforeEach, describe, expect, it } from 'vitest';

import {
  TLON_TASK_PLAN_REPLY_SUPPRESSION_REASON,
  recordSuccessfulAgentTaskPlan,
  resetAgentTaskPlanReplyDeliveryForTests,
  suppressReplyAfterSuccessfulAgentTaskPlan,
} from './agent-task-plan-reply-delivery.js';

const toolContext = {
  channelId: 'tlon',
  runId: 'run-1',
  sessionKey: 'agent:main:tlon:channel:test',
  toolName: 'tlon_agent_task_plan',
};

describe('agent task plan reply delivery', () => {
  beforeEach(() => resetAgentTaskPlanReplyDeliveryForTests());

  it('suppresses final model prose after a successful plan post', () => {
    recordSuccessfulAgentTaskPlan(
      {
        toolName: 'tlon_agent_task_plan',
        params: {},
        result: { content: [{ type: 'text', text: '✓ Message sent' }] },
      },
      toolContext
    );

    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(
        {
          payload: { text: 'Setup is not verified yet.' },
          kind: 'final',
          channel: 'tlon',
          runId: 'run-1',
        },
        toolContext
      )
    ).toEqual({
      cancel: true,
      reason: TLON_TASK_PLAN_REPLY_SUPPRESSION_REASON,
    });
  });

  it('consumes the marker once', () => {
    recordSuccessfulAgentTaskPlan(
      {
        toolName: 'tlon_agent_task_plan',
        params: {},
        result: { content: [{ type: 'text', text: '✓ Message sent' }] },
      },
      toolContext
    );
    const event = {
      payload: { text: 'Extra prose' },
      kind: 'final' as const,
      channel: 'tlon',
      runId: 'run-1',
    };
    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(event, toolContext)
    ).toBeDefined();
    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(event, toolContext)
    ).toBeUndefined();
  });

  it('suppresses by session when the final reply omits its run id', () => {
    recordSuccessfulAgentTaskPlan(
      {
        toolName: 'tlon_agent_task_plan',
        result: { content: [{ type: 'text', text: '✓ Message sent' }] },
      },
      toolContext
    );

    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(
        {
          payload: { text: 'Setup is complete.' },
          kind: 'final',
          channel: 'tlon',
          sessionKey: toolContext.sessionKey,
        },
        { channelId: 'tlon', sessionKey: toolContext.sessionKey }
      )
    ).toEqual({
      cancel: true,
      reason: TLON_TASK_PLAN_REPLY_SUPPRESSION_REASON,
    });
  });

  it('preserves recovery prose when the plan tool failed', () => {
    recordSuccessfulAgentTaskPlan(
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
      suppressReplyAfterSuccessfulAgentTaskPlan(
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
    recordSuccessfulAgentTaskPlan(
      {
        toolName: 'tlon_agent_task_plan',
        params: {},
        result: { content: [{ type: 'text', text: '✓ Message sent' }] },
      },
      toolContext
    );

    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(
        {
          payload: { text: 'Another answer' },
          kind: 'final',
          channel: 'tlon',
          runId: 'run-2',
        },
        toolContext
      )
    ).toBeUndefined();
    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(
        {
          payload: { text: 'Web answer' },
          kind: 'final',
          channel: 'webchat',
          runId: 'run-1',
        },
        toolContext
      )
    ).toBeUndefined();
  });

  it('keeps the newest session alias when runs overlap', () => {
    recordSuccessfulAgentTaskPlan(
      {
        toolName: 'tlon_agent_task_plan',
        result: { content: [{ type: 'text', text: '✓ First plan sent' }] },
      },
      toolContext
    );
    const secondContext = { ...toolContext, runId: 'run-2' };
    recordSuccessfulAgentTaskPlan(
      {
        toolName: 'tlon_agent_task_plan',
        result: { content: [{ type: 'text', text: '✓ Second plan sent' }] },
      },
      secondContext
    );

    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(
        {
          payload: { text: 'First' },
          kind: 'final',
          channel: 'tlon',
          runId: 'run-1',
        },
        toolContext
      )
    ).toBeDefined();
    expect(
      suppressReplyAfterSuccessfulAgentTaskPlan(
        {
          payload: { text: 'Second' },
          kind: 'final',
          channel: 'tlon',
          sessionKey: toolContext.sessionKey,
        },
        { channelId: 'tlon', sessionKey: toolContext.sessionKey }
      )
    ).toBeDefined();
  });
});

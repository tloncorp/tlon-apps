import { beforeEach, describe, expect, it } from 'vitest';

import {
  _testing,
  assertTlonTaskPlanCallCurrent,
  claimTlonChoiceCall,
  claimTlonTaskPlanCall,
  finishTlonTaskPlanCall,
  getTlonSessionSurface,
  getTlonSessionRunSurface,
  getTlonChoiceEvidence,
  getTlonTaskPlanEvidence,
  onboardingToolBlockReason,
  rememberTlonSessionRunSurface,
  rememberTlonInterviewStart,
  setTlonSessionSurface,
} from './onboarding-tool-boundary.js';

describe('onboarding tool boundary', () => {
  beforeEach(() => _testing.clearAll());

  it('blocks typed onboarding tools in a direct message', () => {
    const surface = {
      kind: 'direct' as const,
      bootstrapComplete: false,
      timestamp: Date.now(),
    };
    expect(
      onboardingToolBlockReason('tlon_agent_choice', {}, surface)
    ).toContain('only in the active Tlonbot group');
    expect(
      onboardingToolBlockReason('tlon_agent_task_plan', {}, surface)
    ).toContain('only in the active Tlonbot group');
    expect(
      onboardingToolBlockReason('tlon_agent_service_setup', {}, surface)
    ).toContain('only in the active Tlonbot group');
    expect(
      onboardingToolBlockReason('tlon_agent_choice', {}, surface)
    ).toContain('choose +, then New Tlonbot group');
  });

  it('requires the typed tool target to match the active group channel', () => {
    const surface = {
      kind: 'group' as const,
      channelNest: 'chat/~zod/real-group',
      bootstrapComplete: false,
      timestamp: Date.now(),
    };
    expect(
      onboardingToolBlockReason(
        'tlon_agent_choice',
        { target: 'chat/~zod/invented-group' },
        surface
      )
    ).toContain('must match');
    expect(
      onboardingToolBlockReason(
        'tlon_agent_choice',
        { target: 'chat/~zod/real-group' },
        surface
      )
    ).toBeUndefined();
    expect(
      onboardingToolBlockReason(
        'tlon_agent_service_setup',
        { target: 'chat/~zod/invented-group' },
        surface
      )
    ).toContain('must match');
  });

  it('blocks direct model cron calls during incomplete onboarding', () => {
    expect(
      onboardingToolBlockReason(
        'cron',
        {},
        {
          kind: 'direct',
          bootstrapComplete: false,
          timestamp: Date.now(),
        }
      )
    ).toContain('group coordinator');
    expect(
      onboardingToolBlockReason(
        'cron',
        {},
        {
          kind: 'direct',
          bootstrapComplete: false,
          timestamp: Date.now(),
        }
      )
    ).toContain('choose +, then New Tlonbot group');
    expect(
      onboardingToolBlockReason(
        'cron',
        {},
        {
          kind: 'group',
          channelNest: 'chat/~zod/onboarding',
          bootstrapComplete: false,
          timestamp: Date.now(),
        }
      )
    ).toContain('typed task-plan coordinator');
    expect(
      onboardingToolBlockReason(
        'cron',
        {},
        {
          kind: 'direct',
          bootstrapComplete: true,
          timestamp: Date.now(),
        }
      )
    ).toBeUndefined();
    expect(
      onboardingToolBlockReason(
        'cron',
        {},
        {
          kind: 'group',
          channelNest: 'chat/~zod/established',
          bootstrapComplete: true,
          timestamp: Date.now(),
        }
      )
    ).toBeUndefined();
  });

  it('shares the surface with thread session keys', () => {
    setTlonSessionSurface('agent:dev:tlon:group:chat/~zod/home', {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
    });
    expect(
      getTlonSessionSurface('agent:dev:tlon:group:chat/~zod/home:thread:170.1')
        ?.channelNest
    ).toBe('chat/~zod/home');
  });

  it('blocks a typed card from a run superseded by newer owner input', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/100',
    });
    rememberTlonSessionRunSurface('run-old', sessionKey);

    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/101',
    });

    const current = getTlonSessionSurface(sessionKey);
    const oldRun = getTlonSessionRunSurface('run-old');
    expect(
      onboardingToolBlockReason(
        'tlon_agent_task_plan',
        { target: 'chat/~zod/home' },
        current,
        oldRun
      )
    ).toContain('newer owner message');
    expect(
      onboardingToolBlockReason(
        'tlon_agent_choice',
        { target: 'chat/~zod/home' },
        current,
        oldRun
      )
    ).toContain('newer owner message');
    expect(
      onboardingToolBlockReason(
        'tlon_agent_service_setup',
        { target: 'chat/~zod/home' },
        current,
        oldRun
      )
    ).toContain('newer owner message');

    rememberTlonSessionRunSurface('run-current', sessionKey);
    expect(
      onboardingToolBlockReason(
        'tlon_agent_task_plan',
        { target: 'chat/~zod/home' },
        current,
        getTlonSessionRunSurface('run-current')
      )
    ).toBeUndefined();
  });

  it('allows only one task-plan call per run, including parallel calls', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/100',
    });
    rememberTlonSessionRunSurface('run-1', sessionKey);
    rememberTlonInterviewStart('run-1', sessionKey);

    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'call-1',
        runId: 'run-1',
        sessionKey,
      })
    ).toBeUndefined();
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'call-2',
        runId: 'run-1',
        sessionKey,
      })
    ).toContain('Only one task plan');
    expect(getTlonTaskPlanEvidence('call-1')).toEqual({
      interviewMessageId: '~owner/100',
    });

    finishTlonTaskPlanCall('call-1', false);
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'call-2',
        runId: 'run-1',
        sessionKey,
      })
    ).toBeUndefined();
  });

  it('binds each typed choice to the durable interview start', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/100',
    });
    rememberTlonSessionRunSurface('run-1', sessionKey);
    expect(
      claimTlonChoiceCall({
        toolCallId: 'choice-1',
        runId: 'run-1',
        sessionKey,
      })
    ).toBeUndefined();
    expect(getTlonChoiceEvidence('choice-1')).toEqual({
      interviewStartMessageId: '~owner/100',
    });

    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/200',
    });
    rememberTlonSessionRunSurface('run-2', sessionKey);
    expect(
      claimTlonChoiceCall({
        toolCallId: 'choice-2',
        runId: 'run-2',
        sessionKey,
      })
    ).toBeUndefined();
    expect(getTlonChoiceEvidence('choice-2')).toEqual({
      interviewStartMessageId: '~owner/100',
    });
  });

  it('allows a plan to recover its start from durable history after restart', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/200',
    });
    rememberTlonSessionRunSurface('run-2', sessionKey);
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'call-2',
        runId: 'run-2',
        sessionKey,
      })
    ).toBeUndefined();
    expect(getTlonTaskPlanEvidence('call-2')).toEqual({
      interviewMessageId: '~owner/200',
    });
  });

  it('binds a multi-turn plan to the final owner turn', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/100',
    });
    rememberTlonSessionRunSurface('run-1', sessionKey);
    rememberTlonInterviewStart('run-1', sessionKey);

    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/200',
    });
    rememberTlonSessionRunSurface('run-2', sessionKey);
    rememberTlonInterviewStart('run-2', sessionKey);
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'call-2',
        runId: 'run-2',
        sessionKey,
      })
    ).toBeUndefined();
    expect(getTlonTaskPlanEvidence('call-2')).toEqual({
      interviewMessageId: '~owner/200',
    });

    finishTlonTaskPlanCall('call-2', true);
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/300',
    });
    rememberTlonSessionRunSurface('run-3', sessionKey);
    rememberTlonInterviewStart('run-3', sessionKey);
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'call-3',
        runId: 'run-3',
        sessionKey,
      })
    ).toBeUndefined();
    expect(getTlonTaskPlanEvidence('call-3')).toEqual({
      interviewMessageId: '~owner/300',
    });
  });

  it('does not replace the durable interview start after a restart', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/200',
    });
    rememberTlonSessionRunSurface('run-2', sessionKey);
    expect(
      claimTlonChoiceCall({
        toolCallId: 'choice-after-restart',
        runId: 'run-2',
        sessionKey,
      })
    ).toBeUndefined();

    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/300',
    });
    rememberTlonSessionRunSurface('run-3', sessionKey);
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'plan-after-restart',
        runId: 'run-3',
        sessionKey,
      })
    ).toBeUndefined();
    expect(getTlonTaskPlanEvidence('plan-after-restart')).toEqual({
      interviewMessageId: '~owner/300',
    });
  });

  it('rechecks owner intent immediately before task-plan publication', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/100',
    });
    rememberTlonSessionRunSurface('run-1', sessionKey);
    rememberTlonInterviewStart('run-1', sessionKey);
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'call-1',
        runId: 'run-1',
        sessionKey,
      })
    ).toBeUndefined();

    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: false,
      messageId: '~owner/101',
    });
    expect(() => assertTlonTaskPlanCallCurrent('call-1')).toThrow(
      'newer owner message'
    );
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import {
  _testing,
  assertTlonChoiceCallCurrent,
  assertTlonTaskPlanCallCurrent,
  claimTlonChoiceCall,
  claimTlonTaskPlanCall,
  finishTlonChoiceCall,
  finishTlonTaskPlanCall,
  getTlonSessionSurface,
  getTlonSessionRunSurface,
  getTlonTaskPlanEvidence,
  onboardingToolBlockReason,
  rememberTlonSessionRunSurface,
  bindTlonInterviewStartToCurrentOwnerTurn,
  resolveTlonSessionThreadParentId,
  resolveTlonSessionOwnerMessageId,
  setTlonSessionSurface,
} from './onboarding-tool-boundary.js';

const groupSessionKey = 'agent:dev:tlon:group:chat/~zod/home';
const groupTarget = 'chat/~zod/home';

function setGroupTurn(
  messageId: string,
  overrides: Partial<Parameters<typeof setTlonSessionSurface>[1]> = {}
) {
  setTlonSessionSurface(groupSessionKey, {
    kind: 'group',
    channelNest: groupTarget,
    bootstrapComplete: false,
    messageId,
    ...overrides,
  });
}

function rememberGroupRun(
  runId: string,
  messageId: string,
  overrides: Partial<Parameters<typeof setTlonSessionSurface>[1]> = {}
) {
  setGroupTurn(messageId, overrides);
  rememberTlonSessionRunSurface(runId, groupSessionKey);
}

function claimChoice(toolCallId: string, runId: string) {
  return claimTlonChoiceCall({
    toolCallId,
    runId,
    sessionKey: groupSessionKey,
  });
}

function claimPlan(toolCallId: string, runId: string) {
  return claimTlonTaskPlanCall({
    toolCallId,
    runId,
    sessionKey: groupSessionKey,
  });
}

describe('onboarding tool boundary', () => {
  beforeEach(() => _testing.clearAll());

  it('updates onboarding freshness only from owner messages', () => {
    expect(
      resolveTlonSessionOwnerMessageId('user', '~guest/200', '~owner/100')
    ).toBe('~owner/100');
    expect(
      resolveTlonSessionOwnerMessageId('owner', '~owner/101', '~owner/100')
    ).toBe('~owner/101');
  });

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

  it('binds typed first-run tools to the owner DM and its furnished group', () => {
    const sessionKey = 'agent:dev:tlon:direct:~ten';
    setTlonSessionSurface(sessionKey, {
      kind: 'direct',
      senderRole: 'owner',
      channelNest: '~ten',
      requestedOnboardingGroupId: '~ten/workspace',
      bootstrapComplete: false,
      messageId: '~ten/100',
    });
    rememberTlonSessionRunSurface('dm-run', sessionKey);
    const surface = getTlonSessionSurface(sessionKey);
    for (const tool of [
      'tlon_agent_choice',
      'tlon_agent_task_plan',
      'tlon_agent_service_setup',
    ]) {
      expect(
        onboardingToolBlockReason(tool, { target: '~ten' }, surface)
      ).toBeUndefined();
      expect(
        onboardingToolBlockReason(tool, { target: '~other' }, surface)
      ).toContain('must match');
    }
    expect(onboardingToolBlockReason('cron', {}, surface)).toContain(
      'typed task-plan coordinator'
    );
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'dm-plan',
        runId: 'dm-run',
        sessionKey,
      })
    ).toBeUndefined();
    expect(getTlonTaskPlanEvidence('dm-plan')).toMatchObject({
      onboardingGroupId: '~ten/workspace',
      onboardingTarget: '~ten',
    });
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
    expect(
      onboardingToolBlockReason(
        'cron',
        {},
        {
          kind: 'direct',
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

  it('records a thread parent only for actual thread replies', () => {
    expect(resolveTlonSessionThreadParentId(true, '~parent/100')).toBe(
      '~parent/100'
    );
    expect(
      resolveTlonSessionThreadParentId(false, '~parent/100')
    ).toBeUndefined();
    expect(resolveTlonSessionThreadParentId(true, null)).toBeUndefined();
  });

  it('keeps typed onboarding tools out of threaded runs', () => {
    setGroupTurn('~owner/100', {
      threadParentId: '~parent/100',
    });
    rememberTlonSessionRunSurface('run-thread', groupSessionKey);

    setGroupTurn('~owner/101');

    const current = getTlonSessionSurface(groupSessionKey);
    const threadRun = getTlonSessionRunSurface('run-thread');
    for (const toolName of [
      'tlon_agent_choice',
      'tlon_agent_task_plan',
      'tlon_agent_service_setup',
    ]) {
      expect(
        onboardingToolBlockReason(
          toolName,
          { target: 'chat/~zod/home' },
          current,
          threadRun
        )
      ).toContain('main group conversation');
    }
    expect(
      onboardingToolBlockReason('unrelated_tool', {}, current, threadRun)
    ).toBeUndefined();
  });

  it('snapshots the sender role for each run', () => {
    const sessionKey = 'agent:dev:tlon:group:chat/~zod/home';
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      senderRole: 'owner',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: true,
      messageId: '~owner/100',
    });
    setTlonSessionSurface(sessionKey, {
      kind: 'group',
      senderRole: 'user',
      channelNest: 'chat/~zod/home',
      bootstrapComplete: true,
      messageId: '~owner/100',
    });
    rememberTlonSessionRunSurface('run-owner', sessionKey, {
      senderRole: 'owner',
    });

    expect(getTlonSessionRunSurface('run-owner')?.senderRole).toBe('owner');
    expect(getTlonSessionSurface(sessionKey)?.senderRole).toBe('user');
  });

  it('blocks a typed card from a run superseded by newer owner input', () => {
    rememberGroupRun('run-old', '~owner/100');
    setGroupTurn('~owner/101');

    const current = getTlonSessionSurface(groupSessionKey);
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

    rememberTlonSessionRunSurface('run-current', groupSessionKey);
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
    rememberGroupRun('run-1', '~owner/100', {
      onboardingDeviceTimezone: 'America/New_York',
    });
    bindTlonInterviewStartToCurrentOwnerTurn('run-1', groupSessionKey);

    expect(claimPlan('call-1', 'run-1')).toBeUndefined();
    expect(claimPlan('call-2', 'run-1')).toContain('Only one task plan');
    expect(getTlonTaskPlanEvidence('call-1')).toEqual({
      interviewStartMessageId: '~owner/100',
      interviewMessageId: '~owner/100',
      interviewTimezone: 'America/New_York',
    });

    finishTlonTaskPlanCall('call-1', false);
    expect(claimPlan('call-2', 'run-1')).toBeUndefined();
  });

  it('does not let a question turn also post a task plan', () => {
    rememberGroupRun('run-1', '~owner/100');

    expect(claimChoice('choice-1', 'run-1')).toBeUndefined();
    expect(claimChoice('choice-2', 'run-1')).toContain(
      'choice was already posted'
    );
    expect(claimPlan('plan-1', 'run-1')).toContain('choice was already posted');

    rememberTlonSessionRunSurface('run-2', groupSessionKey);
    expect(claimPlan('plan-2', 'run-2')).toBeUndefined();
  });

  it('allows a corrected choice after pre-publication validation fails', () => {
    rememberGroupRun('run-1', '~owner/100');

    expect(claimChoice('invalid-choice', 'run-1')).toBeUndefined();
    finishTlonChoiceCall('invalid-choice', false);
    expect(claimChoice('corrected-choice', 'run-1')).toBeUndefined();
  });

  it('keeps choices current while preserving the durable start for the plan', () => {
    rememberGroupRun('run-1', '~owner/100');
    expect(claimChoice('choice-1', 'run-1')).toBeUndefined();
    expect(() => assertTlonChoiceCallCurrent('choice-1')).not.toThrow();

    rememberGroupRun('run-2', '~owner/200');
    expect(() => assertTlonChoiceCallCurrent('choice-1')).toThrow(
      'The stale choice was not posted'
    );
    expect(claimChoice('choice-2', 'run-2')).toBeUndefined();
    expect(() => assertTlonChoiceCallCurrent('choice-2')).not.toThrow();
  });

  it('allows a plan to recover its start from durable history after restart', () => {
    rememberGroupRun('run-2', '~owner/200');
    expect(claimPlan('call-2', 'run-2')).toBeUndefined();
    expect(getTlonTaskPlanEvidence('call-2')).toEqual({
      interviewStartMessageId: '~owner/200',
      interviewMessageId: '~owner/200',
    });
  });

  it('binds a multi-turn plan to the final owner turn', () => {
    rememberGroupRun('run-1', '~owner/100');
    bindTlonInterviewStartToCurrentOwnerTurn('run-1', groupSessionKey);

    rememberGroupRun('run-2', '~owner/200');
    bindTlonInterviewStartToCurrentOwnerTurn('run-2', groupSessionKey);
    expect(claimPlan('call-2', 'run-2')).toBeUndefined();
    expect(getTlonTaskPlanEvidence('call-2')).toEqual({
      interviewStartMessageId: '~owner/100',
      interviewMessageId: '~owner/200',
    });

    finishTlonTaskPlanCall('call-2', true);
    rememberGroupRun('run-3', '~owner/300');
    bindTlonInterviewStartToCurrentOwnerTurn('run-3', groupSessionKey);
    expect(claimPlan('call-3', 'run-3')).toBeUndefined();
    expect(getTlonTaskPlanEvidence('call-3')).toEqual({
      interviewStartMessageId: '~owner/300',
      interviewMessageId: '~owner/300',
    });
  });

  it('does not replace the durable interview start after a restart', () => {
    rememberGroupRun('run-2', '~owner/200');
    expect(claimChoice('choice-after-restart', 'run-2')).toBeUndefined();

    rememberGroupRun('run-3', '~owner/300');
    expect(claimPlan('plan-after-restart', 'run-3')).toBeUndefined();
    expect(getTlonTaskPlanEvidence('plan-after-restart')).toEqual({
      interviewStartMessageId: '~owner/200',
      interviewMessageId: '~owner/300',
    });
  });

  it('rechecks owner intent immediately before task-plan publication', () => {
    rememberGroupRun('run-1', '~owner/100');
    bindTlonInterviewStartToCurrentOwnerTurn('run-1', groupSessionKey);
    expect(claimPlan('call-1', 'run-1')).toBeUndefined();

    setGroupTurn('~owner/101');
    expect(() => assertTlonTaskPlanCallCurrent('call-1')).toThrow(
      'newer owner message'
    );
  });
});

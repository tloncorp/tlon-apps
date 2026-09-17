import { beforeEach, describe, expect, it } from 'vitest';

import {
  _testing,
  getTlonSessionSurface,
  getTlonSessionRunSurface,
  onboardingToolBlockReason,
  rememberTlonSessionRunSurface,
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
});

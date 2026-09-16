import { beforeEach, describe, expect, it } from 'vitest';

import {
  _testing,
  getTlonSessionSurface,
  onboardingToolBlockReason,
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
  });

  it('blocks cron only for an incomplete first-run direct session', () => {
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
          kind: 'direct',
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
});

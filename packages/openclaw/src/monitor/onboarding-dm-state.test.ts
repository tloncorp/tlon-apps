import { describe, expect, it } from 'vitest';

import {
  ONBOARDING_DM_COMPLETE_RECHECK_MS,
  ONBOARDING_DM_NO_REQUEST_RECHECK_MS,
  OnboardingDmState,
} from './onboarding-dm-state.js';

describe('OnboardingDmState', () => {
  const dm = '~ten';

  it('knows nothing until a request or a lookup speaks', () => {
    const state = new OnboardingDmState();
    expect(state.groupFor(dm)).toBeUndefined();
    expect(state.isInactive(dm)).toBe(false);
  });

  it('remembers the group a request named', () => {
    const state = new OnboardingDmState();
    state.noteRequest(dm, '~ten/group');
    expect(state.groupFor(dm)).toBe('~ten/group');
    expect(state.isInactive(dm)).toBe(false);
  });

  it('takes a lookup that found the request as active', () => {
    const state = new OnboardingDmState();
    state.noteLookup(dm, '~ten/group');
    expect(state.groupFor(dm)).toBe('~ten/group');
  });

  it('rests after a lookup finds no request, and asks again later', () => {
    const state = new OnboardingDmState();
    const now = 1_000;
    state.noteLookup(dm, undefined, now);
    expect(state.isInactive(dm, now + 1)).toBe(true);
    expect(state.groupFor(dm)).toBeUndefined();
    expect(
      state.isInactive(dm, now + ONBOARDING_DM_NO_REQUEST_RECHECK_MS)
    ).toBe(false);
  });

  it('rests once onboarding finishes, until a new request reopens it', () => {
    const state = new OnboardingDmState();
    const now = 1_000;
    state.noteRequest(dm, '~ten/group');
    state.noteComplete(dm, now);
    expect(
      state.isInactive(dm, now + ONBOARDING_DM_COMPLETE_RECHECK_MS - 1)
    ).toBe(true);
    expect(state.groupFor(dm)).toBeUndefined();

    state.noteRequest(dm, '~ten/next');
    expect(state.isInactive(dm, now + 1)).toBe(false);
    expect(state.groupFor(dm)).toBe('~ten/next');
  });
});

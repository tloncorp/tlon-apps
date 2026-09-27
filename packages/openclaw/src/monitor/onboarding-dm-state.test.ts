import { describe, expect, it } from 'vitest';

import {
  FIRST_RUN_ONBOARDING_WINDOW_MS,
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
    const now = 1_000;
    state.noteLookup(dm, { groupId: '~ten/group', requestedAt: now }, now);
    expect(state.groupFor(dm, now + 1)).toBe('~ten/group');
  });

  it('ends first-run onboarding a day after the intro request', () => {
    const state = new OnboardingDmState();
    const requestedAt = 1_000;
    state.noteRequest(dm, '~ten/group', requestedAt);
    const lastMoment = requestedAt + FIRST_RUN_ONBOARDING_WINDOW_MS - 1;
    expect(state.groupFor(dm, lastMoment)).toBe('~ten/group');
    expect(state.lapsedGroupFor(dm, lastMoment)).toBeUndefined();

    const dayLater = requestedAt + FIRST_RUN_ONBOARDING_WINDOW_MS;
    expect(state.groupFor(dm, dayLater)).toBeUndefined();
    expect(state.lapsedGroupFor(dm, dayLater)).toBe('~ten/group');

    state.noteComplete(dm, dayLater);
    expect(state.lapsedGroupFor(dm, dayLater + 1)).toBeUndefined();
    expect(state.isInactive(dm, dayLater + 1)).toBe(true);
  });

  it('treats an old request found in history as already lapsed', () => {
    const state = new OnboardingDmState();
    const now = 10 * FIRST_RUN_ONBOARDING_WINDOW_MS;
    state.noteLookup(dm, { groupId: '~ten/group', requestedAt: 0 }, now);
    expect(state.groupFor(dm, now)).toBeUndefined();
    expect(state.lapsedGroupFor(dm, now)).toBe('~ten/group');
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

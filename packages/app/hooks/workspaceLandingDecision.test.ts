import { describe, expect, test } from 'vitest';

import {
  WORKSPACE_LANDING_TIMEOUT_MS,
  decideLanding,
} from './workspaceLandingDecision';

const LANDING = {
  groupId: '~sampel-palnet/meal-plan-abc123',
  channelId: 'chat/~sampel-palnet/kitchen-meal-plan-abc123',
};

function decide(overrides: Partial<Parameters<typeof decideLanding>[0]> = {}) {
  return decideLanding({
    landing: LANDING,
    channelId: LANDING.channelId,
    channelExists: true,
    elapsedMs: 0,
    ...overrides,
  });
}

describe('decideLanding', () => {
  test('does nothing when no landing is pending', () => {
    expect(decide({ landing: null })).toEqual({ kind: 'idle' });
  });

  test('navigates once the channel row exists', () => {
    expect(decide()).toEqual({
      kind: 'navigate',
      groupId: LANDING.groupId,
      channelId: LANDING.channelId,
    });
  });

  // The case this whole mechanism exists for: the channel was created by a
  // ship-side install and its local row has not arrived yet. Navigating now
  // would open a screen for a channel the database has never heard of.
  test('waits while the channel has not synced yet', () => {
    expect(decide({ channelExists: false })).toEqual({ kind: 'wait' });
  });

  // The handoff can be recorded before the group's kit blob has synced, in
  // which case nobody knows the conversation yet. That is a wait, not a
  // navigate to nowhere — the consumer re-resolves it from the group as sync
  // catches up.
  test('waits while the conversation is not yet known', () => {
    expect(decide({ channelId: null, channelExists: false })).toEqual({
      kind: 'wait',
    });
  });

  test('navigates once a late-resolved conversation exists', () => {
    expect(
      decide({ channelId: 'chat/~sampel-palnet/kitchen-late', elapsedMs: 500 })
    ).toEqual({
      kind: 'navigate',
      groupId: LANDING.groupId,
      channelId: 'chat/~sampel-palnet/kitchen-late',
    });
  });

  // A channel that never syncs is a real outcome — a failed install, a ship
  // that went away. Polling forever is worse than leaving the user on a
  // working chat list.
  test('gives up once the deadline passes', () => {
    expect(
      decide({ channelExists: false, elapsedMs: WORKSPACE_LANDING_TIMEOUT_MS })
    ).toEqual({ kind: 'giveUp' });
  });

  // Existence is checked before the deadline on purpose, so a channel that
  // lands on the very tick the timeout expires is still navigated to rather
  // than discarded.
  test('prefers navigating over giving up when both are true', () => {
    expect(
      decide({
        channelExists: true,
        elapsedMs: WORKSPACE_LANDING_TIMEOUT_MS * 2,
      })
    ).toMatchObject({ kind: 'navigate' });
  });

  test('honours a caller-supplied deadline', () => {
    expect(
      decide({ channelExists: false, elapsedMs: 100, timeoutMs: 50 })
    ).toEqual({ kind: 'giveUp' });
    expect(
      decide({ channelExists: false, elapsedMs: 10, timeoutMs: 50 })
    ).toEqual({ kind: 'wait' });
  });

  // Idle is checked first: with no handoff there is nothing to give up on, and
  // reporting 'giveUp' would clear a value that was never set and log a
  // timeout that never happened.
  test('reports idle rather than giving up when there is no landing', () => {
    expect(
      decide({
        landing: null,
        channelExists: false,
        elapsedMs: WORKSPACE_LANDING_TIMEOUT_MS * 10,
      })
    ).toEqual({ kind: 'idle' });
  });
});

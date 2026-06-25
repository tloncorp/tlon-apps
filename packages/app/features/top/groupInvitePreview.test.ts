import { describe, expect, test } from 'vitest';

import {
  getGroupInviteSheetState,
  isGroupInviteReady,
} from './groupInvitePreview';

// Minimal db.Group-ish factory — only the fields the gating logic reads.
const g = (over: Record<string, unknown> = {}) => ({ id: 'A', ...over }) as any;

describe('isGroupInviteReady', () => {
  test('false when missing', () =>
    expect(isGroupInviteReady(undefined)).toBe(false));
  test('false when invite unknown', () =>
    expect(isGroupInviteReady(g())).toBe(false));
  test('false when only requested', () =>
    expect(isGroupInviteReady(g({ haveRequestedInvite: true }))).toBe(false));
  test('true on haveInvite', () =>
    expect(isGroupInviteReady(g({ haveInvite: true }))).toBe(true));
  test('true when member', () =>
    expect(isGroupInviteReady(g({ currentUserIsMember: true }))).toBe(true));
});

describe('getGroupInviteSheetState', () => {
  const base = {
    selectedGroupId: 'A',
    inviteNotificationGroupId: null,
    waitElapsedForGroupId: null,
  };

  // non-notification selection → today's exact behavior
  test('non-notification with local group: open with group', () => {
    const s = getGroupInviteSheetState({ ...base, selectedGroup: g() });
    expect(s).toMatchObject({
      sheetOpen: true,
      sheetGroup: { id: 'A' },
      shouldCloseUnresolved: false,
    });
  });
  test('non-notification with no group: closed', () => {
    const s = getGroupInviteSheetState({ ...base, selectedGroup: null });
    expect(s).toMatchObject({
      sheetOpen: false,
      sheetGroup: undefined,
      shouldCloseUnresolved: false,
    });
  });

  // notification selection
  const notif = { selectedGroupId: 'A', inviteNotificationGroupId: 'A' };
  test('notification, no local row: open with spinner (no group), not closing', () => {
    const s = getGroupInviteSheetState({
      ...notif,
      selectedGroup: null,
      waitElapsedForGroupId: null,
    });
    expect(s).toMatchObject({
      sheetOpen: true,
      sheetGroup: undefined,
      shouldCloseUnresolved: false,
    });
  });
  test('notification, haveInvite: renders group', () => {
    const s = getGroupInviteSheetState({
      ...notif,
      selectedGroup: g({ haveInvite: true }),
      waitElapsedForGroupId: null,
    });
    expect(s.sheetGroup).toMatchObject({ haveInvite: true });
  });
  test('notification, member: renders group', () => {
    const s = getGroupInviteSheetState({
      ...notif,
      selectedGroup: g({ currentUserIsMember: true }),
      waitElapsedForGroupId: null,
    });
    expect(s.sheetGroup).toBeTruthy();
  });
  test('notification, requested-only/joinStatus, not elapsed: gated (spinner)', () => {
    const s = getGroupInviteSheetState({
      ...notif,
      selectedGroup: g({ haveRequestedInvite: true, joinStatus: 'joining' }),
      waitElapsedForGroupId: null,
    });
    expect(s.sheetGroup).toBeUndefined();
  });
  test('stale elapsed for A is ignored for current B', () => {
    const s = getGroupInviteSheetState({
      selectedGroupId: 'B',
      inviteNotificationGroupId: 'B',
      selectedGroup: null,
      waitElapsedForGroupId: 'A',
    });
    expect(s).toMatchObject({
      sheetOpen: true,
      sheetGroup: undefined,
      shouldCloseUnresolved: false,
    });
  });
  test('elapsed for current missing group: terminal close, no group rendered', () => {
    const s = getGroupInviteSheetState({
      selectedGroupId: 'A',
      inviteNotificationGroupId: 'A',
      selectedGroup: null,
      waitElapsedForGroupId: 'A',
    });
    expect(s).toMatchObject({
      sheetGroup: undefined,
      shouldCloseUnresolved: true,
    });
  });
  // A metadata-only / non-invite row must NOT degrade into request/join actions.
  test('elapsed for current metadata-only (non-invite) row: terminal close, never rendered', () => {
    const s = getGroupInviteSheetState({
      selectedGroupId: 'A',
      inviteNotificationGroupId: 'A',
      selectedGroup: g(),
      waitElapsedForGroupId: 'A',
    });
    expect(s).toMatchObject({
      sheetGroup: undefined,
      shouldCloseUnresolved: true,
    });
  });
  test('elapsed for current rejected/rescinded row (haveInvite false): terminal close', () => {
    const s = getGroupInviteSheetState({
      selectedGroupId: 'A',
      inviteNotificationGroupId: 'A',
      selectedGroup: g({ haveInvite: false }),
      waitElapsedForGroupId: 'A',
    });
    expect(s).toMatchObject({
      sheetGroup: undefined,
      shouldCloseUnresolved: true,
    });
  });
  // Readiness beats the timer: a real invite that lands at/after the window still renders.
  test('elapsed but ready (haveInvite): renders group, no close', () => {
    const s = getGroupInviteSheetState({
      selectedGroupId: 'A',
      inviteNotificationGroupId: 'A',
      selectedGroup: g({ haveInvite: true }),
      waitElapsedForGroupId: 'A',
    });
    expect(s).toMatchObject({
      sheetGroup: { id: 'A' },
      shouldCloseUnresolved: false,
    });
  });
});

import type * as db from '@tloncorp/shared/db';

// Whether a group selected from a group-invite notification is "ready" to render real actions in
// the GroupPreviewSheet. Deliberately excludes `haveRequestedInvite` — a requested-access row must
// not masquerade as a landed invite. Used ONLY on the notification path, so it needs no `joinStatus`
// handling (non-notification selections never go through this).
export function isGroupInviteReady(group?: db.Group | null): boolean {
  return (
    !!group && (group.haveInvite === true || group.currentUserIsMember === true)
  );
}

export interface GroupInviteSheetStateArgs {
  selectedGroupId: string | null;
  selectedGroup?: db.Group | null;
  // The id opened from a group-invite notification (null for normal pending taps / deep links).
  inviteNotificationGroupId: string | null;
  // The id whose bounded wait has elapsed (id-keyed so a stale group-A elapsed is ignored for B).
  waitElapsedForGroupId: string | null;
}

export interface GroupInviteSheetState {
  sheetOpen: boolean;
  sheetGroup: db.Group | undefined;
  // Terminal: the bounded window elapsed for this id and the row is still not a real invite
  // (missing, metadata-only, or rejected/rescinded). Close + log; do NOT degrade to non-invite UI.
  shouldCloseUnresolved: boolean;
}

// Pure decision logic for the ChatList group-preview sheet. Notification-opened invites get the
// loading/gating/bounded-fallback treatment; every other selection reduces to today's exact
// behavior (open on a present local group, pass it straight through).
export function getGroupInviteSheetState(
  a: GroupInviteSheetStateArgs
): GroupInviteSheetState {
  const isInviteNotificationSelection =
    a.selectedGroupId != null &&
    a.selectedGroupId === a.inviteNotificationGroupId;

  // Non-notification selections reduce to today's exact behavior.
  if (!isInviteNotificationSelection) {
    return {
      sheetOpen: !!a.selectedGroup,
      sheetGroup: a.selectedGroup ?? undefined,
      shouldCloseUnresolved: false,
    };
  }

  const ready = isGroupInviteReady(a.selectedGroup);
  // Elapsed only counts when it matches the group currently shown — a stale group-A elapsed is
  // ignored for group B.
  const waitElapsed = a.waitElapsedForGroupId === a.selectedGroupId;

  return {
    sheetOpen: true, // show the loading sheet while we wait
    // Only ever hand the sheet a group that has a real invite (or membership). We must NOT render a
    // non-ready row after the timeout: GroupPreviewSheet shows Accept/Reject only when `haveInvite`
    // is true, so a metadata-only/private row would fall through to Request/Join/"secret" actions
    // and mask the routing failure.
    sheetGroup: ready ? a.selectedGroup ?? undefined : undefined,
    // Bounded terminal: window elapsed and still not a real invite → close + log.
    shouldCloseUnresolved: waitElapsed && !ready,
  };
}

import * as db from '@tloncorp/shared/db';

export function getGroupHost(groupId: string) {
  return groupId.split('/')[0];
}

/**
 * A group's roles in the order every screen lists them: admin first, then by
 * title. The ship sends them in no fixed order, so lists would otherwise
 * differ from device to device.
 */
export function sortGroupRoles<T extends Pick<db.GroupRole, 'id' | 'title'>>(
  roles: readonly T[]
): T[] {
  return [...roles].sort(
    (a, b) =>
      Number(b.id === 'admin') - Number(a.id === 'admin') ||
      (a.title ?? '').localeCompare(b.title ?? '', undefined, {
        sensitivity: 'base',
      })
  );
}

export function getPrivacyLabel(privacy?: db.Group['privacy'] | null) {
  return privacy ? privacy.charAt(0).toUpperCase() + privacy.slice(1) : '';
}

/**
 * How many members a group has. The stored roster can fall short of it (init
 * and changes keep 15 seats; only a full group sync stores the rest), so the
 * server's seat count wins, and the joined members we have stand in until a
 * count arrives. Invited ships hold no seat, so neither counts them.
 */
export function getGroupMemberCount(
  group: Pick<db.Group, 'memberCount' | 'members'>
): number {
  return (
    group.memberCount ??
    group.members?.filter((member) => member.status !== 'invited').length ??
    0
  );
}

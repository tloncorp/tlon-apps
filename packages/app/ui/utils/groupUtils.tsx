import * as db from '@tloncorp/shared/db';
import { compareShips } from '@tloncorp/shared/logic/rosterPagesSupport';

export function getGroupHost(groupId: string) {
  return groupId.split('/')[0];
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

/**
 * A big group's members as far as its pages have loaded, in page order, so
 * the list only grows at its end. Role holders and invites aren't paged that
 * way, so they all stay. Until the first page lands, the rest wait for it.
 */
export function pagedMembers(
  members: db.ChatMember[],
  {
    loadedThrough,
    awaitingFirstPage,
  }: { loadedThrough: string | null; awaitingFirstPage: boolean }
): db.ChatMember[] {
  return members
    .filter(
      (member) =>
        (member.roles?.length ?? 0) > 0 ||
        member.status === 'invited' ||
        (!awaitingFirstPage &&
          (loadedThrough === null ||
            compareShips(member.contactId, loadedThrough) <= 0))
    )
    .sort((a, b) => compareShips(a.contactId, b.contactId));
}

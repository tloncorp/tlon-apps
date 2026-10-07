import * as api from '@tloncorp/api';
import { tryParse } from '@urbit/aura';

import * as db from '../../db';
import { QueryCtx, batchEffects } from '../../db/query';
import {
  PAGED_ROSTER_THRESHOLD,
  compareShips,
} from '../../logic/rosterPagesSupport';
import { getClientGeneration } from '../session';
import { SyncCtx, syncQueue } from '../syncQueue';

export { compareShips };

export const ROSTER_PAGE_SIZE = 50;

/**
 * Whether a group's roster is too big to sync whole: it syncs with the light
 * roster instead, and its members load a page at a time.
 */
export function isRosterPaged(group: Pick<db.Group, 'memberCount'>): boolean {
  return (
    api.getDeskServesRosterPages() &&
    (group.memberCount ?? 0) > PAGED_ROSTER_THRESHOLD
  );
}

/**
 * A group's stored roster just before a fetch. Live seat and role events can
 * land while the fetch is in flight, and its older response must not undo
 * them, so the response is checked against this once it arrives.
 */
export type RosterSnapshot = {
  seats: string[];
  roles: Map<string, Set<string>>;
  count: number | null;
};

export async function snapshotRoster(
  groupId: string,
  ctx?: QueryCtx
): Promise<RosterSnapshot> {
  return {
    seats: await db.getGroupMemberIds({ groupId, seatedOnly: true }, ctx),
    roles: rolesByMember(await db.getGroupMemberRoles({ groupId }, ctx)),
    count: await db.getStoredMemberCount({ groupId }, ctx),
  };
}

/**
 * Fits members from a response fetched after `snapshot` to the live events
 * applied since: a seat removed since stays removed, and each role granted
 * or revoked since overrides what the response says.
 */
export async function fitToLiveChanges(
  groupId: string,
  snapshot: RosterSnapshot,
  members: db.ChatMember[],
  ctx: QueryCtx
): Promise<db.ChatMember[]> {
  const seatsNow = new Set(
    await db.getGroupMemberIds({ groupId, seatedOnly: true }, ctx)
  );
  const removedSince = new Set(
    snapshot.seats.filter((contactId) => !seatsNow.has(contactId))
  );
  const rolesNow = rolesByMember(
    await db.getGroupMemberRoles({ groupId }, ctx)
  );
  return members
    .filter((member) => !removedSince.has(member.contactId))
    .map((member) => {
      const before = snapshot.roles.get(member.contactId) ?? new Set();
      const now = rolesNow.get(member.contactId) ?? new Set();
      const granted = [...now].filter((roleId) => !before.has(roleId));
      const revoked = [...before].filter((roleId) => !now.has(roleId));
      if (!granted.length && !revoked.length) return member;
      const roleIds = new Set(
        (member.roles ?? [])
          .map((role) => role.roleId)
          .filter((roleId) => !revoked.includes(roleId))
      );
      granted.forEach((roleId) => roleIds.add(roleId));
      return {
        ...member,
        roles: [...roleIds].map((roleId) => ({
          groupId,
          contactId: member.contactId,
          roleId,
        })),
      };
    });
}

/**
 * Fetches one page of a big group's roster and stores it. Unfiltered, a page
 * holds every seat after the previous page's last ship up to its own, so a
 * stored seat in that range the page doesn't carry has left the group.
 */
export async function syncGroupMembersPage(
  {
    groupId,
    after,
    roleId,
    limit = ROSTER_PAGE_SIZE,
  }: {
    groupId: string;
    after?: string | null;
    roleId?: string;
    limit?: number;
  },
  ctx?: SyncCtx
): Promise<api.GroupMembersPage> {
  const generation = getClientGeneration();
  // the database follows the current client, so a page from the previous
  // one would land in the wrong account: check before every write
  const clientChanged = () => getClientGeneration() !== generation;
  // only seats and roles stored before the fetch are reconciled, so the
  // older page drops nothing a live event added while it was in flight
  const snapshot = await snapshotRoster(groupId);
  const page = await syncQueue.add('syncGroupMembersPage', ctx, () =>
    api.getGroupMembersPage({ groupId, limit, after, roleId })
  );
  if (clientChanged()) return page;
  await batchEffects('syncGroupMembersPage', async (ctx) => {
    const members = await fitToLiveChanges(
      groupId,
      snapshot,
      page.members,
      ctx
    );
    if (clientChanged()) return;
    await db.insertGroupMembersPage({ groupId, members }, ctx);
    // insertMembers logs a failed batch rather than throwing. A page whose
    // members didn't land must fail, or its cursor moves on and the page is
    // never fetched again.
    const stored = new Set(
      await db.getGroupMemberIds({ groupId, seatedOnly: true }, ctx)
    );
    const missing = members.filter((member) => !stored.has(member.contactId));
    if (missing.length) {
      throw new Error(
        `roster page stored ${members.length - missing.length} of ${members.length} members`
      );
    }
    const onPage = new Set(page.members.map((member) => member.contactId));
    if (roleId) {
      // a role page holds every holder of the role in its range, so a holder
      // stored before the fetch that it lacks has lost the role (one granted
      // since is newer than the page). It says nothing about seats.
      const lostRole = [...snapshot.roles]
        .filter(
          ([contactId, roleIds]) =>
            roleIds.has(roleId) &&
            !onPage.has(contactId) &&
            isInPage(contactId, after, page.next)
        )
        .map(([contactId]) => contactId);
      if (clientChanged()) return;
      if (lostRole.length) {
        await db.removeChatMembersFromRoles(
          { groupId, contactIds: lostRole, roleIds: [roleId] },
          ctx
        );
      }
      return;
    }
    // a page that has a next one ends at it; the last runs to the end
    const departed = snapshot.seats.filter(
      (contactId) =>
        stored.has(contactId) &&
        !onPage.has(contactId) &&
        isInPage(contactId, after, page.next)
    );
    if (clientChanged()) return;
    if (departed.length) {
      await db.removeChatMembers(
        { chatId: groupId, contactIds: departed },
        ctx
      );
    }
    // a live seat event that moved the count mid-fetch is newer than the
    // page's total, which may predate it
    const countNow = await db.getStoredMemberCount({ groupId }, ctx);
    if (clientChanged() || countNow !== snapshot.count) return;
    await db.updateGroup({ id: groupId, memberCount: page.total }, ctx);
  });
  return page;
}

function rolesByMember(rows: { contactId: string; roleId: string }[]) {
  const roles = new Map<string, Set<string>>();
  for (const { contactId, roleId } of rows) {
    roles.set(contactId, (roles.get(contactId) ?? new Set()).add(roleId));
  }
  return roles;
}

function isInPage(
  contactId: string,
  after: string | null | undefined,
  through: string | null
) {
  if (tryParse('p', contactId) === null) return false;
  if (after && compareShips(contactId, after) <= 0) return false;
  if (through && compareShips(contactId, through) > 0) return false;
  return true;
}

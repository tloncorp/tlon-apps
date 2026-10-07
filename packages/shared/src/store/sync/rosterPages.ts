import * as api from '@tloncorp/api';
import { tryParse } from '@urbit/aura';

import * as db from '../../db';
import { batchEffects } from '../../db/query';
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
  const page = await syncQueue.add('syncGroupMembersPage', ctx, () =>
    api.getGroupMembersPage({ groupId, limit, after, roleId })
  );
  // the database follows the current client; a page from the previous one
  // would land in the wrong account
  if (getClientGeneration() !== generation) return page;
  await batchEffects('syncGroupMembersPage', async (ctx) => {
    await db.insertGroupMembersPage({ groupId, members: page.members }, ctx);
    // a role page says nothing about members without that role
    if (roleId) return;
    const onPage = new Set(page.members.map((member) => member.contactId));
    const stored = await db.getGroupMemberIds(
      { groupId, seatedOnly: true },
      ctx
    );
    // a page that has a next one ends at it; the last runs to the end
    const departed = stored.filter(
      (contactId) =>
        !onPage.has(contactId) && isInPage(contactId, after, page.next)
    );
    if (departed.length) {
      await db.removeChatMembers(
        { chatId: groupId, contactIds: departed },
        ctx
      );
    }
    await db.updateGroup({ id: groupId, memberCount: page.total }, ctx);
  });
  return page;
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

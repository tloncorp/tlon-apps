import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';

const logger = createDevLogger('groupActions', true);

export async function createGroup({
  title,
  shortCode,
}: {
  title: string;
  shortCode: string;
}): Promise<{ group: db.Group; channel: db.Channel }> {
  logger.log(`${shortCode}: creating group`);
  const currentUserId = api.getCurrentUserId();
  try {
    await api.createGroup({
      title,
      shortCode,
    });

    const groupId = `${currentUserId}/${shortCode}`;

    await api.createNewGroupDefaultChannel({
      groupId,
      currentUserId,
    });

    await sync.syncNewGroup(groupId);
    await sync.syncUnreads(); // ensure current user gets registered as a member of the channel
    const group = await db.getGroup({ id: groupId });

    if (group && group.channels.length) {
      const channel = group.channels[0];
      return { group, channel };
    }

    // TODO: should we have a UserFacingError type?
    throw new Error('Something went wrong');
  } catch (e) {
    console.error(`${shortCode}: failed to create group`, e);
    throw new Error('Something went wrong');
  }
}

export async function acceptGroupInvitation(group: db.Group) {
  logger.log('accepting group invitation', group.id);
  await db.updateGroup({ id: group.id, joinStatus: 'joining' });

  try {
    await api.joinGroup(group.id);
  } catch (e) {
    console.error('Failed to accept group invitation', e);
    await db.updateGroup({ id: group.id, joinStatus: 'errored' });
  }
}

export async function rejectGroupInvitation(group: db.Group) {
  logger.log('rejecting group invitation', group.id);
  // optimistic update
  await db.deleteGroup(group.id);

  try {
    await api.rejectGroupInvitation(group.id);
  } catch (e) {
    console.error('Failed to reject group invitation', e);
    // rollback optimistic update
    await db.insertGroups({ groups: [group] });
  }
}

export async function requestGroupInvitation(group: db.Group) {
  logger.log('requesting group invitation', group.id);
  // optimistic update
  await db.updateGroup({ id: group.id, haveRequestedInvite: true });
  try {
    await api.requestGroupInvitation(group.id);
  } catch (e) {
    console.error('Failed to request group invitation', e);
    await db.updateGroup({ id: group.id, haveRequestedInvite: false });
  }
}

export async function rescindGroupInvitationRequest(group: db.Group) {
  logger.log('rejecting group invitation', group.id);
  // optimistic update
  await db.updateGroup({ id: group.id, haveRequestedInvite: false });

  try {
    await api.rescindGroupInvitationRequest(group.id);
  } catch (e) {
    console.error('Failed to rescind group invitation request', e);
    // rollback optimistic update
    await db.updateGroup({ id: group.id, haveRequestedInvite: true });
  }
}

export async function cancelGroupJoin(group: db.Group) {
  logger.log('canceling group join', group.id);
  // optimistic update
  await db.updateGroup({
    id: group.id,
    joinStatus: null,
  });

  try {
    await api.cancelGroupJoin(group.id);
  } catch (e) {
    console.error('Failed to cancel group join', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      joinStatus: 'joining',
    });
  }
}

export async function joinGroup(group: db.Group) {
  logger.log('joining group', group.id);
  // optimistic update
  await db.updateGroup({ id: group.id, joinStatus: 'joining' });

  try {
    await api.joinGroup(group.id);
  } catch (e) {
    console.error('Failed to join group', e);
    // rollback optimistic update
    await db.updateGroup({ id: group.id, joinStatus: null });
  }
}

export async function markGroupNew(group: db.Group) {
  logger.log('marking new group', group.id);
  await db.updateGroup({ id: group.id, isNew: true });
}

export async function markGroupVisited(group: db.Group) {
  logger.log('marking new group as visited', group.id);
  await db.updateGroup({ id: group.id, isNew: false });
}

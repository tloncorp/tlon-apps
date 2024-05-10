import * as api from '../api';
import * as db from '../db';

export async function acceptGroupInvitation(group: db.Group) {
  // optimistic update
  db.updateGroup({ id: group.id, inviteStatus: 'joining' });

  try {
    await api.joinGroup(group.id);
  } catch (e) {
    console.error('Failed to accept group invitation', e);
    // rollback optimistic update
    db.updateGroup({ id: group.id, inviteStatus: 'invited' });
  }
}

export async function rejectGroupInvitation(group: db.Group) {
  // optimistic update
  db.deleteGroup(group.id);

  try {
    await api.rejectGroupInvitation(group.id);
  } catch (e) {
    console.error('Failed to reject group invitation', e);
    // rollback optimistic update
    db.insertGroups([group]);
  }
}

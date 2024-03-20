import { getContacts } from '@tloncorp/shared/dist/api/contactsApi';
import {
  getGroups,
  getPinnedGroupsAndDms,
} from '@tloncorp/shared/dist/api/groupsApi';
import {
  getChannelUnreads,
  getDMUnreads,
} from '@tloncorp/shared/dist/api/unreadsApi';
import { insertContacts } from '@tloncorp/shared/dist/db/queries';

import * as db from '../db';
import { updateChannelUnreadStates } from '../db';

export const syncContacts = async () => {
  const contacts = await getContacts();
  insertContacts(contacts);
  console.log('Synced', contacts.length, 'contacts');
};

export const syncUnreads = async () => {
  const [channelUnreads, dmUnreads] = await Promise.all([
    getChannelUnreads(),
    getDMUnreads(),
  ]);

  updateChannelUnreadStates(channelUnreads);
  db.createBatch('Unread', channelUnreads, db.UpdateMode.All);
  db.createBatch('Unread', dmUnreads, db.UpdateMode.All);
  console.log('Synced', channelUnreads.length + dmUnreads.length, 'unreads');
};

export const syncGroups = async () => {
  const groups = await getGroups({ includeMembers: true });
  db.batch(() => {
    for (const { channels, ...group } of groups) {
      const createdGroup = db.create('Group', group);
      for (const channel of channels || []) {
        db.create('Channel', { ...channel, group: createdGroup });
      }
    }
  });
  console.log('Synced', groups.length, 'groups');
};

export const syncPinnedGroups = async () => {
  const pinnedGroups = await getPinnedGroupsAndDms();
  db.updatePinnedGroups(pinnedGroups);
};

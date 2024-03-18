import * as db from '../db';
// import { updateChannelUnreadStates } from '../db';
// import { getUnreadChannels } from './channelsApi';
import { getContacts } from './contactsApi';
import { getGroups, getPinnedGroupsAndDms } from './groupsApi';
import { getChannelUnreads, getDMUnreads } from './unreadsApi';

export const syncContacts = async () => {
  const contacts = await getContacts();
  db.createBatch('Contact', contacts, db.UpdateMode.All);
  console.log('Synced', contacts.length, 'contacts');
};

export const syncUnreads = async () => {
  const channelUnreads = await getChannelUnreads();
  const dmUnreads = await getDMUnreads();
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

// TODO: unifty with other syncUnreads
// export const syncUnreads = async () => {
//   const unreads = await getUnreadChannels();
//   updateChannelUnreadStates(unreads);
// };

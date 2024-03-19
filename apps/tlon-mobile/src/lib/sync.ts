import * as db from '../db';
import { insertContacts } from '@tloncorp/shared/dist/db/queries';
import { getContacts } from './contactsApi';
import { getChannelUnreads, getDMUnreads } from './unreadsApi';

export const syncContacts = async () => {
  const contacts = await getContacts();
  insertContacts(contacts);
  console.log('Synced', contacts.length, 'contacts');
};

export const syncUnreads = async () => {
  const [
    channelUnreads,
    dmUnreads,
  ] = await Promise.all([
    getChannelUnreads(),
    getDMUnreads(),
  ]);
  db.createBatch('Unread', channelUnreads, db.UpdateMode.All);
  db.createBatch('Unread', dmUnreads, db.UpdateMode.All);
  console.log('Synced', channelUnreads.length + dmUnreads.length, 'unreads');
};

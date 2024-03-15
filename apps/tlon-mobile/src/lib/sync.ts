import * as db from '../db';
import { getContacts } from './contactsApi';
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

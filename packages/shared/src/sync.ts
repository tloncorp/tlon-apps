import {
  getChannelUnreads,
  getContacts,
  getDMUnreads,
  getGroups,
  getPinnedItems,
} from './api';
import { getPostsForChannel } from './api/postsApi';
import * as db from './db';

export const syncContacts = async () => {
  const contacts = await getContacts();
  console.log('loaded', Object.keys(contacts).length, 'contacts');
  await db.insertContacts(contacts);
  console.log('Synced', contacts.length, 'contacts');
};

export const syncUnreads = async () => {
  console.log('Sync unreads');
  try {
    const [channelUnreads, dmUnreads] = await Promise.all([
      getChannelUnreads(),
      getDMUnreads(),
    ]);
    await db.insertUnreads(channelUnreads);
    await db.insertUnreads(dmUnreads);
  } catch (e) {
    console.log('sync fail', e);
  }
};

export const syncGroups = async () => {
  const groups = await getGroups({ includeMembers: true });
  await db.insertGroups(groups);
  console.log('Synced', groups.length, 'groups');
};

export const syncPinnedItems = async () => {
  const pinnedGroups = await getPinnedItems();
  db.insertPinnedItems(pinnedGroups);
};

export const syncPostsForChannel = async ({
  nest,
  pageSize,
  initialTime,
  olderThanTime,
  newerThanTime,
}: {
  nest: string;
  pageSize?: number;
  initialTime?: string;
  olderThanTime?: string;
  newerThanTime?: string;
}) => {
  const posts = await getPostsForChannel({
    nest,
    pageSize,
    initialTime,
    olderThanTime,
    newerThanTime,
  });

  db.insertPosts(posts);
};

import { formatDa, unixToDa } from '@urbit/aura';

import * as db from '../db';
import * as ub from '../urbit';
import { toClientUnreads } from './activityApi';
import { contactToClientProfile } from './contactsApi';
import { toClientGroups } from './groupsApi';
import { toPostsData } from './postsApi';
import { checkIsNodeBusy, scry } from './urbit';

export async function fetchChangesSince(
  timestamp: number
): Promise<
  db.ChangesResult & { nodeBusyStatus: 'available' | 'busy' | 'unknown' }
> {
  const nodeIsBusy = checkIsNodeBusy();
  const encodedTimestamp = formatDa(unixToDa(timestamp));
  const response = await scry<ub.Changes>({
    app: 'groups-ui',
    path: `/v6/changes/${encodedTimestamp}`,
  });

  const groups = toClientGroups(response.groups, true);

  const channelPosts = Object.entries(response.channels).flatMap(
    ([channelId, posts]) => (posts ? toPostsData(channelId, posts).posts : [])
  );

  const deletedChannelIds = Object.entries(response.channels).reduce<string[]>(
    (accum, [channelId, data]) => {
      if (data === null) {
        accum.push(channelId);
      }
      return accum;
    },
    []
  );
  console.log(`bl: found deleted channels`, deletedChannelIds);

  const chatPosts = Object.entries(response.chat).flatMap(([chatId, posts]) =>
    posts ? toPostsData(chatId, posts).posts : []
  );

  const posts = [...channelPosts, ...chatPosts];

  const contacts = Object.entries(response.contacts)
    .filter(([_id, entry]) => entry)
    .map(([id, contactEntry]) => contactToClientProfile(id, contactEntry));

  console.log(`bl: contact changes`, contacts);

  const unreads = toClientUnreads(response.activity);

  const nodeBusyStatus = await Promise.race([nodeIsBusy, timedOutDefault(500)]);

  console.log(`bl: found posts`, posts);

  return {
    groups,
    posts,
    contacts,
    unreads,
    nodeBusyStatus,
    deletedChannelIds,
  };
}

// We want to avoid the UX of waiting too long for the busy check to return. It's served by the runtime,
// so should in theory always be quicker. But adding a timeout race to be safe.
async function timedOutDefault(ms: number): Promise<'unknown'> {
  return new Promise((resolve) => setTimeout(() => resolve('unknown'), ms));
}

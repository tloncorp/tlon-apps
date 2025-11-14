import { render, da } from '@urbit/aura';

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
  const encodedTimestamp = render('da', da.fromUnix(timestamp));
  const response = await scry<ub.Changes>({
    app: 'groups-ui',
    path: `/v6/changes/${encodedTimestamp}`,
  });

  const nodeBusyStatus = await Promise.race([nodeIsBusy, timedOutDefault(500)]);

  const changes = parseChanges(response);

  return { ...changes, nodeBusyStatus };
}

export function parseChanges(input: ub.Changes): db.ChangesResult {
  const groups = toClientGroups(input.groups, true);

  const channelPosts = Object.entries(input.channels).flatMap(
    ([channelId, posts]) => (posts ? toPostsData(channelId, posts).posts : [])
  );

  const deletedChannelIds = Object.entries(input.channels).reduce<string[]>(
    (accum, [channelId, data]) => {
      if (data === null) {
        accum.push(channelId);
      }
      return accum;
    },
    []
  );

  const chatPosts = Object.entries(input.chat).flatMap(([chatId, posts]) =>
    posts ? toPostsData(chatId, posts).posts : []
  );

  const posts = [...channelPosts, ...chatPosts];

  const contacts = Object.entries(input.contacts)
    .filter(([_id, entry]) => entry)
    .map(([id, contactEntry]) => contactToClientProfile(id, contactEntry));

  const unreads = toClientUnreads(input.activity);

  return { groups, posts, contacts, unreads, deletedChannelIds };
}

// We want to avoid the UX of waiting too long for the busy check to return. It's served by the runtime,
// so should in theory always be quicker. But adding a timeout race to be safe.
async function timedOutDefault(ms: number): Promise<'unknown'> {
  return new Promise((resolve) => setTimeout(() => resolve('unknown'), ms));
}

import { da, render } from '@urbit/aura';

import type * as db from '../types/models';
import * as ub from '../urbit';
import { toClientUnreads } from './activityApi';
import { contactToClientProfile } from './contactsApi';
import { toClientGroups } from './groupsApi';
import { toPostsData } from './postsApi';
import {
  checkIsNodeBusyWithHints,
  getActivitySupportsNotes,
  getGroupsSupportsBlob,
  scry,
} from './urbit';

export async function fetchChangesSince(timestamp: number): Promise<
  db.ChangesResult & {
    nodeBusyStatus: 'available' | 'busy' | 'unknown';
    hints?: string;
  }
> {
  const busyResult = await checkIsNodeBusyWithHints();
  const encodedTimestamp = render('da', da.fromUnix(timestamp));
  // /v11 embeds the group blob; /v10 is v10-native activity (notebook/note
  // sources) without it; /v8 embeds the v4 conversion, which drops them.
  // Only request what the backend is known to support.
  const changesVersion = getGroupsSupportsBlob()
    ? 'v11'
    : getActivitySupportsNotes()
      ? 'v10'
      : 'v8';
  const response = await scry<ub.ChangesV11>({
    app: 'groups-ui',
    path: `/${changesVersion}/changes/${encodedTimestamp}`,
  });

  const nodeBusyStatus = await Promise.race([busyResult, timedOutDefault(500)]);

  const changes = parseChanges(response);

  return { ...changes, ...nodeBusyStatus };
}

export function parseChanges(input: ub.ChangesV11): db.ChangesResult {
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

  const posts = [...channelPosts, ...chatPosts].flatMap((post) => [
    post,
    ...((post.replies || []) as db.Post[]),
  ]);

  const contacts = Object.entries(input.contacts)
    .filter(([_id, entry]) => entry)
    .map(([id, contactEntry]) => contactToClientProfile(id, contactEntry));

  const unreads = toClientUnreads(input.activity);

  return { groups, posts, contacts, unreads, deletedChannelIds };
}

// We want to avoid the UX of waiting too long for the busy check to return. It's served by the runtime,
// so should in theory always be quicker. But adding a timeout race to be safe.
async function timedOutDefault(
  ms: number
): Promise<{ nodeBusyStatus: 'unknown' }> {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ nodeBusyStatus: 'unknown' }), ms)
  );
}

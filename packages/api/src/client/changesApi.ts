import { da, render } from '@urbit/aura';

import type * as db from '../types/models';
import * as ub from '../urbit';
import { toClientUnreads } from './activityApi';
import { contactToClientProfile } from './contactsApi';
import { toClientGroupsV7 } from './groupsApi';
import { toPostsData } from './postsApi';
import {
  checkIsNodeBusyWithHints,
  getActivitySupportsNotes,
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
  const [response, notesActivity] = await Promise.all([
    scry<ub.ChangesV8>({
      app: 'groups-ui',
      path: `/v8/changes/${encodedTimestamp}`,
    }),
    // groups-ui embeds v4-converted activity, which drops notebook/note
    // sources — fetch the v10-native changes directly when the backend
    // supports them so incremental sync recovers note unreads too. a
    // failure here must fail the whole fetch: inserting the partial
    // groups-ui activity would advance the changes cursor past note
    // updates that would then never be retried
    getActivitySupportsNotes()
      ? scry<ub.Activity>({
          app: 'activity',
          path: `/v6/activity/changes/${encodedTimestamp}`,
        })
      : Promise.resolve(null),
  ]);

  const nodeBusyStatus = await Promise.race([busyResult, timedOutDefault(500)]);

  const changes = parseChanges(
    notesActivity ? { ...response, activity: notesActivity } : response
  );

  return { ...changes, ...nodeBusyStatus };
}

export function parseChanges(input: ub.ChangesV8): db.ChangesResult {
  const groups = toClientGroupsV7(input.groups, true);

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

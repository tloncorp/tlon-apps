import { da, render } from '@urbit/aura';

import type * as db from '../types/models';
import * as ub from '../urbit';
import { toClientUnreads } from './activityApi';
import { contactToClientProfile } from './contactsApi';
import { toClientGroups } from './groupsApi';
import { toPostsData } from './postsApi';
import { type SpinErrorClass, scry, startSpinHintCheck } from './urbit';

export const SPIN_HINT_GRACE_MS = 500;

export async function fetchChangesSince(timestamp: number): Promise<
  db.ChangesResult & {
    nodeBusyStatus: 'available' | 'busy' | 'unknown';
    hints?: string;
    spinOutcome: 'hint' | 'grace_expired' | 'failed' | 'unavailable';
    spinDurationMs: number;
    spinErrorClass?: SpinErrorClass;
  }
> {
  const spin = startSpinHintCheck();
  try {
    const encodedTimestamp = render('da', da.fromUnix(timestamp));
    // /v11/changes is /v10 plus the group blob: v10-native activity (notebook/
    // note sources, which the v4 conversion drops) over v11 groups.
    const response = await scry<ub.ChangesV11>({
      app: 'groups-ui',
      path: `/v11/changes/${encodedTimestamp}`,
    });
    const spinResult = await spin.settleWithin(SPIN_HINT_GRACE_MS);

    return {
      ...parseChanges(response),
      nodeBusyStatus: spinResult.nodeBusyStatus,
      ...(spinResult.outcome === 'hint' && spinResult.hints
        ? { hints: spinResult.hints }
        : {}),
      spinOutcome: spinResult.outcome,
      spinDurationMs: spinResult.durationMs,
      ...(spinResult.outcome === 'failed'
        ? { spinErrorClass: spinResult.errorClass }
        : {}),
    };
  } finally {
    spin.cancel();
  }
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

import { formatDa, unixToDa } from '@urbit/aura';

import * as db from '../db';
import * as ub from '../urbit';
import { toClientGroups } from './groupsApi';
import { toPostsData } from './postsApi';
import { poke, scry, subscribeOnce } from './urbit';

export async function fetchChangesSince(timestamp: number) {
  const encodedTimestamp = formatDa(unixToDa(timestamp));
  const response = await scry<ub.Changes>({
    app: 'groups-ui',
    path: `/v5/changes/${encodedTimestamp}`,
  });

  const groups = toClientGroups(response.groups, true);
  const posts = Object.entries(response.channels).flatMap(
    ([channelId, posts]) => toPostsData(channelId, posts).posts
  );

  return { groups, posts };
}

import * as db from '@tloncorp/shared/db';

import { fixturePosts } from './contentHelpers';
import { group, groupWithNoColorOrImage } from './fakeData';

export async function seedCosmosDb() {
  try {
    await db.insertGroups({ groups: [group, groupWithNoColorOrImage] });
    await db.insertChannelPosts({ posts: fixturePosts });
  } catch (e) {
    console.warn('cosmos: failed to seed fixture data', e);
  }
}

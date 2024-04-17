import { udToDec } from '@urbit/api';

import * as db from '../db';

export function getPostReferencePath(post: db.PostInsert) {
  return `/1/chan/${post.channelId}/msg/${udToDec(post.id)}`;
}

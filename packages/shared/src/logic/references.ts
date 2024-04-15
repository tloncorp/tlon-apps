import * as db from '../db';

export function getPostReferencePath(post: db.PostInsert) {
  // TODO: confirm correct
  return `/1/chan/${post.channelId}/msg/${post.id}`;
}

import { udToDec } from '@urbit/api';

import { ContentReference } from '../api';
import * as db from '../db';

export function getPostReferencePath(post: db.Post) {
  if (post.parentId) {
    return `/1/chan/${post.channelId}/msg/${udToDec(post.parentId)}/${udToDec(post.id)}`;
  }
  return `/1/chan/${post.channelId}/msg/${udToDec(post.id)}`;
}

export function getGroupReferencePath(groupId: string) {
  return `/1/group/${groupId}`;
}

export function postToContentReference(
  post: db.Post
): [path: string, reference: ContentReference] {
  const path = getPostReferencePath(post);
  return [
    path,
    {
      referenceType: 'channel',
      type: 'reference',
      postId: post.id,
      channelId: post.channelId,
    },
  ];
}

import * as db from '../db';
import { ContentReference } from '../domain';
import { parseIdNumber } from '../api/apiUtils';

function formatId(id: string) {
  return parseIdNumber(id).toString();
}

export function getPostReferencePath(post: db.Post) {
  if (post.parentId) {
    return `/1/chan/${post.channelId}/msg/${formatId(post.parentId)}/${formatId(post.id)}`;
  }
  return `/1/chan/${post.channelId}/msg/${formatId(post.id)}`;
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

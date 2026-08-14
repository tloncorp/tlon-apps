import type * as db from '../types/models';
import type { ContentReference } from '../types/references';
import { parseIdNumber } from '../urbit/utils';

function formatId(id: string) {
  return parseIdNumber(id).toString();
}

// The "display id" for a post reference: the reply's own id when the reference
// points at a reply, otherwise the (top-level) post id. This is the id under
// which the hydrated post is fetched, cached, and read back, so it must be
// computed identically everywhere it's used.
export function referenceLookupId({
  postId,
  replyId,
}: {
  postId: string;
  replyId?: string;
}): string {
  return replyId ?? postId;
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

export function getNoteReferencePath(
  channelId: string,
  noteId: string | number
) {
  return `/1/chan/${channelId}/note/${noteId}`;
}

export function noteToContentReference(
  channelId: string,
  noteId: string | number
): [path: string, reference: ContentReference] {
  return [
    getNoteReferencePath(channelId, noteId),
    {
      type: 'reference',
      referenceType: 'note',
      channelId,
      noteId: String(noteId),
    },
  ];
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
      // For a reply, postId is the parent/top-level id and replyId the reply's
      // own id, matching the postId=parent / replyId=reply contract used by the
      // hydration path. Top-level posts carry only postId.
      ...(post.parentId
        ? { postId: post.parentId, replyId: post.id }
        : { postId: post.id }),
      channelId: post.channelId,
    },
  ];
}

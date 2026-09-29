import * as db from '../../db';
import * as sync from '../sync';
import { SyncPriority } from '../syncQueue';
import { CursorNormalizationError } from './cursorError';

export type CursorPageParam = db.GetSequencedPostsOptions & {
  cursorPostId?: string | null;
};

/*
  We want to operate on sequence numbers, but our unread markers are keyed by postId.
  This encapsulate the logic for obtaining a sequence based cursor.
*/
export async function normalizeCursor(
  options: CursorPageParam
): Promise<CursorPageParam> {
  // only attempt to transform if we have a postId shaped cursor
  if (!options.cursorPostId) {
    return options;
  }

  // first check locally to see if we already have the post
  const cursorPost = await db.getPost({
    postId: options.cursorPostId,
  });
  if (
    cursorPost &&
    cursorPost.sequenceNum != null &&
    cursorPost.sequenceNum > 0
  ) {
    return {
      ...options,
      cursorPostId: null,
      cursorSequenceNum: cursorPost.sequenceNum,
    };
  }

  // if not, grab it from the API. Proactively snag surrounding posts while we're there
  const response = await sync.syncPosts(
    {
      channelId: options.channelId,
      cursor: options.cursorPostId,
      mode: 'around',
      count: options.count,
    },
    { priority: SyncPriority.High }
  );

  const syncedCursorPost = await db.getPost({
    postId: options.cursorPostId,
  });

  if (
    syncedCursorPost &&
    syncedCursorPost.sequenceNum != null &&
    syncedCursorPost.sequenceNum > 0
  ) {
    return {
      ...options,
      cursorPostId: null,
      cursorSequenceNum: syncedCursorPost.sequenceNum,
    };
  }

  const returnedAnchor =
    response.posts.find((p) => p.id === options.cursorPostId) ??
    response.deletedPosts?.find((p) => p.id === options.cursorPostId);
  throw new CursorNormalizationError(options.channelId, {
    cursorPostId: options.cursorPostId,
    before: describeAnchor(cursorPost),
    returned: describeAnchor(returnedAnchor),
    after: describeAnchor(syncedCursorPost),
    fetchedPostCount: response.posts.length,
    fetchedDeletedCount: response.deletedPosts?.length ?? 0,
  });
}

function describeAnchor(
  post: Pick<db.Post, 'sequenceNum' | 'isDeleted'> | null | undefined
) {
  return {
    present: !!post,
    sequenceNum: post?.sequenceNum ?? null,
    isDeleted: !!post?.isDeleted,
  };
}

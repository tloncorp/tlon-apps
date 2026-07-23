import { usePostWithRelations } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';

export const useLivePost = (initialPost: db.Post): db.Post => {
  const { data: updatedPost } = usePostWithRelations(
    { id: initialPost.id },
    initialPost
  );
  return updatedPost ?? initialPost;
};

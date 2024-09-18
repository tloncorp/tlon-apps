import PostScreen from '@tloncorp/app/features/top/PostScreen';
import { usePostWithThreadUnreads } from '@tloncorp/shared/dist';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';

export function PostScreenController() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { data: post } = usePostWithThreadUnreads({ id: postId ?? '' });

  const handleGoToUserProfile = useCallback((userId: string) => {
    // TODO: Implement profile on web.
    // props.navigation.push('UserProfile', { userId });
  }, []);

  if (!post) {
    return null;
  }

  return (
    <PostScreen
      handleGoToUserProfile={handleGoToUserProfile}
      postParam={post}
      goBack={() => navigate(-1)}
    />
  );
}

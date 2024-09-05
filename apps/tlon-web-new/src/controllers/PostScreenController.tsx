import PostScreen from '@tloncorp/app/features/top/PostScreen';
import { usePostWithThreadUnreads } from '@tloncorp/shared/dist';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';

export function PostScreenController(props: { navigation: any }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { data: post } = usePostWithThreadUnreads({ id: postId ?? '' });

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.push('UserProfile', { userId });
    },
    [props.navigation]
  );

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

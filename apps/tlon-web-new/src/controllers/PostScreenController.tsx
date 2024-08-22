import PostScreen from '@tloncorp/app/features/top/PostScreen';
import { usePostWithThreadUnreads } from '@tloncorp/shared/dist';
import { useNavigate, useParams } from 'react-router';

export function PostScreenController() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { data: post } = usePostWithThreadUnreads({ id: postId ?? '' });

  if (!post) {
    return null;
  }

  return <PostScreen postParam={post} goBack={() => navigate(-1)} />;
}

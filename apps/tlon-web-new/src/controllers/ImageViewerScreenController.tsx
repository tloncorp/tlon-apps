import ImageViewerScreen from '@tloncorp/app/features/top/ImageViewerScreen';
import { useNavigate, useParams } from 'react-router';

export default function ImageViewerScreenController() {
  const navigate = useNavigate();
  const { postId, uri } = useParams();
  const decodedUri = decodeURIComponent(uri ?? '');

  return (
    <ImageViewerScreen
      postId={postId ?? ''}
      uri={decodedUri}
      goBack={() => navigate(-1)}
    />
  );
}

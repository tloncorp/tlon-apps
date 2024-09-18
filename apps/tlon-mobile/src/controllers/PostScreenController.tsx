import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PostScreen from '@tloncorp/app/features/top/PostScreen';
import { useCallback } from 'react';

import type { RootStackParamList } from '../types';

type PostScreenControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'Post'
>;

export function PostScreenController(props: PostScreenControllerProps) {
  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.push('UserProfile', { userId });
    },
    [props.navigation]
  );

  return (
    <PostScreen
      handleGoToUserProfile={handleGoToUserProfile}
      postParam={props.route.params.post}
      goBack={props.navigation.goBack}
    />
  );
}

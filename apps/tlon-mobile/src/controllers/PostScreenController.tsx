import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PostScreen from '@tloncorp/app/features/top/PostScreen';

import type { RootStackParamList } from '../types';

type PostScreenControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'Post'
>;

export function PostScreenController(props: PostScreenControllerProps) {
  return (
    <PostScreen
      postParam={props.route.params.post}
      goBack={props.navigation.goBack}
    />
  );
}

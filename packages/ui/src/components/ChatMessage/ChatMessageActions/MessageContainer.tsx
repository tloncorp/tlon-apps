import { getSize } from '@tamagui/get-token';
import * as db from '@tloncorp/shared/dist/db';
import { Dimensions } from 'react-native';

import { View } from '../../../core';
import ChatMessage from '../ChatMessage';

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;
export function MessageContainer({
  post,
  currentUserId,
}: {
  post: db.Post;
  currentUserId: string;
}) {
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  return (
    <View
      maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO}
      maxWidth={screenWidth - getSize('$xl').val * 2}
      overflow="hidden"
      backgroundColor="$background"
      padding="$l"
      borderRadius="$l"
    >
      <ChatMessage post={post} currentUserId={currentUserId} />
    </View>
  );
}

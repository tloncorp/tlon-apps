import { getSize } from '@tamagui/get-token';
import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Dimensions } from 'react-native';
import { View } from 'tamagui';

import ChatMessage from '../ChatMessage/ChatMessage';
import AuthorRow from '../../AuthorRow';

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;

export function MessageContainer({ post }: { post: db.Post }) {
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const isWindowNarrow = useIsWindowNarrow();
  const width = isWindowNarrow ? screenWidth - getSize('$xl').val * 2 : 400;

  return (
    <View
      maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO}
      maxWidth={width}
      overflow="hidden"
      backgroundColor={isWindowNarrow ? '$background' : '$secondaryBackground'}
      padding="$l"
      borderRadius="$l"
    >
      <AuthorRow
        author={post.author}
        authorId={post.authorId}
        sent={post.sentAt ?? 0}
        type={post.type}
        // roles={roles}
      />
      <ChatMessage post={post} hideOverflowMenu />
    </View>
  );
}

import { getSize } from '@tamagui/get-token';
import * as db from '@tloncorp/shared/dist/db';
import { Dimensions } from 'react-native';
import { ScrollView, View } from 'tamagui';

import { ChatMessage } from '..';
import AuthorRow from '../../AuthorRow';
import { NotebookPost } from '../../NotebookPost';

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;
const MAX_MESSAGE_TO_SCREEN_RATIO_NOTE = 0.5;

export function MessageContainer({ post }: { post: db.Post }) {
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  if (post.type === 'note') {
    return (
      <ScrollView
        maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO_NOTE}
        overflow="hidden"
        backgroundColor="$background"
        padding="$l"
        borderRadius="$l"
      >
        <NotebookPost showAuthor={false} size="$s" post={post} />
      </ScrollView>
    );
  }

  return (
    <View
      maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO}
      maxWidth={screenWidth - getSize('$xl').val * 2}
      overflow="hidden"
      backgroundColor="$background"
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
      <ChatMessage post={post} />
    </View>
  );
}

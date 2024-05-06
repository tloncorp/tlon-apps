import { getSize } from '@tamagui/get-token';
import * as db from '@tloncorp/shared/dist/db';
import { Dimensions } from 'react-native';

import { ChatMessage } from '..';
import { ScrollView, View } from '../../../core';
import { NotebookPost } from '../../NotebookPost';
import AuthorRow from '../AuthorRow';

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;
const MAX_MESSAGE_TO_SCREEN_RATIO_NOTE = 0.5;

export function MessageContainer({
  post,
  currentUserId,
}: {
  post: db.Post;
  currentUserId: string;
}) {
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
        <NotebookPost
          showAuthor={false}
          smallImage
          smallTitle
          post={post}
          currentUserId={currentUserId}
          showReplies={false}
        />
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
        // roles={roles}
      />
      <ChatMessage post={post} currentUserId={currentUserId} />
    </View>
  );
}

import { getSize } from '@tamagui/get-token';
import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Dimensions } from 'react-native';
import { ScrollView, View } from 'tamagui';

import AuthorRow from '../../AuthorRow';
import { NotebookPostContent } from '../../NotebookPost/NotebookPostContent';
import { NotebookPostFrame } from '../../NotebookPost/shared';
import { MaskedChatMessage } from '../../PostModerationSwitch';
import { StaticChatMessage } from '../StaticChatMessage';

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;
const MAX_MESSAGE_TO_SCREEN_RATIO_NOTE = 0.5;

export function MessageContainer({ post }: { post: db.Post }) {
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const isWindowNarrow = useIsWindowNarrow();
  const width = isWindowNarrow ? screenWidth - getSize('$xl').val * 2 : 400;

  if (post.type === 'note') {
    return (
      <ScrollView
        maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO_NOTE}
        overflow="hidden"
        backgroundColor="$background"
        padding="$l"
        borderRadius="$l"
        width={width}
      >
        <NotebookPostFrame>
          <NotebookPostContent post={post} showAuthor={false} />
        </NotebookPostFrame>
      </ScrollView>
    );
  }

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
      <MaskedChatMessage post={post}>
        <StaticChatMessage post={post} hideSentAtTimestamp />
      </MaskedChatMessage>
    </View>
  );
}

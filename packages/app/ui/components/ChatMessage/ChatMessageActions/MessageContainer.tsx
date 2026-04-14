import { getSize } from '@tamagui/get-token';
import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Dimensions } from 'react-native';
import { View } from 'tamagui';

import AuthorRow from '../../AuthorRow';
import { NotebookPostContent } from '../../NotebookPost/NotebookPostContent';
import { NotebookPostFrame } from '../../NotebookPost/shared';
import { PostModeration } from '../../PostModerationSwitch';
import { StaticChatMessage } from '../StaticChatMessage';

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;
const MAX_MESSAGE_TO_SCREEN_RATIO_NOTE = 0.5;

export function MessageContainer({ post }: { post: db.Post }) {
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const isWindowNarrow = useIsWindowNarrow();
  const width = isWindowNarrow ? screenWidth - getSize('$xl').val * 2 : 400;

  return (
    <View
      {...(post.type === 'note'
        ? {
            maxHeight: screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO_NOTE,
            width,
            backgroundColor: '$background',
          }
        : {
            maxHeight: screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO,
            maxWidth: width,
            backgroundColor: isWindowNarrow
              ? '$background'
              : '$secondaryBackground',
          })}
      overflow="hidden"
      padding="$l"
      borderRadius="$l"
    >
      <PostModeration
        post={post}
        disableBypassBlockedContent
        disableBypassHiddenContent
      >
        {(m) => {
          switch (m) {
            case 'deleted':
              return <PostModeration.Deleted />;
            case 'blocked':
              return <PostModeration.Blocked />;
            case 'hidden':
              return <PostModeration.Hidden />;
            case 'ok': {
              return post.type === 'note' ? (
                <NotebookPostFrame>
                  <NotebookPostContent post={post} showAuthor={false} />
                </NotebookPostFrame>
              ) : (
                <>
                  <AuthorRow
                    author={post.author}
                    authorId={post.authorId}
                    sent={post.sentAt ?? 0}
                    type={post.type}
                    // roles={roles}
                  />
                  <StaticChatMessage post={post} hideSentAtTimestamp />
                </>
              );
            }
          }
        }}
      </PostModeration>
    </View>
  );
}

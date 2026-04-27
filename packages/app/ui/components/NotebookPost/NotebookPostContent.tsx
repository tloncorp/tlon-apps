import { Text } from '@tloncorp/ui';

import type { MinimalRenderItemProps } from '../../contexts/componentsKits/componentsKits';
import { ChatMessageReplySummary } from '../ChatMessage/ChatMessageReplySummary';
import { NotebookPostHeader } from './shared';

export function NotebookPostContent({
  post,
  showDate,
  viewMode,
  showReplies,
  showAuthor,
}: Pick<MinimalRenderItemProps, 'post' | 'showReplies' | 'showAuthor'> & {
  showDate?: boolean;
  viewMode?: 'activity';
}) {
  const hasReplies = post.replyCount && post.replyTime && post.replyContactIds;
  return (
    <>
      <NotebookPostHeader
        post={post}
        showDate={showDate}
        showAuthor={showAuthor && viewMode !== 'activity'}
        testID="NotebookPostHeader"
      />

      {viewMode !== 'activity' && (
        <Text
          size="$body"
          color="$secondaryText"
          numberOfLines={3}
          paddingBottom={showReplies && hasReplies ? 0 : '$m'}
          testID="NotebookPostContentSummary"
        >
          {post.textContent}
        </Text>
      )}

      {showReplies && hasReplies ? (
        <ChatMessageReplySummary
          post={post}
          showTime={false}
          textColor="$tertiaryText"
        />
      ) : null}
    </>
  );
}

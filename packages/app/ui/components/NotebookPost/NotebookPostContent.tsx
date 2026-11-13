import { Text } from '@tloncorp/ui';

import type { MinimalRenderItemProps } from '../../contexts/componentsKits/componentsKits';
import { ChatMessageReplySummary } from '../ChatMessage/ChatMessageReplySummary';
import { ReactionsDisplay } from '../ChatMessage/ReactionsDisplay';
import { NotebookPostHeader } from './shared';
import { usePostPreviewText } from '../../hooks/useMentionText';

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
  const summary = usePostPreviewText(post);
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
          {summary}
        </Text>
      )}

      {showReplies && hasReplies ? (
        <ChatMessageReplySummary
          post={post}
          showTime={false}
          textColor="$tertiaryText"
        />
      ) : null}

      <ReactionsDisplay post={post} minimal={true} />
    </>
  );
}

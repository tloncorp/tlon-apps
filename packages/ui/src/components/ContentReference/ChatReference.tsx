import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';

import { Avatar } from '../Avatar';
import ChatContent, { PostViewMode } from '../ChatMessage/ChatContent';
import ContactName from '../ContactName';
import { Reference } from './Reference';

export default function ChatReference({
  channel,
  post,
  onPress,
  asAttachment = false,
  viewMode = 'chat',
}: {
  channel: db.Channel;
  post: db.Post;
  onPress: (channel: db.Channel, post: db.Post) => void;
  asAttachment?: boolean;
  viewMode?: PostViewMode;
}) {
  const navigateToChannel = useCallback(() => {
    if (asAttachment) {
      return;
    }
    if (channel && post) {
      onPress(channel, post);
    }
  }, [channel, onPress, post, asAttachment]);

  if (!post) {
    return null;
  }

  return (
    <Reference
      viewMode={viewMode}
      asAttachment={asAttachment}
      onPress={navigateToChannel}
    >
      <Reference.Header>
        <Reference.Title>
          <Avatar contact={post.author} contactId={post.authorId} size="$xl" />
          <ContactName
            color="$tertiaryText"
            size="$s"
            userId={post.authorId}
            showNickname
          />
        </Reference.Title>
        <Reference.Icon type="ArrowRef" />
      </Reference.Header>
      <Reference.Body>
        <ChatContent
          viewMode={viewMode}
          shortened={asAttachment || viewMode === 'block'}
          post={post}
        />
      </Reference.Body>
    </Reference>
  );
}

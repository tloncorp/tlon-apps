import * as db from '@tloncorp/shared/db';
import { useState } from 'react';

import { useBlockedAuthor } from '../../../hooks/useBlockedAuthor';
import { PostErrorMessage } from '../PostErrorMessage';

/**
 * If `post` should be hidden, renders an appropriate notice for the hidden reason.
 * Otherwise, renders `children`, which is expected to be the full message content.
 */
export function MaskedChatMessage({
  post,
  children,
}: {
  post: db.Post;
  children?: React.ReactNode;
}) {
  const { isAuthorBlocked, showBlockedContent, handleShowAnyway } =
    useBlockedAuthor(post);
  const [showHiddenContent, setShowHiddenContent] = useState(false);

  if (post.isDeleted) {
    return (
      <PostErrorMessage testID="MessageDeleted" message="Message deleted" />
    );
  } else if (post.hidden && !showHiddenContent) {
    return (
      <PostErrorMessage
        testID="MessageHidden"
        message="Message hidden or flagged."
        actionLabel="Show anyway"
        onAction={() => setShowHiddenContent(true)}
      />
    );
  } else if (isAuthorBlocked && !showBlockedContent) {
    return (
      <PostErrorMessage
        testID="MessageBlocked"
        message="Message from a blocked user."
        actionLabel="Show anyway"
        onAction={handleShowAnyway}
        actionTestID="ShowBlockedMessageButton"
      />
    );
  } else {
    return children;
  }
}

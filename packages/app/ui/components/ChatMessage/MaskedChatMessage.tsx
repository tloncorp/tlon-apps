import * as db from '@tloncorp/shared/db';
import { useMemo, useState } from 'react';

import { useBlockedAuthor } from '../../../hooks/useBlockedAuthor';
import { usePostTerminology } from '../../contexts/terminology';
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
    return <PostDeletedNotice />;
  } else if (post.hidden && !showHiddenContent) {
    return (
      <PostHiddenNotice
        onShowAnywayPressed={() => setShowHiddenContent(true)}
      />
    );
  } else if (isAuthorBlocked && !showBlockedContent) {
    return <PostBlockedNotice onShowAnywayPressed={handleShowAnyway} />;
  } else {
    return children;
  }
}

type Strings<Keys extends string> = Record<Keys, string>;

export function PostDeletedNotice() {
  const postTerm = usePostTerminology();
  const strings = useMemo<Strings<'message' | 'testId'>>(() => {
    switch (postTerm) {
      case 'message':
        return {
          message: 'Message deleted',
          testId: 'MessageDeleted',
        };
      case 'post':
        // These are not used; filling out to avoid future inaccuracies
        return {
          message: 'Post deleted',
          testId: 'PostDeleted',
        };
    }
  }, [postTerm]);

  // We don't show a notice for hidden posts (we simply hide them)
  if (postTerm === 'post') {
    return null;
  }
  return <PostErrorMessage testID={strings.testId} message={strings.message} />;
}

export function PostHiddenNotice({
  onShowAnywayPressed,
}: {
  /** If provided, renders a "Show anyway" button that calls this callback when pressed. */
  onShowAnywayPressed?: () => void;
}) {
  const postTerm = usePostTerminology();
  const strings = useMemo<
    Strings<'message' | 'testId' | 'messageWithoutAction'>
  >(() => {
    switch (postTerm) {
      case 'message':
        return {
          message: 'Message hidden or flagged.',
          messageWithoutAction: 'You have hidden or reported this message.',
          testId: 'MessageHidden',
        };
      case 'post':
        return {
          message: 'Post hidden or flagged.',
          messageWithoutAction: 'You have hidden or reported this post.',
          testId: 'PostHidden',
        };
    }
  }, [postTerm]);

  return onShowAnywayPressed == null ? (
    <PostErrorMessage message={strings.messageWithoutAction} />
  ) : (
    <PostErrorMessage
      testID={strings.testId}
      message={strings.message}
      actionLabel="Show anyway"
      onAction={onShowAnywayPressed}
    />
  );
}

export function PostBlockedNotice({
  onShowAnywayPressed,
}: {
  /** If provided, renders a "Show anyway" button that calls this callback when pressed. */
  onShowAnywayPressed?: () => void;
}) {
  const postTerm = usePostTerminology();
  const strings = useMemo<
    Strings<'message' | 'testId' | 'actionTestID'>
  >(() => {
    switch (postTerm) {
      case 'message':
        return {
          message: 'Message from a blocked user.',
          testId: 'MessageBlocked',
          actionTestID: 'ShowBlockedPostButton',
        };
      case 'post':
        return {
          message: 'Post from a blocked user.',
          testId: 'PostBlocked',
          actionTestID: 'ShowBlockedPostButton',
        };
    }
  }, [postTerm]);

  return (
    <PostErrorMessage
      testID={strings.testId}
      message={strings.message}
      {...(onShowAnywayPressed == null
        ? {}
        : {
            actionTestID: strings.actionTestID,
            actionLabel: 'Show anyway',
            onAction: onShowAnywayPressed,
          })}
    />
  );
}

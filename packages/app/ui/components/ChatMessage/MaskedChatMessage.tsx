import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo, useState } from 'react';

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
  return (
    <PostModerationSwitch post={post}>
      {(m) => {
        switch (m.type) {
          case 'deleted':
            return m.deleted;
          case 'hidden':
            return m.hidden;
          case 'blocked':
            return m.blocked;
          case 'post':
            return children;
        }
      }}
    </PostModerationSwitch>
  );
}

type Strings<Keys extends string> = Record<Keys, string>;

function PostDeletedNotice() {
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

function PostHiddenNotice({
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

function PostBlockedNotice({
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

type TypeTagged<T extends string, Payload> = { type: T } & Record<T, Payload>;

export function PostModerationSwitch({
  post,
  disableBypassBlockedContent,
  disableBypassHiddenContent,
  children,
}: {
  post: db.Post;
  disableBypassBlockedContent?: boolean;
  disableBypassHiddenContent?: boolean;
  children?: (
    moderated:
      | TypeTagged<'deleted', React.ReactNode>
      | TypeTagged<'hidden', React.ReactNode>
      | TypeTagged<'blocked', React.ReactNode>
      // after checking all other fields are null, the caller should be able to
      // safely access the unmoderated content:
      | TypeTagged<'post', db.Post>
  ) => React.ReactNode;
}) {
  const { isAuthorBlocked } = useBlockedAuthor(post);
  const [showBlockedContent, setShowBlockedContent] = useState(false);
  const [showHiddenContent, setShowHiddenContent] = useState(false);

  // reset override whenever bypass is disabled/enabled
  useEffect(() => {
    setShowHiddenContent(false);
  }, [disableBypassHiddenContent]);
  useEffect(() => {
    setShowBlockedContent(false);
  }, [disableBypassBlockedContent]);

  if (post.isDeleted) {
    return (
      children?.({ type: 'deleted', deleted: <PostDeletedNotice /> }) ?? null
    );
  } else if (post.hidden && !showHiddenContent) {
    return children?.({
      type: 'hidden',
      hidden: (
        <PostHiddenNotice
          onShowAnywayPressed={
            disableBypassHiddenContent
              ? undefined
              : () => setShowHiddenContent(true)
          }
        />
      ),
    });
  } else if (isAuthorBlocked && !showBlockedContent) {
    return children?.({
      type: 'blocked',
      blocked: (
        <PostBlockedNotice
          onShowAnywayPressed={
            disableBypassBlockedContent
              ? undefined
              : () => setShowBlockedContent(true)
          }
        />
      ),
    });
  } else {
    return children?.({ type: 'post', post }) ?? null;
  }
}

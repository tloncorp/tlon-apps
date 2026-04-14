import * as db from '@tloncorp/shared/db';
import { createContext, useContext, useMemo, useState } from 'react';

import { useBlockedAuthor } from '../../hooks/useBlockedAuthor';
import { usePostTerminology } from '../contexts/terminology';
import { PostErrorMessage } from './PostErrorMessage';

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

function PostHiddenNotice() {
  const moderationBypass = useContext(PostModerationContext);
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

  return moderationBypass.disableBypassHiddenContent ? (
    <PostErrorMessage message={strings.messageWithoutAction} />
  ) : (
    <PostErrorMessage
      testID={strings.testId}
      message={strings.message}
      actionLabel="Show anyway"
      onAction={moderationBypass.requestBypass}
    />
  );
}

function PostBlockedNotice() {
  const moderationBypass = useContext(PostModerationContext);
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
      {...(moderationBypass.disableBypassBlockedContent
        ? {}
        : {
            actionTestID: strings.actionTestID,
            actionLabel: 'Show anyway',
            onAction: moderationBypass.requestBypass,
          })}
    />
  );
}

const PostModerationContext = createContext<{
  isBypassed: boolean;
  requestBypass: () => void;
  disableBypassBlockedContent?: boolean;
  disableBypassHiddenContent?: boolean;
}>({
  isBypassed: false,
  requestBypass: () => {
    throw new Error('use a PostModerationContext provider');
  },
});

export function PostModeration({
  post,
  disableBypassBlockedContent,
  disableBypassHiddenContent,
  children,
}: {
  post: db.Post;
  disableBypassBlockedContent?: boolean;
  disableBypassHiddenContent?: boolean;
  children?: (
    moderationResult: 'deleted' | 'hidden' | 'blocked' | 'ok'
  ) => React.ReactNode;
}) {
  const { isAuthorBlocked } = useBlockedAuthor(post);
  const [moderationBypassed, setModerationBypassed] = useState(false);
  const ctxValue = useMemo(
    () => ({
      isBypassed: moderationBypassed,
      requestBypass: () => setModerationBypassed(true),
      disableBypassBlockedContent,
      disableBypassHiddenContent,
    }),
    [
      moderationBypassed,
      disableBypassBlockedContent,
      disableBypassHiddenContent,
    ]
  );
  return (
    <PostModerationContext.Provider value={ctxValue}>
      {(() => {
        if (post.isDeleted) {
          return children?.('deleted') ?? null;
        } else if (post.hidden && !moderationBypassed) {
          return children?.('hidden');
        } else if (isAuthorBlocked && !moderationBypassed) {
          return children?.('blocked');
        } else {
          return children?.('ok') ?? null;
        }
      })()}
    </PostModerationContext.Provider>
  );
}
PostModeration.Deleted = PostDeletedNotice;
PostModeration.Hidden = PostHiddenNotice;
PostModeration.Blocked = PostBlockedNotice;

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
    <PostModeration post={post}>
      {(m) => {
        switch (m) {
          case 'deleted':
            return <PostModeration.Deleted />;
          case 'hidden':
            return <PostModeration.Hidden />;
          case 'blocked':
            return <PostModeration.Blocked />;
          case 'ok':
            return children;
        }
      }}
    </PostModeration>
  );
}

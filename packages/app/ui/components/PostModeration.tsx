import * as db from '@tloncorp/shared/db';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useBlockedAuthor } from '../../hooks/useBlockedAuthor';
import { ForwardingProps } from '../utils';
import { PostErrorMessage } from './PostErrorMessage';

type Strings<Keys extends string> = Record<Keys, string>;

function PostDeletedNotice(
  props: ForwardingProps<typeof PostErrorMessage, object, 'message'>
) {
  const postModeration = usePostModerationContext();
  const postTerm = termForPost(postModeration.post);
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

  // We don't show a notice at this level for deleted posts
  if (postTerm === 'post') {
    return null;
  }
  return (
    <PostErrorMessage
      testID={strings.testId}
      message={strings.message}
      {...props}
    />
  );
}

function PostHiddenNotice(
  props: ForwardingProps<typeof PostErrorMessage, object, 'message'>
) {
  const postModeration = usePostModerationContext();
  const postTerm = termForPost(postModeration.post);
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

  return postModeration.disableBypassHiddenContent ? (
    <PostErrorMessage message={strings.messageWithoutAction} {...props} />
  ) : (
    <PostErrorMessage
      testID={strings.testId}
      message={strings.message}
      actionLabel="Show anyway"
      onAction={postModeration.requestBypass}
      {...props}
    />
  );
}

function PostBlockedNotice(
  props: ForwardingProps<typeof PostErrorMessage, object, 'message'>
) {
  const postModeration = usePostModerationContext();
  const postTerm = termForPost(postModeration.post);
  const strings = useMemo<
    Strings<'message' | 'testId' | 'actionTestID'>
  >(() => {
    switch (postTerm) {
      case 'message':
        return {
          message: 'Message from a blocked user.',
          testId: 'MessageBlocked',
          actionTestID: 'ShowBlockedMessageButton',
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
      {...(postModeration.disableBypassBlockedContent
        ? {}
        : {
            actionTestID: strings.actionTestID,
            actionLabel: 'Show anyway',
            onAction: postModeration.requestBypass,
          })}
      {...props}
    />
  );
}

const PostModerationContext = createContext<{
  post: db.Post;
  isBypassed: boolean;
  requestBypass: () => void;
  disableBypassBlockedContent?: boolean;
  disableBypassHiddenContent?: boolean;
} | null>(null);

function usePostModerationContext() {
  const ctx = useContext(PostModerationContext);
  if (ctx == null) {
    throw new Error('Use PostModerationContext inside a provider');
  }
  return ctx;
}

function termForPost(post: db.Post): 'post' | 'message' {
  if (post.type === 'block' || post.type === 'note') return 'post';
  return 'message';
}

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

  // If user bypass is disabled, we want to reset
  // thebypass state so that content is hidden/blocked
  // again.
  useEffect(() => {
    setModerationBypassed(false);
  }, [disableBypassBlockedContent, disableBypassHiddenContent]);

  const ctxValue = useMemo(
    () => ({
      post,
      isBypassed: moderationBypassed,
      requestBypass: () => setModerationBypassed(true),
      disableBypassBlockedContent,
      disableBypassHiddenContent,
    }),
    [
      post,
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

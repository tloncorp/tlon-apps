import * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import {
  MessageActionVisibilityContext,
  isMessageActionVisible,
  messageActionContentKey,
  messageContentKey,
} from './messageActionModel';

const CURRENT_USER = 'current-user-id';
const OTHER_USER = 'other-user-id';

function context(
  overrides: Partial<MessageActionVisibilityContext> = {}
): MessageActionVisibilityContext {
  return {
    isNetworkDependent: false,
    isConnected: true,
    currentUserId: CURRENT_USER,
    currentUserIsAdmin: false,
    canStartDraft: true,
    channelType: 'chat',
    pinnedPostId: null,
    ...overrides,
    post: {
      id: 'post-1',
      authorId: OTHER_USER,
      parentId: null,
      deliveryStatus: null,
      replyCount: 0,
      reactionCount: 0,
      ...overrides.post,
    },
  };
}

describe('network dependence', () => {
  test('hides network-dependent actions while disconnected', () => {
    expect(
      isMessageActionVisible(
        'delete',
        context({
          isNetworkDependent: true,
          isConnected: false,
          post: { id: 'post-1', authorId: CURRENT_USER, reactionCount: 0 },
        })
      )
    ).toBe(false);
  });

  test('shows them once connected', () => {
    expect(
      isMessageActionVisible(
        'delete',
        context({
          isNetworkDependent: true,
          isConnected: true,
          post: { id: 'post-1', authorId: CURRENT_USER, reactionCount: 0 },
        })
      )
    ).toBe(true);
  });
});

describe('visibility', () => {
  test('prevents users from hiding their own posts', () => {
    expect(
      isMessageActionVisible(
        'visibility',
        context({
          post: { id: 'post-1', authorId: CURRENT_USER, reactionCount: 0 },
        })
      )
    ).toBe(false);
  });

  test('allows users to hide others posts', () => {
    expect(isMessageActionVisible('visibility', context())).toBe(true);
  });
});

describe('delete', () => {
  test('shown for own posts', () => {
    expect(
      isMessageActionVisible(
        'delete',
        context({
          post: { id: 'post-1', authorId: CURRENT_USER, reactionCount: 0 },
        })
      )
    ).toBe(true);
  });

  test('shown for admins on any post', () => {
    expect(
      isMessageActionVisible('delete', context({ currentUserIsAdmin: true }))
    ).toBe(true);
  });

  test('hidden for non-admins on others posts', () => {
    expect(isMessageActionVisible('delete', context())).toBe(false);
  });
});

describe('edit', () => {
  test('shown for own posts', () => {
    expect(
      isMessageActionVisible(
        'edit',
        context({
          post: { id: 'post-1', authorId: CURRENT_USER, reactionCount: 0 },
        })
      )
    ).toBe(true);
  });

  test('shown for admins on top-level notebook posts', () => {
    expect(
      isMessageActionVisible(
        'edit',
        context({ channelType: 'notebook', currentUserIsAdmin: true })
      )
    ).toBe(true);
  });

  test('hidden for admins on notebook replies', () => {
    expect(
      isMessageActionVisible(
        'edit',
        context({
          channelType: 'notebook',
          currentUserIsAdmin: true,
          post: {
            id: 'post-1',
            authorId: OTHER_USER,
            parentId: 'parent-1',
            reactionCount: 0,
          },
        })
      )
    ).toBe(false);
  });

  test('hidden for admins outside notebooks', () => {
    expect(
      isMessageActionVisible('edit', context({ currentUserIsAdmin: true }))
    ).toBe(false);
  });
});

describe('startThread', () => {
  test('shown on delivered top-level posts', () => {
    expect(isMessageActionVisible('startThread', context())).toBe(true);
  });

  test('hidden on undelivered posts', () => {
    expect(
      isMessageActionVisible(
        'startThread',
        context({
          post: {
            id: 'post-1',
            authorId: OTHER_USER,
            deliveryStatus: 'pending',
            reactionCount: 0,
          },
        })
      )
    ).toBe(false);
  });

  test('hidden on replies', () => {
    expect(
      isMessageActionVisible(
        'startThread',
        context({
          post: {
            id: 'post-1',
            authorId: OTHER_USER,
            parentId: 'parent-1',
            reactionCount: 0,
          },
        })
      )
    ).toBe(false);
  });
});

describe('muteThread', () => {
  test('shown when the post has replies', () => {
    expect(
      isMessageActionVisible(
        'muteThread',
        context({
          post: {
            id: 'post-1',
            authorId: OTHER_USER,
            replyCount: 2,
            reactionCount: 0,
          },
        })
      )
    ).toBe(true);
  });

  test('shown when the post is itself a reply', () => {
    expect(
      isMessageActionVisible(
        'muteThread',
        context({
          post: {
            id: 'post-1',
            authorId: OTHER_USER,
            parentId: 'parent-1',
            reactionCount: 0,
          },
        })
      )
    ).toBe(true);
  });

  test('hidden on standalone posts', () => {
    expect(isMessageActionVisible('muteThread', context())).toBe(false);
  });
});

describe('viewReactions', () => {
  test('shown only when the post has reactions', () => {
    expect(isMessageActionVisible('viewReactions', context())).toBe(false);
    expect(
      isMessageActionVisible(
        'viewReactions',
        context({
          post: { id: 'post-1', authorId: OTHER_USER, reactionCount: 1 },
        })
      )
    ).toBe(true);
  });
});

describe('pinning', () => {
  test('pin shown for admins on unpinned top-level posts', () => {
    expect(
      isMessageActionVisible('pinPost', context({ currentUserIsAdmin: true }))
    ).toBe(true);
  });

  test('pin hidden for non-admins', () => {
    expect(isMessageActionVisible('pinPost', context())).toBe(false);
  });

  test('pin hidden on the already-pinned post', () => {
    expect(
      isMessageActionVisible(
        'pinPost',
        context({ currentUserIsAdmin: true, pinnedPostId: 'post-1' })
      )
    ).toBe(false);
  });

  test('unpin shown only on the pinned post', () => {
    expect(
      isMessageActionVisible(
        'unpinPost',
        context({ currentUserIsAdmin: true, pinnedPostId: 'post-1' })
      )
    ).toBe(true);
    expect(
      isMessageActionVisible('unpinPost', context({ currentUserIsAdmin: true }))
    ).toBe(false);
  });
});

describe('composer-dependent actions', () => {
  test('quote requires a composer', () => {
    expect(isMessageActionVisible('quote', context())).toBe(true);
    expect(
      isMessageActionVisible('quote', context({ canStartDraft: false }))
    ).toBe(false);
  });

  test('replyToComment requires a reply by someone else plus a composer', () => {
    const reply = {
      id: 'post-1',
      authorId: OTHER_USER,
      parentId: 'parent-1',
      reactionCount: 0,
    };
    expect(
      isMessageActionVisible('replyToComment', context({ post: reply }))
    ).toBe(true);
    expect(
      isMessageActionVisible(
        'replyToComment',
        context({ post: reply, canStartDraft: false })
      )
    ).toBe(false);
    expect(
      isMessageActionVisible(
        'replyToComment',
        context({ post: { ...reply, authorId: CURRENT_USER } })
      )
    ).toBe(false);
    expect(isMessageActionVisible('replyToComment', context())).toBe(false);
  });
});

test('actions without a rule are visible by default', () => {
  expect(isMessageActionVisible('copyText', context())).toBe(true);
});

test('message content revisions include the visible reply summary', () => {
  const post = {
    content: null,
    textContent: 'message',
    title: null,
    image: null,
    description: null,
    cover: null,
    isDeleted: false,
    replyCount: 1,
    replyTime: 100,
    replyContactIds: ['~zod'],
  } as db.Post;

  const original = messageContentKey(post);
  expect(messageContentKey({ ...post, replyCount: 2 })).not.toBe(original);
  expect(messageContentKey({ ...post, replyTime: 200 })).not.toBe(original);
  expect(messageContentKey({ ...post, replyContactIds: ['~nec'] })).not.toBe(
    original
  );
  expect(
    messageContentKey({
      ...post,
      threadUnread: { updatedAt: 100, count: 1, notify: false },
    })
  ).not.toBe(original);
  expect(
    messageContentKey({
      ...post,
      threadUnread: { updatedAt: 100, count: 1, notify: true },
    })
  ).not.toBe(original);
});

test('message content revisions include rendered delivery and edit state', () => {
  const post = {
    content: null,
    textContent: 'message',
    deliveryStatus: null,
    editStatus: null,
    deleteStatus: null,
    isEdited: false,
    lastEditContent: null,
    lastEditTitle: null,
    lastEditImage: null,
  } as db.Post;

  const original = messageContentKey(post);
  expect(messageContentKey({ ...post, deliveryStatus: 'failed' })).not.toBe(
    original
  );
  expect(messageContentKey({ ...post, editStatus: 'failed' })).not.toBe(
    original
  );
  expect(messageContentKey({ ...post, deleteStatus: 'failed' })).not.toBe(
    original
  );
  expect(messageContentKey({ ...post, isEdited: true })).not.toBe(original);
  expect(
    messageContentKey({
      ...post,
      lastEditContent: [{ type: 'text', text: 'old' }],
    })
  ).not.toBe(original);
});

test('message action revisions ignore reply-summary-only changes', () => {
  const post = {
    content: null,
    textContent: 'message',
    title: null,
    image: null,
    description: null,
    cover: null,
    blob: null,
    isDeleted: false,
    replyCount: 1,
    replyTime: 100,
    replyContactIds: ['~zod'],
  } as db.Post;

  const original = messageActionContentKey(post);
  expect(messageActionContentKey({ ...post, replyCount: 2 })).toBe(original);
  expect(messageActionContentKey({ ...post, replyTime: 200 })).toBe(original);
  expect(
    messageActionContentKey({
      ...post,
      replyContactIds: ['~nec'],
    })
  ).toBe(original);
});

test('message content and action revisions include blob changes', () => {
  const post = {
    content: null,
    textContent: 'message',
    blob: 'pending-upload',
  } as db.Post;
  const updatedPost = { ...post, blob: 'completed-upload' };

  expect(messageContentKey(updatedPost)).not.toBe(messageContentKey(post));
  expect(messageActionContentKey(updatedPost)).not.toBe(
    messageActionContentKey(post)
  );
});

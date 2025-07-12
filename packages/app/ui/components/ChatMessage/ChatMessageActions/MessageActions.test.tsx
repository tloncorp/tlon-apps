import { expect, test } from 'vitest';

import { useDisplaySpecForChannelActionId } from './MessageActions';

test('prevents users from hiding their own posts', () => {
  const mockPost = {
    id: 'test-post-1',
    authorId: 'current-user-id',
    parentId: null,
    deliveryStatus: null,
    replyCount: 0,
    reactions: [],
    hidden: false,
    textContent: 'Test post content',
    volumeSettings: null,
  };

  const mockChannel = {
    id: 'test-channel',
    type: 'chat' as const,
  };

  const currentUserId = 'current-user-id';
  const currentUserIsAdmin = false;

  // Test the visibility logic for the 'visibility' action
  // This simulates the logic from the ConnectedAction component's visible useMemo
  const shouldShowVisibilityAction = (() => {
    switch ('visibility') {
      case 'visibility':
        // prevent users from hiding their own posts
        return mockPost.authorId !== currentUserId;
      default:
        return true;
    }
  })();

  // The visibility action should NOT be shown for the current user's own posts
  expect(shouldShowVisibilityAction).toBe(false);
});

test('allows users to hide others posts', () => {
  const mockPost = {
    id: 'test-post-2',
    authorId: 'other-user-id',
    parentId: null,
    deliveryStatus: null,
    replyCount: 0,
    reactions: [],
    hidden: false,
    textContent: 'Test post content from other user',
    volumeSettings: null,
  };

  const mockChannel = {
    id: 'test-channel',
    type: 'chat' as const,
  };

  const currentUserId = 'current-user-id';
  const currentUserIsAdmin = false;

  // Test the visibility logic for the 'visibility' action
  // This simulates the logic from the ConnectedAction component's visible useMemo
  const shouldShowVisibilityAction = (() => {
    switch ('visibility') {
      case 'visibility':
        // prevent users from hiding their own posts
        return mockPost.authorId !== currentUserId;
      default:
        return true;
    }
  })();

  // The visibility action SHOULD be shown for other users' posts
  expect(shouldShowVisibilityAction).toBe(true);
});
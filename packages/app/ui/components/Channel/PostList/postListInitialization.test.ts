import { describe, expect, it } from 'vitest';

import {
  getPostListAnchorKey,
  getPostListInitialization,
  shouldSnapUnreadAnchorToEnd,
} from './postListInitialization';

describe('getPostListAnchorKey', () => {
  it('distinguishes anchor intent when the post stays the same', () => {
    expect(
      getPostListAnchorKey({ type: 'unread', postId: 'same-post' })
    ).not.toBe(getPostListAnchorKey({ type: 'selected', postId: 'same-post' }));
  });
});

describe('getPostListInitialization', () => {
  it.each([
    {
      name: 'keeps the latest list stable while data arrives',
      input: { anchorIndex: -1 },
      expected: {
        isAnchorReady: true,
        mountKey: 'latest',
        shouldStartAnchorTimeout: false,
      },
    },
    {
      name: 'waits for anchor data before starting the timeout',
      input: {
        anchorKey: 'unread:unread-post',
        anchorIndex: -1,
        isLoading: true,
      },
      expected: {
        isAnchorReady: false,
        mountKey: 'anchor:unread:unread-post:waiting',
        shouldStartAnchorTimeout: false,
      },
    },
    {
      name: 'starts fallback after an empty initial page settles',
      input: {
        anchorKey: 'unread:deleted-unread-post',
        anchorIndex: -1,
        isLoading: false,
      },
      expected: {
        isAnchorReady: false,
        mountKey: 'anchor:unread:deleted-unread-post:waiting',
        shouldStartAnchorTimeout: true,
      },
    },
    {
      name: 'waits for an explicit anchor',
      input: {
        anchorKey: 'unread:unread-post',
        anchorIndex: -1,
      },
      expected: {
        isAnchorReady: false,
        mountKey: 'anchor:unread:unread-post:waiting',
        shouldStartAnchorTimeout: true,
      },
    },
    {
      name: 'remounts when the explicit anchor arrives',
      input: {
        anchorKey: 'unread:unread-post',
        anchorIndex: 4,
      },
      expected: {
        isAnchorReady: true,
        mountKey: 'anchor:unread:unread-post:ready',
        shouldStartAnchorTimeout: false,
      },
    },
    {
      name: 'falls back when the explicit anchor never arrives',
      input: {
        anchorKey: 'unread:deleted-unread-post',
        anchorIndex: -1,
        didTimeoutWaitingForAnchor: true,
      },
      expected: {
        isAnchorReady: true,
        mountKey: 'anchor:unread:deleted-unread-post:fallback',
        shouldStartAnchorTimeout: false,
      },
    },
  ])('$name', ({ input, expected }) => {
    expect(getPostListInitialization(input)).toEqual(expected);
  });
});

describe('shouldSnapUnreadAnchorToEnd', () => {
  it('snaps a near-end unread anchor only when the newest page is loaded', () => {
    expect(
      shouldSnapUnreadAnchorToEnd({
        anchorType: 'unread',
        estimatedAnchorExtent: 720,
        hasNewerPosts: false,
        anchorToEnd: true,
        viewportHeight: 800,
      })
    ).toBe(true);
    expect(
      shouldSnapUnreadAnchorToEnd({
        anchorType: 'unread',
        estimatedAnchorExtent: 720,
        hasNewerPosts: true,
        anchorToEnd: true,
        viewportHeight: 800,
      })
    ).toBe(false);
  });

  it('includes the anchor row and footer before snapping to the end', () => {
    expect(
      shouldSnapUnreadAnchorToEnd({
        anchorType: 'unread',
        estimatedAnchorExtent: 920,
        hasNewerPosts: false,
        anchorToEnd: true,
        viewportHeight: 800,
      })
    ).toBe(false);
  });

  it('keeps selected anchors centered even when they are near the end', () => {
    expect(
      shouldSnapUnreadAnchorToEnd({
        anchorType: 'selected',
        estimatedAnchorExtent: 720,
        hasNewerPosts: false,
        anchorToEnd: true,
        viewportHeight: 800,
      })
    ).toBe(false);
  });
});

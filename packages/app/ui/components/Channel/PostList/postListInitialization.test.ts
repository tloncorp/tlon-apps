import { describe, expect, it } from 'vitest';

import {
  getPostListMountKey,
  isPostListAnchorReady,
} from './postListInitialization';

describe('isPostListAnchorReady', () => {
  it('is immediately ready when there is no explicit anchor', () => {
    expect(
      isPostListAnchorReady({
        anchorIndex: -1,
      })
    ).toBe(true);
  });

  it('waits until the explicit anchor is present in the loaded data', () => {
    expect(
      isPostListAnchorReady({
        anchorId: 'unread-post',
        anchorIndex: -1,
      })
    ).toBe(false);
    expect(
      isPostListAnchorReady({
        anchorId: 'unread-post',
        anchorIndex: 4,
      })
    ).toBe(true);
  });

  it('falls back when an explicit anchor never appears', () => {
    expect(
      isPostListAnchorReady({
        anchorId: 'deleted-unread-post',
        anchorIndex: -1,
        didTimeoutWaitingForAnchor: true,
      })
    ).toBe(true);
  });
});

describe('getPostListMountKey', () => {
  it('remounts the upright list when latest data becomes available', () => {
    expect(
      getPostListMountKey({
        postCount: 0,
        anchorIndex: -1,
      })
    ).toBe('latest:waiting');
    expect(
      getPostListMountKey({
        postCount: 1,
        anchorIndex: -1,
      })
    ).toBe('latest:ready');
  });

  it('remounts the upright list when an unread anchor appears', () => {
    expect(
      getPostListMountKey({
        postCount: 10,
        anchorId: 'unread-post',
        anchorIndex: -1,
      })
    ).toBe('anchor:unread-post:waiting');
    expect(
      getPostListMountKey({
        postCount: 10,
        anchorId: 'unread-post',
        anchorIndex: 4,
      })
    ).toBe('anchor:unread-post:ready');
  });

  it('remounts with a fallback when an unread anchor never appears', () => {
    expect(
      getPostListMountKey({
        postCount: 10,
        anchorId: 'deleted-unread-post',
        anchorIndex: -1,
        didTimeoutWaitingForAnchor: true,
      })
    ).toBe('anchor:deleted-unread-post:fallback');
  });
});

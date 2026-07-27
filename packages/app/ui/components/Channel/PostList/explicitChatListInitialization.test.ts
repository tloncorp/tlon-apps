import { describe, expect, it } from 'vitest';

import {
  HISTORY_WINDOW_INCREMENT,
  getExplicitChatListMountKey,
  getExplicitChatWindowStartIndex,
  isExplicitChatAnchorReady,
} from './explicitChatListInitialization';

describe('isExplicitChatAnchorReady', () => {
  it('is immediately ready when there is no explicit anchor', () => {
    expect(
      isExplicitChatAnchorReady({
        anchorIndex: -1,
      })
    ).toBe(true);
  });

  it('waits until the explicit anchor is present in the loaded data', () => {
    expect(
      isExplicitChatAnchorReady({
        anchorId: 'unread-post',
        anchorIndex: -1,
      })
    ).toBe(false);
    expect(
      isExplicitChatAnchorReady({
        anchorId: 'unread-post',
        anchorIndex: 4,
      })
    ).toBe(true);
  });
});

describe('getExplicitChatWindowStartIndex', () => {
  it('leaves the legacy platform list untouched', () => {
    expect(
      getExplicitChatWindowStartIndex({
        enabled: false,
        postCount: 100,
        anchorIndex: 60,
        additionalHistoryCount: 0,
      })
    ).toBe(0);
  });

  it('starts a latest-post list with a bounded recent window', () => {
    expect(
      getExplicitChatWindowStartIndex({
        enabled: true,
        postCount: 100,
        anchorIndex: -1,
        additionalHistoryCount: 0,
      })
    ).toBe(85);
  });

  it('includes a small amount of history before an unread anchor', () => {
    expect(
      getExplicitChatWindowStartIndex({
        enabled: true,
        postCount: 100,
        anchorIndex: 60,
        additionalHistoryCount: 0,
      })
    ).toBe(55);
  });

  it('expands history in bounded increments without moving past index zero', () => {
    expect(
      getExplicitChatWindowStartIndex({
        enabled: true,
        postCount: 100,
        anchorIndex: 20,
        additionalHistoryCount: HISTORY_WINDOW_INCREMENT,
      })
    ).toBe(0);
  });
});

describe('getExplicitChatListMountKey', () => {
  it('remounts the upright list when latest data becomes available', () => {
    expect(
      getExplicitChatListMountKey({
        enabled: true,
        postCount: 0,
        anchorIndex: -1,
      })
    ).toBe('latest:waiting');
    expect(
      getExplicitChatListMountKey({
        enabled: true,
        postCount: 1,
        anchorIndex: -1,
      })
    ).toBe('latest:ready');
  });

  it('remounts the upright list when an unread anchor appears', () => {
    expect(
      getExplicitChatListMountKey({
        enabled: true,
        postCount: 10,
        anchorId: 'unread-post',
        anchorIndex: -1,
      })
    ).toBe('anchor:unread-post:waiting');
    expect(
      getExplicitChatListMountKey({
        enabled: true,
        postCount: 10,
        anchorId: 'unread-post',
        anchorIndex: 4,
      })
    ).toBe('anchor:unread-post:ready');
  });

  it('does not key-remount the legacy platform list', () => {
    expect(
      getExplicitChatListMountKey({
        enabled: false,
        postCount: 10,
        anchorId: 'unread-post',
        anchorIndex: 4,
      })
    ).toBeUndefined();
  });
});

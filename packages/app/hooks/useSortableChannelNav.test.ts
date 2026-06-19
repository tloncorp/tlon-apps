import { describe, expect, it } from 'vitest';

import {
  findDuplicateChannelIds,
  shouldFireDuplicatesCallback,
} from './useSortableChannelNav.helpers';

// Minimal structural shape — the helper only reads `channels[i].id`. Keeping
// this local lets the test import the helper without dragging the hook's
// runtime imports through vite's transform.
type TestSection = { id: string; channels: Array<{ id: string }> };

const makeSection = (id: string, channelIds: string[]): TestSection => ({
  id,
  channels: channelIds.map((cid) => ({ id: cid })),
});

describe('findDuplicateChannelIds', () => {
  it('returns no duplicates when each channel appears in exactly one section', () => {
    const sections = [
      makeSection('default', ['chat/a', 'chat/b']),
      makeSection('custom-1', ['chat/c']),
    ];
    expect(findDuplicateChannelIds(sections)).toEqual([]);
  });

  it('flags a channel that appears in two sections', () => {
    const sections = [
      makeSection('default', ['chat/a', 'chat/dupe']),
      makeSection('custom-1', ['chat/dupe']),
    ];
    expect(findDuplicateChannelIds(sections)).toEqual(['chat/dupe']);
  });

  it('flags a channel that appears in three sections only once', () => {
    const sections = [
      makeSection('default', ['chat/dupe']),
      makeSection('custom-1', ['chat/dupe']),
      makeSection('custom-2', ['chat/dupe']),
    ];
    expect(findDuplicateChannelIds(sections)).toEqual(['chat/dupe']);
  });

  it('returns multiple distinct duplicates', () => {
    const sections = [
      makeSection('default', ['chat/a', 'chat/b', 'chat/c']),
      makeSection('custom-1', ['chat/a', 'chat/b']),
    ];
    expect(findDuplicateChannelIds(sections).sort()).toEqual([
      'chat/a',
      'chat/b',
    ]);
  });

  it('returns an empty array for an empty input', () => {
    expect(findDuplicateChannelIds([])).toEqual([]);
  });

  it('returns an empty array when sections are empty', () => {
    const sections = [makeSection('default', []), makeSection('custom-1', [])];
    expect(findDuplicateChannelIds(sections)).toEqual([]);
  });
});

describe('shouldFireDuplicatesCallback', () => {
  it('does not fire and clears fingerprint when there are no duplicates', () => {
    expect(shouldFireDuplicatesCallback([], null)).toEqual({
      fingerprint: null,
      shouldFire: false,
    });
    expect(shouldFireDuplicatesCallback([], 'chat/dupe')).toEqual({
      fingerprint: null,
      shouldFire: false,
    });
  });

  it('fires the first time a non-empty duplicate set is observed', () => {
    expect(shouldFireDuplicatesCallback(['chat/dupe'], null)).toEqual({
      fingerprint: 'chat/dupe',
      shouldFire: true,
    });
  });

  it('does not fire again while the duplicate set is unchanged', () => {
    const first = shouldFireDuplicatesCallback(['chat/dupe'], null);
    expect(first.shouldFire).toBe(true);
    const second = shouldFireDuplicatesCallback(
      ['chat/dupe'],
      first.fingerprint
    );
    expect(second).toEqual({
      fingerprint: 'chat/dupe',
      shouldFire: false,
    });
  });

  it('treats fingerprints as set-equal regardless of input order', () => {
    const first = shouldFireDuplicatesCallback(['chat/a', 'chat/b'], null);
    const second = shouldFireDuplicatesCallback(
      ['chat/b', 'chat/a'],
      first.fingerprint
    );
    expect(second.shouldFire).toBe(false);
  });

  it('fires again when the duplicate set changes', () => {
    const first = shouldFireDuplicatesCallback(['chat/a'], null);
    expect(first.shouldFire).toBe(true);
    const second = shouldFireDuplicatesCallback(
      ['chat/a', 'chat/b'],
      first.fingerprint
    );
    expect(second).toEqual({
      fingerprint: 'chat/a|chat/b',
      shouldFire: true,
    });
  });

  it('re-arms after duplicates resolve, so a later regression refires', () => {
    const fired = shouldFireDuplicatesCallback(['chat/a'], null);
    const resolved = shouldFireDuplicatesCallback([], fired.fingerprint);
    expect(resolved.fingerprint).toBeNull();
    const refired = shouldFireDuplicatesCallback(
      ['chat/a'],
      resolved.fingerprint
    );
    expect(refired.shouldFire).toBe(true);
  });
});

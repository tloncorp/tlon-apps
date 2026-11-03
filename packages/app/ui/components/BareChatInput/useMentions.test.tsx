import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { firstDifference, shiftIndex, useMentions } from './useMentions';

const mocks = vi.hoisted(() => ({
  useMentionCandidates: vi.fn(),
  syncRosterForMentions: vi.fn(),
}));

vi.mock('@tloncorp/shared', () => ({ ALL_MENTION_ID: 'all' }));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  useMentionCandidates: mocks.useMentionCandidates,
  syncRosterForMentions: mocks.syncRosterForMentions,
}));
vi.mock('../../utils', () => ({
  formatUserId: (id: string) => ({ display: `formatted ${id}` }),
}));

const chatId = '~sampel-palnet';

let renderer: ReactTestRenderer;
let result: ReturnType<typeof useMentions>;

function Harness() {
  result = useMentions({ chatId, roleOptions: [] });
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.useMentionCandidates.mockReturnValue({
    data: [
      {
        id: '~sampel-palnet',
        nickname: null,
        avatarImage: null,
        bio: null,
        status: null,
        color: null,
        priority: 4,
      },
    ],
  });
  act(() => {
    renderer = create(<Harness />);
  });
});

afterEach(() => {
  act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

function type(text: string) {
  act(() => result.handleMention('', text));
}

test('queries mention candidates through the store hook once there is search text', () => {
  type('~samp');

  expect(mocks.useMentionCandidates).toHaveBeenLastCalledWith({
    chatId,
    query: 'samp',
    enabled: true,
  });
  expect(result.validOptions).toEqual([
    {
      id: '~sampel-palnet',
      title: '~sampel-palnet',
      subtitle: 'formatted ~sampel-palnet',
      type: 'contact',
      priority: 4,
      contact: {
        id: '~sampel-palnet',
        nickname: null,
        avatarImage: null,
        bio: null,
        status: null,
        color: null,
      },
    },
  ]);
});

test('does not enable the candidate query for a bare trigger', () => {
  type('~');

  expect(result.isMentionModeActive).toBe(true);
  expect(mocks.useMentionCandidates).toHaveBeenLastCalledWith({
    chatId,
    query: '',
    enabled: false,
  });
});

test('loads a group roster once mention mode opens, and no DM roster', () => {
  const groupId = '~zod/big';
  let inGroup!: ReturnType<typeof useMentions>;
  function GroupHarness() {
    inGroup = useMentions({ chatId: groupId, groupId, roleOptions: [] });
    return null;
  }
  let groupRenderer!: ReactTestRenderer;
  act(() => {
    groupRenderer = create(<GroupHarness />);
  });
  expect(mocks.syncRosterForMentions).not.toHaveBeenCalled();

  type('~');
  expect(mocks.syncRosterForMentions).not.toHaveBeenCalled();

  act(() => inGroup.handleMention('', '~'));
  expect(mocks.syncRosterForMentions).toHaveBeenCalledWith(groupId);
  act(() => groupRenderer.unmount());
});

test('firstDifference finds where two strings diverge', () => {
  expect(firstDifference('abc', 'abd')).toBe(2);
  expect(firstDifference('ab', 'abc')).toBe(2);
  expect(firstDifference('abc', 'ab')).toBe(2);
  expect(firstDifference('abc', 'abc')).toBe(3);
  expect(firstDifference('', 'a')).toBe(0);
});

test('shiftIndex keeps, moves, or drops an index around an edit', () => {
  // Removing "bcd" (positions 1-4) from "abcdef".
  expect(shiftIndex(0, 1, -3)).toBe(0);
  expect(shiftIndex(2, 1, -3)).toBeNull();
  expect(shiftIndex(4, 1, -3)).toBe(1);
  // Inserting two characters at position 1.
  expect(shiftIndex(0, 1, 2)).toBe(0);
  expect(shiftIndex(1, 1, 2)).toBe(3);
});

const option = {
  id: '~sampel-palnet',
  title: '~sampel-palnet',
  type: 'contact' as const,
  priority: 4,
};

test('an edit before the active trigger moves it with the text', () => {
  type('remove me ~samp');
  act(() => result.shiftActiveMention(0, -'remove me'.length));

  expect(result.isMentionModeActive).toBe(true);
  let selection: ReturnType<typeof result.handleSelectMention>;
  act(() => {
    selection = result.handleSelectMention(option, ' ~samp');
  });
  expect(selection!).toMatchObject({ text: ' ~sampel-palnet ' });
});

test('an edit that removes the active trigger closes the mention', () => {
  type('ab ~samp');
  act(() => result.shiftActiveMention(2, -4));

  expect(result.isMentionModeActive).toBe(false);
  let selection: ReturnType<typeof result.handleSelectMention>;
  act(() => {
    selection = result.handleSelectMention(option, 'abamp');
  });
  expect(selection!).toBeUndefined();
});

test('a dismissed trigger stays dismissed after an edit before it', () => {
  type('remove me ~samp');
  act(() => result.handleMentionEscape());
  act(() => result.shiftActiveMention(0, -'remove me'.length));
  act(() => result.handleMention(' ~samp', ' ~sampe'));

  expect(result.isMentionModeActive).toBe(false);
});

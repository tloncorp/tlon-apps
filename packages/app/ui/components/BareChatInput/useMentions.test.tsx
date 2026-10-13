import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useMentions } from './useMentions';

const mocks = vi.hoisted(() => ({
  useMentionCandidates: vi.fn(),
}));

vi.mock('@tloncorp/shared', () => ({ ALL_MENTION_ID: 'all' }));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  useMentionCandidates: mocks.useMentionCandidates,
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

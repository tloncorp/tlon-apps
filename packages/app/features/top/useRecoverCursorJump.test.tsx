import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { CursorNormalizationError } from '@tloncorp/shared/store';
import { useRecoverCursorJump } from './useRecoverCursorJump';

const mocks = vi.hoisted(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  return { toast: vi.fn(), recover: vi.fn() };
});
vi.mock('@tloncorp/ui', () => ({ useToast: () => mocks.toast }));
vi.mock('@tloncorp/shared/store', async () =>
  vi.importActual('../../../shared/src/store/useChannelPosts/cursorError')
);

const channelId = 'chat/~zod/test';
const missing = { present: false, sequenceNum: null, isDeleted: false };
function cursorError(postId = 'anchor', channel = channelId) {
  return new CursorNormalizationError(channel, {
    cursorPostId: postId,
    before: missing,
    returned: missing,
    after: missing,
    fetchedPostCount: 0,
    fetchedDeletedCount: 0,
  });
}
type Props = Parameters<typeof useRecoverCursorJump>[0];
function props(overrides: Partial<Props> = {}): Props {
  return {
    channelId,
    selectedPostId: 'anchor',
    clearedCursor: false,
    isFocused: true,
    isLoading: false,
    isFetching: false,
    error: cursorError(),
    onRecover: mocks.recover,
    ...overrides,
  };
}
function Harness(p: Props) {
  useRecoverCursorJump(p);
  return null;
}
let renderer: ReactTestRenderer | undefined;
function render(p: Props) {
  act(() => {
    renderer = create(<Harness {...p} />);
  });
}
function update(p: Props) {
  act(() => {
    renderer!.update(<Harness {...p} />);
  });
}
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

test.each([
  'chat/~zod/test',
  'diary/~zod/test',
  'heap/~zod/test',
  '~zod',
  '0v1',
])('recovers an exhausted jump in %s with one short notice', (channelId) => {
  const p = props({ channelId, error: cursorError('anchor', channelId) });
  render(p);
  expect(mocks.toast).toHaveBeenCalledWith({
    message: "Couldn't jump to this message",
    duration: 2500,
  });
  expect(mocks.recover).toHaveBeenCalledOnce();
  update({ ...p, onRecover: () => mocks.recover() });
  expect(mocks.toast).toHaveBeenCalledOnce();
  expect(mocks.recover).toHaveBeenCalledOnce();
});

test.each(['notes/~zod/book', 'custom/~zod/channel'])(
  'preserves independently handled targets in %s after cursor retries finish',
  (channelId) => {
    const p = props({ channelId, error: cursorError('anchor', channelId) });
    render({ ...p, isFetching: true });
    update(p);
    // The recovery callback clears selectedPostId in ChannelScreen, which
    // would discard Notes' initialNoteId before its late-sync effect can open it.
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  }
);

test.each([
  { isLoading: true },
  { isFetching: true },
  { isFocused: false },
  { clearedCursor: true },
  { selectedPostId: undefined },
  { error: null },
  { error: new Error('network failed') },
  { error: new Error('Failed to normalize cursor') },
  { error: cursorError('different-post') },
  { error: cursorError('anchor', 'chat/~zod/elsewhere') },
])(
  'does not retire a cursor for unrelated or unfinished state: %j',
  (override) => {
    render(props(override));
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
  }
);

test('waits for retries to finish and allows a later independent failed jump', () => {
  const p = props();
  render({ ...p, isLoading: true });
  update(p);
  expect(mocks.recover).toHaveBeenCalledOnce();
  update({ ...p, selectedPostId: 'next', error: null });
  update({ ...p, selectedPostId: 'next', error: cursorError('next') });
  expect(mocks.recover).toHaveBeenCalledTimes(2);
});

test('clearing the selection cannot resurrect the unread cursor', () => {
  function StatefulHarness() {
    const [selectedPostId, select] = useState<string | undefined>('anchor');
    const [clearedCursor, clear] = useState(false);
    const error = React.useMemo(() => cursorError(), []);
    useRecoverCursorJump(
      props({
        error,
        selectedPostId,
        clearedCursor,
        onRecover: () => {
          clear(true);
          select(undefined);
        },
      })
    );
    const requestedCursor = selectedPostId || 'older-unread';
    return React.createElement('state', {
      mode: requestedCursor && !clearedCursor ? 'around' : 'newest',
    });
  }
  act(() => {
    renderer = create(<StatefulHarness />);
  });
  expect(
    renderer!.root.find((node) => (node.type as unknown) === 'state').props.mode
  ).toBe('newest');
  expect(mocks.toast).toHaveBeenCalledOnce();
});

test('a repeated jump to the same anchor can recover after regaining focus', () => {
  const first = props();
  render(first);
  expect(mocks.recover).toHaveBeenCalledOnce();
  update({
    ...first,
    selectedPostId: undefined,
    clearedCursor: true,
    error: null,
  });
  const repeated = props({ error: cursorError(), isFocused: false });
  update(repeated);
  expect(mocks.recover).toHaveBeenCalledOnce();
  update({ ...repeated, isFocused: true });
  expect(mocks.recover).toHaveBeenCalledTimes(2);
  expect(mocks.toast).toHaveBeenCalledTimes(2);
});

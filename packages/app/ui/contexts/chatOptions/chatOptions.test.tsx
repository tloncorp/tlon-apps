import React, { useContext } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';

import { ChatOptionsProvider } from './chatOptions';
import { ChatOptionsContext, type ChatOptionsContextValue } from './context';
import { ChatOptionsSheet } from '../../components/ChatOptionsSheet';
import { InviteUsersSheet } from '../../components/InviteUsersSheet';

const mocks = vi.hoisted(() => ({ platform: { OS: 'ios' }, narrow: true }));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('@tloncorp/api/urbit', () => ({}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {},
  trackEvent: vi.fn(),
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  useChannel: ({ id }: { id?: string }) => ({
    data: id ? { id, groupId: 'channel-group' } : undefined,
  }),
  useGroup: ({ id }: { id?: string }) => ({ data: id ? { id } : undefined }),
  syncGroup: vi.fn(async () => {}),
  SyncPriority: { Low: 0 },
}));
vi.mock('@tloncorp/ui', () => ({
  ConfirmDialog: () => null,
  useIsWindowNarrow: () => mocks.narrow,
}));
vi.mock('../../components/ChatOptionsSheet', () => ({
  ChatOptionsSheet: () => null,
}));
vi.mock('../../components/InviteUsersSheet', () => ({
  InviteUsersSheet: () => null,
}));
vi.mock('../../utils', () => ({ useChannelTitle: () => '' }));

setupReactTestEnvironment();
beforeEach(() => {
  vi.useFakeTimers();
  mocks.platform.OS = 'ios';
  mocks.narrow = true;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderProvider(
  props: Partial<React.ComponentProps<typeof ChatOptionsProvider>> = {}
) {
  let context: NonNullable<ChatOptionsContextValue>;
  const Consumer = () => {
    context = useContext(ChatOptionsContext)!;
    return null;
  };
  let tree: ReturnType<typeof create>;
  const element = () => (
    <ChatOptionsProvider {...props}>
      <Consumer />
    </ChatOptionsProvider>
  );
  act(() => {
    tree = create(element());
  });
  return {
    open(id = 'group', type: 'group' | 'channel' = 'group') {
      act(() => context.open(id, type));
    },
    invite() {
      act(() => context.onPressInvite?.());
    },
    sheet() {
      return tree.root.findByType(ChatOptionsSheet);
    },
    inviteSheet() {
      return tree.root.findByType(InviteUsersSheet);
    },
    sheetCount() {
      return tree.root.findAllByType(ChatOptionsSheet).length;
    },
    refresh() {
      act(() => tree.update(element()));
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

describe('Chat Options invite handoff', () => {
  it.each(['group', 'channel'] as const)(
    'waits for dismissal and preserves the %s invite target without initialChat',
    (type) => {
      const provider = renderProvider();
      provider.open('selected-group', type);
      const complete = provider.sheet().props.onNativeDismissed;
      provider.invite();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(provider.inviteSheet().props.open).toBe(false);
      expect(provider.sheet().props.open).toBe(false);
      act(() => complete());
      expect(provider.sheetCount()).toBe(0);
      expect(provider.inviteSheet().props.open).toBe(true);
      expect(provider.inviteSheet().props.groupId).toBe(
        type === 'group' ? 'selected-group' : 'channel-group'
      );
      act(() => provider.inviteSheet().props.onOpenChange(false));
      act(() => complete());
      expect(provider.inviteSheet().props.open).toBe(false);
      provider.unmount();
    }
  );
  it('cancels a queued invite on reopen and ignores old completions', () => {
    const provider = renderProvider();
    provider.open();
    const stale = provider.sheet().props.onNativeDismissed;
    provider.invite();
    provider.open('new-group');
    act(() => stale());
    expect(provider.inviteSheet().props.open).toBe(false);
    act(() => provider.sheet().props.onOpenChange(false));
    act(() => stale());
    expect(provider.sheetCount()).toBe(1);
    act(() => provider.sheet().props.onNativeDismissed());
    expect(provider.inviteSheet().props.open).toBe(false);
    provider.unmount();
  });
  it('cancels queued work when switching to wide layout', () => {
    const provider = renderProvider();
    provider.open();
    const stale = provider.sheet().props.onNativeDismissed;
    provider.invite();
    mocks.narrow = false;
    provider.refresh();
    act(() => stale());
    mocks.narrow = true;
    provider.refresh();
    expect(provider.inviteSheet().props.open).toBe(false);
    provider.unmount();
  });
  it.each(['web'])('preserves the %s timed handoff', (platform) => {
    mocks.platform.OS = platform;
    const provider = renderProvider();
    provider.open();
    provider.invite();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(provider.inviteSheet().props.open).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(provider.inviteSheet().props.open).toBe(true);
    expect(provider.inviteSheet().props.groupId).toBe('group');
    provider.unmount();
  });
  it('waits for Android dismissal before opening the invite sheet', () => {
    mocks.platform.OS = 'android';
    const provider = renderProvider();
    provider.open();
    provider.invite();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(provider.inviteSheet().props.open).toBe(false);
    act(() => provider.sheet().props.onNativeDismissed());
    expect(provider.inviteSheet().props.open).toBe(true);
    provider.unmount();
  });
  it('preserves an external invite handler', () => {
    const onPressInvite = vi.fn();
    const provider = renderProvider({ onPressInvite });
    provider.open();
    provider.invite();
    expect(onPressInvite).toHaveBeenCalledWith('group');
    expect(provider.inviteSheet().props.open).toBe(false);
    provider.unmount();
  });
  it('cancels a timer on unmount', () => {
    mocks.platform.OS = 'web';
    const provider = renderProvider();
    provider.open();
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    provider.invite();
    const timer =
      timeout.mock.results[
        timeout.mock.calls.findIndex((call) => call[1] === 300)
      ].value;
    provider.unmount();
    expect(clear).toHaveBeenCalledWith(timer);
  });
});

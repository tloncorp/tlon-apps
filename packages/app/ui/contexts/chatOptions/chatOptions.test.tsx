import React, { useContext } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';

import { ChatOptionsProvider } from './chatOptions';
import { ChatOptionsContext, type ChatOptionsContextValue } from './context';
import { ChatOptionsSheet } from '../../components/ChatOptionsSheet';
import { InviteUsersSheet } from '../../components/InviteUsersSheet';
import { CreateChannelSheet } from '../../components/ManageChannels/CreateChannelSheet';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  mobileTree: true,
}));
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
}));
vi.mock('../../../navigation/utils', () => ({
  useIsMobileTree: () => mocks.mobileTree,
}));
vi.mock('../../components/ChatOptionsSheet', () => ({
  ChatOptionsSheet: () => null,
}));
vi.mock('../../components/InviteUsersSheet', () => ({
  InviteUsersSheet: () => null,
}));
vi.mock('../../components/ManageChannels/CreateChannelSheet', () => ({
  CreateChannelSheet: () => null,
}));
vi.mock('../../utils', () => ({ useChannelTitle: () => '' }));

setupReactTestEnvironment();
beforeEach(() => {
  vi.useFakeTimers();
  mocks.platform.OS = 'ios';
  mocks.mobileTree = true;
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
    newChannel() {
      act(() => context.onPressNewChannel());
    },
    pressChannel(channel: { id: string }) {
      act(() => context.onPressChannel(channel as never));
    },
    createChannelSheets() {
      return tree.root.findAllByType(CreateChannelSheet);
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
  it('cancels queued work when the mobile tree unmounts', () => {
    const provider = renderProvider();
    provider.open();
    const stale = provider.sheet().props.onNativeDismissed;
    provider.invite();
    mocks.mobileTree = false;
    provider.refresh();
    act(() => stale());
    mocks.mobileTree = true;
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

describe('Chat Options channel menu', () => {
  it.each(['ios', 'android'])(
    'opens a picked channel once the %s sheet has dismissed',
    (platform) => {
      mocks.platform.OS = platform;
      const onPressChannel = vi.fn();
      const provider = renderProvider({ onPressChannel });
      provider.open('selected-group');
      provider.pressChannel({ id: 'next-channel' });
      expect(provider.sheet().props.open).toBe(false);
      expect(onPressChannel).not.toHaveBeenCalled();
      act(() => provider.sheet().props.onNativeDismissed());
      expect(onPressChannel).toHaveBeenCalledWith({ id: 'next-channel' });
      provider.unmount();
    }
  );

  it('opens a picked channel at once on web', () => {
    mocks.platform.OS = 'web';
    const onPressChannel = vi.fn();
    const provider = renderProvider({ onPressChannel });
    provider.open('selected-group');
    provider.pressChannel({ id: 'next-channel' });
    expect(onPressChannel).toHaveBeenCalledWith({ id: 'next-channel' });
    expect(provider.sheet().props.open).toBe(false);
    provider.unmount();
  });

  it.each(['ios', 'android'])(
    'waits for the %s dismissal before opening the new channel sheet',
    (platform) => {
      mocks.platform.OS = platform;
      const onPressCreateChannelPermissions = vi.fn();
      const provider = renderProvider({ onPressCreateChannelPermissions });
      provider.open('selected-group');
      provider.newChannel();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(provider.sheet().props.open).toBe(false);
      expect(provider.createChannelSheets()).toHaveLength(0);
      act(() => provider.sheet().props.onNativeDismissed());
      const [sheet] = provider.createChannelSheets();
      expect(sheet.props.group).toEqual({ id: 'selected-group' });
      expect(sheet.props.navigateToPermissions).toBe(
        onPressCreateChannelPermissions
      );
      act(() => sheet.props.onOpenChange(false));
      expect(provider.createChannelSheets()).toHaveLength(0);
      provider.unmount();
    }
  );

  it("creates in a channel's group", () => {
    const provider = renderProvider();
    provider.open('selected-channel', 'channel');
    provider.newChannel();
    act(() => provider.sheet().props.onNativeDismissed());
    expect(provider.createChannelSheets()[0].props.group).toEqual({
      id: 'channel-group',
    });
    provider.unmount();
  });

  it('opens the new channel sheet after the web timer', () => {
    mocks.platform.OS = 'web';
    const provider = renderProvider();
    provider.open();
    provider.newChannel();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(provider.createChannelSheets()).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(provider.createChannelSheets()[0].props.group).toEqual({
      id: 'group',
    });
    provider.unmount();
  });

  it('drops a queued new channel sheet when another sheet opens', () => {
    const provider = renderProvider();
    provider.open();
    const stale = provider.sheet().props.onNativeDismissed;
    provider.newChannel();
    provider.open('new-group');
    act(() => stale());
    expect(provider.createChannelSheets()).toHaveLength(0);
    provider.unmount();
  });
});

import React, { useLayoutEffect, useState } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import type * as db from '@tloncorp/shared/db';
import { ActionSheet } from './ActionSheet';
import { ProfileSheet } from './ProfileSheet';
import { useForwardToChannelSheet } from './useForwardToChannelSheet';
import { ForwardToChannelSheet } from './ForwardToChannelSheet';
import { FolderTreeRow } from './NotesChannel/NotesTreeRows';
import { NotesActionMenu } from './NotesChannel/NotesActions';

const environment = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  narrow: true,
}));
vi.mock('react-native', () => ({
  Platform: environment.platform,
  Alert: { alert: vi.fn() },
  Switch: 'Switch',
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Pressable: 'Pressable',
  useIsWindowNarrow: () => environment.narrow,
  useToast: () => vi.fn(),
}));
vi.mock('@tloncorp/shared/store', () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('../contexts/appDataContext', () => ({
  useCurrentUserId: () => '~me',
}));
vi.mock('../utils', () => ({ useChatTitle: () => 'Chat' }));
vi.mock('../utils/channelUtils', () => ({ channelHasPosts: () => true }));
vi.mock('./ProfileBlock', () => ({ ProfileBlock: () => null }));
vi.mock('./ForwardChannelSelector', () => ({
  ForwardChannelSelector: () => null,
}));
vi.mock('./NotesChannel/NotesActions', () => ({ NotesActionMenu: () => null }));
vi.mock('./OverflowMenuButton', () => ({ OverflowTriggerButton: () => null }));
vi.mock('./UnreadDot', () => ({ UnreadDot: () => null }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock('tamagui', () => ({
  isWeb: false,
  View: 'View',
  XStack: 'View',
  YStack: 'View',
  getTokenValue: () => 16,
}));
vi.mock('./ListItem', async () => {
  const { ListItem } = await import('../../test/sheetTestUtils');
  return { ListItem };
});
vi.mock('./ActionSheet', async () => {
  const { Passthrough, Empty, createActionGroups } =
    await import('../../test/sheetTestUtils');
  return {
    ActionSheet: Object.assign(Passthrough, {
      Action: Empty,
      ActionGroup: Passthrough,
      Content: Passthrough,
      ContentBlock: Passthrough,
      ScrollableContent: Passthrough,
      SimpleHeader: Empty,
      SimpleActionGroupList: ({
        actionGroups,
      }: {
        actionGroups: {
          actions: { render?: (props: {}) => React.ReactNode }[];
        }[];
      }) =>
        actionGroups.flatMap((group) =>
          group.actions.map((action, index) =>
            action.render ? (
              <React.Fragment key={index}>{action.render({})}</React.Fragment>
            ) : null
          )
        ),
    }),
    createActionGroups,
  };
});

setupReactTestEnvironment();
beforeEach(() => {
  environment.platform.OS = 'ios';
  environment.narrow = true;
  vi.clearAllMocks();
});

function renderProfile(host = false) {
  let tree: ReturnType<typeof create>;
  const close = vi.fn();
  const assign = vi.fn();
  const remove = vi.fn();
  let admin = true;
  let contactId = '~me';
  const element = () => (
    <ProfileSheet
      open
      contactId={contactId}
      currentUserIsAdmin={admin}
      groupHostId={host ? '~me' : '~host'}
      onOpenChange={close}
      roles={
        [
          { id: 'admin', title: 'Admin' },
          { id: 'member', title: 'Member' },
        ] as db.GroupRole[]
      }
      selectedUserRoles={['admin']}
      onPressAsignRole={assign}
      onPressRemoveRole={remove}
    />
  );
  act(() => {
    tree = create(element());
  });
  const choose = (title: string) =>
    act(() => {
      tree.root
        .findAllByType(ActionSheet.Action)
        .find((node) => node.props.action.title === title)!
        .props.action.action();
    });
  const picker = () =>
    tree.root
      .findAllByType(ActionSheet)
      .find((node) => node.props.mode === 'popover')!;
  return {
    tree: tree!,
    close,
    assign,
    remove,
    choose,
    picker,
    demote() {
      admin = false;
      act(() => tree.update(element()));
    },
    switchContact() {
      contactId = '~other';
      act(() => tree.update(element()));
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

describe('profile role handoffs', () => {
  it.each(['ios', 'android'])(
    'waits on %s and survives optimistic self-demotion',
    (platform) => {
      environment.platform.OS = platform;
      const sheet = renderProfile();
      sheet.choose('Assign role');
      expect(sheet.picker().props.open).toBe(true);
      sheet.choose('Admin');
      expect(sheet.remove).toHaveBeenCalledWith('admin');
      expect(sheet.close).not.toHaveBeenCalled();
      sheet.demote();
      expect(sheet.picker().props.open).toBe(false);
      const complete = sheet.picker().props.onNativeDismissed;
      act(() => complete());
      act(() => complete());
      expect(sheet.close).toHaveBeenCalledTimes(1);
      sheet.unmount();
    }
  );

  it('does not close the parent or mutate the host admin, and can reopen', () => {
    const sheet = renderProfile(true);
    sheet.choose('Assign role');
    sheet.choose('Admin');
    act(() => sheet.picker().props.onNativeDismissed());
    expect(sheet.close).not.toHaveBeenCalled();
    expect(sheet.remove).not.toHaveBeenCalled();
    sheet.choose('Assign role');
    sheet.choose('Member');
    expect(sheet.assign).toHaveBeenCalledWith('member');
    act(() => sheet.picker().props.onNativeDismissed());
    expect(sheet.close).toHaveBeenCalledTimes(1);
    sheet.unmount();
  });

  it('cancels the old parent close after switching contacts', () => {
    const sheet = renderProfile();
    sheet.choose('Assign role');
    sheet.choose('Admin');
    const complete = sheet.picker().props.onNativeDismissed;
    sheet.switchContact();
    act(() => complete());
    expect(sheet.close).not.toHaveBeenCalled();
    sheet.unmount();
  });

  it.each(['web', 'wide'])(
    'keeps %s popovers synchronous and their trigger in place',
    (mode) => {
      if (mode === 'web') environment.platform.OS = 'web';
      else environment.narrow = false;
      const sheet = renderProfile();
      expect(sheet.picker().props.trigger).toBeDefined();
      sheet.choose('Assign role');
      sheet.choose('Admin');
      expect(sheet.close).toHaveBeenCalledWith(false);
      sheet.unmount();
    }
  );
});

function renderForward(closeBeforeForward = true) {
  let tree: ReturnType<typeof create>;
  let controller: ReturnType<typeof useForwardToChannelSheet>;
  let setOpen: (open: boolean) => void;
  const forward = vi.fn(async (_channel: db.Channel) => {});
  function Probe() {
    const [open, updateOpen] = useState(true);
    setOpen = updateOpen;
    const current = useForwardToChannelSheet({
      isOpen: open,
      onClose: () => updateOpen(false),
      onForwardToChannel: forward,
      successMessage: () => null,
      failureMessage: 'Failed',
      closeBeforeForward,
    });
    useLayoutEffect(() => {
      controller = current;
    });
    return (
      <ForwardToChannelSheet
        key={current.presentationKey}
        open={open}
        onOpenChange={updateOpen}
        onNativeDismissed={current.onNativeDismissed}
        keepMounted={current.keepMounted}
        onChannelSelected={current.handleChannelSelected}
        title="Forward"
        footerComponent={current.renderFooter}
      />
    );
  }
  act(() => {
    tree = create(<Probe />);
  });
  const channel = { id: 'chat' } as db.Channel;
  act(() => controller.handleChannelSelected(channel));
  function button() {
    return controller.renderFooter()!.props.children.props;
  }
  return {
    tree: tree!,
    forward,
    channel,
    button,
    get controller() {
      return controller!;
    },
    reopen() {
      act(() => setOpen(true));
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

describe('forwarding handoffs', () => {
  it.each(['ios', 'android'])(
    'retains %s content and routes only on completion',
    async (platform) => {
      environment.platform.OS = platform;
      const sheet = renderForward();
      act(() => sheet.button().onPress());
      expect(sheet.forward).not.toHaveBeenCalled();
      expect(sheet.tree.root.findByType(ActionSheet).props.open).toBe(false);
      expect(sheet.controller.keepMounted).toBe(true);
      await act(async () => sheet.controller.onNativeDismissed());
      expect(sheet.forward).toHaveBeenCalledWith(sheet.channel);
      expect(sheet.tree.toJSON()).toBe(null);
      sheet.unmount();
    }
  );

  it('cancels a queued send on reopen without leaving the new sheet disabled', async () => {
    const sheet = renderForward();
    act(() => sheet.button().onPress());
    const stale = sheet.controller.onNativeDismissed;
    sheet.reopen();
    expect(sheet.button().disabled).toBe(false);
    act(() => stale());
    expect(sheet.forward).not.toHaveBeenCalled();
    act(() => sheet.button().onPress());
    await act(async () => sheet.controller.onNativeDismissed());
    expect(sheet.forward).toHaveBeenCalledTimes(1);
    sheet.unmount();
  });

  it('does not re-enable an already running send when reopened', async () => {
    const sheet = renderForward(false);
    let finish!: () => void;
    sheet.forward.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    act(() => sheet.button().onPress());
    act(() =>
      sheet.tree.root.findByType(ActionSheet).props.onOpenChange(false)
    );
    sheet.reopen();
    expect(sheet.button().disabled).toBe(true);
    await act(async () => finish());
    sheet.unmount();
  });

  it('forwards synchronously on web without waiting for a native callback', async () => {
    environment.platform.OS = 'web';
    const sheet = renderForward();
    act(() => sheet.button().onPress());
    expect(sheet.forward).toHaveBeenCalledTimes(1);
    await act(async () => {});
    sheet.unmount();
  });
});

describe('notes row handoffs', () => {
  it.each(['ios', 'android'])(
    'retains the %s action menu until completion',
    (platform) => {
      environment.platform.OS = platform;
      const rename = vi.fn();
      const folder = { id: 'folder' } as db.NotesFolder;
      let tree: ReturnType<typeof create>;
      act(() => {
        tree = create(
          <FolderTreeRow
            canEdit
            folder={folder}
            isDeleting={false}
            label="Folder"
            noteCount={0}
            onDelete={vi.fn()}
            onCreateFolder={vi.fn()}
            onCreateNote={vi.fn()}
            onMove={vi.fn()}
            onPress={vi.fn()}
            onRename={rename}
          />
        );
      });
      act(() =>
        tree.root
          .find((node) => node.type === ('Pressable' as React.ElementType))
          .props.onLongPress()
      );
      const action = tree!.root
        .findByType(NotesActionMenu)
        .props.groups.flatMap(
          (group: { actions: { title: string; action: () => void }[] }) =>
            group.actions
        )
        .find((action: { title: string }) => action.title === 'Rename folder');
      act(() =>
        tree.root.findByType(NotesActionMenu).props.onAction(action.action)
      );
      expect(rename).not.toHaveBeenCalled();
      expect(tree!.root.findByType(NotesActionMenu).props.open).toBe(false);
      const complete =
        tree!.root.findByType(NotesActionMenu).props.onNativeDismissed;
      act(() => complete());
      expect(rename).toHaveBeenCalledWith(folder);
      expect(tree!.root.findAllByType(NotesActionMenu)).toHaveLength(0);
      act(() => tree.unmount());
    }
  );
});

import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ActionSheet } from '../ActionSheet';
import { NotesActionMenu } from '../NotesChannel/NotesActions';
import { BucketItem, BucketsNewSheet, BucketsPane } from './BucketsChannel';

const environment = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  narrow: true,
}));
vi.mock('react-native', () => ({ Platform: environment.platform }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
  }: {
    data: BucketItem[];
    renderItem: (info: { item: BucketItem }) => React.ReactNode;
  }) =>
    data.map((item) => (
      <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
    )),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: () => null,
  FilePreview: Object.assign(() => null, { fileExtensionFrom: () => 'txt' }),
  Icon: () => null,
  Pressable: 'Pressable',
  Text: () => null,
  useIsWindowNarrow: () => environment.narrow,
}));
vi.mock('tamagui', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => children;
  return {
    ScrollView: Container,
    View: Container,
    XStack: Container,
    YStack: Container,
    getTokenValue: () => 16,
  };
});
vi.mock('../ActionSheet', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => children;
  const Empty = () => null;
  return {
    ActionSheet: Object.assign(Container, {
      Action: Empty,
      ActionGroup: Container,
      Content: Container,
      FormBlock: Container,
      SimpleHeader: Empty,
    }),
    createActionGroups: (...groups: ([string, ...unknown[]] | false)[]) =>
      groups.filter(Boolean).map((group) => {
        const [accent, ...actions] = group as [string, ...unknown[]];
        return { accent, actions: actions.filter(Boolean) };
      }),
  };
});
vi.mock('../Badge', () => ({ Badge: () => null }));
vi.mock('../Form', () => ({ TextInput: () => null }));
vi.mock('../ListItem', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => children;
  return {
    ListItem: Object.assign(Container, {
      EndContent: Container,
      MainContent: Container,
      Subtitle: Container,
      SystemIcon: () => null,
      Title: Container,
    }),
  };
});
vi.mock('../NotesChannel/NotesActions', () => ({
  NotesActionMenu: () => null,
}));
vi.mock('../OverflowMenuButton', () => ({ OverflowTriggerButton: () => null }));
vi.mock('../ScreenHeader', () => ({ ScreenHeader: () => null }));
vi.mock('../SearchBar', () => ({ SearchBar: () => null }));
vi.mock('./BucketsDropTarget', () => ({
  BucketsDropTarget: ({ children }: { children?: React.ReactNode }) => children,
}));

beforeAll(() => {
  vi.stubGlobal('React', React);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterAll(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});
beforeEach(() => {
  environment.platform.OS = 'ios';
  environment.narrow = true;
});

function renderNewSheet() {
  let tree: ReturnType<typeof create>;
  const upload = vi.fn();
  const photos = vi.fn();
  function Probe() {
    const [open, setOpen] = useState(true);
    return (
      <BucketsNewSheet
        open={open}
        onOpenChange={setOpen}
        onNewFolder={vi.fn()}
        onChoosePhotos={photos}
        onUploadFiles={upload}
      />
    );
  }
  act(() => {
    tree = create(<Probe />);
  });
  const sheet = () => tree.root.findByType(ActionSheet);
  return {
    upload,
    photos,
    sheet,
    choose: (title: string) =>
      act(() => {
        tree.root
          .findAllByType(ActionSheet.Action)
          .find((node) => node.props.action?.title === title)!
          .props.action.action();
      }),
    unmount: () => act(() => tree.unmount()),
  };
}

describe('buckets new-sheet handoffs', () => {
  it.each([
    ['ios', 'Upload files', 'upload'],
    ['ios', 'Choose photos', 'photos'],
    ['android', 'Upload files', 'upload'],
    ['android', 'Choose photos', 'photos'],
  ] as const)(
    'opens the %s picker for "%s" only after the sheet has dismissed',
    (platform, title, picker) => {
      environment.platform.OS = platform;
      const sheet = renderNewSheet();
      sheet.choose(title);
      expect(sheet.sheet().props.open).toBe(false);
      expect(sheet[picker]).not.toHaveBeenCalled();
      const complete = sheet.sheet().props.onNativeDismissed;
      act(() => complete());
      act(() => complete());
      expect(sheet[picker]).toHaveBeenCalledTimes(1);
      sheet.unmount();
    }
  );

  it.each(['web', 'wide'])(
    'opens the picker in the same tick on %s, where nothing dismisses natively',
    (mode) => {
      if (mode === 'web') environment.platform.OS = 'web';
      else environment.narrow = false;
      const sheet = renderNewSheet();
      sheet.choose('Upload files');
      expect(sheet.sheet().props.open).toBe(false);
      expect(sheet.upload).toHaveBeenCalledTimes(1);
      sheet.unmount();
    }
  );
});

describe('buckets row-menu handoffs', () => {
  const item: BucketItem = {
    id: '7',
    kind: 'file',
    name: 'notes.txt',
    author: '~zod',
    modifiedLabel: 'now',
  };

  function renderRow() {
    let tree: ReturnType<typeof create>;
    const rename = vi.fn();
    act(() => {
      tree = create(
        <BucketsPane
          canEdit
          items={[item]}
          onOpenItem={vi.fn()}
          onRenameItem={rename}
        />
      );
    });
    const menu = () => tree.root.findByType(NotesActionMenu);
    act(() =>
      tree.root
        .find((node) => (node.type as unknown) === 'Pressable')
        .props.onLongPress()
    );
    const renameAction = menu()
      .props.groups.flatMap(
        (group: { actions: { title: string; action: () => void }[] }) =>
          group.actions
      )
      .find((action: { title: string }) => action.title === 'Rename file');
    return {
      rename,
      menu,
      chooseRename: () => act(() => menu().props.onAction(renameAction.action)),
      unmount: () => act(() => tree.unmount()),
    };
  }

  it.each(['ios', 'android'])(
    'opens the %s rename sheet only after the menu has dismissed',
    (platform) => {
      environment.platform.OS = platform;
      const row = renderRow();
      expect(row.menu().props.open).toBe(true);
      row.chooseRename();
      expect(row.menu().props.open).toBe(false);
      expect(row.rename).not.toHaveBeenCalled();
      act(() => row.menu().props.onNativeDismissed());
      expect(row.rename).toHaveBeenCalledWith(item);
      row.unmount();
    }
  );

  it('runs the action in the same tick on web', () => {
    environment.platform.OS = 'web';
    const row = renderRow();
    row.chooseRename();
    expect(row.menu().props.open).toBe(false);
    expect(row.rename).toHaveBeenCalledWith(item);
    row.unmount();
  });
});

import { NavigationContext } from '@react-navigation/native';
import type { BucketsEntry } from '@tloncorp/api';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { BucketsLiveChannel } from './BucketsLiveChannel';

const mocks = vi.hoisted(() => ({
  entries: [] as unknown[],
  headerItem: null as { props: { onSearch: () => void } } | null,
  loading: false,
  narrow: true,
  pane: vi.fn((_props: Record<string, unknown>) => null),
  search: vi.fn((_props: Record<string, unknown>) => null),
  viewer: vi.fn((_props: Record<string, unknown>) => null),
}));

vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    StackActions: {
      push: (name: string, params: object) => ({
        type: 'PUSH',
        payload: { name, params },
      }),
    },
  };
});
vi.mock('@tloncorp/api', () => ({ isBotUserId: () => false }));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/ui', () => ({
  ConfirmDialog: () => null,
  Text: () => null,
  useToast: () => vi.fn(),
}));
vi.mock('expo-document-picker', () => ({}));
vi.mock('expo-image-picker', () => ({
  useMediaLibraryPermissions: () => [null, vi.fn()],
}));
vi.mock('react-native', () => ({
  Linking: { openURL: vi.fn() },
  useWindowDimensions: () => ({ height: 800, width: 400 }),
}));
vi.mock('../../ui', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => children;
  return {
    BucketFileViewer: mocks.viewer,
    BucketsHeaderActions: () => null,
    BucketsMoveSheet: () => null,
    BucketsNewSheet: () => null,
    BucketsPane: mocks.pane,
    BucketsRenameSheet: () => null,
    BucketsSearchScreen: mocks.search,
    ChannelHeader: () => null,
    ChannelHeaderItemsProvider: Container,
    ScreenHeader: () => null,
    XStack: Container,
    YStack: Container,
    canPreviewAsText: () => false,
    useCanWrite: () => true,
    useCurrentUserId: () => '~zod',
    useHideChannelHeader: () => undefined,
    useIsWindowNarrow: () => mocks.narrow,
    useRegisterChannelHeaderItem: (item: typeof mocks.headerItem) => {
      mocks.headerItem = item;
    },
  };
});
vi.mock('./bucketLinkCopy', () => ({}));
vi.mock('./bucketMediaPicker', () => ({}));
vi.mock('./bucketUploadReconciliation', () => ({
  findUploadShadowEntryIds: () => new Set(),
}));
vi.mock('./useLiveBucket', () => ({
  formatBucketTimestamp: () => 'Just now',
  formatFileSize: () => '1 KB',
  useLiveBucket: () => ({
    entries: mocks.entries,
    error: null,
    loading: mocks.loading,
    localItems: [],
    readGrant: () => new Promise(() => {}),
    uploads: [],
  }),
}));

const stamps = {
  createdAt: 0,
  createdBy: '~zod',
  updatedAt: 0,
  updatedBy: '~zod',
};
const photos: BucketsEntry = {
  ...stamps,
  id: 1,
  kind: 'folder',
  name: 'Photos',
  parentId: null,
};
const notes: BucketsEntry = {
  ...stamps,
  file: {
    checksum: null,
    mime: 'text/plain',
    objectKey: 'notes',
    size: 1024,
    status: 'ready',
  },
  id: 2,
  kind: 'file',
  name: 'notes.txt',
  parentId: 1,
};
const channel = {
  groupId: '~zod/new-tlon',
  id: 'buckets/~zod/files',
  title: 'Bucket',
  type: 'buckets',
} as never;
const flag = { host: '~zod', name: 'files' };

type Navigation = {
  dispatch: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
};

function navigationMock(): Navigation {
  return { dispatch: vi.fn(), goBack: vi.fn() };
}

function element(navigation: Navigation | undefined, folderId?: number) {
  const channelView = (
    <BucketsLiveChannel
      channel={channel}
      embedded
      flag={flag}
      folderId={folderId}
    />
  );
  return navigation ? (
    <NavigationContext.Provider value={navigation as never}>
      {channelView}
    </NavigationContext.Provider>
  ) : (
    channelView
  );
}

function render(navigation: Navigation | undefined, folderId?: number) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(element(navigation, folderId));
  });
  return {
    rerender: () => act(() => tree.update(element(navigation, folderId))),
  };
}

function stackPane() {
  const calls = mocks.pane.mock.calls.filter(
    ([props]) => props.layout === 'stack'
  );
  return calls[calls.length - 1][0] as {
    currentFolder?: string;
    items: { name: string }[];
    showBreadcrumb?: boolean;
    onOpenItem: (item: object) => void;
  };
}

function pushed(name: string, params: object) {
  return { type: 'PUSH', payload: { name, params } };
}

setupReactTestEnvironment();
beforeEach(() => {
  mocks.entries = [photos, notes];
  mocks.headerItem = null;
  mocks.loading = false;
  mocks.narrow = true;
  mocks.pane.mockClear();
  mocks.search.mockClear();
  mocks.viewer.mockClear();
});

describe('BucketsLiveChannel on the narrow layout', () => {
  it('pushes a folder, so the stack can take it back a level', () => {
    const navigation = navigationMock();
    render(navigation);

    act(() => stackPane().onOpenItem(stackPane().items[0]));

    expect(navigation.dispatch).toHaveBeenCalledWith(
      pushed('BucketFolder', {
        channelId: 'buckets/~zod/files',
        folderId: 1,
        groupId: '~zod/new-tlon',
      })
    );
    expect(stackPane().currentFolder).toBeUndefined();
  });

  it('pushes a file rather than previewing it in place', () => {
    const navigation = navigationMock();
    render(navigation, 1);

    act(() => stackPane().onOpenItem(stackPane().items[0]));

    expect(navigation.dispatch).toHaveBeenCalledWith(
      pushed('BucketFile', {
        channelId: 'buckets/~zod/files',
        entryId: 2,
        groupId: '~zod/new-tlon',
      })
    );
    expect(mocks.viewer).not.toHaveBeenCalled();
  });

  it('lists a pushed folder without a breadcrumb, since its header leads back', () => {
    render(navigationMock(), 1);

    expect(stackPane().items.map((item) => item.name)).toEqual(['notes.txt']);
    expect(stackPane().currentFolder).toBe('Photos');
    expect(stackPane().showBreadcrumb).toBe(false);
  });

  it('leaves a pushed folder once when someone else deletes it', () => {
    const navigation = navigationMock();
    const { rerender } = render(navigation, 1);

    mocks.entries = [notes];
    rerender();
    mocks.loading = true;
    rerender();
    mocks.loading = false;
    rerender();

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('pushes a search result and keeps the search open beneath it', () => {
    const navigation = navigationMock();
    const { rerender } = render(navigation);

    act(() => mocks.headerItem?.props.onSearch());
    const searchRenders = mocks.search.mock.calls.length;
    const paneRenders = mocks.pane.mock.calls.length;
    const { onOpenResult } = mocks.search.mock.lastCall?.[0] as {
      onOpenResult: (result: object) => void;
    };
    act(() =>
      onOpenResult({
        id: '2',
        kind: 'file',
        name: 'notes.txt',
        parentFolderId: '1',
      })
    );

    expect(navigation.dispatch).toHaveBeenCalledWith(
      pushed('BucketFile', {
        channelId: 'buckets/~zod/files',
        entryId: 2,
        groupId: '~zod/new-tlon',
      })
    );
    rerender();
    expect(mocks.search.mock.calls.length).toBeGreaterThan(searchRenders);
    expect(mocks.pane.mock.calls.length).toBe(paneRenders);
  });
});

describe('BucketsLiveChannel on the desktop split', () => {
  it('opens a folder in place, with the breadcrumb as the way up', () => {
    mocks.narrow = false;
    const navigation = navigationMock();
    render(navigation);

    act(() => stackPane().onOpenItem(stackPane().items[0]));

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(stackPane().currentFolder).toBe('Photos');
    expect(stackPane().showBreadcrumb).toBe(true);
  });
});

describe('BucketsLiveChannel outside a navigator', () => {
  it('keeps folders in the pane, where nothing could push them', () => {
    render(undefined);

    act(() => stackPane().onOpenItem(stackPane().items[0]));

    expect(stackPane().currentFolder).toBe('Photos');
    expect(stackPane().items.map((item) => item.name)).toEqual(['notes.txt']);
  });
});

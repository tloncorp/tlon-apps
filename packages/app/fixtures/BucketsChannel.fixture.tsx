import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo, useState } from 'react';
import { Linking, useWindowDimensions } from 'react-native';

import {
  BucketFileViewer,
  BucketItem,
  BucketSearchResult,
  BucketsHeaderActions,
  BucketsNewSheet,
  BucketsPane,
  BucketsPaneState,
  BucketsSearchScreen,
  ChannelHeader,
  ChannelHeaderItemsProvider,
  ScreenHeader,
  XStack,
  YStack,
  useIsWindowNarrow,
  useRegisterChannelHeaderItem,
} from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

const rootFolders: BucketItem[] = [
  folder('launch', 'Launch', 6),
  folder('brand', 'Brand', 12),
  folder('research', 'Research', 8),
  folder('archive', 'Archive', 24),
];

const searchRevealFolder = folder('field-notes', 'Field notes', 48);
const searchRevealFiles = Array.from({ length: 48 }, (_, index) =>
  file(
    `field-record-${index}`,
    index === 24 ? 'meadow-survey.pdf' : `site-record-${index + 1}.pdf`,
    index === 24 ? '~marzod' : '~zod',
    index === 24 ? 'Yesterday' : 'Last week',
    index === 24 ? '4.2 MB' : '1.8 MB',
    'application/pdf'
  )
);

const initialFiles: Record<string, BucketItem[]> = {
  root: [],
  launch: [
    file(
      'launch-brief',
      'launch-brief.pdf',
      '~zod',
      '12 min ago',
      '2.4 MB',
      'application/pdf',
      false,
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    ),
    file(
      'homepage-final',
      'homepage-final.fig',
      '~marzod',
      'Today',
      '18.1 MB',
      'application/x-figma'
    ),
    file(
      'demo-cut',
      'demo-cut.mp4',
      'Scout',
      'Today',
      '84.6 MB',
      'video/mp4',
      true,
      'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4'
    ),
    {
      ...file(
        'assets-pack',
        'assets-pack.zip',
        '~zod',
        'Uploading',
        '146 MB',
        'application/zip'
      ),
      uploadProgress: 42,
    },
  ],
  brand: [
    file(
      'brand-system',
      'brand-system.pdf',
      '~marzod',
      'Yesterday',
      '6.8 MB',
      'application/pdf'
    ),
    file(
      'wordmark',
      'wordmark.svg',
      '~zod',
      'Monday',
      '38 KB',
      'image/svg+xml',
      false,
      'https://d2w9rnfcy7mm78.cloudfront.net/25296321/original_81eb3ac8a95ce36dc8d64b1038234ec8.jpg'
    ),
  ],
  research: [
    file(
      'member-notes',
      'member-interviews.md',
      'Scout',
      'Yesterday',
      '24 KB',
      'text/markdown',
      true,
      'data:text/plain,',
      '# Field interviews\n\nScout collected these notes during the first research pass.\n\n- Members want one shared place for project files.\n- Bots should use the same permissions as people.\n- Large uploads need visible progress and retry.'
    ),
  ],
  archive: [],
};

const fakeChannel = {
  id: 'buckets/~zod/project-files',
  type: 'gallery',
  title: 'Project Files',
  description: '',
} as db.Channel;

type FixtureState = BucketsPaneState | 'read-only';
type SearchOrigin = {
  activeFolderId: string | null;
  selectedItemId: string | null;
};

function folder(id: string, name: string, itemCount: number): BucketItem {
  return {
    id,
    kind: 'folder',
    name,
    author: '',
    modifiedLabel: '',
    itemCount,
  };
}

function file(
  id: string,
  name: string,
  author: string,
  modifiedLabel: string,
  sizeLabel: string,
  mimeType: string,
  isBot = false,
  previewUri?: string,
  textContent?: string
): BucketItem {
  return {
    id,
    kind: 'file',
    name,
    author,
    isBot,
    mimeType,
    modifiedLabel,
    previewUri,
    sizeLabel,
    textContent,
  };
}

function BucketsFixture({
  initialFolderId,
  includeSearchRevealFolder = false,
  initialSearchQuery = '',
  newSheetInitiallyOpen = false,
  searchInitiallyOpen = false,
  state = 'populated',
  viewport,
}: {
  initialFolderId?: string | null;
  includeSearchRevealFolder?: boolean;
  initialSearchQuery?: string;
  newSheetInitiallyOpen?: boolean;
  searchInitiallyOpen?: boolean;
  state?: FixtureState;
  viewport: 'mobile' | 'desktop' | 'responsive';
}) {
  const { height: windowHeight } = useWindowDimensions();
  const folders = useMemo(
    () =>
      includeSearchRevealFolder
        ? [...rootFolders, searchRevealFolder]
        : rootFolders,
    [includeSearchRevealFolder]
  );
  const isWindowNarrow = useIsWindowNarrow();
  const isMobileLayout =
    viewport === 'mobile' || (viewport === 'responsive' && isWindowNarrow);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(
    initialFolderId === undefined
      ? isMobileLayout
        ? null
        : 'launch'
      : initialFolderId
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    activeFolderId === 'launch' ? 'launch-brief' : null
  );
  const [newSheetOpen, setNewSheetOpen] = useState(newSheetInitiallyOpen);
  const [searchOpen, setSearchOpen] = useState(searchInitiallyOpen);
  const [searchOrigin, setSearchOrigin] = useState<SearchOrigin | null>(null);
  const [query, setQuery] = useState(initialSearchQuery);
  const [previewItem, setPreviewItem] = useState<BucketItem | null>(null);
  const [localFiles, setLocalFiles] = useState(() =>
    includeSearchRevealFolder
      ? { ...initialFiles, 'field-notes': searchRevealFiles }
      : initialFiles
  );
  const canEdit = state !== 'read-only';
  const paneState: BucketsPaneState =
    state === 'read-only' ? 'populated' : state;
  const activeFolder = folders.find((item) => item.id === activeFolderId);
  const currentKey = activeFolderId ?? 'root';
  const rootItems = [...folders, ...(localFiles.root ?? [])];
  const visibleItems = activeFolderId
    ? localFiles[currentKey] ?? []
    : rootItems;
  const allSearchResults = useMemo<BucketSearchResult[]>(() => {
    const results: BucketSearchResult[] = folders.map((item) => ({
      ...item,
      parentFolderId: null,
      pathLabel: 'Project Files',
    }));

    Object.entries(localFiles).forEach(([folderId, items]) => {
      const parentFolder = folders.find((item) => item.id === folderId);
      const pathLabel = parentFolder
        ? `Project Files / ${parentFolder.name}`
        : 'Project Files';

      items.forEach((item) => {
        results.push({
          ...item,
          parentFolderId: parentFolder?.id ?? null,
          pathLabel,
        });
      });
    });

    return results;
  }, [folders, localFiles]);
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? allSearchResults.filter((item) =>
        [item.name, item.pathLabel, item.author, item.mimeType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : [];

  useEffect(() => {
    if (!isMobileLayout && activeFolderId === null) {
      setActiveFolderId('launch');
    }
  }, [activeFolderId, isMobileLayout]);

  const openItem = (item: BucketItem) => {
    if (item.kind === 'folder') {
      setActiveFolderId(item.id);
      setSelectedItemId(null);
      setQuery('');
      return;
    }
    setSelectedItemId(item.id);
    if (item.previewUri) {
      setPreviewItem(item);
    }
  };

  const addFolder = () => {
    const item = folder(`new-folder-${Date.now()}`, 'New folder', 0);
    setLocalFiles((current) => ({
      ...current,
      [currentKey]: [item, ...(current[currentKey] ?? [])],
    }));
  };

  const addUpload = () => {
    const item = {
      ...file(
        `field-photo-${Date.now()}`,
        'field-photo.jpg',
        '~zod',
        'Uploading',
        '4.8 MB',
        'image/jpeg'
      ),
      uploadProgress: 18,
    };
    setLocalFiles((current) => ({
      ...current,
      [currentKey]: [item, ...(current[currentKey] ?? [])],
    }));
  };

  const openSearch = () => {
    setSearchOrigin({ activeFolderId, selectedItemId });
    setSearchOpen(true);
    setQuery('');
  };

  const closeSearch = () => {
    if (searchOrigin) {
      setActiveFolderId(searchOrigin.activeFolderId);
      setSelectedItemId(searchOrigin.selectedItemId);
    }
    setSearchOrigin(null);
    setSearchOpen(false);
    setQuery('');
  };

  const openSearchResult = (result: BucketSearchResult) => {
    setSearchOrigin((current) => current ?? { activeFolderId, selectedItemId });
    if (result.kind === 'folder') {
      setActiveFolderId(result.id);
      setSelectedItemId(null);
    } else {
      setActiveFolderId(result.parentFolderId);
      setSelectedItemId(result.id);
    }
    setSearchOpen(false);
  };

  const paneProps = {
    canEdit,
    currentFolder: isMobileLayout ? undefined : activeFolder?.name,
    items: paneState === 'empty' ? [] : visibleItems,
    selectedItemId,
    state: paneState,
    onOpenItem: openItem,
    onDeleteItem: (item: BucketItem) =>
      setLocalFiles((current) => ({
        ...current,
        [currentKey]: (current[currentKey] ?? []).filter(
          (candidate) => candidate.id !== item.id
        ),
      })),
    onDownloadItem: (item: BucketItem) => setSelectedItemId(item.id),
    onMoveItem: (item: BucketItem) => setSelectedItemId(item.id),
    onRenameItem: (item: BucketItem) => setSelectedItemId(item.id),
  };

  return (
    <FixtureWrapper fillWidth fillHeight backgroundColor="$secondaryBackground">
      <YStack width="100%" height={windowHeight}>
        <ChannelHeaderItemsProvider>
          {previewItem?.previewUri ? (
            <BucketFileViewer
              item={{
                name: previewItem.name,
                mimeType: previewItem.mimeType,
                sizeLabel: previewItem.sizeLabel,
                textContent: previewItem.textContent,
                uri: previewItem.previewUri,
              }}
              onClose={() => setPreviewItem(null)}
              onOpenExternally={() => Linking.openURL(previewItem.previewUri!)}
            />
          ) : searchOpen ? (
            <BucketsSearchScreen
              query={query}
              results={searchResults}
              onChangeQuery={setQuery}
              onClose={closeSearch}
              onOpenResult={openSearchResult}
            />
          ) : isMobileLayout ? (
            <YStack
              flex={1}
              width="100%"
              height="100%"
              backgroundColor="$background"
            >
              <RegisteredHeaderActions
                canEdit={canEdit}
                onNew={() => setNewSheetOpen(true)}
                onSearch={openSearch}
              />
              <ChannelHeader
                channel={fakeChannel}
                description=""
                goToSearch={openSearch}
                goBack={() => {
                  if (searchOrigin) {
                    setSearchOpen(true);
                    return;
                  }
                  if (activeFolderId) {
                    setActiveFolderId(null);
                    setSelectedItemId(null);
                  }
                }}
                hideIdentity
                preferProvidedTitle
                showSearchButton
                title={activeFolder?.name ?? 'Project Files'}
              />
              <BucketsPane {...paneProps} layout="stack" />
              <BucketsNewSheet
                open={newSheetOpen}
                onNewFolder={addFolder}
                onOpenChange={setNewSheetOpen}
                onUploadFiles={addUpload}
              />
            </YStack>
          ) : (
            <XStack flex={1} width="100%" height="100%">
              <YStack
                width={325}
                height="100%"
                backgroundColor="$background"
                borderRightColor="$border"
                borderRightWidth={1}
              >
                <ScreenHeader
                  backAction={
                    searchOrigin ? () => setSearchOpen(true) : undefined
                  }
                  borderBottom
                  title="Project Files"
                />
                <BucketsPane
                  canEdit={canEdit}
                  items={folders}
                  layout="takeover"
                  selectedItemId={activeFolderId}
                  state="populated"
                  onOpenItem={openItem}
                />
              </YStack>
              <YStack flex={1} minWidth={0} backgroundColor="$background">
                <ScreenHeader
                  borderBottom
                  rightControls={
                    <BucketsHeaderActions
                      canEdit={canEdit}
                      onNew={() => setNewSheetOpen(true)}
                      onSearch={openSearch}
                    />
                  }
                  showSubtitle
                  subtitle="Bucket"
                  title="Project Files"
                  useHorizontalTitleLayout
                />
                <BucketsPane {...paneProps} layout="stack" />
                <BucketsNewSheet
                  open={newSheetOpen}
                  onNewFolder={addFolder}
                  onOpenChange={setNewSheetOpen}
                  onUploadFiles={addUpload}
                />
              </YStack>
            </XStack>
          )}
        </ChannelHeaderItemsProvider>
      </YStack>
    </FixtureWrapper>
  );
}

function RegisteredHeaderActions({
  canEdit,
  onNew,
  onSearch,
}: {
  canEdit: boolean;
  onNew: () => void;
  onSearch: () => void;
}) {
  const actions = useMemo(
    () => (
      <BucketsHeaderActions
        canEdit={canEdit}
        onNew={onNew}
        onSearch={onSearch}
        showSearch={false}
      />
    ),
    [canEdit, onNew, onSearch]
  );
  useRegisterChannelHeaderItem(actions);
  return null;
}

export default {
  Mobile: <BucketsFixture viewport="mobile" />,
  'Mobile folder': (
    <BucketsFixture viewport="mobile" initialFolderId="launch" />
  ),
  Desktop: <BucketsFixture viewport="responsive" />,
  Search: <BucketsFixture viewport="responsive" searchInitiallyOpen />,
  'Search reveal': (
    <BucketsFixture
      viewport="responsive"
      searchInitiallyOpen
      includeSearchRevealFolder
      initialSearchQuery="meadow"
    />
  ),
  'New action': <BucketsFixture viewport="mobile" newSheetInitiallyOpen />,
  Empty: <BucketsFixture viewport="mobile" state="empty" />,
  Loading: <BucketsFixture viewport="mobile" state="loading" />,
  'Read only': <BucketsFixture viewport="responsive" state="read-only" />,
};

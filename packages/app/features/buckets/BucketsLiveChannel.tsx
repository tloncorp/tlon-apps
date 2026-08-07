import type { BucketsEntry, BucketsFlag } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ReactElement, useMemo, useState } from 'react';
import { Linking, useWindowDimensions } from 'react-native';

import {
  BucketFileViewer,
  BucketItem,
  BucketSearchResult,
  BucketUploadCandidate,
  BucketsHeaderActions,
  BucketsNewSheet,
  BucketsPane,
  BucketsSearchScreen,
  ChannelHeader,
  ChannelHeaderItemsProvider,
  ScreenHeader,
  XStack,
  YStack,
  getBucketPreviewKind,
  useCanWrite,
  useCurrentUserId,
  useIsWindowNarrow,
  useRegisterChannelHeaderItem,
} from '../../ui';
import { imagePickerAssetsToBucketUploadCandidates } from './bucketMediaPicker';
import {
  formatBucketTimestamp,
  formatFileSize,
  useLiveBucket,
} from './useLiveBucket';

type SearchOrigin = {
  activeFolderId: number | null;
  selectedItemId: string | null;
};

function toItem(entry: BucketsEntry, entries: BucketsEntry[]): BucketItem {
  if (entry.kind === 'folder') {
    return {
      author: entry.updatedBy,
      id: String(entry.id),
      itemCount: entries.filter((candidate) => candidate.parentId === entry.id)
        .length,
      kind: 'folder',
      modifiedLabel: formatBucketTimestamp(entry.updatedAt),
      name: entry.name,
    };
  }

  return {
    author: entry.updatedBy,
    id: String(entry.id),
    kind: 'file',
    mimeType: entry.file.mime,
    modifiedLabel: formatBucketTimestamp(entry.updatedAt),
    name: entry.name,
    previewUri:
      entry.file.status === 'ready'
        ? entry.file.objectUrl ?? undefined
        : undefined,
    sizeLabel: formatFileSize(entry.file.size),
    uploadError:
      entry.file.status === 'failed'
        ? 'The object was not finalized'
        : undefined,
    uploadProgress: entry.file.status === 'pending' ? 0 : undefined,
    uploadState:
      entry.file.status === 'pending'
        ? 'uploading'
        : entry.file.status === 'failed'
          ? 'failed'
          : undefined,
  };
}

function sortItems(items: BucketItem[]) {
  return [...items].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

function pathLabelFor(
  entry: BucketsEntry,
  entries: BucketsEntry[],
  rootLabel: string
) {
  const names: string[] = [];
  let parentId = entry.parentId;
  while (parentId !== null) {
    const parent = entries.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return [rootLabel, ...names].join(' / ');
}

export function BucketsLiveChannel({
  channel: providedChannel,
  embedded = false,
  flag,
  viewport = 'responsive',
}: {
  channel?: db.Channel;
  embedded?: boolean;
  flag: BucketsFlag;
  viewport?: 'mobile' | 'responsive';
}) {
  const { height: windowHeight } = useWindowDimensions();
  const isWindowNarrow = useIsWindowNarrow();
  const isMobileLayout = viewport === 'mobile' || isWindowNarrow;
  const live = useLiveBucket(flag);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchOrigin, setSearchOrigin] = useState<SearchOrigin | null>(null);
  const [query, setQuery] = useState('');
  const [previewItem, setPreviewItem] = useState<BucketItem | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const entries = useMemo(
    () => live.snapshot?.state.entries ?? [],
    [live.snapshot?.state.entries]
  );
  const suppressedIds = useMemo(
    () =>
      new Set(
        live.uploads
          .map((upload) => upload.serverEntryId)
          .filter((id): id is number => id !== undefined)
      ),
    [live.uploads]
  );
  const serverEntries = useMemo(
    () => entries.filter((entry) => !suppressedIds.has(entry.id)),
    [entries, suppressedIds]
  );
  const rootLabel = live.snapshot?.state.bucket.title ?? 'Bucket';
  const activeFolder = entries.find(
    (entry) => entry.kind === 'folder' && entry.id === activeFolderId
  );
  const rootFolders = serverEntries.filter(
    (entry) => entry.kind === 'folder' && entry.parentId === null
  );
  const visibleServerItems = serverEntries
    .filter((entry) => entry.parentId === activeFolderId)
    .map((entry) => toItem(entry, entries));
  const visibleLocalItems = live.uploads
    .filter((upload) => upload.parentId === activeFolderId)
    .map((upload) => live.localItems.find((item) => item.id === upload.id))
    .filter((item): item is BucketItem => item !== undefined);
  const visibleItems = sortItems([...visibleLocalItems, ...visibleServerItems]);
  const sidebarItems = sortItems(
    rootFolders.map((entry) => toItem(entry, entries))
  );
  const allSearchResults = useMemo<BucketSearchResult[]>(
    () =>
      serverEntries.map((entry) => ({
        ...toItem(entry, entries),
        parentFolderId: entry.parentId === null ? null : String(entry.parentId),
        pathLabel: pathLabelFor(entry, entries, rootLabel),
      })),
    [entries, rootLabel, serverEntries]
  );
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

  const fallbackChannel = useMemo(
    () =>
      ({
        description: '',
        id: `buckets/${flag.host}/${flag.name}`,
        title: rootLabel,
        type: 'buckets',
      }) as db.Channel,
    [flag.host, flag.name, rootLabel]
  );
  const channel = providedChannel ?? fallbackChannel;
  const currentUserId = useCurrentUserId();
  const canEdit = useCanWrite(channel, currentUserId);

  const reportOperation = async (operation: Promise<unknown>) => {
    try {
      setOperationError(null);
      await operation;
      await live.refresh();
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const openItem = async (item: BucketItem) => {
    if (item.kind === 'folder') {
      setActiveFolderId(Number(item.id));
      setSelectedItemId(null);
      return;
    }
    setSelectedItemId(item.id);
    let previewUri = item.previewUri;
    if (!previewUri) {
      try {
        setOperationError(null);
        previewUri = await live.readUrl(Number(item.id));
      } catch (cause) {
        setOperationError(
          cause instanceof Error ? cause.message : String(cause)
        );
        return;
      }
    }

    const readableItem = { ...item, previewUri };
    setPreviewItem(readableItem);
    if (
      getBucketPreviewKind(readableItem) === 'text' &&
      !readableItem.textContent
    ) {
      try {
        const response = await fetch(previewUri);
        if (!response.ok) return;
        const textContent = await response.text();
        setPreviewItem((current) =>
          current?.id === item.id ? { ...current, textContent } : current
        );
      } catch {
        // The viewer can still offer the external open action.
      }
    }
  };

  const chooseUploads = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: '*/*',
    });
    if (!result.assets?.length) return;
    const candidates: BucketUploadCandidate[] = result.assets.map((asset) => ({
      mimeType: asset.mimeType ?? undefined,
      name: asset.name,
      size: asset.size ?? -1,
      uri: asset.uri,
    }));
    live.addUploads(candidates, activeFolderId);
  };

  const choosePhotos = async () => {
    try {
      setOperationError(null);
      if (mediaLibraryPermissionStatus?.granted === false) {
        const permissionResult = await requestMediaLibraryPermission();
        if (!permissionResult.granted) {
          setOperationError(
            'Photo library access is required to choose photos.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        exif: false,
        mediaTypes: ['images', 'videos'],
        orderedSelection: true,
        quality: 1,
        selectionLimit: 0,
        shouldDownloadFromNetwork: true,
      });
      if (result.canceled || !result.assets.length) return;

      live.addUploads(
        imagePickerAssetsToBucketUploadCandidates(result.assets),
        activeFolderId
      );
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : String(cause));
    }
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
      setActiveFolderId(Number(result.id));
      setSelectedItemId(null);
    } else {
      setActiveFolderId(
        result.parentFolderId === null ? null : Number(result.parentFolderId)
      );
      setSelectedItemId(result.id);
    }
    setSearchOpen(false);
  };

  const goBack = () => {
    if (searchOrigin) {
      setSearchOpen(true);
      return;
    }
    if (activeFolder) {
      setActiveFolderId(activeFolder.parentId);
      setSelectedItemId(null);
    }
  };

  const paneProps = {
    canEdit,
    currentFolder: isMobileLayout ? undefined : activeFolder?.name,
    items: visibleItems,
    rootLabel,
    selectedItemId,
    state: live.loading ? ('loading' as const) : ('populated' as const),
    onCancelUpload: (item: BucketItem) => void live.cancelUpload(item.id),
    onDeleteItem: (item: BucketItem) =>
      void reportOperation(
        live.deleteEntry(Number(item.id), item.kind === 'folder')
      ),
    onDownloadItem: (item: BucketItem) => {
      void live
        .readUrl(Number(item.id))
        .then((url) => Linking.openURL(url))
        .catch((cause) =>
          setOperationError(
            cause instanceof Error ? cause.message : String(cause)
          )
        );
    },
    onFilesDropped: (files: BucketUploadCandidate[]) =>
      live.addUploads(files, activeFolderId),
    onOpenItem: (item: BucketItem) => void openItem(item),
    onRetryUpload: (item: BucketItem) => void live.retryUpload(item.id),
  };

  const newSheet = (
    <BucketsNewSheet
      open={newSheetOpen}
      onNewFolder={(name) =>
        void reportOperation(live.createFolder(activeFolderId, name))
      }
      onOpenChange={setNewSheetOpen}
      onChoosePhotos={() => void choosePhotos()}
      onUploadFiles={() => void chooseUploads()}
    />
  );

  const errorMessage = operationError ?? live.error;

  return (
    <YStack
      width="100%"
      height={embedded ? '100%' : windowHeight}
      backgroundColor="$background"
    >
      <MaybeChannelHeaderItemsProvider embedded={embedded}>
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
            onOpenExternally={() =>
              void Linking.openURL(previewItem.previewUri!)
            }
          />
        ) : searchOpen ? (
          <BucketsSearchScreen
            bucketTitle={rootLabel}
            query={query}
            results={searchResults}
            onChangeQuery={setQuery}
            onClose={closeSearch}
            onOpenResult={openSearchResult}
          />
        ) : isMobileLayout ? (
          <YStack flex={1} width="100%" height="100%">
            <RegisteredLiveHeaderActions
              canEdit={canEdit}
              showSearch={embedded}
              onNew={() => setNewSheetOpen(true)}
              onSearch={openSearch}
            />
            {!embedded ? (
              <ChannelHeader
                channel={channel}
                description=""
                goBack={goBack}
                goToSearch={openSearch}
                hideIdentity
                preferProvidedTitle
                showSearchButton
                title={activeFolder?.name ?? rootLabel}
              />
            ) : null}
            {errorMessage ? <LiveError message={errorMessage} /> : null}
            <BucketsPane {...paneProps} layout="stack" />
            {newSheet}
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
              <ScreenHeader borderBottom title={rootLabel} />
              <BucketsPane
                canEdit={canEdit}
                items={sidebarItems}
                layout="takeover"
                rootLabel={rootLabel}
                selectedItemId={
                  rootFolders.some((folder) => folder.id === activeFolderId)
                    ? String(activeFolderId)
                    : null
                }
                state={live.loading ? 'loading' : 'populated'}
                onOpenItem={(item) => void openItem(item)}
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
                title={rootLabel}
                useHorizontalTitleLayout
              />
              {errorMessage ? <LiveError message={errorMessage} /> : null}
              <BucketsPane {...paneProps} layout="stack" />
              {newSheet}
            </YStack>
          </XStack>
        )}
      </MaybeChannelHeaderItemsProvider>
    </YStack>
  );
}

function LiveError({ message }: { message: string }) {
  return (
    <YStack
      backgroundColor="$negativeBackground"
      paddingHorizontal="$l"
      paddingVertical="$m"
    >
      <Text color="$negativeActionText" size="$label/m">
        {message}
      </Text>
    </YStack>
  );
}

function RegisteredLiveHeaderActions({
  canEdit,
  onNew,
  onSearch,
  showSearch,
}: {
  canEdit: boolean;
  onNew: () => void;
  onSearch: () => void;
  showSearch: boolean;
}) {
  const actions = useMemo(
    () => (
      <BucketsHeaderActions
        canEdit={canEdit}
        onNew={onNew}
        onSearch={onSearch}
        showSearch={showSearch}
      />
    ),
    [canEdit, onNew, onSearch, showSearch]
  );
  useRegisterChannelHeaderItem(actions);
  return null;
}

function MaybeChannelHeaderItemsProvider({
  children,
  embedded,
}: {
  children: ReactElement;
  embedded: boolean;
}) {
  return embedded ? (
    children
  ) : (
    <ChannelHeaderItemsProvider>{children}</ChannelHeaderItemsProvider>
  );
}

import {
  type BucketsEntry,
  type BucketsFlag,
  isBotUserId,
} from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { ConfirmDialog, Text } from '@tloncorp/ui';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, useWindowDimensions } from 'react-native';

import {
  BucketFileViewer,
  BucketItem,
  BucketSearchResult,
  BucketUploadCandidate,
  BucketsHeaderActions,
  BucketsMoveSheet,
  BucketsNewSheet,
  BucketsRenameSheet,
  BucketsPane,
  BucketsSearchScreen,
  ChannelHeader,
  ChannelHeaderItemsProvider,
  ScreenHeader,
  XStack,
  YStack,
  canPreviewAsText,
  useCanWrite,
  useCurrentUserId,
  useHideChannelHeader,
  useIsWindowNarrow,
  useRegisterChannelHeaderItem,
} from '../../ui';
import { imagePickerAssetsToBucketUploadCandidates } from './bucketMediaPicker';
import { findUploadShadowEntryIds } from './bucketUploadReconciliation';
import {
  formatBucketTimestamp,
  formatFileSize,
  useLiveBucket,
} from './useLiveBucket';

type SearchOrigin = {
  activeFolderId: number | null;
  selectedItemId: string | null;
};

function toItem(
  entry: BucketsEntry,
  childCounts: ReadonlyMap<number, number>
): BucketItem {
  if (entry.kind === 'folder') {
    return {
      author: entry.updatedBy,
      id: String(entry.id),
      isBot: isBotUserId(entry.updatedBy),
      itemCount: childCounts.get(entry.id) ?? 0,
      kind: 'folder',
      modifiedLabel: formatBucketTimestamp(entry.updatedAt),
      name: entry.name,
    };
  }

  return {
    author: entry.updatedBy,
    isBot: isBotUserId(entry.updatedBy),
    id: String(entry.id),
    kind: 'file',
    mimeType: entry.file.mime,
    modifiedLabel: formatBucketTimestamp(entry.updatedAt),
    name: entry.name,
    // Files are always fetched through a short-lived read grant, so there is
    // no URL to show until one is issued.
    previewUri: undefined,
    size: entry.file.size,
    sizeLabel: formatFileSize(entry.file.size),
    uploadSize: entry.file.status === 'pending' ? entry.file.size : undefined,
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
  entriesById: ReadonlyMap<number, BucketsEntry>,
  rootLabel: string
) {
  const names: string[] = [];
  let parentId = entry.parentId;
  while (parentId !== null) {
    const parent = entriesById.get(parentId);
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestId = useRef(0);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [folderPendingDeletion, setFolderPendingDeletion] =
    useState<BucketItem | null>(null);
  const [itemPendingRename, setItemPendingRename] = useState<BucketItem | null>(
    null
  );
  const [itemPendingMove, setItemPendingMove] = useState<BucketItem | null>(
    null
  );
  const currentUserId = useCurrentUserId();
  // Search and preview both replace the pane with a screen that draws its own
  // header. Leaving the channel header mounted stacks two of them, with two
  // competing back controls.
  useHideChannelHeader(embedded && (previewItem !== null || searchOpen));
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const entries = useMemo(() => live.entries, [live.entries]);
  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries]
  );
  const childCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of entries) {
      if (entry.parentId !== null) {
        counts.set(entry.parentId, (counts.get(entry.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [entries]);
  const suppressedIds = useMemo(
    () => findUploadShadowEntryIds(live.uploads),
    [live.uploads]
  );
  const serverEntries = useMemo(
    () => entries.filter((entry) => !suppressedIds.has(entry.id)),
    [entries, suppressedIds]
  );
  // The Bucket's title is its channel's, which %groups maintains -- so it is
  // read from the channel rather than kept a second time alongside the
  // manifest.
  const rootLabel = providedChannel?.title ?? 'Bucket';
  const activeFolderCandidate =
    activeFolderId === null ? undefined : entriesById.get(activeFolderId);
  const activeFolder =
    activeFolderCandidate?.kind === 'folder'
      ? activeFolderCandidate
      : undefined;
  // Someone else can delete the folder we are standing in. Without this the
  // pane keeps filtering on an id nothing has, so it shows an empty list that
  // goBack cannot leave -- it reads the parent off the folder that is gone.
  useEffect(() => {
    if (activeFolderId === null || activeFolder) return;
    if (live.loading) return;
    setActiveFolderId(null);
    setSelectedItemId(null);
  }, [activeFolder, activeFolderId, live.loading]);
  const rootFolders = serverEntries.filter(
    (entry) => entry.kind === 'folder' && entry.parentId === null
  );
  const visibleServerItems = serverEntries
    .filter((entry) => entry.parentId === activeFolderId)
    .map((entry) => toItem(entry, childCounts));
  const visibleLocalItems = live.uploads
    .filter((upload) => upload.parentId === activeFolderId)
    .map((upload) => live.localItems.find((item) => item.id === upload.id))
    .filter((item): item is BucketItem => item !== undefined);
  const visibleItems = sortItems([...visibleLocalItems, ...visibleServerItems]);
  const sidebarItems = sortItems(
    rootFolders.map((entry) => toItem(entry, childCounts))
  );
  const allSearchResults = useMemo<BucketSearchResult[]>(
    () =>
      serverEntries.map((entry) => ({
        ...toItem(entry, childCounts),
        parentFolderId: entry.parentId === null ? null : String(entry.parentId),
        pathLabel: pathLabelFor(entry, entriesById, rootLabel),
      })),
    [childCounts, entriesById, rootLabel, serverEntries]
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
  const canEdit = useCanWrite(channel, currentUserId);

  const reportOperation = async (operation: Promise<unknown>) => {
    setOperationError(null);
    try {
      await operation;
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    // Nothing to re-read. The host publishes the change, the subscription
    // reduces it, and the query refreshes -- so a successful write can no
    // longer be reported as a failure because a follow-up scry failed.
  };

  const loadPreview = async (item: BucketItem) => {
    const requestId = ++previewRequestId.current;
    setPreviewItem(item);
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const previewUri = await live.readUrl(Number(item.id));
      if (previewRequestId.current !== requestId) return;

      const readableItem = { ...item, previewUri };
      setPreviewItem(readableItem);

      // Checked against the manifest size before fetching, not after: the
      // read itself is what would exhaust memory.
      if (
        canPreviewAsText(readableItem) &&
        readableItem.textContent === undefined
      ) {
        const response = await fetch(previewUri);
        if (!response.ok) {
          throw new Error(`File request failed (${response.status})`);
        }
        const textContent = await response.text();
        if (previewRequestId.current !== requestId) return;
        setPreviewItem({ ...readableItem, textContent });
      }

      if (previewRequestId.current === requestId) {
        setPreviewLoading(false);
      }
    } catch (cause) {
      if (previewRequestId.current !== requestId) return;
      setPreviewLoading(false);
      setPreviewError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const openItem = (item: BucketItem) => {
    if (item.kind === 'folder') {
      setActiveFolderId(Number(item.id));
      setSelectedItemId(null);
      return;
    }
    setSelectedItemId(item.id);
    setOperationError(null);
    void loadPreview(item);
  };

  const closePreview = () => {
    previewRequestId.current += 1;
    setPreviewItem(null);
    setPreviewLoading(false);
    setPreviewError(null);
  };

  const chooseUploads = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: '*/*',
    });
    if (!result.assets?.length) return;
    // On web the picker hands back the real File. Dropping it would make the
    // upload task fetch(uri).blob() first, buffering the whole file in memory
    // before the PUT can start -- drag-and-drop already streams the File.
    const candidates: BucketUploadCandidate[] = result.assets.map((asset) => ({
      file: typeof File === 'undefined' ? undefined : asset.file,
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

  const openNewSheet = useCallback(() => {
    setNewSheetOpen(true);
  }, []);

  const openSearch = useCallback(() => {
    setSearchOrigin({ activeFolderId, selectedItemId });
    setSearchOpen(true);
    setQuery('');
  }, [activeFolderId, selectedItemId]);

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
      // The row is labelled Open, so open it. Selecting alone dropped the user
      // back on the list to find the same file a second time.
      openItem(result);
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

  // A folder cannot move into itself or into anything beneath it, and the
  // moving entry's own parent is where it already is.
  const moveDestinations = useMemo(() => {
    if (!itemPendingMove) return [];
    const movingId = Number(itemPendingMove.id);
    const barred = new Set<number>([movingId]);
    let grew = true;
    while (grew) {
      grew = false;
      entries.forEach((entry) => {
        if (entry.parentId !== null && barred.has(entry.parentId)) {
          if (!barred.has(entry.id)) grew = true;
          barred.add(entry.id);
        }
      });
    }
    return entries
      .filter((entry) => entry.kind === 'folder' && !barred.has(entry.id))
      .map((entry) => ({ id: entry.id, name: entry.name }));
  }, [entries, itemPendingMove]);

  const paneProps = {
    canEdit,
    // Suppressed only where the ChannelHeader below already names the folder
    // and carries its own back button. Embedded is the production channel
    // flow, which hides that header, so the breadcrumb is the only way up.
    currentFolder: isMobileLayout && !embedded ? undefined : activeFolder?.name,
    items: visibleItems,
    rootLabel,
    selectedItemId,
    state: live.loading ? ('loading' as const) : ('populated' as const),
    uploadAggregateProgress: live.uploadAggregateProgress,
    uploadItems: live.localItems,
    onCancelUpload: (item: BucketItem) => void live.cancelUpload(item.id),
    onNavigateRoot: () => {
      setActiveFolderId(null);
      setSelectedItemId(null);
    },
    onRenameItem: (item: BucketItem) => setItemPendingRename(item),
    onMoveItem: (item: BucketItem) => setItemPendingMove(item),
    onDeleteItem: (item: BucketItem) => {
      if (item.kind === 'folder') {
        setFolderPendingDeletion(item);
        return;
      }
      void reportOperation(live.deleteEntry(Number(item.id), false));
    },
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
        {previewItem ? (
          <BucketFileViewer
            error={previewError}
            item={{
              name: previewItem.name,
              mimeType: previewItem.mimeType,
              sizeLabel: previewItem.sizeLabel,
              textContent: previewItem.textContent,
              uri: previewItem.previewUri,
            }}
            loading={previewLoading}
            onClose={closePreview}
            onOpenExternally={
              previewItem.previewUri
                ? () => {
                    // Freshly signed rather than the URL captured when the
                    // preview loaded: a grant lasts minutes, a preview left
                    // open lasts as long as the user leaves it, and handing
                    // an expired URL to another app looks like lost access.
                    const item = previewItem;
                    void live
                      .readUrl(Number(item.id))
                      .then((url) => Linking.openURL(url))
                      .catch((cause) =>
                        setPreviewError(
                          cause instanceof Error ? cause.message : String(cause)
                        )
                      );
                  }
                : undefined
            }
            onRetry={() => void loadPreview(previewItem)}
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
              onNew={openNewSheet}
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
      <BucketsRenameSheet
        item={itemPendingRename}
        onOpenChange={(open) => {
          if (!open) setItemPendingRename(null);
        }}
        onRename={(name) => {
          const item = itemPendingRename;
          setItemPendingRename(null);
          if (item) {
            void reportOperation(live.renameEntry(Number(item.id), name));
          }
        }}
      />
      <BucketsMoveSheet
        destinations={moveDestinations}
        item={itemPendingMove}
        rootLabel={rootLabel}
        onOpenChange={(open) => {
          if (!open) setItemPendingMove(null);
        }}
        onMove={(parentId) => {
          const item = itemPendingMove;
          setItemPendingMove(null);
          if (item) {
            void reportOperation(live.moveEntry(Number(item.id), parentId));
          }
        }}
      />
      <ConfirmDialog
        open={folderPendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open) setFolderPendingDeletion(null);
        }}
        title={`Delete ${folderPendingDeletion?.name ?? 'folder'}?`}
        description="This folder and everything inside it will be permanently deleted for everyone. This cannot be undone."
        confirmText="Delete folder"
        cancelText="Cancel"
        destructive
        onConfirm={() => {
          const item = folderPendingDeletion;
          setFolderPendingDeletion(null);
          if (item) {
            void reportOperation(live.deleteEntry(Number(item.id), true));
          }
        }}
      />
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

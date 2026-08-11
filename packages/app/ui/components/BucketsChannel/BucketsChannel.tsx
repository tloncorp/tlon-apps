import {
  Button,
  FilePreview,
  Icon,
  Pressable,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { calculateBucketUploadProgress } from '../../../utils/bucketUploadProgress';
import { ActionSheet, createActionGroups } from '../ActionSheet';
import { Badge } from '../Badge';
import { TextInput } from '../Form';
import { ListItem } from '../ListItem';
import { NotesActionMenu } from '../NotesChannel/NotesActions';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { ScreenHeader } from '../ScreenHeader';
import { SearchBar } from '../SearchBar';
import { BucketsDropTarget } from './BucketsDropTarget';
import { BucketUploadCandidate } from './BucketsDropTarget.types';

export type BucketUploadState = 'queued' | 'uploading' | 'failed';

export type BucketItem = {
  id: string;
  kind: 'file' | 'folder';
  name: string;
  author: string;
  isBot?: boolean;
  modifiedLabel: string;
  sizeLabel?: string;
  itemCount?: number;
  mimeType?: string;
  previewUri?: string;
  textContent?: string;
  uploadError?: string;
  uploadProgress?: number;
  uploadSize?: number;
  uploadState?: BucketUploadState;
};

export type BucketsPaneState = 'empty' | 'loading' | 'populated';

export type BucketSearchResult = BucketItem & {
  parentFolderId: string | null;
  pathLabel: string;
};

const bucketRowHeight = 72;
const bucketRowGap = 4;

export function BucketsHeaderActions({
  canEdit,
  onNew,
  onSearch,
  primaryActionVariant = 'text',
  showSearch = true,
}: {
  canEdit: boolean;
  onNew: () => void;
  onSearch: () => void;
  primaryActionVariant?: 'icon' | 'text';
  showSearch?: boolean;
}) {
  return (
    <>
      {showSearch ? (
        <ScreenHeader.IconButton
          accessibilityLabel="Search files"
          alignItems="center"
          aria-label="Search files"
          onPress={onSearch}
          testID="BucketsSearchHeaderAction"
          type="Search"
        />
      ) : null}
      {canEdit && primaryActionVariant === 'icon' ? (
        <ScreenHeader.IconButton
          aria-label="New"
          onPress={onNew}
          testID="BucketsNewHeaderAction"
          type="Add"
        />
      ) : canEdit ? (
        <ScreenHeader.TextButton
          onPress={onNew}
          testID="BucketsNewHeaderAction"
        >
          New
        </ScreenHeader.TextButton>
      ) : null}
    </>
  );
}

export function BucketsSearchScreen({
  bucketTitle = 'Project Files',
  query,
  results,
  onChangeQuery,
  onClose,
  onOpenResult,
}: {
  bucketTitle?: string;
  query: string;
  results: BucketSearchResult[];
  onChangeQuery: (query: string) => void;
  onClose: () => void;
  onOpenResult: (result: BucketSearchResult) => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const hasQuery = query.trim().length > 0;

  return (
    <YStack
      flex={1}
      minWidth={0}
      width="100%"
      height="100%"
      backgroundColor="$background"
    >
      <ScreenHeader
        backAction={onClose}
        borderBottom
        title={`Search ${bucketTitle}`}
        useHorizontalTitleLayout={!isWindowNarrow}
      />
      <YStack
        flex={1}
        minHeight={0}
        width="100%"
        maxWidth={760}
        marginHorizontal="auto"
        paddingHorizontal="$l"
        paddingTop="$2xl"
      >
        <XStack flexShrink={0} width="100%">
          <SearchBar
            autoFocus
            initialValue={query}
            onChangeQuery={onChangeQuery}
            onPressCancel={onClose}
            placeholder={`Search ${bucketTitle}`}
          />
        </XStack>

        {!hasQuery ? (
          <YStack alignItems="center" gap="$s" paddingTop="$3xl">
            <Text color="$secondaryText" size="$label/l" textAlign="center">
              Enter a search term to get started
            </Text>
            <Text color="$tertiaryText" size="$label/m" textAlign="center">
              Search filenames, folders, and members across this Bucket.
            </Text>
          </YStack>
        ) : results.length === 0 ? (
          <YStack alignItems="center" gap="$s" paddingTop="$3xl">
            <Text color="$secondaryText" size="$label/l" textAlign="center">
              No results found
            </Text>
            <Text color="$tertiaryText" size="$label/m" textAlign="center">
              Searched the entire Bucket.
            </Text>
          </YStack>
        ) : (
          <YStack flex={1} minHeight={0} paddingTop="$2xl">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              gap="$l"
              paddingHorizontal="$s"
              paddingBottom="$m"
            >
              <Text color="$secondaryText" numberOfLines={1} size="$label/m">
                {results.length === 1
                  ? '1 result'
                  : `${results.length} results`}
              </Text>
              <Text color="$tertiaryText" numberOfLines={1} size="$label/m">
                Entire Bucket
              </Text>
            </XStack>
            <ScrollView flex={1}>
              <YStack gap="$xs" paddingBottom="$2xl">
                {results.map((result) => (
                  <BucketSearchRow
                    key={`${result.parentFolderId ?? 'root'}-${result.id}`}
                    result={result}
                    onOpenResult={onOpenResult}
                  />
                ))}
              </YStack>
            </ScrollView>
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}

export function BucketsPane({
  canEdit,
  currentFolder,
  items,
  layout = 'stack',
  rootLabel = 'Project Files',
  selectedItemId,
  state = 'populated',
  uploadAggregateProgress,
  uploadItems,
  onDeleteItem,
  onDownloadItem,
  onCancelUpload,
  onFilesDropped,
  onMoveItem,
  onOpenItem,
  onRenameItem,
  onRetryUpload,
}: {
  canEdit: boolean;
  currentFolder?: string | null;
  items: BucketItem[];
  layout?: 'stack' | 'takeover';
  rootLabel?: string;
  selectedItemId?: string | null;
  state?: BucketsPaneState;
  uploadAggregateProgress?: number;
  uploadItems?: BucketItem[];
  onDeleteItem?: (item: BucketItem) => void;
  onDownloadItem?: (item: BucketItem) => void;
  onCancelUpload?: (item: BucketItem) => void;
  onFilesDropped?: (files: BucketUploadCandidate[]) => void;
  onMoveItem?: (item: BucketItem) => void;
  onOpenItem: (item: BucketItem) => void;
  onRenameItem?: (item: BucketItem) => void;
  onRetryUpload?: (item: BucketItem) => void;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const selectedIndex = selectedItemId
    ? items.findIndex((item) => item.id === selectedItemId)
    : -1;
  const trayItems = uploadItems ?? items.filter((item) => uploadStateFor(item));

  useEffect(() => {
    if (selectedIndex < 0 || !viewportHeight) {
      return;
    }

    const itemOffset = selectedIndex * (bucketRowHeight + bucketRowGap);
    const targetY = Math.max(
      0,
      itemOffset - (viewportHeight - bucketRowHeight) / 2
    );
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ animated: true, y: targetY });
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedIndex, viewportHeight]);

  const list =
    state === 'loading' ? (
      <BucketsLoadingRows />
    ) : state === 'empty' || items.length === 0 ? (
      <BucketsEmptyState canEdit={canEdit} />
    ) : (
      <YStack gap="$xs">
        {items.map((item) => (
          <BucketRow
            key={item.id}
            canEdit={canEdit}
            item={item}
            selected={selectedItemId === item.id}
            onDeleteItem={onDeleteItem}
            onDownloadItem={onDownloadItem}
            onCancelUpload={onCancelUpload}
            onMoveItem={onMoveItem}
            onOpenItem={onOpenItem}
            onRenameItem={onRenameItem}
            onRetryUpload={onRetryUpload}
          />
        ))}
      </YStack>
    );

  return (
    <BucketsDropTarget
      disabled={!canEdit}
      dropLabel={currentFolder ?? rootLabel}
      flex={1}
      minHeight={0}
      onFilesDropped={onFilesDropped}
    >
      <YStack flex={1} minHeight={0} backgroundColor="$background">
        {currentFolder ? (
          <BucketBreadcrumb rootLabel={rootLabel} folderLabel={currentFolder} />
        ) : null}
        <ScrollView
          ref={scrollViewRef}
          flex={1}
          onLayout={(event) =>
            setViewportHeight(event.nativeEvent.layout.height)
          }
        >
          <YStack
            width="100%"
            maxWidth={layout === 'takeover' ? 'unset' : 760}
            marginHorizontal="auto"
            paddingHorizontal="$l"
            paddingTop={currentFolder ? '$xs' : '$m'}
            paddingBottom="$2xl"
          >
            {list}
          </YStack>
        </ScrollView>
        {trayItems.length > 0 ? (
          <BucketsUploadTray
            aggregateProgress={uploadAggregateProgress}
            items={trayItems}
            onRetryUpload={onRetryUpload}
          />
        ) : null}
      </YStack>
    </BucketsDropTarget>
  );
}

function BucketRow({
  canEdit,
  item,
  selected,
  onDeleteItem,
  onDownloadItem,
  onCancelUpload,
  onMoveItem,
  onOpenItem,
  onRenameItem,
  onRetryUpload,
}: {
  canEdit: boolean;
  item: BucketItem;
  selected: boolean;
  onDeleteItem?: (item: BucketItem) => void;
  onDownloadItem?: (item: BucketItem) => void;
  onCancelUpload?: (item: BucketItem) => void;
  onMoveItem?: (item: BucketItem) => void;
  onOpenItem: (item: BucketItem) => void;
  onRenameItem?: (item: BucketItem) => void;
  onRetryUpload?: (item: BucketItem) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const isWindowNarrow = useIsWindowNarrow();
  const showOverflow =
    Platform.OS !== 'web' || isWindowNarrow || isHovered || open;
  const uploadState = uploadStateFor(item);
  const groups = createActionGroups(
    [
      'neutral',
      {
        title: item.kind === 'folder' ? 'Open folder' : 'Open',
        startIcon: item.kind === 'folder' ? 'Folder' : 'EyeOpen',
        action: () => onOpenItem(item),
      },
      item.kind === 'file' && {
        title: 'Download',
        startIcon: 'ArrowDown',
        action: () => onDownloadItem?.(item),
      },
    ],
    canEdit &&
      (onRenameItem || onMoveItem) && [
        'neutral',
        onRenameItem && {
          title: `Rename ${item.kind}`,
          startIcon: 'EditList',
          action: () => onRenameItem(item),
        },
        onMoveItem && {
          title: `Move ${item.kind}`,
          startIcon: 'Folder',
          action: () => onMoveItem(item),
        },
      ],
    canEdit &&
      onDeleteItem && [
        'negative',
        {
          title: `Delete ${item.kind}`,
          startIcon: 'Trash',
          action: () => onDeleteItem(item),
        },
      ]
  );
  const trigger = showOverflow ? (
    <OverflowTriggerButton
      aria-label={`Actions for ${item.name}`}
      onPress={(event) => {
        event.stopPropagation();
        if (isWindowNarrow) {
          setOpen((currentOpen) => !currentOpen);
        }
      }}
      paddingHorizontal="$xs"
      paddingVertical="$xs"
      testID={`BucketsItemActions-${item.id}`}
    />
  ) : null;

  return (
    <Pressable
      aria-label={`${item.kind === 'folder' ? 'Folder' : 'File'} ${item.name}`}
      onLongPress={() => {
        if (!uploadState) setOpen(true);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPress={() => {
        if (!uploadState) onOpenItem(item);
      }}
      testID={`BucketsItem-${item.id}`}
    >
      <ListItem
        alignItems="stretch"
        backgroundColor={selected ? '$shadow' : '$transparent'}
        borderRadius="$xl"
        gap="$l"
        hoverStyle={{ backgroundColor: '$secondaryBackground' }}
        minHeight={bucketRowHeight}
        padding="$l"
      >
        <BucketItemIcon item={item} />
        <ListItem.MainContent minWidth={0}>
          <ListItem.Title
            color="$primaryText"
            fontWeight="400"
            letterSpacing={0}
            size="$body"
          >
            {item.name}
          </ListItem.Title>
          <BucketItemMetadata item={item} />
        </ListItem.MainContent>
        <ListItem.EndContent minWidth="$3xl">
          {uploadState === 'failed' ? (
            <XStack alignItems="center" gap="$xs">
              <UploadAction
                accessibilityLabel={`Remove ${item.name} from uploads`}
                label="Remove"
                onPress={() => onCancelUpload?.(item)}
                testID={`BucketsRemoveUpload-${item.id}`}
              />
              <UploadAction
                accessibilityLabel={`Retry uploading ${item.name}`}
                accent="positive"
                label="Retry"
                onPress={() => onRetryUpload?.(item)}
                testID={`BucketsRetryUpload-${item.id}`}
              />
            </XStack>
          ) : uploadState ? (
            <UploadAction
              accessibilityLabel={`Cancel uploading ${item.name}`}
              label="Cancel"
              onPress={() => onCancelUpload?.(item)}
              testID={`BucketsCancelUpload-${item.id}`}
            />
          ) : showOverflow ? (
            <NotesActionMenu
              groups={groups}
              header={{
                icon: item.kind === 'folder' ? 'Folder' : 'Attachment',
                subtitle: metadataLabel(item),
                title: item.name,
              }}
              open={open}
              onOpenChange={setOpen}
              trigger={trigger}
            />
          ) : item.kind === 'folder' ? (
            <Icon color="$tertiaryText" size="$m" type="ChevronRight" />
          ) : null}
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

function BucketSearchRow({
  result,
  onOpenResult,
}: {
  result: BucketSearchResult;
  onOpenResult: (result: BucketSearchResult) => void;
}) {
  return (
    <Pressable
      aria-label={`Open ${result.name} in ${result.pathLabel}`}
      onPress={() => onOpenResult(result)}
      testID={`BucketsSearchResult-${result.id}`}
    >
      <ListItem
        alignItems="stretch"
        borderRadius="$xl"
        gap="$l"
        hoverStyle={{ backgroundColor: '$secondaryBackground' }}
        padding="$l"
      >
        <BucketItemIcon item={result} />
        <ListItem.MainContent minWidth={0}>
          <ListItem.Title
            color="$primaryText"
            fontWeight="400"
            letterSpacing={0}
            numberOfLines={1}
            size="$body"
          >
            {result.name}
          </ListItem.Title>
          <XStack alignItems="center" gap="$xs" minWidth={0}>
            <Text
              color="$tertiaryText"
              flexShrink={1}
              numberOfLines={1}
              size="$label/m"
            >
              {result.pathLabel}
              {result.kind === 'file' && result.author
                ? ` · ${result.author}`
                : ''}
            </Text>
            {result.isBot ? (
              <Badge type="neutral" size="micro" text="Bot" />
            ) : null}
          </XStack>
        </ListItem.MainContent>
        <ListItem.EndContent minWidth="$xl">
          <Icon color="$tertiaryText" size="$m" type="ChevronRight" />
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

export function BucketsNewSheet({
  open,
  onChoosePhotos,
  onNewFolder,
  onOpenChange,
  onUploadFiles,
}: {
  open: boolean;
  onChoosePhotos: () => void;
  onNewFolder: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onUploadFiles: () => void;
}) {
  const [view, setView] = useState<'actions' | 'folder'>('actions');
  const [folderName, setFolderName] = useState('');
  const isWeb = Platform.OS === 'web';
  const normalizedFolderName = folderName.trim();

  useEffect(() => {
    if (open) {
      setView('actions');
      setFolderName('');
    }
  }, [open]);

  const createFolder = () => {
    if (!normalizedFolderName) return;
    onNewFolder(normalizedFolderName);
    onOpenChange(false);
  };

  return (
    <ActionSheet
      closeButton={isWeb}
      dialogContentProps={{ width: 420, maxWidth: '90%', minWidth: 320 }}
      keyboardBehavior="interactive"
      moveOnKeyboardChange
      open={open}
      onOpenChange={onOpenChange}
      modal
      snapPointsMode="fit"
      title={view === 'folder' ? 'New folder' : 'New'}
      unmountOnClose
    >
      {view === 'actions' ? (
        <>
          <ActionSheet.SimpleHeader
            title="New"
            subtitle="Add something to this folder"
          />
          <ActionSheet.Content>
            <ActionSheet.ActionGroup accent="neutral">
              <ActionSheet.Action
                action={{
                  title: 'Upload files',
                  startIcon: 'Attachment',
                  action: () => {
                    onOpenChange(false);
                    onUploadFiles();
                  },
                }}
                testID="BucketsUploadFilesAction"
              />
              <ActionSheet.Action
                action={{
                  title: 'Choose photos',
                  startIcon: 'Camera',
                  action: () => {
                    onOpenChange(false);
                    onChoosePhotos();
                  },
                }}
                testID="BucketsChoosePhotosAction"
              />
              <ActionSheet.Action
                action={{
                  title: 'New folder',
                  startIcon: 'Folder',
                  action: () => setView('folder'),
                }}
                testID="BucketsNewFolderAction"
              />
            </ActionSheet.ActionGroup>
          </ActionSheet.Content>
        </>
      ) : (
        <>
          <ActionSheet.SimpleHeader
            title="New folder"
            subtitle="Add it to this folder"
          />
          <ActionSheet.Content testID="BucketsNewFolderForm">
            <ActionSheet.FormBlock>
              <YStack gap="$s">
                <Text color="$secondaryText" size="$label/s">
                  Name
                </Text>
                <TextInput
                  autoFocus
                  maxLength={120}
                  onChangeText={setFolderName}
                  onSubmitEditing={createFolder}
                  placeholder="Folder name"
                  returnKeyType="done"
                  testID="BucketsNewFolderNameInput"
                  value={folderName}
                />
              </YStack>
            </ActionSheet.FormBlock>
            <ActionSheet.FormBlock>
              <XStack alignItems="center" gap="$m" justifyContent="flex-end">
                <Button
                  label="Cancel"
                  onPress={() => onOpenChange(false)}
                  preset="minimal"
                />
                <Button
                  centered
                  disabled={!normalizedFolderName}
                  label="Create folder"
                  onPress={createFolder}
                  preset="primary"
                />
              </XStack>
            </ActionSheet.FormBlock>
          </ActionSheet.Content>
        </>
      )}
    </ActionSheet>
  );
}

function BucketItemIcon({ item }: { item: BucketItem }) {
  if (item.kind === 'folder') {
    return <ListItem.SystemIcon icon="Folder" />;
  }

  return (
    <YStack
      width="$4xl"
      height="$4xl"
      alignItems="center"
      justifyContent="center"
      borderRadius="$s"
      backgroundColor="$secondaryBackground"
      overflow="hidden"
    >
      <FilePreview
        fileExtensionLabel={
          FilePreview.fileExtensionFrom({
            filename: item.name,
            mimeType: item.mimeType,
          }) ?? undefined
        }
        size="s"
      />
    </YStack>
  );
}

function BucketItemMetadata({ item }: { item: BucketItem }) {
  if (item.kind === 'folder') {
    return (
      <ListItem.Subtitle>
        {item.itemCount === 1 ? '1 item' : `${item.itemCount ?? 0} items`}
      </ListItem.Subtitle>
    );
  }

  const uploadState = uploadStateFor(item);
  if (uploadState === 'failed') {
    return (
      <XStack alignItems="center" gap="$xs" minWidth={0}>
        <Text color="$negativeActionText" numberOfLines={1} size="$label/m">
          Upload failed
          {item.uploadError ? ` · ${item.uploadError}` : ''}
        </Text>
      </XStack>
    );
  }

  if (uploadState === 'queued') {
    return (
      <Text color="$tertiaryText" numberOfLines={1} size="$label/m">
        Waiting to upload
      </Text>
    );
  }

  if (uploadState === 'uploading') {
    return (
      <XStack alignItems="center" gap="$s" minWidth={0}>
        <XStack alignItems="center" gap="$xs" flex={1} minWidth={0}>
          <Text color="$tertiaryText" numberOfLines={1} size="$label/m">
            {item.author}
          </Text>
          {item.isBot ? <Badge type="neutral" size="micro" text="Bot" /> : null}
          <Text
            color="$tertiaryText"
            flexShrink={1}
            numberOfLines={1}
            size="$label/m"
          >
            · Uploading
          </Text>
        </XStack>
        <UploadProgress progress={item.uploadProgress ?? 0} />
      </XStack>
    );
  }

  return (
    <XStack alignItems="center" gap="$xs" minWidth={0}>
      <Text color="$tertiaryText" numberOfLines={1} size="$label/m">
        {item.author}
      </Text>
      {item.isBot ? <Badge type="neutral" size="micro" text="Bot" /> : null}
      <Text
        color="$tertiaryText"
        flexShrink={1}
        numberOfLines={1}
        size="$label/m"
      >
        · {item.modifiedLabel}
        {item.sizeLabel ? ` · ${item.sizeLabel}` : ''}
      </Text>
    </XStack>
  );
}

function BucketBreadcrumb({
  folderLabel,
  rootLabel,
}: {
  folderLabel: string;
  rootLabel: string;
}) {
  return (
    <XStack
      alignItems="center"
      gap="$m"
      maxWidth={760}
      width="100%"
      marginHorizontal="auto"
      paddingHorizontal="$xl"
      paddingTop="$l"
      paddingBottom="$s"
    >
      <Text color="$secondaryText" size="$label/l">
        {rootLabel}
      </Text>
      <Text color="$tertiaryText" size="$label/l">
        /
      </Text>
      <Text color="$primaryText" numberOfLines={1} size="$label/l">
        {folderLabel}
      </Text>
    </XStack>
  );
}

function UploadProgress({ progress }: { progress: number }) {
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  return (
    <XStack alignItems="center" gap="$s" flexShrink={0}>
      <View
        width={54}
        height={2}
        backgroundColor="$border"
        borderRadius="$xl"
        overflow="hidden"
      >
        <View
          height="100%"
          width={`${normalizedProgress}%`}
          backgroundColor="$positiveActionText"
        />
      </View>
      <Text color="$positiveActionText" size="$label/m">
        {normalizedProgress}%
      </Text>
    </XStack>
  );
}

function BucketsUploadTray({
  aggregateProgress,
  items,
  onRetryUpload,
}: {
  aggregateProgress?: number;
  items: BucketItem[];
  onRetryUpload?: (item: BucketItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const failedItems = items.filter((item) => uploadStateFor(item) === 'failed');
  const activeItems = items.filter((item) => uploadStateFor(item) !== 'failed');
  const activeProgress =
    aggregateProgress ??
    calculateBucketUploadProgress(
      activeItems.map((item) => ({
        progress: item.uploadProgress ?? 0,
        size: item.uploadSize ?? 0,
      }))
    );
  const title =
    activeItems.length > 0
      ? `${activeItems.length} ${
          activeItems.length === 1 ? 'upload' : 'uploads'
        } in progress`
      : `${failedItems.length} ${
          failedItems.length === 1 ? 'upload' : 'uploads'
        } failed`;

  return (
    <XStack
      accessibilityLiveRegion="polite"
      alignItems="center"
      borderTopColor="$border"
      borderTopWidth={1}
      backgroundColor="$background"
      gap="$m"
      minHeight={64}
      paddingHorizontal="$l"
      paddingTop="$l"
      paddingBottom={Math.max(insets.bottom, 16)}
    >
      <YStack
        width="$3xl"
        height="$3xl"
        alignItems="center"
        justifyContent="center"
        borderRadius="$l"
        backgroundColor={
          failedItems.length > 0
            ? '$negativeBackground'
            : '$secondaryBackground'
        }
      >
        <Icon
          color={
            failedItems.length > 0
              ? '$negativeActionText'
              : '$positiveActionText'
          }
          size="$m"
          type="Attachment"
        />
      </YStack>
      <YStack flex={1} minWidth={0} gap="$xs">
        <Text color="$primaryText" numberOfLines={1} size="$label/l">
          {title}
        </Text>
        <Text color="$tertiaryText" numberOfLines={1} size="$label/s">
          {failedItems.length > 0
            ? `${failedItems.length} needs attention`
            : 'You can keep browsing'}
        </Text>
      </YStack>
      {failedItems.length > 0 ? (
        <UploadAction
          accessibilityLabel={
            failedItems.length === 1
              ? 'Retry failed upload'
              : 'Retry all failed uploads'
          }
          accent="negative"
          label={failedItems.length === 1 ? 'Retry' : 'Retry all'}
          onPress={() => failedItems.forEach((item) => onRetryUpload?.(item))}
          testID="BucketsRetryFailedUploads"
        />
      ) : (
        <UploadProgress progress={activeProgress} />
      )}
    </XStack>
  );
}

function UploadAction({
  accessibilityLabel,
  accent = 'neutral',
  label,
  onPress,
  testID,
}: {
  accessibilityLabel?: string;
  accent?: 'neutral' | 'positive' | 'negative';
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      alignItems="center"
      justifyContent="center"
      minHeight={44}
      minWidth={44}
      borderRadius="$l"
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      paddingHorizontal="$s"
      testID={testID}
    >
      <Text
        color={
          accent === 'positive'
            ? '$positiveActionText'
            : accent === 'negative'
              ? '$negativeActionText'
              : '$secondaryText'
        }
        fontWeight="600"
        size="$label/m"
      >
        {label}
      </Text>
    </Pressable>
  );
}

function uploadStateFor(item: BucketItem): BucketUploadState | null {
  if (item.uploadState) return item.uploadState;
  return item.uploadProgress !== undefined ? 'uploading' : null;
}

function BucketsLoadingRows() {
  return (
    <YStack gap="$xs" accessibilityLabel="Loading files">
      {[0, 1, 2, 3].map((index) => (
        <ListItem key={index} padding="$l" gap="$l">
          <View
            width="$4xl"
            height="$4xl"
            borderRadius="$s"
            backgroundColor="$secondaryBackground"
          />
          <ListItem.MainContent gap="$m">
            <View
              width={index % 2 === 0 ? '55%' : '72%'}
              height="$m"
              borderRadius="$xl"
              backgroundColor="$secondaryBackground"
            />
            <View
              width={index % 2 === 0 ? '72%' : '48%'}
              height="$s"
              borderRadius="$xl"
              backgroundColor="$secondaryBackground"
            />
          </ListItem.MainContent>
        </ListItem>
      ))}
    </YStack>
  );
}

function BucketsEmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <YStack
      alignItems="center"
      justifyContent="center"
      gap="$s"
      minHeight={260}
      padding="$2xl"
    >
      <ListItem.SystemIcon icon="Folder" />
      <Text color="$secondaryText" size="$label/l" textAlign="center">
        This folder is empty
      </Text>
      {canEdit ? (
        <Text color="$tertiaryText" size="$label/m" textAlign="center">
          Use New to upload files or create a folder.
        </Text>
      ) : null}
    </YStack>
  );
}

function metadataLabel(item: BucketItem) {
  if (item.kind === 'folder') {
    return item.itemCount === 1 ? '1 item' : `${item.itemCount ?? 0} items`;
  }

  return [item.author, item.modifiedLabel, item.sizeLabel]
    .filter(Boolean)
    .join(' · ');
}

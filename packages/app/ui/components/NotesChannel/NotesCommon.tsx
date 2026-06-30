import {
  markNotesNotebookOpened,
  useEnsureNotesNotebookJoined,
  useNotesNotebookWithRelations,
  useSyncNotesNotebook,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  Button,
  Icon,
  IconType,
  LoadingSpinner,
  Pressable,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import Fuse from 'fuse.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, XStack, YStack, getTokenValue } from 'tamagui';

import type { ActionGroup } from '../ActionSheet';
import { ActionSheet } from '../ActionSheet';
import { TextInput } from '../Form';
import { ListItem } from '../ListItem';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { ScreenHeader } from '../ScreenHeader';
import type { FolderDestinationRow, FolderRow } from './notesTree';
import { buildFolderDestinationRows, getFolderLabel } from './notesTree';

export function NotesOverflowMenu({
  groups,
  triggerTestID,
}: {
  groups: ActionGroup[];
  triggerTestID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <NotesActionMenu
      groups={groups}
      open={open}
      onOpenChange={setOpen}
      trigger={
        Platform.OS === 'web' ? (
          <ScreenHeader.IconButton
            testID={triggerTestID}
            color="$primaryText"
            onPress={() => setOpen(true)}
            type="Overflow"
          />
        ) : (
          <OverflowTriggerButton
            testID={triggerTestID}
            paddingHorizontal="$xs"
            paddingVertical="$xs"
            onPress={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
          />
        )
      }
    />
  );
}

export function NotesActionMenu({
  groups,
  header,
  onAction,
  open,
  onOpenChange,
  trigger,
}: {
  groups: ActionGroup[];
  header?: {
    icon: IconType;
    subtitle?: string;
    title: string;
  };
  onAction?: (action?: () => void) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const handleAction = useCallback(
    (action?: () => void) => {
      if (onAction) {
        onAction(action);
      } else {
        onOpenChange(false);
        action?.();
      }
    },
    [onAction, onOpenChange]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
      modal
      snapPointsMode="fit"
      trigger={trigger}
    >
      {header && isWindowNarrow ? (
        <ActionSheet.Header>
          <ListItem.SystemIcon icon={header.icon} />
          <ActionSheet.ActionContent>
            <ListItem.Title>{header.title}</ListItem.Title>
            {header.subtitle ? (
              <ListItem.Subtitle $gtSm={{ maxWidth: '100%' }}>
                {header.subtitle}
              </ListItem.Subtitle>
            ) : null}
          </ActionSheet.ActionContent>
        </ActionSheet.Header>
      ) : null}
      <ActionSheet.Content>
        <NotesActionGroupList groups={groups} onAction={handleAction} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}

export function NotesActionGroupList({
  groups,
  onAction,
}: {
  groups: ActionGroup[];
  onAction: (action?: () => void) => void;
}) {
  return groups.map((group, index) => (
    <ActionSheet.ActionGroup key={index} accent={group.accent}>
      {group.actions.map((action) => (
        <ActionSheet.Action
          key={action.title}
          action={{
            ...action,
            action: () => {
              onAction(action.action);
            },
          }}
          testID={action.testID}
        />
      ))}
    </ActionSheet.ActionGroup>
  ));
}

const EMPTY_FOLDERS: db.NotesFolder[] = [];
const EMPTY_NOTES: db.NotesNote[] = [];
const MOVE_DESTINATION_SHEET_SNAP_POINTS = [85];

export function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export function confirmNotesDestructiveAction({
  action,
  nativeMessage,
  nativeTitle,
  webMessage,
}: {
  action: () => void;
  nativeMessage: string;
  nativeTitle: string;
  webMessage: string;
}) {
  if (Platform.OS === 'web') {
    const confirm = (globalThis as { confirm?: (message: string) => boolean })
      .confirm;
    if (typeof confirm === 'function' && !confirm(webMessage)) return;
    action();
    return;
  }

  Alert.alert(nativeTitle, nativeMessage, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: action },
  ]);
}

export type NotebookGate = 'unavailable' | 'loading' | 'unjoinable' | null;

export function useNotebookData(
  notebookFlag: string | null | undefined,
  options: { syncEnabled?: boolean } = {}
) {
  const joinQuery = useEnsureNotesNotebookJoined({ notebookFlag });
  const joined = joinQuery.data !== false;
  const syncEnabled = options.syncEnabled ?? true;
  const syncQuery = useSyncNotesNotebook({
    notebookFlag,
    enabled:
      Boolean(notebookFlag) && joined && !joinQuery.isLoading && syncEnabled,
  });
  const notebookQuery = useNotesNotebookWithRelations(notebookFlag, joined);

  const notebook = notebookQuery.data ?? null;
  const folders = notebook?.folders ?? EMPTY_FOLDERS;
  const notes = notebook?.notes ?? EMPTY_NOTES;
  const canEdit = notebook ? notebook.currentUserRole !== 'viewer' : false;
  const rootFolderId =
    notebook?.rootFolderId ??
    folders.find((folder) => folder.parentFolderId === null)?.folderId ??
    folders[0]?.folderId ??
    null;

  useEffect(() => {
    if (!notebookFlag) return;
    markNotesNotebookOpened(notebookFlag);
  }, [notebookFlag]);

  const gate: NotebookGate = !notebookFlag
    ? 'unavailable'
    : joinQuery.isLoading || (syncQuery.isLoading && !notebook)
      ? 'loading'
      : joinQuery.data === false
        ? 'unjoinable'
        : null;

  return { notebook, folders, notes, canEdit, rootFolderId, gate };
}

export function NotebookGateMessage({
  gate,
  loadingTitle,
  unavailableTitle,
}: {
  gate: Exclude<NotebookGate, null>;
  loadingTitle: string;
  unavailableTitle: string;
}) {
  if (gate === 'unavailable') {
    return <NotesMessage title={unavailableTitle} />;
  }
  if (gate === 'loading') {
    return (
      <NotesMessage title={loadingTitle}>
        <LoadingSpinner />
      </NotesMessage>
    );
  }
  return (
    <NotesMessage
      title="Unable to join notebook"
      subtitle="This notebook is private or no longer available."
    />
  );
}

export function NotesDialog({
  cancelDisabled = false,
  children,
  confirmButton,
  keyboardBehavior,
  onOpenChange,
  open,
  subtitle,
  testID,
  title,
  unmountOnClose = false,
}: {
  cancelDisabled?: boolean;
  children: ReactNode;
  confirmButton?: ReactNode;
  keyboardBehavior?: ComponentProps<typeof ActionSheet>['keyboardBehavior'];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  subtitle?: string;
  testID?: string;
  title: string;
  unmountOnClose?: boolean;
}) {
  const isWeb = Platform.OS === 'web';
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={isWeb ? 'dialog' : 'sheet'}
      closeButton={isWeb}
      modal
      snapPointsMode="fit"
      keyboardBehavior={keyboardBehavior}
      unmountOnClose={unmountOnClose}
      dialogContentProps={{ width: 420, maxWidth: '90%' }}
    >
      <ActionSheet.ScrollableContent>
        <YStack testID={testID} gap="$l" padding="$l">
          <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
          {children}
          <XStack gap="$m" justifyContent="flex-end">
            <Button
              preset="minimal"
              label="Cancel"
              disabled={cancelDisabled}
              onPress={() => onOpenChange(false)}
            />
            {confirmButton}
          </XStack>
        </YStack>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

export function useEntityDialog<T>() {
  const [entity, setEntity] = useState<T | null>(null);
  const [isPending, setIsPending] = useState(false);

  const open = useCallback((next: T) => setEntity(next), []);
  const close = useCallback(() => setEntity(null), []);
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !isPending) {
        setEntity(null);
      }
    },
    [isPending]
  );
  const run = useCallback(async (action: () => Promise<void>) => {
    setIsPending(true);
    try {
      await action();
      setEntity(null);
    } finally {
      setIsPending(false);
    }
  }, []);

  return { entity, isPending, open, close, handleOpenChange, run };
}

export function NotesBanner({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'neutral' | 'negative';
}) {
  const isNegative = tone === 'negative';
  return (
    <XStack
      paddingHorizontal="$l"
      paddingVertical="$s"
      backgroundColor={
        isNegative ? '$negativeBackground' : '$secondaryBackground'
      }
      borderBottomColor={isNegative ? '$negativeBorder' : '$border'}
      borderBottomWidth={1}
    >
      <Text
        size="$label/s"
        color={isNegative ? '$negativeActionText' : '$secondaryText'}
      >
        {message}
      </Text>
    </XStack>
  );
}

export function MoveNoteSheet({
  folderRows,
  isMoving,
  note,
  onMove,
  onOpenChange,
  open,
}: {
  folderRows: FolderRow[];
  isMoving: boolean;
  note: db.NotesNote | null;
  onMove: (folderId: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const hiddenFolderIds = useMemo(
    () => new Set<number>(note ? [note.folderId] : []),
    [note]
  );
  const { selectedDestination, selectedFolderId, setSelectedFolderId } =
    useFolderDestinationSelection({
      folderRows,
      hiddenFolderIds,
      resetKey: open ? note?.id : null,
    });
  const title = note?.title?.trim() || 'Untitled';

  return (
    <MoveDestinationSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Move note"
      subtitle={`Choose a new folder for ${title}.`}
      testID="NotesMoveNoteSheet"
      isMoving={isMoving}
      selectedDestination={selectedDestination}
      onConfirm={onMove}
    >
      <FolderDestinationSearch
        folderRows={folderRows}
        hiddenFolderIds={hiddenFolderIds}
        isLoading={isMoving}
        onSelectFolder={setSelectedFolderId}
        resetKey={open ? note?.id : null}
        selectedFolderId={selectedFolderId}
        testID="NotesMoveNoteFolderPicker"
      />
    </MoveDestinationSheet>
  );
}

export function useFolderDestinationSelection({
  folderRows,
  hiddenFolderIds,
  resetKey,
}: {
  folderRows: FolderRow[];
  hiddenFolderIds?: Set<number>;
  resetKey?: string | number | null;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const destinations = useMemo(
    () => buildFolderDestinationRows({ folderRows, hiddenFolderIds }),
    [folderRows, hiddenFolderIds]
  );
  const selectedDestination = useMemo(
    () =>
      destinations.find(
        (destination) => destination.folder.folderId === selectedFolderId
      ) ?? null,
    [destinations, selectedFolderId]
  );

  useEffect(() => {
    setSelectedFolderId(null);
  }, [resetKey]);

  useEffect(() => {
    if (selectedFolderId !== null && selectedDestination === null) {
      setSelectedFolderId(null);
    }
  }, [selectedDestination, selectedFolderId]);

  return { selectedDestination, selectedFolderId, setSelectedFolderId };
}

export function MoveDestinationSheet({
  children,
  isMoving,
  onConfirm,
  onOpenChange,
  open,
  selectedDestination,
  subtitle,
  testID,
  title,
}: {
  children: ReactNode;
  isMoving: boolean;
  onConfirm: (folderId: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedDestination: FolderDestinationRow | null;
  subtitle: string;
  testID: string;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  const handleConfirm = useCallback(() => {
    if (!selectedDestination || isMoving) return;
    onConfirm(selectedDestination.folder.folderId);
  }, [isMoving, onConfirm, selectedDestination]);

  const renderFooter = useCallback(() => {
    if (!selectedDestination) {
      return null;
    }

    return (
      <YStack
        paddingBottom={insets.bottom + getTokenValue('$xl', 'size')}
        paddingHorizontal="$xl"
      >
        <Button
          preset="primary"
          onPress={handleConfirm}
          disabled={isMoving}
          label={
            isMoving
              ? 'Moving...'
              : `Move to ${selectedDestination.displayPath}`
          }
          centered
        />
      </YStack>
    );
  }, [handleConfirm, insets.bottom, isMoving, selectedDestination]);

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={MOVE_DESTINATION_SHEET_SNAP_POINTS}
      keyboardBehavior="extend"
      enableContentPanningGesture={false}
      hasScrollableContent
      footerComponent={renderFooter}
      unmountOnClose
    >
      <ActionSheet.Content flex={1} paddingBottom="$s" testID={testID}>
        <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
        {children}
      </ActionSheet.Content>
    </ActionSheet>
  );
}

export function FolderDestinationSearch({
  folderRows,
  hiddenFolderIds,
  isLoading = false,
  maxHeight = 520,
  onSelectFolder,
  resetKey,
  selectedFolderId,
  testID,
}: {
  folderRows: FolderRow[];
  hiddenFolderIds?: Set<number>;
  isLoading?: boolean;
  maxHeight?: number;
  onSelectFolder: (folderId: number) => void;
  resetKey?: string | number | null;
  selectedFolderId?: number | null;
  testID?: string;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [resetKey]);

  const destinations = useMemo(
    () => buildFolderDestinationRows({ folderRows, hiddenFolderIds }),
    [folderRows, hiddenFolderIds]
  );

  const fuse = useMemo(
    () =>
      new Fuse(destinations, {
        keys: ['displayPath', 'label'],
        threshold: 0.4,
      }),
    [destinations]
  );

  const filteredDestinations = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return destinations;
    }
    return fuse.search(trimmedQuery).map((result) => result.item);
  }, [destinations, fuse, query]);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  const listPadding = useMemo(() => getTokenValue('$l', 'size'), []);
  const contentContainerStyle = useMemo(
    () => ({
      padding: listPadding,
      paddingBottom: selectedFolderId ? 100 : listPadding,
    }),
    [listPadding, selectedFolderId]
  );

  return (
    <YStack testID={testID}>
      <XStack paddingHorizontal="$xl">
        <TextInput
          frameStyle={{ width: '100%' }}
          icon="Search"
          placeholder="Search folders"
          value={query}
          onChangeText={setQuery}
          spellCheck={false}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus={Platform.OS === 'web'}
          rightControls={
            query !== '' ? (
              <TextInput.InnerButton label="Clear" onPress={handleClear} />
            ) : undefined
          }
        />
      </XStack>
      <ScrollView
        maxHeight={maxHeight}
        contentContainerStyle={contentContainerStyle}
      >
        <YStack gap="$xs">
          {filteredDestinations.length > 0 ? (
            filteredDestinations.map((destination) => (
              <FolderDestinationSearchRow
                key={destination.folder.id}
                destination={destination}
                disabled={isLoading}
                selected={selectedFolderId === destination.folder.folderId}
                onPress={() => onSelectFolder(destination.folder.folderId)}
              />
            ))
          ) : (
            <YStack padding="$l" alignItems="center">
              <Text size="$label/m" color="$secondaryText">
                {query.trim()
                  ? 'No folders found'
                  : 'No destinations available'}
              </Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function FolderDestinationSearchRow({
  destination,
  disabled,
  onPress,
  selected,
}: {
  destination: FolderDestinationRow;
  disabled: boolean;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      borderRadius="$xl"
      disabled={disabled}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      onPress={disabled ? undefined : onPress}
    >
      <ListItem
        alignItems="center"
        backgroundColor={
          selected
            ? '$positiveBackground'
            : destination.isRoot
              ? '$secondaryBackground'
              : 'transparent'
        }
        borderColor={selected ? '$positiveBorder' : 'transparent'}
        borderWidth="$2xs"
        justifyContent="flex-start"
        opacity={disabled ? 0.6 : 1}
      >
        <ListItem.SystemIcon
          icon={destination.isRoot ? 'Home' : 'Folder'}
          backgroundColor={destination.isRoot ? '$background' : undefined}
          color={destination.isRoot ? '$primaryText' : '$tertiaryText'}
        />
        <ListItem.MainContent>
          <ListItem.Title>{destination.displayPath}</ListItem.Title>
          {destination.isRoot ? (
            <ListItem.Subtitle>Top level</ListItem.Subtitle>
          ) : null}
        </ListItem.MainContent>
      </ListItem>
    </Pressable>
  );
}

export function FolderPicker({
  disabledFolders,
  folderRows,
  isLoading = false,
  maxHeight = 220,
  onSelectFolder,
  selectedFolderId,
  testID,
}: {
  disabledFolders?: Map<number, string>;
  folderRows: FolderRow[];
  isLoading?: boolean;
  maxHeight?: number;
  onSelectFolder: (folderId: number) => void;
  selectedFolderId: number | null;
  testID?: string;
}) {
  return (
    <YStack
      borderColor="$border"
      borderWidth={1}
      borderRadius="$m"
      overflow="hidden"
      testID={testID}
    >
      <ScrollView maxHeight={maxHeight}>
        {folderRows.map(({ folder, depth, path }) => (
          <FolderPickerRow
            key={folder.id}
            depth={depth}
            disabled={
              isLoading || Boolean(disabledFolders?.has(folder.folderId))
            }
            disabledLabel={disabledFolders?.get(folder.folderId)}
            folder={folder}
            path={path}
            selected={selectedFolderId === folder.folderId}
            onPress={() => onSelectFolder(folder.folderId)}
          />
        ))}
      </ScrollView>
    </YStack>
  );
}

function FolderPickerRow({
  depth,
  disabled = false,
  disabledLabel,
  folder,
  path,
  selected,
  onPress,
}: {
  depth: number;
  disabled?: boolean;
  disabledLabel?: string;
  folder: db.NotesFolder;
  path: string;
  selected: boolean;
  onPress: () => void;
}) {
  const label = getFolderLabel(folder);
  const showPath = path !== label;

  return (
    <Pressable disabled={disabled} onPress={disabled ? undefined : onPress}>
      <XStack
        alignItems="center"
        gap="$s"
        paddingVertical="$s"
        paddingRight="$m"
        paddingLeft={12 + depth * 18}
        backgroundColor={selected ? '$secondaryBackground' : 'transparent'}
        borderBottomColor="$border"
        borderBottomWidth={1}
        opacity={disabled ? 0.6 : 1}
      >
        <Icon
          type={selected ? 'Checkmark' : 'Folder'}
          color={selected ? '$primaryText' : '$tertiaryText'}
          size="$s"
        />
        <YStack flex={1} minWidth={0} gap={2}>
          <Text
            size="$label/m"
            color={selected ? '$primaryText' : '$secondaryText'}
            numberOfLines={1}
          >
            {label}
          </Text>
          {showPath ? (
            <Text size="$label/s" color="$tertiaryText" numberOfLines={1}>
              {path}
            </Text>
          ) : null}
        </YStack>
        {disabledLabel ? (
          <Text size="$label/s" color="$tertiaryText" numberOfLines={1}>
            {disabledLabel}
          </Text>
        ) : null}
      </XStack>
    </Pressable>
  );
}

export function MetadataPill({
  icon,
  label,
  tone = 'neutral',
}: {
  icon?: 'Markdown';
  label: string;
  tone?: 'neutral' | 'notice' | 'negative';
}) {
  return (
    <XStack
      alignItems="center"
      gap="$xs"
      borderRadius="$s"
      paddingHorizontal="$s"
      paddingVertical={4}
      backgroundColor={
        tone === 'negative' ? '$negativeBackground' : '$secondaryBackground'
      }
      borderColor={tone === 'negative' ? '$negativeBorder' : '$border'}
      borderWidth={1}
    >
      {icon ? <Icon type={icon} color="$tertiaryText" size="$s" /> : null}
      <Text
        size="$label/s"
        color={tone === 'negative' ? '$negativeActionText' : '$tertiaryText'}
        letterSpacing={0}
        numberOfLines={1}
      >
        {label}
      </Text>
    </XStack>
  );
}

export function NotesMessage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$m"
      padding="$2xl"
      backgroundColor="$background"
    >
      {children}
      <Text size="$label/l" color="$primaryText" textAlign="center">
        {title}
      </Text>
      {subtitle ? (
        <Text size="$label/m" color="$tertiaryText" textAlign="center">
          {subtitle}
        </Text>
      ) : null}
    </YStack>
  );
}

import * as db from '@tloncorp/shared/db';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import type { FolderRow } from './notesTree';
import { getFolderLabel } from './notesTree';

/**
 * State for a dialog that targets a single entity (move note, rename folder,
 * ...) and runs an async action on it. `handleOpenChange` refuses to close
 * while the action is pending; `run` closes on success and leaves the dialog
 * open on failure so the user can retry.
 */
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

export function NotesErrorMessage({ error }: { error: string }) {
  return (
    <XStack
      paddingHorizontal="$l"
      paddingVertical="$s"
      backgroundColor="$negativeBackground"
      borderBottomColor="$negativeBorder"
      borderBottomWidth={1}
    >
      <Text size="$label/s" color="$negativeActionText">
        {error}
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
  const isWeb = Platform.OS === 'web';
  const currentFolderIds = useMemo(() => {
    return note ? new Set([note.folderId]) : new Set<number>();
  }, [note]);
  const title = note?.title?.trim() || 'Untitled';

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isMoving) {
        onOpenChange(nextOpen);
      }
    },
    [isMoving, onOpenChange]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={handleOpenChange}
      mode={isWeb ? 'dialog' : 'sheet'}
      closeButton={isWeb}
      modal
      snapPointsMode="fit"
      dialogContentProps={{ width: 420, maxWidth: '90%' }}
    >
      <ActionSheet.ScrollableContent>
        <YStack testID="NotesMoveNoteSheet" gap="$l" padding="$l">
          <ActionSheet.SimpleHeader
            title="Move note"
            subtitle={`Choose a new folder for ${title}.`}
          />
          <FolderPicker
            disabledFolderIds={currentFolderIds}
            disabledLabel="Current"
            folderRows={folderRows}
            isLoading={isMoving}
            onSelectFolder={onMove}
            selectedFolderId={note?.folderId ?? null}
            testID="NotesMoveNoteFolderPicker"
          />
          <XStack gap="$m" justifyContent="flex-end">
            <Button
              preset="minimal"
              label="Cancel"
              disabled={isMoving}
              onPress={() => onOpenChange(false)}
            />
          </XStack>
        </YStack>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

export function FolderPicker({
  disabledFolderIds,
  disabledFolderLabels,
  disabledLabel,
  folderRows,
  isLoading = false,
  maxHeight = 220,
  onSelectFolder,
  selectedFolderId,
  testID,
}: {
  disabledFolderIds?: Set<number>;
  disabledFolderLabels?: Map<number, string>;
  disabledLabel?: string;
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
        {folderRows.map(({ folder, depth, path }) => {
          const disabled =
            isLoading || Boolean(disabledFolderIds?.has(folder.folderId));
          const disabledRowLabel =
            disabledFolderLabels?.get(folder.folderId) ??
            (disabledFolderIds?.has(folder.folderId)
              ? disabledLabel
              : undefined);
          return (
            <FolderPickerRow
              key={folder.id}
              depth={depth}
              disabled={disabled}
              disabledLabel={disabledRowLabel}
              folder={folder}
              path={path}
              selected={selectedFolderId === folder.folderId}
              onPress={() => onSelectFolder(folder.folderId)}
            />
          );
        })}
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
        tone === 'negative'
          ? '$negativeBackground'
          : tone === 'notice'
            ? '$secondaryBackground'
            : '$secondaryBackground'
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

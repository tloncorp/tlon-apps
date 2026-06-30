import * as db from '@tloncorp/shared/db';
import { collectDescendantFolderIds } from '@tloncorp/shared/logic/notesTree';
import { Button, Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { YStack } from 'tamagui';

import { TextInput } from '../Form';
import {
  FolderDestinationSearch,
  FolderPicker,
  MoveDestinationSheet,
  NotesDialog,
  useFolderDestinationSelection,
} from './NotesCommon';
import type { FolderRow } from './notesTree';
import { getFolderLabel } from './notesTree';

function FolderNameField({
  name,
  onNameChange,
  onSubmit,
}: {
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
}) {
  return (
    <YStack gap="$s">
      <Text size="$label/s" color="$secondaryText">
        Name
      </Text>
      <TextInput
        autoFocus={Platform.OS === 'web'}
        value={name}
        onChangeText={onNameChange}
        placeholder="Folder name"
        onSubmitEditing={onSubmit}
        returnKeyType="done"
      />
    </YStack>
  );
}

export function AddFolderDialog({
  folderRows,
  isCreating,
  name,
  onCreate,
  onNameChange,
  onOpenChange,
  onParentChange,
  open,
  parentFolderId,
}: {
  folderRows: FolderRow[];
  isCreating: boolean;
  name: string;
  onCreate: () => void;
  onNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onParentChange: (folderId: number) => void;
  open: boolean;
  parentFolderId: number | null;
}) {
  return (
    <NotesDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add folder"
      subtitle="Choose where this folder should live."
      testID="NotesAddFolderDialog"
      keyboardBehavior="interactive"
      confirmButton={
        <Button
          size="small"
          fill="solid"
          type="primary"
          leadingIcon="Add"
          label="Add folder"
          loading={isCreating}
          disabled={!name.trim()}
          onPress={onCreate}
        />
      }
    >
      <YStack gap="$m">
        <FolderNameField
          name={name}
          onNameChange={onNameChange}
          onSubmit={onCreate}
        />

        <YStack gap="$s">
          <Text size="$label/s" color="$secondaryText">
            Parent folder
          </Text>
          <FolderPicker
            folderRows={folderRows}
            onSelectFolder={onParentChange}
            selectedFolderId={parentFolderId}
            testID="NotesAddFolderParentPicker"
          />
        </YStack>
      </YStack>
    </NotesDialog>
  );
}

export function RenameFolderDialog({
  folder,
  isRenaming,
  name,
  onNameChange,
  onOpenChange,
  onRename,
  open,
}: {
  folder: db.NotesFolder | null;
  isRenaming: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  open: boolean;
}) {
  const label = getFolderLabel(folder);

  return (
    <NotesDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename folder"
      subtitle={`Update ${label}.`}
      testID="NotesRenameFolderDialog"
      keyboardBehavior="interactive"
      cancelDisabled={isRenaming}
      confirmButton={
        <Button
          size="small"
          fill="solid"
          type="primary"
          leadingIcon="EditList"
          label="Rename"
          loading={isRenaming}
          disabled={!name.trim()}
          onPress={onRename}
        />
      }
    >
      <FolderNameField
        name={name}
        onNameChange={onNameChange}
        onSubmit={onRename}
      />
    </NotesDialog>
  );
}

export function MoveFolderSheet({
  folder,
  folderRows,
  folders,
  isMoving,
  onMove,
  onOpenChange,
  open,
}: {
  folder: db.NotesFolder | null;
  folderRows: FolderRow[];
  folders: db.NotesFolder[];
  isMoving: boolean;
  onMove: (folderId: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const label = getFolderLabel(folder);
  const hiddenFolderIds = useMemo(() => {
    const ids = new Set<number>();
    if (!folder) return ids;

    collectDescendantFolderIds(folders, folder.folderId).forEach((id) => {
      ids.add(id);
    });

    if (folder.parentFolderId !== null && folder.parentFolderId !== undefined) {
      ids.add(folder.parentFolderId);
    }

    return ids;
  }, [folder, folders]);
  const { selectedDestination, selectedFolderId, setSelectedFolderId } =
    useFolderDestinationSelection({
      folderRows,
      hiddenFolderIds,
      resetKey: open ? folder?.id : null,
    });

  return (
    <MoveDestinationSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Move folder"
      subtitle={`Choose a new parent for ${label}.`}
      testID="NotesMoveFolderSheet"
      isMoving={isMoving}
      selectedDestination={selectedDestination}
      onConfirm={onMove}
    >
      <FolderDestinationSearch
        folderRows={folderRows}
        hiddenFolderIds={hiddenFolderIds}
        isLoading={isMoving}
        onSelectFolder={setSelectedFolderId}
        resetKey={open ? folder?.id : null}
        selectedFolderId={selectedFolderId}
        testID="NotesMoveFolderParentPicker"
      />
    </MoveDestinationSheet>
  );
}

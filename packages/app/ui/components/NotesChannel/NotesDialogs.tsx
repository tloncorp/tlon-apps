import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { YStack } from 'tamagui';

import { TextInput } from '../Form';
import { FolderPicker, NotesDialog } from './NotesCommon';
import type { FolderRow } from './notesTree';
import { collectDescendantFolderIds, getFolderLabel } from './notesTree';

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
  const disabledFolders = useMemo(() => {
    const labels = new Map<number, string>();
    if (!folder) {
      return labels;
    }

    collectDescendantFolderIds(folders, folder.folderId).forEach((id) => {
      labels.set(id, id === folder.folderId ? 'This folder' : 'Nested');
    });

    if (folder.parentFolderId !== null && folder.parentFolderId !== undefined) {
      labels.set(folder.parentFolderId, 'Current');
    }

    return labels;
  }, [folder, folders]);

  return (
    <NotesDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Move folder"
      subtitle={`Choose a new parent for ${label}.`}
      testID="NotesMoveFolderSheet"
      cancelDisabled={isMoving}
    >
      <FolderPicker
        disabledFolders={disabledFolders}
        folderRows={folderRows}
        isLoading={isMoving}
        onSelectFolder={onMove}
        selectedFolderId={folder?.parentFolderId ?? null}
        testID="NotesMoveFolderParentPicker"
      />
    </NotesDialog>
  );
}

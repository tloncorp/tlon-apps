import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { YStack } from 'tamagui';

import type { Action } from '../ActionSheet';
import { ActionSheet } from '../ActionSheet';
import { TextInput } from '../Form';
import { FolderPicker, NotesDialog } from './NotesCommon';
import type { FolderRow } from './notesTree';
import { collectDescendantFolderIds, getFolderLabel } from './notesTree';

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
        <YStack gap="$s">
          <Text size="$label/s" color="$secondaryText">
            Name
          </Text>
          <TextInput
            autoFocus={Platform.OS === 'web'}
            value={name}
            onChangeText={onNameChange}
            placeholder="Folder name"
            onSubmitEditing={onCreate}
            returnKeyType="done"
          />
        </YStack>

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
      <YStack gap="$s">
        <Text size="$label/s" color="$secondaryText">
          Name
        </Text>
        <TextInput
          autoFocus={Platform.OS === 'web'}
          value={name}
          onChangeText={onNameChange}
          placeholder="Folder name"
          onSubmitEditing={onRename}
          returnKeyType="done"
        />
      </YStack>
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
  const { disabledFolderIds, disabledFolderLabels } = useMemo(() => {
    const ids = new Set<number>();
    const labels = new Map<number, string>();
    if (!folder) {
      return { disabledFolderIds: ids, disabledFolderLabels: labels };
    }

    collectDescendantFolderIds(folders, folder.folderId).forEach((id) => {
      ids.add(id);
      labels.set(id, id === folder.folderId ? 'This folder' : 'Nested');
    });

    if (folder.parentFolderId !== null && folder.parentFolderId !== undefined) {
      ids.add(folder.parentFolderId);
      labels.set(folder.parentFolderId, 'Current');
    }

    return { disabledFolderIds: ids, disabledFolderLabels: labels };
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
        disabledFolderIds={disabledFolderIds}
        disabledFolderLabels={disabledFolderLabels}
        folderRows={folderRows}
        isLoading={isMoving}
        onSelectFolder={onMove}
        selectedFolderId={folder?.parentFolderId ?? null}
        testID="NotesMoveFolderParentPicker"
      />
    </NotesDialog>
  );
}

export function FolderActionsSheet({
  folder,
  onMove,
  onOpenChange,
  onRename,
  open,
}: {
  folder: db.NotesFolder | null;
  onMove: (folder: db.NotesFolder) => void;
  onOpenChange: (open: boolean) => void;
  onRename: (folder: db.NotesFolder) => void;
  open: boolean;
}) {
  const isWeb = Platform.OS === 'web';
  const label = getFolderLabel(folder);
  const actions = useMemo<Action[]>(
    () => [
      {
        title: 'Rename folder',
        description: 'Update the folder name.',
        startIcon: 'EditList',
        action: () => {
          if (folder) {
            onRename(folder);
          }
        },
        testID: 'NotesRenameFolderAction',
      },
      {
        title: 'Move folder',
        description: 'Choose a new parent folder.',
        startIcon: 'Folder',
        action: () => {
          if (folder) {
            onMove(folder);
          }
        },
        testID: 'NotesMoveFolderAction',
      },
    ],
    [folder, onMove, onRename]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={isWeb ? 'dialog' : 'sheet'}
      closeButton={isWeb}
      modal
      snapPointsMode="fit"
      dialogContentProps={{ width: 420, maxWidth: '90%' }}
    >
      <ActionSheet.SimpleHeader title={label} subtitle="Folder actions" />
      <ActionSheet.Content>
        <ActionSheet.ActionGroup accent="neutral">
          {actions.map((action) => (
            <ActionSheet.Action
              key={action.title}
              action={action}
              testID={action.testID}
            />
          ))}
        </ActionSheet.ActionGroup>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

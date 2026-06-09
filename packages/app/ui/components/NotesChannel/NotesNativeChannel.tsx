import { NavigationProp, useNavigation } from '@react-navigation/native';
import {
  createNotebookFolder,
  createNotebookNote,
  moveNotebookFolder,
  moveNotebookNote,
  renameNotebookFolder,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, YStack } from 'tamagui';

import type { RootStackParamList } from '../../../navigation/types';
import type { Action } from '../ActionSheet';
import { SimpleActionSheet } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { TextInput } from '../Form';
import {
  MoveNoteSheet,
  NotebookGateMessage,
  NotesErrorMessage,
  errorMessage,
  useEntityDialog,
  useNotebookData,
} from './NotesCommon';
import {
  AddFolderDialog,
  FolderActionsSheet,
  MoveFolderSheet,
  RenameFolderDialog,
} from './NotesDialogs';
import { NotesHeaderActions } from './NotesHeaderActions';
import { FolderTreeRow, NoteRow } from './NotesTreeRows';
import {
  buildFolderNoteCounts,
  buildFolderRows,
  buildNotesTreeRows,
  filterNotesTreeData,
  getFolderLabel,
  normalizeSearchText,
} from './notesTree';
import type { NotesTreeViewStyle } from './notesTree';

export function NotesNativeChannel({
  channelId,
  groupId,
  notebookFlag,
}: {
  channelId: string;
  groupId?: string | null;
  notebookFlag: string | null | undefined;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(
    null
  );
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newActionSheetOpen, setNewActionSheetOpen] = useState(false);
  const [folderActionsFolder, setFolderActionsFolder] =
    useState<db.NotesFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [notesFilterQuery, setNotesFilterQuery] = useState('');
  const {
    entity: movingNote,
    isPending: isMovingNote,
    open: openMoveNoteDialog,
    close: closeMoveNoteDialog,
    handleOpenChange: handleMoveNoteOpenChange,
    run: runMoveNote,
  } = useEntityDialog<db.NotesNote>();
  const {
    entity: renamingFolder,
    isPending: isRenamingFolder,
    open: openRenameFolderDialog,
    close: closeRenameFolderDialog,
    handleOpenChange: handleRenameFolderOpenChange,
    run: runRenameFolder,
  } = useEntityDialog<db.NotesFolder>();
  const {
    entity: movingFolder,
    isPending: isMovingFolder,
    open: openMoveFolderDialog,
    close: closeMoveFolderDialog,
    handleOpenChange: handleMoveFolderOpenChange,
    run: runMoveFolder,
  } = useEntityDialog<db.NotesFolder>();
  const { value: treeViewStyle, setValue: setTreeViewStyle } =
    db.notesTreeViewPreference.useStorageItem();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(
    () => new Set()
  );
  const openNewSheetRef = useRef<() => void>(() => {});
  const initializedFolderIdsRef = useRef<Set<number>>(new Set());

  const { folders, notes, canEdit, rootFolderId, joinFailed, gate } =
    useNotebookData(notebookFlag);

  const parentFolderRows = useMemo(
    () => buildFolderRows(folders, rootFolderId, { includeRoot: true }),
    [folders, rootFolderId]
  );

  const normalizedNotesFilterQuery = useMemo(
    () => normalizeSearchText(notesFilterQuery),
    [notesFilterQuery]
  );
  const filteredTreeData = useMemo(
    () =>
      filterNotesTreeData({
        folders,
        notes,
        query: normalizedNotesFilterQuery,
        rootFolderId,
      }),
    [folders, normalizedNotesFilterQuery, notes, rootFolderId]
  );
  const treeFolders = filteredTreeData.folders;
  const treeNotes = filteredTreeData.notes;
  const treeExpandedFolderIds = useMemo(() => {
    if (!normalizedNotesFilterQuery) {
      return expandedFolderIds;
    }

    return new Set(treeFolders.map((folder) => folder.folderId));
  }, [expandedFolderIds, normalizedNotesFilterQuery, treeFolders]);
  const folderNoteCounts = useMemo(
    () => buildFolderNoteCounts(treeFolders, treeNotes),
    [treeFolders, treeNotes]
  );
  const treeRows = useMemo(
    () =>
      buildNotesTreeRows({
        expandedFolderIds: treeExpandedFolderIds,
        folderNoteCounts,
        folders: treeFolders,
        notes: treeNotes,
        rootFolderId,
      }),
    [
      folderNoteCounts,
      rootFolderId,
      treeExpandedFolderIds,
      treeFolders,
      treeNotes,
    ]
  );

  useEffect(() => {
    setExpandedFolderIds((currentIds) => {
      let nextIds = currentIds;
      folders.forEach((folder) => {
        if (initializedFolderIdsRef.current.has(folder.folderId)) {
          return;
        }

        initializedFolderIdsRef.current.add(folder.folderId);
        if (folder.folderId === rootFolderId) {
          return;
        }

        if (nextIds === currentIds) {
          nextIds = new Set(currentIds);
        }
        nextIds.add(folder.folderId);
      });
      return nextIds;
    });
  }, [folders, rootFolderId]);

  const openNote = useCallback(
    (note: db.NotesNote) => {
      navigation.navigate('NotesDetail', {
        channelId,
        groupId: groupId ?? undefined,
        noteId: note.noteId,
      });
    },
    [channelId, groupId, navigation]
  );

  const expandFolder = useCallback((folderId: number) => {
    setExpandedFolderIds((currentIds) => {
      if (currentIds.has(folderId)) {
        return currentIds;
      }
      const nextIds = new Set(currentIds);
      nextIds.add(folderId);
      return nextIds;
    });
  }, []);

  // Clears the error banner, runs the action, and surfaces any failure in the
  // banner using `fallback` when the error carries no message.
  const runAction = useCallback(
    async (fallback: string, action: () => Promise<void>) => {
      setError(null);
      try {
        await action();
      } catch (e) {
        setError(errorMessage(e, fallback));
      }
    },
    []
  );

  const handleCreateNote = useCallback(async () => {
    if (!notebookFlag || !rootFolderId || !canEdit || isCreatingNote) return;
    const targetFolderId = selectedFolderId ?? rootFolderId;
    setIsCreatingNote(true);
    await runAction('Failed to create note', async () => {
      expandFolder(targetFolderId);
      const note = await createNotebookNote({
        notebookFlag,
        folderId: targetFolderId,
        title: 'Untitled',
      });
      if (note) {
        openNote(note);
      }
    });
    setIsCreatingNote(false);
  }, [
    canEdit,
    expandFolder,
    isCreatingNote,
    notebookFlag,
    openNote,
    rootFolderId,
    runAction,
    selectedFolderId,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (!notebookFlag || !rootFolderId || !newFolderName.trim() || !canEdit) {
      return;
    }
    const parentFolderId = newFolderParentId ?? rootFolderId;
    setIsCreatingFolder(true);
    await runAction('Failed to create folder', async () => {
      await createNotebookFolder({
        notebookFlag,
        parentFolderId,
        name: newFolderName.trim(),
      });
      expandFolder(parentFolderId);
      setNewFolderName('');
      setAddFolderOpen(false);
    });
    setIsCreatingFolder(false);
  }, [
    canEdit,
    expandFolder,
    newFolderName,
    newFolderParentId,
    notebookFlag,
    rootFolderId,
    runAction,
  ]);

  const handleAddFolderOpenChange = useCallback(
    (open: boolean) => {
      setAddFolderOpen(open);
      if (open) {
        setNewFolderName('');
        setNewFolderParentId(selectedFolderId ?? rootFolderId);
      }
    },
    [rootFolderId, selectedFolderId]
  );

  const handleOpenNewSheet = useCallback(() => {
    setNewActionSheetOpen(true);
  }, []);

  const handleTreeViewStyleChange = useCallback(
    (style: NotesTreeViewStyle) => {
      void setTreeViewStyle(style);
    },
    [setTreeViewStyle]
  );

  const handleOpenMoveNote = useCallback(
    (note: db.NotesNote) => {
      if (!canEdit) return;
      openMoveNoteDialog(note);
    },
    [canEdit, openMoveNoteDialog]
  );

  const handleMoveNoteToFolder = useCallback(
    async (folderId: number) => {
      if (!notebookFlag || !movingNote || !canEdit || isMovingNote) return;

      if (folderId === movingNote.folderId) {
        closeMoveNoteDialog();
        return;
      }

      await runAction('Failed to move note', () =>
        runMoveNote(async () => {
          await moveNotebookNote({
            notebookFlag,
            noteId: movingNote.noteId,
            folderId,
          });
          expandFolder(folderId);
          setSelectedFolderId(folderId);
        })
      );
    },
    [
      canEdit,
      closeMoveNoteDialog,
      expandFolder,
      isMovingNote,
      movingNote,
      notebookFlag,
      runAction,
      runMoveNote,
    ]
  );

  const handleOpenFolderActions = useCallback(
    (folder: db.NotesFolder) => {
      if (!canEdit) return;
      setFolderActionsFolder(folder);
    },
    [canEdit]
  );

  const handleOpenRenameFolder = useCallback(
    (folder: db.NotesFolder) => {
      setFolderActionsFolder(null);
      openRenameFolderDialog(folder);
      setRenameFolderName(getFolderLabel(folder));
    },
    [openRenameFolderDialog]
  );

  const handleOpenMoveFolder = useCallback(
    (folder: db.NotesFolder) => {
      setFolderActionsFolder(null);
      openMoveFolderDialog(folder);
    },
    [openMoveFolderDialog]
  );

  const handleRenameFolder = useCallback(async () => {
    if (!notebookFlag || !renamingFolder || !canEdit || isRenamingFolder) {
      return;
    }

    const nextName = renameFolderName.trim();
    if (!nextName) return;

    if (nextName === renamingFolder.name) {
      closeRenameFolderDialog();
      return;
    }

    await runAction('Failed to rename folder', () =>
      runRenameFolder(async () => {
        await renameNotebookFolder({
          notebookFlag,
          folder: renamingFolder,
          name: nextName,
        });
      })
    );
  }, [
    canEdit,
    closeRenameFolderDialog,
    isRenamingFolder,
    notebookFlag,
    renameFolderName,
    renamingFolder,
    runAction,
    runRenameFolder,
  ]);

  const handleMoveFolderToParent = useCallback(
    async (parentFolderId: number) => {
      if (!notebookFlag || !movingFolder || !canEdit || isMovingFolder) {
        return;
      }

      if (parentFolderId === movingFolder.parentFolderId) {
        closeMoveFolderDialog();
        return;
      }

      await runAction('Failed to move folder', () =>
        runMoveFolder(async () => {
          await moveNotebookFolder({
            notebookFlag,
            folder: movingFolder,
            parentFolderId,
          });
          expandFolder(parentFolderId);
          expandFolder(movingFolder.folderId);
          setSelectedFolderId(movingFolder.folderId);
        })
      );
    },
    [
      canEdit,
      closeMoveFolderDialog,
      expandFolder,
      isMovingFolder,
      movingFolder,
      notebookFlag,
      runAction,
      runMoveFolder,
    ]
  );

  const newActions = useMemo<Action[]>(
    () => [
      {
        title: 'New note',
        description: 'Create a note in the selected folder.',
        startIcon: 'ChannelNote',
        action: () => {
          setNewActionSheetOpen(false);
          handleCreateNote();
        },
        disabled: isCreatingNote,
        testID: 'NotesNewNoteAction',
      },
      {
        title: 'New folder',
        description: 'Create a folder under the selected folder.',
        startIcon: 'Folder',
        action: () => {
          setNewActionSheetOpen(false);
          handleAddFolderOpenChange(true);
        },
        disabled: isCreatingFolder,
        testID: 'NotesNewFolderAction',
      },
    ],
    [
      handleAddFolderOpenChange,
      handleCreateNote,
      isCreatingFolder,
      isCreatingNote,
    ]
  );

  const toggleFolder = useCallback(
    (folderId: number, hasChildren: boolean) => {
      if (!hasChildren) {
        setSelectedFolderId((currentFolderId) =>
          currentFolderId === folderId ? null : folderId
        );
        return;
      }

      const isExpanded = expandedFolderIds.has(folderId);
      setSelectedFolderId((currentFolderId) =>
        currentFolderId === folderId
          ? null
          : isExpanded
            ? currentFolderId
            : folderId
      );
      setExpandedFolderIds((currentIds) => {
        const nextIds = new Set(currentIds);
        if (isExpanded) {
          nextIds.delete(folderId);
        } else {
          nextIds.add(folderId);
        }
        return nextIds;
      });
    },
    [expandedFolderIds]
  );

  openNewSheetRef.current = handleOpenNewSheet;

  useRegisterChannelHeaderItem(
    useMemo(() => {
      if (!notebookFlag || joinFailed) return null;
      return (
        <NotesHeaderActions
          canEdit={canEdit}
          openNewSheetRef={openNewSheetRef}
          treeViewStyle={treeViewStyle}
          onTreeViewStyleChange={handleTreeViewStyleChange}
        />
      );
    }, [
      canEdit,
      handleTreeViewStyleChange,
      joinFailed,
      notebookFlag,
      treeViewStyle,
    ])
  );

  if (gate) {
    return (
      <NotebookGateMessage
        gate={gate}
        loadingTitle="Loading notebook"
        unavailableTitle="Notebook unavailable"
      />
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {error ? <NotesErrorMessage error={error} /> : null}

      <NotesContentFrame
        viewStyle={treeViewStyle}
        paddingTop={treeViewStyle === 'notes' ? '$l' : '$m'}
        paddingBottom="$s"
        backgroundColor="$background"
      >
        <NotesTreeSearchInput
          query={notesFilterQuery}
          onQueryChange={setNotesFilterQuery}
        />
      </NotesContentFrame>

      <ScrollView flex={1}>
        <NotesContentFrame
          viewStyle={treeViewStyle}
          paddingTop="$s"
          paddingBottom={treeViewStyle === 'notes' ? '$l' : '$m'}
        >
          <YStack
            gap={treeViewStyle === 'notes' ? 0 : 2}
            borderColor={treeViewStyle === 'notes' ? '$border' : 'transparent'}
            borderWidth={treeViewStyle === 'notes' ? 1 : 0}
            borderRadius={treeViewStyle === 'notes' ? '$xl' : 0}
            overflow={treeViewStyle === 'notes' ? 'hidden' : 'visible'}
            backgroundColor={
              treeViewStyle === 'notes' ? '$background' : 'transparent'
            }
          >
            {treeRows.length === 0 ? (
              <SidebarEmpty
                title={
                  normalizedNotesFilterQuery
                    ? 'No matching notes or folders'
                    : 'No notes or folders'
                }
                action={
                  normalizedNotesFilterQuery ? (
                    <Button
                      size="small"
                      fill="ghost"
                      type="secondary"
                      leadingIcon="Close"
                      label="Clear search"
                      onPress={() => setNotesFilterQuery('')}
                    />
                  ) : canEdit ? (
                    <Button
                      size="small"
                      fill="ghost"
                      type="primary"
                      leadingIcon="Add"
                      label="New"
                      loading={isCreatingNote || isCreatingFolder}
                      onPress={handleOpenNewSheet}
                    />
                  ) : null
                }
              />
            ) : (
              treeRows.map((row) =>
                row.type === 'folder' ? (
                  <FolderTreeRow
                    key={row.folder.id}
                    depth={row.depth}
                    expanded={row.expanded}
                    hasChildren={row.hasChildren}
                    label={getFolderLabel(row.folder)}
                    noteCount={row.noteCount}
                    selected={selectedFolderId === row.folder.folderId}
                    viewStyle={treeViewStyle}
                    onOpenMenu={
                      canEdit
                        ? () => handleOpenFolderActions(row.folder)
                        : undefined
                    }
                    onPress={() =>
                      toggleFolder(row.folder.folderId, row.hasChildren)
                    }
                  />
                ) : (
                  <NoteRow
                    key={row.note.id}
                    canEdit={canEdit}
                    depth={row.depth}
                    note={row.note}
                    viewStyle={treeViewStyle}
                    onMove={() => handleOpenMoveNote(row.note)}
                    onPress={() => openNote(row.note)}
                  />
                )
              )
            )}
          </YStack>
        </NotesContentFrame>
      </ScrollView>
      <SimpleActionSheet
        open={newActionSheetOpen}
        onOpenChange={setNewActionSheetOpen}
        title="New"
        actions={newActions}
        modal
      />
      <AddFolderDialog
        folderRows={parentFolderRows}
        isCreating={isCreatingFolder}
        name={newFolderName}
        onCreate={handleCreateFolder}
        onNameChange={setNewFolderName}
        onOpenChange={handleAddFolderOpenChange}
        onParentChange={setNewFolderParentId}
        open={addFolderOpen}
        parentFolderId={newFolderParentId ?? rootFolderId}
      />
      <MoveNoteSheet
        folderRows={parentFolderRows}
        isMoving={isMovingNote}
        note={movingNote}
        onMove={handleMoveNoteToFolder}
        onOpenChange={handleMoveNoteOpenChange}
        open={movingNote !== null}
      />
      <FolderActionsSheet
        folder={folderActionsFolder}
        onMove={handleOpenMoveFolder}
        onOpenChange={(open) => {
          if (!open) setFolderActionsFolder(null);
        }}
        onRename={handleOpenRenameFolder}
        open={folderActionsFolder !== null}
      />
      <RenameFolderDialog
        folder={renamingFolder}
        isRenaming={isRenamingFolder}
        name={renameFolderName}
        onNameChange={setRenameFolderName}
        onOpenChange={handleRenameFolderOpenChange}
        onRename={handleRenameFolder}
        open={renamingFolder !== null}
      />
      <MoveFolderSheet
        folder={movingFolder}
        folderRows={parentFolderRows}
        folders={folders}
        isMoving={isMovingFolder}
        onMove={handleMoveFolderToParent}
        onOpenChange={handleMoveFolderOpenChange}
        open={movingFolder !== null}
      />
    </YStack>
  );
}

function NotesContentFrame({
  viewStyle,
  children,
  ...props
}: {
  viewStyle: NotesTreeViewStyle;
  children: ReactNode;
} & Omit<ComponentProps<typeof YStack>, 'children'>) {
  return (
    <YStack
      width="100%"
      maxWidth={760}
      marginHorizontal="auto"
      paddingLeft={viewStyle === 'notes' ? '$m' : '$s'}
      paddingRight={viewStyle === 'notes' ? '$l' : '$m'}
      {...props}
    >
      {children}
    </YStack>
  );
}

function SidebarEmpty({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <YStack padding="$l" gap="$m" alignItems="flex-start">
      <Text size="$label/m" color="$tertiaryText" letterSpacing={0}>
        {title}
      </Text>
      {action}
    </YStack>
  );
}

function NotesTreeSearchInput({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <TextInput
      icon="Search"
      placeholder="Search notes"
      value={query}
      onChangeText={onQueryChange}
      spellCheck={false}
      autoCorrect={false}
      autoCapitalize="none"
      testID="NotesTreeSearchInput"
      rightControls={
        query !== '' ? (
          <TextInput.InnerButton
            label="Clear"
            onPress={() => onQueryChange('')}
          />
        ) : null
      }
    />
  );
}

import { NavigationProp, useNavigation } from '@react-navigation/native';
import {
  createNotebookFolder,
  createNotebookNote,
  moveNotebookFolder,
  moveNotebookNote,
  renameNotebookFolder,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, MutableRefObject, ReactNode } from 'react';
import { Platform } from 'react-native';
import { ScrollView, TamaguiWebElement, XStack, YStack, styled } from 'tamagui';

import type { RootStackParamList } from '../../../navigation/types';
import type { Action } from '../ActionSheet';
import { ActionSheet, SimpleActionSheet } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { TextInput } from '../Form';
import { ListItem } from '../ListItem';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import {
  MoveNoteSheet,
  NotebookGateMessage,
  NotesErrorMessage,
  useEntityDialog,
  useNotebookData,
} from './NotesCommon';
import {
  AddFolderDialog,
  FolderActionsSheet,
  MoveFolderSheet,
  RenameFolderDialog,
} from './NotesDialogs';
import {
  buildFolderNoteCounts,
  buildFolderRows,
  buildNotesTreeRows,
  filterNotesTreeData,
  formatNoteDate,
  getFolderLabel,
  normalizeSearchText,
} from './notesTree';
import type { NotesTreeViewStyle } from './notesTree';

const TREE_ROW_HEIGHT = 44;
const TREE_LEVEL_WIDTH = 20;
const TREE_ROW_LEFT_PADDING = 2;
const TREE_ROW_GAP = 6;
const TREE_GUIDE_LEFT = TREE_ROW_LEFT_PADDING + TREE_ROW_GAP;
const TREE_CARET_CENTER_Y = TREE_ROW_HEIGHT / 2;
const TREE_CHILD_GUIDE_CARET_OFFSET = 8;
const TREE_CHILD_GUIDE_TOP =
  TREE_CARET_CENTER_Y + TREE_CHILD_GUIDE_CARET_OFFSET;
// Row frame for the comfortable ('notes') view; the outline view uses
// TreeRowFrame below. Pass minHeight and depth-based paddingLeft inline.
const NotesViewRow = styled(XStack, {
  alignItems: 'center',
  gap: '$m',
  paddingVertical: '$s',
  paddingRight: '$m',
  backgroundColor: '$background',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
  variants: {
    selected: {
      true: {
        backgroundColor: '$secondaryBackground',
      },
    },
  } as const,
});

const NOTES_TREE_VIEW_OPTIONS: {
  id: NotesTreeViewStyle;
  title: string;
  description: string;
  icon: IconType;
}[] = [
  {
    id: 'outline',
    title: 'Normal',
    description: 'Balanced outline with guide rails.',
    icon: 'BulletList',
  },
  {
    id: 'notes',
    title: 'Comfortable',
    description: 'Roomier rows with folder counts.',
    icon: 'Folder',
  },
];

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
        noteId: String(note.noteId),
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

  const handleCreateNote = useCallback(async () => {
    if (!notebookFlag || !rootFolderId || !canEdit || isCreatingNote) return;
    const targetFolderId = selectedFolderId ?? rootFolderId;
    setIsCreatingNote(true);
    setError(null);
    try {
      expandFolder(targetFolderId);
      const note = await createNotebookNote({
        notebookFlag,
        folderId: targetFolderId,
        title: 'Untitled',
      });
      if (note) {
        openNote(note);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create note');
    } finally {
      setIsCreatingNote(false);
    }
  }, [
    canEdit,
    expandFolder,
    isCreatingNote,
    notebookFlag,
    openNote,
    rootFolderId,
    selectedFolderId,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (!notebookFlag || !rootFolderId || !newFolderName.trim() || !canEdit) {
      return;
    }
    const parentFolderId = newFolderParentId ?? rootFolderId;
    setIsCreatingFolder(true);
    setError(null);
    try {
      await createNotebookFolder({
        notebookFlag,
        parentFolderId,
        name: newFolderName.trim(),
      });
      expandFolder(parentFolderId);
      setNewFolderName('');
      setAddFolderOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  }, [
    canEdit,
    expandFolder,
    newFolderName,
    newFolderParentId,
    notebookFlag,
    rootFolderId,
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

      setError(null);
      try {
        await runMoveNote(async () => {
          await moveNotebookNote({
            notebookFlag,
            noteId: movingNote.noteId,
            folderId,
          });
          expandFolder(folderId);
          setSelectedFolderId(folderId);
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to move note');
      }
    },
    [
      canEdit,
      closeMoveNoteDialog,
      expandFolder,
      isMovingNote,
      movingNote,
      notebookFlag,
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

    setError(null);
    try {
      await runRenameFolder(async () => {
        await renameNotebookFolder({
          notebookFlag,
          folder: renamingFolder,
          name: nextName,
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename folder');
    }
  }, [
    canEdit,
    closeRenameFolderDialog,
    isRenamingFolder,
    notebookFlag,
    renameFolderName,
    renamingFolder,
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

      setError(null);
      try {
        await runMoveFolder(async () => {
          await moveNotebookFolder({
            notebookFlag,
            folder: movingFolder,
            parentFolderId,
          });
          expandFolder(parentFolderId);
          expandFolder(movingFolder.folderId);
          setSelectedFolderId(movingFolder.folderId);
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to move folder');
      }
    },
    [
      canEdit,
      closeMoveFolderDialog,
      expandFolder,
      isMovingFolder,
      movingFolder,
      notebookFlag,
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
      setSelectedFolderId((currentFolderId) => {
        if (isExpanded) {
          return currentFolderId === folderId ? null : currentFolderId;
        }
        return currentFolderId === folderId ? null : folderId;
      });
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

function NotesHeaderActions({
  canEdit,
  openNewSheetRef,
  treeViewStyle,
  onTreeViewStyleChange,
}: {
  canEdit: boolean;
  openNewSheetRef: MutableRefObject<() => void>;
  treeViewStyle: NotesTreeViewStyle;
  onTreeViewStyleChange: (style: NotesTreeViewStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const newAction = useMemo<Action>(
    () => ({
      title: 'New',
      description: 'Create a note or folder.',
      startIcon: 'Add',
      action: () => {
        setOpen(false);
        openNewSheetRef.current();
      },
      testID: 'NotesRootNewAction',
    }),
    [openNewSheetRef]
  );
  const viewActions = useMemo<Action[]>(
    () =>
      NOTES_TREE_VIEW_OPTIONS.map((option) => ({
        title: option.title,
        description: option.description,
        startIcon: option.icon,
        endIcon: option.id === treeViewStyle ? 'Checkmark' : undefined,
        selected: option.id === treeViewStyle,
        action: () => {
          setOpen(false);
          onTreeViewStyleChange(option.id);
        },
        testID: `NotesTreeViewStyle-${option.id}`,
      })),
    [onTreeViewStyleChange, treeViewStyle]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={setOpen}
      mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
      modal
      snapPointsMode="fit"
      trigger={
        <OverflowTriggerButton
          testID="NotesRootActionsTrigger"
          paddingHorizontal="$xs"
          paddingVertical="$xs"
          onPress={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        />
      }
    >
      <ActionSheet.Content>
        {canEdit ? (
          <ActionSheet.ActionGroup accent="neutral">
            <ActionSheet.Action action={newAction} testID={newAction.testID} />
          </ActionSheet.ActionGroup>
        ) : null}
        <ActionSheet.ActionGroup accent="neutral">
          {viewActions.map((action) => (
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

function FolderTreeRow({
  depth,
  expanded,
  hasChildren,
  label,
  noteCount,
  selected,
  viewStyle,
  onOpenMenu,
  onPress,
}: {
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  label: string;
  noteCount: number;
  selected: boolean;
  viewStyle: NotesTreeViewStyle;
  onOpenMenu?: () => void;
  onPress: () => void;
}) {
  if (viewStyle === 'notes') {
    return (
      <TreeRowPressable
        onOpenMenu={onOpenMenu}
        onPress={onPress}
        testID={`NotesFolderRow-${label}`}
      >
        <NotesViewRow
          minHeight={56}
          paddingLeft={8 + depth * 20}
          selected={selected}
        >
          <Icon
            type="Folder"
            size="$m"
            color={selected ? '$primaryText' : '$systemNoticeText'}
          />
          <Text
            flex={1}
            minWidth={0}
            size="$label/l"
            color={selected ? '$primaryText' : '$secondaryText'}
            fontWeight={selected ? '600' : '400'}
            numberOfLines={1}
            letterSpacing={0}
          >
            {label}
          </Text>
          {noteCount > 0 ? (
            <Text size="$label/m" color="$tertiaryText" letterSpacing={0}>
              {noteCount}
            </Text>
          ) : null}
          <TreeChevron expanded={expanded} hasChildren={hasChildren} />
        </NotesViewRow>
      </TreeRowPressable>
    );
  }

  return (
    <TreeRowFrame
      depth={depth}
      showChildGuide={expanded && hasChildren}
      selected={selected}
      onOpenMenu={onOpenMenu}
      onPress={onPress}
      testID={`NotesFolderRow-${label}`}
    >
      <TreeChevron expanded={expanded} hasChildren={hasChildren} />
      <ListItem.SystemIcon
        icon="Folder"
        size="$2xl"
        color={selected ? '$primaryText' : '$tertiaryText'}
        backgroundColor="transparent"
      />
      <ListItem.MainContent height="auto" minHeight={0}>
        <ListItem.Title
          size="$label/m"
          color={selected ? '$primaryText' : '$secondaryText'}
          fontWeight={selected ? '600' : '400'}
          letterSpacing={0}
        >
          {label}
        </ListItem.Title>
      </ListItem.MainContent>
      {noteCount > 0 ? (
        <ListItem.EndContent paddingTop={0}>
          <ListItem.Subtitle
            size="$label/s"
            color="$tertiaryText"
            letterSpacing={0}
          >
            {noteCount}
          </ListItem.Subtitle>
        </ListItem.EndContent>
      ) : null}
    </TreeRowFrame>
  );
}

function NoteRow({
  canEdit,
  depth,
  note,
  viewStyle,
  onMove,
  onPress,
}: {
  canEdit: boolean;
  depth: number;
  note: db.NotesNote;
  viewStyle: NotesTreeViewStyle;
  onMove: () => void;
  onPress: () => void;
}) {
  const updatedAt = formatNoteDate(note.updatedAt);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const openActions = useCallback(() => {
    if (canEdit) {
      setActionsOpen(true);
    }
  }, [canEdit]);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsHovered(true);
    }
  }, []);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsHovered(false);
    }
  }, []);

  const actions = useMemo<Action[]>(
    () => [
      {
        title: 'Open note',
        startIcon: 'ChannelNote',
        action: () => {
          setActionsOpen(false);
          onPress();
        },
        testID: `NotesOpenNoteAction-${note.noteId}`,
      },
      {
        title: 'Move to folder',
        startIcon: 'Folder',
        action: () => {
          setActionsOpen(false);
          onMove();
        },
        disabled: !canEdit,
        testID: `NotesMoveNoteAction-${note.noteId}`,
      },
    ],
    [canEdit, note.noteId, onMove, onPress]
  );

  const shouldShowActionsTrigger =
    canEdit && Platform.OS === 'web' && (actionsOpen || isHovered);
  const actionsTrigger = shouldShowActionsTrigger ? (
    <OverflowTriggerButton
      paddingHorizontal="$xs"
      paddingVertical="$xs"
      marginRight="$-xs"
      onPress={(event) => {
        event.stopPropagation();
        setActionsOpen(true);
      }}
    />
  ) : null;
  const actionsMenu =
    canEdit && (actionsOpen || actionsTrigger) ? (
      <ActionSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
        trigger={actionsTrigger}
        modal
        snapPointsMode="fit"
      >
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
    ) : null;

  if (viewStyle === 'notes') {
    return (
      <TreeRowPressable
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        onOpenMenu={canEdit ? openActions : undefined}
        onPress={onPress}
        testID={`NotesNoteRow-${note.noteId}`}
      >
        <NotesViewRow minHeight={58} paddingLeft={8 + depth * 20}>
          <Icon type="ChannelNote" size="$m" color="$tertiaryText" />
          <YStack flex={1} minWidth={0} gap={2}>
            <Text
              size="$label/l"
              color="$primaryText"
              numberOfLines={1}
              letterSpacing={0}
            >
              {note.title || 'Untitled'}
            </Text>
            {updatedAt ? (
              <Text size="$label/s" color="$tertiaryText" letterSpacing={0}>
                {updatedAt}
              </Text>
            ) : null}
          </YStack>
          {actionsMenu}
          <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
        </NotesViewRow>
      </TreeRowPressable>
    );
  }

  return (
    <TreeRowFrame
      depth={depth}
      onMouseEnter={handleHoverIn}
      onMouseLeave={handleHoverOut}
      onOpenMenu={canEdit ? openActions : undefined}
      onPress={onPress}
      testID={`NotesNoteRow-${note.noteId}`}
    >
      <XStack width={20} />
      <ListItem.SystemIcon
        icon="ChannelNote"
        size="$2xl"
        color="$tertiaryText"
        backgroundColor="transparent"
      />
      <ListItem.MainContent height="auto" minHeight={0}>
        <ListItem.Title size="$label/m" color="$primaryText" letterSpacing={0}>
          {note.title || 'Untitled'}
        </ListItem.Title>
      </ListItem.MainContent>
      {updatedAt || actionsTrigger ? (
        <ListItem.EndContent paddingTop={0}>
          <XStack alignItems="center" gap="$xs">
            {updatedAt ? (
              <ListItem.Subtitle
                size="$label/s"
                color="$tertiaryText"
                letterSpacing={0}
              >
                {updatedAt}
              </ListItem.Subtitle>
            ) : null}
            {actionsMenu}
          </XStack>
        </ListItem.EndContent>
      ) : null}
    </TreeRowFrame>
  );
}

function TreeChevron({
  expanded,
  hasChildren,
}: {
  expanded: boolean;
  hasChildren: boolean;
}) {
  return (
    <XStack width={20} height={20} alignItems="center" justifyContent="center">
      {hasChildren ? (
        <Icon
          type={expanded ? 'ChevronDown' : 'ChevronRight'}
          size="$s"
          color="$tertiaryText"
        />
      ) : null}
    </XStack>
  );
}

function TreeRowFrame({
  children,
  depth,
  onPress,
  onOpenMenu,
  onMouseEnter,
  onMouseLeave,
  selected = false,
  showChildGuide = false,
  testID,
}: {
  children: ReactNode;
  depth: number;
  onPress: () => void;
  onOpenMenu?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  selected?: boolean;
  showChildGuide?: boolean;
  testID?: string;
}) {
  return (
    <TreeRowPressable
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onOpenMenu={onOpenMenu}
      onPress={onPress}
      testID={testID}
    >
      <ListItem
        alignItems="center"
        minHeight={TREE_ROW_HEIGHT}
        position="relative"
        borderRadius="$m"
        backgroundColor={selected ? '$secondaryBackground' : 'transparent'}
        paddingLeft={TREE_ROW_LEFT_PADDING}
        paddingRight="$s"
        paddingVertical="$xs"
        gap="$s"
      >
        <TreeIndentGuides depth={depth} showChildGuide={showChildGuide} />
        <XStack width={depth * TREE_LEVEL_WIDTH} flexShrink={0} />
        {children}
      </ListItem>
    </TreeRowPressable>
  );
}

function TreeRowPressable({
  children,
  onPress,
  onOpenMenu,
  onMouseEnter,
  onMouseLeave,
  testID,
}: {
  children: ReactNode;
  onPress: () => void;
  onOpenMenu?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  testID?: string;
}) {
  const containerRef = useRef<TamaguiWebElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !onOpenMenu || !containerRef.current) {
      return;
    }

    const element = containerRef.current;
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onOpenMenu();
    };

    element.addEventListener('contextmenu', handleContextMenu);
    return () => {
      element.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onOpenMenu]);

  return (
    <Pressable
      ref={containerRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onLongPress={onOpenMenu}
      onPress={onPress}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function TreeIndentGuides({
  depth,
  showChildGuide = false,
}: {
  depth: number;
  showChildGuide?: boolean;
}) {
  if (depth <= 0 && !showChildGuide) return null;

  const guideCount = depth + (showChildGuide ? 1 : 0);

  return (
    <XStack
      position="absolute"
      top={-1}
      bottom={-1}
      left={TREE_GUIDE_LEFT}
      width={guideCount * TREE_LEVEL_WIDTH}
      pointerEvents="none"
    >
      {Array.from({ length: guideCount }).map((_, index) => {
        const isChildGuide = showChildGuide && index === guideCount - 1;
        return (
          <YStack
            key={index}
            position="relative"
            width={TREE_LEVEL_WIDTH}
            alignSelf="stretch"
          >
            <YStack
              position="absolute"
              top={isChildGuide ? TREE_CHILD_GUIDE_TOP : 0}
              bottom={0}
              left={TREE_LEVEL_WIDTH / 2}
              width={1}
              backgroundColor="$border"
            />
          </YStack>
        );
      })}
    </XStack>
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

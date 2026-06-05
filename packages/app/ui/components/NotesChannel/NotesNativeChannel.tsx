import { NavigationProp, useNavigation } from '@react-navigation/native';
import {
  convertContent,
  createNotebookFolder,
  createNotebookNote,
  deleteNotebookNote,
  makePrettyShortDate,
  markNotesNotebookOpened,
  markdownToStory,
  moveNotebookFolder,
  moveNotebookNote,
  renameNotebookFolder,
  saveNotebookNote,
  useEnsureNotesNotebookJoined,
  useNotesFolders,
  useNotesNotebook,
  useNotesNotes,
  useSyncNotesNotebook,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Icon, LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import {
  Input,
  ScrollView,
  TamaguiWebElement,
  TextArea,
  XStack,
  YStack,
} from 'tamagui';

import type { RootStackParamList } from '../../../navigation/types';
import type { Action } from '../ActionSheet';
import { ActionSheet, SimpleActionSheet } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { TextInput } from '../Form';
import { ListItem } from '../ListItem';
import { NotebookContentRenderer } from '../NotebookPost/NotebookPost';
import { OverflowTriggerButton } from '../OverflowMenuButton';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type NotesTreeViewStyle = db.NotesTreeViewPreference;
type FolderRow = { folder: db.NotesFolder; depth: number; path: string };
type NotesTreeRow =
  | {
      type: 'folder';
      folder: db.NotesFolder;
      depth: number;
      expanded: boolean;
      hasChildren: boolean;
      noteCount: number;
      path: string;
    }
  | { type: 'note'; note: db.NotesNote; depth: number };

const EMPTY_FOLDERS: db.NotesFolder[] = [];
const EMPTY_NOTES: db.NotesNote[] = [];
const TREE_ROW_HEIGHT = 44;
const TREE_LEVEL_WIDTH = 20;
const TREE_ROW_LEFT_PADDING = 2;
const TREE_ROW_GAP = 6;
const TREE_GUIDE_LEFT = TREE_ROW_LEFT_PADDING + TREE_ROW_GAP;
const TREE_CARET_CENTER_Y = TREE_ROW_HEIGHT / 2;
const TREE_CHILD_GUIDE_CARET_OFFSET = 8;
const TREE_CHILD_GUIDE_TOP =
  TREE_CARET_CENTER_Y + TREE_CHILD_GUIDE_CARET_OFFSET;
const NOTES_TREE_VIEW_OPTIONS: {
  id: NotesTreeViewStyle;
  title: string;
  description: string;
  icon: IconType;
}[] = [
  {
    id: 'notion',
    title: 'Compact',
    description: 'Dense nested rows for scanning.',
    icon: 'LeftSidebar',
  },
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
  const [movingNote, setMovingNote] = useState<db.NotesNote | null>(null);
  const [isMovingNote, setIsMovingNote] = useState(false);
  const [folderActionsFolder, setFolderActionsFolder] =
    useState<db.NotesFolder | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<db.NotesFolder | null>(
    null
  );
  const [renameFolderName, setRenameFolderName] = useState('');
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [movingFolder, setMovingFolder] = useState<db.NotesFolder | null>(null);
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [notesFilterQuery, setNotesFilterQuery] = useState('');
  const { value: treeViewStyle, setValue: setTreeViewStyle } =
    db.notesTreeViewPreference.useStorageItem();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(
    () => new Set()
  );
  const openNewSheetRef = useRef<() => void>(() => {});
  const initializedFolderIdsRef = useRef<Set<number>>(new Set());

  const joinQuery = useEnsureNotesNotebookJoined({ notebookFlag });
  const joined = joinQuery.data !== false;
  const syncQuery = useSyncNotesNotebook({
    notebookFlag,
    enabled: Boolean(notebookFlag) && joined && !joinQuery.isLoading,
  });
  const notebookQuery = useNotesNotebook(notebookFlag, joined);
  const foldersQuery = useNotesFolders(notebookFlag, joined);
  const notesQuery = useNotesNotes(notebookFlag, joined);

  const notebook = notebookQuery.data ?? null;
  const folders = foldersQuery.data ?? EMPTY_FOLDERS;
  const notes = notesQuery.data ?? EMPTY_NOTES;
  const canEdit = notebook ? notebook.currentUserRole !== 'viewer' : false;

  const rootFolderId = useMemo(() => {
    return (
      notebook?.rootFolderId ??
      folders.find((folder) => folder.parentFolderId === null)?.folderId ??
      folders[0]?.folderId ??
      null
    );
  }, [folders, notebook?.rootFolderId]);

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

  useEffect(() => {
    if (!notebookFlag) return;
    markNotesNotebookOpened(notebookFlag);
  }, [notebookFlag]);

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

  const handleCreateNote = useCallback(async () => {
    if (!notebookFlag || !rootFolderId || !canEdit || isCreatingNote) return;
    const targetFolderId = selectedFolderId ?? rootFolderId;
    setIsCreatingNote(true);
    setError(null);
    try {
      setExpandedFolderIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(targetFolderId);
        return nextIds;
      });
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
      setExpandedFolderIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(parentFolderId);
        return nextIds;
      });
      setNewFolderName('');
      setAddFolderOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  }, [canEdit, newFolderName, newFolderParentId, notebookFlag, rootFolderId]);

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
      setMovingNote(note);
    },
    [canEdit]
  );

  const handleMoveNoteOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isMovingNote) {
        setMovingNote(null);
      }
    },
    [isMovingNote]
  );

  const handleMoveNoteToFolder = useCallback(
    async (folderId: number) => {
      if (!notebookFlag || !movingNote || !canEdit || isMovingNote) return;

      if (folderId === movingNote.folderId) {
        setMovingNote(null);
        return;
      }

      setIsMovingNote(true);
      setError(null);
      try {
        await moveNotebookNote({
          notebookFlag,
          noteId: movingNote.noteId,
          folderId,
        });
        setExpandedFolderIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(folderId);
          return nextIds;
        });
        setSelectedFolderId(folderId);
        setMovingNote(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to move note');
      } finally {
        setIsMovingNote(false);
      }
    },
    [canEdit, isMovingNote, movingNote, notebookFlag]
  );

  const handleOpenFolderActions = useCallback(
    (folder: db.NotesFolder) => {
      if (!canEdit) return;
      setFolderActionsFolder(folder);
    },
    [canEdit]
  );

  const handleOpenRenameFolder = useCallback((folder: db.NotesFolder) => {
    setFolderActionsFolder(null);
    setRenamingFolder(folder);
    setRenameFolderName(getFolderLabel(folder));
  }, []);

  const handleOpenMoveFolder = useCallback((folder: db.NotesFolder) => {
    setFolderActionsFolder(null);
    setMovingFolder(folder);
  }, []);

  const handleRenameFolderOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isRenamingFolder) {
        setRenamingFolder(null);
        setRenameFolderName('');
      }
    },
    [isRenamingFolder]
  );

  const handleRenameFolder = useCallback(async () => {
    if (!notebookFlag || !renamingFolder || !canEdit || isRenamingFolder) {
      return;
    }

    const nextName = renameFolderName.trim();
    if (!nextName) return;

    if (nextName === renamingFolder.name) {
      setRenamingFolder(null);
      setRenameFolderName('');
      return;
    }

    setIsRenamingFolder(true);
    setError(null);
    try {
      await renameNotebookFolder({
        notebookFlag,
        folder: renamingFolder,
        name: nextName,
      });
      setRenamingFolder(null);
      setRenameFolderName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename folder');
    } finally {
      setIsRenamingFolder(false);
    }
  }, [
    canEdit,
    isRenamingFolder,
    notebookFlag,
    renameFolderName,
    renamingFolder,
  ]);

  const handleMoveFolderOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isMovingFolder) {
        setMovingFolder(null);
      }
    },
    [isMovingFolder]
  );

  const handleMoveFolderToParent = useCallback(
    async (parentFolderId: number) => {
      if (!notebookFlag || !movingFolder || !canEdit || isMovingFolder) {
        return;
      }

      if (parentFolderId === movingFolder.parentFolderId) {
        setMovingFolder(null);
        return;
      }

      setIsMovingFolder(true);
      setError(null);
      try {
        await moveNotebookFolder({
          notebookFlag,
          folder: movingFolder,
          parentFolderId,
        });
        setExpandedFolderIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(parentFolderId);
          nextIds.add(movingFolder.folderId);
          return nextIds;
        });
        setSelectedFolderId(movingFolder.folderId);
        setMovingFolder(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to move folder');
      } finally {
        setIsMovingFolder(false);
      }
    },
    [canEdit, isMovingFolder, movingFolder, notebookFlag]
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
      if (!notebookFlag || joinQuery.data === false) return null;
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
      joinQuery.data,
      notebookFlag,
      treeViewStyle,
    ])
  );

  if (!notebookFlag) {
    return <NotesMessage title="Notebook unavailable" />;
  }

  if (joinQuery.isLoading || (syncQuery.isLoading && !notebook)) {
    return (
      <NotesMessage title="Loading notebook">
        <LoadingSpinner />
      </NotesMessage>
    );
  }

  if (joinQuery.data === false) {
    return (
      <NotesMessage
        title="Unable to join notebook"
        subtitle="This notebook is private or no longer available."
      />
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {error ? <NotesErrorMessage error={error} /> : null}

      <YStack
        width="100%"
        maxWidth={treeViewStyle === 'notion' ? 680 : 760}
        marginHorizontal="auto"
        paddingLeft={treeViewStyle === 'notes' ? '$m' : '$s'}
        paddingRight={treeViewStyle === 'notes' ? '$l' : '$m'}
        paddingTop={treeViewStyle === 'notes' ? '$l' : '$m'}
        paddingBottom="$s"
        backgroundColor="$background"
      >
        <NotesTreeSearchInput
          query={notesFilterQuery}
          onQueryChange={setNotesFilterQuery}
        />
      </YStack>

      <ScrollView flex={1}>
        <YStack
          width="100%"
          maxWidth={treeViewStyle === 'notion' ? 680 : 760}
          marginHorizontal="auto"
          paddingLeft={treeViewStyle === 'notes' ? '$m' : '$s'}
          paddingRight={treeViewStyle === 'notes' ? '$l' : '$m'}
          paddingTop="$s"
          paddingBottom={treeViewStyle === 'notes' ? '$l' : '$m'}
        >
          <YStack
            gap={
              treeViewStyle === 'notes' ? 0 : treeViewStyle === 'notion' ? 1 : 2
            }
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
        </YStack>
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

export function NotesNoteDetail({
  noteId,
  notebookFlag,
  onDeleted,
}: {
  noteId: number | null;
  notebookFlag: string | null | undefined;
  onDeleted?: () => void;
}) {
  const [draftNoteId, setDraftNoteId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [isMovingNote, setIsMovingNote] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const joinQuery = useEnsureNotesNotebookJoined({ notebookFlag });
  const joined = joinQuery.data !== false;
  const syncQuery = useSyncNotesNotebook({
    notebookFlag,
    enabled: Boolean(notebookFlag) && joined && !joinQuery.isLoading,
  });
  const notebookQuery = useNotesNotebook(notebookFlag, joined);
  const foldersQuery = useNotesFolders(notebookFlag, joined);
  const notesQuery = useNotesNotes(notebookFlag, joined);

  const notebook = notebookQuery.data ?? null;
  const folders = foldersQuery.data ?? EMPTY_FOLDERS;
  const notes = notesQuery.data ?? EMPTY_NOTES;
  const canEdit = notebook ? notebook.currentUserRole !== 'viewer' : false;
  const selectedNote = useMemo(() => {
    if (noteId === null) return null;
    return notes.find((note) => note.noteId === noteId) ?? null;
  }, [noteId, notes]);

  const draftsMatchSelectedNote = draftNoteId === (selectedNote?.id ?? null);
  const isDirty = Boolean(
    selectedNote &&
      draftsMatchSelectedNote &&
      ((titleDraft.trim() || 'Untitled') !== selectedNote.title ||
        bodyDraft !== selectedNote.bodyMd)
  );
  const rootFolderId = useMemo(() => {
    return (
      notebook?.rootFolderId ??
      folders.find((folder) => folder.parentFolderId === null)?.folderId ??
      folders[0]?.folderId ??
      null
    );
  }, [folders, notebook?.rootFolderId]);
  const folderRows = useMemo(
    () => buildFolderRows(folders, rootFolderId, { includeRoot: true }),
    [folders, rootFolderId]
  );
  const previewState = useMemo(() => {
    try {
      return {
        content: convertContent(markdownToStory(bodyDraft), null),
        error: null,
      };
    } catch (e) {
      return {
        content: [],
        error:
          e instanceof Error ? e.message : 'Unable to render Markdown preview',
      };
    }
  }, [bodyDraft]);

  useEffect(() => {
    if (!notebookFlag) return;
    markNotesNotebookOpened(notebookFlag);
  }, [notebookFlag]);

  useEffect(() => {
    setDraftNoteId(selectedNote?.id ?? null);
    setTitleDraft(selectedNote?.title ?? '');
    setBodyDraft(selectedNote?.bodyMd ?? '');
    setSaveState('idle');
    setError(null);
  }, [selectedNote?.id, selectedNote?.bodyMd, selectedNote?.title]);

  const saveSelectedNote = useCallback(async () => {
    if (!notebookFlag || !selectedNote || !isDirty || !canEdit) return;
    setSaveState('saving');
    setError(null);
    try {
      await saveNotebookNote({
        notebookFlag,
        note: selectedNote,
        title: titleDraft,
        body: bodyDraft,
      });
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError(e instanceof Error ? e.message : 'Failed to save note');
    }
  }, [bodyDraft, canEdit, isDirty, notebookFlag, selectedNote, titleDraft]);

  useEffect(() => {
    if (!isDirty || !canEdit) return;
    setSaveState('dirty');
    const timeout = setTimeout(() => {
      saveSelectedNote();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [canEdit, isDirty, saveSelectedNote]);

  const runDeleteSelectedNote = useCallback(async () => {
    if (!notebookFlag || !selectedNote || !canEdit) return;
    setError(null);
    try {
      await deleteNotebookNote({
        notebookFlag,
        noteId: selectedNote.noteId,
      });
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete note');
    }
  }, [canEdit, notebookFlag, onDeleted, selectedNote]);

  const handleDeleteSelectedNote = useCallback(() => {
    if (!selectedNote) return;
    if (Platform.OS === 'web') {
      const confirm = (globalThis as { confirm?: (message: string) => boolean })
        .confirm;
      if (typeof confirm === 'function' && !confirm('Delete this note?')) {
        return;
      }
      runDeleteSelectedNote();
      return;
    }
    Alert.alert('Delete note', 'This note will be removed from the notebook.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: runDeleteSelectedNote,
      },
    ]);
  }, [runDeleteSelectedNote, selectedNote]);

  const handleMoveSelectedNote = useCallback(
    async (folderId: number) => {
      if (!notebookFlag || !selectedNote || !canEdit || isMovingNote) return;

      if (folderId === selectedNote.folderId) {
        setMoveSheetOpen(false);
        return;
      }

      setIsMovingNote(true);
      setError(null);
      try {
        await moveNotebookNote({
          notebookFlag,
          noteId: selectedNote.noteId,
          folderId,
        });
        setMoveSheetOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to move note');
      } finally {
        setIsMovingNote(false);
      }
    },
    [canEdit, isMovingNote, notebookFlag, selectedNote]
  );

  const handleOpenMoveSheet = useCallback(() => {
    setMoveSheetOpen(true);
  }, []);

  useRegisterChannelHeaderItem(
    useMemo(() => {
      if (!canEdit || !selectedNote) return null;
      return (
        <NotesDetailHeaderActions
          isMoving={isMovingNote}
          onDelete={handleDeleteSelectedNote}
          onMove={handleOpenMoveSheet}
        />
      );
    }, [
      canEdit,
      handleDeleteSelectedNote,
      handleOpenMoveSheet,
      isMovingNote,
      selectedNote,
    ])
  );

  if (!notebookFlag || noteId === null) {
    return <NotesMessage title="Note unavailable" />;
  }

  if (joinQuery.isLoading || (syncQuery.isLoading && !notebook)) {
    return (
      <NotesMessage title="Loading note">
        <LoadingSpinner />
      </NotesMessage>
    );
  }

  if (joinQuery.data === false) {
    return (
      <NotesMessage
        title="Unable to join notebook"
        subtitle="This notebook is private or no longer available."
      />
    );
  }

  if (!selectedNote) {
    return <NotesMessage title="Note not found" />;
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {error ? <NotesErrorMessage error={error} /> : null}
      <YStack flex={1} width="100%" maxWidth={760} marginHorizontal="auto">
        <YStack
          paddingHorizontal="$xl"
          paddingTop="$l"
          paddingBottom="$m"
          gap="$m"
          borderBottomColor="$border"
          borderBottomWidth={1}
        >
          <XStack alignItems="center">
            <Input
              flex={1}
              width="100%"
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder="Untitled"
              placeholderTextColor="$tertiaryText"
              fontSize={20}
              height={34}
              minHeight={34}
              fontWeight="600"
              borderColor="transparent"
              borderWidth={0}
              backgroundColor="transparent"
              paddingHorizontal={0}
              paddingVertical={0}
              disabled={!canEdit}
            />
          </XStack>
          <XStack gap="$s" alignItems="center" flexWrap="wrap">
            <MetadataPill
              label={formatNoteDate(selectedNote.updatedAt) ?? 'Unsynced'}
            />
            <MetadataPill label={`Rev ${selectedNote.revision}`} />
            <MetadataPill label="Markdown" icon="Markdown" />
            <SaveStatus saveState={saveState} isDirty={isDirty} />
          </XStack>
        </YStack>
        <YStack flex={1} minHeight={360} position="relative">
          {isPreviewing ? (
            <ScrollView flex={1} testID="NotesPreviewPane">
              <YStack
                paddingHorizontal="$xl"
                paddingTop="$l"
                paddingBottom={128}
                gap="$l"
              >
                {previewState.error ? (
                  <NotesMessage
                    title="Preview unavailable"
                    subtitle={previewState.error}
                  />
                ) : previewState.content.length > 0 ? (
                  <NotebookContentRenderer
                    content={previewState.content}
                    testID="NotesPreviewContent"
                  />
                ) : (
                  <Text size="$body" color="$tertiaryText">
                    Nothing to preview yet.
                  </Text>
                )}
              </YStack>
            </ScrollView>
          ) : (
            <TextArea
              flex={1}
              minHeight={360}
              value={bodyDraft}
              onChangeText={setBodyDraft}
              placeholder="Note body"
              placeholderTextColor="$tertiaryText"
              fontFamily="$mono"
              fontSize={14}
              color="$primaryText"
              backgroundColor="$background"
              borderWidth={0}
              paddingHorizontal="$xl"
              paddingTop="$l"
              paddingBottom={128}
              disabled={!canEdit}
              style={{ lineHeight: 22 }}
              testID="NotesBodyInput"
            />
          )}
          <Button
            position="absolute"
            right="$xl"
            bottom={64}
            zIndex={100}
            size="small"
            fill="outline"
            type="secondary"
            backgroundColor="$background"
            borderColor="$border"
            leadingIcon={isPreviewing ? 'EditList' : 'EyeOpen'}
            label={isPreviewing ? 'Edit' : 'Preview'}
            shadow
            onPress={() => setIsPreviewing((previewing) => !previewing)}
            testID="NotesPreviewToggle"
          />
        </YStack>
      </YStack>
      <MoveNoteSheet
        folderRows={folderRows}
        isMoving={isMovingNote}
        note={selectedNote}
        onMove={handleMoveSelectedNote}
        onOpenChange={setMoveSheetOpen}
        open={moveSheetOpen}
      />
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

function NotesDetailHeaderActions({
  isMoving,
  onDelete,
  onMove,
}: {
  isMoving: boolean;
  onDelete: () => void;
  onMove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const actions = useMemo<Action[]>(
    () => [
      {
        title: 'Move to folder',
        startIcon: 'Folder',
        action: () => {
          setOpen(false);
          onMove();
        },
        disabled: isMoving,
        testID: 'NotesDetailMoveAction',
      },
      {
        title: 'Delete note',
        startIcon: 'Close',
        accent: 'negative',
        action: () => {
          setOpen(false);
          onDelete();
        },
        testID: 'NotesDetailDeleteAction',
      },
    ],
    [isMoving, onDelete, onMove]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={setOpen}
      mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
      trigger={
        <OverflowTriggerButton
          testID="NotesDetailActionsTrigger"
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
        <ActionSheet.ActionGroup accent="neutral">
          <ActionSheet.Action action={actions[0]} testID={actions[0].testID} />
        </ActionSheet.ActionGroup>
        <ActionSheet.ActionGroup accent="negative">
          <ActionSheet.Action action={actions[1]} testID={actions[1].testID} />
        </ActionSheet.ActionGroup>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

function NotesErrorMessage({ error }: { error: string }) {
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
        <XStack
          minHeight={56}
          alignItems="center"
          gap="$m"
          paddingVertical="$s"
          paddingLeft={8 + depth * 20}
          paddingRight="$m"
          backgroundColor={selected ? '$secondaryBackground' : '$background'}
          borderBottomColor="$border"
          borderBottomWidth={1}
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
          <XStack
            width={20}
            height={20}
            alignItems="center"
            justifyContent="center"
          >
            {hasChildren ? (
              <Icon
                type={expanded ? 'ChevronDown' : 'ChevronRight'}
                size="$s"
                color="$tertiaryText"
              />
            ) : null}
          </XStack>
        </XStack>
      </TreeRowPressable>
    );
  }

  if (viewStyle === 'notion') {
    return (
      <TreeRowPressable
        onOpenMenu={onOpenMenu}
        onPress={onPress}
        testID={`NotesFolderRow-${label}`}
      >
        <XStack
          minHeight={36}
          alignItems="center"
          gap="$s"
          paddingVertical="$xs"
          paddingLeft={2 + depth * 22}
          paddingRight="$s"
          borderRadius="$m"
          backgroundColor={selected ? '$secondaryBackground' : 'transparent'}
        >
          <XStack
            width={18}
            height={18}
            alignItems="center"
            justifyContent="center"
          >
            {hasChildren ? (
              <Icon
                type={expanded ? 'ChevronDown' : 'ChevronRight'}
                size="$s"
                color="$tertiaryText"
              />
            ) : null}
          </XStack>
          <Icon
            type="Folder"
            size="$s"
            color={selected ? '$primaryText' : '$tertiaryText'}
          />
          <Text
            flex={1}
            minWidth={0}
            size="$label/m"
            color={selected ? '$primaryText' : '$secondaryText'}
            fontWeight={selected ? '600' : '400'}
            numberOfLines={1}
            letterSpacing={0}
          >
            {label}
          </Text>
          {noteCount > 0 ? (
            <XStack
              minWidth={22}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal="$s"
              paddingVertical={2}
              borderRadius="$l"
              backgroundColor="$secondaryBackground"
            >
              <Text size="$label/s" color="$tertiaryText" letterSpacing={0}>
                {noteCount}
              </Text>
            </XStack>
          ) : null}
        </XStack>
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
      <XStack
        width={20}
        height={20}
        alignItems="center"
        justifyContent="center"
      >
        {hasChildren ? (
          <Icon
            type={expanded ? 'ChevronDown' : 'ChevronRight'}
            size="$s"
            color="$tertiaryText"
          />
        ) : null}
      </XStack>
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

function AddFolderDialog({
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
  const isWeb = Platform.OS === 'web';

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={isWeb ? 'dialog' : 'sheet'}
      closeButton={isWeb}
      modal
      snapPointsMode="fit"
      keyboardBehavior="interactive"
      dialogContentProps={{ width: 420, maxWidth: '90%' }}
    >
      <ActionSheet.ScrollableContent>
        <YStack testID="NotesAddFolderDialog" gap="$l" padding="$l">
          <ActionSheet.SimpleHeader
            title="Add folder"
            subtitle="Choose where this folder should live."
          />

          <YStack gap="$m">
            <YStack gap="$s">
              <Text size="$label/s" color="$secondaryText">
                Name
              </Text>
              <TextInput
                autoFocus={isWeb}
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

          <XStack gap="$m" justifyContent="flex-end">
            <Button
              preset="minimal"
              label="Cancel"
              onPress={() => onOpenChange(false)}
            />
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
          </XStack>
        </YStack>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

function MoveNoteSheet({
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

function FolderActionsSheet({
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

function RenameFolderDialog({
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
  const isWeb = Platform.OS === 'web';
  const label = getFolderLabel(folder);

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={isWeb ? 'dialog' : 'sheet'}
      closeButton={isWeb}
      modal
      snapPointsMode="fit"
      keyboardBehavior="interactive"
      dialogContentProps={{ width: 420, maxWidth: '90%' }}
    >
      <ActionSheet.ScrollableContent>
        <YStack testID="NotesRenameFolderDialog" gap="$l" padding="$l">
          <ActionSheet.SimpleHeader
            title="Rename folder"
            subtitle={`Update ${label}.`}
          />

          <YStack gap="$s">
            <Text size="$label/s" color="$secondaryText">
              Name
            </Text>
            <TextInput
              autoFocus={isWeb}
              value={name}
              onChangeText={onNameChange}
              placeholder="Folder name"
              onSubmitEditing={onRename}
              returnKeyType="done"
            />
          </YStack>

          <XStack gap="$m" justifyContent="flex-end">
            <Button
              preset="minimal"
              label="Cancel"
              disabled={isRenaming}
              onPress={() => onOpenChange(false)}
            />
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
          </XStack>
        </YStack>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

function MoveFolderSheet({
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
  const isWeb = Platform.OS === 'web';
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
        <YStack testID="NotesMoveFolderSheet" gap="$l" padding="$l">
          <ActionSheet.SimpleHeader
            title="Move folder"
            subtitle={`Choose a new parent for ${label}.`}
          />
          <FolderPicker
            disabledFolderIds={disabledFolderIds}
            disabledFolderLabels={disabledFolderLabels}
            folderRows={folderRows}
            isLoading={isMoving}
            onSelectFolder={onMove}
            selectedFolderId={folder?.parentFolderId ?? null}
            testID="NotesMoveFolderParentPicker"
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

function FolderPicker({
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
        <XStack
          minHeight={58}
          alignItems="center"
          gap="$m"
          paddingVertical="$s"
          paddingLeft={8 + depth * 20}
          paddingRight="$m"
          backgroundColor="$background"
          borderBottomColor="$border"
          borderBottomWidth={1}
        >
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
        </XStack>
      </TreeRowPressable>
    );
  }

  if (viewStyle === 'notion') {
    return (
      <TreeRowPressable
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        onOpenMenu={canEdit ? openActions : undefined}
        onPress={onPress}
        testID={`NotesNoteRow-${note.noteId}`}
      >
        <XStack
          minHeight={36}
          alignItems="center"
          gap="$s"
          paddingVertical="$xs"
          paddingLeft={20 + depth * 22}
          paddingRight="$s"
          borderRadius="$m"
          backgroundColor="transparent"
        >
          <Icon type="ChannelNote" size="$s" color="$tertiaryText" />
          <Text
            flex={1}
            minWidth={0}
            size="$label/m"
            color="$secondaryText"
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
          {actionsMenu}
        </XStack>
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

function SaveStatus({
  saveState,
  isDirty,
}: {
  saveState: SaveState;
  isDirty: boolean;
}) {
  const label = useMemo(() => {
    if (saveState === 'saving') return 'Saving';
    if (saveState === 'error') return 'Save failed';
    if (isDirty || saveState === 'dirty') return 'Unsaved';
    if (saveState === 'saved') return 'Saved';
    return '';
  }, [isDirty, saveState]);

  if (!label) return null;
  return (
    <MetadataPill
      label={label}
      tone={saveState === 'error' ? 'negative' : isDirty ? 'notice' : 'neutral'}
    />
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

function MetadataPill({
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

function NotesMessage({
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

function filterNotesTreeData({
  folders,
  notes,
  query,
  rootFolderId,
}: {
  folders: db.NotesFolder[];
  notes: db.NotesNote[];
  query: string;
  rootFolderId: number | null;
}) {
  if (!query) {
    return { folders, notes };
  }

  const byId = new Map<number, db.NotesFolder>();
  const byParent = new Map<number | null, db.NotesFolder[]>();
  folders.forEach((folder) => {
    byId.set(folder.folderId, folder);
    const parentFolderId = folder.parentFolderId ?? null;
    const siblings = byParent.get(parentFolderId) ?? [];
    siblings.push(folder);
    byParent.set(parentFolderId, siblings);
  });

  const visibleFolderIds = new Set<number>();
  const folderMatchSubtreeIds = new Set<number>();

  const includeFolderAndAncestors = (folderId: number | null | undefined) => {
    let currentFolderId = folderId;
    const visited = new Set<number>();
    while (currentFolderId != null && !visited.has(currentFolderId)) {
      visited.add(currentFolderId);
      visibleFolderIds.add(currentFolderId);
      currentFolderId = byId.get(currentFolderId)?.parentFolderId;
    }
  };

  const includeFolderDescendants = (folderId: number) => {
    if (folderMatchSubtreeIds.has(folderId)) {
      return;
    }

    folderMatchSubtreeIds.add(folderId);
    visibleFolderIds.add(folderId);
    const children = byParent.get(folderId) ?? [];
    children.forEach((child) => includeFolderDescendants(child.folderId));
  };

  folders.forEach((folder) => {
    if (normalizeSearchText(getFolderLabel(folder)).includes(query)) {
      includeFolderAndAncestors(folder.folderId);
      includeFolderDescendants(folder.folderId);
    }
  });

  const visibleNotes = notes.filter((note) => {
    const noteMatches =
      normalizeSearchText(note.title).includes(query) ||
      normalizeSearchText(note.bodyMd).includes(query);
    if (noteMatches || folderMatchSubtreeIds.has(note.folderId)) {
      includeFolderAndAncestors(note.folderId);
      return true;
    }

    return false;
  });

  if (rootFolderId !== null) {
    visibleFolderIds.add(rootFolderId);
  }

  return {
    folders: folders.filter((folder) => visibleFolderIds.has(folder.folderId)),
    notes: visibleNotes,
  };
}

function buildFolderRows(
  folders: db.NotesFolder[],
  rootFolderId: number | null,
  { includeRoot }: { includeRoot: boolean }
): FolderRow[] {
  const byId = new Map<number, db.NotesFolder>();
  const byParent = new Map<number | null, db.NotesFolder[]>();
  folders.forEach((folder) => {
    byId.set(folder.folderId, folder);
    const parentFolderId = folder.parentFolderId ?? null;
    const siblings = byParent.get(parentFolderId) ?? [];
    siblings.push(folder);
    byParent.set(parentFolderId, siblings);
  });
  byParent.forEach((siblings) => {
    siblings.sort((a, b) => a.name.localeCompare(b.name));
  });

  const rows: FolderRow[] = [];
  const visited = new Set<number>();
  const root =
    folders.find((folder) => folder.folderId === rootFolderId) ??
    folders.find((folder) => folder.parentFolderId === null);

  const visit = (folder: db.NotesFolder, depth: number, parentPath = '') => {
    if (visited.has(folder.folderId)) return;

    visited.add(folder.folderId);
    const label = getFolderLabel(folder);
    const path = parentPath ? `${parentPath} / ${label}` : label;
    const isRoot = root ? folder.folderId === root.folderId : false;
    if (includeRoot || !isRoot) {
      rows.push({
        folder,
        depth: includeRoot ? depth : Math.max(0, depth - 1),
        path,
      });
    }

    const children = byParent.get(folder.folderId) ?? [];
    children.forEach((child) => visit(child, depth + 1, path));
  };

  if (root) {
    visit(root, 0);
  }

  folders
    .filter((folder) => {
      if (visited.has(folder.folderId)) return false;
      return folder.parentFolderId == null || !byId.has(folder.parentFolderId);
    })
    .forEach((folder) => visit(folder, 0));

  folders
    .filter((folder) => !visited.has(folder.folderId))
    .forEach((folder) => visit(folder, 0));

  return rows;
}

function buildNotesTreeRows({
  expandedFolderIds,
  folderNoteCounts,
  folders,
  notes,
  rootFolderId,
}: {
  expandedFolderIds: Set<number>;
  folderNoteCounts: Map<number, number>;
  folders: db.NotesFolder[];
  notes: db.NotesNote[];
  rootFolderId: number | null;
}): NotesTreeRow[] {
  const byId = new Map<number, db.NotesFolder>();
  const byParent = new Map<number | null, db.NotesFolder[]>();
  const notesByFolder = new Map<number, db.NotesNote[]>();
  const renderedNoteIds = new Set<string>();

  folders.forEach((folder) => {
    byId.set(folder.folderId, folder);
    const parentFolderId = folder.parentFolderId ?? null;
    const siblings = byParent.get(parentFolderId) ?? [];
    siblings.push(folder);
    byParent.set(parentFolderId, siblings);
  });
  byParent.forEach((siblings) => {
    siblings.sort((a, b) => a.name.localeCompare(b.name));
  });

  notes.forEach((note) => {
    const folderNotes = notesByFolder.get(note.folderId) ?? [];
    folderNotes.push(note);
    notesByFolder.set(note.folderId, folderNotes);
  });
  notesByFolder.forEach((folderNotes) => {
    folderNotes.sort((a, b) => {
      const titleDiff = a.title.localeCompare(b.title);
      return titleDiff || (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
  });

  const rows: NotesTreeRow[] = [];
  const visitedFolderIds = new Set<number>();
  const root =
    folders.find((folder) => folder.folderId === rootFolderId) ??
    folders.find((folder) => folder.parentFolderId === null);

  const appendNotes = (folderId: number, depth: number) => {
    const folderNotes = notesByFolder.get(folderId) ?? [];
    folderNotes.forEach((note) => {
      rows.push({ type: 'note', note, depth });
      renderedNoteIds.add(note.id);
    });
  };

  const visit = (folder: db.NotesFolder, depth: number, parentPath = '') => {
    if (visitedFolderIds.has(folder.folderId)) return;

    visitedFolderIds.add(folder.folderId);
    const label = getFolderLabel(folder);
    const path = parentPath ? `${parentPath} / ${label}` : label;
    const isRoot = root ? folder.folderId === root.folderId : false;
    const childFolders = byParent.get(folder.folderId) ?? [];
    const folderNotes = notesByFolder.get(folder.folderId) ?? [];
    const hasChildren = childFolders.length > 0 || folderNotes.length > 0;
    const expanded = isRoot || expandedFolderIds.has(folder.folderId);

    if (!isRoot) {
      rows.push({
        type: 'folder',
        folder,
        depth,
        expanded,
        hasChildren,
        noteCount: folderNoteCounts.get(folder.folderId) ?? 0,
        path,
      });
    }

    if (!expanded) return;

    const childDepth = isRoot ? depth : depth + 1;
    childFolders.forEach((child) => visit(child, childDepth, path));
    appendNotes(folder.folderId, childDepth);
  };

  if (root) {
    visit(root, 0);
  }

  folders
    .filter((folder) => {
      if (visitedFolderIds.has(folder.folderId)) return false;
      return folder.parentFolderId == null || !byId.has(folder.parentFolderId);
    })
    .forEach((folder) => visit(folder, 0));

  folders
    .filter((folder) => !visitedFolderIds.has(folder.folderId))
    .forEach((folder) => visit(folder, 0));

  notes
    .filter((note) => !renderedNoteIds.has(note.id))
    .sort((a, b) => {
      const titleDiff = a.title.localeCompare(b.title);
      return titleDiff || (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    })
    .forEach((note) => rows.push({ type: 'note', note, depth: 0 }));

  return rows;
}

function buildFolderNoteCounts(
  folders: db.NotesFolder[],
  notes: db.NotesNote[]
) {
  const counts = new Map<number, number>();
  folders.forEach((folder) => {
    const folderIds = collectDescendantFolderIds(folders, folder.folderId);
    counts.set(
      folder.folderId,
      notes.filter((note) => folderIds.has(note.folderId)).length
    );
  });
  return counts;
}

function getFolderLabel(folder: db.NotesFolder | null | undefined) {
  if (!folder) return 'Folder';
  return folder.name === '/' ? 'Root' : folder.name;
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function formatNoteDate(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  const unixMs = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return makePrettyShortDate(new Date(unixMs));
}

function collectDescendantFolderIds(
  folders: db.NotesFolder[],
  folderId: number
) {
  const ids = new Set([folderId]);
  let added = true;
  while (added) {
    added = false;
    folders.forEach((folder) => {
      const folderId = folder.folderId;
      const parentFolderId = folder.parentFolderId;
      if (
        folderId !== undefined &&
        parentFolderId !== null &&
        parentFolderId !== undefined &&
        ids.has(parentFolderId) &&
        !ids.has(folderId)
      ) {
        ids.add(folderId);
        added = true;
      }
    });
  }
  return ids;
}

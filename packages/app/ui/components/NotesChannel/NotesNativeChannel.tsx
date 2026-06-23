import { NavigationProp, useNavigation } from '@react-navigation/native';
import {
  createNotebookFolder,
  createNotebookNote,
  deleteNotebookFolder,
  deleteNotebookNote,
  moveNotebookFolder,
  moveNotebookNote,
  renameNotebookFolder,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, DragEvent } from 'react';
import { Alert, Platform } from 'react-native';
import { YStack } from 'tamagui';

import type { RootStackParamList } from '../../../navigation/types';
import { useNotebookSidebarRegistration } from '../../contexts/notebookSidebar';
import type { Action } from '../ActionSheet';
import { SimpleActionSheet } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
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
  MoveFolderSheet,
  RenameFolderDialog,
} from './NotesDialogs';
import { NotesHeaderActions } from './NotesHeaderActions';
import { NotesNoteDetail } from './NotesNoteDetail';
import { NotesEmptyDetailPane, NotesTreePane } from './NotesTreePane';
import {
  buildNotesImportItems,
  canSelectNotesImportSources,
  makeUniqueNoteTitle,
  normalizeTitleKey,
  readNotesImportSourcesFromDataTransfer,
  selectNotesImportSources,
} from './notesImport';
import type { NotesImportMode, NotesImportSource } from './notesImport';
import {
  buildFolderNoteCounts,
  buildFolderRows,
  buildNotesTreeRows,
  collectDescendantFolderIds,
  filterNotesTreeData,
  getFolderLabel,
  getNextNoteIdAfterDelete,
  getNextNoteIdAfterFolderDelete,
  normalizeSearchText,
} from './notesTree';
import type { NotesTreeViewStyle } from './notesTree';

export function NotesNativeChannel({
  channelId,
  channelTitle,
  groupId,
  notebookFlag,
}: {
  channelId: string;
  channelTitle?: string;
  groupId?: string | null;
  notebookFlag: string | null | undefined;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isWindowNarrow = useIsWindowNarrow();
  const useDesktopSplit = Platform.OS === 'web' && !isWindowNarrow;
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(
    null
  );
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newActionSheetOpen, setNewActionSheetOpen] = useState(false);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [notesFilterQuery, setNotesFilterQuery] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isDragImportActive, setIsDragImportActive] = useState(false);
  const [isImportingNotes, setIsImportingNotes] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
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
  const dragImportDepthRef = useRef(0);
  const initializedFolderIdsRef = useRef<Set<number>>(new Set());

  const { folders, notes, canEdit, rootFolderId, joinFailed, gate } =
    useNotebookData(notebookFlag);

  const canImportFiles = canEdit && canSelectNotesImportSources('files');
  const canImportFolder = canEdit && canSelectNotesImportSources('folder');

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
    if (!useDesktopSplit || selectedNoteId !== null) return;
    const firstNote = treeRows.find((row) => row.type === 'note')?.note;
    if (!firstNote) return;
    setSelectedNoteId(firstNote.noteId);
    setSelectedFolderId(firstNote.folderId);
  }, [selectedNoteId, treeRows, useDesktopSplit]);

  useEffect(() => {
    if (
      selectedNoteId !== null &&
      !notes.some((note) => note.noteId === selectedNoteId)
    ) {
      setSelectedNoteId(null);
    }
  }, [notes, selectedNoteId]);

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
      if (useDesktopSplit) {
        setSelectedNoteId(note.noteId);
        setSelectedFolderId(note.folderId);
        return;
      }

      navigation.navigate('NotesDetail', {
        channelId,
        groupId: groupId ?? undefined,
        noteId: note.noteId,
      });
    },
    [channelId, groupId, navigation, useDesktopSplit]
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
        title: '',
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

  const handleOpenCreateFolder = useCallback(() => {
    handleAddFolderOpenChange(true);
  }, [handleAddFolderOpenChange]);

  const handleTreeViewStyleChange = useCallback(
    (style: NotesTreeViewStyle) => {
      void setTreeViewStyle(style);
    },
    [setTreeViewStyle]
  );

  const importNotesFromSources = useCallback(
    async (
      sources: NotesImportSource[] | null,
      targetRootFolderId: number,
      importNotebookFlag: string
    ) => {
      if (!sources) {
        return;
      }

      const importItems = buildNotesImportItems(sources);
      if (importItems.length === 0) {
        setImportNotice('No markdown or text files found.');
        return;
      }

      const foldersByParentAndName = new Map<string, db.NotesFolder>();
      folders.forEach((folder) => {
        foldersByParentAndName.set(folderCacheKey(folder), folder);
      });

      const noteTitlesByFolder = new Map<number, Set<string>>();
      notes.forEach((note) => {
        const titles = noteTitlesByFolder.get(note.folderId) ?? new Set();
        titles.add(normalizeTitleKey(note.title));
        noteTitlesByFolder.set(note.folderId, titles);
      });

      const expandedFolderIds = new Set<number>([targetRootFolderId]);
      const ensureFolderPath = async (segments: string[]) => {
        let parentFolderId = targetRootFolderId;
        for (const segment of segments) {
          const key = folderCacheKey({
            name: segment,
            parentFolderId,
          });
          const existing = foldersByParentAndName.get(key);
          if (existing) {
            parentFolderId = existing.folderId;
            expandedFolderIds.add(parentFolderId);
            continue;
          }

          const folder = await createNotebookFolder({
            notebookFlag: importNotebookFlag,
            parentFolderId,
            name: segment,
          });
          if (!folder) {
            throw new Error(`Failed to create folder ${segment}`);
          }

          foldersByParentAndName.set(folderCacheKey(folder), folder);
          parentFolderId = folder.folderId;
          expandedFolderIds.add(parentFolderId);
        }
        return parentFolderId;
      };

      let importedCount = 0;
      let failedCount = 0;
      for (const item of importItems) {
        try {
          const folderId = await ensureFolderPath(item.folderSegments);
          const existingTitles = noteTitlesByFolder.get(folderId) ?? new Set();
          noteTitlesByFolder.set(folderId, existingTitles);
          const title = makeUniqueNoteTitle(item.title, existingTitles);
          await createNotebookNote({
            notebookFlag: importNotebookFlag,
            folderId,
            title,
            body: item.body,
          });
          expandedFolderIds.add(folderId);
          importedCount += 1;
        } catch (e) {
          console.error('Failed to import note', item.source.relativePath, e);
          failedCount += 1;
        }
      }

      expandedFolderIds.forEach(expandFolder);
      if (importedCount === 0 && failedCount > 0) {
        throw new Error(
          `Failed to import ${formatCount(failedCount, 'note')}.`
        );
      }

      setImportNotice(formatImportNotice(importedCount, failedCount));
    },
    [expandFolder, folders, notes]
  );

  const runImport = useCallback(
    async (readSources: () => Promise<NotesImportSource[] | null>) => {
      const targetRootFolderId = selectedFolderId ?? rootFolderId;

      if (
        !notebookFlag ||
        targetRootFolderId == null ||
        !canEdit ||
        isImportingNotes
      ) {
        return;
      }

      setError(null);
      setImportNotice(null);
      setIsImportingNotes(true);
      try {
        await importNotesFromSources(
          await readSources(),
          targetRootFolderId,
          notebookFlag
        );
      } catch (e) {
        setError(errorMessage(e, 'Failed to import notes'));
      } finally {
        setIsImportingNotes(false);
      }
    },
    [
      canEdit,
      importNotesFromSources,
      isImportingNotes,
      notebookFlag,
      rootFolderId,
      selectedFolderId,
    ]
  );

  const handleImportNotes = useCallback(
    async (mode: NotesImportMode) => {
      await runImport(() => selectNotesImportSources(mode));
    },
    [runImport]
  );

  const handleImportDroppedData = useCallback(
    async (dataTransfer: DataTransfer) => {
      await runImport(() =>
        readNotesImportSourcesFromDataTransfer(dataTransfer)
      );
    },
    [runImport]
  );

  const handleImportFiles = useCallback(() => {
    void handleImportNotes('files');
  }, [handleImportNotes]);

  const handleImportFolder = useCallback(() => {
    void handleImportNotes('folder');
  }, [handleImportNotes]);

  const canDropImportNotes =
    canEdit && canSelectNotesImportSources('folder') && !joinFailed;

  const hasFileDrag = useCallback((event: DragEvent) => {
    return Array.from(event.dataTransfer.types ?? []).includes('Files');
  }, []);

  const handleImportDragEnter = useCallback(
    (event: DragEvent) => {
      if (!canDropImportNotes || !hasFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragImportDepthRef.current += 1;
      setIsDragImportActive(true);
    },
    [canDropImportNotes, hasFileDrag]
  );

  const handleImportDragOver = useCallback(
    (event: DragEvent) => {
      if (!canDropImportNotes || !hasFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = isImportingNotes ? 'none' : 'copy';
    },
    [canDropImportNotes, hasFileDrag, isImportingNotes]
  );

  const handleImportDragLeave = useCallback(
    (event: DragEvent) => {
      if (!canDropImportNotes || !hasFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragImportDepthRef.current = Math.max(0, dragImportDepthRef.current - 1);
      if (dragImportDepthRef.current === 0) {
        setIsDragImportActive(false);
      }
    },
    [canDropImportNotes, hasFileDrag]
  );

  const handleImportDrop = useCallback(
    (event: DragEvent) => {
      if (!canDropImportNotes || !hasFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragImportDepthRef.current = 0;
      setIsDragImportActive(false);
      void handleImportDroppedData(event.dataTransfer);
    },
    [canDropImportNotes, handleImportDroppedData, hasFileDrag]
  );

  const dropImportProps = canDropImportNotes
    ? ({
        onDragEnter: handleImportDragEnter,
        onDragLeave: handleImportDragLeave,
        onDragOver: handleImportDragOver,
        onDrop: handleImportDrop,
      } as unknown as ComponentProps<typeof YStack>)
    : {};

  useEffect(() => {
    if (!canDropImportNotes) {
      dragImportDepthRef.current = 0;
      setIsDragImportActive(false);
    }
  }, [canDropImportNotes]);

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

  const handleNoteDeleted = useCallback(
    (deletedNoteId: number) => {
      if (selectedNoteId !== deletedNoteId) return;

      const nextNoteId = getNextNoteIdAfterDelete(treeRows, deletedNoteId);
      setSelectedNoteId(nextNoteId);
      if (nextNoteId !== null) {
        const nextNote = notes.find((note) => note.noteId === nextNoteId);
        if (nextNote) {
          setSelectedFolderId(nextNote.folderId);
        }
      }
    },
    [notes, selectedNoteId, treeRows]
  );

  const runDeleteNote = useCallback(
    async (note: db.NotesNote) => {
      if (!notebookFlag || !canEdit) return;

      await runAction('Failed to delete note', async () => {
        await deleteNotebookNote({
          notebookFlag,
          noteId: note.noteId,
        });
        handleNoteDeleted(note.noteId);
      });
    },
    [canEdit, handleNoteDeleted, notebookFlag, runAction]
  );

  const handleDeleteNote = useCallback(
    (note: db.NotesNote) => {
      if (!canEdit) return;

      const title = note.title || 'Untitled';
      if (Platform.OS === 'web') {
        const confirm = (
          globalThis as { confirm?: (message: string) => boolean }
        ).confirm;
        if (
          typeof confirm === 'function' &&
          !confirm(
            `Delete "${title}"?\n\nThis note will be removed from the notebook.`
          )
        ) {
          return;
        }
        void runDeleteNote(note);
        return;
      }

      Alert.alert(
        'Delete note',
        `Delete "${title}"? This note will be removed from the notebook.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void runDeleteNote(note);
            },
          },
        ]
      );
    },
    [canEdit, runDeleteNote]
  );

  const handleOpenRenameFolder = useCallback(
    (folder: db.NotesFolder) => {
      openRenameFolderDialog(folder);
      setRenameFolderName(getFolderLabel(folder));
    },
    [openRenameFolderDialog]
  );

  const handleOpenMoveFolder = useCallback(
    (folder: db.NotesFolder) => {
      openMoveFolderDialog(folder);
    },
    [openMoveFolderDialog]
  );

  const getFolderDeleteSummary = useCallback(
    (folder: db.NotesFolder) => {
      const folderIds = collectDescendantFolderIds(folders, folder.folderId);
      return {
        folderIds,
        nestedFolderCount: Math.max(0, folderIds.size - 1),
        noteCount: notes.filter((note) => folderIds.has(note.folderId)).length,
      };
    },
    [folders, notes]
  );

  const updateSelectionAfterFolderDelete = useCallback(
    (deletedFolderIds: Set<number>) => {
      if (selectedFolderId !== null && deletedFolderIds.has(selectedFolderId)) {
        setSelectedFolderId(null);
      }

      if (selectedNoteId === null) {
        return;
      }

      const selectedNote = notes.find((note) => note.noteId === selectedNoteId);
      if (!selectedNote || !deletedFolderIds.has(selectedNote.folderId)) {
        return;
      }

      const nextNoteId = getNextNoteIdAfterFolderDelete({
        rows: treeRows,
        deletedFolderIds,
        selectedNoteId,
      });
      setSelectedNoteId(nextNoteId);
      if (nextNoteId !== null) {
        const nextNote = notes.find((note) => note.noteId === nextNoteId);
        if (nextNote) {
          setSelectedFolderId(nextNote.folderId);
        }
      }
    },
    [notes, selectedFolderId, selectedNoteId, treeRows]
  );

  const runDeleteFolder = useCallback(
    async (folder: db.NotesFolder, deletedFolderIds: Set<number>) => {
      if (
        !notebookFlag ||
        !canEdit ||
        isDeletingFolder ||
        folder.folderId === rootFolderId
      ) {
        return;
      }

      setIsDeletingFolder(true);
      await runAction('Failed to delete folder', async () => {
        await deleteNotebookFolder({
          notebookFlag,
          folder,
        });
        updateSelectionAfterFolderDelete(deletedFolderIds);
        setExpandedFolderIds((currentIds) => {
          if (![...deletedFolderIds].some((id) => currentIds.has(id))) {
            return currentIds;
          }

          const nextIds = new Set(currentIds);
          deletedFolderIds.forEach((folderId) => nextIds.delete(folderId));
          return nextIds;
        });
      });
      setIsDeletingFolder(false);
    },
    [
      canEdit,
      isDeletingFolder,
      notebookFlag,
      rootFolderId,
      runAction,
      updateSelectionAfterFolderDelete,
    ]
  );

  const handleDeleteFolder = useCallback(
    (folder: db.NotesFolder) => {
      if (!canEdit || folder.folderId === rootFolderId) return;

      const summary = getFolderDeleteSummary(folder);
      const contents = [
        summary.noteCount > 0 ? formatCount(summary.noteCount, 'note') : null,
        summary.nestedFolderCount > 0
          ? formatCount(summary.nestedFolderCount, 'folder')
          : null,
      ].filter(Boolean);
      const hasContents = contents.length > 0;
      const label = getFolderLabel(folder);
      const message = hasContents
        ? `Delete "${label}"?\n\nThis will permanently delete ${contents.join(
            ' and '
          )} inside this folder.`
        : `Delete "${label}"?\n\nThis folder will be permanently deleted.`;

      if (Platform.OS === 'web') {
        const confirm = (
          globalThis as { confirm?: (message: string) => boolean }
        ).confirm;
        if (typeof confirm === 'function' && !confirm(message)) {
          return;
        }
        void runDeleteFolder(folder, summary.folderIds);
        return;
      }

      Alert.alert(
        hasContents ? 'Delete folder and contents?' : 'Delete folder?',
        message.replace(/\n\n/g, ' '),
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void runDeleteFolder(folder, summary.folderIds);
            },
          },
        ]
      );
    },
    [canEdit, getFolderDeleteSummary, rootFolderId, runDeleteFolder]
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
          void handleCreateNote();
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
          handleOpenCreateFolder();
        },
        disabled: isCreatingFolder,
        testID: 'NotesNewFolderAction',
      },
    ],
    [handleCreateNote, handleOpenCreateFolder, isCreatingFolder, isCreatingNote]
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

  const handleDesktopNoteDeleted = useCallback(() => {
    if (selectedNoteId === null) return;
    handleNoteDeleted(selectedNoteId);
  }, [handleNoteDeleted, selectedNoteId]);

  const headerActions = useMemo(() => {
    if (!notebookFlag || joinFailed) return null;
    return (
      <NotesHeaderActions
        canEdit={canEdit}
        canImportFiles={canImportFiles}
        canImportFolder={canImportFolder}
        isCreatingFolder={isCreatingFolder}
        isCreatingNote={isCreatingNote}
        isImporting={isImportingNotes}
        onCreateFolder={handleOpenCreateFolder}
        onCreateNote={handleCreateNote}
        onImportFiles={handleImportFiles}
        onImportFolder={handleImportFolder}
        primaryActionVariant={useDesktopSplit ? 'icon' : 'text'}
        treeViewStyle={treeViewStyle}
        onTreeViewStyleChange={handleTreeViewStyleChange}
      />
    );
  }, [
    canEdit,
    canImportFiles,
    canImportFolder,
    handleCreateNote,
    handleImportFiles,
    handleImportFolder,
    handleOpenCreateFolder,
    handleTreeViewStyleChange,
    isCreatingFolder,
    isCreatingNote,
    isImportingNotes,
    joinFailed,
    notebookFlag,
    treeViewStyle,
    useDesktopSplit,
  ]);

  useRegisterChannelHeaderItem(useDesktopSplit ? null : headerActions);

  const notesTreePane = (
    <NotesTreePane
      canEdit={canEdit}
      isDeletingFolder={isDeletingFolder}
      isCreatingFolder={isCreatingFolder}
      isCreatingNote={isCreatingNote}
      layout={useDesktopSplit ? 'takeover' : 'stack'}
      normalizedQuery={normalizedNotesFilterQuery}
      notesFilterQuery={notesFilterQuery}
      selectedFolderId={selectedFolderId}
      selectedNoteId={useDesktopSplit ? selectedNoteId : null}
      treeRows={treeRows}
      treeViewStyle={treeViewStyle}
      onCreate={handleOpenNewSheet}
      onDeleteFolder={handleDeleteFolder}
      onDeleteNote={handleDeleteNote}
      onMoveFolder={handleOpenMoveFolder}
      onMoveNote={handleOpenMoveNote}
      onOpenNote={openNote}
      onQueryChange={setNotesFilterQuery}
      onRenameFolder={handleOpenRenameFolder}
      onToggleFolder={toggleFolder}
    />
  );

  useNotebookSidebarRegistration(
    useDesktopSplit && !gate
      ? {
          channelId,
          actions: headerActions,
          content: notesTreePane,
          groupId,
          title: channelTitle ?? 'Notebook',
        }
      : null,
    channelId
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

  const noteDetailPane = (
    <YStack flex={1} minWidth={0} backgroundColor="$background">
      {selectedNoteId === null ? (
        <NotesEmptyDetailPane
          canEdit={canEdit}
          isCreating={isCreatingNote}
          onCreateNote={handleCreateNote}
        />
      ) : (
        <NotesNoteDetail
          headerActionsPlacement="inline"
          noteId={selectedNoteId}
          notebookFlag={notebookFlag}
          onDeleted={handleDesktopNoteDeleted}
        />
      )}
    </YStack>
  );

  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      position="relative"
      {...dropImportProps}
    >
      {error ? <NotesErrorMessage error={error} /> : null}
      {importNotice ? <NotesImportNotice message={importNotice} /> : null}

      {useDesktopSplit ? noteDetailPane : notesTreePane}
      {isDragImportActive ? (
        <YStack
          pointerEvents="none"
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          borderColor="$positiveText"
          borderWidth={2}
          backgroundColor="$backgroundHover"
          opacity={0.7}
        />
      ) : null}
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

function NotesImportNotice({ message }: { message: string }) {
  return (
    <YStack
      paddingHorizontal="$l"
      paddingVertical="$s"
      backgroundColor="$secondaryBackground"
      borderBottomColor="$border"
      borderBottomWidth={1}
    >
      <Text size="$label/s" color="$secondaryText">
        {message}
      </Text>
    </YStack>
  );
}

function folderCacheKey({
  name,
  parentFolderId,
}: {
  name: string;
  parentFolderId?: number | null;
}) {
  return `${parentFolderId ?? 'root'}:${normalizeTitleKey(name)}`;
}

function formatImportNotice(importedCount: number, failedCount: number) {
  if (failedCount === 0) {
    return `Imported ${formatCount(importedCount, 'note')}.`;
  }
  return `Imported ${formatCount(importedCount, 'note')}; ${formatCount(
    failedCount,
    'note'
  )} failed.`;
}

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

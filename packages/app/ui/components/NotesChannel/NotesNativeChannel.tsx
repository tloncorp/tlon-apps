import { NavigationProp, useNavigation } from '@react-navigation/native';
import {
  createNotebookFolder,
  createNotebookNote,
  deleteNotebookFolder,
  deleteNotebookNote,
  moveNotebookFolder,
  moveNotebookNote,
  noteIsPublished,
  publishNotebookNote,
  publishedNotePath,
  renameNotebookFolder,
  unpublishNotebookNote,
  useMutableCallback,
  usePublishedNotesForNotebook,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { collectDescendantFolderIds } from '@tloncorp/shared/logic/notesTree';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { YStack } from 'tamagui';

import type { RootStackParamList } from '../../../navigation/types';
import { useNotebookSidebarRegistration } from '../../contexts/notebookSidebar';
import { SimpleActionSheet } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import {
  MoveNoteSheet,
  NotebookGateMessage,
  NotesBanner,
  confirmNotesDestructiveAction,
  errorMessage,
  useEntityDialog,
  useNotebookData,
} from './NotesCommon';
import {
  AddFolderDialog,
  MoveFolderSheet,
  RenameFolderDialog,
} from './NotesDialogs';
import {
  NotesHeaderActions,
  createNotesNewFolderAction,
  createNotesNewNoteAction,
} from './NotesHeaderActions';
import { NotesNoteDetail } from './NotesNoteDetail';
import { NotesEmptyDetailPane, NotesTreePane } from './NotesTreePane';
import { canSelectNotesImportSources } from './notesImport';
import {
  buildFolderNoteCounts,
  buildFolderRows,
  buildNotesTreeRows,
  getFolderLabel,
  getNextNoteIdAfterDelete,
  getNextNoteIdAfterFolderDelete,
} from './notesTree';
import { useNotesImportController } from './useNotesImportController';

type PublishingAction = 'publish' | 'unpublish' | null;

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
  const [publishingAction, setPublishingAction] =
    useState<PublishingAction>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
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
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(
    () => new Set()
  );
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<number | null>(null);
  const initializedFolderIdsRef = useRef<Set<number>>(new Set());

  const { folders, notes, canEdit, rootFolderId, gate } =
    useNotebookData(notebookFlag);
  const { data: publishedNotes, refetch: refetchPublishedNotes } =
    usePublishedNotesForNotebook({
      notebookFlag,
      enabled: Boolean(notebookFlag),
    });

  const canImportFiles = canEdit && canSelectNotesImportSources('files');
  const canImportFolder = canEdit && canSelectNotesImportSources('folder');

  const parentFolderRows = useMemo(
    () => buildFolderRows(folders, rootFolderId, { includeRoot: true }),
    [folders, rootFolderId]
  );

  const folderNoteCounts = useMemo(
    () => buildFolderNoteCounts(folders, notes),
    [folders, notes]
  );
  const treeRows = useMemo(
    () =>
      buildNotesTreeRows({
        expandedFolderIds,
        folderNoteCounts,
        folders,
        notes,
        rootFolderId,
      }),
    [expandedFolderIds, folderNoteCounts, folders, notes, rootFolderId]
  );
  const isNotePublished = useMemo(
    () => (noteId: number) => noteIsPublished(publishedNotes, noteId),
    [publishedNotes]
  );
  const getPublishedNoteUrl = useMemo(
    () => (note: db.NotesNote) => {
      if (
        Platform.OS !== 'web' ||
        !notebookFlag ||
        typeof window === 'undefined'
      ) {
        return null;
      }

      return new URL(
        publishedNotePath(notebookFlag, note.noteId),
        window.location.origin
      ).toString();
    },
    [notebookFlag]
  );
  const selectNoteInPane = useMutableCallback((noteId: number | null) => {
    setSelectedNoteId(noteId);
    const note =
      noteId !== null
        ? notes.find((candidate) => candidate.noteId === noteId)
        : null;
    if (note) {
      setSelectedFolderId(note.folderId);
    }
  });

  useEffect(() => {
    if (!useDesktopSplit || selectedNoteId !== null) return;
    const firstNote = treeRows.find((row) => row.type === 'note')?.note;
    if (!firstNote) return;
    selectNoteInPane(firstNote.noteId);
  }, [selectNoteInPane, selectedNoteId, treeRows, useDesktopSplit]);

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

  const openNote = useMutableCallback(
    (note: db.NotesNote, options?: { focusTitle?: boolean }) => {
      if (options?.focusTitle) {
        setFocusTitleNoteId(note.noteId);
      }

      if (useDesktopSplit) {
        selectNoteInPane(note.noteId);
        return;
      }

      navigation.navigate('NotesDetail', {
        channelId,
        groupId: groupId ?? undefined,
        noteId: note.noteId,
        focusTitle: options?.focusTitle,
      });
    }
  );

  const handleTitleAutoFocused = useMutableCallback(() => {
    setFocusTitleNoteId(null);
  });

  const expandFolder = useMutableCallback((folderId: number) => {
    setExpandedFolderIds((currentIds) => {
      if (currentIds.has(folderId)) {
        return currentIds;
      }
      const nextIds = new Set(currentIds);
      nextIds.add(folderId);
      return nextIds;
    });
  });

  const runAction = useMutableCallback(
    async (fallback: string, action: () => Promise<void>) => {
      setError(null);
      try {
        await action();
      } catch (e) {
        setError(errorMessage(e, fallback));
      }
    }
  );

  const handleCreateNote = useMutableCallback(async (folderId?: number) => {
    if (!notebookFlag || !rootFolderId || !canEdit || isCreatingNote) return;
    const targetFolderId = folderId ?? selectedFolderId ?? rootFolderId;
    setIsCreatingNote(true);
    await runAction('Failed to create note', async () => {
      expandFolder(targetFolderId);
      setSelectedFolderId(targetFolderId);
      const note = await createNotebookNote({
        notebookFlag,
        folderId: targetFolderId,
        title: '',
      });
      if (note) {
        openNote(note, { focusTitle: true });
      }
    });
    setIsCreatingNote(false);
  });

  const openAddFolderDialog = useMutableCallback((parentFolderId?: number) => {
    setNewFolderName('');
    setNewFolderParentId(parentFolderId ?? selectedFolderId ?? rootFolderId);
    setAddFolderOpen(true);
  });

  const handleCreateFolder = useMutableCallback(async () => {
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
      setNewFolderParentId(null);
      setAddFolderOpen(false);
    });
    setIsCreatingFolder(false);
  });

  const handleAddFolderOpenChange = useMutableCallback((open: boolean) => {
    setAddFolderOpen(open);
    if (!open) {
      setNewFolderParentId(null);
      return;
    }

    if (open) {
      setNewFolderName('');
      setNewFolderParentId(
        (currentParentId) => currentParentId ?? selectedFolderId ?? rootFolderId
      );
    }
  });

  const canDropImportNotes = canImportFolder && gate !== 'unjoinable';
  const {
    dropImportProps,
    importFiles,
    importFolder,
    importNotice,
    isDragImportActive,
    isImportingNotes,
  } = useNotesImportController({
    canDropImportNotes,
    canEdit,
    expandFolder,
    folders,
    notebookFlag,
    notes,
    rootFolderId,
    selectedFolderId,
    setError,
  });

  const handleMoveNoteToFolder = useMutableCallback(
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
    }
  );

  const handleNoteDeleted = useMutableCallback((deletedNoteId: number) => {
    if (selectedNoteId !== deletedNoteId) return;

    const nextNoteId = getNextNoteIdAfterDelete(treeRows, deletedNoteId);
    selectNoteInPane(nextNoteId);
  });

  const handleDeleteNote = useMutableCallback((note: db.NotesNote) => {
    if (!notebookFlag || !canEdit) return;

    const title = note.title || 'Untitled';
    confirmNotesDestructiveAction({
      webMessage: `Delete "${title}"?\n\nThis note will be removed from the notebook.`,
      nativeTitle: 'Delete note',
      nativeMessage: `Delete "${title}"? This note will be removed from the notebook.`,
      action: () => {
        void runAction('Failed to delete note', async () => {
          await deleteNotebookNote({
            notebookFlag,
            noteId: note.noteId,
          });
          handleNoteDeleted(note.noteId);
        });
      },
    });
  });

  const handleViewPublishedNote = useMutableCallback((note: db.NotesNote) => {
    const publishedUrl = getPublishedNoteUrl(note);
    if (!publishedUrl) return;
    window.open(publishedUrl, '_blank', 'noopener,noreferrer');
  });

  const handlePublishNote = useMutableCallback(async (note: db.NotesNote) => {
    if (!notebookFlag || !canEdit || publishingAction) return;

    setPublishingAction('publish');
    try {
      await runAction('Failed to publish note', async () => {
        await publishNotebookNote({
          notebookFlag,
          noteId: note.noteId,
          title: note.title,
          body: note.bodyMd,
        });
        await refetchPublishedNotes();
      });
    } finally {
      setPublishingAction(null);
    }
  });

  const handleUnpublishNote = useMutableCallback(async (note: db.NotesNote) => {
    if (!notebookFlag || !canEdit || publishingAction) return;

    setPublishingAction('unpublish');
    try {
      await runAction('Failed to unpublish note', async () => {
        await unpublishNotebookNote({
          notebookFlag,
          noteId: note.noteId,
        });
        await refetchPublishedNotes();
      });
    } finally {
      setPublishingAction(null);
    }
  });

  const handleOpenRenameFolder = useMutableCallback(
    (folder: db.NotesFolder) => {
      openRenameFolderDialog(folder);
      setRenameFolderName(getFolderLabel(folder));
    }
  );

  const updateSelectionAfterFolderDelete = useMutableCallback(
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
      selectNoteInPane(nextNoteId);
    }
  );

  const handleDeleteFolder = useMutableCallback((folder: db.NotesFolder) => {
    if (
      !notebookFlag ||
      !canEdit ||
      isDeletingFolder ||
      folder.folderId === rootFolderId
    ) {
      return;
    }

    const folderIds = collectDescendantFolderIds(folders, folder.folderId);
    const nestedFolderCount = Math.max(0, folderIds.size - 1);
    const noteCount = notes.filter((note) =>
      folderIds.has(note.folderId)
    ).length;
    const contents = [
      noteCount > 0 ? formatCount(noteCount, 'note') : null,
      nestedFolderCount > 0 ? formatCount(nestedFolderCount, 'folder') : null,
    ].filter(Boolean);
    const hasContents = contents.length > 0;
    const label = getFolderLabel(folder);
    const message = hasContents
      ? `Delete "${label}"?\n\nThis will permanently delete ${contents.join(
          ' and '
        )} inside this folder.`
      : `Delete "${label}"?\n\nThis folder will be permanently deleted.`;

    confirmNotesDestructiveAction({
      webMessage: message,
      nativeTitle: hasContents
        ? 'Delete folder and contents?'
        : 'Delete folder?',
      nativeMessage: message.replace(/\n\n/g, ' '),
      action: () => {
        setIsDeletingFolder(true);
        void runAction('Failed to delete folder', async () => {
          await deleteNotebookFolder({
            notebookFlag,
            folder,
          });
          updateSelectionAfterFolderDelete(folderIds);
          setExpandedFolderIds((currentIds) => {
            if (![...folderIds].some((id) => currentIds.has(id))) {
              return currentIds;
            }

            const nextIds = new Set(currentIds);
            folderIds.forEach((folderId) => nextIds.delete(folderId));
            return nextIds;
          });
        }).finally(() => setIsDeletingFolder(false));
      },
    });
  });

  const handleRenameFolder = useMutableCallback(async () => {
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
  });

  const handleMoveFolderToParent = useMutableCallback(
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
    }
  );

  const newActions = [
    createNotesNewNoteAction({
      action: () => {
        setNewActionSheetOpen(false);
        void handleCreateNote();
      },
      disabled: isCreatingNote,
      testID: 'NotesNewNoteAction',
    }),
    createNotesNewFolderAction({
      action: () => {
        setNewActionSheetOpen(false);
        openAddFolderDialog();
      },
      disabled: isCreatingFolder,
      testID: 'NotesNewFolderAction',
    }),
    ...(canImportFiles
      ? [
          {
            title: 'Import',
            startIcon: 'ArrowDown' as const,
            action: () => {
              setNewActionSheetOpen(false);
              importFiles();
            },
            disabled: isImportingNotes,
            testID: 'NotesImportFilesAction',
          },
        ]
      : []),
    ...(canImportFolder
      ? [
          {
            title: 'Import folder',
            startIcon: 'Folder' as const,
            action: () => {
              setNewActionSheetOpen(false);
              importFolder();
            },
            disabled: isImportingNotes,
            testID: 'NotesImportFolderAction',
          },
        ]
      : []),
  ];

  const toggleFolder = useMutableCallback(
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
    }
  );

  const headerActions = useMemo(() => {
    if (!notebookFlag || gate === 'unjoinable') return null;
    return (
      <NotesHeaderActions
        canEdit={canEdit}
        onNew={() => setNewActionSheetOpen(true)}
        primaryActionVariant={useDesktopSplit ? 'icon' : 'text'}
      />
    );
  }, [canEdit, gate, notebookFlag, useDesktopSplit]);

  useRegisterChannelHeaderItem(useDesktopSplit ? null : headerActions);

  const notesTreePane = (
    <NotesTreePane
      canEdit={canEdit}
      isDeletingFolder={isDeletingFolder}
      isNotePublished={isNotePublished}
      getPublishedNoteUrl={getPublishedNoteUrl}
      layout={useDesktopSplit ? 'takeover' : 'stack'}
      publishDisabled={publishingAction !== null}
      publishingAction={publishingAction}
      selectedFolderId={selectedFolderId}
      selectedNoteId={useDesktopSplit ? selectedNoteId : null}
      treeRows={treeRows}
      onDeleteFolder={handleDeleteFolder}
      onDeleteNote={handleDeleteNote}
      onMoveFolder={openMoveFolderDialog}
      onMoveNote={openMoveNoteDialog}
      onOpenNote={openNote}
      onPublishNote={handlePublishNote}
      onCreateFolderInFolder={(folder) => openAddFolderDialog(folder.folderId)}
      onCreateNoteInFolder={(folder) => void handleCreateNote(folder.folderId)}
      onRenameFolder={handleOpenRenameFolder}
      onToggleFolder={toggleFolder}
      onUnpublishNote={handleUnpublishNote}
      onViewPublishedNote={handleViewPublishedNote}
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
          autoFocusTitle={focusTitleNoteId === selectedNoteId}
          headerActionsPlacement="inline"
          noteId={selectedNoteId}
          notebookFlag={notebookFlag}
          onTitleAutoFocused={handleTitleAutoFocused}
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
      {error ? <NotesBanner message={error} tone="negative" /> : null}
      {importNotice ? <NotesBanner message={importNotice} /> : null}

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

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

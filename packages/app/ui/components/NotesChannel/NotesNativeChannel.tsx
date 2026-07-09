import {
  NavigationProp,
  StackActions,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
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
  publishedNoteUrl,
  renameNotebookFolder,
  unpublishNotebookNote,
  useMutableCallback,
  usePublishedNotesForNotebook,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { collectDescendantFolderIds } from '@tloncorp/shared/logic/notesTree';
import { useIsWindowNarrow, useToast } from '@tloncorp/ui';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { YStack } from 'tamagui';

import { useShip } from '../../../contexts/ship';
import type { RootStackParamList } from '../../../navigation/types';
import { useNotebookSidebarRegistration } from '../../contexts/notebookSidebar';
import { ActionSheet } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { NotesActionGroupList } from './NotesActions';
import { NotebookGateMessage, useNotebookData } from './NotesData';
import { useEntityDialog } from './NotesDialogPrimitives';
import {
  AddFolderDialog,
  MoveFolderSheet,
  RenameFolderDialog,
} from './NotesDialogs';
import {
  NotesBanner,
  confirmNotesDestructiveAction,
  errorMessage,
} from './NotesFeedback';
import {
  NotesHeaderActions,
  createNotesNewFolderAction,
  createNotesNewNoteAction,
} from './NotesHeaderActions';
import { MoveNoteSheet } from './NotesMoveSheets';
import {
  NotesNoteDetail,
  type NotesNoteDraftSnapshot,
  getNotesNoteDraftSnapshot,
} from './NotesNoteDetail';
import { NotesEmptyDetailPane, NotesTreePane } from './NotesTreePane';
import { canSelectNotesImportSources } from './notesImport';
import { trackNotesActionError } from './notesTelemetry';
import {
  type FolderRow,
  buildFolderContentsRows,
  buildFolderDestinationRows,
  buildFolderNoteCounts,
  buildFolderRows,
  getFolderLabel,
  getNextNoteIdAfterDelete,
  getNextNoteIdAfterFolderDelete,
} from './notesTree';
import { useNotesImportController } from './useNotesImportController';

const MOVE_OPERATION_TIMEOUT_MS = 12000;
const MOVE_OPERATION_TIMEOUT_MESSAGE =
  'Move is taking longer than expected. It may still finish syncing, so check before moving it again.';

function withMoveOperationTimeout(operation: Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(MOVE_OPERATION_TIMEOUT_MESSAGE));
    }, MOVE_OPERATION_TIMEOUT_MS);

    operation.then(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

type PublishingAction = 'publish' | 'unpublish' | null;

export function NotesNativeChannel({
  channelId,
  channelTitle,
  folderId,
  groupId,
  notebookFlag,
}: {
  channelId: string;
  channelTitle?: string;
  folderId?: number | null;
  groupId?: string | null;
  notebookFlag: string | null | undefined;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { shipUrl } = useShip();
  const isWindowNarrow = useIsWindowNarrow();
  const showToast = useToast();
  const useDesktopSplit = Platform.OS === 'web' && !isWindowNarrow;
  const notebookSidebarSourceId = `${channelId}/${folderId ?? 'root'}`;
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
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<number | null>(null);
  const [startEditNoteId, setStartEditNoteId] = useState<number | null>(null);
  const activeNoteDraftRef = useRef<NotesNoteDraftSnapshot | null>(null);

  const { folders, notes, canEdit, rootFolderId, gate } = useNotebookData(
    notebookFlag,
    { syncEnabled: isFocused }
  );
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
  const activeFolderId = folderId ?? rootFolderId;
  const treeRows = useMemo(
    () =>
      buildFolderContentsRows({
        folderId: activeFolderId,
        folderNoteCounts,
        folders,
        notes,
        rootFolderId,
      }),
    [activeFolderId, folderNoteCounts, folders, notes, rootFolderId]
  );
  const isNotePublished = useMemo(
    () => (noteId: number) => noteIsPublished(publishedNotes, noteId),
    [publishedNotes]
  );
  const getPublishedNoteUrl = useMemo(
    () => (note: db.NotesNote) => {
      if (!notebookFlag) {
        return null;
      }

      return publishedNoteUrl(
        publishedNotePath(notebookFlag, note.noteId),
        shipUrl
      );
    },
    [notebookFlag, shipUrl]
  );
  const getPublishedNoteShareUrl = useMemo(
    () => (publishedPath: string) => {
      return publishedNoteUrl(publishedPath, shipUrl);
    },
    [shipUrl]
  );
  const handleNoteDraftChange = useMutableCallback(
    (draft: NotesNoteDraftSnapshot | null) => {
      activeNoteDraftRef.current = draft;
    }
  );
  const getNotePublishContent = useMutableCallback((note: db.NotesNote) => {
    const activeDraft = activeNoteDraftRef.current;
    const draft =
      activeDraft &&
      activeDraft.notebookFlag === notebookFlag &&
      activeDraft.noteId === note.noteId
        ? activeDraft
        : notebookFlag
          ? getNotesNoteDraftSnapshot(notebookFlag, note.noteId)
          : null;
    if (draft) {
      return {
        title: draft.title,
        body: draft.body,
      };
    }

    return {
      title: note.title,
      body: note.bodyMd,
    };
  });
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

  const openNote = useMutableCallback(
    (
      note: db.NotesNote,
      options?: { focusTitle?: boolean; startInEdit?: boolean }
    ) => {
      if (options?.focusTitle) {
        setFocusTitleNoteId(note.noteId);
      }
      if (options?.startInEdit) {
        setStartEditNoteId(note.noteId);
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
        startInEdit: options?.startInEdit,
      });
    }
  );

  const handleTitleAutoFocused = useMutableCallback(() => {
    setFocusTitleNoteId(null);
  });

  // Deliberately does not touch selectedFolderId: the pushed folder screen is
  // its own component instance, and a selection recorded here would outlive
  // the visit as invisible state that redirects imports after backing out.
  const openFolder = useMutableCallback((folder: db.NotesFolder) => {
    navigation.dispatch(
      StackActions.push('NotesFolder', {
        channelId,
        folderId: folder.folderId,
        folderTitle: getFolderLabel(folder),
        groupId: groupId ?? undefined,
      })
    );
  });

  const runAction = useMutableCallback(
    async (fallback: string, action: () => Promise<void>) => {
      setError(null);
      try {
        await action();
      } catch (e) {
        const message = errorMessage(e, fallback);
        trackNotesActionError(fallback, e, message);
        setError(message);
      }
    }
  );

  const getCreateTargetFolderId = useMutableCallback(
    (folderId?: number | null) =>
      folderId ?? activeFolderId ?? selectedFolderId ?? rootFolderId
  );

  const handleCreateNote = useMutableCallback(async (folderId?: number) => {
    if (!notebookFlag || !rootFolderId || !canEdit || isCreatingNote) return;
    const targetFolderId = getCreateTargetFolderId(folderId);
    if (!targetFolderId) return;
    setIsCreatingNote(true);
    await runAction('Failed to create note', async () => {
      setSelectedFolderId(targetFolderId);
      const note = await createNotebookNote({
        notebookFlag,
        folderId: targetFolderId,
        title: '',
      });
      if (note) {
        openNote(note, { focusTitle: true, startInEdit: true });
      }
    });
    setIsCreatingNote(false);
  });

  const openAddFolderDialog = useMutableCallback((parentFolderId?: number) => {
    setNewFolderName('');
    setNewFolderParentId(getCreateTargetFolderId(parentFolderId) ?? null);
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
        (currentParentId) => getCreateTargetFolderId(currentParentId) ?? null
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
    activeFolderId: folderId ?? null,
    canDropImportNotes,
    canEdit,
    folders,
    notebookFlag,
    notes,
    rootFolderId,
    // Selection is only visible context in the split layout; on stacked
    // navigation openFolder leaves it behind as stale state after the user
    // backs out of the pushed folder screen.
    selectedFolderId: useDesktopSplit ? selectedFolderId : null,
    setError,
  });

  const handleMoveNoteToFolder = useMutableCallback(
    async (folderId: number) => {
      if (!notebookFlag || !movingNote || !canEdit || isMovingNote) return;

      const note = movingNote;
      const destinationLabel = getMoveDestinationLabel(
        parentFolderRows,
        folderId
      );
      closeMoveNoteDialog();

      if (folderId === note.folderId) {
        return;
      }

      await runAction('Failed to move note', () =>
        runMoveNote(() =>
          withMoveOperationTimeout(
            (async () => {
              await moveNotebookNote({
                notebookFlag,
                noteId: note.noteId,
                folderId,
              });
              setSelectedFolderId(folderId);
              setError(null);
              showToast({
                message: `Moved note to ${destinationLabel}`,
                duration: 1500,
              });
            })()
          )
        )
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

  const handleRenameNote = useMutableCallback((note: db.NotesNote) => {
    if (!canEdit) return;
    openNote(note, { focusTitle: true });
  });

  const openPublishedUrl = useMutableCallback(async (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    await Linking.openURL(url);
  });

  const handleViewPublishedNote = useMutableCallback((note: db.NotesNote) => {
    const publishedUrl = getPublishedNoteUrl(note);
    if (!publishedUrl) return;
    void openPublishedUrl(publishedUrl).catch((e) => {
      const message = errorMessage(e, 'Failed to open published note');
      trackNotesActionError('view published note', e, message);
      setError(message);
    });
  });

  const handlePublishNote = useMutableCallback(async (note: db.NotesNote) => {
    if (!notebookFlag || !canEdit || publishingAction) return;

    setPublishingAction('publish');
    try {
      let publishedUrl: string | null = null;
      await runAction('Failed to publish note', async () => {
        const content = getNotePublishContent(note);
        const publishedPath = await publishNotebookNote({
          notebookFlag,
          noteId: note.noteId,
          title: content.title,
          body: content.body,
        });
        await refetchPublishedNotes();
        publishedUrl = getPublishedNoteShareUrl(publishedPath);
      });

      if (publishedUrl) {
        try {
          await Clipboard.setStringAsync(publishedUrl);
          showToast({
            message: 'Published note. Link copied to clipboard.',
            duration: 2000,
          });
        } catch (e) {
          const message = errorMessage(
            e,
            'Published note, but failed to copy link'
          );
          trackNotesActionError('copy published note link', e, message);
          setError(message);
        }
      }
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

      const folder = movingFolder;
      const destinationLabel = getMoveDestinationLabel(
        parentFolderRows,
        parentFolderId
      );
      closeMoveFolderDialog();

      if (parentFolderId === folder.parentFolderId) {
        return;
      }

      await runAction('Failed to move folder', () =>
        runMoveFolder(() =>
          withMoveOperationTimeout(
            (async () => {
              await moveNotebookFolder({
                notebookFlag,
                folder,
                parentFolderId,
              });
              setSelectedFolderId(folder.folderId);
              setError(null);
              showToast({
                message: `Moved folder to ${destinationLabel}`,
                duration: 1500,
              });
            })()
          )
        )
      );
    }
  );

  const runImportAfterSheetCloses = useMutableCallback((action: () => void) => {
    setNewActionSheetOpen(false);
    if (Platform.OS === 'web') {
      action();
      return;
    }

    setTimeout(action, 50);
  });

  const createActions = [
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
  ];

  const importActions = [
    ...(canImportFiles
      ? [
          {
            title: 'Import files',
            startIcon: 'ChannelNote' as const,
            action: () => {
              runImportAfterSheetCloses(importFiles);
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
              runImportAfterSheetCloses(importFolder);
            },
            disabled: isImportingNotes,
            testID: 'NotesImportFolderAction',
          },
        ]
      : []),
  ];

  const newActionGroups = [
    {
      accent: 'neutral' as const,
      actions: createActions,
    },
    ...(importActions.length > 0
      ? [
          {
            accent: 'neutral' as const,
            actions: importActions,
          },
        ]
      : []),
  ];

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
      getPublishedNoteUrl={getPublishedNoteUrl}
      isDeletingFolder={isDeletingFolder}
      isNotePublished={isNotePublished}
      layout={useDesktopSplit ? 'takeover' : 'stack'}
      publishDisabled={publishingAction !== null}
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
      onRenameNote={handleRenameNote}
      onOpenFolder={openFolder}
      onUnpublishNote={handleUnpublishNote}
      onViewPublishedNote={handleViewPublishedNote}
    />
  );

  useNotebookSidebarRegistration(
    useDesktopSplit && isFocused && !gate
      ? {
          channelId,
          actions: headerActions,
          content: notesTreePane,
          groupId,
          title: channelTitle ?? 'Notebook',
        }
      : null,
    notebookSidebarSourceId
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
          onDraftChange={handleNoteDraftChange}
          onTitleAutoFocused={handleTitleAutoFocused}
          startInEdit={startEditNoteId === selectedNoteId}
          // This embedded pane shares the shell's notebook; syncing here too
          // would add a duplicate %notes subscription that keeps running
          // after this screen loses focus.
          syncEnabled={false}
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
      <ActionSheet
        open={newActionSheetOpen}
        onOpenChange={setNewActionSheetOpen}
        modal
        unmountOnClose
      >
        <ActionSheet.SimpleHeader
          title="New"
          subtitle="Create or import notes or folders"
        />
        <ActionSheet.Content>
          <NotesActionGroupList
            groups={newActionGroups}
            onAction={(action) => {
              setNewActionSheetOpen(false);
              action?.();
            }}
          />
        </ActionSheet.Content>
      </ActionSheet>
      <AddFolderDialog
        isCreating={isCreatingFolder}
        name={newFolderName}
        onCreate={handleCreateFolder}
        onNameChange={setNewFolderName}
        onOpenChange={handleAddFolderOpenChange}
        open={addFolderOpen}
        targetFolderLabel={getMoveDestinationLabel(
          parentFolderRows,
          newFolderParentId ?? activeFolderId ?? rootFolderId
        )}
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

function getMoveDestinationLabel(
  folderRows: FolderRow[],
  folderId: number | null | undefined
) {
  if (folderId === null || folderId === undefined) {
    return 'folder';
  }

  return (
    buildFolderDestinationRows({ folderRows }).find(
      (destination) => destination.folder.folderId === folderId
    )?.displayPath ?? 'folder'
  );
}

import {
  convertContent,
  deleteNotebookNote,
  markdownToStory,
  moveNotebookNote,
  saveNotebookNote,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Input, ScrollView, TextArea, XStack, YStack } from 'tamagui';

import { createActionGroups } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { NotebookContentRenderer } from '../NotebookPost/NotebookPost';
import {
  MetadataPill,
  MoveNoteSheet,
  NotebookGateMessage,
  NotesErrorMessage,
  NotesMessage,
  NotesOverflowMenu,
  errorMessage,
  useEntityDialog,
  useNotebookData,
} from './NotesCommon';
import { buildFolderRows, formatNoteDate } from './notesTree';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

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
  const [isPreviewing, setIsPreviewing] = useState(false);
  const {
    entity: movingNote,
    isPending: isMovingNote,
    open: openMoveDialog,
    close: closeMoveDialog,
    handleOpenChange: handleMoveOpenChange,
    run: runMove,
  } = useEntityDialog<db.NotesNote>();

  const { folders, notes, canEdit, rootFolderId, gate } =
    useNotebookData(notebookFlag);
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
        error: errorMessage(e, 'Unable to render Markdown preview'),
      };
    }
  }, [bodyDraft]);

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
      setError(errorMessage(e, 'Failed to save note'));
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
      setError(errorMessage(e, 'Failed to delete note'));
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
        closeMoveDialog();
        return;
      }

      setError(null);
      try {
        await runMove(async () => {
          await moveNotebookNote({
            notebookFlag,
            noteId: selectedNote.noteId,
            folderId,
          });
        });
      } catch (e) {
        setError(errorMessage(e, 'Failed to move note'));
      }
    },
    [
      canEdit,
      closeMoveDialog,
      isMovingNote,
      notebookFlag,
      runMove,
      selectedNote,
    ]
  );

  const handleOpenMoveSheet = useCallback(() => {
    if (selectedNote) {
      openMoveDialog(selectedNote);
    }
  }, [openMoveDialog, selectedNote]);

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

  if (noteId === null) {
    return <NotesMessage title="Note unavailable" />;
  }

  if (gate) {
    return (
      <NotebookGateMessage
        gate={gate}
        loadingTitle="Loading note"
        unavailableTitle="Note unavailable"
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
        onOpenChange={handleMoveOpenChange}
        open={movingNote !== null}
      />
    </YStack>
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
  const groups = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          {
            title: 'Move to folder',
            startIcon: 'Folder',
            action: onMove,
            disabled: isMoving,
            testID: 'NotesDetailMoveAction',
          },
        ],
        [
          'negative',
          {
            title: 'Delete note',
            startIcon: 'Close',
            accent: 'negative',
            action: onDelete,
            testID: 'NotesDetailDeleteAction',
          },
        ]
      ),
    [isMoving, onDelete, onMove]
  );

  return (
    <NotesOverflowMenu
      groups={groups}
      triggerTestID="NotesDetailActionsTrigger"
    />
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

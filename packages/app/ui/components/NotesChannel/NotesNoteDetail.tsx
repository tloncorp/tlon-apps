import {
  convertContent,
  deleteNotebookNote,
  markdownToStory,
  moveNotebookNote,
  noteIsPublished,
  normalizeNotebookNoteTitle,
  publishedNotePath,
  publishNotebookNote,
  saveNotebookNote,
  unpublishNotebookNote,
  usePublishedNotesForNotebook,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
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

// Long enough that we don't fire a save on every typing pause; exits are
// covered by the flush paths and the draft stash either way.
const AUTOSAVE_DEBOUNCE_MS = 10_000;

const draftStashKey = (notebookFlag: string, noteId: number) =>
  `${notebookFlag}/${noteId}`;

// Drop a note's stash, optionally only when it still holds exactly the
// content that was just saved — keystrokes stashed after the save started
// must survive until their own save lands.
function clearDraftStash(
  notebookFlag: string,
  noteId: number,
  ifMatches?: { title: string; body: string }
) {
  void db.notesNoteDrafts.setValue((stashes) => {
    const key = draftStashKey(notebookFlag, noteId);
    const stash = stashes[key];
    if (!stash) return stashes;
    if (
      ifMatches &&
      (stash.title !== ifMatches.title || stash.body !== ifMatches.body)
    ) {
      return stashes;
    }
    const next = { ...stashes };
    delete next[key];
    return next;
  });
}

export function NotesNoteDetail({
  headerActionsPlacement = 'channel-header',
  noteId,
  notebookFlag,
  onDeleted,
}: {
  headerActionsPlacement?: 'channel-header' | 'inline' | 'none';
  noteId: number | null;
  notebookFlag: string | null | undefined;
  onDeleted?: () => void;
}) {
  // The note snapshot the drafts are based on. Dirtiness and the save's
  // expectedRevision are computed against this, not the live row, so a row
  // update can't silently absorb or clobber unsaved edits.
  const [draftBase, setDraftBase] = useState<db.NotesNote | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
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
  const {
    data: publishedNotes,
    refetch: refetchPublishedNotes,
  } = usePublishedNotesForNotebook({
    notebookFlag,
    enabled: Boolean(notebookFlag && selectedNote),
  });
  const selectedNoteIsPublished = noteIsPublished(
    publishedNotes,
    selectedNote?.noteId
  );

  const draftsMatchSelectedNote = draftBase?.id === selectedNote?.id;
  const isDirty = Boolean(
    selectedNote &&
      draftBase &&
      draftsMatchSelectedNote &&
      (normalizeNotebookNoteTitle(titleDraft) !== draftBase.title ||
        bodyDraft !== draftBase.bodyMd)
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

  // Load drafts when the selection changes. While the same note stays
  // selected, adopt row updates only when the editor is clean: the synced
  // echo of our own save must not overwrite keystrokes typed while the save
  // was in flight. A remote edit that lands while dirty keeps the stale base
  // revision, so the next save fails the revision check instead of silently
  // overwriting the remote work.
  useEffect(() => {
    const sameNote = (selectedNote?.id ?? null) === (draftBase?.id ?? null);
    if (sameNote && (isDirty || selectedNote === draftBase)) return;
    setDraftBase(selectedNote ?? null);
    setTitleDraft(selectedNote?.title ?? '');
    setBodyDraft(selectedNote?.bodyMd ?? '');
    if (!sameNote) {
      setSaveState('idle');
      setError(null);
    }
  }, [draftBase, isDirty, selectedNote]);

  // All saves go through one chain so each rebases onto the revision the
  // previous save produced instead of racing the backend revision check.
  const saveChainRef = useRef<Promise<db.NotesNote | null>>(
    Promise.resolve(null)
  );
  const runSave = useCallback(
    (flag: string, base: db.NotesNote, title: string, body: string) => {
      const next = saveChainRef.current
        .catch(() => null)
        .then((prevSaved) =>
          saveNotebookNote({
            notebookFlag: flag,
            note: prevSaved && prevSaved.id === base.id ? prevSaved : base,
            title,
            body,
          })
        );
      saveChainRef.current = next.then(
        (updated) => updated ?? null,
        () => null
      );
      return next;
    },
    []
  );

  const saveSelectedNote = useCallback(async () => {
    if (!notebookFlag || !draftBase || !canEdit) return false;
    if (!isDirty) return true;
    setSaveState('saving');
    setError(null);
    try {
      const updated = await runSave(
        notebookFlag,
        draftBase,
        titleDraft,
        bodyDraft
      );
      // Rebase onto the saved revision; keystrokes typed during the save
      // leave the drafts dirty against it, so the next cycle saves them.
      if (updated) {
        setDraftBase(updated);
      }
      clearDraftStash(notebookFlag, draftBase.noteId, {
        title: titleDraft,
        body: bodyDraft,
      });
      setSaveState('saved');
      return true;
    } catch (e) {
      setSaveState('error');
      setError(errorMessage(e, 'Failed to save note'));
      return false;
    }
  }, [
    bodyDraft,
    canEdit,
    draftBase,
    isDirty,
    notebookFlag,
    runSave,
    titleDraft,
  ]);

  useEffect(() => {
    if (!isDirty || !canEdit || saveState === 'saving') return;
    setSaveState('dirty');
    const timeout = setTimeout(() => {
      saveSelectedNote();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [canEdit, isDirty, saveSelectedNote, saveState]);

  // Snapshot of the latest committed editor state, for flushes that run
  // outside the React data flow (unmount cleanup, AppState changes). Synced
  // in an effect so a selection-change cleanup still sees the previous
  // note's drafts rather than the new render's.
  const flushCtxRef = useRef<{
    flag: string | null | undefined;
    base: db.NotesNote | null;
    title: string;
    body: string;
    canEdit: boolean;
  } | null>(null);
  useEffect(() => {
    flushCtxRef.current = {
      flag: notebookFlag,
      base: draftBase,
      title: titleDraft,
      body: bodyDraft,
      canEdit,
    };
  });

  const flushPendingSave = useCallback(() => {
    const ctx = flushCtxRef.current;
    if (!ctx || !ctx.flag || !ctx.base || !ctx.canEdit) return;
    const dirty =
      normalizeNotebookNoteTitle(ctx.title) !== ctx.base.title ||
      ctx.body !== ctx.base.bodyMd;
    if (!dirty) return;
    const { flag, base, title, body } = ctx;
    runSave(flag, base, title, body)
      .then((updated) => {
        clearDraftStash(flag, base.noteId, { title, body });
        // No-ops after unmount; while mounted (background flush) rebase so
        // the next cycle doesn't re-send a stale revision.
        if (updated) {
          setDraftBase(updated);
        }
        setSaveState('saved');
      })
      .catch(() => {});
  }, [runSave]);

  // Flush unsaved work when switching notes or unmounting — the poke
  // outlives the component.
  const selectedNoteRowId = selectedNote?.id ?? null;
  useEffect(() => {
    return () => flushPendingSave();
  }, [flushPendingSave, selectedNoteRowId]);

  // Flush when the app backgrounds; process death would drop the debounce.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'background' || status === 'inactive') {
        flushPendingSave();
      }
    });
    return () => subscription.remove();
  }, [flushPendingSave]);

  // Stash drafts as crash insurance between autosave cycles. Stashes are
  // cleared by the save paths above once their content lands, never just
  // because the editor is clean — a fresh mount is clean too, and must not
  // destroy a stash before the restore effect below has read it.
  useEffect(() => {
    if (!notebookFlag || !draftBase || !isDirty) return;
    void db.notesNoteDrafts.setValue((stashes) => ({
      ...stashes,
      [draftStashKey(notebookFlag, draftBase.noteId)]: {
        title: titleDraft,
        body: bodyDraft,
        baseRevision: draftBase.revision,
        stashedAt: Date.now(),
      },
    }));
  }, [bodyDraft, draftBase, isDirty, notebookFlag, titleDraft]);

  // Restore a stashed draft after a crash/kill. Only restore while the
  // editor is clean and the row is still at the stash's base revision —
  // then pushing the restored draft can't clobber anyone's newer work. A
  // stash from an older revision is superseded; drop it.
  useEffect(() => {
    if (!notebookFlag || !draftBase || isDirty) return;
    let cancelled = false;
    void db.notesNoteDrafts.getValue().then((stashes) => {
      const stash = stashes[draftStashKey(notebookFlag, draftBase.noteId)];
      if (cancelled || !stash) return;
      if (stash.baseRevision !== draftBase.revision) {
        clearDraftStash(notebookFlag, draftBase.noteId);
        return;
      }
      if (stash.title !== draftBase.title || stash.body !== draftBase.bodyMd) {
        setTitleDraft(stash.title);
        setBodyDraft(stash.body);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [draftBase, isDirty, notebookFlag]);

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

  const openPublishedNote = useCallback(() => {
    if (!notebookFlag || !selectedNote || Platform.OS !== 'web') return;
    const url = new URL(
      publishedNotePath(notebookFlag, selectedNote.noteId),
      window.location.origin
    ).toString();
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [notebookFlag, selectedNote]);

  const handlePublishSelectedNote = useCallback(async () => {
    if (!notebookFlag || !selectedNote || !canEdit || isPublishing) return;

    setIsPublishing(true);
    setError(null);
    try {
      const saved = await saveSelectedNote();
      if (!saved) return;

      await publishNotebookNote({
        notebookFlag,
        noteId: selectedNote.noteId,
        title: titleDraft,
        body: bodyDraft,
      });
      await refetchPublishedNotes();
      openPublishedNote();
    } catch (e) {
      setError(errorMessage(e, 'Failed to publish note'));
    } finally {
      setIsPublishing(false);
    }
  }, [
    bodyDraft,
    canEdit,
    isPublishing,
    notebookFlag,
    openPublishedNote,
    refetchPublishedNotes,
    saveSelectedNote,
    selectedNote,
    titleDraft,
  ]);

  const handleUnpublishSelectedNote = useCallback(async () => {
    if (!notebookFlag || !selectedNote || !canEdit || isUnpublishing) return;

    setIsUnpublishing(true);
    setError(null);
    try {
      await unpublishNotebookNote({
        notebookFlag,
        noteId: selectedNote.noteId,
      });
      await refetchPublishedNotes();
    } catch (e) {
      setError(errorMessage(e, 'Failed to unpublish note'));
    } finally {
      setIsUnpublishing(false);
    }
  }, [
    canEdit,
    isUnpublishing,
    notebookFlag,
    refetchPublishedNotes,
    selectedNote,
  ]);

  useRegisterChannelHeaderItem(
    useMemo(() => {
      if (
        headerActionsPlacement !== 'channel-header' ||
        !canEdit ||
        !selectedNote
      ) {
        return null;
      }
      return (
        <NotesDetailHeaderActions
          isMoving={isMovingNote}
          isPublished={selectedNoteIsPublished}
          isPublishing={isPublishing}
          isUnpublishing={isUnpublishing}
          canViewPublished={Platform.OS === 'web'}
          onDelete={handleDeleteSelectedNote}
          onMove={handleOpenMoveSheet}
          onPublish={handlePublishSelectedNote}
          onUnpublish={handleUnpublishSelectedNote}
          onViewPublished={openPublishedNote}
        />
      );
    }, [
      canEdit,
      handleDeleteSelectedNote,
      handleOpenMoveSheet,
      handlePublishSelectedNote,
      handleUnpublishSelectedNote,
      headerActionsPlacement,
      isMovingNote,
      isPublishing,
      isUnpublishing,
      openPublishedNote,
      selectedNote,
      selectedNoteIsPublished,
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

  const inlineActions =
    headerActionsPlacement === 'inline' && canEdit ? (
      <NotesDetailHeaderActions
        isMoving={isMovingNote}
        isPublished={selectedNoteIsPublished}
        isPublishing={isPublishing}
        isUnpublishing={isUnpublishing}
        canViewPublished={Platform.OS === 'web'}
        onDelete={handleDeleteSelectedNote}
        onMove={handleOpenMoveSheet}
        onPublish={handlePublishSelectedNote}
        onUnpublish={handleUnpublishSelectedNote}
        onViewPublished={openPublishedNote}
      />
    ) : null;

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
          <XStack alignItems="center" gap="$s">
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
            {headerActionsPlacement === 'inline' ? (
              <Button
                size="small"
                fill="outline"
                type="secondary"
                backgroundColor="$background"
                borderColor="$border"
                leadingIcon={isPreviewing ? 'EditList' : 'EyeOpen'}
                label={isPreviewing ? 'Edit' : 'Preview'}
                onPress={() => setIsPreviewing((previewing) => !previewing)}
                testID="NotesPreviewToggle"
              />
            ) : null}
            {inlineActions}
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
          {headerActionsPlacement === 'inline' ? null : (
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
          )}
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
  canViewPublished,
  isMoving,
  isPublished,
  isPublishing,
  isUnpublishing,
  onDelete,
  onMove,
  onPublish,
  onUnpublish,
  onViewPublished,
}: {
  canViewPublished: boolean;
  isMoving: boolean;
  isPublished: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
  onDelete: () => void;
  onMove: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onViewPublished: () => void;
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
          {
            title: isPublished ? 'Update published note' : 'Publish to web',
            startIcon: 'EyeOpen',
            action: onPublish,
            disabled: isPublishing,
            testID: 'NotesDetailPublishAction',
          },
          isPublished &&
            canViewPublished && {
              title: 'View published note',
              startIcon: 'Link',
              action: onViewPublished,
              testID: 'NotesDetailViewPublishedAction',
            },
        ],
        [
          'negative',
          isPublished && {
            title: 'Unpublish note',
            startIcon: 'EyeClosed',
            action: onUnpublish,
            disabled: isUnpublishing,
            testID: 'NotesDetailUnpublishAction',
          },
          {
            title: 'Delete note',
            startIcon: 'Close',
            accent: 'negative',
            action: onDelete,
            testID: 'NotesDetailDeleteAction',
          },
        ]
      ),
    [
      canViewPublished,
      isMoving,
      isPublished,
      isPublishing,
      isUnpublishing,
      onDelete,
      onMove,
      onPublish,
      onUnpublish,
      onViewPublished,
    ]
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

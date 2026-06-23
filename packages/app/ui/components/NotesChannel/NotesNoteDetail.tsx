import {
  convertContent,
  deleteNotebookNote,
  markdownToStory,
  moveNotebookNote,
  normalizeNotebookNoteTitle,
  noteIsPublished,
  publishNotebookNote,
  publishedNotePath,
  saveNotebookNote,
  unpublishNotebookNote,
  useMutableCallback,
  usePublishedNotesForNotebook,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Input, ScrollView, TextArea, XStack, YStack } from 'tamagui';

import { createActionGroups } from '../ActionSheet';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { NotebookContentRenderer } from '../NotebookPost/NotebookPost';
import {
  MetadataPill,
  MoveNoteSheet,
  NotebookGateMessage,
  NotesBanner,
  NotesMessage,
  NotesOverflowMenu,
  confirmNotesDestructiveAction,
  errorMessage,
  useEntityDialog,
  useNotebookData,
} from './NotesCommon';
import { buildFolderRows, formatNoteDate } from './notesTree';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type PublishingAction = 'publish' | 'unpublish' | null;

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
  const [publishingAction, setPublishingAction] =
    useState<PublishingAction>(null);
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
  const selectedNote =
    noteId === null
      ? null
      : notes.find((note) => note.noteId === noteId) ?? null;
  const { data: publishedNotes, refetch: refetchPublishedNotes } =
    usePublishedNotesForNotebook({
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

  const handleDeleteSelectedNote = useMutableCallback(() => {
    if (!notebookFlag || !selectedNote || !canEdit) return;
    confirmNotesDestructiveAction({
      webMessage: 'Delete this note?',
      nativeTitle: 'Delete note',
      nativeMessage: 'This note will be removed from the notebook.',
      action: () => {
        setError(null);
        void deleteNotebookNote({
          notebookFlag,
          noteId: selectedNote.noteId,
        })
          .then(() => onDeleted?.())
          .catch((e) => setError(errorMessage(e, 'Failed to delete note')));
      },
    });
  });

  const handleMoveSelectedNote = useMutableCallback(
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
    }
  );

  const togglePreview = useCallback(() => {
    setIsPreviewing((previewing) => !previewing);
  }, []);

  const publishedUrl =
    notebookFlag &&
    selectedNote &&
    Platform.OS === 'web' &&
    typeof window !== 'undefined'
      ? new URL(
          publishedNotePath(notebookFlag, selectedNote.noteId),
          window.location.origin
        ).toString()
      : null;

  const openPublishedNote = useMutableCallback(() => {
    if (!publishedUrl) return;
    window.open(publishedUrl, '_blank', 'noopener,noreferrer');
  });

  const handlePublishSelectedNote = useMutableCallback(async () => {
    if (!notebookFlag || !selectedNote || !canEdit || publishingAction) return;

    setPublishingAction('publish');
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
      setPublishingAction(null);
    }
  });

  const handleUnpublishSelectedNote = useMutableCallback(async () => {
    if (!notebookFlag || !selectedNote || !canEdit || publishingAction) return;

    setPublishingAction('unpublish');
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
      setPublishingAction(null);
    }
  });

  const headerActions = useMemo(
    () =>
      canEdit && selectedNote ? (
        <NotesDetailHeaderActions
          isMoving={isMovingNote}
          isPublished={selectedNoteIsPublished}
          publishingAction={publishingAction}
          publishedUrl={publishedUrl}
          onDelete={handleDeleteSelectedNote}
          onMove={() => openMoveDialog(selectedNote)}
          onPublish={handlePublishSelectedNote}
          onUnpublish={handleUnpublishSelectedNote}
          onViewPublished={openPublishedNote}
        />
      ) : null,
    [
      canEdit,
      handleDeleteSelectedNote,
      handlePublishSelectedNote,
      handleUnpublishSelectedNote,
      isMovingNote,
      openPublishedNote,
      openMoveDialog,
      publishingAction,
      publishedUrl,
      selectedNote,
      selectedNoteIsPublished,
    ]
  );
  useRegisterChannelHeaderItem(
    headerActionsPlacement === 'channel-header' ? headerActions : null
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
    headerActionsPlacement === 'inline' ? headerActions : null;

  return (
    <YStack flex={1} backgroundColor="$background">
      {error ? <NotesBanner message={error} tone="negative" /> : null}
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
              <NotesPreviewToggle
                isPreviewing={isPreviewing}
                onPress={togglePreview}
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
            <NotesPreviewToggle
              floating
              isPreviewing={isPreviewing}
              onPress={togglePreview}
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

function NotesPreviewToggle({
  floating = false,
  isPreviewing,
  onPress,
}: {
  floating?: boolean;
  isPreviewing: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      position={floating ? 'absolute' : undefined}
      right={floating ? '$xl' : undefined}
      bottom={floating ? 64 : undefined}
      zIndex={floating ? 100 : undefined}
      size="small"
      fill="outline"
      type="secondary"
      backgroundColor="$background"
      borderColor="$border"
      leadingIcon={isPreviewing ? 'EditList' : 'EyeOpen'}
      label={isPreviewing ? 'Edit' : 'Preview'}
      shadow={floating || undefined}
      onPress={onPress}
      testID="NotesPreviewToggle"
    />
  );
}

function NotesDetailHeaderActions({
  isMoving,
  isPublished,
  publishingAction,
  onDelete,
  onMove,
  onPublish,
  onUnpublish,
  onViewPublished,
  publishedUrl,
}: {
  isMoving: boolean;
  isPublished: boolean;
  publishingAction: PublishingAction;
  onDelete: () => void;
  onMove: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onViewPublished: () => void;
  publishedUrl: string | null;
}) {
  const groups = createActionGroups(
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
        description: isPublished ? publishedUrl ?? undefined : undefined,
        startIcon: 'EyeOpen',
        action: onPublish,
        disabled: publishingAction === 'publish',
        testID: 'NotesDetailPublishAction',
      },
      isPublished &&
        publishedUrl !== null && {
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
        disabled: publishingAction === 'unpublish',
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
  const label =
    saveState === 'saving'
      ? 'Saving'
      : saveState === 'error'
        ? 'Save failed'
        : isDirty || saveState === 'dirty'
          ? 'Unsaved'
          : saveState === 'saved'
            ? 'Saved'
            : '';

  if (!label) return null;
  return (
    <MetadataPill
      label={label}
      tone={saveState === 'error' ? 'negative' : isDirty ? 'notice' : 'neutral'}
    />
  );
}

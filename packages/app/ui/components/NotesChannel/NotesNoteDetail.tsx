import {
  convertContent,
  markdownToStory,
  normalizeNotebookNoteTitle,
  saveNotebookNote,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import {
  type ElementRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { Input, ScrollView, TextArea, XStack, YStack } from 'tamagui';

import {
  useRegisterChannelHeaderItem,
  useRegisterChannelHeaderLoadingSubtitle,
} from '../Channel/ChannelHeader';
import { NotebookContentRenderer } from '../NotebookPost/NotebookPost';
import { ScreenHeader } from '../ScreenHeader';
import {
  NotebookGateMessage,
  NotesBanner,
  NotesMessage,
  errorMessage,
  useNotebookData,
} from './NotesCommon';
import { formatNoteDate, getFolderPath } from './notesTree';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

// Long enough that we don't fire a save on every typing pause; exits are
// covered by the flush paths and the draft stash either way.
const AUTOSAVE_DEBOUNCE_MS = 10_000;
const MIN_BODY_INPUT_HEIGHT = 360;
const BODY_FONT_SIZE = 14;
const BODY_LINE_HEIGHT = 22;
const BODY_MONO_CHAR_WIDTH = BODY_FONT_SIZE * 0.62;
const SAVE_STATUS_SLOT_WIDTH = 88;

const draftStashKey = (notebookFlag: string, noteId: number) =>
  `${notebookFlag}/${noteId}`;
const notePreviewModes = new Map<string, boolean>();

function getNotePreviewModeKey(
  notebookFlag: string | null | undefined,
  noteId: number | null
) {
  if (!notebookFlag || noteId === null) return null;
  return `${notebookFlag}/${noteId}`;
}

function getStoredNotePreviewMode(key: string | null) {
  return key ? (notePreviewModes.get(key) ?? true) : true;
}

function useNotePreviewMode(
  notebookFlag: string | null | undefined,
  noteId: number | null
) {
  const key = useMemo(
    () => getNotePreviewModeKey(notebookFlag, noteId),
    [noteId, notebookFlag]
  );
  const [isPreviewing, setIsPreviewing] = useState(() =>
    getStoredNotePreviewMode(key)
  );

  useEffect(() => {
    setIsPreviewing(getStoredNotePreviewMode(key));
  }, [key]);

  const setPreviewMode = useCallback(
    (nextPreviewing: boolean) => {
      if (key) {
        notePreviewModes.set(key, nextPreviewing);
      }
      setIsPreviewing(nextPreviewing);
    },
    [key]
  );

  return [isPreviewing, setPreviewMode] as const;
}

function estimateBodyInputHeight(body: string, inputWidth: number) {
  if (!inputWidth) return MIN_BODY_INPUT_HEIGHT;

  const charsPerLine = Math.max(
    1,
    Math.floor(inputWidth / BODY_MONO_CHAR_WIDTH)
  );
  const visualLineCount = body
    .split('\n')
    .reduce(
      (count, line) =>
        count + Math.max(1, Math.ceil(line.length / charsPerLine)),
      0
    );

  return Math.max(
    MIN_BODY_INPUT_HEIGHT,
    Math.ceil(visualLineCount * BODY_LINE_HEIGHT)
  );
}

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
  autoFocusTitle = false,
  headerActionsPlacement = 'channel-header',
  noteId,
  notebookFlag,
  onTitleAutoFocused,
  syncEnabled = true,
}: {
  autoFocusTitle?: boolean;
  headerActionsPlacement?: 'channel-header' | 'inline' | 'none';
  noteId: number | null;
  notebookFlag: string | null | undefined;
  onTitleAutoFocused?: () => void;
  syncEnabled?: boolean;
}) {
  // The note snapshot the drafts are based on. Dirtiness and the save's
  // expectedRevision are computed against this, not the live row, so a row
  // update can't silently absorb or clobber unsaved edits.
  const [draftBase, setDraftBase] = useState<db.NotesNote | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [bodyInputWidth, setBodyInputWidth] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setPreviewMode] = useNotePreviewMode(
    notebookFlag,
    noteId
  );
  const titleInputRef = useRef<ElementRef<typeof Input>>(null);
  const bodyInputRef = useRef<ElementRef<typeof TextArea>>(null);

  const { folders, notes, canEdit, rootFolderId, gate } = useNotebookData(
    notebookFlag,
    { syncEnabled }
  );
  const selectedNote =
    noteId === null
      ? null
      : notes.find((note) => note.noteId === noteId) ?? null;

  const draftsMatchSelectedNote = draftBase?.id === selectedNote?.id;
  const isDirty = Boolean(
    selectedNote &&
      draftBase &&
      draftsMatchSelectedNote &&
      (normalizeNotebookNoteTitle(titleDraft) !== draftBase.title ||
        bodyDraft !== draftBase.bodyMd)
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
  const bodyInputHeight = useMemo(
    () => estimateBodyInputHeight(bodyDraft, bodyInputWidth),
    [bodyDraft, bodyInputWidth]
  );
  const folderPath = useMemo(
    () =>
      selectedNote
        ? getFolderPath(folders, selectedNote.folderId, rootFolderId)
        : null,
    [folders, rootFolderId, selectedNote]
  );
  const noteDate = selectedNote
    ? formatNoteDate(selectedNote.updatedAt ?? selectedNote.createdAt)
    : null;

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

  useEffect(() => {
    if (!autoFocusTitle || !selectedNote || !canEdit) return;
    const timeout = setTimeout(() => {
      titleInputRef.current?.focus();
      onTitleAutoFocused?.();
    });
    return () => clearTimeout(timeout);
  }, [autoFocusTitle, canEdit, onTitleAutoFocused, selectedNote?.id]);

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

  const togglePreview = useCallback(() => {
    setPreviewMode(!isPreviewing);
  }, [isPreviewing, setPreviewMode]);

  const focusBodyInput = useCallback(() => {
    bodyInputRef.current?.focus();
  }, []);

  const handleBodyInputLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const nextWidth = event.nativeEvent.layout.width;
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
      setBodyInputWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth
      );
    },
    []
  );

  const headerSaveLabel = getHeaderSaveLabel(saveState);
  const saveStatusLabel = getSaveStatusLabel(saveState);
  const headerControls = useMemo(
    () =>
      selectedNote ? (
        <XStack alignItems="center" gap="$l">
          <NotesPreviewToggle
            isPreviewing={isPreviewing}
            onPress={togglePreview}
          />
        </XStack>
      ) : null,
    [isPreviewing, selectedNote, togglePreview]
  );
  useRegisterChannelHeaderItem(
    headerActionsPlacement === 'channel-header' ? headerControls : null
  );
  useRegisterChannelHeaderLoadingSubtitle(
    headerActionsPlacement === 'channel-header' ? headerSaveLabel : null
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
    headerActionsPlacement === 'inline' ? (
      <>
        {headerControls}
      </>
    ) : null;

  return (
    <YStack flex={1} backgroundColor="$background">
      {error ? <NotesBanner message={error} tone="negative" /> : null}
      <ScrollView
        flex={1}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <YStack
          flexGrow={1}
          width="100%"
          maxWidth={760}
          marginHorizontal="auto"
        >
          <YStack
            paddingHorizontal="$xl"
            paddingTop="$l"
            paddingBottom="$l"
            gap="$l"
          >
            {folderPath || noteDate || saveStatusLabel ? (
              <XStack alignItems="center" gap="$m" minHeight={18}>
                {folderPath ? (
                  <Text
                    flex={1}
                    minWidth={0}
                    size="$label/s"
                    color="$tertiaryText"
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {folderPath}
                  </Text>
                ) : (
                  <YStack flex={1} />
                )}
                <XStack flexShrink={0} alignItems="center" gap="$s">
                  <HeaderSaveStatus label={saveStatusLabel} />
                  {saveStatusLabel && noteDate ? (
                    <YStack
                      width={3}
                      height={3}
                      borderRadius={2}
                      backgroundColor="$tertiaryText"
                      flexShrink={0}
                    />
                  ) : null}
                  {noteDate ? (
                    <Text
                      flexShrink={0}
                      size="$label/s"
                      color="$tertiaryText"
                      numberOfLines={1}
                    >
                      {noteDate}
                    </Text>
                  ) : null}
                </XStack>
              </XStack>
            ) : null}
            <XStack alignItems="center" gap="$s">
              <Input
                ref={titleInputRef}
                flex={1}
                width="100%"
                value={titleDraft}
                onChangeText={setTitleDraft}
                onSubmitEditing={focusBodyInput}
                placeholder="Untitled"
                placeholderTextColor="$tertiaryText"
                returnKeyType="next"
                blurOnSubmit={false}
                fontSize={24}
                height={34}
                minHeight={34}
                fontWeight="400"
                borderColor="transparent"
                borderWidth={0}
                backgroundColor="transparent"
                paddingHorizontal={0}
                paddingVertical={0}
                disabled={!canEdit}
              />
              {inlineActions}
            </XStack>
          </YStack>
          <YStack
            flexGrow={1}
            minHeight={MIN_BODY_INPUT_HEIGHT}
            position="relative"
          >
            {isPreviewing ? (
              <YStack
                paddingHorizontal="$xl"
                paddingTop="$l"
                paddingBottom={128}
                gap="$l"
                testID="NotesPreviewPane"
              >
                {previewState.error ? (
                  <NotesMessage
                    title="Preview unavailable"
                    subtitle={previewState.error}
                  />
                ) : previewState.content.length > 0 ? (
                  <NotebookContentRenderer
                    content={previewState.content}
                    marginHorizontal="$-l"
                    testID="NotesPreviewContent"
                  />
                ) : (
                  <Text size="$body" color="$tertiaryText">
                    Nothing to preview yet.
                  </Text>
                )}
              </YStack>
            ) : (
              <YStack
                flexGrow={1}
                minHeight={MIN_BODY_INPUT_HEIGHT}
                paddingHorizontal="$xl"
                paddingTop={0}
                paddingBottom="$xl"
                testID="NotesBodyScrollView"
              >
                <TextArea
                  ref={bodyInputRef}
                  width="100%"
                  minHeight={MIN_BODY_INPUT_HEIGHT}
                  height={bodyInputHeight}
                  value={bodyDraft}
                  onChangeText={setBodyDraft}
                  onLayout={handleBodyInputLayout}
                  placeholder="Note body"
                  placeholderTextColor="$tertiaryText"
                  fontFamily="$mono"
                  fontSize={BODY_FONT_SIZE}
                  color="$primaryText"
                  backgroundColor="$background"
                  borderWidth={0}
                  paddingHorizontal={0}
                  paddingVertical={0}
                  disabled={!canEdit}
                  rejectResponderTermination={false}
                  scrollEnabled={false}
                  textAlignVertical="top"
                  style={{ lineHeight: BODY_LINE_HEIGHT }}
                  testID="NotesBodyInput"
                />
              </YStack>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function NotesPreviewToggle({
  isPreviewing,
  onPress,
}: {
  isPreviewing: boolean;
  onPress: () => void;
}) {
  const label = isPreviewing ? 'Edit' : 'Preview';
  return (
    <ScreenHeader.TextButton
      color="$primaryText"
      onPress={onPress}
      testID="NotesPreviewToggle"
    >
      {label}
    </ScreenHeader.TextButton>
  );
}

function getHeaderSaveLabel(saveState: SaveState) {
  if (saveState === 'saving') return 'Syncing...';
  return null;
}

function getSaveStatusLabel(saveState: SaveState) {
  if (saveState === 'dirty' || saveState === 'error') return 'Not synced';
  if (saveState === 'saving') return 'Syncing...';
  return 'Synced';
}

function HeaderSaveStatus({ label }: { label: string | null }) {
  return (
    <XStack
      width={SAVE_STATUS_SLOT_WIDTH}
      flexShrink={0}
      justifyContent="flex-end"
    >
      {label ? (
        <Text
          size="$label/s"
          color="$tertiaryText"
          letterSpacing={0}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </XStack>
  );
}

import {
  NotesNoteConflictError,
  adoptNotebookNoteRemote,
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import {
  Input,
  ScrollView,
  TextArea,
  XStack,
  YStack,
  getTokenValue,
  isWeb,
} from 'tamagui';

import {
  useRegisterChannelHeaderItem,
  useRegisterChannelHeaderLoadingSubtitle,
} from '../Channel/ChannelHeader';
import { TextInput, type TextInputRef } from '../Form';
import { NotebookContentRenderer } from '../NotebookPost/NotebookPost';
import { ScreenHeader } from '../ScreenHeader';
import {
  NotebookGateMessage,
  NotesMessage,
  useNotebookData,
} from './NotesData';
import { NotesBanner, errorMessage } from './NotesFeedback';
import { trackNotesActionError } from './notesTelemetry';
import { formatNoteDate, getFolderPath } from './notesTree';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

// Long enough that we don't fire a save on every typing pause; exits are
// covered by the flush paths and the draft stash either way.
const AUTOSAVE_DEBOUNCE_MS = 10_000;
const MIN_BODY_INPUT_HEIGHT = 360;
const NOTE_COLUMN_MAX_WIDTH = 760;
const BODY_FONT_SIZE = 14;
const BODY_LINE_HEIGHT = 22;
const BODY_MONO_CHAR_WIDTH = BODY_FONT_SIZE * 0.62;
const SAVE_STATUS_SLOT_WIDTH = 88;
const DRAFT_SNAPSHOT_TTL_MS = 120_000;

export type NotesNoteDraftSnapshot = {
  notebookFlag: string;
  noteId: number;
  title: string;
  body: string;
  isDirty: boolean;
  updatedAt: number;
};

const draftStashKey = (notebookFlag: string, noteId: number) =>
  `${notebookFlag}/${noteId}`;
const draftSnapshotKey = (notebookFlag: string, noteId: number) =>
  `${notebookFlag}/${noteId}`;
const notePreviewModes = new Map<string, boolean>();
const notesNoteDraftSnapshots = new Map<string, NotesNoteDraftSnapshot>();

function rememberNotesNoteDraftSnapshot(snapshot: NotesNoteDraftSnapshot) {
  notesNoteDraftSnapshots.set(
    draftSnapshotKey(snapshot.notebookFlag, snapshot.noteId),
    snapshot
  );
}

function clearNotesNoteDraftSnapshot(notebookFlag: string, noteId: number) {
  notesNoteDraftSnapshots.delete(draftSnapshotKey(notebookFlag, noteId));
}

function clearMatchingNotesNoteDraftSnapshot({
  notebookFlag,
  noteId,
  title,
  body,
}: {
  notebookFlag: string;
  noteId: number;
  title: string;
  body: string;
}) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  const snapshot = notesNoteDraftSnapshots.get(key);
  if (!snapshot || snapshot.title !== title || snapshot.body !== body) {
    return;
  }

  notesNoteDraftSnapshots.delete(key);
}

export function getNotesNoteDraftSnapshot(
  notebookFlag: string,
  noteId: number
) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  const snapshot = notesNoteDraftSnapshots.get(key);
  if (!snapshot) return null;
  if (Date.now() - snapshot.updatedAt > DRAFT_SNAPSHOT_TTL_MS) {
    notesNoteDraftSnapshots.delete(key);
    return null;
  }
  return snapshot;
}

function getNotePreviewModeKey(
  notebookFlag: string | null | undefined,
  noteId: number | null
) {
  if (!notebookFlag || noteId === null) return null;
  return `${notebookFlag}/${noteId}`;
}

function getStoredNotePreviewMode(key: string | null) {
  return key ? notePreviewModes.get(key) ?? true : true;
}

function useNotePreviewMode(
  notebookFlag: string | null | undefined,
  noteId: number | null,
  startInEdit = false
) {
  const key = useMemo(
    () => getNotePreviewModeKey(notebookFlag, noteId),
    [noteId, notebookFlag]
  );
  const [isPreviewing, setIsPreviewing] = useState(() =>
    startInEdit ? false : getStoredNotePreviewMode(key)
  );

  useEffect(() => {
    if (startInEdit && key && !notePreviewModes.has(key)) {
      notePreviewModes.set(key, false);
      setIsPreviewing(false);
      return;
    }

    setIsPreviewing(getStoredNotePreviewMode(key));
  }, [key, startInEdit]);

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
  onDraftChange,
  onTitleAutoFocused,
  startInEdit = false,
  syncEnabled = true,
}: {
  autoFocusTitle?: boolean;
  headerActionsPlacement?: 'channel-header' | 'inline' | 'none';
  noteId: number | null;
  notebookFlag: string | null | undefined;
  onDraftChange?: (draft: NotesNoteDraftSnapshot | null) => void;
  onTitleAutoFocused?: () => void;
  startInEdit?: boolean;
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
  // The host's copy of the note after a save hit a genuine revision
  // conflict. While set, autosave is suspended and the banner offers the
  // user the resolution (keep mine / use theirs) — a blind retry can never
  // succeed since the editor's base revision is stale by definition.
  const [conflictNote, setConflictNote] = useState<
    NotesNoteConflictError['remoteNote'] | null
  >(null);
  const [isPreviewing, setPreviewMode] = useNotePreviewMode(
    notebookFlag,
    noteId,
    startInEdit
  );
  const titleDraftRef = useRef(titleDraft);
  const bodyDraftRef = useRef(bodyDraft);
  const titleInputRef = useRef<TextInputRef>(null);
  const bodyInputRef = useRef<ElementRef<typeof TextArea>>(null);
  const scrollViewRef = useRef<ElementRef<typeof ScrollView>>(null);
  const scrollOffsetYRef = useRef(0);
  const lastUserScrollOffsetYRef = useRef(0);
  const userIsScrollingRef = useRef(false);
  const pendingScrollRestoreYRef = useRef<number | null>(null);

  const { folders, notes, canEdit, rootFolderId, gate } = useNotebookData(
    notebookFlag,
    { syncEnabled }
  );
  const selectedNote =
    noteId === null
      ? null
      : notes.find((note) => note.noteId === noteId) ?? null;
  const selectedNoteRowId = selectedNote?.id ?? null;

  const draftsMatchSelectedNote = draftBase?.id === selectedNote?.id;
  const isDirty = Boolean(
    selectedNote &&
      draftBase &&
      draftsMatchSelectedNote &&
      (normalizeNotebookNoteTitle(titleDraft) !== draftBase.title ||
        bodyDraft !== draftBase.bodyMd)
  );
  const previewState = useMemo(() => {
    // Markdown conversion is too expensive to run per keystroke; only
    // compute it when the preview pane is actually visible.
    if (!isPreviewing) {
      return { content: [], error: null };
    }
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
  }, [bodyDraft, isPreviewing]);
  // On web the editor pane is pinned to the viewport and the textarea
  // scrolls its own content, so the body input spans the full pane and
  // fakes the centered note column with horizontal padding. Native keeps
  // the grow-to-content textarea inside the page scroll.
  const useWebEditorPane = isWeb && !isPreviewing;
  const bodyInputHeight = useMemo(
    () =>
      useWebEditorPane ? 0 : estimateBodyInputHeight(bodyDraft, bodyInputWidth),
    [bodyDraft, bodyInputWidth, useWebEditorPane]
  );
  const bodyEditorPadding = useMemo(() => {
    const basePadding = getTokenValue('$xl', 'space');
    if (!bodyInputWidth) return basePadding;
    return (
      Math.max((bodyInputWidth - NOTE_COLUMN_MAX_WIDTH) / 2, 0) + basePadding
    );
  }, [bodyInputWidth]);
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
  // Passive on purpose: programmatic draft updates (note switch, stash
  // restore) must reach these refs in the same commit as their new draft
  // base, or an out-of-band flush could pair one note's base with another
  // note's drafts. Keystrokes also update the refs synchronously in the
  // change handlers so a flush can't miss a just-typed edit.
  useEffect(() => {
    titleDraftRef.current = titleDraft;
  }, [titleDraft]);
  useEffect(() => {
    bodyDraftRef.current = bodyDraft;
  }, [bodyDraft]);

  useEffect(() => {
    return () => onDraftChange?.(null);
  }, [onDraftChange]);

  const publishDraftSnapshot = useCallback(
    (body: string) => {
      if (
        !notebookFlag ||
        !selectedNote ||
        !draftBase ||
        !draftsMatchSelectedNote
      ) {
        if (notebookFlag && selectedNote) {
          clearNotesNoteDraftSnapshot(notebookFlag, selectedNote.noteId);
        }
        onDraftChange?.(null);
        return;
      }

      const dirty =
        normalizeNotebookNoteTitle(titleDraft) !== draftBase.title ||
        body !== draftBase.bodyMd;
      const snapshot: NotesNoteDraftSnapshot = {
        notebookFlag,
        noteId: selectedNote.noteId,
        title: titleDraft,
        body,
        isDirty: dirty,
        updatedAt: Date.now(),
      };

      if (dirty) {
        rememberNotesNoteDraftSnapshot(snapshot);
      } else {
        clearNotesNoteDraftSnapshot(notebookFlag, selectedNote.noteId);
      }
      onDraftChange?.(snapshot);
    },
    [
      draftBase,
      draftsMatchSelectedNote,
      notebookFlag,
      onDraftChange,
      selectedNote,
      titleDraft,
    ]
  );

  useEffect(() => {
    if (!onDraftChange && !notebookFlag) return;
    if (!selectedNote || !draftsMatchSelectedNote) {
      onDraftChange?.(null);
      return;
    }

    publishDraftSnapshot(bodyDraft);
  }, [
    bodyDraft,
    draftsMatchSelectedNote,
    notebookFlag,
    onDraftChange,
    publishDraftSnapshot,
    selectedNote,
  ]);

  const preserveScrollOffset = useCallback(() => {
    if (isPreviewing) return;
    pendingScrollRestoreYRef.current = Math.max(
      scrollOffsetYRef.current,
      lastUserScrollOffsetYRef.current
    );
  }, [isPreviewing]);

  useLayoutEffect(() => {
    const restoreY = pendingScrollRestoreYRef.current;
    if (restoreY === null || isPreviewing) return;

    pendingScrollRestoreYRef.current = null;
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: restoreY, animated: false });
    });
  }, [bodyDraft, bodyInputHeight, draftBase, isPreviewing, saveState]);

  // Load drafts when the selection changes. While the same note stays
  // selected, adopt row updates only when the editor is clean: the synced
  // echo of our own save must not overwrite keystrokes typed while the save
  // was in flight. A remote edit that lands while dirty keeps the stale base
  // revision, so the next save fails the revision check instead of silently
  // overwriting the remote work.
  useEffect(() => {
    const sameNote = (selectedNote?.id ?? null) === (draftBase?.id ?? null);
    // Never adopt a row that trails the base's revision: right after a save
    // or a conflict resolution the reactive row lags the persisted write by
    // a render or two, and reloading it would regress the editor onto stale
    // content and a stale revision.
    const rowTrailsBase =
      sameNote &&
      selectedNote != null &&
      draftBase != null &&
      selectedNote.revision < draftBase.revision;
    if (sameNote && (isDirty || selectedNote === draftBase || rowTrailsBase)) {
      return;
    }
    if (sameNote) {
      preserveScrollOffset();
    }
    setDraftBase(selectedNote ?? null);
    setTitleDraft(selectedNote?.title ?? '');
    setBodyDraft(selectedNote?.bodyMd ?? '');
    if (!sameNote) {
      setSaveState('idle');
      setError(null);
      setConflictNote(null);
    }
  }, [draftBase, isDirty, preserveScrollOffset, selectedNote]);

  useEffect(() => {
    if (!autoFocusTitle || !selectedNoteRowId || !canEdit) return;
    if (isPreviewing) {
      // The title is a locked display field in preview mode, so renaming
      // needs the editor. Leaving preview re-runs this effect with the
      // editable input mounted, and the focus below can land.
      setPreviewMode(false);
      return;
    }
    const timeout = setTimeout(() => {
      titleInputRef.current?.focus();
      onTitleAutoFocused?.();
    });
    return () => clearTimeout(timeout);
  }, [
    autoFocusTitle,
    canEdit,
    isPreviewing,
    onTitleAutoFocused,
    selectedNoteRowId,
    setPreviewMode,
  ]);

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

  // Save target for flushes that run outside the React data flow (unmount
  // cleanup, AppState changes). Synced in an effect so a selection-change
  // cleanup still sees the previous note as its base rather than the new
  // render's; the draft refs lag in step, keeping base and drafts paired.
  const flushCtxRef = useRef<{
    flag: string | null | undefined;
    base: db.NotesNote | null;
    canEdit: boolean;
  } | null>(null);
  useEffect(() => {
    flushCtxRef.current = {
      flag: notebookFlag,
      base: draftBase,
      canEdit,
    };
  });

  // A conflict from an async save is only actionable while its note is
  // still the one in the editor. A note-switch flush can reject after the
  // selection moved on; resolving that stale conflict would rebase the
  // newly-selected note with the old note's content, so drop it instead.
  const reportConflict = useCallback(
    (flag: string, conflict: NotesNoteConflictError) => {
      const ctx = flushCtxRef.current;
      if (
        !ctx ||
        ctx.flag !== flag ||
        ctx.base?.noteId !== conflict.remoteNote.noteId
      ) {
        return;
      }
      setConflictNote(conflict.remoteNote);
      setError(conflict.message);
      setSaveState('error');
    },
    []
  );

  // Counterpart to reportConflict: a save that SUCCEEDS for the current
  // note supersedes any conflict still showing. The save chain is FIFO, so
  // a stale queued save (e.g. a background flush from before a "Keep mine"
  // resolution) can reject and re-arm the banner after the resolution
  // cleared it; without this, the banner sticks and autosave stays
  // suspended even though the rebased save landed.
  const clearConflict = useCallback((flag: string, noteId: number) => {
    const ctx = flushCtxRef.current;
    if (!ctx || ctx.flag !== flag || ctx.base?.noteId !== noteId) {
      return;
    }
    setConflictNote(null);
    setError(null);
  }, []);

  const saveSelectedNote = useCallback(
    async (baseOverride?: db.NotesNote) => {
      const base = baseOverride ?? draftBase;
      if (!notebookFlag || !base || !canEdit) return false;
      const bodyToSave = bodyDraftRef.current;
      const dirty =
        normalizeNotebookNoteTitle(titleDraft) !== base.title ||
        bodyToSave !== base.bodyMd;
      if (!dirty) return true;
      preserveScrollOffset();
      setSaveState('saving');
      setError(null);
      rememberNotesNoteDraftSnapshot({
        notebookFlag,
        noteId: base.noteId,
        title: titleDraft,
        body: bodyToSave,
        isDirty: true,
        updatedAt: Date.now(),
      });
      try {
        const updated = await runSave(
          notebookFlag,
          base,
          titleDraft,
          bodyToSave
        );
        // Rebase onto the saved revision; keystrokes typed during the save
        // leave the drafts dirty against it, so the next cycle saves them.
        if (updated) {
          setDraftBase(updated);
        }
        clearDraftStash(notebookFlag, base.noteId, {
          title: titleDraft,
          body: bodyToSave,
        });
        clearMatchingNotesNoteDraftSnapshot({
          notebookFlag,
          noteId: base.noteId,
          title: titleDraft,
          body: bodyToSave,
        });
        setSaveState('saved');
        clearConflict(notebookFlag, base.noteId);
        return true;
      } catch (e) {
        const message = errorMessage(e, 'Failed to save note');
        trackNotesActionError('save note', e, message, {
          noteId: base.noteId,
        });
        if (e instanceof NotesNoteConflictError) {
          reportConflict(notebookFlag, e);
          return false;
        }
        // Only surface the failure while its note is still in the editor —
        // an autosave that rejects after the user switched notes must not
        // mark the newly-selected note as failed. (reportConflict applies
        // the same guard for conflicts.)
        const ctx = flushCtxRef.current;
        if (ctx?.flag === notebookFlag && ctx.base?.noteId === base.noteId) {
          setSaveState('error');
          setError(message);
        }
        return false;
      }
    },
    [
      canEdit,
      clearConflict,
      draftBase,
      notebookFlag,
      preserveScrollOffset,
      reportConflict,
      runSave,
      titleDraft,
    ]
  );

  // Genuine conflict resolution, mirroring the ship-served notes app: the
  // user picks a side. "Keep mine" rebases the editor's base onto the
  // host's copy (so the next save asserts the host revision) and saves the
  // drafts over it; "Use theirs" adopts the host's copy and discards the
  // local drafts.
  const rebaseDraftOnConflict = useCallback(
    (base: db.NotesNote, remote: NotesNoteConflictError['remoteNote']) => ({
      ...base,
      title: remote.title ?? base.title,
      bodyMd: remote.bodyMd ?? base.bodyMd,
      folderId: remote.folderId ?? base.folderId,
      revision: remote.revision ?? base.revision,
      updatedAt: remote.updatedAt ?? base.updatedAt,
      updatedBy: remote.updatedBy ?? base.updatedBy,
    }),
    []
  );

  const resolveConflictKeepMine = useCallback(() => {
    if (!conflictNote || !draftBase) return;
    const rebased = rebaseDraftOnConflict(draftBase, conflictNote);
    setConflictNote(null);
    setError(null);
    setDraftBase(rebased);
    void saveSelectedNote(rebased);
  }, [conflictNote, draftBase, rebaseDraftOnConflict, saveSelectedNote]);

  const resolveConflictUseTheirs = useCallback(() => {
    if (!conflictNote || !draftBase || !notebookFlag) return;
    const adopted = rebaseDraftOnConflict(draftBase, conflictNote);
    const discardedBody = bodyDraftRef.current;
    setConflictNote(null);
    setError(null);
    setDraftBase(adopted);
    setTitleDraft(adopted.title);
    setBodyDraft(adopted.bodyMd);
    // Sync the out-of-band flush inputs in the same tick. The draft refs
    // and flush context normally catch up in post-commit effects; a
    // background/unmount flush firing inside that gap would pair the
    // discarded drafts with the pre-adoption base and queue a save of the
    // very content the user just chose to throw away.
    titleDraftRef.current = adopted.title;
    bodyDraftRef.current = adopted.bodyMd;
    flushCtxRef.current = { flag: notebookFlag, base: adopted, canEdit };
    // Persist the host's copy locally so the reactive row catches up with
    // the adoption instead of reloading the stale pre-conflict content
    // over it. (The draft-loading effect also skips rows that trail the
    // base revision, covering the render gap until this write lands.)
    void adoptNotebookNoteRemote({ notebookFlag, remote: conflictNote });
    // Drop the crash-insurance stashes for the discarded drafts, or the
    // restore effect would resurrect them against the adopted revision.
    clearDraftStash(notebookFlag, draftBase.noteId, {
      title: titleDraft,
      body: discardedBody,
    });
    clearMatchingNotesNoteDraftSnapshot({
      notebookFlag,
      noteId: draftBase.noteId,
      title: titleDraft,
      body: discardedBody,
    });
    setSaveState('idle');
  }, [
    canEdit,
    conflictNote,
    draftBase,
    notebookFlag,
    rebaseDraftOnConflict,
    titleDraft,
  ]);

  useEffect(() => {
    // A pending conflict suspends autosave: retrying against a stale base
    // can never succeed, and the user hasn't picked a side yet.
    if (!canEdit || saveState === 'saving' || conflictNote) return;
    if (!isDirty) {
      // Edits were reverted back to the saved content; there's nothing to
      // save, so don't leave a stale "Not synced" showing.
      if (saveState === 'dirty') {
        setSaveState('idle');
      }
      return;
    }
    setSaveState('dirty');
    const timeout = setTimeout(() => {
      saveSelectedNote();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [canEdit, conflictNote, isDirty, saveSelectedNote, saveState]);

  const flushPendingSave = useCallback(() => {
    const bodyToSave = bodyDraftRef.current;
    const titleToSave = titleDraftRef.current;
    const ctx = flushCtxRef.current;
    if (!ctx || !ctx.flag || !ctx.base || !ctx.canEdit) return;
    const dirty =
      normalizeNotebookNoteTitle(titleToSave) !== ctx.base.title ||
      bodyToSave !== ctx.base.bodyMd;
    if (!dirty) return;
    const { flag, base } = ctx;
    preserveScrollOffset();
    rememberNotesNoteDraftSnapshot({
      notebookFlag: flag,
      noteId: base.noteId,
      title: titleToSave,
      body: bodyToSave,
      isDirty: true,
      updatedAt: Date.now(),
    });
    runSave(flag, base, titleToSave, bodyToSave)
      .then((updated) => {
        clearDraftStash(flag, base.noteId, {
          title: titleToSave,
          body: bodyToSave,
        });
        clearMatchingNotesNoteDraftSnapshot({
          notebookFlag: flag,
          noteId: base.noteId,
          title: titleToSave,
          body: bodyToSave,
        });
        // No-ops after unmount; while mounted (background flush) rebase so
        // the next cycle doesn't re-send a stale revision.
        if (updated) {
          setDraftBase(updated);
        }
        setSaveState('saved');
        clearConflict(flag, base.noteId);
      })
      .catch((e) => {
        // No-ops after unmount; while mounted, surface a conflict so the
        // resolution banner appears instead of a silently-failed flush.
        // reportConflict drops it if the selection has since moved on.
        if (e instanceof NotesNoteConflictError) {
          reportConflict(flag, e);
        }
      });
  }, [clearConflict, preserveScrollOffset, reportConflict, runSave]);

  // Flush unsaved work when switching notes or unmounting — the poke
  // outlives the component.
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

  // Guard so the stash restore below runs once per loaded note revision.
  // Without it, any edit that brings the content back to the saved state
  // (type a char, then delete it) flips the editor clean again and the
  // restore effect re-applies the stash — resurrecting the deleted edit
  // and destroying the caret position.
  const stashRestoreCheckedRef = useRef<string | null>(null);
  const stashRestoreKey =
    notebookFlag && draftBase
      ? `${draftStashKey(notebookFlag, draftBase.noteId)}/${draftBase.revision}`
      : null;

  // Stash drafts as crash insurance between autosave cycles. Stashes are
  // cleared by the save paths above once their content lands, or — once the
  // restore pass has run — when the editor returns to a clean state, which
  // means the user reverted the stashed edits themselves. A fresh mount is
  // clean too, but its restore pass hasn't run yet, so its stash survives.
  useEffect(() => {
    if (!notebookFlag || !draftBase) return;
    if (!isDirty) {
      if (stashRestoreCheckedRef.current === stashRestoreKey) {
        clearDraftStash(notebookFlag, draftBase.noteId);
      }
      return;
    }
    void db.notesNoteDrafts.setValue((stashes) => ({
      ...stashes,
      [draftStashKey(notebookFlag, draftBase.noteId)]: {
        title: titleDraft,
        body: bodyDraft,
        baseRevision: draftBase.revision,
        stashedAt: Date.now(),
      },
    }));
  }, [
    bodyDraft,
    draftBase,
    isDirty,
    notebookFlag,
    stashRestoreKey,
    titleDraft,
  ]);

  // Restore a stashed draft after a crash/kill. Only restore while the
  // editor is clean and the row is still at the stash's base revision —
  // then pushing the restored draft can't clobber anyone's newer work. A
  // stash from an older revision is superseded; drop it.
  useEffect(() => {
    if (!notebookFlag || !draftBase || isDirty || !stashRestoreKey) return;
    if (stashRestoreCheckedRef.current === stashRestoreKey) return;
    stashRestoreCheckedRef.current = stashRestoreKey;
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
  }, [draftBase, isDirty, notebookFlag, stashRestoreKey]);

  const togglePreview = useCallback(() => {
    setPreviewMode(!isPreviewing);
  }, [isPreviewing, setPreviewMode]);

  const focusBodyInput = useCallback(() => {
    bodyInputRef.current?.focus();
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetYRef.current = nextOffsetY;
      if (nextOffsetY > lastUserScrollOffsetYRef.current) {
        lastUserScrollOffsetYRef.current = nextOffsetY;
      }
      if (userIsScrollingRef.current) {
        lastUserScrollOffsetYRef.current = nextOffsetY;
      }
    },
    []
  );

  const handleScrollBeginDrag = useCallback(() => {
    userIsScrollingRef.current = true;
  }, []);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetYRef.current = nextOffsetY;
      lastUserScrollOffsetYRef.current = nextOffsetY;
      userIsScrollingRef.current = false;
    },
    []
  );

  const handleTitleDraftChange = useCallback((nextTitle: string) => {
    titleDraftRef.current = nextTitle;
    setTitleDraft(nextTitle);
  }, []);

  // The body input is controlled, so the state update must be synchronous:
  // deferring it makes React revert the DOM to the stale draft after each
  // keystroke, which destroys the caret position.
  const handleBodyDraftChange = useCallback(
    (nextBody: string) => {
      if (bodyDraftRef.current === nextBody) {
        return;
      }
      preserveScrollOffset();
      bodyDraftRef.current = nextBody;
      setBodyDraft(nextBody);
    },
    [preserveScrollOffset]
  );

  const handleBodyInputFocus = useCallback(() => {
    preserveScrollOffset();
  }, [preserveScrollOffset]);

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
    headerActionsPlacement === 'inline' ? <>{headerControls}</> : null;

  return (
    <YStack flex={1} backgroundColor="$background">
      {error ? (
        <NotesBanner
          message={error}
          tone="negative"
          actions={
            conflictNote
              ? [
                  { label: 'Keep mine', onPress: resolveConflictKeepMine },
                  { label: 'Use theirs', onPress: resolveConflictUseTheirs },
                ]
              : undefined
          }
        />
      ) : null}
      <ScrollView
        ref={scrollViewRef}
        flex={1}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!useWebEditorPane}
        contentContainerStyle={
          useWebEditorPane ? { flexGrow: 1, height: '100%' } : { flexGrow: 1 }
        }
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        testID="NotesDetailScrollView"
      >
        <YStack
          flexGrow={1}
          width="100%"
          maxWidth={useWebEditorPane ? undefined : NOTE_COLUMN_MAX_WIDTH}
          marginHorizontal="auto"
        >
          <YStack
            paddingHorizontal="$xl"
            paddingTop="$l"
            paddingBottom="$l"
            gap="$l"
            width="100%"
            maxWidth={NOTE_COLUMN_MAX_WIDTH}
            marginHorizontal="auto"
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
              {isPreviewing ? (
                <Input
                  flex={1}
                  width="100%"
                  value={titleDraft}
                  placeholder="Untitled"
                  placeholderTextColor="$tertiaryText"
                  fontSize={24}
                  height={34}
                  minHeight={34}
                  fontWeight="400"
                  borderColor="transparent"
                  borderWidth={0}
                  backgroundColor="transparent"
                  paddingHorizontal={0}
                  paddingVertical={0}
                  disabled
                  testID="NotesTitleDisplay"
                />
              ) : (
                <TextInput
                  ref={titleInputRef}
                  value={titleDraft}
                  onChangeText={handleTitleDraftChange}
                  onSubmitEditing={focusBodyInput}
                  placeholder="Untitled"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  editable={canEdit}
                  frameStyle={{
                    flex: 1,
                    // Bleed the frame left by its own padding + border so
                    // the text inside aligns with the note text column.
                    marginLeft: -(getTokenValue('$xl', 'space') + 1),
                  }}
                  testID="NotesTitleInput"
                />
              )}
              {inlineActions}
            </XStack>
          </YStack>
          <YStack
            flexGrow={1}
            minHeight={useWebEditorPane ? 0 : MIN_BODY_INPUT_HEIGHT}
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
                minHeight={useWebEditorPane ? 0 : MIN_BODY_INPUT_HEIGHT}
                paddingHorizontal={useWebEditorPane ? 0 : '$xl'}
                paddingTop={0}
                paddingBottom={useWebEditorPane ? 0 : '$xl'}
                testID="NotesBodyScrollView"
              >
                <TextArea
                  ref={bodyInputRef}
                  width="100%"
                  flex={useWebEditorPane ? 1 : undefined}
                  minHeight={useWebEditorPane ? 0 : MIN_BODY_INPUT_HEIGHT}
                  height={useWebEditorPane ? undefined : bodyInputHeight}
                  value={bodyDraft}
                  onChangeText={handleBodyDraftChange}
                  onFocus={handleBodyInputFocus}
                  onLayout={handleBodyInputLayout}
                  placeholder="Note body"
                  placeholderTextColor="$tertiaryText"
                  fontFamily="$mono"
                  fontSize={BODY_FONT_SIZE}
                  color="$primaryText"
                  backgroundColor="$background"
                  borderWidth={0}
                  paddingLeft={useWebEditorPane ? bodyEditorPadding : 0}
                  paddingRight={
                    useWebEditorPane
                      ? bodyEditorPadding + getTokenValue('$l', 'space')
                      : 0
                  }
                  paddingTop={0}
                  paddingBottom={useWebEditorPane ? '$xl' : 0}
                  disabled={!canEdit}
                  rejectResponderTermination={false}
                  scrollEnabled={useWebEditorPane}
                  textAlignVertical="top"
                  focusVisibleStyle={{ outlineWidth: 0 }}
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

import * as api from '@tloncorp/api';
import {
  AnalyticsEvent,
  NotesNoteConflictError,
  adoptNotebookNoteRemote,
  convertContent,
  markNoteRead,
  markdownToStory,
  normalizeNotebookNoteTitle,
  saveNotebookNote,
  trackEvent,
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
  useSyncExternalStore,
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
  baseRevision: number;
  baseTitle: string;
  baseBody: string;
  title: string;
  body: string;
  isDirty: boolean;
  updatedAt: number;
};

type NotesNoteDraftOwner = object;

const draftStashKey = (notebookFlag: string, noteId: number) =>
  `${notebookFlag}/${noteId}`;
const draftSnapshotKey = (notebookFlag: string, noteId: number) =>
  `${notebookFlag}/${noteId}`;
const notePreviewModes = new Map<string, boolean>();
const notesNoteDraftSnapshots = new Map<string, NotesNoteDraftSnapshot>();
const notesNoteDraftSnapshotOwners = new Map<string, NotesNoteDraftOwner>();
const notesNoteDraftStashOwners = new Map<string, NotesNoteDraftOwner>();
const notesNoteSaveChains = new Map<string, Promise<db.NotesNote | null>>();
const pendingNotesNoteSaveCounts = new Map<string, number>();
const pendingNotesNoteSaveListeners = new Set<() => void>();
let pendingNotesNoteSaveEpoch = 0;

function emitPendingNotesNoteSaveChange() {
  pendingNotesNoteSaveEpoch += 1;
  pendingNotesNoteSaveListeners.forEach((listener) => listener());
}

function subscribeToPendingNotesNoteSaves(listener: () => void) {
  pendingNotesNoteSaveListeners.add(listener);
  return () => pendingNotesNoteSaveListeners.delete(listener);
}

function getPendingNotesNoteSaveEpoch() {
  return pendingNotesNoteSaveEpoch;
}

function hasPendingNotesNoteSave(notebookFlag: string, noteId: number) {
  return (
    (pendingNotesNoteSaveCounts.get(draftSnapshotKey(notebookFlag, noteId)) ??
      0) > 0
  );
}

function markPendingNotesNoteSave(notebookFlag: string, noteId: number) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  pendingNotesNoteSaveCounts.set(
    key,
    (pendingNotesNoteSaveCounts.get(key) ?? 0) + 1
  );
  emitPendingNotesNoteSaveChange();
}

function finishPendingNotesNoteSave(notebookFlag: string, noteId: number) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  const snapshot = notesNoteDraftSnapshots.get(key);
  if (snapshot) {
    notesNoteDraftSnapshots.set(key, { ...snapshot, updatedAt: Date.now() });
  }
  const remaining = (pendingNotesNoteSaveCounts.get(key) ?? 1) - 1;
  if (remaining > 0) {
    pendingNotesNoteSaveCounts.set(key, remaining);
  } else {
    pendingNotesNoteSaveCounts.delete(key);
  }
  emitPendingNotesNoteSaveChange();
}

function rememberNotesNoteDraftSnapshot(
  snapshot: NotesNoteDraftSnapshot,
  owner: NotesNoteDraftOwner
) {
  const key = draftSnapshotKey(snapshot.notebookFlag, snapshot.noteId);
  const existing = notesNoteDraftSnapshots.get(key);
  if (
    !snapshot.isDirty &&
    existing &&
    notesNoteDraftSnapshotOwners.get(key) !== owner
  ) {
    return;
  }
  notesNoteDraftSnapshots.set(key, snapshot);
  notesNoteDraftSnapshotOwners.set(key, owner);
}

function claimNotesNoteDraftRecovery(
  notebookFlag: string,
  noteId: number,
  owner: NotesNoteDraftOwner
) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  notesNoteDraftSnapshotOwners.set(key, owner);
  notesNoteDraftStashOwners.set(key, owner);
}

function clearNotesNoteDraftSnapshot(
  notebookFlag: string,
  noteId: number,
  owner?: NotesNoteDraftOwner
) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  if (owner && notesNoteDraftSnapshotOwners.get(key) !== owner) return;
  notesNoteDraftSnapshots.delete(key);
  notesNoteDraftSnapshotOwners.delete(key);
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
  notesNoteDraftSnapshotOwners.delete(key);
}

function rebaseNotesNoteDraftSnapshot(
  notebookFlag: string,
  noteId: number,
  base: db.NotesNote,
  savedTitle: string,
  updated: db.NotesNote
) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  const snapshot = notesNoteDraftSnapshots.get(key);
  if (!snapshot) return;

  notesNoteDraftSnapshots.set(key, {
    ...snapshot,
    baseRevision: updated.revision,
    baseTitle: updated.title,
    baseBody: updated.bodyMd,
    title:
      normalizeNotebookNoteTitle(savedTitle) === base.title &&
      normalizeNotebookNoteTitle(snapshot.title) === base.title
        ? updated.title
        : snapshot.title,
    updatedAt: Date.now(),
  });
}

export function getNotesNoteDraftSnapshot(
  notebookFlag: string,
  noteId: number
) {
  const key = draftSnapshotKey(notebookFlag, noteId);
  const snapshot = notesNoteDraftSnapshots.get(key);
  if (!snapshot) return null;
  if (
    !hasPendingNotesNoteSave(notebookFlag, noteId) &&
    Date.now() - snapshot.updatedAt > DRAFT_SNAPSHOT_TTL_MS
  ) {
    notesNoteDraftSnapshots.delete(key);
    notesNoteDraftSnapshotOwners.delete(key);
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
  ifMatches?: { title: string; body: string },
  owner?: NotesNoteDraftOwner
) {
  void db.notesNoteDrafts.setValue((stashes) => {
    const key = draftStashKey(notebookFlag, noteId);
    const stash = stashes[key];
    if (!stash) return stashes;
    if (owner && notesNoteDraftStashOwners.get(key) !== owner) return stashes;
    if (
      ifMatches &&
      (stash.title !== ifMatches.title || stash.body !== ifMatches.body)
    ) {
      return stashes;
    }
    const next = { ...stashes };
    delete next[key];
    notesNoteDraftStashOwners.delete(key);
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
  useSyncExternalStore(
    subscribeToPendingNotesNoteSaves,
    getPendingNotesNoteSaveEpoch,
    getPendingNotesNoteSaveEpoch
  );
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
  const selectedNoteKey =
    notebookFlag && noteId !== null
      ? draftSnapshotKey(notebookFlag, noteId)
      : null;
  const selectedNoteKeyRef = useRef(selectedNoteKey);
  const draftOwnerRef = useRef<NotesNoteDraftOwner>({});
  useLayoutEffect(() => {
    if (selectedNoteKeyRef.current === selectedNoteKey) return;
    selectedNoteKeyRef.current = selectedNoteKey;
  }, [selectedNoteKey]);
  const titleInputRef = useRef<TextInputRef>(null);
  const autoFocusedTitleNoteIdRef = useRef<string | null>(null);
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
  // Every path that displays a note lands here (desktop split pane, mobile
  // detail screen, deep links), so this is the single mark-read hook point.
  // markNoteRead no-ops until the backend's notes capability resolves, so
  // rerun when the capability epoch changes (e.g. a note opened from cache
  // during startup, before app-info sync).
  const activityCapabilitiesEpoch = useSyncExternalStore(
    api.onActivityCapabilitiesChange,
    api.getActivityCapabilitiesEpoch
  );
  useEffect(() => {
    if (!notebookFlag || noteId === null) {
      return;
    }
    markNoteRead({ notebookFlag, noteId });
  }, [notebookFlag, noteId, activityCapabilitiesEpoch]);
  const selectedNote =
    noteId === null
      ? null
      : notes.find((note) => note.noteId === noteId) ?? null;
  const selectedNoteRowId = selectedNote?.id ?? null;
  const selectedNoteSavePending = Boolean(
    notebookFlag &&
      selectedNote &&
      hasPendingNotesNoteSave(notebookFlag, selectedNote.noteId)
  );
  const isCurrentNote = useCallback(
    (flag: string, targetNoteId: number) =>
      selectedNoteKeyRef.current === draftSnapshotKey(flag, targetNoteId),
    []
  );

  useEffect(() => {
    if (selectedNoteRowId !== null) {
      trackEvent(AnalyticsEvent.NoteOpened);
    }
  }, [selectedNoteRowId]);

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
          clearNotesNoteDraftSnapshot(
            notebookFlag,
            selectedNote.noteId,
            draftOwnerRef.current
          );
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
        baseRevision: draftBase.revision,
        baseTitle: draftBase.title,
        baseBody: draftBase.bodyMd,
        title: titleDraft,
        body,
        isDirty: dirty,
        updatedAt: Date.now(),
      };

      if (dirty || selectedNoteSavePending) {
        rememberNotesNoteDraftSnapshot(snapshot, draftOwnerRef.current);
      } else {
        clearNotesNoteDraftSnapshot(
          notebookFlag,
          selectedNote.noteId,
          draftOwnerRef.current
        );
      }
      onDraftChange?.(snapshot);
    },
    [
      draftBase,
      draftsMatchSelectedNote,
      notebookFlag,
      onDraftChange,
      selectedNote,
      selectedNoteSavePending,
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
  useLayoutEffect(() => {
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
    if (
      sameNote &&
      (isDirty ||
        selectedNote === draftBase ||
        rowTrailsBase ||
        selectedNoteSavePending ||
        conflictNote)
    ) {
      return;
    }
    if (sameNote) {
      preserveScrollOffset();
    }
    const snapshot =
      !sameNote && notebookFlag && selectedNote
        ? getNotesNoteDraftSnapshot(notebookFlag, selectedNote.noteId)
        : null;
    const restoreSnapshot = Boolean(
      snapshot &&
        selectedNote &&
        (snapshot.baseRevision === selectedNote.revision ||
          selectedNoteSavePending)
    );
    const restoredBase =
      restoreSnapshot &&
      snapshot &&
      selectedNote &&
      snapshot.baseRevision !== selectedNote.revision
        ? {
            ...selectedNote,
            revision: snapshot.baseRevision,
            title: snapshot.baseTitle,
            bodyMd: snapshot.baseBody,
          }
        : selectedNote;
    setDraftBase(restoredBase ?? null);
    setTitleDraft(
      restoreSnapshot && snapshot ? snapshot.title : selectedNote?.title ?? ''
    );
    setBodyDraft(
      restoreSnapshot && snapshot ? snapshot.body : selectedNote?.bodyMd ?? ''
    );
    if (restoreSnapshot && snapshot && notebookFlag && selectedNote) {
      claimNotesNoteDraftRecovery(
        notebookFlag,
        selectedNote.noteId,
        draftOwnerRef.current
      );
    }
    if (!sameNote) {
      setSaveState('idle');
      setError(null);
      setConflictNote(null);
    }
  }, [
    conflictNote,
    draftBase,
    isDirty,
    notebookFlag,
    preserveScrollOffset,
    selectedNote,
    selectedNoteSavePending,
  ]);

  useEffect(() => {
    if (!autoFocusTitle) {
      autoFocusedTitleNoteIdRef.current = null;
      return;
    }
    if (
      !selectedNoteRowId ||
      !canEdit ||
      autoFocusedTitleNoteIdRef.current === selectedNoteRowId
    ) {
      return;
    }
    if (isPreviewing) {
      // The title is a locked display field in preview mode, so renaming
      // needs the editor. Leaving preview re-runs this effect with the
      // editable input mounted, and the focus below can land.
      setPreviewMode(false);
      return;
    }
    const timeout = setTimeout(() => {
      // Mobile route params retain `focusTitle: true` for the lifetime of the
      // detail screen. Consume the request here so later preview toggles don't
      // get mistaken for another request to reopen the editor.
      autoFocusedTitleNoteIdRef.current = selectedNoteRowId;
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

  // Saves are queued per note outside the component so unmounting and rapidly
  // reopening an editor cannot start a concurrent write from the same base.
  const runSave = useCallback(
    (flag: string, base: db.NotesNote, title: string, body: string) => {
      markPendingNotesNoteSave(flag, base.noteId);
      const key = draftSnapshotKey(flag, base.noteId);
      const previous = notesNoteSaveChains.get(key) ?? Promise.resolve(null);
      const next = previous
        .catch(() => null)
        .then((prevSaved) =>
          saveNotebookNote({
            notebookFlag: flag,
            note: prevSaved && prevSaved.id === base.id ? prevSaved : base,
            title,
            body,
          })
        );
      const settled = next.then(
        (updated) => updated ?? null,
        () => null
      );
      notesNoteSaveChains.set(key, settled);
      void settled.then(() => {
        if (notesNoteSaveChains.get(key) === settled) {
          notesNoteSaveChains.delete(key);
        }
      });
      return next;
    },
    []
  );
  const finishSave = useCallback((flag: string, targetNoteId: number) => {
    finishPendingNotesNoteSave(flag, targetNoteId);
  }, []);

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
      if (!isCurrentNote(flag, conflict.remoteNote.noteId)) {
        return;
      }
      setConflictNote(conflict.remoteNote);
      setError(conflict.message);
      setSaveState('error');
    },
    [isCurrentNote]
  );

  // Counterpart to reportConflict: a save that SUCCEEDS for the current
  // note supersedes any conflict still showing. The save chain is FIFO, so
  // a stale queued save (e.g. a background flush from before a "Keep mine"
  // resolution) can reject and re-arm the banner after the resolution
  // cleared it; without this, the banner sticks and autosave stays
  // suspended even though the rebased save landed.
  const clearConflict = useCallback(
    (flag: string, noteId: number) => {
      if (!isCurrentNote(flag, noteId)) {
        return;
      }
      setConflictNote(null);
      setError(null);
    },
    [isCurrentNote]
  );

  const handleSuccessfulSave = useCallback(
    ({
      flag,
      base,
      title,
      body,
      updated,
    }: {
      flag: string;
      base: db.NotesNote;
      title: string;
      body: string;
      updated: db.NotesNote | null | undefined;
    }) => {
      clearDraftStash(flag, base.noteId, { title, body });
      clearMatchingNotesNoteDraftSnapshot({
        notebookFlag: flag,
        noteId: base.noteId,
        title,
        body,
      });
      if (updated) {
        rebaseNotesNoteDraftSnapshot(flag, base.noteId, base, title, updated);
      }
      if (!updated || !isCurrentNote(flag, base.noteId)) return;

      // Same-note completions advance the base without replacing newer
      // drafts. Adopt an authoritative title when the current draft has no
      // semantic rename relative to the base that was saved.
      setDraftBase(updated);
      if (
        normalizeNotebookNoteTitle(title) === base.title &&
        normalizeNotebookNoteTitle(titleDraftRef.current) === base.title &&
        updated.title !== titleDraftRef.current
      ) {
        setTitleDraft(updated.title);
        titleDraftRef.current = updated.title;
      }
      setSaveState('saved');
      clearConflict(flag, base.noteId);
    },
    [clearConflict, isCurrentNote]
  );

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
      rememberNotesNoteDraftSnapshot(
        {
          notebookFlag,
          noteId: base.noteId,
          baseRevision: base.revision,
          baseTitle: base.title,
          baseBody: base.bodyMd,
          title: titleDraft,
          body: bodyToSave,
          isDirty: true,
          updatedAt: Date.now(),
        },
        draftOwnerRef.current
      );
      try {
        const updated = await runSave(
          notebookFlag,
          base,
          titleDraft,
          bodyToSave
        );
        handleSuccessfulSave({
          flag: notebookFlag,
          base,
          title: titleDraft,
          body: bodyToSave,
          updated,
        });
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
        if (isCurrentNote(notebookFlag, base.noteId)) {
          setSaveState('error');
          setError(message);
        }
        return false;
      } finally {
        finishSave(notebookFlag, base.noteId);
      }
    },
    [
      canEdit,
      draftBase,
      finishSave,
      handleSuccessfulSave,
      isCurrentNote,
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
    if (!conflictNote || !draftBase || !notebookFlag) return;
    const rebased = rebaseDraftOnConflict(draftBase, conflictNote);
    setConflictNote(null);
    setError(null);
    setDraftBase(rebased);
    // Re-stamp the durable stash against the rebased base in the same tick.
    // The stash writer pauses while a banner is up, so the stash may still
    // hold the pre-conflict draft; if it survived the save's content-matched
    // clear, the restore pass would resurrect that obsolete draft as a
    // ghost conflict.
    void db.notesNoteDrafts.setValue((stashes) => ({
      ...stashes,
      [draftStashKey(notebookFlag, rebased.noteId)]: {
        title: titleDraftRef.current,
        body: bodyDraftRef.current,
        baseRevision: rebased.revision,
        stashedAt: Date.now(),
      },
    }));
    void saveSelectedNote(rebased);
  }, [
    conflictNote,
    draftBase,
    notebookFlag,
    rebaseDraftOnConflict,
    saveSelectedNote,
  ]);

  const resolveConflictUseTheirs = useCallback(() => {
    if (!conflictNote || !draftBase || !notebookFlag) return;
    const adopted = rebaseDraftOnConflict(draftBase, conflictNote);
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
    flushCtxRef.current = {
      flag: notebookFlag,
      base: adopted,
      canEdit,
    };
    // Persist the host's copy locally so the reactive row catches up with
    // the adoption instead of reloading the stale pre-conflict content
    // over it. (The draft-loading effect also skips rows that trail the
    // base revision, covering the render gap until this write lands.)
    void adoptNotebookNoteRemote({ notebookFlag, remote: conflictNote });
    // Drop this note's crash-insurance stashes unconditionally: the user
    // just discarded the local side. A content-matched clear would miss a
    // stash frozen at the PRE-conflict draft (the stash writer pauses
    // while the banner is up, so typing during it leaves the stash stale),
    // and the restore effect would resurrect that discarded text as a
    // fresh conflict.
    clearDraftStash(notebookFlag, draftBase.noteId);
    clearNotesNoteDraftSnapshot(notebookFlag, draftBase.noteId);
    setSaveState('idle');
  }, [canEdit, conflictNote, draftBase, notebookFlag, rebaseDraftOnConflict]);

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
    rememberNotesNoteDraftSnapshot(
      {
        notebookFlag: flag,
        noteId: base.noteId,
        baseRevision: base.revision,
        baseTitle: base.title,
        baseBody: base.bodyMd,
        title: titleToSave,
        body: bodyToSave,
        isDirty: true,
        updatedAt: Date.now(),
      },
      draftOwnerRef.current
    );
    runSave(flag, base, titleToSave, bodyToSave)
      .then((updated) => {
        handleSuccessfulSave({
          flag,
          base,
          title: titleToSave,
          body: bodyToSave,
          updated,
        });
      })
      .catch((e) => {
        // No-ops after unmount; while mounted, surface a conflict so the
        // resolution banner appears instead of a silently-failed flush.
        // reportConflict drops it if the selection has since moved on.
        if (e instanceof NotesNoteConflictError) {
          reportConflict(flag, e);
          return;
        }
        // Non-conflict failures (e.g. an unclassifiable conflict from a
        // lagging replica) must not fail silently either: while this note
        // is still in the editor, show the error so autosave/user retries.
        // After unmount the durable stash carries the edits, and the
        // stash-restore pass surfaces a conflict if the note moved on.
        if (isCurrentNote(flag, base.noteId)) {
          setSaveState('error');
          setError(errorMessage(e, 'Failed to save note'));
        }
      })
      .finally(() => finishSave(flag, base.noteId));
  }, [
    finishSave,
    handleSuccessfulSave,
    isCurrentNote,
    preserveScrollOffset,
    reportConflict,
    runSave,
  ]);

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
    // While a conflict is pending, leave the stash alone. A restored
    // conflict pairs old drafts with the row's newer base — re-stashing
    // would stamp them with the new baseRevision, and a restart would then
    // restore them as ordinary drafts whose autosave silently overwrites
    // the remote work the conflict was protecting.
    if (conflictNote) return;
    if (!isDirty && !selectedNoteSavePending) {
      if (stashRestoreCheckedRef.current === stashRestoreKey) {
        clearDraftStash(
          notebookFlag,
          draftBase.noteId,
          undefined,
          draftOwnerRef.current
        );
      }
      return;
    }
    const key = draftStashKey(notebookFlag, draftBase.noteId);
    const owner = draftOwnerRef.current;
    void db.notesNoteDrafts.setValue((stashes) => {
      if (
        !isDirty &&
        selectedNoteSavePending &&
        stashes[key] &&
        notesNoteDraftStashOwners.get(key) !== owner
      ) {
        return stashes;
      }
      notesNoteDraftStashOwners.set(key, owner);
      return {
        ...stashes,
        [key]: {
          title: titleDraft,
          body: bodyDraft,
          baseRevision: draftBase.revision,
          stashedAt: Date.now(),
        },
      };
    });
  }, [
    bodyDraft,
    conflictNote,
    draftBase,
    isDirty,
    notebookFlag,
    selectedNoteSavePending,
    stashRestoreKey,
    titleDraft,
  ]);

  // Restore a stashed draft after a crash/kill. Only restore while the
  // editor is clean and the row is still at the stash's base revision —
  // then pushing the restored draft can't clobber anyone's newer work.
  useEffect(() => {
    if (
      !notebookFlag ||
      !draftBase ||
      isDirty ||
      selectedNoteSavePending ||
      !stashRestoreKey
    ) {
      return;
    }
    if (stashRestoreCheckedRef.current === stashRestoreKey) return;
    stashRestoreCheckedRef.current = stashRestoreKey;
    let cancelled = false;
    void db.notesNoteDrafts.getValue().then((stashes) => {
      const key = draftStashKey(notebookFlag, draftBase.noteId);
      const stash = stashes[key];
      if (cancelled || !stash) return;
      notesNoteDraftStashOwners.set(key, draftOwnerRef.current);
      if (stash.baseRevision !== draftBase.revision) {
        if (
          stash.title === draftBase.title &&
          stash.body === draftBase.bodyMd
        ) {
          // The stashed content is exactly what the row now holds — the
          // save landed (e.g. a late flush succeeded). Nothing to recover.
          clearDraftStash(notebookFlag, draftBase.noteId);
          return;
        }
        // The stashed edits never landed and the note moved on (a flush
        // hit a conflict and the session ended before recovery could run).
        // Restoring them as plain drafts would be worse than dropping
        // them: their base revision is now current, so the next autosave
        // would silently overwrite the newer remote work. Surface it as
        // the standing conflict it is — row as "theirs", stash as "mine" —
        // which also suspends autosave until the user picks a side.
        setTitleDraft(stash.title);
        setBodyDraft(stash.body);
        setConflictNote(draftBase);
        setError(
          'This note was changed elsewhere. Your unsaved changes are kept.'
        );
        setSaveState('error');
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
  }, [
    draftBase,
    isDirty,
    notebookFlag,
    selectedNoteSavePending,
    stashRestoreKey,
  ]);

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

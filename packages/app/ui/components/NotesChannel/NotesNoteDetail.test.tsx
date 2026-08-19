import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { NotesNoteDetail } from './NotesNoteDetail';

const mocks = vi.hoisted(() => ({
  notes: [] as Array<Record<string, unknown>>,
  saveNotebookNote: vi.fn(),
  useNotebookData: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  getActivityCapabilitiesEpoch: () => 0,
  onActivityCapabilitiesChange: () => () => undefined,
}));

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { NoteOpened: 'NoteOpened' },
  NotesNoteConflictError: class NotesNoteConflictError extends Error {},
  adoptNotebookNoteRemote: vi.fn(),
  convertContent: () => [],
  markNoteRead: vi.fn(),
  markdownToStory: () => [],
  normalizeNotebookNoteTitle: (title: string) => title.trim() || 'Untitled',
  saveNotebookNote: mocks.saveNotebookNote,
  trackEvent: vi.fn(),
}));

vi.mock('@tloncorp/shared/db', () => ({
  notesNoteDrafts: {
    getValue: vi.fn(async () => ({})),
    setValue: vi.fn(async () => undefined),
  },
}));

vi.mock('@tloncorp/ui', () => ({ Text: 'Text' }));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock('tamagui', () => ({
  Input: 'Input',
  ScrollView: 'ScrollView',
  TextArea: 'TextArea',
  XStack: 'XStack',
  YStack: 'YStack',
  getTokenValue: () => 16,
  isWeb: true,
}));

vi.mock('../Channel/ChannelHeader', () => ({
  useRegisterChannelHeaderItem: vi.fn(),
  useRegisterChannelHeaderLoadingSubtitle: vi.fn(),
}));

vi.mock('../Form', () => ({ TextInput: 'TextInput' }));
vi.mock('../NotebookPost/NotebookPost', () => ({
  NotebookContentRenderer: () => null,
}));
vi.mock('../ScreenHeader', () => ({
  ScreenHeader: { TextButton: 'TextButton' },
}));
vi.mock('./NotesData', () => ({
  NotebookGateMessage: () => null,
  NotesMessage: () => null,
  useNotebookData: mocks.useNotebookData,
}));
vi.mock('./NotesFeedback', () => ({
  NotesBanner: () => null,
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));
vi.mock('./notesTelemetry', () => ({ trackNotesActionError: vi.fn() }));
vi.mock('./notesTree', () => ({
  formatNoteDate: () => 'Today',
  getFolderPath: () => null,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function note(noteId: number, bodyMd: string, revision = 1) {
  return {
    id: `~zod/notebook/${noteId}`,
    notebookFlag: '~zod/notebook',
    noteId,
    folderId: 0,
    title: `Note ${noteId}`,
    bodyMd,
    revision,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('NotesNoteDetail note switching', () => {
  beforeAll(() => {
    Object.assign(globalThis, {
      IS_REACT_ACT_ENVIRONMENT: true,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
    });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
    delete (
      globalThis as unknown as {
        requestAnimationFrame?: typeof requestAnimationFrame;
      }
    ).requestAnimationFrame;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notes = [note(1, 'Original A'), note(2, 'Original B')];
    mocks.useNotebookData.mockImplementation(() => ({
      folders: [],
      notes: mocks.notes,
      canEdit: true,
      rootFolderId: 0,
      gate: null,
    }));
  });

  it('ignores a save completion from an earlier A visit after switching A → B → A', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote.mockReturnValueOnce(firstSave.promise);
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });

    await act(async () => {
      renderer!.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Edited A');
    });

    await act(async () => {
      renderer!.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={2}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    expect(mocks.saveNotebookNote).toHaveBeenCalledWith(
      expect.objectContaining({
        note: expect.objectContaining({ noteId: 1 }),
        body: 'Edited A',
      })
    );

    await act(async () => {
      renderer!.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Original A');
    const renderCountBeforeStaleCompletion =
      mocks.useNotebookData.mock.calls.length;

    await act(async () => {
      firstSave.resolve(note(1, 'Edited A', 2));
      await firstSave.promise;
    });

    expect(mocks.useNotebookData).toHaveBeenCalledTimes(
      renderCountBeforeStaleCompletion
    );
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Original A');

    act(() => renderer!.unmount());
  });
});

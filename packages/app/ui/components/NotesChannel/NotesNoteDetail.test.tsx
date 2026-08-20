import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotesNoteDetail,
  deriveNotesNoteSaveFieldIntent,
} from './NotesNoteDetail';

const mocks = vi.hoisted(() => ({
  draftStashes: {} as Record<string, Record<string, unknown>>,
  getDraftStashes: vi.fn(),
  notes: [] as Array<Record<string, unknown>>,
  saveNotebookNote: vi.fn(),
  setDraftStashes: vi.fn(),
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
    getValue: mocks.getDraftStashes,
    setValue: mocks.setDraftStashes,
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
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function note(
  noteId: number,
  bodyMd: string,
  revision = 1,
  title = `Note ${noteId}`
) {
  return {
    id: `~zod/notebook/${noteId}`,
    notebookFlag: '~zod/notebook',
    noteId,
    folderId: 0,
    title,
    bodyMd,
    revision,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('deriveNotesNoteSaveFieldIntent', () => {
  it.each([
    {
      name: 'preserves an untouched field with no predecessor',
      hasPredecessor: false,
      matchesPredecessorRequest: false,
      differsFromBase: false,
      expected: 'preserve',
    },
    {
      name: 'sets a dirty field with no predecessor',
      hasPredecessor: false,
      matchesPredecessorRequest: false,
      differsFromBase: true,
      expected: 'set',
    },
    {
      name: 'preserves a field matching the predecessor request',
      hasPredecessor: true,
      matchesPredecessorRequest: true,
      differsFromBase: true,
      expected: 'preserve',
    },
    {
      name: 'sets a field that changes the predecessor request',
      hasPredecessor: true,
      matchesPredecessorRequest: false,
      differsFromBase: false,
      expected: 'set',
    },
  ])('$name', ({ expected, name: _name, ...input }) => {
    expect(deriveNotesNoteSaveFieldIntent(input)).toBe(expected);
  });
});

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.draftStashes = {};
    mocks.getDraftStashes.mockResolvedValue({});
    mocks.setDraftStashes.mockResolvedValue(undefined);
    mocks.notes = [note(1, 'Original A'), note(2, 'Original B')];
    mocks.useNotebookData.mockImplementation(() => ({
      folders: [],
      notes: mocks.notes,
      canEdit: true,
      rootFolderId: 0,
      gate: null,
    }));
  });

  it('keeps same-note saves FIFO across A → B → A visits', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    let renderer!: ReactTestRenderer;

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
        .props.onChangeText('Older A edit');
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
        body: 'Older A edit',
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

    await act(async () => {
      renderer!.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Latest A edit');
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
    expect(mocks.saveNotebookNote).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve(note(1, 'Older A edit', 2));
      await firstSave.promise;
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ noteId: 1, revision: 2 }),
        body: 'Latest A edit',
      })
    );
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Original B');

    act(() => renderer!.unmount());
  });

  it('keeps same-note saves FIFO across editor remounts', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    let firstRenderer: ReactTestRenderer;
    let secondRenderer: ReactTestRenderer;

    await act(async () => {
      firstRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      firstRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Older A edit');
    });
    await act(async () => {
      firstRenderer.unmount();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenCalledTimes(1);

    await act(async () => {
      secondRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    expect(
      secondRenderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Older A edit');

    await act(async () => {
      secondRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Latest A edit');
    });
    await act(async () => {
      secondRenderer.unmount();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve(note(1, 'Older A edit', 2));
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ noteId: 1, revision: 2 }),
        body: 'Latest A edit',
      })
    );
  });

  it('preserves an authoritative title through a deep body-save queue', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.getDraftStashes.mockImplementation(async () => mocks.draftStashes);
    mocks.setDraftStashes.mockImplementation(
      async (
        update: (
          stashes: Record<string, Record<string, unknown>>
        ) => Record<string, Record<string, unknown>>
      ) => {
        mocks.draftStashes = update(mocks.draftStashes);
      }
    );
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
    let firstRenderer: ReactTestRenderer;
    let secondRenderer: ReactTestRenderer;
    let thirdRenderer: ReactTestRenderer;

    await act(async () => {
      firstRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      firstRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Older body');
    });
    await act(async () => {
      firstRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      secondRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      secondRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Latest body');
    });
    await act(async () => {
      secondRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      thirdRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      thirdRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Newest body');
    });
    await act(async () => {
      thirdRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      firstSave.resolve(note(1, 'Older body', 2, 'Remote title'));
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ revision: 2, title: 'Remote title' }),
        title: 'Remote title',
        body: 'Latest body',
      })
    );
    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        note: expect.objectContaining({
          revision: 3,
          title: 'Remote title',
          bodyMd: 'Latest body',
        }),
        title: 'Remote title',
        body: 'Newest body',
      })
    );
    expect(mocks.draftStashes['~zod/notebook/1']).toBeUndefined();
  });

  it('preserves a title revert made after an intermediate adoption', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    const secondSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
    let renderer!: ReactTestRenderer;

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
      renderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Older body');
    });
    await act(async () => {
      renderer.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={2}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      renderer.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      renderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Latest body');
    });
    await act(async () => {
      renderer.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={2}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      renderer.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });

    await act(async () => {
      firstSave.resolve(note(1, 'Older body', 2, 'Remote title'));
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      renderer.root.findByProps({ testID: 'NotesTitleInput' }).props.value
    ).toBe('Remote title');
    expect(
      renderer.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Latest body');

    await act(async () => {
      renderer.root
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Original title');
    });
    await act(async () => {
      secondSave.resolve(note(1, 'Latest body', 3, 'Remote title'));
      await secondSave.promise;
      await Promise.resolve();
    });
    expect(
      renderer.root.findByProps({ testID: 'NotesTitleInput' }).props.value
    ).toBe('Original title');

    await act(async () => {
      renderer.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={2}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        note: expect.objectContaining({
          revision: 3,
          title: 'Remote title',
        }),
        title: 'Original title',
        body: 'Latest body',
      })
    );

    act(() => renderer.unmount());
  });

  it('keeps an older sibling body edit when the predecessor captured only a newer title edit', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
    let titleRenderer: ReactTestRenderer;
    let bodyRenderer: ReactTestRenderer;

    await act(async () => {
      titleRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
      bodyRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      bodyRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Latest body');
      titleRenderer.root
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Sibling title');
    });
    await act(async () => {
      titleRenderer.unmount();
      await Promise.resolve();
    });
    await act(async () => {
      bodyRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      firstSave.resolve(note(1, 'Original A', 1, 'Sibling title'));
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        // Queue-relative intent deliberately retains HEAD's last-flusher
        // behavior for conflicting sibling titles while protecting the
        // independently edited body from being dropped.
        title: 'Original title',
        body: 'Latest body',
      })
    );
  });

  it('preserves a title revert queued with a body edit', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
    let firstRenderer: ReactTestRenderer;
    let secondRenderer: ReactTestRenderer;

    await act(async () => {
      firstRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      firstRenderer.root
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Renamed title');
    });
    await act(async () => {
      firstRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      secondRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      secondRenderer.root
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Original title');
      secondRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Edited body');
    });
    await act(async () => {
      secondRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      firstSave.resolve(note(1, 'Original A', 1, 'Renamed title'));
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ title: 'Renamed title' }),
        title: 'Original title',
        body: 'Edited body',
      })
    );
  });

  it('preserves a body revert queued with a title edit', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
    let firstRenderer: ReactTestRenderer;
    let secondRenderer: ReactTestRenderer;

    await act(async () => {
      firstRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      firstRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Edited body');
    });
    await act(async () => {
      firstRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      secondRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      secondRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Original A');
      secondRenderer.root
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Renamed title');
    });
    await act(async () => {
      secondRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      firstSave.resolve(note(1, 'Edited body', 2, 'Original title'));
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ revision: 2, bodyMd: 'Edited body' }),
        title: 'Renamed title',
        body: 'Original A',
      })
    );
  });

  it('retries inherited intent when a queued predecessor fails', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
    let firstRenderer: ReactTestRenderer;
    let secondRenderer: ReactTestRenderer;

    await act(async () => {
      firstRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      firstRenderer.root
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Renamed title');
    });
    await act(async () => {
      firstRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      secondRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      secondRenderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Edited body');
    });
    await act(async () => {
      secondRenderer.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      firstSave.reject(new Error('save failed'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({
          revision: 1,
          title: 'Original title',
        }),
        title: 'Renamed title',
        body: 'Edited body',
      })
    );
  });

  it('keeps a restored draft on its stale revision when the row advanced remotely', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockRejectedValueOnce(new Error('revision conflict'));
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

    mocks.notes = [note(1, 'Remote A', 2), note(2, 'Original B')];
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
    ).toBe('Edited A');

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
    await act(async () => {
      firstSave.reject(new Error('revision conflict'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ noteId: 1, revision: 1 }),
        body: 'Edited A',
      })
    );

    act(() => renderer!.unmount());
  });

  it('rebases an earlier save without resurrecting an explicitly reverted draft', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
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
    ).toBe('Edited A');

    // Make the user's intent explicit: change the new visit, then revert it
    // to the original text while the previous visit's save is still pending.
    await act(async () => {
      const input = renderer!.root.findByProps({ testID: 'NotesBodyInput' });
      input.props.onChangeText('Temporary new edit');
      input.props.onChangeText('Original A');
    });

    const earlierSavedRow = note(1, 'Edited A', 2);
    mocks.notes = [earlierSavedRow, note(2, 'Original B')];
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

    await act(async () => {
      firstSave.resolve(earlierSavedRow);
      await firstSave.promise;
    });
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Original A');

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
    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ noteId: 1, revision: 2 }),
        body: 'Original A',
      })
    );

    act(() => renderer!.unmount());
  });

  it('restores a reopened draft synchronously while its save is pending', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    const reopenedStashRead = deferred<Record<string, unknown>>();
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

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 121_000);
    mocks.getDraftStashes.mockReturnValueOnce(reopenedStashRead.promise);
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
    ).toBe('Edited A');

    const earlierSavedRow = note(1, 'Edited A', 2);
    mocks.notes = [earlierSavedRow, note(2, 'Original B')];
    await act(async () => {
      renderer!.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
      firstSave.resolve(earlierSavedRow);
      await firstSave.promise;
    });
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Edited A');

    await act(async () => {
      reopenedStashRead.resolve({
        '~zod/notebook/1': {
          title: 'Note 1',
          body: 'Edited A',
          baseRevision: 1,
          stashedAt: Date.now(),
        },
      });
      await reopenedStashRead.promise;
    });
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Edited A');

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
    expect(mocks.saveNotebookNote).toHaveBeenCalledTimes(1);

    act(() => renderer!.unmount());
  });

  it('adopts an authoritative title after a semantic title revert', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote.mockReturnValueOnce(firstSave.promise);
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
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
    await act(async () => {
      const titleInput = renderer!.root.findByProps({
        testID: 'NotesTitleInput',
      });
      titleInput.props.onChangeText('Original title ');
      titleInput.props.onChangeText('Original title');
    });

    const savedRow = note(1, 'Edited A', 2, 'Remote title');
    mocks.notes = [savedRow, note(2, 'Original B')];
    await act(async () => {
      renderer!.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
      firstSave.resolve(savedRow);
      await firstSave.promise;
    });

    expect(
      renderer!.root.findByProps({ testID: 'NotesTitleInput' }).props.value
    ).toBe('Remote title');
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
    expect(mocks.saveNotebookNote).toHaveBeenCalledTimes(1);

    act(() => renderer!.unmount());
  });

  it('preserves a title revert made while its rename save is pending', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote
      .mockReturnValueOnce(firstSave.promise)
      .mockImplementation(
        async ({
          note: base,
          title,
          body,
        }: {
          note: ReturnType<typeof note>;
          title: string;
          body: string;
        }) => ({
          ...base,
          title,
          bodyMd: body,
          revision: base.revision + 1,
        })
      );
    mocks.notes = [
      note(1, 'Original A', 1, 'Original title'),
      note(2, 'Original B'),
    ];
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
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Renamed title');
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
    await act(async () => {
      renderer!.root
        .findByProps({ testID: 'NotesTitleInput' })
        .props.onChangeText('Original title');
    });

    const savedRow = note(1, 'Original A', 2, 'Renamed title');
    mocks.notes = [savedRow, note(2, 'Original B')];
    await act(async () => {
      renderer!.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
      firstSave.resolve(savedRow);
      await firstSave.promise;
    });
    expect(
      renderer!.root.findByProps({ testID: 'NotesTitleInput' }).props.value
    ).toBe('Original title');

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
    expect(mocks.saveNotebookNote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        note: expect.objectContaining({ noteId: 1, revision: 2 }),
        title: 'Original title',
      })
    );

    act(() => renderer!.unmount());
  });

  it('does not let a clean sibling editor replace dirty recovery data', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote.mockReturnValueOnce(firstSave.promise);
    let dirtyRenderer: ReactTestRenderer;
    let cleanRenderer: ReactTestRenderer;

    await act(async () => {
      dirtyRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
      cleanRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    await act(async () => {
      dirtyRenderer!.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Edited A');
    });
    act(() => dirtyRenderer!.unmount());

    await act(async () => {
      firstSave.reject(new Error('save failed'));
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => cleanRenderer!.unmount());

    let recoveredRenderer: ReactTestRenderer;
    await act(async () => {
      recoveredRenderer = create(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    expect(
      recoveredRenderer!.root.findByProps({ testID: 'NotesBodyInput' }).props
        .value
    ).toBe('Edited A');

    await act(async () => {
      recoveredRenderer!.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Original A');
    });
    act(() => recoveredRenderer!.unmount());
  });

  it('advances a restored draft base when the settled row already matches', async () => {
    const firstSave = deferred<Record<string, unknown>>();
    mocks.saveNotebookNote.mockReturnValueOnce(firstSave.promise);
    let renderer!: ReactTestRenderer;

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
      renderer.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Edited A');
    });
    await act(async () => {
      renderer.unmount();
      await Promise.resolve();
    });

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
    expect(
      renderer.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Edited A');

    const savedRow = note(1, 'Edited A', 2);
    mocks.notes = [savedRow, note(2, 'Original B')];
    await act(async () => {
      renderer.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={1}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
      firstSave.resolve(savedRow);
      await firstSave.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      renderer.update(
        <NotesNoteDetail
          headerActionsPlacement="none"
          noteId={2}
          notebookFlag="~zod/notebook"
          startInEdit
        />
      );
    });
    expect(mocks.saveNotebookNote).toHaveBeenCalledTimes(1);

    act(() => renderer.unmount());
  });

  it('reconsiders a skipped row when a previous editor instance settles', async () => {
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
    act(() => renderer!.unmount());
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 121_000);
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
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Edited A');

    await act(async () => {
      renderer!.root
        .findByProps({ testID: 'NotesBodyInput' })
        .props.onChangeText('Original A');
    });

    mocks.notes = [note(1, 'Remote A', 2), note(2, 'Original B')];
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

    await act(async () => {
      firstSave.reject(new Error('save failed'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      renderer!.root.findByProps({ testID: 'NotesBodyInput' }).props.value
    ).toBe('Remote A');

    act(() => renderer!.unmount());
  });
});

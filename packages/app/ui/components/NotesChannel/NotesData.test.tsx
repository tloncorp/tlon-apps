import { useEffect } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookGateMessage, useNotebookData } from './NotesData';

const mocks = vi.hoisted(() => ({
  isWeb: false,
  markNotesNotebookOpened: vi.fn(),
  useEnsureNotesNotebookJoined: vi.fn(),
  useNotesNotebookWithRelations: vi.fn(),
  useSyncNotesNotebook: vi.fn(),
}));

vi.mock('@tloncorp/shared', () => mocks);
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/ui', () => ({
  LoadingSpinner: 'LoadingSpinner',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({
  YStack: 'YStack',
  get isWeb() {
    return mocks.isWeb;
  },
}));

const notebookFlag = '~zod/notebook';
const notebook = {
  id: notebookFlag,
  currentUserRole: 'editor',
  rootFolderId: 0,
  folders: [],
  notes: [],
};

let renderer: ReactTestRenderer | undefined;
let result: ReturnType<typeof useNotebookData>;

function NotebookDataProbe({ flag }: { flag?: string | null }) {
  const data = useNotebookData(flag);
  useEffect(() => {
    result = data;
  }, [data]);
  return null;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.isWeb = false;
  mocks.useEnsureNotesNotebookJoined.mockReturnValue({
    data: undefined,
    isLoading: true,
  });
  mocks.useNotesNotebookWithRelations.mockReturnValue({
    data: notebook,
    isLoading: false,
  });
  mocks.useSyncNotesNotebook.mockReturnValue({ isLoading: false });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('useNotebookData gate', () => {
  it.each([
    { name: 'pending membership', data: undefined, isLoading: true },
    {
      name: 'failed membership request',
      data: undefined,
      isLoading: false,
      error: new Error('offline'),
    },
    { name: 'confirmed membership', data: true, isLoading: false },
  ])('renders cached data with $name', ({ name: _name, ...joinQuery }) => {
    mocks.useEnsureNotesNotebookJoined.mockReturnValue(joinQuery);
    act(() => {
      renderer = create(<NotebookDataProbe flag={notebookFlag} />);
    });

    expect(result.gate).toBeNull();
    expect(result.notebook).toBe(notebook);
    expect(mocks.useNotesNotebookWithRelations).toHaveBeenCalledWith(
      notebookFlag
    );
    expect(mocks.useSyncNotesNotebook).toHaveBeenCalledWith({
      notebookFlag,
      enabled: joinQuery.data === true,
    });
  });

  it.each([
    { data: false, expected: 'unjoinable' },
    { data: 'notMember', expected: 'notMember' },
  ])(
    'hides cached data when membership resolves to $data',
    ({ data, expected }) => {
      act(() => {
        renderer = create(<NotebookDataProbe flag={notebookFlag} />);
      });
      expect(result.gate).toBeNull();

      mocks.useEnsureNotesNotebookJoined.mockReturnValue({
        data,
        isLoading: false,
      });
      // A pending local read or sync must not mask a confirmed denial.
      mocks.useNotesNotebookWithRelations.mockReturnValue({
        data: notebook,
        isLoading: true,
      });
      mocks.useSyncNotesNotebook.mockReturnValue({ isLoading: true });
      act(() => renderer!.update(<NotebookDataProbe flag={notebookFlag} />));

      expect(result.gate).toBe(expected);
      expect(mocks.useSyncNotesNotebook).toHaveBeenLastCalledWith({
        notebookFlag,
        enabled: false,
      });
    }
  );

  it.each([
    {
      name: 'membership pending',
      join: { data: undefined, isLoading: true },
      localLoading: false,
      syncLoading: false,
      expected: 'loading',
    },
    {
      name: 'local read pending',
      join: { data: true, isLoading: false },
      localLoading: true,
      syncLoading: false,
      expected: 'loading',
    },
    {
      name: 'sync pending',
      join: { data: true, isLoading: false },
      localLoading: false,
      syncLoading: true,
      expected: 'loading',
    },
    {
      name: 'sync failed',
      join: { data: true, isLoading: false },
      localLoading: false,
      syncLoading: false,
      expected: 'unavailable',
    },
    {
      name: 'membership failed',
      join: { data: undefined, isLoading: false, error: new Error('offline') },
      localLoading: false,
      syncLoading: false,
      expected: 'unjoinable',
    },
  ])(
    'gates an uncached notebook with $name',
    ({ join, localLoading, syncLoading, expected }) => {
      mocks.useEnsureNotesNotebookJoined.mockReturnValue(join);
      mocks.useNotesNotebookWithRelations.mockReturnValue({
        data: null,
        isLoading: localLoading,
      });
      mocks.useSyncNotesNotebook.mockReturnValue({ isLoading: syncLoading });
      act(() => {
        renderer = create(<NotebookDataProbe flag={notebookFlag} />);
      });

      expect(result.gate).toBe(expected);
    }
  );

  it.each([null, undefined])('is unavailable without a flag (%s)', (flag) => {
    act(() => {
      renderer = create(<NotebookDataProbe flag={flag} />);
    });

    expect(result.gate).toBe('unavailable');
    expect(mocks.markNotesNotebookOpened).not.toHaveBeenCalled();
  });

  it('keeps cached content visible during a failed background sync', () => {
    mocks.useEnsureNotesNotebookJoined.mockReturnValue({
      data: true,
      isLoading: false,
    });
    mocks.useSyncNotesNotebook.mockReturnValue({
      isLoading: false,
      error: new Error('offline'),
    });
    act(() => {
      renderer = create(<NotebookDataProbe flag={notebookFlag} />);
    });

    expect(result.gate).toBeNull();
  });
});

describe('NotebookGateMessage loading', () => {
  it.each([false, true])('renders the loader for isWeb=%s', (isWeb) => {
    mocks.isWeb = isWeb;
    act(() => {
      renderer = create(
        <NotebookGateMessage
          gate="loading"
          loadingTitle="Loading notebook"
          unavailableTitle="Notebook unavailable"
        />
      );
    });

    const output = JSON.stringify(renderer!.toJSON());
    const spinner = renderer!.root.findByType('LoadingSpinner' as never);
    if (isWeb) {
      expect(output).toContain('Loading notebook');
      expect(spinner.props.size).toBeUndefined();
    } else {
      expect(output).not.toContain('Loading notebook');
      expect(spinner.props.size).toBe('small');
    }
  });
});

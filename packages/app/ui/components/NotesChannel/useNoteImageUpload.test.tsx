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

import { useNoteImageUpload } from './useNoteImageUpload';

const mocks = vi.hoisted(() => ({
  normalizeUploadIntents: vi.fn(),
  uploadAssetForUrl: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {
    NoteImageInserted: 'NoteImageInserted',
    NoteImageInsertFailed: 'NoteImageInsertFailed',
  },
  trackEvent: mocks.trackEvent,
  useMutableCallback: <T,>(callback: T) => callback,
}));
vi.mock('@tloncorp/shared/store', () => ({
  uploadAssetForUrl: mocks.uploadAssetForUrl,
}));
vi.mock('tamagui', () => ({ isWeb: false }));
// Pulls in expo modules vitest cannot load.
vi.mock('../../../utils/filepicker', () => ({
  normalizeUploadIntents: mocks.normalizeUploadIntents,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const image = (uri: string) =>
  ({ type: 'image', asset: { uri, width: 10, height: 10 } }) as const;

function renderUpload(noteKey: string) {
  const state = {
    body: 'first\nsecond',
    selection: { start: 5, end: 5 },
    errors: [] as string[],
    insertImages: null as
      | null
      | ReturnType<typeof useNoteImageUpload>['insertImages'],
  };
  function Harness({ noteKey }: { noteKey: string }) {
    const { insertImages } = useNoteImageUpload({
      noteKey,
      getBody: () => state.body,
      getSelection: () => state.selection,
      applyBody: (body) => {
        state.body = body;
      },
      onError: (message) => state.errors.push(message),
    });
    state.insertImages = insertImages;
    return null;
  }
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Harness noteKey={noteKey} />);
  });
  const rerender = (nextKey: string) =>
    act(() => renderer.update(<Harness noteKey={nextKey} />));
  return { state, rerender, renderer };
}

describe('useNoteImageUpload', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  beforeEach(() => {
    mocks.uploadAssetForUrl.mockReset();
    mocks.normalizeUploadIntents.mockReset();
    mocks.normalizeUploadIntents.mockImplementation(async (intents) => ({
      uploadIntents: intents,
      errorMessage: null,
    }));
    mocks.trackEvent.mockReset();
  });

  it('inserts the uploaded image at the caret once it lands', async () => {
    const upload = deferred<string>();
    mocks.uploadAssetForUrl.mockReturnValue(upload.promise);
    const { state } = renderUpload('~zod/notes/1');

    let done!: Promise<void>;
    act(() => {
      done = state.insertImages!([image('file:///a.jpg')], 'picker');
    });
    // Nothing goes into the body while the upload runs.
    expect(state.body).toBe('first\nsecond');

    await act(async () => {
      upload.resolve('https://cdn.example/a.jpg');
      await done;
    });
    expect(state.body).toBe(
      'first\n\n![](https://cdn.example/a.jpg)\n\nsecond'
    );
  });

  it('drops an upload that lands after the note changed', async () => {
    const upload = deferred<string>();
    mocks.uploadAssetForUrl.mockReturnValue(upload.promise);
    const { state, rerender } = renderUpload('~zod/notes/1');

    let done!: Promise<void>;
    act(() => {
      done = state.insertImages!([image('file:///a.jpg')], 'picker');
    });
    rerender('~zod/notes/2');
    state.body = 'another note';

    await act(async () => {
      upload.resolve('https://cdn.example/a.jpg');
      await done;
    });
    expect(state.body).toBe('another note');
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'NoteImageInsertFailed',
      expect.objectContaining({ reason: 'note closed' })
    );
  });

  it('keeps images with the note they were added to while they normalize', async () => {
    const normalized = deferred<{
      uploadIntents: ReturnType<typeof image>[];
      errorMessage: null;
    }>();
    mocks.normalizeUploadIntents.mockReturnValue(normalized.promise);
    mocks.uploadAssetForUrl.mockResolvedValue('https://cdn.example/a.jpg');
    const { state, rerender } = renderUpload('~zod/notes/1');

    let done!: Promise<void>;
    act(() => {
      done = state.insertImages!([image('file:///a.jpg')], 'paste');
    });
    rerender('~zod/notes/2');
    state.body = 'another note';

    await act(async () => {
      normalized.resolve({
        uploadIntents: [image('file:///a.jpg')],
        errorMessage: null,
      });
      await done;
    });
    expect(state.body).toBe('another note');
  });

  it('drops images picked for a note that is no longer open', async () => {
    mocks.uploadAssetForUrl.mockResolvedValue('https://cdn.example/a.jpg');
    const { state } = renderUpload('~zod/notes/2');

    await act(async () => {
      await state.insertImages!(
        [image('file:///a.jpg')],
        'picker',
        '~zod/notes/1'
      );
    });
    expect(state.body).toBe('first\nsecond');
  });

  it('reports a failed upload and leaves the body alone', async () => {
    mocks.uploadAssetForUrl.mockRejectedValue(new Error('403'));
    const { state } = renderUpload('~zod/notes/1');

    await act(async () => {
      await state.insertImages!([image('file:///a.jpg')], 'paste');
    });
    expect(state.body).toBe('first\nsecond');
    expect(state.errors).toEqual(['Couldn’t upload the image. Try again.']);
  });

  it('rejects files that did not normalize to an image', async () => {
    const { state } = renderUpload('~zod/notes/1');

    await act(async () => {
      await state.insertImages!([{ type: 'file', file: {} as File }], 'drop');
    });
    expect(mocks.uploadAssetForUrl).not.toHaveBeenCalled();
    expect(state.errors).toEqual([
      'Couldn’t read that image. Try a JPEG or PNG.',
    ]);
  });
});

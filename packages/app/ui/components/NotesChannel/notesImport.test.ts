import * as DocumentPicker from 'expo-document-picker';
import { Directory as ExpoDirectory } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  buildNotesImportItems,
  readNotesImportSourcesFromDataTransfer,
  readNotesImportSourcesFromDocumentPickerAssets,
  readNotesImportSourcesFromNativeDirectory,
  selectNotesImportSources,
  makeUniqueNoteTitle,
  normalizeTitleKey,
} from './notesImport';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: vi.fn(),
}));

vi.mock('expo-file-system', () => ({
  Directory: {
    pickDirectoryAsync: vi.fn(),
  },
}));

function makeFileEntry(file: File, fullPath: string) {
  return {
    fullPath,
    isDirectory: false,
    isFile: true,
    name: file.name,
    file: (success: (file: File) => void) => success(file),
  };
}

function makeDirectoryEntry(
  name: string,
  fullPath: string,
  entries: unknown[]
) {
  return {
    fullPath,
    isDirectory: true,
    isFile: false,
    name,
    createReader: () => {
      let hasRead = false;
      return {
        readEntries: (success: (entries: unknown[]) => void) => {
          if (hasRead) {
            success([]);
            return;
          }
          hasRead = true;
          success(entries);
        },
      };
    },
  };
}

function makeNativeFile(name: string, contents: string, uri?: string) {
  return {
    name,
    text: vi.fn(async () => contents),
    uri,
  };
}

function makeNativeDirectory(name: string, entries: unknown[], uri?: string) {
  return {
    list: vi.fn(() => entries),
    name,
    uri,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('notes import helpers', () => {
  test('builds import items for single markdown and text files', () => {
    const items = buildNotesImportItems([
      {
        name: 'Plan.md',
        relativePath: 'Plan.md',
        contents: '# Plan',
      },
      {
        name: 'Memo.txt',
        relativePath: 'Memo.txt',
        contents: 'Memo body',
      },
    ]);

    expect(items).toMatchObject([
      {
        title: 'Plan',
        body: '# Plan',
        folderSegments: [],
      },
      {
        title: 'Memo',
        body: 'Memo body',
        folderSegments: [],
      },
    ]);
  });

  test('preserves nested folder paths and ignores unsupported files', () => {
    const items = buildNotesImportItems([
      {
        name: 'Index.markdown',
        relativePath: 'Research/Trips/Index.markdown',
        contents: 'Trip notes',
      },
      {
        name: 'image.png',
        relativePath: 'Research/image.png',
        contents: 'not text',
      },
      {
        name: 'Secret.md',
        relativePath: 'Research/.drafts/Secret.md',
        contents: 'hidden',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Index',
      folderSegments: ['Research', 'Trips'],
      body: 'Trip notes',
    });
  });

  test('dedupes titles within a folder', () => {
    const existingTitles = new Set([normalizeTitleKey('Plan')]);

    expect(makeUniqueNoteTitle('Plan', existingTitles)).toBe('Plan (2)');
    expect(makeUniqueNoteTitle('Plan', existingTitles)).toBe('Plan (3)');
    expect(makeUniqueNoteTitle('', existingTitles)).toBe('Untitled');
  });

  test('reads native document picker assets', async () => {
    const readFileContents = vi.fn(async (uri: string) =>
      uri.endsWith('plan.md') ? '# Plan' : 'hidden'
    );
    const sources = await readNotesImportSourcesFromDocumentPickerAssets(
      [
        { name: 'Plan.md', uri: 'file:///plan.md' },
        { name: '.Secret.md', uri: 'file:///secret.md' },
        { name: 'Photo.png', uri: 'file:///photo.png' },
      ],
      readFileContents
    );

    expect(readFileContents).toHaveBeenCalledTimes(1);
    expect(readFileContents).toHaveBeenCalledWith('file:///plan.md');
    expect(sources).toEqual([
      {
        name: 'Plan.md',
        relativePath: 'Plan.md',
        contents: '# Plan',
      },
    ]);
  });

  test('reads dropped files and folders from desktop browsers', async () => {
    const fileEntry = makeFileEntry(
      new File(['# Plan'], 'Plan.md', { type: 'text/markdown' }),
      '/Research/Plan.md'
    );
    const hiddenEntry = makeFileEntry(
      new File(['hidden'], 'Secret.md', { type: 'text/markdown' }),
      '/Research/.drafts/Secret.md'
    );
    const unsupportedEntry = makeFileEntry(
      new File(['png'], 'Photo.png', { type: 'image/png' }),
      '/Research/Photo.png'
    );
    const directoryEntry = makeDirectoryEntry('Research', '/Research', [
      fileEntry,
      hiddenEntry,
      unsupportedEntry,
    ]);

    const sources = await readNotesImportSourcesFromDataTransfer({
      files: [] as unknown as FileList,
      items: [
        {
          webkitGetAsEntry: () => directoryEntry,
        },
      ] as unknown as DataTransferItemList,
    });

    expect(sources).toEqual([
      {
        name: 'Plan.md',
        relativePath: 'Research/Plan.md',
        contents: '# Plan',
      },
    ]);
  });

  test('reads selected native folders with full folder structure', async () => {
    const planFile = makeNativeFile('Plan.md', '# Plan');
    const indexFile = makeNativeFile('Index.markdown', 'Trip notes');
    const hiddenFile = makeNativeFile('Secret.md', 'hidden');
    const unsupportedFile = makeNativeFile('Photo.png', 'png');
    const directory = makeNativeDirectory('Research', [
      planFile,
      makeNativeDirectory('Trips', [indexFile, unsupportedFile]),
      makeNativeDirectory('.drafts', [hiddenFile]),
    ]);

    const sources = await readNotesImportSourcesFromNativeDirectory(
      directory as never
    );

    expect(sources).toEqual([
      {
        name: 'Plan.md',
        relativePath: 'Research/Plan.md',
        contents: '# Plan',
      },
      {
        name: 'Index.markdown',
        relativePath: 'Research/Trips/Index.markdown',
        contents: 'Trip notes',
      },
    ]);
    expect(hiddenFile.text).not.toHaveBeenCalled();
    expect(unsupportedFile.text).not.toHaveBeenCalled();
  });

  test('selects native markdown and text files', async () => {
    vi.stubGlobal('document', undefined);
    vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          name: 'Plan.md',
          uri: 'file:///plan.md',
          mimeType: 'text/markdown',
          lastModified: 0,
        },
        {
          name: 'Memo.txt',
          uri: 'file:///memo.txt',
          mimeType: 'text/plain',
          lastModified: 0,
        },
      ],
    });
    vi.mocked(FileSystem.readAsStringAsync).mockImplementation(async (uri) =>
      uri.endsWith('plan.md') ? '# Plan' : 'Memo body'
    );

    const sources = await selectNotesImportSources('files');

    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
      copyToCacheDirectory: true,
      multiple: true,
      type: '*/*',
    });
    expect(sources).toEqual([
      {
        name: 'Plan.md',
        relativePath: 'Plan.md',
        contents: '# Plan',
      },
      {
        name: 'Memo.txt',
        relativePath: 'Memo.txt',
        contents: 'Memo body',
      },
    ]);
  });

  test('selects native folders', async () => {
    vi.stubGlobal('document', undefined);
    vi.mocked(ExpoDirectory.pickDirectoryAsync).mockResolvedValue(
      makeNativeDirectory('Research', [makeNativeFile('Plan.md', '# Plan')]) as never
    );

    const sources = await selectNotesImportSources('folder');

    expect(ExpoDirectory.pickDirectoryAsync).toHaveBeenCalled();
    expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
    expect(sources).toEqual([
      {
        name: 'Plan.md',
        relativePath: 'Research/Plan.md',
        contents: '# Plan',
      },
    ]);
  });

  test('returns null when native folder selection is canceled', async () => {
    vi.stubGlobal('document', undefined);
    vi.mocked(ExpoDirectory.pickDirectoryAsync).mockRejectedValue(
      new Error('File picking was cancelled by the user')
    );

    await expect(selectNotesImportSources('folder')).resolves.toBeNull();
  });
});

import * as DocumentPicker from 'expo-document-picker';
import { Directory as ExpoDirectory } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  buildNotesImportItems,
  getNotesImportTargetFolderId,
  makeUniqueNoteTitle,
  normalizeTitleKey,
  readNotesImportSourcesFromDataTransfer,
  selectNotesImportSources,
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

function source(relativePath: string, contents: string) {
  return { relativePath, contents };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('notes import helpers', () => {
  test('builds import items for single markdown and text files', () => {
    const items = buildNotesImportItems([
      source('Plan.md', '# Plan'),
      source('Memo.txt', 'Memo body'),
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
      source('Research/Trips/Index.markdown', 'Trip notes'),
      source('Research/image.png', 'not text'),
      source('Research/.drafts/Secret.md', 'hidden'),
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

  test('uses selected folder, active folder, then root for import target', () => {
    expect(
      getNotesImportTargetFolderId({
        selectedFolderId: 9,
        activeFolderId: 4,
        rootFolderId: 1,
      })
    ).toBe(9);
    expect(
      getNotesImportTargetFolderId({
        selectedFolderId: null,
        activeFolderId: 4,
        rootFolderId: 1,
      })
    ).toBe(4);
    expect(
      getNotesImportTargetFolderId({
        selectedFolderId: null,
        activeFolderId: null,
        rootFolderId: 1,
      })
    ).toBe(1);
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

    expect(sources).toEqual([source('Research/Plan.md', '# Plan')]);
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
        {
          name: '.Secret.md',
          uri: 'file:///secret.md',
          mimeType: 'text/markdown',
          lastModified: 0,
        },
        {
          name: 'Photo.png',
          uri: 'file:///photo.png',
          mimeType: 'image/png',
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
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(2);
    expect(sources).toEqual([
      source('Plan.md', '# Plan'),
      source('Memo.txt', 'Memo body'),
    ]);
  });

  test('selects native folders', async () => {
    vi.stubGlobal('document', undefined);
    const hiddenFile = makeNativeFile('Secret.md', 'hidden');
    const unsupportedFile = makeNativeFile('Photo.png', 'png');
    vi.mocked(ExpoDirectory.pickDirectoryAsync).mockResolvedValue(
      makeNativeDirectory('Research', [
        makeNativeFile('Plan.md', '# Plan'),
        makeNativeDirectory('Trips', [
          makeNativeFile('Index.markdown', 'Trip notes'),
          unsupportedFile,
        ]),
        makeNativeDirectory('.drafts', [hiddenFile]),
      ]) as never
    );

    const sources = await selectNotesImportSources('folder');

    expect(ExpoDirectory.pickDirectoryAsync).toHaveBeenCalled();
    expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
    expect(sources).toEqual([
      source('Research/Plan.md', '# Plan'),
      source('Research/Trips/Index.markdown', 'Trip notes'),
    ]);
    expect(hiddenFile.text).not.toHaveBeenCalled();
    expect(unsupportedFile.text).not.toHaveBeenCalled();
  });

  test('returns null when native folder selection is canceled', async () => {
    vi.stubGlobal('document', undefined);
    vi.mocked(ExpoDirectory.pickDirectoryAsync).mockRejectedValue(
      new Error('File picking was cancelled by the user')
    );

    await expect(selectNotesImportSources('folder')).resolves.toBeNull();
  });
});

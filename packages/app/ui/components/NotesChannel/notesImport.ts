import * as DocumentPicker from 'expo-document-picker';
import { Directory as ExpoDirectory } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

export type NotesImportSource = {
  relativePath: string;
  contents: string;
};

export function getNotesImportTargetFolderId({
  activeFolderId,
  rootFolderId,
  selectedFolderId,
}: {
  activeFolderId: number | null | undefined;
  rootFolderId: number | null | undefined;
  selectedFolderId: number | null | undefined;
}) {
  return activeFolderId ?? selectedFolderId ?? rootFolderId ?? null;
}

type NotesImportItem = {
  body: string;
  folderSegments: string[];
  relativePath: string;
  title: string;
};

type NotesImportMode = 'files' | 'folder';

const SUPPORTED_IMPORT_EXTENSIONS = ['.markdown', '.md', '.txt'];

type NotesImportFileRecord = {
  relativePath: string;
  readText: () => Promise<string>;
};

type NotesNativeEntry = {
  name?: string;
  list?: () => NotesNativeEntry[];
  text?: () => Promise<string>;
  uri?: string;
};

type NotesFileSystemEntry = {
  fullPath?: string;
  file?: (
    success: (file: File) => void,
    failure?: (error: unknown) => void
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: NotesFileSystemEntry[]) => void,
      failure?: (error: unknown) => void
    ) => void;
  };
  isDirectory: boolean;
  isFile: boolean;
  name: string;
};

export function canSelectNotesImportSources(mode: NotesImportMode) {
  return (
    canSelectNotesImportSourcesFromWeb() ||
    mode === 'files' ||
    canSelectNotesImportFolderFromNative()
  );
}

export async function selectNotesImportSources(
  mode: NotesImportMode
): Promise<NotesImportSource[] | null> {
  return canSelectNotesImportSourcesFromWeb()
    ? selectNotesImportSourcesFromWeb(mode)
    : selectNotesImportSourcesFromNative(mode);
}

function canSelectNotesImportSourcesFromWeb() {
  return typeof document !== 'undefined';
}

function selectNotesImportSourcesFromWeb(
  mode: NotesImportMode
): Promise<NotesImportSource[] | null> {
  if (!canSelectNotesImportSourcesFromWeb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt,text/markdown,text/plain';
    input.multiple = true;
    if (mode === 'folder') {
      input.setAttribute('webkitdirectory', '');
    }

    let settled = false;
    const settle = (value: NotesImportSource[] | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    // Dismissal must be detected via the `cancel` event, never via a
    // window-refocus timeout: after a folder pick the browser keeps
    // `input.files` empty until the user accepts its upload-confirmation
    // dialog, which arrives long after the window regains focus. Chromium
    // fires neither `change` nor `cancel` for an empty-directory pick, so
    // this promise may never settle — callers must not gate UI on it.
    input.oncancel = () => settle(null);
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      readNotesImportSourcesFromFiles(files)
        .then(settle)
        .catch((e) => {
          settled = true;
          input.remove();
          reject(e);
        });
    };

    document.body.appendChild(input);
    input.click();
  });
}

async function readNotesImportSourcesFromFiles(files: File[]) {
  return readNotesImportSourcesFromFileRecords(
    files.map((file) => ({
      relativePath: getFileRelativePath(file),
      readText: () => file.text(),
    }))
  );
}

export async function readNotesImportSourcesFromDataTransfer(
  dataTransfer: Pick<DataTransfer, 'files' | 'items'>
) {
  const entries = Array.from(dataTransfer.items ?? []).flatMap((item) => {
    const maybeEntry = item as DataTransferItem & {
      webkitGetAsEntry?: () => unknown;
    };
    const entry = maybeEntry.webkitGetAsEntry?.();
    return isNotesFileSystemEntry(entry) ? [entry] : [];
  });

  if (entries.length === 0) {
    return readNotesImportSourcesFromFiles(
      Array.from(dataTransfer.files ?? [])
    );
  }

  const records = await flatMapAsync(
    entries,
    readNotesImportFileRecordsFromEntry
  );
  return readNotesImportSourcesFromFileRecords(records);
}

async function readNotesImportSourcesFromFileRecords(
  records: NotesImportFileRecord[]
) {
  return Promise.all(
    records
      .filter((record) => isImportableRelativePath(record.relativePath))
      .map(async ({ relativePath, readText }) => ({
        relativePath,
        contents: await readText(),
      }))
  );
}

async function readNotesImportSourcesFromDocumentPickerAssets(
  assets: { name: string; uri: string }[],
  readFileContents: (uri: string) => Promise<string>
) {
  return readNotesImportSourcesFromFileRecords(
    assets.map((asset) => ({
      relativePath: asset.name,
      readText: () => readFileContents(asset.uri),
    }))
  );
}

async function readNotesImportSourcesFromNativeDirectory(
  directory: NotesNativeEntry
) {
  if (!isNotesNativeDirectory(directory)) {
    return [];
  }

  const rootName = getNativeEntryName(directory);
  const records = await readNotesImportFileRecordsFromNativeDirectory(
    directory,
    rootName ? [rootName] : []
  );
  return readNotesImportSourcesFromFileRecords(records);
}

export function buildNotesImportItems(
  sources: NotesImportSource[]
): NotesImportItem[] {
  return sources.flatMap((source) => {
    const relativePath = source.relativePath;
    if (!isImportableRelativePath(relativePath)) {
      return [];
    }

    const pathSegments = splitImportPath(relativePath);
    const fileName = pathSegments[pathSegments.length - 1] ?? relativePath;
    return [
      {
        body: source.contents,
        folderSegments: pathSegments.slice(0, -1),
        relativePath,
        title: titleFromImportFileName(fileName),
      },
    ];
  });
}

export function makeUniqueNoteTitle(
  title: string,
  existingTitles: Set<string>
) {
  const baseTitle = title.trim() || 'Untitled';
  let nextTitle = baseTitle;
  let index = 2;
  while (existingTitles.has(normalizeTitleKey(nextTitle))) {
    nextTitle = `${baseTitle} (${index})`;
    index += 1;
  }
  existingTitles.add(normalizeTitleKey(nextTitle));
  return nextTitle;
}

export function normalizeTitleKey(title: string) {
  return title.trim().toLocaleLowerCase();
}

function isSupportedNotesImportName(name: string) {
  const normalizedName = name.toLocaleLowerCase();
  return SUPPORTED_IMPORT_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );
}

function isImportableRelativePath(relativePath: string) {
  const pathSegments = splitImportPath(relativePath);
  const fileName = pathSegments[pathSegments.length - 1] ?? relativePath;
  return (
    pathSegments.length > 0 &&
    !pathSegments.some(isHiddenPathSegment) &&
    isSupportedNotesImportName(fileName)
  );
}

function titleFromImportFileName(name: string) {
  const extension = SUPPORTED_IMPORT_EXTENSIONS.find((candidate) =>
    name.toLocaleLowerCase().endsWith(candidate)
  );
  return extension ? name.slice(0, -extension.length).trim() : name.trim();
}

function splitImportPath(relativePath: string) {
  return relativePath
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getFileRelativePath(file: File) {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  );
}

function isNotesFileSystemEntry(entry: unknown): entry is NotesFileSystemEntry {
  return (
    entry != null &&
    typeof entry === 'object' &&
    'isDirectory' in entry &&
    'isFile' in entry &&
    'name' in entry
  );
}

function isHiddenPathSegment(segment: string) {
  return segment.startsWith('.') || segment === '__MACOSX';
}

async function readNotesImportFileRecordsFromNativeDirectory(
  directory: NotesNativeEntry & { list: () => NotesNativeEntry[] },
  parentSegments: string[]
): Promise<NotesImportFileRecord[]> {
  return flatMapAsync(directory.list(), (entry) =>
    readNotesImportFileRecordsFromNativeEntry(entry, parentSegments)
  );
}

async function readNotesImportFileRecordsFromNativeEntry(
  entry: NotesNativeEntry,
  parentSegments: string[]
): Promise<NotesImportFileRecord[]> {
  const name = getNativeEntryName(entry);
  if (!name || isHiddenPathSegment(name)) {
    return [];
  }

  if (isNotesNativeDirectory(entry)) {
    return readNotesImportFileRecordsFromNativeDirectory(entry, [
      ...parentSegments,
      name,
    ]);
  }

  if (!isNotesNativeFile(entry)) {
    return [];
  }

  const relativePath = [...parentSegments, name].join('/');
  return [
    {
      relativePath,
      readText: () => entry.text(),
    },
  ];
}

async function readNotesImportFileRecordsFromEntry(
  entry: NotesFileSystemEntry
): Promise<NotesImportFileRecord[]> {
  if (entry.isFile) {
    if (!entry.file) return [];
    const relativePath = normalizeDroppedPath(entry.fullPath || entry.name);
    return [
      {
        relativePath,
        readText: async () => (await getFileFromEntry(entry)).text(),
      },
    ];
  }

  if (!entry.isDirectory || !entry.createReader) {
    return [];
  }

  const childEntries = await readDirectoryEntries(entry);
  return flatMapAsync(childEntries, readNotesImportFileRecordsFromEntry);
}

async function flatMapAsync<T, U>(items: T[], map: (item: T) => Promise<U[]>) {
  return (await Promise.all(items.map(map))).flat();
}

function getFileFromEntry(entry: NotesFileSystemEntry) {
  return new Promise<File>((resolve, reject) => {
    if (!entry.file) {
      reject(new Error('File entry is missing a file reader'));
      return;
    }
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(entry: NotesFileSystemEntry) {
  const reader = entry.createReader?.();
  if (!reader) return [];

  const entries: NotesFileSystemEntry[] = [];

  return new Promise<NotesFileSystemEntry[]>((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };

    readBatch();
  });
}

function normalizeDroppedPath(path: string) {
  return path.replace(/^\/+/, '');
}

function isNotesNativeDirectory(
  entry: NotesNativeEntry
): entry is NotesNativeEntry & { list: () => NotesNativeEntry[] } {
  return typeof entry.list === 'function';
}

function isNotesNativeFile(
  entry: NotesNativeEntry
): entry is NotesNativeEntry & { text: () => Promise<string> } {
  return typeof entry.text === 'function';
}

function getNativeEntryName(entry: NotesNativeEntry) {
  const rawName = entry.name || getNameFromUri(entry.uri) || '';
  let decodedName = safeDecodeURIComponent(rawName);
  // Android SAF entry names decode to full document ids of the form
  // "<volume>:<path>" (e.g. "primary:Notes/Meeting: Q3.md"). Strip only the
  // leading volume prefix — any colon after the first path separator belongs
  // to a real file or folder name and must survive.
  if (entry.uri?.startsWith('content://')) {
    decodedName = decodedName.replace(/^[^:/\\]+:/, '');
  }
  const pathSegments = splitImportPath(decodedName);
  const name = pathSegments[pathSegments.length - 1] ?? decodedName;
  return name.trim();
}

function getNameFromUri(uri?: string) {
  if (!uri) return '';
  try {
    return new URL(uri).pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return (
      uri
        .split(/[\\/]+/)
        .filter(Boolean)
        .pop() ?? ''
    );
  }
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function canSelectNotesImportFolderFromNative() {
  return typeof ExpoDirectory.pickDirectoryAsync === 'function';
}

async function selectNotesImportSourcesFromNative(mode: NotesImportMode) {
  if (mode === 'folder') {
    return selectNotesImportFolderFromNative();
  }

  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: '*/*',
  });

  if (result.assets == null || result.assets.length === 0) return null;

  return readNotesImportSourcesFromDocumentPickerAssets(
    result.assets,
    FileSystem.readAsStringAsync
  );
}

async function selectNotesImportFolderFromNative() {
  if (!canSelectNotesImportFolderFromNative()) return null;

  try {
    const directory = await ExpoDirectory.pickDirectoryAsync();
    return readNotesImportSourcesFromNativeDirectory(directory);
  } catch (e) {
    if (isPickerCancelError(e)) {
      return null;
    }
    throw e;
  }
}

function isPickerCancelError(error: unknown) {
  return (
    error instanceof Error &&
    /pick(?:er|ing).+cancel(?:ed|led)/i.test(error.message)
  );
}

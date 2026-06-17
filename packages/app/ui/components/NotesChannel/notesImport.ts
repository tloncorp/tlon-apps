import * as DocumentPicker from 'expo-document-picker';
import { Directory as ExpoDirectory } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

export type NotesImportSource = {
  name: string;
  relativePath: string;
  contents: string;
};

export type NotesImportItem = {
  body: string;
  folderSegments: string[];
  source: NotesImportSource;
  title: string;
};

export type NotesImportMode = 'files' | 'folder';

const SUPPORTED_IMPORT_EXTENSIONS = ['.markdown', '.md', '.txt'];

type NotesDocumentPickerAsset = {
  name: string;
  uri: string;
};

type NotesImportFileRecord = {
  name: string;
  relativePath: string;
  readText: () => Promise<string>;
};

type NotesNativeFileEntry = {
  name?: string;
  text: () => Promise<string>;
  uri?: string;
};

type NotesNativeDirectoryEntry = {
  list: () => NotesNativeEntry[];
  name?: string;
  uri?: string;
};

type NotesNativeEntry = NotesNativeDirectoryEntry | NotesNativeFileEntry;

type NotesFileSystemEntry = {
  fullPath?: string;
  isDirectory: boolean;
  isFile: boolean;
  name: string;
};

type NotesFileSystemFileEntry = NotesFileSystemEntry & {
  isFile: true;
  file: (
    success: (file: File) => void,
    failure?: (error: unknown) => void
  ) => void;
};

type NotesFileSystemDirectoryEntry = NotesFileSystemEntry & {
  isDirectory: true;
  createReader: () => {
    readEntries: (
      success: (entries: NotesFileSystemEntry[]) => void,
      failure?: (error: unknown) => void
    ) => void;
  };
};

export function canSelectNotesImportSources(mode: NotesImportMode) {
  if (canSelectNotesImportSourcesFromWeb()) {
    return true;
  }

  return mode === 'files' || canSelectNotesImportFolderFromNative();
}

export async function selectNotesImportSources(
  mode: NotesImportMode
): Promise<NotesImportSource[] | null> {
  if (canSelectNotesImportSourcesFromWeb()) {
    return selectNotesImportSourcesFromWeb(mode);
  }

  return selectNotesImportSourcesFromNative(mode);
}

export function canSelectNotesImportSourcesFromWeb() {
  return typeof document !== 'undefined';
}

export function selectNotesImportSourcesFromWeb(
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
    const cleanup = () => {
      window.removeEventListener('focus', handleFocus);
      input.remove();
    };
    const settle = (value: NotesImportSource[] | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const handleFocus = () => {
      window.setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          settle(null);
        }
      }, 300);
    };

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      readNotesImportSourcesFromFiles(files).then(settle).catch((e) => {
        cleanup();
        reject(e);
      });
    };

    document.body.appendChild(input);
    window.addEventListener('focus', handleFocus);
    input.click();
  });
}

export async function readNotesImportSourcesFromFiles(files: File[]) {
  return readNotesImportSourcesFromFileRecords(
    files.map((file) => ({
      name: file.name,
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
    return readNotesImportSourcesFromFiles(Array.from(dataTransfer.files ?? []));
  }

  const records = (
    await Promise.all(entries.map(readNotesImportFileRecordsFromEntry))
  ).flat();
  return readNotesImportSourcesFromFileRecords(records);
}

async function readNotesImportSourcesFromFileRecords(
  records: NotesImportFileRecord[]
) {
  const importableRecords = records.filter((record) =>
    isImportableRelativePath(record.relativePath || record.name)
  );
  const sources = await Promise.all(
    importableRecords.map(async (record) => ({
      name: record.name,
      relativePath: record.relativePath || record.name,
      contents: await record.readText(),
    }))
  );
  return sources;
}

export async function readNotesImportSourcesFromDocumentPickerAssets(
  assets: NotesDocumentPickerAsset[],
  readFileContents: (uri: string) => Promise<string>
) {
  const importableAssets = assets.filter((asset) => {
    return isImportableRelativePath(asset.name);
  });
  const sources = await Promise.all(
    importableAssets.map(async (asset) => ({
      name: asset.name,
      relativePath: asset.name,
      contents: await readFileContents(asset.uri),
    }))
  );
  return sources;
}

export async function readNotesImportSourcesFromNativeDirectory(
  directory: NotesNativeDirectoryEntry
) {
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
    const pathSegments = splitImportPath(source.relativePath || source.name);
    const fileName = pathSegments[pathSegments.length - 1] ?? source.name;
    if (pathSegments.some(isHiddenPathSegment)) {
      return [];
    }
    if (!isSupportedNotesImportName(fileName)) {
      return [];
    }

    return [
      {
        body: source.contents,
        folderSegments: pathSegments.slice(0, -1),
        source,
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
  directory: NotesNativeDirectoryEntry,
  parentSegments: string[]
): Promise<NotesImportFileRecord[]> {
  const entries = directory.list();
  return (
    await Promise.all(
      entries.map((entry) =>
        readNotesImportFileRecordsFromNativeEntry(entry, parentSegments)
      )
    )
  ).flat();
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
  if (!isImportableRelativePath(relativePath)) {
    return [];
  }

  return [
    {
      name,
      relativePath,
      readText: () => entry.text(),
    },
  ];
}

async function readNotesImportFileRecordsFromEntry(
  entry: NotesFileSystemEntry
): Promise<NotesImportFileRecord[]> {
  if (entry.isFile) {
    const relativePath = normalizeDroppedPath(entry.fullPath || entry.name);
    if (!isImportableRelativePath(relativePath)) {
      return [];
    }
    const file = await getFileFromEntry(entry as NotesFileSystemFileEntry);
    return [
      {
        name: file.name || entry.name,
        relativePath,
        readText: () => file.text(),
      },
    ];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const childEntries = await readDirectoryEntries(
    entry as NotesFileSystemDirectoryEntry
  );
  return (
    await Promise.all(childEntries.map(readNotesImportFileRecordsFromEntry))
  ).flat();
}

function getFileFromEntry(entry: NotesFileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(entry: NotesFileSystemDirectoryEntry) {
  const reader = entry.createReader();
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
): entry is NotesNativeDirectoryEntry {
  return typeof (entry as NotesNativeDirectoryEntry).list === 'function';
}

function isNotesNativeFile(entry: NotesNativeEntry): entry is NotesNativeFileEntry {
  return typeof (entry as NotesNativeFileEntry).text === 'function';
}

function getNativeEntryName(entry: NotesNativeEntry) {
  const rawName = entry.name || getNameFromUri(entry.uri) || '';
  const decodedName = safeDecodeURIComponent(rawName);
  const pathSegments = splitImportPath(decodedName);
  const name = pathSegments[pathSegments.length - 1] ?? decodedName;
  if (entry.uri?.startsWith('content://') && name.includes(':')) {
    return name.split(':').pop()?.trim() ?? '';
  }
  return name.trim();
}

function getNameFromUri(uri?: string) {
  if (!uri) return '';
  try {
    return new URL(uri).pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return uri.split(/[\\/]+/).filter(Boolean).pop() ?? '';
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

  if (result.assets == null || result.assets.length === 0) {
    return null;
  }

  return readNotesImportSourcesFromDocumentPickerAssets(
    result.assets,
    FileSystem.readAsStringAsync
  );
}

async function selectNotesImportFolderFromNative() {
  if (!canSelectNotesImportFolderFromNative()) {
    return null;
  }

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
  if (!(error instanceof Error)) {
    return false;
  }
  return /pick(?:er|ing).+cancel(?:ed|led)/i.test(error.message);
}

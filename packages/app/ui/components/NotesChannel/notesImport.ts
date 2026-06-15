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
  const sources = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      relativePath: getFileRelativePath(file),
      contents: await file.text(),
    }))
  );
  return sources.filter(
    (source) => !splitImportPath(source.relativePath).some(isHiddenPathSegment)
  );
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

function isHiddenPathSegment(segment: string) {
  return segment.startsWith('.') || segment === '__MACOSX';
}

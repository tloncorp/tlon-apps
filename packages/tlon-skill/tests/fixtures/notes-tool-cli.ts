// Real notes command parser and file reads, with only the remote API replaced.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { type NotesDeps, run } from '../../scripts/commands/notes';

const stateFile = 'notebook-fixture.json';
type Note = {
  id: number;
  title: string;
  bodyMd: string;
  revision: number;
  folderId: number;
};
function readNote(): Note {
  if (!existsSync(stateFile))
    throw new Error('Note not created in this workspace');
  return JSON.parse(readFileSync(stateFile, 'utf8'));
}
const deps = {
  stdout: (text: string) => process.stdout.write(text),
  stderr: (text: string) => process.stderr.write(text),
  authenticate: async () => {},
  readFile: (path: string) => readFileSync(path, 'utf8'),
  readStdin: async () => {
    throw new Error('Unexpected stdin read');
  },
  isPendingWriteError: () => false,
  notesV1: {
    getNotebook: async () => ({ notebook: { rootFolderId: 0 } }),
    createNote: async (input: {
      title: string;
      body: string;
      folder: number;
    }) => {
      writeFileSync(
        stateFile,
        JSON.stringify({
          id: 1,
          title: input.title,
          bodyMd: input.body,
          folderId: input.folder,
          revision: 0,
        })
      );
    },
    updateNoteBody: async (input: {
      body: string;
      expectedRevision?: number;
    }) => {
      const note = readNote();
      if (input.expectedRevision !== note.revision)
        throw new Error('Revision mismatch');
      writeFileSync(
        stateFile,
        JSON.stringify({
          ...note,
          bodyMd: input.body,
          revision: note.revision + 1,
        })
      );
    },
    getNote: async () => readNote(),
  },
} as unknown as NotesDeps;
if (process.argv[2] !== 'notes') throw new Error('Unexpected command family');
process.exitCode = await run(process.argv.slice(3), deps);

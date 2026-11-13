import { type DurableClient, getDurableClient } from './durable';
import { notes } from './requests';

// Notes channels on the local backend. The %notes v1 requests in
// `notesApi.ts` are answered from the Slab notebook routes of the channel's
// room and translated back into the v1 wire shapes, so the notes facade, its
// parsing and its conflict handling stay the same on both backends.

type Params = Record<string, string | number>;
type Init = {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};
type Route = (client: DurableClient, params: Params, init: Init) => unknown;

interface NoteRecord {
  id: number;
}

const routes = new Map<unknown, Route>([
  [notes.notebooksGet, listNotebooks],
  [notes.notebooksPost, createNotebook],
  [
    notes.notebookGet,
    async (client, params) => ({
      host: params.host,
      flagName: params.name,
      notebook: (await read<{ notebook: unknown }>(client, params)).notebook,
      visibility: 'private',
    }),
  ],
  [
    notes.members,
    async (client, params) =>
      (await read<{ members: unknown[] }>(client, params)).members,
  ],
  [notes.foldersGet, (client, params) => read(client, params, '/folders')],
  [
    notes.folderGet,
    (client, params) => read(client, params, `/folders/${params.folderId}`),
  ],
  [
    notes.foldersPost,
    (client, params, { body }) =>
      write(client, params, '/folders', {
        name: body?.folderName,
        parent: body?.parent,
      }).then(ok),
  ],
  [
    notes.folderPut,
    (client, params, { body }) =>
      write(client, params, `/folders/${params.folderId}`, {
        name: body?.folderName,
        parent: body?.parent,
      }).then(ok),
  ],
  [
    notes.folderDelete,
    (client, params, { query }) =>
      write(client, params, `/folders/${params.folderId}`, {
        delete: true,
        recursive: query?.recursive === 'true',
      }).then(ok),
  ],
  [notes.notesGet, (client, params) => read(client, params, '/notes')],
  [
    notes.noteGet,
    (client, params) => read(client, params, `/notes/${params.id}`),
  ],
  [
    notes.notesPost,
    async (client, params, { body }) =>
      noteWritten(
        params,
        'note-created',
        await write<NoteRecord>(client, params, '/notes', body)
      ),
  ],
  [
    notes.notePut,
    async (client, params, { body }) => {
      let result: { status: 'ok' | 'no-change'; note: NoteRecord };
      try {
        result = await write(client, params, `/notes/${params.id}`, body);
      } catch (error) {
        // A stale revision is a 409, which the v1 surface reports as a
        // typed conflict envelope.
        if (
          error instanceof Error &&
          error.message.startsWith('Local backend: 409')
        )
          return {
            body: {
              type: 'error',
              errorType: 'conflict',
              message: error.message,
            },
          };
        throw error;
      }
      return result.status === 'no-change'
        ? { body: { type: 'no-change' } }
        : noteWritten(params, 'note-updated', result.note);
    },
  ],
  [
    notes.noteDelete,
    (client, params) =>
      write(client, params, `/notes/${params.id}`, { delete: true }).then(ok),
  ],
  [notes.noteHistory, history],
  [notes.search, search],
]);

/** Stands in for `httpRequest` on the %notes v1 entries. */
export function durableNotesRequest(entry: unknown) {
  return async (params: Params, init: Init = {}) => {
    const route = routes.get(entry);
    if (!route)
      throw new Error('This action is not yet supported by the local backend');
    return route(getDurableClient()!, params, init);
  };
}

const subscriptions = new Map<number, { close(): void }>();
let nextSubscription = -1;

export function subscribeDurableNotebook(
  flag: { host: string; name: string },
  onChange: () => void
) {
  const client = getDurableClient()!;
  const stream = client.events(client.room(channelOf(flag)).id);
  stream.onmessage = onChange;
  const id = nextSubscription--;
  subscriptions.set(id, stream);
  return id;
}

export function unsubscribeDurableNotebook(id: number) {
  subscriptions.get(id)?.close();
  subscriptions.delete(id);
}

export async function changeDurableNotebook(
  flag: { host: string; name: string },
  type: 'joinChannel' | 'leaveChannel' | 'deleteChannel'
) {
  const client = getDurableClient()!;
  const channelId = channelOf(flag);
  const room = client.bootstrap.rooms.find(
    (room) => room.channelId === channelId
  );
  // Deleting a notes channel also deletes its notebook, so the separate
  // notebook delete that follows it finds nothing left to do.
  if (!room && type === 'deleteChannel') return;
  await client.directory({ type, channelId, groupId: room?.groupId });
}

function channelOf(flag: { host: string | number; name: string | number }) {
  return `notes/${flag.host}/${flag.name}`;
}

function base(client: DurableClient, params: Params) {
  return `/rooms/${client.room(channelOf(params as { host: string; name: string })).id}/notebook`;
}

function read<T = unknown>(client: DurableClient, params: Params, path = '') {
  return client.request<T>(base(client, params) + path);
}

function write<T = unknown>(
  client: DurableClient,
  params: Params,
  path: string,
  body: unknown
) {
  return client.request<T>(base(client, params) + path, body ?? {});
}

function ok() {
  return { body: { type: 'ok' } };
}

function noteWritten(
  params: Params,
  type: 'note-created' | 'note-updated',
  note: NoteRecord
) {
  const flag = { host: params.host, flagName: params.name };
  return {
    body: {
      type: 'ok',
      response: {
        ...flag,
        update: {
          type: 'note-update',
          ...flag,
          noteUpdate: { type, id: note.id, note },
        },
      },
    },
  };
}

// v1 search resumes from a number, while the local backend's cursor is
// opaque, so each cursor is handed out as a number to bring back.
const searchCursors = new Map<number, string>();

async function search(client: DurableClient, params: Params, { query }: Init) {
  const terms = new URLSearchParams({ needle: String(query?.needle ?? '') });
  const cursor =
    query?.from === undefined
      ? undefined
      : searchCursors.get(Number(query.from));
  if (cursor) terms.set('cursor', cursor);
  const page = await read<{ notes: unknown[]; nextCursor: string | null }>(
    client,
    params,
    `/search?${terms}`
  );
  let last = 0;
  if (page.nextCursor) {
    last = searchCursors.size + 1;
    searchCursors.set(last, page.nextCursor);
  }
  return { last, notes: page.notes };
}

// The v1 history is one list; the local backend pages it newest first and
// keeps at most 200 revisions.
async function history(client: DurableClient, params: Params) {
  const revisions: unknown[] = [];
  let before: number | null = null;
  do {
    const page: { revisions: unknown[]; nextCursor: number | null } =
      await read(
        client,
        params,
        `/notes/${params.id}/history${before === null ? '' : `?before=${before}`}`
      );
    revisions.push(...page.revisions);
    before = page.nextCursor;
  } while (before !== null);
  return revisions;
}

function listNotebooks(client: DurableClient) {
  return client.bootstrap.rooms
    .filter(
      (room) =>
        room.channelId.startsWith('notes/') && !room.left?.includes(client.user)
    )
    .map((room) => {
      const [, host, flagName] = room.channelId.split('/');
      return {
        host,
        flagName,
        notebook: { id: 1, title: room.title },
        visibility: 'private',
      };
    });
}

async function createNotebook(
  client: DurableClient,
  _params: Params,
  { body }: Init
) {
  const group = body?.group as { host: string; flagName: string };
  const host = client.bootstrap.user.contactId;
  const flagName = crypto.randomUUID();
  await client.directory({
    type: 'createChannel',
    groupId: `${group.host}/${group.flagName}`,
    id: channelOf({ host, name: flagName }),
    title: body?.title,
    readers: body?.readers,
  });
  return {
    body: {
      type: 'notebook',
      notebook: {
        host,
        flagName,
        notebook: { id: 1, title: body?.title, rootFolderId: 1 },
        visibility: 'private',
      },
    },
  };
}

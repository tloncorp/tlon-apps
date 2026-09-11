import { Urbit, configureClient, notesV1 } from '@tloncorp/api';

// Backend-only setup. Uses production APIs on the disposable local fake ship.
export async function seedNotes({
  url,
  code,
  groupId,
  tag,
}: {
  url: string;
  code: string;
  groupId: string;
  tag: string;
}) {
  const client = new Urbit(url, code);
  (client as Urbit & {ship:string}).ship = 'zod';
  await client.connect();
  await configureClient({
    shipName: 'zod',
    shipUrl: url,
    getCode: async () => code,
    client,
  });
  const title = `QA Notes ${tag}`;
  const notebook = await notesV1.createGroupNotebook({
    title,
    group: { host: '~zod', flagName: groupId.split('/')[1] },
    readers: [],
  });
  const flag = `notes/${notebook.host}/${notebook.flagName}`;
  const detail = await notesV1.getNotebook(flag);
  const root = detail.notebook.rootFolderId;
  await notesV1.createFolder({ flag, parent: root, name: 'QA Folder' });
  const folders = await notesV1.listFolders(flag);
  const folder = folders.find((f) => f.name === 'QA Folder');
  if (!folder) throw new Error('Created notes folder did not read back');
  const body = [
    '# Header QA',
    'This disposable note may be edited during this run.',
    ...Array.from(
      { length: 18 },
      (_, i) =>
        `Paragraph ${i + 1}: scroll past this content to inspect header clearance, keyboard dismissal and the final line.`
    ),
    'END OF QA NOTE',
  ].join('\n\n');
  for (let i = 1; i <= 10; i++)
    await notesV1.createNote({
      flag,
      folder: root,
      title: `QA Note ${String(i).padStart(2, '0')}`,
      body,
    });
  for (let i = 1; i <= 4; i++)
    await notesV1.createNote({
      flag,
      folder: folder.id,
      title: `Folder Note ${i}`,
      body,
    });
  const notes = await notesV1.listNotes(flag);
  const members = await notesV1.listMembers(flag);
  if (
    notes.length !== 14 ||
    !notes.some((n) => n.folderId === folder.id) ||
    !members.some((m) => m.ship === '~zod' && m.roles.includes('owner'))
  )
    throw new Error(
      'Notes fixture failed authoritative data/permission verification'
    );
  const search = await notesV1.searchNotes({ flag, needle: 'QA Note' });
  if (!search.notes.length)
    throw new Error('Notes search did not find the seeded content');
  return {
    recipe: 'notes-v1',
    verified: true,
    groupId,
    channelId: flag,
    channelTitle: title,
    folderId: folder.id,
    folderTitle: 'QA Folder',
    editableNoteTitle: 'QA Note 01',
    rootFolderId: root,
    noteCount: notes.length,
    searchVerified: true,
    writable: true,
    permissionLimit:
      'This backend gives group readers edit access. Read-only/search-unsupported action combinations use component regression tests, not invented ship states.',
  };
}

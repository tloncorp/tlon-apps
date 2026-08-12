import { type Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// The native %notes channel, not the legacy diary type the notebook-*.spec.ts
// files cover. These tests exist for the delta-sync work: mutations apply
// their own write response instead of polling a snapshot back, the stream
// carries changes between clients, and import submits a whole tree at once.

const CHANNEL = 'Test Notes';

/**
 * Records traffic to the %notes v1 HTTP surface so a test can assert what a
 * mutation actually costs. Every notes read and write goes through
 * `/notes/~/v1/...` (see requestJson in packages/api).
 *
 * `reads()` counts only notebook-scoped GETs — the notebook detail, its notes,
 * folders and members. Those are the snapshot fetches a mutation used to poll
 * back, and one appearing in a mutation's window is the regression this work
 * removed. The bare `/v1/notebooks` list is excluded: it backs the unrelated
 * joined-notebook check, whose own cache can refetch at any moment.
 */
function trackNotesRequests(page: Page) {
  let requests: { method: string; url: string }[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/notes/~/v1')) {
      requests.push({ method: request.method(), url });
    }
  });
  const isNotebookScoped = (url: string) =>
    /\/notes\/~\/v1\/notebooks\/~[^/]+\//.test(new URL(url).pathname);
  return {
    reset: () => {
      requests = [];
    },
    reads: () =>
      requests.filter((r) => r.method === 'GET' && isNotebookScoped(r.url)),
    writes: () => requests.filter((r) => r.method !== 'GET'),
    total: () => requests.length,
  };
}

/**
 * Wait until the notebook stops talking to the server, so a measurement window
 * starts from rest. Opening a channel kicks off an initial snapshot sync whose
 * four GETs would otherwise land inside the next mutation's window and read as
 * a read-back.
 */
async function waitForNotesIdle(
  page: Page,
  requests: ReturnType<typeof trackNotesRequests>,
  quietMs = 1500
) {
  let previous = -1;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const seen = requests.total();
    if (seen === previous) return;
    previous = seen;
    await page.waitForTimeout(quietMs);
  }
}

function describeRequests(requests: { method: string; url: string }[]) {
  return requests.map((r) => `${r.method} ${new URL(r.url).pathname}`);
}

/**
 * Land on Home before starting. The app restores its last location, so a
 * context reused across runs can open straight into a channel — and the
 * fixtures' cleanup, which needs the group list, silently no-ops there.
 */
function acceptConfirmDialogs(page: Page) {
  // Destructive notes actions confirm via window.confirm on web. Playwright
  // dismisses dialogs by default, which silently cancels the delete.
  page.on('dialog', (dialog) => {
    void dialog.accept();
  });
}

async function goHome(page: Page) {
  if (
    await page
      .getByTestId('HomeSidebarHeader')
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }
  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
    timeout: 15000,
  });
}

async function createNotesChannel(page: Page) {
  await helpers.openGroupSettings(page);
  await expect(page.getByTestId('GroupChannels')).toBeVisible({
    timeout: 10000,
  });
  await page.getByTestId('GroupChannels').click();
  await helpers.createChannel(page, CHANNEL, 'notes');
  await openNotesChannel(page);
}

async function openNotesChannel(page: Page) {
  // A just-joined group's channel list churns while it syncs: the row can
  // appear, detach mid-click, and briefly vanish again. Retry the whole open
  // rather than trying to catch a stable moment.
  await expect(async () => {
    const channel = page.getByTestId(`ChannelListItem-${CHANNEL}`);
    await expect(channel).toBeVisible({ timeout: 5000 });

    const joinButton = channel.getByText('Join');
    if (await joinButton.isVisible().catch(() => false)) {
      await joinButton.waitFor({ state: 'hidden', timeout: 10000 });
    }

    await channel.click({ timeout: 5000 });
    await expect(page.getByTestId('NotesChannelRoot')).toBeVisible({
      timeout: 10000,
    });
  }).toPass({ timeout: 90000 });
}

async function createFolder(page: Page, name: string) {
  await page.getByTestId('NotesRootNewHeaderAction').click();
  await page.getByTestId('NotesNewFolderAction').click();
  await expect(page.getByTestId('NotesAddFolderDialog')).toBeVisible({
    timeout: 10000,
  });
  const dialog = page.getByTestId('NotesAddFolderDialog');
  await dialog.getByPlaceholder('Folder name').fill(name);
  // "Add folder" also names the menu item that opened this dialog, so scope
  // the click to the dialog's own submit button.
  await dialog.getByText('Add folder', { exact: true }).click();
  await expect(page.getByTestId('NotesAddFolderDialog')).not.toBeVisible({
    timeout: 10000,
  });
}

function folderRow(page: Page, name: string) {
  return page.getByTestId(`NotesFolderRow-${name}`);
}

/**
 * Open a row's action menu. The overflow trigger only renders while the row is
 * hovered, which is more deterministic than the right-click path the row also
 * supports.
 */
async function openFolderMenu(page: Page, name: string) {
  const row = folderRow(page, name);
  await row.hover();
  await row.getByTestId('NotesRowOverflowTrigger').click();
}

function noteRows(page: Page) {
  return page.getByTestId(/^NotesNoteRow-/);
}

/**
 * Drop files onto the channel as if dragged from a file manager. Nested paths
 * ride on `webkitRelativePath`, which is what a real folder drop sets and what
 * the importer reads; a synthetic DataTransferItem has no
 * `webkitGetAsEntry()`, so the importer falls back to `dataTransfer.files`.
 */
async function dropImportFiles(
  page: Page,
  files: { path: string; contents: string }[]
) {
  await page.getByTestId('NotesChannelRoot').evaluate((target, payload) => {
    const dataTransfer = new DataTransfer();
    for (const entry of payload) {
      const name = entry.path.split('/').pop() ?? entry.path;
      const file = new File([entry.contents], name, { type: 'text/markdown' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: entry.path,
      });
      dataTransfer.items.add(file);
    }
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer })
      );
    }
  }, files);
}

// The cross-ship test runs first, before any other test has created a group.
// `createGroup`'s fallback identifies the new group by the shared
// "Untitled group" label, which stops being unique the moment a second one
// exists — and the fixtures' cleanup cannot reliably remove them from the
// desktop group list.
test('a folder created on one ship reaches the other over the stream', async ({
  zodSetup,
  tenSetup,
}) => {
  // Two ships, a group invite and a cross-ship sync: well past the default.
  test.setTimeout(180_000);

  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;
  const groupName = '~ten, ~zod';
  acceptConfirmDialogs(zodPage);

  await goHome(zodPage);
  await helpers.createGroup(zodPage);
  await helpers.inviteMembersToGroup(zodPage, ['ten']);
  await helpers.navigateBack(zodPage);
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });
  await createNotesChannel(zodPage);

  await goHome(tenPage);
  await helpers.acceptGroupInvite(tenPage, groupName);
  await openNotesChannel(tenPage);

  // ~ten is subscribed and idle. The update for this write has to carry the
  // whole folder, because ~ten no longer resyncs on a stream fact.
  await createFolder(zodPage, 'Shared');
  await expect(folderRow(zodPage, 'Shared')).toBeVisible({ timeout: 15000 });
  await expect(folderRow(tenPage, 'Shared')).toBeVisible({ timeout: 30000 });

  // ...and a delete has to remove it again.
  await openFolderMenu(zodPage, 'Shared');
  await zodPage.getByTestId('NotesDeleteFolderAction').click();
  await expect(folderRow(zodPage, 'Shared')).not.toBeVisible({
    timeout: 15000,
  });
  await expect(folderRow(tenPage, 'Shared')).not.toBeVisible({
    timeout: 30000,
  });

  await goHome(zodPage);
  await goHome(tenPage);
});

test('notes mutations apply their write response without reading back', async ({
  zodSetup,
}) => {
  const zodPage = zodSetup.page;
  const notesRequests = trackNotesRequests(zodPage);
  acceptConfirmDialogs(zodPage);

  await goHome(zodPage);
  await helpers.createGroup(zodPage);
  await createNotesChannel(zodPage);

  // Each block scopes the request window to one mutation. A GET in that window
  // means the client went back to the server to learn what its own write did.

  await waitForNotesIdle(zodPage, notesRequests);
  notesRequests.reset();
  await createFolder(zodPage, 'Alpha');
  await expect(folderRow(zodPage, 'Alpha')).toBeVisible({ timeout: 15000 });
  expect(notesRequests.writes().length).toBeGreaterThan(0);
  expect(describeRequests(notesRequests.reads())).toEqual([]);

  await waitForNotesIdle(zodPage, notesRequests);
  notesRequests.reset();
  await zodPage.getByTestId('NotesRootNewHeaderAction').click();
  await zodPage.getByTestId('NotesNewNoteAction').click();
  await expect(zodPage.getByTestId('NotesTitleInput')).toBeVisible({
    timeout: 15000,
  });
  await expect(noteRows(zodPage)).toHaveCount(1, { timeout: 15000 });
  expect(notesRequests.writes().length).toBeGreaterThan(0);
  expect(describeRequests(notesRequests.reads())).toEqual([]);

  await waitForNotesIdle(zodPage, notesRequests);
  notesRequests.reset();
  await openFolderMenu(zodPage, 'Alpha');
  await zodPage.getByTestId('NotesRenameFolderAction').click();
  await expect(zodPage.getByTestId('NotesRenameFolderDialog')).toBeVisible({
    timeout: 10000,
  });
  await zodPage
    .getByTestId('NotesRenameFolderDialog')
    .getByPlaceholder('Folder name')
    .fill('Beta');
  await zodPage.keyboard.press('Enter');
  await expect(folderRow(zodPage, 'Beta')).toBeVisible({ timeout: 15000 });
  await expect(folderRow(zodPage, 'Alpha')).not.toBeVisible();
  expect(notesRequests.writes().length).toBeGreaterThan(0);
  expect(describeRequests(notesRequests.reads())).toEqual([]);

  await waitForNotesIdle(zodPage, notesRequests);
  notesRequests.reset();
  await openFolderMenu(zodPage, 'Beta');
  await zodPage.getByTestId('NotesDeleteFolderAction').click();
  await expect(folderRow(zodPage, 'Beta')).not.toBeVisible({ timeout: 15000 });
  expect(notesRequests.writes().length).toBeGreaterThan(0);
  expect(describeRequests(notesRequests.reads())).toEqual([]);

  await goHome(zodPage);
});

test('importing merges into folders that already exist', async ({
  zodSetup,
}) => {
  const zodPage = zodSetup.page;
  const notesRequests = trackNotesRequests(zodPage);

  await goHome(zodPage);
  await helpers.createGroup(zodPage);
  await createNotesChannel(zodPage);

  await createFolder(zodPage, 'docs');
  await expect(folderRow(zodPage, 'docs')).toBeVisible({ timeout: 15000 });

  // The import names a folder that is already there. The agent merges into it
  // rather than creating a second one, so the client submits the path as-is.
  await waitForNotesIdle(zodPage, notesRequests);
  notesRequests.reset();
  await dropImportFiles(zodPage, [
    { path: 'docs/first.md', contents: '# First' },
    { path: 'docs/second.md', contents: '# Second' },
    { path: 'top.md', contents: '# Top' },
  ]);

  await expect(zodPage.getByText('Imported 3 notes.')).toBeVisible({
    timeout: 30000,
  });

  // Exactly one docs folder, not two.
  await expect(folderRow(zodPage, 'docs')).toHaveCount(1);

  // The whole tree went up in one submission, not one write per note.
  expect(notesRequests.writes().length).toBe(1);

  // Only `top` sits at the root; `first` and `second` went into docs.
  await expect(noteRows(zodPage)).toHaveCount(1, { timeout: 15000 });
  await expect(noteRows(zodPage).filter({ hasText: 'top' })).toHaveCount(1);

  await folderRow(zodPage, 'docs').click();
  await expect(noteRows(zodPage)).toHaveCount(2, { timeout: 15000 });
  await expect(noteRows(zodPage).filter({ hasText: 'first' })).toHaveCount(1);
  await expect(noteRows(zodPage).filter({ hasText: 'second' })).toHaveCount(1);

  await goHome(zodPage);
});

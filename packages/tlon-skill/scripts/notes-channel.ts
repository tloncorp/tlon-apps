import type { NotesV1NotebookSummary } from '@tloncorp/api';

import { commandError } from './commands/command';

// Shared, dependency-injected logic for creating a `%notes` group channel.
//
// Phase D assumes `arthyn/notes` PR 7 (group-channel mode): a notebook bound to
// a group is registered as a `%groups` channel by `%notes` itself. The skill
// only calls the `notesV1.createGroupNotebook` API helper and verifies the
// listing — it never pokes `%channels` and never adds the group listing itself.

const VERIFY_ATTEMPTS = 5;
const VERIFY_DELAY_MS = 500;

export interface NotesChannelDeps {
  // POST the group-bound notebook via `@tloncorp/api` notesV1 and return its
  // summary (the API unwraps the envelope / rejects errors).
  createGroupNotesNotebook: (input: {
    title: string;
    group: { host: string; flagName: string };
    readers: string[];
  }) => Promise<NotesV1NotebookSummary>;
  // Channel ids currently listed in the target group (used to confirm `%notes`
  // registered the group listing).
  getGroupChannelIds: (groupId: string) => Promise<string[]>;
  // Strict notebook removal (propagates failures) for the failed-create rollback.
  deleteNotesNotebookStrict: (nest: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
}

export interface NotesChannelInput {
  groupId: string;
  title: string;
}

// 'registered': a successful group read saw the listing.
// 'absent': the *final* poll succeeded and still did not see the listing.
// 'unverifiable': the final poll failed, so we can't be sure the listing didn't
// register after our last successful read.
type ListingVerdict = 'registered' | 'absent' | 'unverifiable';

// Poll the target group until the new `notes/...` listing appears (it registers
// asynchronously, like the other post-mutation verifications in groups.ts).
// "absent" is only concluded from the final poll: registration is async, so an
// early successful poll can legitimately show the listing missing, and if the
// later polls then fail we must not treat that stale early read as proof of
// absence — that would roll back a possibly-valid create.
async function verifyListing(
  groupId: string,
  nest: string,
  deps: NotesChannelDeps
): Promise<ListingVerdict> {
  let lastReadSucceeded = false;
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const channelIds = await deps.getGroupChannelIds(groupId);
      if (channelIds.includes(nest)) {
        return 'registered';
      }
      lastReadSucceeded = true;
    } catch {
      // Transient read failure; retry. Leaves lastReadSucceeded false so a
      // trailing failure is reported as unverifiable rather than absent.
      lastReadSucceeded = false;
    }
    if (attempt < VERIFY_ATTEMPTS) {
      await deps.sleep(VERIFY_DELAY_MS);
    }
  }
  return lastReadSucceeded ? 'absent' : 'unverifiable';
}

export async function createNotesChannelInGroup(
  input: NotesChannelInput,
  deps: NotesChannelDeps
): Promise<string> {
  const slash = input.groupId.indexOf('/');
  if (slash === -1) {
    throw commandError(
      `Invalid group id: ${input.groupId}. Expected ~host/name.`
    );
  }
  const groupHost = input.groupId.slice(0, slash);
  const groupName = input.groupId.slice(slash + 1);

  deps.log(`Creating %notes channel "${input.title}" in ${input.groupId}...`);

  // The `{group, readers}` payload is the PR-7 group-mode contract — empty
  // readers means group-wide readable; `%notes` registers the %groups listing.
  const summary = await deps.createGroupNotesNotebook({
    title: input.title,
    group: { host: groupHost, flagName: groupName },
    readers: [],
  });
  const nest = `notes/${summary.host}/${summary.flagName}`;

  // Pre-PR-7 degradation guard. A create against an un-upgraded %notes silently
  // makes a *solo* notebook, and the response can't tell the difference — the
  // notebook-summary JSON is identical for a solo and a group create. So verify
  // the listing actually registered. Never treat the bare create (or its
  // response) as the capability check.
  const verdict = await verifyListing(input.groupId, nest, deps);
  if (verdict === 'registered') {
    return nest;
  }
  if (verdict === 'absent') {
    // A successful read confirmed the listing is missing: the host didn't
    // register it (likely pre-PR-7). Roll back the stray solo notebook with the
    // strict delete so we can report whether cleanup actually succeeded.
    try {
      await deps.deleteNotesNotebookStrict(nest);
    } catch {
      throw commandError(
        `%notes created ${nest} but it did not register as a channel in ${input.groupId} — ` +
          `the host may not support group-mode notes (PR 7), and removing the stray notebook also failed. ` +
          `Manual cleanup of ${nest} may be required.`
      );
    }
    throw commandError(
      `%notes created ${nest} but it did not register as a channel in ${input.groupId} — ` +
        `the host may not support group-mode notes (PR 7). Removed the stray notebook.`
    );
  }
  // unverifiable: every group read failed, so we can't tell whether the listing
  // registered. Don't roll back a possibly-valid create — leave it for the
  // operator rather than risk deleting a good notebook.
  throw commandError(
    `%notes created ${nest} but its channel listing in ${input.groupId} could not be verified ` +
      `(the group read failed). Left the notebook in place — verify it manually and remove it if it is a stray solo notebook.`
  );
}

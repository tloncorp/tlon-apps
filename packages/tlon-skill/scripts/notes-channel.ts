import type { NotesV1NotebookSummary } from '@tloncorp/api';

import { commandError, errorMessage } from './commands/command';

// Shared, dependency-injected logic for creating a `%notes` group channel.
//
// A notebook bound to a group is registered as a `%groups` channel by `%notes`
// itself. The skill only calls the `notesV1.createGroupNotebook` API helper and
// verifies the listing — it never pokes `%channels` or adds the group listing.

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
  // Read the reader roles for a channel in a group (used for post-create
  // reader verification). Returns null if the channel is not found.
  getChannelReaders: (
    groupId: string,
    nest: string
  ) => Promise<string[] | null>;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
}

export interface NotesChannelInput {
  groupId: string;
  title: string;
  readers: string[];
  onCreated?: (nest: string) => void;
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
// absence.
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
  const groupParts = input.groupId.split('/');
  if (
    groupParts.length !== 2 ||
    !groupParts[0] ||
    !groupParts[1] ||
    !Array.isArray(input.readers) ||
    input.readers.some((reader) => typeof reader !== 'string')
  ) {
    throw commandError(
      `Invalid group id or readers for ${input.groupId}. Expected ~host/name and an explicit reader-role array.`
    );
  }
  const [groupHost, groupName] = groupParts;
  const readers = input.readers;

  deps.log(`Creating %notes channel "${input.title}" in ${input.groupId}...`);

  const summary = await deps.createGroupNotesNotebook({
    title: input.title,
    group: { host: groupHost, flagName: groupName },
    readers,
  });
  const nest = `notes/${summary.host}/${summary.flagName}`;

  if (input.onCreated) {
    input.onCreated(nest);
  }

  const verdict = await verifyListing(input.groupId, nest, deps);
  if (verdict === 'registered') {
    let actualReaders: string[] | null;
    try {
      actualReaders = await deps.getChannelReaders(input.groupId, nest);
    } catch (error) {
      throw commandError(
        `%notes created ${nest}, but its readers could not be verified: ${errorMessage(
          error
        )}. ` +
          `The notebook was left in place; to remove it, run \`tlon notes notebook-delete ${nest} --yes\`.`
      );
    }
    if (actualReaders === null) {
      throw commandError(
        `%notes created ${nest} but its channel record in ${input.groupId} could not be read for reader verification. ` +
          `Left the notebook in place — verify its readers manually.`
      );
    }
    const expectedSorted = readers.slice().sort();
    const actualSorted = actualReaders.slice().sort();
    if (JSON.stringify(expectedSorted) !== JSON.stringify(actualSorted)) {
      throw commandError(
        `%notes created ${nest} but its readers [${actualSorted.join(', ')}] do not match the approved set [${expectedSorted.join(', ')}]. ` +
          `Left the notebook in place — restrict its readers manually before use.`
      );
    }
    return nest;
  }
  if (verdict === 'absent') {
    throw commandError(
      `%notes created ${nest} but it did not register as a channel in ${input.groupId} — ` +
        `the host may not support group-mode notes, or the listing poke has not arrived. ` +
        `Left the notebook in place — verify it manually and remove it if it is a stray solo notebook.`
    );
  }
  throw commandError(
    `%notes created ${nest} but its channel listing in ${input.groupId} could not be verified ` +
      `(the group read failed). Left the notebook in place — verify it manually and remove it if it is a stray solo notebook.`
  );
}

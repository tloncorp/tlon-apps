import type { NotesV1NotebookSummary } from '@tloncorp/api';

import { commandError, errorMessage } from './commands/command';

// Shared, dependency-injected logic for creating a `%notes` group channel.
//
// A notebook bound to a group is registered as a `%groups` channel by `%notes`
// itself. The skill only calls the `notesV1.createGroupNotebook` API helper and
// verifies the listing — it never pokes `%channels` or adds the group listing.

const VERIFY_ATTEMPTS = 5;
const VERIFY_DELAY_MS = 500;

export interface GroupListingPollDeps {
  getGroupChannelIds: (groupId: string) => Promise<string[]>;
  sleep: (ms: number) => Promise<void>;
}

export interface NotesChannelDeps extends GroupListingPollDeps {
  // Fail closed before `%notes` creates anything unless the acting ship can
  // administer the target group.
  assertCanAdministerGroup: (groupId: string) => Promise<void>;
  // POST the group-bound notebook via `@tloncorp/api` notesV1 and return its
  // summary (the API unwraps the envelope / rejects errors).
  createGroupNotesNotebook: (input: {
    title: string;
    group: { host: string; flagName: string };
    readers: string[];
  }) => Promise<NotesV1NotebookSummary>;
  // Remove the backend notebook when successful group reads prove that the
  // requested group registration never appeared.
  deleteStandaloneNotebook: (nest: string) => Promise<void>;
  // Read the reader roles for a channel in a group (used for post-create
  // reader verification). Returns null if the channel is not found.
  getChannelReaders: (
    groupId: string,
    nest: string
  ) => Promise<string[] | null>;
  log: (message: string) => void;
}

export interface NotesChannelInput {
  groupId: string;
  title: string;
  readers: string[];
  onCreated?: (nest: string) => void;
}

/** A definite pre-write rejection; callers must not offer orphan cleanup. */
export class NotesChannelPreflightError extends Error {
  override name = 'NotesChannelPreflightError';
}

/** The created backend notebook was definitely removed before this error. */
export class NotesChannelRolledBackError extends Error {
  override name = 'NotesChannelRolledBackError';
}

export type GroupListingGoal = 'present-in-all' | 'absent-from-all';
export type GroupListingVerdict =
  | 'confirmed'
  | 'not-confirmed'
  | 'unverifiable';

// Group channel listings update asynchronously after a `%notes` mutation.
// Read every relevant group concurrently on each attempt so confirmation is
// based on one coherent polling round, not on independently exhausted loops.
export async function pollGroupListings(
  groupIds: string[],
  nest: string,
  goal: GroupListingGoal,
  deps: GroupListingPollDeps
): Promise<GroupListingVerdict> {
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    const reads = await Promise.all(
      groupIds.map(async (groupId) => {
        try {
          const channelIds = await deps.getGroupChannelIds(groupId);
          return {
            succeeded: true as const,
            containsNest: channelIds.includes(nest),
          };
        } catch {
          return { succeeded: false as const, containsNest: false };
        }
      })
    );
    const confirmed = reads.every(
      (read) =>
        read.succeeded &&
        (goal === 'present-in-all' ? read.containsNest : !read.containsNest)
    );
    if (confirmed) return 'confirmed';

    if (attempt === VERIFY_ATTEMPTS) {
      const hasSuccessfulOpposingRead = reads.some(
        (read) =>
          read.succeeded &&
          (goal === 'present-in-all' ? !read.containsNest : read.containsNest)
      );
      if (hasSuccessfulOpposingRead) {
        return 'not-confirmed';
      }
      return reads.some((read) => !read.succeeded)
        ? 'unverifiable'
        : 'not-confirmed';
    }

    await deps.sleep(VERIFY_DELAY_MS);
  }

  return 'unverifiable';
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

  try {
    await deps.assertCanAdministerGroup(input.groupId);
  } catch (error) {
    throw new NotesChannelPreflightError(errorMessage(error));
  }

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

  const verdict = await pollGroupListings(
    [input.groupId],
    nest,
    'present-in-all',
    deps
  );
  if (verdict === 'confirmed') {
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
  if (verdict === 'not-confirmed') {
    try {
      await deps.deleteStandaloneNotebook(nest);
    } catch (error) {
      throw commandError(
        `%notes created ${nest} but it did not register as a channel in ${input.groupId}, ` +
          `and rollback failed: ${errorMessage(error)}. ` +
          `Do not write to this notebook; remove it with ` +
          `\`tlon notes notebook-delete ${nest} --yes\`.`
      );
    }
    throw new NotesChannelRolledBackError(
      `%notes created ${nest} but it did not register as a channel in ${input.groupId} — ` +
        `the host may not support group-mode notes, or the listing poke has not arrived. ` +
        `Rolled back the standalone notebook; no Notebook channel was created.`
    );
  }
  throw commandError(
    `%notes created ${nest} but its channel listing in ${input.groupId} could not be verified ` +
      `(the group read failed). Left the notebook in place — verify it manually and remove it if it is a stray solo notebook.`
  );
}

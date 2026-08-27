import { commandError, errorMessage } from './commands/command';
import { archiveRename } from './migrate-helpers';
import {
  type ConvertedNote,
  MIGRATION_LIMITS,
  type MigrationDeps,
  type MigrationOptions,
  type MigrationPlan,
  chunkNotes,
  computeWriteWidening,
  measureEnvelopeBytes,
  normalizeShip,
  parseNest,
} from './notes-migrate';
import {
  PREFLIGHT_ENVELOPE_CONTEXT,
  prepareMigration,
} from './notes-migrate-plan';
import {
  NotesChannelPreflightError,
  NotesChannelRolledBackError,
} from './notes-channel';

export interface ApplySummary {
  notesImported: number;
  targetNest: string;
  archiveTitle: string;
  archiveRenamed: boolean;
  archiveOnly: MigrationPlan['metrics'];
  warnings: string[];
}

export interface ApplyResult {
  status: 'success';
  summary: ApplySummary;
}

function exactPairKey(title: string, body: string): string {
  return JSON.stringify([title, body]);
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function verifyTargetContents(
  expected: ConvertedNote[],
  actual: { title: string; bodyMd?: string | null }[]
): void {
  const expectedPairs = new Map<string, number>();
  const actualPairs = new Map<string, number>();
  for (const note of expected) {
    increment(expectedPairs, exactPairKey(note.title, note.body));
  }
  for (const [index, note] of actual.entries()) {
    if (typeof note.title !== 'string' || typeof note.bodyMd !== 'string') {
      throw commandError(
        `Read-back note ${index + 1} is missing an exact title or Markdown body`
      );
    }
    increment(actualPairs, exactPairKey(note.title, note.bodyMd));
  }

  const missing = [...expectedPairs].reduce(
    (count, [key, expectedCount]) =>
      count + Math.max(0, expectedCount - (actualPairs.get(key) ?? 0)),
    0
  );
  const unexpected = [...actualPairs].reduce(
    (count, [key, actualCount]) =>
      count + Math.max(0, actualCount - (expectedPairs.get(key) ?? 0)),
    0
  );
  if (missing > 0 || unexpected > 0) {
    throw commandError(
      `Read-back verification failed: ${missing} expected note(s) missing and ${unexpected} unexpected note(s) present`
    );
  }
}

function validateNotebookDetail(
  detail: { rootFolderId: number; host: string; flagName: string },
  actingShip: string,
  targetNest: string
): void {
  // %notes derives rootFolderId as notebookId + 1 (desk/lib/notes/json.hoon:16-17),
  // so a real notebook never has root folder 0.
  if (!Number.isSafeInteger(detail.rootFolderId) || detail.rootFolderId < 1) {
    throw commandError(
      `Target ${targetNest}: rootFolderId is missing or malformed`
    );
  }
  if (!detail.flagName) {
    throw commandError(`Target ${targetNest}: flagName is missing`);
  }
  // The import addresses the notebook by the flag this response carries, while
  // read-back addresses `targetNest`. If they disagree the notes land in a
  // different notebook than the one we verify and name in recovery, so refuse.
  if (detail.flagName !== parseNest(targetNest).name) {
    throw commandError(
      `Target ${targetNest}: notebook detail reports flagName "${detail.flagName}", not "${
        parseNest(targetNest).name
      }"`
    );
  }
  if (normalizeShip(detail.host) !== normalizeShip(actingShip)) {
    throw commandError(
      `Target ${targetNest} is hosted by ${normalizeShip(
        detail.host
      )}, not acting ship ${normalizeShip(actingShip)}`
    );
  }
}

async function importChunks(
  notes: ConvertedNote[],
  targetFlag: string,
  rootFolderId: number,
  deps: MigrationDeps
): Promise<void> {
  const chunks = chunkNotes(notes, MIGRATION_LIMITS.HTTP_BATCH_ENVELOPE_BYTES, {
    ...PREFLIGHT_ENVELOPE_CONTEXT,
    flag: targetFlag,
    folder: rootFolderId,
  });

  for (const [index, chunk] of chunks.entries()) {
    const requestId = deps.generateRequestId();
    if (!requestId || requestId === '0v0') {
      throw commandError(
        `Request-id generator returned an invalid zero value for chunk ${
          index + 1
        }`
      );
    }
    const actualBytes = measureEnvelopeBytes(chunk, {
      flag: targetFlag,
      folder: rootFolderId,
      requestId,
    });
    if (actualBytes > MIGRATION_LIMITS.HTTP_BATCH_ENVELOPE_BYTES) {
      throw commandError(
        `Chunk ${index + 1}/${chunks.length} exceeds the byte cap after target resolution (${actualBytes} bytes)`
      );
    }

    let echoedId: string;
    try {
      echoedId = await deps.batchImport({
        flag: targetFlag,
        folder: rootFolderId,
        notes: chunk.map(({ title, body }) => ({ title, body })),
        requestId,
      });
    } catch (error) {
      throw commandError(
        `Chunk ${index + 1}/${chunks.length} failed: ${errorMessage(
          error
        )}. The import may or may not have landed.`
      );
    }
    if (echoedId !== requestId) {
      throw commandError(
        `Chunk ${index + 1}/${chunks.length} echoed request id ${echoedId}, expected ${requestId}. The import may or may not have landed.`
      );
    }
  }
}

function sameRoleSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((role, index) => role === right[index]);
}

/**
 * Both inputs to the consent decision — who can read the source, and who can
 * write it — are captured in `plan` before the source read, which is the
 * longest step in a migration (up to 50 paged round trips). Either can drift in
 * that window, and each drift is harmful in its own way:
 *
 *   - readers tighten: creating from the stale snapshot republishes the whole
 *     diary at the old, wider visibility while the original looks locked down.
 *   - writers tighten: the run was gated on a widening verdict computed from
 *     open writers, so a migration that now *does* widen write access proceeds
 *     without the operator ever being asked.
 *
 * Re-read both immediately before the create and recompute the gate on live
 * values. Nothing has been written at this point, so drift is a clean refusal
 * with no cleanup to perform.
 */
async function assertPermissionsUnchanged(
  plan: MigrationPlan,
  options: MigrationOptions,
  deps: MigrationDeps
): Promise<void> {
  const group = await deps.getGroup(plan.group);
  const sourceChannel = group.channels[plan.sourceNest];
  if (!sourceChannel || !Array.isArray(sourceChannel.readers)) {
    throw commandError(
      `Source ${plan.sourceNest}: reader roles could not be re-read before creating the target — refusing to proceed`
    );
  }

  const perm = await deps.getChannelPerm(plan.sourceNest);
  if (!Array.isArray(perm.writers)) {
    throw commandError(
      `Source ${plan.sourceNest}: writers could not be re-read before creating the target — refusing to proceed`
    );
  }

  const writerRolesChanged = !sameRoleSet(plan.writerRoles, perm.writers);
  const liveWidening = computeWriteWidening({
    readerRoles: sourceChannel.readers,
    writerRoles: perm.writers,
    admins: group.admins,
    privacy: group.privacy,
  });

  const approved = [...plan.readerRoles].sort();
  const live = [...sourceChannel.readers].sort();
  const changed =
    approved.length !== live.length ||
    approved.some((role, index) => role !== live[index]);
  if (changed) {
    throw commandError(
      `Source ${plan.sourceNest}: reader roles changed during the migration ` +
        `(planned for [${approved.join(', ')}], now [${live.join(', ')}]). ` +
        `Nothing was created — re-run to migrate at the current permissions.`
    );
  }

  if (liveWidening.widening && !options.allowWriteWidening) {
    const changedInput = writerRolesChanged
      ? 'writer roles changed'
      : 'group admin or privacy settings changed';
    throw commandError(
      `Source ${plan.sourceNest}: ${changedInput} during the migration and it would now widen write access: ` +
        `${liveWidening.reasons.join('; ')}. Nothing was created — re-run to review the current permissions.`
    );
  }
}

export async function executeApply(
  options: MigrationOptions,
  deps: MigrationDeps
): Promise<ApplyResult> {
  if (!options.yes) {
    throw commandError('Migration apply requires explicit confirmation');
  }
  const prepared = await prepareMigration(options, deps);
  if (prepared.plan.writeWidening && !options.allowWriteWidening) {
    throw commandError(
      `Migration would widen write access: ${prepared.plan.wideningReasons.join(
        '; '
      )}. Refusing without explicit acceptance — pass --allow-write-widening to accept.`
    );
  }

  await deps.assertServerIdentity();
  await assertPermissionsUnchanged(prepared.plan, options, deps);

  let targetNest: string | null = null;
  try {
    targetNest = await deps.createGroupNotebook({
      title: prepared.plan.targetTitle,
      groupId: prepared.plan.group,
      readers: [...prepared.plan.readerRoles],
      onCreated: (nest) => {
        targetNest = nest;
        deps.log(`Target notebook created: ${nest}`);
      },
    });
  } catch (error) {
    if (error instanceof NotesChannelPreflightError) {
      throw commandError(
        `${errorMessage(error)}\nNothing was created; fix the group access and retry.`
      );
    }
    if (error instanceof NotesChannelRolledBackError) {
      throw commandError(errorMessage(error));
    }
    if (!targetNest) {
      throw commandError(
        `${errorMessage(
          error
        )}\nNotebook creation may or may not have landed. Look for a notebook with the requested title in the Notes app and remove it before retrying.`
      );
    }
    throw commandError(
      `${errorMessage(
        error
      )}\nThe target notebook exists. ${deps.recoveryInstruction(targetNest)}`
    );
  }

  try {
    const actingShip = normalizeShip(deps.getActingShip());
    const detail = await deps.getNotebookDetail(targetNest);
    validateNotebookDetail(detail, actingShip, targetNest);
    const targetFlag = `${normalizeShip(detail.host)}/${detail.flagName}`;

    await importChunks(
      prepared.convertedNotes,
      targetFlag,
      detail.rootFolderId,
      deps
    );

    const targetNotes = await deps.listNotes(targetNest);
    verifyTargetContents(prepared.convertedNotes, targetNotes);

    const warnings: string[] = [];
    let archiveRenamed = false;
    try {
      await archiveRename(
        deps,
        prepared.plan.group,
        prepared.plan.sourceNest,
        prepared.plan.archiveTitle
      );
      archiveRenamed = true;
    } catch (error) {
      const warning = `Migration succeeded, but the source rename failed: ${errorMessage(
        error
      )}. Rename the channel in the app.`;
      warnings.push(warning);
      deps.log(warning);
    }

    return {
      status: 'success',
      summary: {
        notesImported: prepared.convertedNotes.length,
        targetNest,
        archiveTitle: prepared.plan.archiveTitle,
        archiveRenamed,
        archiveOnly: prepared.plan.metrics,
        warnings,
      },
    };
  } catch (error) {
    throw commandError(
      `${errorMessage(
        error
      )}\nThe target notebook exists. ${deps.recoveryInstruction(targetNest)}`
    );
  }
}

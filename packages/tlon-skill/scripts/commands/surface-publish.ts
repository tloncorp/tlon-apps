import type { SurfaceSpec } from '@tloncorp/api';

import { canonicalJson } from '../surface-canonical-json';
import {
  type RubricArtifact,
  rubricResiduals,
  specInitialState,
  surfaceCanonicalHash,
  validateRubricArtifact,
} from '../surface-rubric-artifact';
import {
  type ObservationBudget,
  type SurfaceDeps,
  type SurfaceReport,
  assertSnapshotRecordValid,
  emitReport,
  observeUntil,
  parseSurfaceArgs,
  readJsonFile,
  requireValue,
  surfaceError,
  usageSurfaceError,
} from './surface-common';
import {
  type ResolvedSurfaceChannel,
  postSurfaceRecord,
  hydratePosts,
  readChannelSpec,
  readSurfacePreState,
  resolveSurfaceChannel,
} from './surface-writer';
import { assertPreStateInScope } from '../surface-write-scope';
import {
  ALLOW_ABORTED_FLAG,
  abortedWaivedLines,
  assertNoAbortedEntries,
  hasSurfaceStateRecords,
  newestSequenceNum,
  repairPendingMigration,
} from './surface-records';

/**
 * The acknowledgment for publishing over a definition nobody can read.
 *
 * Declared above the help string it is interpolated into: a `const` read
 * before its initializer is a temporal-dead-zone throw at module load, which
 * would take out the whole CLI rather than one command.
 */
export const ALLOW_UNREADABLE_FLAG = '--allow-unreadable-definition';

export const SURFACE_PUBLISH_HELP = `Usage: tlon surface publish <channel> --bundle <path> --spec <path> --rubric <path> [options]

Publish an app to a dashboard channel: gate, upload, write the definition,
mirror it, and (when preserving state) post the migration snapshot.

The revision number is DERIVED, never supplied. It bumps when the published
content changes and stays put when it does not, so a changed bundle can
never ship under an unchanged revision. A republish of byte-identical
content is reported as an explicit no-op — the command neither bumps nor
silently skips.

The spec file owns: version, surfaceId, title, initialState, actions,
recipe, preserveState and bundle.shellVersion. This command owns
bundle.sha256, bundle.size, bundle.assetRef and specRevision; any value
those carry in the file is ignored.

A COMPLETED RUBRIC IS REQUIRED. \`surface preview\` writes a pre-keyed scoring
sheet next to its screenshots; fill it in and pass it here. Publish checks
that all twelve capture cells carry an observation, that every applicable rubric
checks carry a verdict and a cell, and that the sheet names the exact bundle,
the exact spec, and the state its captures opened on — completeness and
identity only. Whether the observations are any good is not machine-checkable
and is not checked.

Changing the spec alone invalidates the sheet, even when the bundle is
byte-identical: a renamed title or a different starting state changes what
the twelve captures show. So does scoring a \`surface preview --state <file>\`
run: those captures are of a board this app does not open on, and publish
refuses them. Score such a run for your own eyes; publish on a sheet from a
run without \`--state\`. Either way: re-preview and re-score.

Options:
  --bundle <path>       App bundle — JavaScript source, not a document
  --spec <path>         Spec JSON
  --rubric <path>       The completed scoring sheet from \`surface preview\`
  --preserve-state      Carry the current state across the revision, posting
                        the migration snapshot in this same command
  --reupload            Re-upload the bundle even when its bytes are unchanged
  --allow-surface-id-change
                        Permit a surfaceId different from the channel's
                        current one (this orphans all existing state)
  ${ALLOW_UNREADABLE_FLAG}
                        Publish over a definition this build cannot read.
                        Without it, a channel whose definition does not
                        validate is a refusal: publish cannot tell you what
                        it is about to replace, so it does not replace it
  ${ALLOW_ABORTED_FLAG}
                        Preserve state even though an entry in the fold
                        stopped early. The migration snapshot is that entry's
                        partial prefix, and the entry ends up under the
                        boundary tagged with a revision that no longer folds,
                        so the ops it lost can never be re-posted — check
                        \`tlon surface state\` first
  --json                Emit a machine-readable result
  -h, --help            Show this help

Example:
  tlon surface publish chat/~zod/dash-abc --bundle ./app.js --spec ./spec.json \\
    --rubric ./surface-preview/rubric.template.json`;

const DEFAULT_SHELL_VERSION = 1;
const BUNDLE_CONTENT_TYPE = 'application/javascript';

/**
 * Reads the scoring sheet and refuses unless it is complete and it names these
 * exact bytes under this exact definition.
 *
 * Shared by `surface publish` and `surface fork`, so every word here is a
 * statement about both.
 *
 * Three refusals, kept distinct because they are three different repairs and
 * because collapsing them would let the "publish refuses an incomplete rubric"
 * test pass while only ever exercising `JSON.parse`:
 *
 * - `rubric-unreadable` — the file is not a rubric. Rewrite it.
 * - `rubric-incomplete` — the shape is right and work is missing. Fill it in.
 * - `rubric-mismatch` — the work is complete, for a different app, a different
 *   build of this one, or a different definition of it. Re-preview and
 *   re-score.
 *
 * The three hash comparisons are the load-bearing ones, and it takes all three.
 * The twelve captures are a function of (bundle, spec, starting state) at a
 * fixed clock; `preview` stamps all three into the template it writes, so a
 * sheet naming this triple is a sheet whose cells were rendered from these
 * bytes, under this definition, opening on the state this definition opens on.
 * Any one of them changing invalidates the sheet, which is expensive and
 * correct: scoring revision 1 and spending it on revision 3 is exactly the
 * shortcut a loop under time pressure takes.
 *
 * Each was added because the ones before it were measured blind to a real case.
 * The bundle hash missed a spec-only revision — a renamed title, different
 * action copy, a `memberInteraction` claim added — which keeps the bundle's
 * hash while changing every capture. Bundle plus spec then missed a
 * SUBSTITUTED STATE: `surface preview --state <file>` renders a state the
 * author supplies in place of `initialState`, `RUBRIC.md` tells the scorer to
 * do exactly that for an app whose interesting screens no button reaches, and
 * the resulting sheet was indistinguishable from one scored on the app's own
 * opening screen. Only a discriminator that moves with the thing it names
 * discriminates (D138).
 */
export function requireCompletedRubric(
  deps: SurfaceDeps,
  input: {
    path: string;
    channelId: string;
    surfaceId: string;
    sha256: string;
    /** the raw spec being published, so a display-only app is scored as one */
    spec: unknown;
    /**
     * `surfaceCanonicalHash` of the RAW definition this write will land — the
     * spec file's verbatim parse for publish, the derived fork spec for fork.
     * The caller computes it because the two commands hash different documents;
     * what they share is the helper and the rule that it is never taken over a
     * validated view (D72).
     */
    specSha256: string;
    /**
     * `surfaceCanonicalHash` of the state this definition OPENS ON — its own
     * `initialState`, read off the same raw object `specSha256` was taken over.
     *
     * Not made redundant by `specSha256` even though `initialState` is part of
     * the spec. The spec hash answers "is this the same definition"; this one
     * answers "was the renderer fed that definition's own starting point, or
     * something the author substituted with `--state`". A change that makes
     * either redundant has broken the other.
     */
    stateSha256: string;
  }
): RubricArtifact {
  let text: string;
  try {
    text = deps.readTextFile(input.path);
  } catch (error) {
    throw surfaceError(
      'rubric-unreadable',
      `The completed rubric could not be read at ${input.path}: ${
        error instanceof Error ? error.message : String(error)
      }. \`surface preview\` writes a pre-keyed one next to its screenshots.`,
      { channel: input.channelId, path: input.path }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw surfaceError(
      'rubric-unreadable',
      `${input.path} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { channel: input.channelId, path: input.path }
    );
  }

  const validation = validateRubricArtifact(parsed, input.spec);
  if (!validation.ok) {
    throw surfaceError(
      validation.code,
      `${input.path} is not a completed rubric: ${validation.problems.join('; ')}. Nothing was uploaded or written. Completeness is all this checks — whether what you wrote is any good is yours.`,
      {
        channel: input.channelId,
        path: input.path,
        problems: validation.problems,
      }
    );
  }

  const artifact = validation.artifact;
  if (artifact.surfaceId !== input.surfaceId) {
    throw surfaceError(
      'rubric-mismatch',
      `${input.path} scores surface "${artifact.surfaceId}", and this publish is surface "${input.surfaceId}". A rubric for one app says nothing about another.`,
      {
        channel: input.channelId,
        path: input.path,
        scored: artifact.surfaceId,
        publishing: input.surfaceId,
      }
    );
  }
  if (artifact.bundleSha256 !== input.sha256) {
    throw surfaceError(
      'rubric-mismatch',
      `${input.path} scores a bundle hashing to ${artifact.bundleSha256}, and the bundle being published hashes to ${input.sha256}. Those are different builds, so the twelve captures behind that sheet are not this app's. Re-run \`surface preview\` on these bytes and score what it renders.`,
      {
        channel: input.channelId,
        path: input.path,
        scored: artifact.bundleSha256,
        publishing: input.sha256,
      }
    );
  }
  // The bundle hash cannot see this one, which is the entire reason it exists:
  // the bytes are byte-identical and the screen is not.
  if (artifact.specSha256 !== input.specSha256) {
    throw surfaceError(
      'rubric-mismatch',
      `${input.path} scores a spec hashing to ${artifact.specSha256}, and the spec being written hashes to ${input.specSha256}. The bundle is the same build, so this is a SPEC-only change — a renamed title, different copy, a different starting state — and the twelve captures behind that sheet were rendered under the older definition. Re-run \`surface preview\` on this spec and score what it renders.`,
      {
        channel: input.channelId,
        path: input.path,
        scoredSpec: artifact.specSha256,
        writingSpec: input.specSha256,
      }
    );
  }
  // Neither hash above can see this one. The bundle is these bytes and the spec
  // is this definition; the cells were simply opened on a different board than
  // the one this definition starts on, because `--state` put it there.
  if (artifact.stateSha256 !== input.stateSha256) {
    const substituted = artifact.stateSource === 'override';
    throw surfaceError(
      'rubric-mismatch',
      `${input.path} scores captures that opened on a state hashing to ${artifact.stateSha256}, and this definition opens on one hashing to ${input.stateSha256}. ${
        substituted
          ? "The sheet says `--state` stood in for the spec's own starting point, so those twelve captures are of a board this app never opens on — score it that way for your own eyes if you like, but publish on a sheet from a run without `--state`."
          : "The sheet was scored on a spec that opened somewhere else, so its captures are not this app's opening screen."
      } Re-run \`surface preview\` and score what it renders.`,
      {
        channel: input.channelId,
        path: input.path,
        scoredState: artifact.stateSha256,
        scoredStateSource: artifact.stateSource,
        writingState: input.stateSha256,
      }
    );
  }

  return artifact;
}

/**
 * The spec's content, with the revision removed.
 *
 * The revision is a correlation number for events and snapshots, not part
 * of what the spec SAYS, so it cannot participate in deciding whether the
 * spec changed — otherwise the answer would be circular. Everything else,
 * including the bundle hash and the storage location, is content: a client
 * that would fetch different bytes or run a different app is looking at a
 * different definition.
 */
export function specContentKey(spec: Record<string, unknown>): string {
  const { specRevision: _ignored, ...content } = spec;
  return canonicalJson(content);
}

export interface RevisionDecision {
  changed: boolean;
  revision: number;
  previousRevision: number | null;
}

/**
 * Content decides the revision. D59 is the reason this is a function of the
 * bytes rather than a counter the caller increments: a bundle-hash change
 * published at an unchanged revision is precisely the defect that shipped,
 * and the only durable fix is to make the number underivable by hand.
 */
export function decideRevision(
  current: { spec: SurfaceSpec; raw: string } | null,
  candidate: Record<string, unknown>
): RevisionDecision {
  if (!current) {
    return { changed: true, revision: 1, previousRevision: null };
  }
  // Compare the VERBATIM previous cell against the raw candidate. Keying the
  // previous side off `current.spec` compares a schema-stripped view with an
  // unstripped one, so any key the schema does not declare reads as a
  // difference that is not there: the revision bumps, prior events stop
  // folding against the new revision, and live state resets.
  //
  // Declaring a field (as `duplicatesTolerated` now is) fixes that field. It
  // does not fix this comparison — the next undeclared key reproduces the
  // same false bump with the same blast radius. Raw-to-raw is what closes
  // the class; the declared field is defence in depth behind it.
  //
  // `specRevision` still comes from the validated spec: it is a declared
  // scalar, so stripping cannot touch it, and `specContentKey` drops it from
  // the content comparison anyway.
  const previousContent = JSON.parse(current.raw) as Record<string, unknown>;
  const changed = specContentKey(previousContent) !== specContentKey(candidate);
  return {
    changed,
    revision: changed
      ? current.spec.specRevision + 1
      : current.spec.specRevision,
    previousRevision: current.spec.specRevision,
  };
}

/**
 * A bundle's storage file name: its own hash.
 *
 * Content-NAMED rather than content-addressed, because `uploadFile` builds
 * every storage key as `<ship>/<now>-<fileName>` and nothing in its API
 * takes the key itself. The hash in the name keeps a stored object
 * identifiable, and the property that actually matters — identical bytes
 * keep an identical `assetRef` — comes from not re-uploading unchanged
 * bytes at all.
 */
export function bundleFileName(sha256: string): string {
  return `${sha256}.js`;
}

interface SpecFileFields {
  surfaceId: string;
  shellVersion: number;
  preserveState: boolean;
  rest: Record<string, unknown>;
}

function readSpecFile(value: unknown, path: string): SpecFileFields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw surfaceError(
      'spec-file-invalid',
      `The spec at ${path} must be a JSON object.`,
      { path }
    );
  }
  const record = { ...(value as Record<string, unknown>) };
  const surfaceId = record.surfaceId;
  if (typeof surfaceId !== 'string' || surfaceId.length === 0) {
    throw surfaceError(
      'spec-file-invalid',
      `The spec at ${path} needs a non-empty "surfaceId".`,
      { path }
    );
  }
  const bundle =
    typeof record.bundle === 'object' && record.bundle !== null
      ? (record.bundle as Record<string, unknown>)
      : {};
  const declaredShell = bundle.shellVersion;
  const shellVersion =
    typeof declaredShell === 'number' ? declaredShell : DEFAULT_SHELL_VERSION;
  const preserveState = record.preserveState === true;

  delete record.bundle;
  delete record.specRevision;
  delete record.preserveState;

  return { surfaceId, shellVersion, preserveState, rest: record };
}

export async function runSurfacePublish(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    {
      value: ['--bundle', '--spec', '--rubric'],
      boolean: [
        '--json',
        '--preserve-state',
        '--reupload',
        '--allow-surface-id-change',
        ALLOW_UNREADABLE_FLAG,
        ALLOW_ABORTED_FLAG,
      ],
    },
    SURFACE_PUBLISH_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_PUBLISH_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const channelId = parsed.positional[0];
  if (!channelId) {
    throw usageSurfaceError('a channel id is required', SURFACE_PUBLISH_HELP);
  }
  if (parsed.positional.length > 1) {
    throw usageSurfaceError(
      `Unexpected argument: ${parsed.positional[1]}`,
      SURFACE_PUBLISH_HELP
    );
  }
  const bundlePath = requireValue(parsed, '--bundle', SURFACE_PUBLISH_HELP);
  const specPath = requireValue(parsed, '--spec', SURFACE_PUBLISH_HELP);
  const rubricPath = requireValue(parsed, '--rubric', SURFACE_PUBLISH_HELP);
  const budget = deps.observationBudget;
  const allowAborted = parsed.flags.has(ALLOW_ABORTED_FLAG);

  await deps.authenticate();
  const resolved = await resolveSurfaceChannel(deps, channelId, {
    intent: 'write',
    operation: 'surface publish',
  });

  const bundleBytes = readBundle(deps, bundlePath);
  const bundleSource = deps.readTextFile(bundlePath);
  // The verbatim parse, kept before `readSpecFile` takes its own copy and
  // deletes the fields publish owns. The rubric's spec binding is taken over
  // THIS — the whole document the author previewed, undeclared keys and all —
  // because a hash over `specFile.rest` would be blind to a change in
  // `bundle.shellVersion`, which picks the shell the twelve cells rendered in
  // (D72: raw to raw, and the raw is the whole cell).
  const specRaw = readJsonFile(deps, specPath, 'spec');
  const specFile = readSpecFile(specRaw, specPath);
  const publishedTitle =
    typeof specFile.rest.title === 'string' && specFile.rest.title.length > 0
      ? specFile.rest.title
      : 'dashboard';

  const sha256 = deps.sha256Hex(bundleBytes);
  const size = bundleBytes.byteLength;

  // Before the gate, before the upload, before anything is written: the
  // cheapest refusal first, and the one that must not be reachable around.
  const rubric = requireCompletedRubric(deps, {
    path: rubricPath,
    channelId,
    surfaceId: specFile.surfaceId,
    sha256,
    spec: specFile.rest,
    specSha256: surfaceCanonicalHash(specRaw),
    // What this definition opens on. `--preserve-state` does not change it:
    // the state a preserving revision carries is a property of the CHANNEL, not
    // of this write, and it moves whenever a member acts — binding the sheet to
    // it would refuse correct work for anyone who previewed a minute too early.
    // So the sheet is bound to the one starting point the write does determine,
    // and a preserving revision previewed with `--state` needs a plain run for
    // the sheet it publishes on.
    stateSha256: surfaceCanonicalHash(specInitialState(specRaw)),
  });

  const currentRead = readChannelSpec(deps, resolved.channel);
  if (currentRead.status === 'version-too-new') {
    throw surfaceError(
      'spec-version-too-new',
      `${channelId} currently carries a version ${currentRead.version} definition, which this build does not understand. Publishing over it would replace a definition it cannot read.`,
      { channel: channelId, version: currentRead.version }
    );
  }
  // The bound pre-state, before any of the branches below decide what to do
  // with the current definition. `resolveSurfaceChannel` has already refused a
  // write to the wrong channel or the wrong group; this is the other half of
  // the bound — the right channel, but no longer the definition anybody
  // asserted anything about.
  if (deps.writeScope?.preState) {
    assertPreStateInScope(deps.writeScope, {
      channelId,
      observed: await readSurfacePreState(deps, channelId, currentRead),
      operation: 'surface publish',
    });
  }

  // A FAILED LOOKUP IS A FAILED OPERATION.
  //
  // This used to print a note and carry on. That is the generic-file fallback
  // 6a caught, seen from the tool's side: the bot could not find the app it was
  // revising, reached for whatever `app.js`/`spec.json` were lying around — the
  // potluck's leftovers, hash-confirmed — and aimed them at the kanban channel.
  // The `surfaceId` guard below refused it. But that guard only fires when
  // `current` is non-null, and `current` is null on BOTH "never published" and
  // "published, unreadable". So on a channel whose definition had stopped
  // validating, the same mistake would have gone all the way through: someone
  // else's app published over a live board, its state orphaned, reported as a
  // clean first publish at revision 1.
  //
  // The remedy is removal, not a better guard. Reading the channel's current
  // definition is how publish learns what this channel IS; when that read
  // fails, publish does not know what it is about to overwrite, and every
  // downstream check that depends on knowing — the surfaceId comparison, the
  // revision derivation, the state carried by --preserve-state — is running on
  // an assumption rather than an observation. The `surfaceId` guard stays
  // exactly where it was, as the last line it was always meant to be, and it is
  // now a line that always runs.
  //
  // The escape hatch is explicit and it names what it destroys (D99): a
  // definition nobody can read is still a definition somebody published, and
  // replacing it is a decision, not a default.
  if (currentRead.status === 'invalid') {
    if (!parsed.flags.has(ALLOW_UNREADABLE_FLAG)) {
      throw surfaceError(
        'current-definition-unreadable',
        `${channelId} holds a definition this build cannot read, so publishing over it would replace an app without knowing which app it is — and every existing event and snapshot would be orphaned under a revision restarting at 1. Read it back with \`tlon surface show ${channelId}\` first. If replacing it is genuinely what you mean, pass ${ALLOW_UNREADABLE_FLAG}.`,
        { channel: channelId, status: currentRead.status }
      );
    }
    deps.stderr(
      `Replacing ${channelId}'s unreadable definition with surface "${specFile.surfaceId}" on the strength of ${ALLOW_UNREADABLE_FLAG}. The revision restarts at 1, every existing event and snapshot is orphaned, and no check compared this app against the one being replaced — because there was nothing readable to compare it to.\n`
    );
  }
  const current = currentRead.status === 'valid' ? currentRead.spec : null;

  if (
    current &&
    current.surfaceId !== specFile.surfaceId &&
    !parsed.flags.has('--allow-surface-id-change')
  ) {
    throw surfaceError(
      'surface-id-changed',
      `${channelId} is surface "${current.surfaceId}" but the spec declares "${specFile.surfaceId}". Every existing event and snapshot names the old id, so changing it abandons the dashboard's state. Fix the spec, or pass --allow-surface-id-change if that is what you mean.`,
      {
        channel: channelId,
        current: current.surfaceId,
        candidate: specFile.surfaceId,
      }
    );
  }

  const preserveState =
    parsed.flags.has('--preserve-state') || specFile.preserveState;

  // The gate runs before anything is uploaded or written. `assetRef` is the
  // one field it cannot judge (no rule reads a storage location), so the
  // linted spec carries the location the bundle will occupy — the current
  // one when the bytes are unchanged, a placeholder otherwise — and the
  // final spec is re-validated against the schema once the real location is
  // known.
  const bytesUnchanged =
    current !== null &&
    current.bundle.sha256 === sha256 &&
    current.bundle.size === size;
  const provisionalAssetRef = bytesUnchanged
    ? current.bundle.assetRef
    : `surface://pending/${sha256}`;

  const provisional = buildSpec({
    specFile,
    sha256,
    size,
    assetRef: provisionalAssetRef,
    preserveState,
    revision: current ? current.specRevision + 1 : 1,
  });

  const lint = deps.lint({ bundleSource, spec: provisional });
  if (!lint.ok) {
    throw surfaceError(
      'lint-failed',
      `The publish gate rejected ${bundlePath}: ${lint.violations.length} violation${
        lint.violations.length === 1 ? '' : 's'
      }. Nothing was uploaded or written.`,
      {
        channel: channelId,
        bundle: bundlePath,
        violations: lint.violations,
        warnings: lint.warnings,
        skipped: lint.skipped,
      }
    );
  }

  let assetRef = provisionalAssetRef;
  let uploaded = false;
  if (!bytesUnchanged || parsed.flags.has('--reupload')) {
    const upload = await uploadSurfaceBundle(deps, sha256, bundleBytes);
    assetRef = upload;
    uploaded = true;
  }

  const candidateContent = buildSpec({
    specFile,
    sha256,
    size,
    assetRef,
    preserveState,
    revision: 0,
  });
  // The raw cell travels with the validated spec: the revision number comes
  // from the latter, the content comparison from the former (see
  // `decideRevision`). `current` stays the validated view because every
  // other reader above wants declared fields, not bytes.
  const decision = decideRevision(
    currentRead.status === 'valid'
      ? { spec: currentRead.spec, raw: currentRead.raw }
      : null,
    candidateContent
  );
  const published = { ...candidateContent, specRevision: decision.revision };

  const schemaCheck = deps.validateSpecValue(published);
  if (!schemaCheck.ok) {
    throw surfaceError(
      'spec-invalid',
      `The assembled definition does not satisfy the spec schema: ${schemaCheck.issues.join('; ')}`,
      { channel: channelId, issues: schemaCheck.issues }
    );
  }

  if (!decision.changed) {
    // An explicit no-op. Not a bump (nothing changed) and not a silent
    // skip (the caller is told exactly what it republished and what the
    // channel still holds), so a repair loop can tell "already published"
    // apart from "published just now".
    //
    // Byte-identical content is not the same claim as a usable channel. The
    // definition write and the posts that follow it are not one transaction,
    // so any failure between them — a crash, a dropped connection, a poke
    // `%channels-server` rejected — leaves a preserving revision whose
    // migration snapshot never landed, and every client renders
    // migration-pending. The exact retry that follows arrives HERE, ahead of
    // anything that looks at the channel's health, so reporting `ok` ends an
    // automated repair loop on a dashboard nobody can use. Finishing the
    // publish is the answer; what makes that safe to do on a path that
    // otherwise writes nothing is in `repairMissingMigrationSnapshot`.
    const repaired =
      preserveState && current
        ? await repairMissingMigrationSnapshot(
            deps,
            resolved,
            current,
            budget,
            allowAborted
          )
        : null;
    const report: SurfaceReport = {
      json: {
        channel: channelId,
        group: resolved.groupId,
        changed: false,
        outcome: repaired ? 'migration-repaired' : 'no-op',
        specRevision: decision.revision,
        previousRevision: decision.previousRevision,
        sha256,
        size,
        assetRef,
        uploaded,
        snapshot: repaired,
        observed: repaired
          ? 'the definition was already published; the migration snapshot it was missing was posted and read back'
          : 'the published definition is byte-identical to the one the channel already holds',
      },
      lines: repaired
        ? [
            `No change to the app, but ${channelId} was missing its migration snapshot at revision ${decision.revision}.`,
            `  snapshot: post ${repaired.postId} at sequence ${repaired.upToSequenceNum}`,
            `  carried:  state from revision ${
              repaired.carriedFromRevision ?? 'the definition itself'
            }`,
            ...abortedWaivedLines(repaired.abortedSequenceNums),
            '  observed: read back from the channel as a snapshot record',
          ]
        : [
            `No change: ${channelId} already holds this exact app.`,
            `  revision: ${decision.revision} (unchanged)`,
            `  sha256:   ${sha256}`,
            `  bundle:   ${assetRef}`,
            uploaded
              ? '  bundle re-uploaded on request; the definition was not rewritten'
              : '  nothing was uploaded, written, or posted',
          ],
    };
    return emitReport(deps, report, asJson);
  }

  // A preserving revision needs the state it is preserving, folded before
  // the definition changes underneath it. A fold over a truncated history
  // would be frozen into the snapshot permanently, so an incomplete
  // hydration refuses rather than snapshots — and so does a fold that stopped
  // early, which is the same loss reached from the other side.
  let migration: {
    state: Record<string, unknown>;
    upToSequenceNum: number;
    abortedSequenceNums: number[];
  } | null = null;
  if (preserveState) {
    migration = await foldForMigration(deps, resolved, current, published, {
      allowAborted,
      specRevision: decision.revision,
    });
  }

  // Every record this command will post is assembled and validated HERE,
  // before the description cell moves.
  //
  // The rule is not "check the snapshot earlier"; it is that no validation of
  // a record this command intends to write may happen after the first write.
  // A preserving revision makes the migration snapshot mandatory the instant
  // the definition lands, so any record that fails validation afterwards
  // leaves a channel demanding a snapshot nobody can post — and that is true
  // of the mirror as much as of the snapshot, because the command stops at
  // the first failure and the snapshot is posted second.
  //
  // These are the same objects posted below, not copies of them. Validating
  // one value and writing another is the raw-versus-validated defect this
  // file already carries two warnings about (D67, D72).
  //
  // What CANNOT move is everything that needs the write to have happened:
  // the description read-back (`publish-unconfirmed`), and each post's
  // read-back and kind-tail check (`post-unconfirmed`, `kind-tail-lost`).
  // Those are confirmations, not validations — they cannot fail on account of
  // anything knowable in advance, so hoisting them is not merely hard but
  // meaningless.
  const mirrorEntry = {
    type: 'surface-spec-mirror',
    version: 1,
    surfaceId: specFile.surfaceId,
    specRevision: decision.revision,
    spec: published,
  };
  const mirrorCheck = deps.validateEntry('spec', mirrorEntry);
  if (!mirrorCheck.ok) {
    throw surfaceError(
      'spec-invalid',
      `The revision mirror for ${channelId} does not satisfy its schema: ${mirrorCheck.issues.join('; ')}. Nothing was written.`,
      { channel: channelId, issues: mirrorCheck.issues }
    );
  }

  const snapshotEntry = migration
    ? {
        type: 'surface-snapshot',
        version: 1,
        surfaceId: specFile.surfaceId,
        specRevision: decision.revision,
        upToSequenceNum: migration.upToSequenceNum,
        state: migration.state,
      }
    : null;
  if (snapshotEntry) {
    assertSnapshotRecordValid(deps, snapshotEntry, {
      channel: channelId,
      specRevision: decision.revision,
    });
  }

  const nextPayload = deps.description.encode({
    ...deps.description.decode(resolved.channel.meta.description),
    surfaceSpec: published,
  });

  await deps.writeGroupChannel({
    groupId: resolved.groupId,
    channelId,
    channel: {
      ...resolved.channel,
      meta: { ...resolved.channel.meta, description: nextPayload },
    },
  });

  const expectedKey = canonicalJson(published);
  const observation = await observeUntil(deps, budget, async () => {
    const channels = await deps.readGroupChannels(resolved.groupId);
    const channel = channels?.[channelId];
    if (!channel) {
      return {
        done: false,
        detail: `${resolved.groupId} no longer lists ${channelId}`,
      };
    }
    const read = readChannelSpec(deps, channel);
    if (read.status !== 'valid') {
      return {
        done: false,
        detail: `the channel's definition reads as "${read.status}"`,
      };
    }
    // Compare the VERBATIM cell, not the validated view. `read.spec` has
    // been through the schema, which strips whatever it does not declare —
    // so any key present in what we wrote and absent from what we compare
    // makes a landed write report `publish-unconfirmed`. The marker that
    // exposed this, `duplicatesTolerated`, is now a declared field, but the
    // comparison stays raw: content is the change signal (D59), the raw
    // payload is the content, and the next undeclared key must not
    // resurrect the bug.
    // No fallback to `read.spec` on a parse failure. `status === 'valid'`
    // means the cell already parsed, so the catch was unreachable — and an
    // unreachable branch that silently restores the stripped comparison is
    // the bug one broken invariant away. If the cell ever stops parsing,
    // throwing is correct: a confirmation that cannot read what it is
    // confirming has not confirmed anything.
    const readKey = canonicalJson(JSON.parse(read.raw));
    if (readKey !== expectedKey) {
      return {
        done: false,
        detail: `the channel holds revision ${read.spec.specRevision} with bundle ${read.spec.bundle.sha256.slice(0, 12)}…, not what was written`,
      };
    }
    return {
      done: true,
      value: {
        byteIdentical: channel.meta.description === nextPayload,
        spec: read.spec,
      },
    };
  });

  if (!observation.ok) {
    throw surfaceError(
      'publish-unconfirmed',
      `The definition was written but never observed on the ship: ${observation.detail}. Nothing downstream was posted.`,
      {
        channel: channelId,
        group: resolved.groupId,
        specRevision: decision.revision,
        observed: observation.detail,
        attempts: observation.attempts,
      }
    );
  }

  const mirror = await postSurfaceRecord(deps, {
    channelId,
    kind: 'spec',
    fallback: `Updated the ${publishedTitle} app.`,
    entry: mirrorEntry,
    budget,
  }).catch((error: unknown) => {
    throw annotatePublished(error, channelId, decision.revision);
  });

  let snapshot: {
    postId: string;
    upToSequenceNum: number;
    abortedSequenceNums: number[];
  } | null = null;
  if (migration && snapshotEntry) {
    const written = await postSurfaceRecord(deps, {
      channelId,
      kind: 'snapshot',
      fallback: 'Saved a checkpoint of the dashboard.',
      entry: snapshotEntry,
      budget,
    }).catch((error: unknown) => {
      throw annotatePublished(error, channelId, decision.revision);
    });
    snapshot = {
      postId: written.postId,
      upToSequenceNum: migration.upToSequenceNum,
      abortedSequenceNums: migration.abortedSequenceNums,
    };
  }

  const report: SurfaceReport = {
    json: {
      channel: channelId,
      group: resolved.groupId,
      changed: true,
      outcome: 'published',
      specRevision: decision.revision,
      previousRevision: decision.previousRevision,
      sha256,
      size,
      assetRef,
      uploaded,
      preserveState,
      byteIdentical: observation.value.byteIdentical,
      mirrorPostId: mirror.postId,
      snapshot,
      warnings: lint.warnings,
      // The scoring sheet's own record, and the residuals it declared.
      // `RUBRIC.md` says a finding that survives two repair rounds ships with
      // the residual said plainly; this is where "plainly" lands, so a
      // known-broken publish is distinguishable afterwards from a clean one.
      rubric: {
        path: rubricPath,
        bundleSha256: rubric.bundleSha256,
        residuals: rubricResiduals(rubric),
      },
      observed:
        'the channel description was read back and carries exactly this definition',
    },
    lines: [
      `Published ${channelId} at revision ${decision.revision}${
        decision.previousRevision === null
          ? ''
          : ` (was ${decision.previousRevision})`
      }`,
      `  sha256:   ${sha256} (${size} bytes)`,
      `  bundle:   ${assetRef}${uploaded ? '' : ' (unchanged bytes; not re-uploaded)'}`,
      `  observed: definition read back from ${resolved.groupId}`,
      `  mirror:   post ${mirror.postId}`,
      ...(snapshot
        ? [
            `  snapshot: post ${snapshot.postId} at sequence ${snapshot.upToSequenceNum}`,
            ...abortedWaivedLines(snapshot.abortedSequenceNums),
          ]
        : []),
      ...(lint.warnings.length > 0
        ? [`  warnings: ${lint.warnings.length} (gate passed)`]
        : []),
      `  rubric:   ${rubricPath}`,
      ...rubricResiduals(rubric).map(
        (residual) =>
          `    check ${residual.number} (${residual.id}): ${residual.verdict} — ${residual.note}`
      ),
    ],
  };
  return emitReport(deps, report, asJson);
}

/**
 * Finishes a preserving publish that a previous run left half-done.
 *
 * Returns null when there is nothing to finish, which is the ordinary case: a
 * republish over a healthy channel stays the no-op it has always been. It
 * writes only when the channel is genuinely stranded, and only under the three
 * conditions that already govern the same repair in `surface snapshot` —
 * inherited from it rather than re-decided here, because a second answer to
 * "may this state be reconstructed?" is a second definition of the migration
 * rules:
 *
 * - **The reducer decides that it is stranded.** `migration-pending` is the
 *   answer every client computes; anything else, and the snapshot is present
 *   and this path writes nothing.
 * - **The history must be readable to its start.** A repair folded over a
 *   truncated history freezes the wrong state permanently. A snapshot FOUND in
 *   a short read is still conclusive — it is positive evidence, and the state
 *   it proves healthy is never used here — so incompleteness only refuses when
 *   the short read is the reason nothing was found.
 * - **Only the host may repair.** Every reducer ignores a non-host snapshot,
 *   so a repair from anyone else reports a fix that never happened.
 * - **No aborted entry may be finalized without the flag.**
 *   `repairPendingMigration` refuses that, and publish now carries the same
 *   named flag the other two paths do, so the caller who hit the refusal opts
 *   in from the command they were already running instead of being sent to a
 *   different one.
 */
async function repairMissingMigrationSnapshot(
  deps: SurfaceDeps,
  resolved: ResolvedSurfaceChannel,
  current: SurfaceSpec,
  budget: ObservationBudget,
  allowAborted: boolean
): Promise<{
  postId: string;
  upToSequenceNum: number;
  carriedFromRevision: number | null;
  abortedSequenceNums: number[];
} | null> {
  const hydrated = await hydratePosts(deps, resolved.channelId);
  const reduction = deps.reduce({
    spec: current,
    hostShip: resolved.hostShip,
    posts: hydrated.posts,
  });
  if (reduction.status !== 'migration-pending') return null;
  if (!hydrated.complete) {
    throw surfaceError(
      'partial-hydration',
      `${resolved.channelId} holds this exact definition already but has no migration snapshot at revision ${current.specRevision}, and only part of its history could be read — so neither the snapshot's absence nor the state it would carry can be established. Reporting a no-op here would report success over a channel that may be unusable.`,
      {
        channel: resolved.channelId,
        specRevision: current.specRevision,
        pages: hydrated.pages,
      }
    );
  }

  const repair = repairPendingMigration(
    deps,
    resolved,
    current,
    hydrated.posts,
    {
      allowAborted,
      abortRemedy: abortRemedy(resolved.channelId),
      abortHelp: SURFACE_PUBLISH_HELP,
    }
  );
  const entry = {
    type: 'surface-snapshot',
    version: 1,
    surfaceId: current.surfaceId,
    specRevision: current.specRevision,
    upToSequenceNum: repair.upToSequenceNum,
    state: repair.state,
  };
  assertSnapshotRecordValid(deps, entry, {
    channel: resolved.channelId,
    specRevision: current.specRevision,
  });
  const written = await postSurfaceRecord(deps, {
    channelId: resolved.channelId,
    kind: 'snapshot',
    fallback: 'Restored the dashboard after an update.',
    entry,
    budget,
  });
  return {
    postId: written.postId,
    upToSequenceNum: repair.upToSequenceNum,
    carriedFromRevision: repair.fromRevision,
    abortedSequenceNums: repair.abortedSequenceNums,
  };
}

/**
 * What a publisher who hit the abort refusal can do about it.
 *
 * The flag is named on the command they ran. Sending them to a different
 * command to lift a refusal this one raised is how a repair loop learns to
 * try commands rather than to read them.
 */
function abortRemedy(channelId: string): string {
  return `Check \`tlon surface state ${channelId}\` and re-post what was lost, or pass ${ALLOW_ABORTED_FLAG} to publish over the prefix as it stands.`;
}

function annotatePublished(
  error: unknown,
  channelId: string,
  revision: number
): unknown {
  if (error && typeof error === 'object' && 'details' in error) {
    const details = (error as { details: Record<string, unknown> }).details;
    details.definitionPublished = true;
    details.specRevision = revision;
    details.channel = channelId;
  }
  return error;
}

function buildSpec(input: {
  specFile: SpecFileFields;
  sha256: string;
  size: number;
  assetRef: string;
  preserveState: boolean;
  revision: number;
}): Record<string, unknown> {
  return {
    ...input.specFile.rest,
    surfaceId: input.specFile.surfaceId,
    specRevision: input.revision,
    bundle: {
      assetRef: input.assetRef,
      sha256: input.sha256,
      size: input.size,
      shellVersion: input.specFile.shellVersion,
    },
    ...(input.preserveState ? { preserveState: true } : {}),
  };
}

function readBundle(deps: SurfaceDeps, path: string): Uint8Array {
  try {
    return deps.readBinaryFile(path);
  } catch (error) {
    throw surfaceError(
      'usage',
      `Could not read the bundle at ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { path }
    );
  }
}

export async function uploadSurfaceBundle(
  deps: SurfaceDeps,
  sha256: string,
  bytes: Uint8Array
): Promise<string> {
  const preflight = await deps.storagePreflight();
  if (preflight && !preflight.canStore) {
    throw surfaceError(
      preflight.reason === 'no-bucket'
        ? 'storage-no-bucket'
        : 'storage-unavailable',
      preflight.reason === 'no-bucket'
        ? 'This ship has S3 credentials but no bucket selected, so the bundle cannot be uploaded. Choose a bucket in storage settings.'
        : 'This ship cannot store uploads, so the bundle cannot be hosted. Configure remote storage first.',
      {}
    );
  }
  try {
    const result = await deps.uploadBundle({
      fileName: bundleFileName(sha256),
      bytes,
      contentType: BUNDLE_CONTENT_TYPE,
    });
    if (!result.url) {
      throw new Error('storage returned no URL');
    }
    return result.url;
  } catch (error) {
    throw surfaceError(
      'upload-failed',
      `The bundle could not be uploaded: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { sha256 }
    );
  }
}

/**
 * The state a preserving revision carries across, folded under the definition
 * it is leaving.
 *
 * This is the PRIMARY snapshot-writing path — the one a host takes on an
 * ordinary revise — and it used to be the only one of the three that wrote
 * over a fold that stopped early without saying so. The two entries in the
 * comment on `assertNoAbortedEntries` describe the loss; it is worse here than
 * anywhere else, because the entries this freezes are tagged with the revision
 * being left behind, and a revision that no longer folds cannot have its lost
 * ops re-posted at all.
 *
 * Refusing here cannot itself strand the channel, which is what made the
 * asymmetry look defensible: the check runs before the description write, so a
 * refusal leaves the channel exactly as it was, at a revision that still folds,
 * with the aborted entries still visible to `surface state`.
 */
async function foldForMigration(
  deps: SurfaceDeps,
  resolved: { channelId: string; hostShip: string },
  current: SurfaceSpec | null,
  published: Record<string, unknown>,
  options: { allowAborted: boolean; specRevision: number }
): Promise<{
  state: Record<string, unknown>;
  upToSequenceNum: number;
  abortedSequenceNums: number[];
}> {
  const hydrated = await hydratePosts(deps, resolved.channelId);
  if (!hydrated.complete) {
    throw surfaceError(
      'partial-hydration',
      `Only part of ${resolved.channelId}'s history could be read, so the state to preserve cannot be computed. A snapshot taken from a partial fold would freeze the wrong state permanently.`,
      { channel: resolved.channelId, pages: hydrated.pages }
    );
  }
  if (!current) {
    // No readable definition means no way to fold what the channel already
    // holds, so there is no state to carry across — and both ways of
    // pretending otherwise destroy something. Pairing `initialState` with the
    // newest sequence FREEZES the existing events: the reducer treats
    // everything at or below the boundary as already incorporated, so they are
    // gone — not folded, not replayable, not even retractable. Pairing it with
    // boundary 0 replays them instead, against a definition they were never
    // written for.
    //
    // `surface snapshot`'s repair refuses the same situation in the same
    // words. The two paths facing one situation must not disagree about
    // whether a state nobody can compute may be reconstructed anyway.
    if (hasSurfaceStateRecords(hydrated.posts, published.surfaceId)) {
      throw surfaceError(
        'migration-pending',
        `${resolved.channelId} holds surface records but no readable definition to fold them under, so the state --preserve-state would carry across cannot be reconstructed — doing it would mean guessing at it. Republish the definition those records were written for, or publish without --preserve-state to start this revision from its own initial state.`,
        { channel: resolved.channelId }
      );
    }
    // Nothing has ever folded here, so the new definition's own starting point
    // is the true answer rather than a default — and it covers no sequence at
    // all, which is what the boundary has to say. The snapshot still has to
    // exist, or the surface renders migration-pending forever.
    const initialState = published.initialState;
    return {
      state:
        typeof initialState === 'object' &&
        initialState !== null &&
        !Array.isArray(initialState)
          ? (initialState as Record<string, unknown>)
          : {},
      upToSequenceNum: 0,
      abortedSequenceNums: [],
    };
  }

  const upToSequenceNum = newestSequenceNum(hydrated.posts);
  const reduction = deps.reduce({
    spec: current,
    hostShip: resolved.hostShip,
    posts: hydrated.posts,
  });
  if (reduction.status !== 'reduced') {
    throw surfaceError(
      'migration-pending',
      `${resolved.channelId} is itself waiting on a migration snapshot at revision ${current.specRevision}, so there is no state to carry forward. Post that snapshot first, or publish without --preserve-state.`,
      { channel: resolved.channelId, specRevision: current.specRevision }
    );
  }
  assertNoAbortedEntries(reduction, {
    channel: resolved.channelId,
    specRevision: options.specRevision,
    allowed: options.allowAborted,
    remedy: abortRemedy(resolved.channelId),
    help: SURFACE_PUBLISH_HELP,
  });
  return {
    state: reduction.state,
    upToSequenceNum,
    abortedSequenceNums: reduction.abortedSequenceNums,
  };
}

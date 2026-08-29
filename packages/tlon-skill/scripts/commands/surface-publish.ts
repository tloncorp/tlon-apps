import type { SurfaceSpec } from '@tloncorp/api';

import {
  type SurfaceDeps,
  type SurfacePostRecord,
  type SurfaceReport,
  assertSnapshotRecordValid,
  canonicalJson,
  emitReport,
  observeUntil,
  parseSurfaceArgs,
  readJsonFile,
  requireValue,
  singleValue,
  surfaceError,
  usageSurfaceError,
} from './surface-common';
import {
  postSurfaceRecord,
  hydratePosts,
  readChannelSpec,
  resolveSurfaceChannel,
} from './surface-writer';

export const SURFACE_PUBLISH_HELP = `Usage: tlon surface publish <channel> --bundle <path> --spec <path> [options]

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

Options:
  --bundle <path>       App bundle — JavaScript source, not a document
  --spec <path>         Spec JSON
  --preserve-state      Carry the current state across the revision, posting
                        the migration snapshot in this same command
  --reupload            Re-upload the bundle even when its bytes are unchanged
  --allow-surface-id-change
                        Permit a surfaceId different from the channel's
                        current one (this orphans all existing state)
  --json                Emit a machine-readable result
  -h, --help            Show this help

Example:
  tlon surface publish chat/~zod/dash-abc --bundle ./app.js --spec ./spec.json`;

const DEFAULT_SHELL_VERSION = 1;
const BUNDLE_CONTENT_TYPE = 'application/javascript';

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

export function newestSequenceNum(posts: SurfacePostRecord[]): number {
  let newest = 0;
  for (const post of posts) {
    if (typeof post.sequenceNum === 'number' && post.sequenceNum > newest) {
      newest = post.sequenceNum;
    }
  }
  return newest;
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
      value: ['--bundle', '--spec'],
      boolean: [
        '--json',
        '--preserve-state',
        '--reupload',
        '--allow-surface-id-change',
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
  const budget = deps.observationBudget;

  await deps.authenticate();
  const resolved = await resolveSurfaceChannel(deps, channelId);

  const bundleBytes = readBundle(deps, bundlePath);
  const bundleSource = deps.readTextFile(bundlePath);
  const specFile = readSpecFile(readJsonFile(deps, specPath, 'spec'), specPath);
  const publishedTitle =
    typeof specFile.rest.title === 'string' && specFile.rest.title.length > 0
      ? specFile.rest.title
      : 'dashboard';

  const sha256 = deps.sha256Hex(bundleBytes);
  const size = bundleBytes.byteLength;

  const currentRead = readChannelSpec(deps, resolved.channel);
  if (currentRead.status === 'version-too-new') {
    throw surfaceError(
      'spec-version-too-new',
      `${channelId} currently carries a version ${currentRead.version} definition, which this build does not understand. Publishing over it would replace a definition it cannot read.`,
      { channel: channelId, version: currentRead.version }
    );
  }
  const current = currentRead.status === 'valid' ? currentRead.spec : null;
  if (currentRead.status === 'invalid') {
    // Not fatal: an unreadable definition is exactly what a republish is
    // for. It does mean there is no previous revision to bump from, so the
    // new definition starts at 1 and any prior state is unreachable — say
    // so rather than letting the revision quietly restart.
    deps.stderr(
      `Note: ${channelId}'s current definition does not validate; publishing replaces it and the revision restarts at 1.\n`
    );
  }

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
    const upload = await uploadBundle(deps, sha256, bundleBytes);
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
    const report: SurfaceReport = {
      json: {
        channel: channelId,
        group: resolved.groupId,
        changed: false,
        outcome: 'no-op',
        specRevision: decision.revision,
        previousRevision: decision.previousRevision,
        sha256,
        size,
        assetRef,
        uploaded,
        observed:
          'the published definition is byte-identical to the one the channel already holds',
      },
      lines: [
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
  // hydration refuses rather than snapshots.
  let migration: {
    state: Record<string, unknown>;
    upToSequenceNum: number;
  } | null = null;
  if (preserveState) {
    migration = await foldForMigration(deps, resolved, current, published);
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

  let snapshot: { postId: string; upToSequenceNum: number } | null = null;
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
          ]
        : []),
      ...(lint.warnings.length > 0
        ? [`  warnings: ${lint.warnings.length} (gate passed)`]
        : []),
    ],
  };
  return emitReport(deps, report, asJson);
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

async function uploadBundle(
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

async function foldForMigration(
  deps: SurfaceDeps,
  resolved: { channelId: string; hostShip: string },
  current: SurfaceSpec | null,
  published: Record<string, unknown>
): Promise<{ state: Record<string, unknown>; upToSequenceNum: number }> {
  const hydrated = await hydratePosts(deps, resolved.channelId);
  if (!hydrated.complete) {
    throw surfaceError(
      'partial-hydration',
      `Only part of ${resolved.channelId}'s history could be read, so the state to preserve cannot be computed. A snapshot taken from a partial fold would freeze the wrong state permanently.`,
      { channel: resolved.channelId, pages: hydrated.pages }
    );
  }
  const upToSequenceNum = newestSequenceNum(hydrated.posts);

  if (!current) {
    // Nothing to carry across: the channel had no readable definition, so
    // the preserved state is the new definition's own starting point. The
    // snapshot still has to exist, or the surface renders migration-pending
    // forever.
    const initialState = published.initialState;
    return {
      state:
        typeof initialState === 'object' &&
        initialState !== null &&
        !Array.isArray(initialState)
          ? (initialState as Record<string, unknown>)
          : {},
      upToSequenceNum,
    };
  }

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
  return { state: reduction.state, upToSequenceNum };
}

import { canonicalJson } from '../surface-canonical-json';
import {
  rubricResiduals,
  specInitialState,
  surfaceCanonicalHash,
} from '../surface-rubric-artifact';
import { assertPreStateInScope } from '../surface-write-scope';
import {
  type SurfaceDeps,
  type SurfaceReport,
  assertSnapshotRecordValid,
  emitReport,
  observeUntil,
  parseSurfaceArgs,
  requireValue,
  singleValue,
  surfaceError,
  usageSurfaceError,
} from './surface-common';
import { requireCompletedRubric, uploadSurfaceBundle } from './surface-publish';
import { fetchVerifiedBundleBytes } from './surface-show';
import {
  type ResolvedSurfaceChannel,
  type SurfaceSpecRead,
  postSurfaceRecord,
  readChannelSpec,
  readSurfacePreState,
  requireChannelSpec,
  resolveSurfaceChannel,
} from './surface-writer';

/**
 * `tlon surface fork` — copy a published app out of one channel and into
 * another, or take its recorded intent as the input to a fresh generation.
 *
 * Bot-executed only. The client-executed path §9 describes is deferred: it
 * would host the copy on the USER's ship, where the bot cannot post the host
 * events half the templates depend on, so every host-driven app would be
 * silently read-only after a fork. One path that works beats two that
 * disagree.
 *
 * ## Three properties, and why each is not negotiable
 *
 * **A copy is byte-faithful, minus the recipe, plus the provenance.** The
 * source's definition is read RAW and carried through verbatim; exactly four
 * fields are policy (`surfaceId`, `specRevision`, `bundle.assetRef` and
 * `bundle.size`), one is
 * dropped (`recipe`) and one is added (`provenance`). Everything else — the
 * gate's opt-out markers, and any key this build's schema has never heard of —
 * arrives in the fork exactly as it left the source.
 *
 * That is not politeness about unknown data. `SurfaceSpecSchema` is a
 * `z.object`, so it strips what it does not declare, and what it does not
 * declare is where gate opt-outs used to live. Three separate defects came
 * from a written spec differing from the validated read-back of that same spec
 * (D67, D72 twice, and `decideRevision`'s false bump), and D72's own follow-up
 * named this command as the predicted fourth: a fork that republished the
 * validated view would drop `duplicatesTolerated` from every `append` app it
 * copied, and the copy would then fail a gate the source had passed. So the
 * derivation reads `JSON.parse(read.raw)` and the confirmation compares raw to
 * raw, and `surface-fork.test.ts` pins both against a spec built to carry
 * every shape the schema strips.
 *
 * **The source's recipe never travels.** It is regeneration context for the
 * bot that owns the app, it is member-visible (it lives in the channel
 * description every member syncs), and it was written for a group the forker's
 * group is not. Republishing it verbatim would move one group's intent record
 * into another group's channel. `--regenerate` may READ it — that is the whole
 * point of that mode — but reading it as input and republishing it as a field
 * are different acts.
 *
 * **A copy is re-gated here, not trusted from there.** The bundle's hash
 * proves the bytes are unchanged. It does not prove they are acceptable HERE:
 * the gate has moved since the source published, and the rubric is
 * context-scored — check 7 is "the screen is the thing that was asked for",
 * which is a judgement about a request, and the request this fork answers is
 * not the request the source answered. So the source's scoring sheet does not
 * travel either, and the fork demands a fresh one over the destination.
 *
 * ## Why it takes two commands to fork
 *
 * A fresh sheet has to be scored against renders of these bytes under this
 * fork's id, and the scoring is done by a bot with a vision model, between
 * two tool calls. So the copy path is staged:
 *
 *   1. `--stage-bundle/--stage-spec` writes the verified bytes and the derived
 *      definition to disk, mints the fork's `surfaceId`, and touches no ship.
 *   2. `tlon surface preview <bundle> <spec>` renders and pre-keys the sheet.
 *   3. `--surface-id/--rubric` re-reads the source, re-derives, re-gates,
 *      creates nothing, uploads, writes, and reads back.
 *
 * Step 3 deliberately re-fetches the bundle from the source rather than
 * trusting the staged file: the staged copy is a convenience for previewing,
 * and a file on disk between two commands is a thing that can be edited. The
 * rubric's identity binding then does real work — a source revised between
 * staging and forking serves different bytes, or the same bytes under a
 * different definition, the sheet no longer names what is being written, and
 * the fork refuses instead of publishing an app nobody looked at. Both halves
 * are needed: the source's spec-only revisions leave `bundleSha256` alone.
 *
 * ## What provenance is
 *
 * A CLAIM. The forker writes it and nothing verifies it; anyone can assert any
 * origin. Every report says so in as many words, because a lineage field that
 * reads as an attestation is worse than no lineage field. `channel` is omitted
 * by default: naming the source nest reveals that the channel exists and that
 * the forker could see it, which is a membership leak out of a private group.
 */

export const SURFACE_FORK_HELP = `Usage: tlon surface fork <source-channel> [options]

  stage:      tlon surface fork <source> --into <channel> \\
                --stage-bundle <path> --stage-spec <path>
  fork:       tlon surface fork <source> --into <channel> \\
                --surface-id <id> --rubric <path>
  regenerate: tlon surface fork <source> --regenerate [--brief-out <path>]

Copy a dashboard app you can read into a channel your ship can write, or take
its recorded intent as the input to a fresh generation.

Forking is TWO commands, because the copy has to be looked at before it lands:

  1. stage    writes the source's bundle and the fork's definition to disk and
              mints the fork's surface id. Nothing is written to any ship.
  2. preview  \`tlon surface preview <bundle> <spec>\` renders the staged pair
              and writes a scoring sheet pre-keyed to this fork.
  3. fork     re-reads the source, re-gates it, and publishes the copy. The
              sheet must name this fork's surface id, these exact bytes and
              the definition staged for them — a source that revised its spec
              in between is a different copy, and needs a new preview.

The copy is byte-faithful: the source's definition arrives verbatim except for
a fresh surfaceId, a revision reset to 1, the new storage pointer, the source
recipe (dropped) and provenance (added). The recipe is NOT copied — it is the
source author's intent record, it is member-visible, and it was written for
another group. Write the fork its own with \`surface publish\` later.

The destination must be a channel that publishes nothing yet (make one with
\`tlon surface create\`). A fork onto a live board would orphan its state.

Provenance is a CLAIM, not an attestation: this command writes it and nothing
checks it. Treat it as attribution, never as trust. The source channel is left
out of it unless you ask, because naming it reveals that it exists and that
you could see it.

Options:
  --into <channel>       destination channel; must carry no definition yet
  --stage-bundle <path>  stage: write the verified source bundle here
  --stage-spec <path>    stage: write the fork's definition here
  --surface-id <id>      fork: the id the staging run minted
  --rubric <path>        fork: the completed sheet for THESE bytes and THAT id
  --regenerate           read the source recipe as INPUT for a fresh app, and
                         copy no bytes at all
  --brief-out <path>     regenerate: write the regeneration brief here
  --include-source-channel
                         name the source channel in provenance (off by default:
                         it leaks that the channel exists and that you saw it)
  --json                 Emit a machine-readable result
  -h, --help             Show this help

Example:
  tlon surface fork chat/~ten/dash-poll --into chat/~zod/dash-abc \\
    --stage-bundle ./app.js --stage-spec ./spec.json
  tlon surface preview ./app.js ./spec.json
  tlon surface fork chat/~ten/dash-poll --into chat/~zod/dash-abc \\
    --surface-id dash-9f3a2c1b --rubric ./surface-preview/rubric.template.json`;

/** A fork always starts over. Its history is empty, so nothing precedes 1. */
export const FORK_SPEC_REVISION = 1;

/**
 * The storage pointer a spec carries before its bytes have been uploaded.
 *
 * The same shape `surface publish` uses, for the same reason: the gate has no
 * rule that reads a storage location, so linting against a placeholder and
 * re-validating against the real one costs nothing and keeps the gate ahead of
 * the upload. A staged definition keeps the placeholder on purpose — the fork
 * does not host the source's bytes and must not point at the source's bucket.
 */
export function pendingAssetRef(sha256: string): string {
  return `surface://pending/${sha256}`;
}

export interface ForkProvenance {
  surfaceId: string;
  specRevision: number;
  sha256: string;
  channel?: string;
  mode: 'copy' | 'regenerated';
}

/**
 * The lineage claim, built from DECLARED scalars.
 *
 * Reading `surfaceId`, `specRevision` and `bundle.sha256` off the validated
 * spec is D72's rule the right way round: reading a FIELD off the validated
 * spec stays correct (the schema cannot have touched a field it declares), and
 * it is handing back a whole SPEC that does not. It is also what guarantees
 * the claim is well-formed — a 64-hex hash and a non-negative revision —
 * rather than whatever the source's raw cell happened to hold there.
 *
 * `sha256` is the SOURCE's bundle in both modes. For a copy it equals the
 * fork's own `bundle.sha256`; for a regeneration it deliberately does not, and
 * that difference is the only machine-readable tell that the two apps are not
 * the same code.
 *
 * One hop, never a chain: forking a fork replaces the lineage rather than
 * appending to it. A chain would be a growing record of who could see what,
 * carried in a member-visible cell, and each link is unverified anyway — a
 * chain of claims is not more evidence than one claim.
 */
export function buildForkProvenance(input: {
  surfaceId: string;
  specRevision: number;
  sha256: string;
  channel: string | null;
  mode: 'copy' | 'regenerated';
}): ForkProvenance {
  return {
    surfaceId: input.surfaceId,
    specRevision: input.specRevision,
    sha256: input.sha256,
    ...(input.channel === null ? {} : { channel: input.channel }),
    mode: input.mode,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The fork's definition, derived from the source's RAW cell.
 *
 * The whole copy is this function, and it is short on purpose: four overrides,
 * one deletion, one addition, and a spread that carries everything else
 * through untouched. A longer derivation — one that rebuilt the spec from the
 * fields it knows about — is exactly the shape that drops a marker, and it
 * would drop it silently, because a spec assembled from known fields looks
 * complete.
 *
 * `sourceRaw` must be the parsed VERBATIM cell (`JSON.parse(read.raw)`), never
 * `read.spec`. Passing the validated view compiles, runs, produces a spec that
 * publishes cleanly, and loses every key the schema does not declare — which
 * is why `surface-fork.test.ts` asserts what this returns for both inputs
 * rather than only for the right one.
 *
 * `size` is the fourth override and the one that is not obvious. It is not
 * carried, because it is not a claim the source gets to make about a bucket it
 * does not own: it is the length of the bytes THIS command uploaded, exactly
 * as `surface publish` sets it from the bytes it uploads. Nothing verifies a
 * declared size on the way in — the fetch checks the hash and the cap, not the
 * number — so a source whose spec understates its bundle would otherwise hand
 * the fork's members a sanity bound their client refuses the bundle on.
 * Faithfulness is about what the source SAID; size is a fact about what is now
 * in storage here.
 */
export function deriveForkSpec(input: {
  sourceRaw: Record<string, unknown>;
  surfaceId: string;
  assetRef: string;
  size: number;
  provenance: ForkProvenance;
}): Record<string, unknown> {
  const { recipe: _sourceRecipe, ...carried } = input.sourceRaw;
  const sourceBundle = isPlainObject(carried.bundle) ? carried.bundle : {};
  return {
    ...carried,
    surfaceId: input.surfaceId,
    specRevision: FORK_SPEC_REVISION,
    bundle: { ...sourceBundle, assetRef: input.assetRef, size: input.size },
    provenance: input.provenance,
  };
}

interface ForkSource {
  resolved: ResolvedSurfaceChannel;
  /** the verbatim cell, parsed — the thing that gets copied */
  raw: Record<string, unknown>;
  surfaceId: string;
  specRevision: number;
  assetRef: string;
  sha256: string;
  size: number;
  title: string | null;
  recipePresent: boolean;
  recipe: unknown;
}

/**
 * Reads the source the way `surface show` reads it, and refuses everything it
 * refuses.
 *
 * An unreadable source is a REFUSED fork, never a guessed one. There is no
 * `--allow-unreadable-source` here and there should not be: publish's version
 * of that hatch exists so an operator can REPLACE a definition nobody can
 * read, which is a repair. A fork of a definition nobody can read would be a
 * copy of nothing, landing in a second group.
 */
async function readForkSource(
  deps: SurfaceDeps,
  channelId: string
): Promise<ForkSource> {
  const resolved = await resolveSurfaceChannel(deps, channelId, {
    intent: 'read',
  });
  const read = readChannelSpec(deps, resolved.channel);
  if (read.status !== 'valid') {
    // The three-way taxonomy (absent / invalid / version-too-new) is already
    // spelled once, with three different remedies. A second one written here
    // would be a second opinion about the same channel.
    requireChannelSpec(deps, resolved);
    throw surfaceError(
      'spec-invalid',
      `${channelId}'s definition reads as "${read.status}", which this command has no reading for.`,
      { channel: channelId, status: read.status }
    );
  }
  const raw = JSON.parse(read.raw) as Record<string, unknown>;
  return {
    resolved,
    raw,
    surfaceId: read.spec.surfaceId,
    specRevision: read.spec.specRevision,
    assetRef: read.spec.bundle.assetRef,
    sha256: read.spec.bundle.sha256,
    size: read.spec.bundle.size,
    title: typeof read.spec.title === 'string' ? read.spec.title : null,
    recipePresent: Object.prototype.hasOwnProperty.call(raw, 'recipe'),
    recipe: raw.recipe,
  };
}

interface ForkDestination {
  resolved: ResolvedSurfaceChannel;
  current: SurfaceSpecRead;
}

/**
 * Resolves the destination and insists it is empty.
 *
 * `intent: 'write'` even on the staging pass. Staging writes nothing to a
 * ship, but it is the first half of a write and the fence's question is what
 * this process was POINTED at — staging a fork for a board the operator
 * fenced out is the wrong-board shape one command earlier, and finding out at
 * step 3 means the preview and the scoring were spent on it.
 *
 * The emptiness rule has no escape hatch. `surface publish` is the command
 * that replaces a definition; it derives the revision from content, refuses a
 * changed `surfaceId` without a flag, and can carry state across. A fork does
 * none of that — it restarts the revision at 1 under a brand-new id — so a
 * fork onto a live board orphans every event under it, and the flag that
 * allowed it would be a flag for doing the wrong thing.
 */
async function resolveForkDestination(
  deps: SurfaceDeps,
  channelId: string,
  operation: string
): Promise<ForkDestination> {
  const resolved = await resolveSurfaceChannel(deps, channelId, {
    intent: 'write',
    operation,
  });
  const current = readChannelSpec(deps, resolved.channel);
  if (current.status === 'valid') {
    throw surfaceError(
      'fork-destination-occupied',
      `${channelId} already publishes surface "${current.spec.surfaceId}" at revision ${current.spec.specRevision}, and a fork restarts the revision at 1 under a new id — every event and snapshot already under that board would be orphaned. Fork into a channel that publishes nothing yet (\`tlon surface create\`), or revise the board in place with \`tlon surface publish\`.`,
      {
        channel: channelId,
        occupiedBy: current.spec.surfaceId,
        specRevision: current.spec.specRevision,
      }
    );
  }
  if (current.status === 'version-too-new') {
    throw surfaceError(
      'spec-version-too-new',
      `${channelId} carries a version ${current.version} definition, which this build does not understand. It is not an empty channel, and forking into it would replace a definition this build cannot read.`,
      { channel: channelId, version: current.version }
    );
  }
  if (current.status === 'invalid') {
    throw surfaceError(
      'current-definition-unreadable',
      `${channelId} holds a definition this build cannot read, so it is not an empty channel and this command cannot say what a fork would replace. Read it back with \`tlon surface show ${channelId}\` first.`,
      { channel: channelId, status: current.status }
    );
  }
  return { resolved, current };
}

/** The bundle bytes the source's definition pins, or a refusal. */
async function fetchSourceBundle(
  deps: SurfaceDeps,
  source: ForkSource
): Promise<{ bytes: Uint8Array; text: string }> {
  const bytes = await fetchVerifiedBundleBytes(deps, {
    channelId: source.resolved.channelId,
    assetRef: source.assetRef,
    sha256: source.sha256,
  });
  return { bytes, text: new TextDecoder().decode(bytes) };
}

function runGate(
  deps: SurfaceDeps,
  input: {
    channelId: string;
    sourceChannelId: string;
    bundleSource: string;
    spec: Record<string, unknown>;
  }
): { warnings: unknown[] } {
  const lint = deps.lint({
    bundleSource: input.bundleSource,
    spec: input.spec,
  });
  if (!lint.ok) {
    throw surfaceError(
      'lint-failed',
      `The publish gate rejected the copy of ${input.sourceChannelId}: ${lint.violations.length} violation${
        lint.violations.length === 1 ? '' : 's'
      }. An unchanged hash proves the bytes are the ones that were published; it does not prove they pass the gate as it stands here. Nothing was uploaded or written.`,
      {
        channel: input.channelId,
        source: input.sourceChannelId,
        violations: lint.violations,
        warnings: lint.warnings,
        skipped: lint.skipped,
      }
    );
  }
  return { warnings: lint.warnings };
}

function assertSpecValid(
  deps: SurfaceDeps,
  channelId: string,
  spec: Record<string, unknown>
): void {
  const check = deps.validateSpecValue(spec);
  if (check.ok) return;
  throw surfaceError(
    'spec-invalid',
    `The forked definition does not satisfy the spec schema: ${check.issues.join('; ')}. A copy can fail this where the source passed it — provenance adds bytes to a spec that may already have been near its cap. Nothing was uploaded or written.`,
    { channel: channelId, issues: check.issues }
  );
}

/** Text through the one file writer the deps expose. */
function writeTextFile(deps: SurfaceDeps, path: string, text: string): void {
  deps.writeBinaryFile(path, new TextEncoder().encode(text));
}

/** The sentence every mode prints, so no report reads as an attestation. */
const PROVENANCE_IS_A_CLAIM =
  'provenance is a claim this command wrote and nothing verified — treat it as attribution and lineage, never as trust';

type ForkMode = 'stage' | 'fork' | 'regenerate';

interface ParsedFork {
  mode: ForkMode;
  sourceChannel: string;
  destination: string;
  stageBundle: string;
  stageSpec: string;
  surfaceId: string;
  rubric: string;
  briefOut: string | undefined;
  includeSourceChannel: boolean;
  asJson: boolean;
}

/**
 * Which of the three things this invocation is, and whether its flags agree.
 *
 * The mode is read off the flag that names the phase's OUTPUT — files, a
 * scoring sheet, or a brief — and every combination that does not belong to
 * the chosen mode is a usage error naming the mode it belongs to instead.
 * Silently ignoring a flag from another phase is how a bot learns to pass
 * everything and see what sticks.
 */
export function parseForkInvocation(args: string[]): ParsedFork | null {
  const parsed = parseSurfaceArgs(
    args,
    {
      value: [
        '--into',
        '--stage-bundle',
        '--stage-spec',
        '--surface-id',
        '--rubric',
        '--brief-out',
      ],
      boolean: ['--json', '--regenerate', '--include-source-channel'],
    },
    SURFACE_FORK_HELP
  );
  if (parsed.help) return null;

  const sourceChannel = parsed.positional[0];
  if (!sourceChannel) {
    throw usageSurfaceError(
      'a source channel id is required',
      SURFACE_FORK_HELP
    );
  }
  if (parsed.positional.length > 1) {
    throw usageSurfaceError(
      `Unexpected argument: ${parsed.positional[1]}`,
      SURFACE_FORK_HELP
    );
  }

  const regenerate = parsed.flags.has('--regenerate');
  const rubric = singleValue(parsed, '--rubric');
  const mode: ForkMode = regenerate
    ? 'regenerate'
    : rubric !== undefined
      ? 'fork'
      : 'stage';

  const forbid = (flag: string, belongsTo: string): void => {
    if (parsed.values.has(flag) || parsed.flags.has(flag)) {
      throw usageSurfaceError(
        `${flag} belongs to ${belongsTo}, and this is a "${mode}" run`,
        SURFACE_FORK_HELP
      );
    }
  };

  if (mode === 'regenerate') {
    // No destination at all. A regenerated app is authored by the bot and
    // lands through `surface create` + `surface publish` like any other app it
    // wrote; binding a channel here would name a target this command has no
    // way to write to and no business reserving.
    forbid('--into', 'the copy path');
    forbid('--stage-bundle', 'the copy path');
    forbid('--stage-spec', 'the copy path');
    forbid('--surface-id', 'the copy path');
    // Regenerate does not land anything, so a sheet handed to it would be
    // scored work this command silently threw away.
    forbid('--rubric', 'the copy path');
  } else {
    forbid('--brief-out', '--regenerate');
  }
  if (mode === 'stage') {
    forbid('--surface-id', 'the second half of the fork (with --rubric)');
  }
  if (mode === 'fork') {
    forbid('--stage-bundle', 'the first half of the fork (staging)');
    forbid('--stage-spec', 'the first half of the fork (staging)');
  }

  return {
    mode,
    sourceChannel,
    destination:
      mode === 'regenerate'
        ? ''
        : requireValue(parsed, '--into', SURFACE_FORK_HELP),
    stageBundle:
      mode === 'stage'
        ? requireValue(parsed, '--stage-bundle', SURFACE_FORK_HELP)
        : '',
    stageSpec:
      mode === 'stage'
        ? requireValue(parsed, '--stage-spec', SURFACE_FORK_HELP)
        : '',
    surfaceId:
      mode === 'fork'
        ? requireValue(parsed, '--surface-id', SURFACE_FORK_HELP)
        : '',
    rubric: rubric ?? '',
    briefOut: singleValue(parsed, '--brief-out'),
    includeSourceChannel: parsed.flags.has('--include-source-channel'),
    asJson: parsed.flags.has('--json'),
  };
}

export async function runSurfaceFork(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseForkInvocation(args);
  if (parsed === null) {
    deps.stdout(`${SURFACE_FORK_HELP}\n`);
    return 0;
  }
  await deps.authenticate();
  if (parsed.mode === 'regenerate') return runRegenerate(deps, parsed);
  if (parsed.mode === 'stage') return runStage(deps, parsed);
  return runFork(deps, parsed);
}

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

async function runStage(
  deps: SurfaceDeps,
  parsed: ParsedFork
): Promise<number> {
  const source = await readForkSource(deps, parsed.sourceChannel);
  const destination = await resolveForkDestination(
    deps,
    parsed.destination,
    'surface fork (stage)'
  );
  const bundle = await fetchSourceBundle(deps, source);

  // Minted here and printed, because it has to exist before the sheet that
  // names it. It is the only thing the two halves of a fork carry between
  // them: a sheet naming this id cannot be the source's sheet, which is what
  // makes "the source's rubric does not travel" a refusal rather than a rule.
  const surfaceId = deps.randomSlug();
  const provenance = buildForkProvenance({
    surfaceId: source.surfaceId,
    specRevision: source.specRevision,
    sha256: source.sha256,
    channel: parsed.includeSourceChannel ? source.resolved.channelId : null,
    mode: 'copy',
  });
  const spec = deriveForkSpec({
    sourceRaw: source.raw,
    surfaceId,
    assetRef: pendingAssetRef(source.sha256),
    size: bundle.bytes.byteLength,
    provenance,
  });

  assertSpecValid(deps, parsed.destination, spec);
  // The gate runs on the staging pass as well as the landing one. Previewing
  // and scoring a bundle that cannot ship is the expensive half of the loop
  // spent on nothing, and the gate is the cheap half.
  const gate = runGate(deps, {
    channelId: parsed.destination,
    sourceChannelId: source.resolved.channelId,
    bundleSource: bundle.text,
    spec,
  });

  deps.writeBinaryFile(parsed.stageBundle, bundle.bytes);
  writeTextFile(deps, parsed.stageSpec, `${JSON.stringify(spec, null, 2)}\n`);

  const report: SurfaceReport = {
    json: {
      phase: 'stage',
      source: sourceJson(source),
      destination: {
        channel: destination.resolved.channelId,
        group: destination.resolved.groupId,
      },
      surfaceId,
      specRevision: FORK_SPEC_REVISION,
      bundle: {
        path: parsed.stageBundle,
        bytes: bundle.bytes.byteLength,
        sha256: source.sha256,
        verified: true,
      },
      spec: { path: parsed.stageSpec },
      recipeCarried: false,
      provenance,
      provenanceIsAClaim: PROVENANCE_IS_A_CLAIM,
      wroteToShip: false,
      warnings: gate.warnings,
      next: `tlon surface preview ${parsed.stageBundle} ${parsed.stageSpec}`,
      observed:
        "the source's definition was read verbatim and its bundle hash-verified against it; nothing was written to any ship",
    },
    lines: [
      `Staged a fork of ${source.resolved.channelId} for ${parsed.destination}`,
      `  surface:  ${surfaceId} (fresh; the source is ${source.surfaceId} at revision ${source.specRevision})`,
      `  bundle:   ${parsed.stageBundle} (${bundle.bytes.byteLength} bytes, sha256 verified against the source's definition)`,
      `  spec:     ${parsed.stageSpec}`,
      '  recipe:   not copied — the source author wrote it for their group, and it is member-visible there',
      `  claim:    ${PROVENANCE_IS_A_CLAIM}`,
      '  nothing was written to any ship.',
      '',
      'Next, render and score it:',
      `  tlon surface preview ${parsed.stageBundle} ${parsed.stageSpec}`,
      `  tlon surface fork ${source.resolved.channelId} --into ${parsed.destination} \\`,
      `    --surface-id ${surfaceId} --rubric <the completed sheet>`,
    ],
  };
  return emitReport(deps, report, parsed.asJson);
}

/* ------------------------------------------------------------------ */
/* Fork                                                                */
/* ------------------------------------------------------------------ */

async function runFork(deps: SurfaceDeps, parsed: ParsedFork): Promise<number> {
  const source = await readForkSource(deps, parsed.sourceChannel);
  if (parsed.surfaceId === source.surfaceId) {
    throw surfaceError(
      'usage',
      `--surface-id ${parsed.surfaceId} is the source's own id. A fork is a separate app with its own state; sharing the id would make the copy's events and the source's indistinguishable to anything reading either. Use the id the staging run minted.`,
      { channel: parsed.destination, surfaceId: parsed.surfaceId }
    );
  }
  const destination = await resolveForkDestination(
    deps,
    parsed.destination,
    'surface fork'
  );
  // The other half of the bound: the right channel, but no longer the channel
  // anybody asserted anything about. Publish checks this for the same reason
  // and in the same place — after the current definition has been read, before
  // anything moves.
  if (deps.writeScope?.preState) {
    assertPreStateInScope(deps.writeScope, {
      channelId: parsed.destination,
      observed: await readSurfacePreState(
        deps,
        parsed.destination,
        destination.current
      ),
      operation: 'surface fork',
    });
  }

  // Re-fetched, not read from the staged file. The staged copy exists so the
  // bot could preview it; between two commands a file on disk is a thing that
  // can be edited, and the source's own hash is the only authority for what
  // the source published.
  const bundle = await fetchSourceBundle(deps, source);

  const provenance = buildForkProvenance({
    surfaceId: source.surfaceId,
    specRevision: source.specRevision,
    sha256: source.sha256,
    channel: parsed.includeSourceChannel ? source.resolved.channelId : null,
    mode: 'copy',
  });
  const provisional = deriveForkSpec({
    sourceRaw: source.raw,
    surfaceId: parsed.surfaceId,
    assetRef: pendingAssetRef(source.sha256),
    size: bundle.bytes.byteLength,
    provenance,
  });

  // Before the gate, before the upload, before anything is written. The sheet
  // is scored against the FORK's spec, so a source that declares itself
  // display-only makes the fork answer check 8 too — the marker travels, and
  // the judgement it demands is about the destination's request, not the
  // source's.
  //
  // `provisional` is what the spec binding is taken over, and it is the same
  // document the staging pass wrote to `--stage-spec` for preview to render:
  // `deriveForkSpec` is a pure function of the source's verbatim cell, the
  // chosen surface id, the fetched bundle's length and the provenance claim.
  // So the sheet matches exactly when nothing moved between the two runs — and
  // when the source republished in between, or `--include-source-channel`
  // differs, the definition landing here is genuinely not the one that was
  // rendered, and the refusal is the correct answer rather than a nuisance.
  const rubric = requireCompletedRubric(deps, {
    path: parsed.rubric,
    channelId: parsed.destination,
    surfaceId: parsed.surfaceId,
    sha256: source.sha256,
    spec: provisional,
    specSha256: surfaceCanonicalHash(provisional),
    // A fork always starts at the copied definition's own `initialState` —
    // state never travels — so the sheet must come from a run that opened
    // there, not from a `--state` run against the source's live board.
    stateSha256: surfaceCanonicalHash(specInitialState(provisional)),
  });

  assertSpecValid(deps, parsed.destination, provisional);
  const gate = runGate(deps, {
    channelId: parsed.destination,
    sourceChannelId: source.resolved.channelId,
    bundleSource: bundle.text,
    spec: provisional,
  });

  const assetRef = await uploadSurfaceBundle(deps, source.sha256, bundle.bytes);
  const published = deriveForkSpec({
    sourceRaw: source.raw,
    surfaceId: parsed.surfaceId,
    assetRef,
    size: bundle.bytes.byteLength,
    provenance,
  });
  assertSpecValid(deps, parsed.destination, published);

  // Every record this command will post is assembled and validated HERE,
  // before the description cell moves. Publish's rule, inherited rather than
  // re-decided: a preserving definition makes its snapshot mandatory the
  // instant it lands, so a record that fails validation afterwards leaves a
  // channel demanding a snapshot nobody can post.
  const mirrorEntry = {
    type: 'surface-spec-mirror',
    version: 1,
    surfaceId: parsed.surfaceId,
    specRevision: FORK_SPEC_REVISION,
    spec: published,
  };
  const mirrorCheck = deps.validateEntry('spec', mirrorEntry);
  if (!mirrorCheck.ok) {
    throw surfaceError(
      'spec-invalid',
      `The revision mirror for ${parsed.destination} does not satisfy its schema: ${mirrorCheck.issues.join('; ')}. Nothing was written.`,
      { channel: parsed.destination, issues: mirrorCheck.issues }
    );
  }

  // A faithful copy carries `preserveState` when the source declared it, and a
  // preserving definition with no snapshot under it renders migration-pending
  // to every client, forever. There is nothing to fold — the channel is empty
  // by the rule above — so the snapshot is the fork's own `initialState` at
  // boundary 0, which is exactly what `surface publish` computes when it
  // publishes a preserving spec onto a channel with no readable definition.
  // Dropping the flag instead would be simpler and would break the copy: the
  // faithfulness is the point of this command.
  const preserveState = published.preserveState === true;
  const snapshotEntry = preserveState
    ? {
        type: 'surface-snapshot',
        version: 1,
        surfaceId: parsed.surfaceId,
        specRevision: FORK_SPEC_REVISION,
        upToSequenceNum: 0,
        state: isPlainObject(published.initialState)
          ? published.initialState
          : {},
      }
    : null;
  if (snapshotEntry) {
    assertSnapshotRecordValid(deps, snapshotEntry, {
      channel: parsed.destination,
      specRevision: FORK_SPEC_REVISION,
    });
  }

  const nextPayload = deps.description.encode({
    ...deps.description.decode(destination.resolved.channel.meta.description),
    surfaceSpec: published,
  });
  await deps.writeGroupChannel({
    groupId: destination.resolved.groupId,
    channelId: parsed.destination,
    channel: {
      ...destination.resolved.channel,
      meta: {
        ...destination.resolved.channel.meta,
        description: nextPayload,
      },
    },
  });

  const expectedKey = canonicalJson(published);
  const observation = await observeUntil(
    deps,
    deps.observationBudget,
    async () => {
      const channels = await deps.readGroupChannels(
        destination.resolved.groupId
      );
      const channel = channels?.[parsed.destination];
      if (!channel) {
        return {
          done: false,
          detail: `${destination.resolved.groupId} no longer lists ${parsed.destination}`,
        };
      }
      const read = readChannelSpec(deps, channel);
      if (read.status !== 'valid') {
        return {
          done: false,
          detail: `the channel's definition reads as "${read.status}"`,
        };
      }
      // The VERBATIM cell against the raw object that was written. This is the
      // choke point the whole copy rests on: comparing `read.spec` here would
      // compare a schema-stripped view against an unstripped one, so every
      // marker the fork faithfully carried would read as a difference that is
      // not there and a landed fork would report itself unconfirmed — the
      // exact defect D72 records twice, in two other commands.
      const readKey = canonicalJson(JSON.parse(read.raw));
      if (readKey !== expectedKey) {
        return {
          done: false,
          detail: `${parsed.destination} holds surface ${read.spec.surfaceId} at revision ${read.spec.specRevision}, not the copy that was written`,
        };
      }
      return { done: true, value: read.spec };
    }
  );
  if (!observation.ok) {
    throw surfaceError(
      'publish-unconfirmed',
      `The forked definition was written but never observed on the ship: ${observation.detail}. Nothing downstream was posted.`,
      {
        channel: parsed.destination,
        group: destination.resolved.groupId,
        specRevision: FORK_SPEC_REVISION,
        observed: observation.detail,
        attempts: observation.attempts,
      }
    );
  }

  const mirror = await postSurfaceRecord(deps, {
    channelId: parsed.destination,
    kind: 'spec',
    fallback: `Copied the ${source.title ?? 'dashboard'} app into this channel.`,
    entry: mirrorEntry,
    budget: deps.observationBudget,
  }).catch((error: unknown) => {
    throw annotateForked(error, parsed.destination);
  });

  let snapshotPostId: string | null = null;
  if (snapshotEntry) {
    const written = await postSurfaceRecord(deps, {
      channelId: parsed.destination,
      kind: 'snapshot',
      fallback: 'Saved this dashboard’s starting point.',
      entry: snapshotEntry,
      budget: deps.observationBudget,
    }).catch((error: unknown) => {
      throw annotateForked(error, parsed.destination);
    });
    snapshotPostId = written.postId;
  }

  const report: SurfaceReport = {
    json: {
      phase: 'fork',
      channel: parsed.destination,
      group: destination.resolved.groupId,
      source: sourceJson(source),
      surfaceId: parsed.surfaceId,
      specRevision: FORK_SPEC_REVISION,
      sha256: source.sha256,
      size: bundle.bytes.byteLength,
      assetRef,
      uploaded: true,
      recipeCarried: false,
      preserveState,
      mirrorPostId: mirror.postId,
      snapshotPostId,
      provenance,
      provenanceIsAClaim: PROVENANCE_IS_A_CLAIM,
      warnings: gate.warnings,
      rubric: {
        path: parsed.rubric,
        bundleSha256: rubric.bundleSha256,
        residuals: rubricResiduals(rubric),
      },
      observed:
        'the channel description was read back verbatim and carries exactly the definition that was written',
    },
    lines: [
      `Forked ${source.resolved.channelId} into ${parsed.destination} at revision ${FORK_SPEC_REVISION}`,
      `  surface:  ${parsed.surfaceId} (copied from ${source.surfaceId} at revision ${source.specRevision})`,
      `  sha256:   ${source.sha256} (${bundle.bytes.byteLength} bytes, re-hosted; content addressing survives the copy)`,
      `  bundle:   ${assetRef}`,
      '  recipe:   not copied — write this fork its own on the next publish',
      `  observed: definition read back from ${destination.resolved.groupId}`,
      `  mirror:   post ${mirror.postId}`,
      ...(snapshotPostId
        ? [`  snapshot: post ${snapshotPostId} (this copy preserves state)`]
        : []),
      ...(gate.warnings.length > 0
        ? [`  warnings: ${gate.warnings.length} (gate passed)`]
        : []),
      `  rubric:   ${parsed.rubric}`,
      ...rubricResiduals(rubric).map(
        (residual) =>
          `    check ${residual.number} (${residual.id}): ${residual.verdict} — ${residual.note}`
      ),
      `  claim:    ${PROVENANCE_IS_A_CLAIM}`,
    ],
  };
  return emitReport(deps, report, parsed.asJson);
}

function annotateForked(error: unknown, channelId: string): unknown {
  if (error && typeof error === 'object' && 'details' in error) {
    const details = (error as { details: Record<string, unknown> }).details;
    details.definitionPublished = true;
    details.specRevision = FORK_SPEC_REVISION;
    details.channel = channelId;
  }
  return error;
}

/* ------------------------------------------------------------------ */
/* Regenerate                                                          */
/* ------------------------------------------------------------------ */

/**
 * The regeneration brief: the source's recorded intent, as INPUT.
 *
 * §9 calls this mode "the full generation loop with the source recipe as
 * input". The loop is the bot's — a CLI cannot author an app — so what this
 * command can honestly do is the loop's first move: hand over the intent, hand
 * over the lineage claim the regenerated publish should carry, and refuse to
 * copy a single byte of the source's code. Everything after that is
 * `surface create`, authoring, `surface preview`, and `surface publish`, which
 * is the ordinary path for an app the bot wrote — because that is what a
 * regenerated app is.
 *
 * Nothing here fetches the bundle. That is the mode's whole distinction, and
 * `surface-fork.test.ts` pins it from the other side: a source whose bundle
 * cannot be fetched at all still briefs cleanly.
 */
async function runRegenerate(
  deps: SurfaceDeps,
  parsed: ParsedFork
): Promise<number> {
  const source = await readForkSource(deps, parsed.sourceChannel);
  if (!source.recipePresent) {
    throw surfaceError(
      'recipe-absent',
      `${source.resolved.channelId} was published without a recipe, so there is no recorded intent to regenerate from — and re-deriving one from the running app would be inventing the thing this mode exists to carry. Fork the bytes instead (drop --regenerate), or ask whoever owns the source to republish it with a recipe.`,
      {
        channel: source.resolved.channelId,
        surfaceId: source.surfaceId,
        specRevision: source.specRevision,
      }
    );
  }

  const provenance = buildForkProvenance({
    surfaceId: source.surfaceId,
    specRevision: source.specRevision,
    sha256: source.sha256,
    channel: parsed.includeSourceChannel ? source.resolved.channelId : null,
    mode: 'regenerated',
  });
  const brief = {
    version: 1,
    source: {
      surfaceId: source.surfaceId,
      specRevision: source.specRevision,
      title: source.title,
      sha256: source.sha256,
      ...(parsed.includeSourceChannel
        ? { channel: source.resolved.channelId }
        : {}),
    },
    recipe: source.recipe,
    provenance,
  };
  if (parsed.briefOut !== undefined) {
    writeTextFile(deps, parsed.briefOut, `${JSON.stringify(brief, null, 2)}\n`);
  }

  const report: SurfaceReport = {
    json: {
      phase: 'regenerate',
      source: sourceJson(source),
      brief,
      briefPath: parsed.briefOut ?? null,
      copiedBundle: false,
      wroteToShip: false,
      provenanceIsAClaim: PROVENANCE_IS_A_CLAIM,
      next: 'author the app from this intent, then tlon surface create → preview → publish, carrying the provenance block in the spec you publish',
      observed:
        "the source's recipe was read from the definition it is stored in; no bundle was fetched and nothing was written",
    },
    lines: [
      `Regeneration brief for a fork of ${source.resolved.channelId}`,
      `  source:   ${source.surfaceId} at revision ${source.specRevision}`,
      `  bundle:   NOT copied — this mode regenerates from intent, not from bytes`,
      ...(parsed.briefOut === undefined
        ? []
        : [`  brief:    ${parsed.briefOut}`]),
      '',
      'Recorded intent:',
      JSON.stringify(source.recipe, null, 2),
      '',
      'Provenance for the spec you publish (mode "regenerated", and its sha256',
      "names the SOURCE's bundle, which is what makes it different from a copy):",
      JSON.stringify(provenance, null, 2),
      '',
      `  claim:    ${PROVENANCE_IS_A_CLAIM}`,
      '  nothing was written to any ship, and no bundle was fetched.',
    ],
  };
  return emitReport(deps, report, parsed.asJson);
}

function sourceJson(source: ForkSource): Record<string, unknown> {
  return {
    channel: source.resolved.channelId,
    group: source.resolved.groupId,
    surfaceId: source.surfaceId,
    specRevision: source.specRevision,
    sha256: source.sha256,
    size: source.size,
    title: source.title,
    recipePresent: source.recipePresent,
  };
}

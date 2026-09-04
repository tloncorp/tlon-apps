// The value imports below use deep subpaths for the same reason the gate
// does (see surface-lint.ts): `bunfig.toml` preloads a process-wide
// `mock.module('@tloncorp/api', …)` for unit tests and that mock does not
// carry the surface exports, so a root import resolves to it and fails ESM
// named-export validation. Subpaths resolve to the real modules, so preview
// folds with the SAME reducer the client folds with. tsc cannot follow
// "exports" under moduleResolution:Node, hence the suppressions; the casts
// below restore the real types from the package's root declarations.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceReducerModule from '@tloncorp/api/client/surface/reducer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as shellArtifactModule from '@tloncorp/surface-shell/artifact-strings';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as shellProtocolModule from '@tloncorp/surface-shell/protocol';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as shellSandboxModule from '@tloncorp/surface-shell/sandbox';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { syntheticPostId } from './surface-activation';
import { canonicalJson } from './surface-canonical-json';
import {
  type GroupedDefect,
  type PreviewCellObservation,
  PREVIEW_DEFECTS_NOT_CHECKED,
  PREVIEW_PROBE_EXPRESSION,
  findCellDefects,
  groupDefects,
} from './surface-preview-defects';
import { buildRubricTemplate } from './surface-rubric-artifact';
import {
  type ReachabilityReport,
  type TransitionBounds,
  analyzeSurfaceReachability,
} from './surface-transitions';

/**
 * `surface preview` (plan §9, step 6): render a surface app THE WAY
 * PRODUCTION RENDERS IT and screenshot it, so the authoring bot can look at
 * its own output and score it against the rubric
 * (`skills/surfaces/RUBRIC.md`) with its vision model.
 *
 * The load-bearing property is identity, not resemblance. Three things are
 * imported rather than reconstructed:
 *
 * - `buildSandboxDocument` from `@tloncorp/surface-shell/sandbox` — the
 *   same function `packages/app`'s `SurfaceSandboxContainer` calls, so the
 *   CSP meta, the script order and the bundle wrapper are not "the same
 *   shape as" production's, they are production's.
 * - `shellArtifactJs`/`shellArtifactCss` from
 *   `@tloncorp/surface-shell/artifact-strings` — the same embedded artifact
 *   `packages/app` ships, not a dev build.
 * - `reduceSurface` from `@tloncorp/api` — the populated state is folded by
 *   the real reducer from the spec's own declared actions, and (D70) from
 *   any host events `--host-ops` supplies. A hand-written state object would
 *   prove nothing about whether the app's actions produce something legible,
 *   so there isn't one; the host-ops path is the same reducer taking the same
 *   `mode: 'host'` events the bot posts on a real channel, not a second way
 *   in.
 *
 * Time is an input, and a FIXED one. Every cell's `init` carries
 * `PREVIEW_FIXED_NOW`, so an app whose screen depends on the clock renders
 * identically on every run — see that constant. Nothing here reads
 * `Date.now()`.
 *
 * The bridge is the real protocol too: the host page waits for the shell's
 * `ready` and answers with an `init` message that is validated against the
 * shell's own `HostToShellMessageSchema` before it is posted. Nothing here
 * pokes a global inside the sandbox — it could not, the frame has an opaque
 * origin.
 *
 * Playwright is loaded through a runtime-resolved specifier so the compiled
 * binary neither bundles it nor requires it: preview is an OPTIONAL
 * capability (the moon VM needs headless Chromium provisioned), and where
 * it is absent the caller falls back to publishing on lint + fold alone.
 */

/* ------------------------------------------------------------------ */
/* Shared implementations, pulled in through subpaths                  */
/* ------------------------------------------------------------------ */

type ApiModule = typeof import('@tloncorp/api');

const {
  SurfaceSpecSchema,
  SurfaceEventEntrySchema,
  PublishableSurfaceSpecSchema,
} = surfaceSchemasModule as Pick<
  ApiModule,
  | 'SurfaceSpecSchema'
  | 'SurfaceEventEntrySchema'
  | 'PublishableSurfaceSpecSchema'
>;
const { reduceSurface } = surfaceReducerModule as Pick<
  ApiModule,
  'reduceSurface'
>;

export type SurfaceSpec = ApiModule['SurfaceSpecSchema']['_output'];
type JsonObject = SurfaceSpec['initialState'];

/**
 * The shell package publishes only "exports" subpaths, which tsc cannot
 * follow under moduleResolution:Node, so the three modules above arrive
 * untyped. These mirror exactly what preview uses of them — same discipline
 * as the gate's `ShellRun` and D33's mirrored protocol types.
 */
interface ShellSandboxModule {
  buildSandboxDocument(options: {
    shellJs: string;
    shellCss: string;
    bundleSource: string;
  }): string;
  SURFACE_SANDBOX_IFRAME_FLAGS: string;
}

interface ShellArtifactModule {
  shellArtifactJs: string;
  shellArtifactCss: string;
  shellArtifactVersion: number;
}

interface HostMessageValidator {
  safeParse(value: unknown):
    | { success: true }
    | {
        success: false;
        error: { issues: { path: (string | number)[]; message: string }[] };
      };
}

const { buildSandboxDocument, SURFACE_SANDBOX_IFRAME_FLAGS } =
  shellSandboxModule as ShellSandboxModule;

const { shellArtifactJs, shellArtifactCss, shellArtifactVersion } =
  shellArtifactModule as ShellArtifactModule;

const HostToShellMessageSchema = (
  shellProtocolModule as { HostToShellMessageSchema: HostMessageValidator }
).HostToShellMessageSchema;

/* ------------------------------------------------------------------ */
/* The capture matrix                                                  */
/* ------------------------------------------------------------------ */

export type PreviewViewportName = 'phone' | 'phone-full' | 'desktop';

export interface PreviewViewport {
  name: PreviewViewportName;
  width: number;
  height: number;
  /**
   * Capture scale. The tall cell stays at 1: a vision model normalizes an
   * image to a fixed longest edge, so a 390×2000 frame is downsampled by
   * its aspect ratio no matter what it was rendered at, and rendering it at
   * 2× only doubles the bytes.
   */
  deviceScaleFactor?: number;
}

/** How tall the fold-free phone cell is, unless `--full-height` says otherwise. */
export const PREVIEW_FULL_HEIGHT = 2000;

/**
 * Phone FIRST, and not as a formality: the chart-overflow bug that shipped
 * twice was invisible at desktop width and obvious at 390px. Everything
 * downstream — the printed order, the manifest, the rubric's reading order
 * — keeps phone first so the primary artifact is the one that gets looked
 * at first.
 *
 * `phone-full` is the same 390px width with the fold removed. It exists
 * because the measurement that motivated all of this is BELOW the fold:
 * the workout tracker's chart sits under four cards, so a 390×844 capture —
 * and a 1280×900 one — shows everything except the element the bug was in.
 * Its taller frame changes nothing about layout (neither the token
 * stylesheet nor the primitive kit uses viewport-height units), so it is
 * the same render, unclipped.
 */
export function previewViewports(
  fullHeight = PREVIEW_FULL_HEIGHT
): readonly PreviewViewport[] {
  return [
    { name: 'phone', width: 390, height: 844 },
    {
      name: 'phone-full',
      width: 390,
      height: fullHeight,
      deviceScaleFactor: 1,
    },
    { name: 'desktop', width: 1280, height: 900 },
  ];
}

export const PREVIEW_THEMES = ['light', 'dark'] as const;
export type PreviewTheme = (typeof PREVIEW_THEMES)[number];

export type PreviewStateName = 'initial' | 'populated';

/**
 * The synthetic crew. Three ships, because a two-ship list can be laid out
 * by accident and a one-ship list hides the "no viewer identity" rule
 * (PARADIGM §4) entirely — an app that renders only the viewer looks fine
 * with one actor and wrong with three.
 *
 * One of them is a **planet** on purpose. At the `detail: 'none'` grade the
 * avatar primitive uses, sigil-js draws a galaxy as a single featureless
 * glyph — measured: `~zod` is one `<circle>`, `~ten` one `<rect>`, `~mug`
 * one `<path>` — so an all-galaxy crew fills every capture with three
 * near-identical marks and a reviewer scoring the rubric reasonably files
 * "the avatars are broken". A planet draws four, which is what most real
 * members look like and what the readability check is meant to score.
 */
export const PREVIEW_ACTORS = ['~zod', '~ten', '~palfun-foslup'] as const;

/** The channel host for the fold. `$actor` never resolves to it. */
export const PREVIEW_HOST_SHIP = '~zod';

export interface PreviewCell {
  viewport: PreviewViewport;
  theme: PreviewTheme;
  state: PreviewStateName;
  /** file name within the output directory */
  file: string;
}

/**
 * A cell's name in every artifact that is not an image: the screenshot's file
 * name without its extension.
 *
 * The rubric artifact keys on these, and `surface-rubric-artifact.ts` carries
 * its own copy of the twelve so `surface publish` can validate a scoring sheet
 * without importing Playwright, the shell artifact or the reducer. The copy is
 * checked against this function in `surface-preview.test.ts`.
 */
export function cellId(cell: PreviewCell): string {
  return cell.file.replace(/\.png$/, '');
}

export function previewMatrix(
  states: readonly PreviewStateName[],
  fullHeight?: number
): PreviewCell[] {
  const cells: PreviewCell[] = [];
  for (const viewport of previewViewports(fullHeight)) {
    for (const state of states) {
      for (const theme of PREVIEW_THEMES) {
        cells.push({
          viewport,
          theme,
          state,
          file: `${viewport.name}-${state}-${theme}.png`,
        });
      }
    }
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Document assembly — the identity point                              */
/* ------------------------------------------------------------------ */

/**
 * The preview document. This is a one-line wrapper on purpose: every
 * additional thing it did would be a way for preview to stop being
 * production. `surface-preview.test.ts` asserts the result is byte-equal to
 * the call `packages/app` makes, and that `packages/app` still makes that
 * call.
 */
export function assemblePreviewDocument(bundleSource: string): string {
  return buildSandboxDocument({
    shellJs: shellArtifactJs,
    shellCss: shellArtifactCss,
    bundleSource,
  });
}

/* ------------------------------------------------------------------ */
/* The populated state — mechanically folded, never invented            */
/* ------------------------------------------------------------------ */

interface SurfacePostLike {
  authorId: string;
  sequenceNum: number;
  blob: string;
  /** the reducer's required tie-break key (D189); minted, not host-stamped */
  id: string;
}

function invokePost(
  spec: SurfaceSpec,
  actionId: string,
  actor: string,
  sequenceNum: number
): SurfacePostLike {
  return {
    authorId: actor,
    sequenceNum,
    id: syntheticPostId('invoke', sequenceNum),
    blob: JSON.stringify([
      {
        type: 'surface-event',
        version: 1,
        surfaceId: spec.surfaceId,
        specRevision: spec.specRevision,
        mode: 'invoke',
        actionId,
      },
    ]),
  };
}

/**
 * A `preserveState` spec holds no state until the host posts a migration
 * snapshot at the current revision (plan §6), so a bare fold reports
 * `migration-pending` and the populated capture would show an empty app for
 * a reason that has nothing to do with the app. Stand in the snapshot of
 * `initialState` the host is required to post, exactly as the gate does.
 */
function migrationSnapshotPost(spec: SurfaceSpec): SurfacePostLike {
  return {
    authorId: PREVIEW_HOST_SHIP,
    sequenceNum: 0,
    id: syntheticPostId('snapshot', 0),
    blob: JSON.stringify([
      {
        type: 'surface-snapshot',
        version: 1,
        surfaceId: spec.surfaceId,
        specRevision: spec.specRevision,
        upToSequenceNum: 0,
        state: spec.initialState,
      },
    ]),
  };
}

/* ------------------------------------------------------------------ */
/* Host operations (D70)                                               */
/* ------------------------------------------------------------------ */

/**
 * One host event, as a `--host-ops` file writes it.
 *
 * The gap this closes (D70): `foldPopulatedState` folds DECLARED ACTIONS
 * only, and there is no action for "and then the host posted the rollover".
 * Every host-is-the-clock app therefore previewed as its pre-rollover half —
 * the workout tracker's chart card and past-sessions card were empty in all
 * twelve cells, which are exactly the elements preview exists to inspect.
 *
 * This is not a second reducer and not a state file. It is a list of the
 * same `mode: 'host'` events the bot posts with `tlon surface event`, folded
 * by the same reducer, subject to the same rules — host authorship, current
 * revision, the same op grammar, the same caps, the same abort-on-refusal.
 * A host op preview accepts is a host op production would accept, which is
 * the only version of this feature worth having: the alternative (hand a
 * state object to the renderer) would preview a state no sequence of real
 * events can produce.
 */
export interface PreviewHostOpEntry {
  /** the raw ops, exactly as a `surface-event` `mode: 'host'` entry carries */
  ops: unknown[];
  /**
   * Where this entry folds relative to the invoked actions. Default `after`,
   * which is D70's word and the rollover case: members log, then the host
   * archives.
   *
   * `before` exists because the fullest screen usually needs both halves at
   * once. The workout tracker's chart reads `/history`, which only a host
   * event writes, and its session card reads `/today`, which only member
   * invokes write — so seeding history `before` and letting the crew fill
   * today gives one capture with both populated. Folding everything `after`
   * would archive and clear the very session the actions just logged, and the
   * card the reviewer is meant to score would be empty again for a new
   * reason.
   */
  at?: 'before' | 'after';
  /** the author's words for what this event is; echoed into the manifest */
  note?: string;
}

export interface PreviewHostOps {
  entries: PreviewHostOpEntry[];
  /** where the entries came from, for the manifest */
  source: string;
}

/**
 * Parse a `--host-ops` file into entries, refusing anything the reducer
 * would silently skip.
 *
 * The refusals are the point. `parsePostBlob` degrades an entry that fails
 * `SurfaceEventEntrySchema` to `{ type: 'unknown' }` and the reducer walks
 * straight past it — correct for hostile channel content, useless for a file
 * the author just wrote, because the capture would come back looking exactly
 * like one where the ops were fine and did nothing. So each entry is
 * validated HERE against the same schema the reducer will apply, and a
 * failure is an error the author reads rather than an empty card they have
 * to explain.
 */
export function parseHostOps(raw: unknown, source: string): PreviewHostOps {
  if (!Array.isArray(raw)) {
    throw new PreviewError(
      `${source} must hold a JSON array of host events, each { "ops": [...], "at": "before" | "after" }`
    );
  }
  const entries: PreviewHostOpEntry[] = [];
  raw.forEach((value, index) => {
    const where = `${source}[${index}]`;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new PreviewError(`${where} is not a host event object`);
    }
    const entry = value as Record<string, unknown>;
    if (!Array.isArray(entry.ops)) {
      throw new PreviewError(`${where}.ops must be an array of ops`);
    }
    const at = entry.at ?? 'after';
    if (at !== 'before' && at !== 'after') {
      throw new PreviewError(`${where}.at must be "before" or "after"`);
    }
    if (entry.note !== undefined && typeof entry.note !== 'string') {
      throw new PreviewError(`${where}.note must be a string`);
    }
    entries.push({
      ops: entry.ops,
      at,
      ...(entry.note === undefined ? {} : { note: entry.note }),
    });
  });
  return { entries, source };
}

/**
 * The `surface-event` entry a host op becomes. Split out so the validation
 * below and the post built for the fold are provably the same object.
 */
function hostEventEntry(spec: SurfaceSpec, entry: PreviewHostOpEntry): unknown {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: spec.surfaceId,
    specRevision: spec.specRevision,
    mode: 'host',
    ops: entry.ops,
  };
}

function hostOpPost(
  spec: SurfaceSpec,
  entry: PreviewHostOpEntry,
  sequenceNum: number
): SurfacePostLike {
  return {
    // The fold's host ship, and the reducer checks it: a host event authored
    // by anyone else is skipped, here exactly as on a channel.
    authorId: PREVIEW_HOST_SHIP,
    sequenceNum,
    id: syntheticPostId('host', sequenceNum),
    blob: JSON.stringify([hostEventEntry(spec, entry)]),
  };
}

function validateHostOps(spec: SurfaceSpec, hostOps: PreviewHostOps): void {
  hostOps.entries.forEach((entry, index) => {
    const parsed = SurfaceEventEntrySchema.safeParse(
      hostEventEntry(spec, entry)
    );
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new PreviewError(
        `${hostOps.source}[${index}] is not a host event the reducer would fold: ${detail}`
      );
    }
  });
}

export interface PopulatedFold {
  state: JsonObject;
  /** every invoke that was folded, in fold order */
  invokes: { actionId: string; actor: string }[];
  /** every host event that was folded, in fold order */
  hostOps: { at: 'before' | 'after'; opCount: number; note?: string }[];
  /**
   * True when the fold ran the restore pass — every constructive action once
   * per actor, after the rounds — because the spec mixes destructive and
   * constructive actions. Reported so the extra invokes in `invokes` are
   * attributable to the tool rather than read as the app's own doing.
   */
  restoredAfterDestructive: boolean;
  /** true when the fold produced state identical to `initialState` */
  unchanged: boolean;
  /**
   * Sequence numbers of entries the reducer aborted part-way through — the
   * commonest way a hand-written host-ops file is wrong (a path that does not
   * exist yet, a `set` under a missing parent). Reported rather than absorbed:
   * an aborted host event leaves a partly-applied state, and a capture of a
   * partly-applied state must never look like a capture of a clean one.
   */
  abortedSequenceNums: number[];
  /** set when the reducer refused to produce a state at all */
  problem?: string;
}

export const PREVIEW_FOLD_ROUNDS = 2;

/**
 * Fold every declared action, `rounds` times, rotating the synthetic crew
 * so the same action is taken by different ships across rounds.
 *
 * The rotation is the point. Folding one actor N times exercises only the
 * idempotency question (which is the gate's job); rotating three actors
 * over every action is what fills a crew list, a tally, a chart series —
 * i.e. what makes the populated screenshot a fair test of "is this
 * scannable". The rounds are what make a repeat visible at all.
 *
 * `hostOps` (D70) folds host events around the invokes — `before` first, then
 * every invoke, then `after` — as real `mode: 'host'` posts through the same
 * reducer, so a host-is-the-clock app can preview the half only the host can
 * produce.
 */
export function foldPopulatedState(
  spec: SurfaceSpec,
  options: {
    rounds?: number;
    actors?: readonly string[];
    hostOps?: PreviewHostOps;
  } = {}
): PopulatedFold {
  const rounds = Math.max(1, options.rounds ?? PREVIEW_FOLD_ROUNDS);
  const actors = options.actors ?? PREVIEW_ACTORS;
  const actionIds = Object.keys(spec.actions);
  const hostOps = options.hostOps ?? { entries: [], source: '(none)' };
  if (hostOps.entries.length > 0) {
    validateHostOps(spec, hostOps);
  }

  const preserving = spec.preserveState === true;
  const posts: SurfacePostLike[] = preserving
    ? [migrationSnapshotPost(spec)]
    : [];
  const invokes: { actionId: string; actor: string }[] = [];
  const foldedHostOps: PopulatedFold['hostOps'] = [];

  let sequenceNum = 1;
  const foldHostOps = (at: 'before' | 'after') => {
    for (const entry of hostOps.entries) {
      if ((entry.at ?? 'after') !== at) {
        continue;
      }
      posts.push(hostOpPost(spec, entry, sequenceNum));
      foldedHostOps.push({
        at,
        opCount: entry.ops.length,
        ...(entry.note === undefined ? {} : { note: entry.note }),
      });
      sequenceNum++;
    }
  };

  const invoke = (actionId: string, actor: string) => {
    posts.push(invokePost(spec, actionId, actor, sequenceNum));
    invokes.push({ actionId, actor });
    sequenceNum++;
  };

  foldHostOps('before');
  for (let round = 0; round < rounds; round++) {
    actionIds.forEach((actionId, index) => {
      invoke(actionId, actors[(index + round) % actors.length]);
    });
  }
  /**
   * The restore pass — every constructive action, once per actor, after the
   * rounds.
   *
   * Actions fold in DECLARATION ORDER against a rotating crew, so whichever
   * action is declared last lands last on a determinate actor. When that
   * action is destructive (`del /entries/$actor`, "clear my entry", "leave
   * trip") that member is deleted from the state every populated cell renders,
   * and the reviewer scores a board with a real member-shaped hole in it for a
   * reason that has nothing to do with the app. A template author hit exactly
   * this and worked around it by declaring the reset FIRST — a coping strategy
   * against tool behaviour, not a property of good specs.
   *
   * Ordering destructive actions first within a round does not fix it: the
   * rotation means round N's `del` lands on the actor round N-1's constructive
   * actions just wrote for, and the hole moves rather than closing. Covering
   * every actor is what makes the guarantee unconditional.
   *
   * It runs ONLY when the spec declares both a destructive and a constructive
   * action, so a spec without a `del` folds exactly as it did before — and no
   * declared action is dropped from the fold, which the "not fully exercised"
   * discipline would otherwise report as a hole of its own.
   */
  const destructive = (actionId: string) =>
    (spec.actions[actionId]?.ops ?? []).some((op) => op.op === 'del');
  const constructive = actionIds.filter((actionId) => !destructive(actionId));
  const restored =
    constructive.length > 0 && constructive.length < actionIds.length;
  if (restored) {
    for (const actor of actors) {
      for (const actionId of constructive) {
        invoke(actionId, actor);
      }
    }
  }
  foldHostOps('after');

  // A spec with no actions is still worth folding when host ops were
  // supplied: a display-only app (`memberInteraction.mode: 'none'`) moves by
  // host event and nothing else, so host ops are the ONLY way its populated
  // cell is ever populated. Reporting "nothing can populate it" there would
  // be the old limitation restated after it was fixed.
  if (actionIds.length === 0 && hostOps.entries.length === 0) {
    return {
      state: spec.initialState,
      invokes: [],
      hostOps: [],
      restoredAfterDestructive: false,
      abortedSequenceNums: [],
      unchanged: true,
      problem:
        'the spec declares no actions and no host ops were supplied, so nothing can populate it',
    };
  }

  const reduction = reduceSurface({ spec, hostShip: PREVIEW_HOST_SHIP, posts });
  if (reduction.status !== 'reduced') {
    return {
      state: spec.initialState,
      invokes,
      hostOps: foldedHostOps,
      restoredAfterDestructive: restored,
      abortedSequenceNums: [],
      unchanged: true,
      problem: `the reducer returned ${reduction.status}; captured initialState instead`,
    };
  }

  return {
    state: reduction.state,
    invokes,
    hostOps: foldedHostOps,
    restoredAfterDestructive: restored,
    abortedSequenceNums: reduction.abortedSequenceNums,
    // Through the one comparison helper (D72), not a raw `JSON.stringify`
    // pair: two states that differ only in key order are the same state, and
    // reporting "the actions changed something" because the reducer rebuilt an
    // object in a different order would send the author hunting a change that
    // is not there.
    unchanged:
      canonicalJson(reduction.state) === canonicalJson(spec.initialState),
  };
}

/* ------------------------------------------------------------------ */
/* The bridge                                                          */
/* ------------------------------------------------------------------ */

export interface PreviewInitMessage {
  type: 'init';
  protocolVersion: number;
  spec: SurfaceSpec;
  state: JsonObject;
  theme: PreviewTheme;
  canInvoke: boolean;
  now: number;
}

/**
 * The `now` every capture is taken at: 2025-01-01T00:00:00Z.
 *
 * FIXED, and that is the whole feature. `render`'s second argument is a
 * host-supplied timestamp, so an app that shows time is a pure function of
 * (state, now) — which makes its painted output reproducible if and only if
 * the host supplies the same `now` twice. Preview, the publish gate's smoke
 * render and the preflight witness therefore all inject this constant, and
 * two runs an hour apart produce byte-identical PNGs.
 *
 * Reaching for `Date.now()` here instead would cost exactly that: the
 * screenshot a reviewer scored and the screenshot the next run produces would
 * differ for a reason that has nothing to do with the app, and every
 * byte-comparison downstream (the hash the rubric sheet is bound to, the CI
 * render job) would be comparing two different questions.
 *
 * A round midnight UTC rather than a random instant, because template authors
 * read it: "the countdown says 14 days" is checkable against a target date in
 * the fixture, and an offset of 37 minutes past the hour is not.
 */
export const PREVIEW_FIXED_NOW = Date.UTC(2025, 0, 1, 0, 0, 0);

/**
 * The `init` the host answers `ready` with — the same message
 * `createSandboxSession` builds in `packages/app`, validated here against
 * the shell's own canonical schema before it is posted. Preview claiming to
 * "use the real bridge protocol" is therefore checked rather than asserted:
 * a message the shell's validator would reject never leaves this process.
 */
export function buildInitMessage(options: {
  spec: SurfaceSpec;
  state: JsonObject;
  theme: PreviewTheme;
  canInvoke: boolean;
  now?: number;
}): PreviewInitMessage {
  const message: PreviewInitMessage = {
    type: 'init',
    protocolVersion: 1,
    spec: options.spec,
    state: options.state,
    theme: options.theme,
    canInvoke: options.canInvoke,
    now: options.now ?? PREVIEW_FIXED_NOW,
  };
  const parsed = HostToShellMessageSchema.safeParse(message);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`preview built an init the shell would reject: ${detail}`);
  }
  return message;
}

/**
 * The host page. Everything preview does in the browser lives here as plain
 * text, so it is reviewable and testable without launching anything.
 *
 * It mirrors `SurfaceSandboxHost` where it matters: `allow-scripts` only,
 * `srcdoc` set BEFORE the element is inserted (assigning it to an element
 * already in the document produces a second `about:blank` load on chromium
 * and webkit), inbound messages `event.source`-checked against this exact
 * frame, and outbound `postMessage` at `'*'` because an opaque origin
 * matches no concrete target origin.
 *
 * It deliberately does NOT reproduce the host's navigation teardown: a
 * frame that navigates itself is a finding preview should SHOW, and tearing
 * the element down would replace the evidence with a blank rectangle.
 *
 * The surround is token-driven for a measured reason. The sandbox document
 * paints its background on the shell's mount element (`.tsh-root`), not on
 * `html`/`body`, so an app shorter than the viewport leaves the rest of the
 * frame TRANSPARENT. In the app that is invisible — the screen behind the
 * iframe is the same themed background — but a preview host page left white
 * would put a bright band under every dark-theme capture and invite a
 * finding against the app for something the app did not do. So the host
 * page carries the shell's own token stylesheet and takes its background
 * from the same `--color-bg` the app's theme resolves to.
 */
export function buildPreviewHostPage(theme: PreviewTheme): string {
  if (shellArtifactCss.includes('</style')) {
    throw new Error(
      'shell stylesheet contains "</style" and cannot be inlined into the preview host page'
    );
  }
  // replacer FUNCTIONS, so a `$&` or `$'` anywhere in the stylesheet is
  // inserted literally rather than read as a substitution pattern
  return PREVIEW_HOST_PAGE_TEMPLATE.replace('__THEME__', () => theme).replace(
    '__SHELL_CSS__',
    () => shellArtifactCss
  );
}

const PREVIEW_HOST_PAGE_TEMPLATE = `<!doctype html>
<html data-theme="__THEME__">
<head>
<meta charset="utf-8" />
<style>__SHELL_CSS__</style>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: var(--color-bg); }
  iframe { display: block; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<script>
(function () {
  var report = { mounted: false, ready: false, errors: [], invokes: [] };
  window.__surfacePreview = report;
  window.__surfacePreviewMount = function (payload) {
    var frame = document.createElement('iframe');
    frame.setAttribute('title', 'Surface app');
    frame.setAttribute('sandbox', payload.flags);
    frame.setAttribute('srcdoc', payload.document);
    window.addEventListener('message', function (event) {
      if (event.source !== frame.contentWindow) { return; }
      var data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return; }
      }
      if (data === null || typeof data !== 'object') { return; }
      if (data.type === 'ready') {
        report.ready = true;
        frame.contentWindow.postMessage(payload.init, '*');
        return;
      }
      if (data.type === 'error') {
        report.errors.push({ phase: data.phase, message: data.message });
        return;
      }
      if (data.type === 'invoke') {
        report.invokes.push(data.actionId);
      }
    });
    document.body.appendChild(frame);
    report.mounted = true;
  };
})();
</script>
</body>
</html>`;

/* ------------------------------------------------------------------ */
/* The driver                                                          */
/* ------------------------------------------------------------------ */

/**
 * The slice of Playwright preview uses, mirrored structurally so the
 * package needs no type dependency on it and so the driver can be tested
 * against a stand-in. Tracks `playwright`'s `chromium` export.
 */
export interface PreviewFrame {
  evaluate(expression: string): Promise<unknown>;
}

export interface PreviewPage {
  setContent(html: string): Promise<void>;
  evaluate(fn: (arg: never) => unknown, arg?: unknown): Promise<unknown>;
  waitForFunction(expression: string, arg?: unknown): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(options: { path: string }): Promise<unknown>;
  /**
   * The app runs in an `allow-scripts`-only iframe, which gives it an opaque
   * origin — so the host page cannot reach its document at all, and the
   * defect pass has to measure from outside. Playwright can, through the
   * frame's own isolated world, which is the only reason a machine-checked
   * pass over the rendered app is possible.
   *
   * Both are REQUIRED rather than optional. A stand-in that omitted them
   * would make the defect pass silently do nothing, and a checker that
   * reports nothing on everything is the vacuous version of this feature.
   */
  mainFrame(): PreviewFrame;
  frames(): PreviewFrame[];
  close(): Promise<void>;
}

export interface PreviewContext {
  newPage(): Promise<PreviewPage>;
  close(): Promise<void>;
}

export interface PreviewBrowser {
  newContext(options: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    colorScheme: PreviewTheme;
    reducedMotion: 'reduce';
  }): Promise<PreviewContext>;
  close(): Promise<void>;
}

export interface PreviewLauncher {
  launch(options: { headless: boolean }): Promise<PreviewBrowser>;
}

/**
 * Resolved at RUNTIME, never inlined by the bundler. `bun build --compile`
 * follows literal dynamic imports, which would drag Playwright (and its
 * browser-download machinery) into the binary; a non-literal specifier is
 * left as a real import. The env override lets a deployment point at a
 * Playwright installed somewhere other than the binary's own resolution
 * path.
 */
function playwrightSpecifier(): string {
  return process.env.TLON_PLAYWRIGHT_MODULE ?? 'playwright';
}

export class PreviewUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      'headless Chromium is not available: could not load Playwright ' +
        `(${cause instanceof Error ? cause.message : String(cause)}). ` +
        'Install it with `npm i -D playwright && npx playwright install chromium`, ' +
        'or set TLON_PLAYWRIGHT_MODULE to its location. Without it, publish on ' +
        'lint and fold alone and note that the screenshots were not reviewed.'
    );
    this.name = 'PreviewUnavailableError';
  }
}

export async function loadChromium(): Promise<PreviewLauncher> {
  try {
    const module = (await import(playwrightSpecifier())) as {
      chromium: PreviewLauncher;
    };
    return module.chromium;
  } catch (error) {
    throw new PreviewUnavailableError(error);
  }
}

export interface CapturedShot {
  cell: PreviewCell;
  path: string;
  /** shell errors reported while this cell rendered */
  errors: { phase: string; message: string }[];
  /** what the machine defect pass measured, or null when it could not run */
  observation: PreviewCellObservation | null;
  /** why the probe did not run, when it did not */
  probeProblem: string | null;
}

/**
 * Measures the rendered app, from the frame it actually rendered in.
 *
 * The app frame is found by probing: the host frame has no `.tsh-root`, so the
 * probe returns null there and the first frame that answers with a
 * measurement is the app. A frame that throws is reported as a problem rather
 * than skipped — an unprobed cell must never be indistinguishable from a clean
 * one, which is the specific way this feature could become vacuous without
 * anybody noticing.
 */
export async function probeAppFrame(page: PreviewPage): Promise<{
  observation: PreviewCellObservation | null;
  problem: string | null;
}> {
  const main = page.mainFrame();
  const problems: string[] = [];
  for (const frame of page.frames()) {
    if (frame === main) continue;
    let value: unknown;
    try {
      value = await frame.evaluate(PREVIEW_PROBE_EXPRESSION);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (value !== null && typeof value === 'object') {
      return { observation: value as PreviewCellObservation, problem: null };
    }
  }
  return {
    observation: null,
    problem:
      problems.length > 0
        ? `the app frame could not be measured: ${problems.join('; ')}`
        : 'no frame in the page reported a rendered app, so nothing was measured',
  };
}

export interface CaptureOptions {
  document: string;
  spec: SurfaceSpec;
  states: { name: PreviewStateName; state: JsonObject }[];
  outDir: string;
  canInvoke: boolean;
  deviceScaleFactor: number;
  /** height of the fold-free phone cell */
  fullHeight: number;
  /** quiet period after `ready` before the shutter, in ms */
  settleMs: number;
  /** the fixed host-supplied timestamp every cell renders at */
  now: number;
  launcher: PreviewLauncher;
}

/**
 * One browser, one context per (viewport, theme), one page per cell.
 *
 * A fresh page per cell rather than posting `theme`/`state` messages into a
 * live one is deliberate. Both are production paths, but a theme flip only
 * swaps CSS variables and does not re-render the tree (PARADIGM §1), so an
 * already-drawn chart keeps its light-mode colors in the dark capture —
 * faithful to production and useless for judging dark-mode readability.
 * Initializing each cell at its own theme is the same code path a member
 * hits when they open the channel already in dark mode.
 */
export async function capturePreview(
  options: CaptureOptions
): Promise<CapturedShot[]> {
  const cells = previewMatrix(
    options.states.map((entry) => entry.name),
    options.fullHeight
  );
  const byName = new Map(
    options.states.map((entry) => [entry.name, entry.state])
  );
  const shots: CapturedShot[] = [];

  const browser = await options.launcher.launch({ headless: true });
  try {
    for (const cell of cells) {
      const state = byName.get(cell.state);
      if (state === undefined) {
        continue;
      }
      const init = buildInitMessage({
        spec: options.spec,
        state,
        theme: cell.theme,
        canInvoke: options.canInvoke,
        now: options.now,
      });
      const context = await browser.newContext({
        viewport: { width: cell.viewport.width, height: cell.viewport.height },
        deviceScaleFactor:
          cell.viewport.deviceScaleFactor ?? options.deviceScaleFactor,
        colorScheme: cell.theme,
        // Kills CSS/Web-Animations motion at capture time. It does NOT
        // reach Chart.js — the chart primitive already defaults
        // `animation: false`, and a bundle that overrides that is what the
        // settle period below is for.
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      try {
        await page.setContent(buildPreviewHostPage(cell.theme));
        await page.evaluate(
          (payload: never) =>
            (
              window as unknown as {
                __surfacePreviewMount(value: unknown): void;
              }
            ).__surfacePreviewMount(payload),
          {
            document: options.document,
            flags: SURFACE_SANDBOX_IFRAME_FLAGS,
            init: JSON.stringify(init),
          }
        );
        await page.waitForFunction(
          'window.__surfacePreview && window.__surfacePreview.ready'
        );
        await page.waitForTimeout(options.settleMs);
        const path = join(options.outDir, cell.file);
        await page.screenshot({ path });
        const report = (await page.evaluate(
          () =>
            (window as unknown as { __surfacePreview: unknown })
              .__surfacePreview
        )) as { errors?: { phase: string; message: string }[] } | undefined;
        // After the shutter, so a probe that somehow perturbed layout could
        // not change the image that was scored.
        const probe = await probeAppFrame(page);
        shots.push({
          cell,
          path,
          errors: report?.errors ?? [],
          observation: probe.observation,
          probeProblem: probe.problem,
        });
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return shots;
}

/* ------------------------------------------------------------------ */
/* Top level                                                           */
/* ------------------------------------------------------------------ */

export interface PreviewRequest {
  bundleSource: string;
  /**
   * sha256 of the bundle's BYTES, computed by the caller with the same
   * function `surface publish` uses.
   *
   * It is the identity the rubric artifact is bound to: preview prints it into
   * the template, publish refuses a rubric that names any other hash. That is
   * what makes "the twelve cells you scored are the twelve cells these bytes
   * produce" a checked statement rather than a hoped-for one — and it is why
   * the caller computes it from the file's bytes rather than this function
   * hashing `bundleSource`, which would be a re-encoding of the file and not
   * the file.
   */
  bundleSha256: string;
  /** the raw parsed spec.json; validated here against the real schema */
  spec: unknown;
  /** resolved against the process cwd, so the command layer needs no `process` */
  outDir: string;
  includePopulated?: boolean;
  canInvoke?: boolean;
  deviceScaleFactor?: number;
  fullHeight?: number;
  settleMs?: number;
  foldRounds?: number;
  /**
   * Host events folded around the invoked actions (D70). Parse a file with
   * `parseHostOps` and pass the result; the fold validates each entry against
   * the reducer's own schema before folding it.
   */
  hostOps?: PreviewHostOps;
  /**
   * The host-supplied `now` every cell renders at. Defaults to
   * `PREVIEW_FIXED_NOW`, and a caller that overrides it should be injecting
   * another FIXED value — never `Date.now()`, which is what makes captures
   * stop being comparable.
   */
  now?: number;
  /**
   * A state to render in place of the spec's `initialState` — the channel's
   * current reduced state (`tlon surface state --json`), or the `state.json`
   * a template ships as "what CI renders".
   *
   * The substitution is total and happens BEFORE the fold, so the twelve cells
   * become: `initial` = the app on that state, `populated` = that state with
   * every declared action (and any host ops) folded through it. Same
   * substitution `dev/surfaces-render-probe.ts` makes for the preflight
   * witness, so the two agree by construction rather than by resemblance.
   *
   * Reported as `stateSource` in the manifest, because a capture of a
   * substituted state must never be indistinguishable from a capture of the
   * spec's own starting point.
   */
  stateOverride?: JsonObject;
  /**
   * Bounds for the reachability walk. The module's own defaults otherwise,
   * which are sized so a six-card, four-column board closes.
   *
   * Exposed so a caller with a very large app can trade time for a closed
   * answer, and so the tests can force a truncated one. There is no way to turn
   * the walk OFF: the whole point is that check 7 stops being scored from
   * stills, and an off switch is where that would quietly go back to happening.
   */
  reachabilityBounds?: Partial<TransitionBounds>;
  launcher?: PreviewLauncher;
}

export interface PreviewManifest {
  surfaceId: string;
  specRevision: number;
  title: string | null;
  shellVersion: number;
  /** the bytes these twelve cells were rendered from */
  bundleSha256: string;
  actions: string[];
  actors: string[];
  /**
   * The host-supplied timestamp every cell rendered at, and the declared
   * refresh cadence if the spec has one.
   *
   * Recorded because it is part of what the twelve images ARE: a reviewer
   * scoring "14 days left" has to be able to check that against the `now` the
   * capture was taken at, and a later run that produced different pixels has
   * to be diagnosable as "a different clock" rather than "a different app".
   */
  now: number;
  timeDisplayRefreshSeconds: number | null;
  /**
   * `spec-initial-state` or `override`, naming which starting point the twelve
   * cells were rendered from.
   */
  stateSource: 'spec-initial-state' | 'override';
  rubric: string;
  /** the pre-filled scoring sheet, written next to the screenshots */
  rubricTemplate: string;
  populated: {
    invokes: { actionId: string; actor: string }[];
    hostOps: { at: 'before' | 'after'; opCount: number; note?: string }[];
    /** true when the fold added a restore pass after a destructive action */
    restoredAfterDestructive: boolean;
    /** where the host ops came from, or null when none were supplied */
    hostOpsSource: string | null;
    abortedSequenceNums: number[];
    unchanged: boolean;
    problem?: string;
  };
  shots: {
    viewport: string;
    theme: string;
    state: string;
    width: number;
    height: number;
    path: string;
  }[];
  shellErrors: { cell: string; phase: string; message: string }[];
  /**
   * The machine-checked defect list, one entry per distinct defect with every
   * cell it was seen in. Grouped rather than raw because the same overflowing
   * chart appears in eight cells and eight identical lines is a wall, not a
   * list.
   */
  defects: GroupedDefect[];
  /**
   * Cells the probe could not measure, with the reason.
   *
   * Reported separately and loudly: "measured, found nothing" and "could not
   * measure" must never render the same, or the whole pass can go silently
   * vacuous.
   */
  unprobedCells: { cell: string; problem: string }[];
  /** every check this pass did not make, printed on clean runs too */
  notChecked: string[];
  /**
   * What a member can reach by PRESSING things (`surface-transitions.ts`).
   *
   * **A SIBLING of `defects`, and deliberately not more entries in it.** Do not
   * "tidy" the two together. `defects` is per-CELL — every entry names the
   * capture cells it was seen in — and a reachability finding is about the
   * app's navigation and belongs to no cell, so filing it there would mean an
   * empty `cells` array that means "not applicable": a second meaning for a
   * field that already has one.
   *
   * That is not only a taste argument; it is measured. Two suites assert the
   * shape merging would break, and both are owned elsewhere:
   * `surface-preview.test.ts` asserts `defects` is `[]` for a clean fixture and
   * that EVERY defect names exactly twelve cells, and
   * `surface-templates.test.ts` asserts `defects` is `[]` for all nine shipped
   * templates. A reachability entry satisfies neither.
   *
   * What the split costs is nothing where it matters: the two are printed as
   * ONE list by `commands/surface-preview.ts`, which is where the model reads
   * them, and check 7's entry in the rubric sheet cites this half
   * (`reachabilityCitation` in `surface-rubric-artifact.ts`).
   */
  reachability: ReachabilityReport;
}

export interface PreviewOutcome {
  manifest: PreviewManifest;
  manifestPath: string;
  rubricTemplatePath: string;
  shots: CapturedShot[];
  populated: PopulatedFold;
}

export class PreviewError extends Error {}

/**
 * Where the rubric lives, as a path the bot can open. Relative to the
 * skill root so it reads the same whether the skill is checked out in the
 * monorepo or unpacked from a release tarball.
 */
export const PREVIEW_RUBRIC_PATH = 'skills/surfaces/RUBRIC.md';

function validateSpec(raw: unknown): SurfaceSpec {
  // Preview renders a spec on its way to publication, so it holds it to the
  // write-path rules (D198).
  const parsed = PublishableSurfaceSpecSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new PreviewError(`spec is not a valid surface spec: ${detail}`);
  }
  return parsed.data;
}

/**
 * Stale shots from a previous repair round scored as if they were this
 * round's output is the one failure mode that would make the whole loop
 * lie, so every name preview can write is removed before capture — the
 * WHOLE matrix, not just this run's cells, or a `--no-populated` round
 * would leave the previous round's populated shots sitting in the
 * directory looking current. Only files preview itself writes are touched;
 * never the directory.
 */
function prepareOutDir(outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  for (const cell of previewMatrix(['initial', 'populated'])) {
    rmSync(join(outDir, cell.file), { force: true });
  }
  rmSync(join(outDir, 'manifest.json'), { force: true });
  // The template is bound to the bundle's hash, so one left over from a
  // previous repair round names bytes that no longer exist. Publish would
  // refuse it, but only after the model had filled all nineteen fields in.
  rmSync(join(outDir, PREVIEW_RUBRIC_TEMPLATE_FILE), { force: true });
}

/** The scoring sheet's file name, inside the preview output directory. */
export const PREVIEW_RUBRIC_TEMPLATE_FILE = 'rubric.template.json';

export async function renderSurfacePreview(
  request: PreviewRequest
): Promise<PreviewOutcome> {
  const spec = validateSpec(request.spec);
  const document = assemblePreviewDocument(request.bundleSource);

  const now = request.now ?? PREVIEW_FIXED_NOW;
  // Substituted into the SPEC, so the fold and the `initial` cell see the same
  // starting point and nothing downstream has to know which happened.
  const stateSource =
    request.stateOverride === undefined ? 'spec-initial-state' : 'override';
  if (request.stateOverride !== undefined) {
    spec.initialState = request.stateOverride;
  }
  const populated = foldPopulatedState(spec, {
    rounds: request.foldRounds,
    ...(request.hostOps === undefined ? {} : { hostOps: request.hostOps }),
  });
  const includePopulated = request.includePopulated !== false;
  const states: { name: PreviewStateName; state: JsonObject }[] = [
    { name: 'initial', state: spec.initialState },
  ];
  if (includePopulated) {
    states.push({ name: 'populated', state: populated.state });
  }

  const fullHeight = request.fullHeight ?? PREVIEW_FULL_HEIGHT;
  const outDir = resolve(request.outDir);
  prepareOutDir(outDir);

  const launcher = request.launcher ?? (await loadChromium());
  const shots = await capturePreview({
    document,
    spec,
    states,
    outDir,
    canInvoke: request.canInvoke ?? true,
    deviceScaleFactor: request.deviceScaleFactor ?? 2,
    fullHeight,
    settleMs: request.settleMs ?? 500,
    now,
    launcher,
  });

  const defects = shots.flatMap((shot) =>
    shot.observation === null
      ? []
      : findCellDefects(cellId(shot.cell), shot.observation)
  );
  const unprobedCells = shots
    .filter((shot) => shot.observation === null)
    .map((shot) => ({
      cell: cellId(shot.cell),
      problem: shot.probeProblem ?? 'the probe returned nothing',
    }));

  // The transition pass. It walks from `spec.initialState`, which by this point
  // IS the substituted state when `--state` was supplied — so the graph starts
  // from the same board the twelve cells show, and `stateSource` above says
  // which one that was. Synchronous, and deliberately not awaited across:
  // `installDomGlobals` swaps the ambient `window`/`document` for the duration
  // of the walk, and nothing may interleave with that.
  const { report: reachability } = analyzeSurfaceReachability({
    bundleSource: request.bundleSource,
    spec,
    ...(request.reachabilityBounds === undefined
      ? {}
      : { bounds: request.reachabilityBounds }),
  });

  const manifest: PreviewManifest = {
    surfaceId: spec.surfaceId,
    specRevision: spec.specRevision,
    title: spec.title ?? null,
    shellVersion: shellArtifactVersion,
    bundleSha256: request.bundleSha256,
    actions: Object.keys(spec.actions),
    actors: [...PREVIEW_ACTORS],
    now,
    timeDisplayRefreshSeconds: spec.timeDisplay?.refreshSeconds ?? null,
    stateSource,
    rubric: PREVIEW_RUBRIC_PATH,
    rubricTemplate: join(outDir, PREVIEW_RUBRIC_TEMPLATE_FILE),
    defects: groupDefects(defects),
    unprobedCells,
    notChecked: [...PREVIEW_DEFECTS_NOT_CHECKED],
    reachability,
    populated: {
      invokes: populated.invokes,
      hostOps: populated.hostOps,
      restoredAfterDestructive: populated.restoredAfterDestructive,
      hostOpsSource: request.hostOps?.source ?? null,
      abortedSequenceNums: populated.abortedSequenceNums,
      unchanged: populated.unchanged,
      ...(populated.problem === undefined
        ? {}
        : { problem: populated.problem }),
    },
    shots: shots.map((shot) => ({
      viewport: shot.cell.viewport.name,
      theme: shot.cell.theme,
      state: shot.cell.state,
      width: shot.cell.viewport.width,
      height: shot.cell.viewport.height,
      path: shot.path,
    })),
    shellErrors: shots.flatMap((shot) =>
      shot.errors.map((error) => ({
        cell: shot.cell.file,
        phase: error.phase,
        message: error.message,
      }))
    ),
  };

  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const rubricTemplatePath = join(outDir, PREVIEW_RUBRIC_TEMPLATE_FILE);
  writeFileSync(
    rubricTemplatePath,
    buildRubricTemplate({
      surfaceId: spec.surfaceId,
      bundleSha256: request.bundleSha256,
      // `request.spec`, not the validated `spec`: the template's `specSha256`
      // is the identity publish and fork bind the sheet to, and a hash over the
      // schema's output cannot see a change confined to a key the schema does
      // not declare (D72). The validated view is still what everything above
      // renders from; only the identity is taken raw.
      spec: request.spec,
      // The substitution, carried into the artifact. Preview already says on
      // stdout that a supplied state stood in — "loud, because a capture of a
      // substituted state must never be indistinguishable from a capture of
      // the spec's own starting point" — but stdout is not what publish reads,
      // so until this line the sheet was exactly that indistinguishable.
      // `request.stateOverride`, not the mutated `spec.initialState`, which is
      // already the override by the time this runs.
      ...(request.stateOverride === undefined
        ? {}
        : { stateOverride: request.stateOverride }),
      // Check 7's citation. The REPORT is passed, not a sentence about it, so
      // the sheet cannot describe a walk other than the one the manifest
      // records — and `not measured:` is stamped as loudly as a finding, since
      // a truncated walk reading as "checked, nothing found" is the defect this
      // whole pass exists to stop, committed in the sheet that records stopping
      // it.
      reachability,
      // Check 5's citation, and the same discipline: the FOLD is passed, not a
      // sentence about it, so the sheet cannot describe a board other than the
      // one the twelve cells show. Check 5's entire subject is the `populated`
      // captures, and those captures are this fold by these three invented
      // ships — a fact `RUBRIC.md` has stated since before the templates
      // shipped, and which a careful reader still got wrong (D167). Prose where
      // the reader will see it did not work; the sheet they are filling in is
      // the next surface in.
      populated: { fold: populated, actors: [...PREVIEW_ACTORS] },
    })
  );

  return { manifest, manifestPath, rubricTemplatePath, shots, populated };
}

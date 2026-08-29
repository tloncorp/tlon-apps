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
 *   the real reducer from the spec's own declared actions. A hand-written
 *   state object would prove nothing about whether the app's actions
 *   produce something legible, so there isn't one.
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

const { SurfaceSpecSchema } = surfaceSchemasModule as Pick<
  ApiModule,
  'SurfaceSpecSchema'
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

export interface PopulatedFold {
  state: JsonObject;
  /** every invoke that was folded, in fold order */
  invokes: { actionId: string; actor: string }[];
  /** true when the fold produced state identical to `initialState` */
  unchanged: boolean;
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
 */
export function foldPopulatedState(
  spec: SurfaceSpec,
  options: { rounds?: number; actors?: readonly string[] } = {}
): PopulatedFold {
  const rounds = Math.max(1, options.rounds ?? PREVIEW_FOLD_ROUNDS);
  const actors = options.actors ?? PREVIEW_ACTORS;
  const actionIds = Object.keys(spec.actions);

  const preserving = spec.preserveState === true;
  const posts: SurfacePostLike[] = preserving
    ? [migrationSnapshotPost(spec)]
    : [];
  const invokes: { actionId: string; actor: string }[] = [];

  let sequenceNum = 1;
  for (let round = 0; round < rounds; round++) {
    actionIds.forEach((actionId, index) => {
      const actor = actors[(index + round) % actors.length];
      posts.push(invokePost(spec, actionId, actor, sequenceNum));
      invokes.push({ actionId, actor });
      sequenceNum++;
    });
  }

  if (actionIds.length === 0) {
    return {
      state: spec.initialState,
      invokes: [],
      unchanged: true,
      problem: 'the spec declares no actions, so nothing can populate it',
    };
  }

  const reduction = reduceSurface({ spec, hostShip: PREVIEW_HOST_SHIP, posts });
  if (reduction.status !== 'reduced') {
    return {
      state: spec.initialState,
      invokes,
      unchanged: true,
      problem: `the reducer returned ${reduction.status}; captured initialState instead`,
    };
  }

  return {
    state: reduction.state,
    invokes,
    unchanged:
      JSON.stringify(reduction.state) === JSON.stringify(spec.initialState),
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
}

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
}): PreviewInitMessage {
  const message: PreviewInitMessage = {
    type: 'init',
    protocolVersion: 1,
    spec: options.spec,
    state: options.state,
    theme: options.theme,
    canInvoke: options.canInvoke,
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
export interface PreviewPage {
  setContent(html: string): Promise<void>;
  evaluate(fn: (arg: never) => unknown, arg?: unknown): Promise<unknown>;
  waitForFunction(expression: string, arg?: unknown): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(options: { path: string }): Promise<unknown>;
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
        shots.push({ cell, path, errors: report?.errors ?? [] });
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
  launcher?: PreviewLauncher;
}

export interface PreviewManifest {
  surfaceId: string;
  specRevision: number;
  title: string | null;
  shellVersion: number;
  actions: string[];
  actors: string[];
  rubric: string;
  populated: {
    invokes: { actionId: string; actor: string }[];
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
}

export interface PreviewOutcome {
  manifest: PreviewManifest;
  manifestPath: string;
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
  const parsed = SurfaceSpecSchema.safeParse(raw);
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
}

export async function renderSurfacePreview(
  request: PreviewRequest
): Promise<PreviewOutcome> {
  const spec = validateSpec(request.spec);
  const document = assemblePreviewDocument(request.bundleSource);

  const populated = foldPopulatedState(spec, { rounds: request.foldRounds });
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
    launcher,
  });

  const manifest: PreviewManifest = {
    surfaceId: spec.surfaceId,
    specRevision: spec.specRevision,
    title: spec.title ?? null,
    shellVersion: shellArtifactVersion,
    actions: Object.keys(spec.actions),
    actors: [...PREVIEW_ACTORS],
    rubric: PREVIEW_RUBRIC_PATH,
    populated: {
      invokes: populated.invokes,
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

  return { manifest, manifestPath, shots, populated };
}

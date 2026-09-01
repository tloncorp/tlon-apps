/**
 * Render a published surface app and report THE TEXT A REAL BROWSER PAINTED.
 *
 * This exists for one consumer: `dev/surfaces-assert-unsatisfied.ts`, which
 * has to answer "does this app already do X?" before a revision request is
 * issued. Half of that question is answered from the spec — an action map is
 * structured data and can simply be read — but the other half is not. A
 * behaviour can be entirely absent from the action map and still be on the
 * screen, because a surface app's render is a pure function of state and may
 * derive anything it likes from it. Session 6a.5's five revision requests were
 * four-fifths already satisfied, and the satisfaction lived in the render.
 *
 * So the question has to be asked of the render. Two ways to do that are
 * wrong:
 *
 *   - grepping the BUNDLE SOURCE. Source is not screen. A bundle can name a
 *     concept in a comment, in dead code, or behind a condition that never
 *     holds, and it can equally paint a concept whose vocabulary appears
 *     nowhere in the file (`state.total - paid` renders a number nobody wrote
 *     the word "owes" near). Source answers a different question, and this
 *     probe deliberately does not read it — the assert-unsatisfied preflight
 *     reads it separately and may only ever use it to ABSTAIN.
 *   - re-implementing the shell. "Renders like production" is not a property
 *     you can assert about a reconstruction.
 *
 * So this imports `renderSurfacePreview` from the CLI unmodified. Same shell
 * artifact, same sandbox document, same bridge, same reducer, same headless
 * Chromium, same in-frame probe that `surface preview`'s defect pass measures
 * with — the one the authoring loop itself is scored against. What comes back
 * here is `PreviewCellObservation.text`, which that probe defines as
 * "everything the cell painted, whitespace-collapsed", plus every visible
 * control's label. Nothing is reconstructed and nothing is added.
 *
 * ## The live-state substitution
 *
 * `renderSurfacePreview` renders two states: the spec's `initialState`, and a
 * populated fold of every declared action over it. Neither is what a member
 * looking at the channel right now actually sees, once the channel has events.
 * So the caller passes `--state <file>` holding the channel's REDUCED state
 * (`tlon surface state --json`), and this substitutes it for `initialState`
 * before rendering. The twelve cells then become:
 *
 *   - `initial`   → the app as it stands on the ship right now
 *   - `populated` → that, with every declared action folded through it
 *
 * which is the union the preflight wants: what a member sees, and what a
 * member could make it show by using it. A behaviour absent from both is
 * absent in the sense the preflight needs.
 *
 * `stateSource` in the output says which happened, because a probe that
 * silently fell back to `initialState` on a channel with fifty events would be
 * answering a question nobody asked.
 *
 * ## What this cannot see, stated so the caller can print it
 *
 * `notSeen` is emitted on every run, clean ones included, in the same spirit
 * as `surface preview`'s own `notChecked`. Three items are load-bearing:
 * anything only reachable by CLICKING (the probe screenshots a settled render
 * and never drives the app), anything only shown to a member who cannot act
 * (`canInvoke` is true here), and anything a host `surface event` would have
 * to deliver. A behaviour hiding in one of those is a behaviour this probe
 * will report as absent.
 *
 * Usage:
 *   bun dev/surfaces-render-probe.ts --bundle <path> --spec <path> \
 *       [--state <path>] --out <dir>
 *
 * Exit codes: 0 rendered · 2 could not render.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  cellId,
  renderSurfacePreview,
} from '../../tlon-skill/scripts/surface-preview';

/** Everything a render can be blind to, printed on clean runs too. */
export const RENDER_PROBE_NOT_SEEN = [
  'anything reachable only by interacting — the probe reads a settled render and never clicks',
  'anything shown only to a member who cannot act; every cell renders with canInvoke true',
  'anything a host `surface event` would have to deliver before it appears',
  'anything painted into a canvas, an image, or a CSS pseudo-element rather than into text nodes',
  'anything the app renders outside `.tsh-root`, which the in-frame probe does not read',
];

interface Args {
  bundle: string;
  spec: string;
  state: string | null;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const value = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const bundle = value('--bundle');
  const spec = value('--spec');
  const out = value('--out');
  if (!bundle || !spec || !out) {
    throw new Error(
      'usage: surfaces-render-probe.ts --bundle <path> --spec <path> [--state <path>] --out <dir>'
    );
  }
  return { bundle, spec, out, state: value('--state') };
}

export interface RenderProbeResult {
  ok: true;
  surfaceId: string;
  specRevision: number;
  bundleSha256: string;
  stateSource: string;
  actions: string[];
  populated: unknown;
  cells: {
    cell: string;
    viewport: string;
    theme: string;
    state: string;
    path: string;
    text: string;
    controls: string[];
  }[];
  unprobedCells: { cell: string; problem: string }[];
  shellErrors: { cell: string; phase: string; message: string }[];
  notSeen: string[];
  manifestPath: string;
}

export async function probeRender(args: Args): Promise<RenderProbeResult> {
  const bundleBytes = readFileSync(args.bundle);
  const bundleSource = bundleBytes.toString('utf8');
  const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');

  const spec = JSON.parse(readFileSync(args.spec, 'utf8')) as Record<
    string,
    unknown
  >;

  // The substitution, and the one place it happens. Reported, never assumed.
  let stateSource = 'spec-initial-state';
  if (args.state) {
    const live = JSON.parse(readFileSync(args.state, 'utf8')) as unknown;
    if (live === null || typeof live !== 'object' || Array.isArray(live)) {
      throw new Error(
        `--state ${args.state} does not hold a JSON object, so it cannot be a surface state`
      );
    }
    spec.initialState = live;
    stateSource = 'live-reduced-state';
  }

  const outcome = await renderSurfacePreview({
    bundleSource,
    bundleSha256,
    spec,
    outDir: resolve(args.out),
    includePopulated: true,
    // 500ms is `surface preview`'s own default and what the authoring loop is
    // scored against; a shorter settle here would measure a different render
    // from the one the rubric sees.
    settleMs: 500,
    // Screenshots are a by-product for this consumer — a human checking the
    // evidence wants to be able to LOOK at the cell whose text is quoted — but
    // they are not what is read, so they need not be retina.
    deviceScaleFactor: 1,
  });

  const cells = outcome.shots
    .filter((shot) => shot.observation !== null)
    .map((shot) => ({
      cell: cellId(shot.cell),
      viewport: shot.cell.viewport.name,
      theme: shot.cell.theme,
      state: shot.cell.state,
      path: shot.path,
      text: shot.observation!.text,
      controls: shot.observation!.controls.map((control) => control.text),
    }));

  const result: RenderProbeResult = {
    ok: true,
    surfaceId: outcome.manifest.surfaceId,
    specRevision: outcome.manifest.specRevision,
    bundleSha256,
    stateSource,
    actions: outcome.manifest.actions,
    populated: outcome.manifest.populated,
    cells,
    // Reported separately and loudly, for the same reason `surface preview`
    // does it: "measured, found nothing" and "could not measure" must never
    // render the same. The preflight ABSTAINS when this is non-empty.
    unprobedCells: outcome.manifest.unprobedCells,
    shellErrors: outcome.manifest.shellErrors,
    notSeen: RENDER_PROBE_NOT_SEEN,
    manifestPath: outcome.manifestPath,
  };

  writeFileSync(
    resolve(args.out, 'render-probe.json'),
    `${JSON.stringify(result, null, 2)}\n`
  );
  return result;
}

/**
 * Standalone use, for looking at what a channel paints without judging it —
 * which is how a witness's `renderNegatives` get drawn verbatim from a target's
 * own output rather than imagined.
 */
if (import.meta.main) {
  probeRender(parseArgs(process.argv.slice(2)))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    })
    .catch((error: unknown) => {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          stage: 'render',
          message: error instanceof Error ? error.message : String(error),
        })}\n`
      );
      process.exit(2);
    });
}

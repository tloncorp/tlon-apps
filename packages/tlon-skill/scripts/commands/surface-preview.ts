import {
  PREVIEW_ACTORS,
  PREVIEW_FULL_HEIGHT,
  PREVIEW_RUBRIC_PATH,
  PREVIEW_RUBRIC_TEMPLATE_FILE,
  type PreviewOutcome,
  type PreviewRequest,
  PreviewError,
  PreviewUnavailableError,
  renderSurfacePreview,
} from '../surface-preview';
import {
  type CommandDeps,
  type CommandRunner,
  commandError,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

/**
 * `tlon surface preview <bundle> <spec>` — the authoring bot's own eyes.
 *
 * The command does no judging. It renders the app the way production does,
 * writes the capture matrix, prints the paths in the order they should be
 * read (phone first), and points at the rubric; SCORING those images is the
 * bot's job at runtime with its vision model.
 *
 * Exit codes: 0 when every cell rendered; 1 on a usage/IO/spec failure, on
 * a missing headless Chromium, or when the shell reported an init- or
 * render-phase error while capturing — a preview whose subject is the error
 * box is a failed preview, even though the PNGs are still written and still
 * worth looking at.
 *
 * Machine-checked defects deliberately do NOT change the exit code. The exit
 * code answers "did the preview run", and a repair loop that read a defect
 * list as "the tool broke" would stop where it is supposed to iterate. The
 * enforcement point is `surface publish --rubric`, which refuses without a
 * completed scoring sheet; preview's job is to make finding nothing hard.
 */

export const SURFACE_PREVIEW_HELP = `Usage: tlon surface preview <bundle> <spec> [options]

Renders a surface app exactly as the app renders it — the real shell
artifact, the real sandbox document, the real bridge — in headless Chromium,
and screenshots the capture matrix:

  phone (390x844) first, then the same width with the fold removed, then
  desktop (1280x900)
  both themes
  two states: initialState, and a populated state produced by folding every
  declared action through the real reducer as ${PREVIEW_ACTORS.join(', ')}

Arguments:
  <bundle>            path to the app bundle (a single plain script)
  <spec>              path to spec.json

Options:
  --out <dir>         output directory (default: ./surface-preview)
  --settle <ms>       quiet period after render before the shutter (default: 500)
  --scale <n>         device scale factor (default: 2)
  --full-height <px>  height of the fold-free phone cell (default: ${PREVIEW_FULL_HEIGHT})
  --rounds <n>        fold rounds per declared action (default: 2)
  --no-populated      capture the initial state only
  --read-only         render as a member who cannot act (canInvoke false)
  --json              print the manifest as JSON instead of a report
  --help, -h          show this help

It then runs a machine-checked defect pass over every rendered cell —
viewport overflow from layout metrics, tap-target geometry, and the jargon
denylist over the text a real browser painted — and prints what it found as
a concrete list. That pass cannot see whether copy means anything, whether
the screen answers what was asked, or anything about colour; it prints what
it did not check on every run, including clean ones.

Finally it writes ${PREVIEW_RUBRIC_TEMPLATE_FILE} into the output directory: the
scoring sheet, pre-keyed for all twelve cells and all seven checks and
stamped with this bundle's sha256. Fill it in and pass it to
\`surface publish --rubric <file>\`, which refuses to publish without it.

Then score the screenshots against ${PREVIEW_RUBRIC_PATH}.`;

/**
 * Preview reads two files and drives a browser, and nothing else — no ship,
 * no credentials. Both are injected: the command layer may not touch `fs`
 * (the `command-contract` suite), and a test that had to launch Chromium to
 * check an exit code would not be a unit test.
 */
export interface SurfacePreviewDeps extends CommandDeps {
  readFile(path: string): string;
  /**
   * The bundle, as bytes. Read as bytes rather than text because its sha256
   * is the identity the rubric artifact is bound to, and `surface publish`
   * computes that hash over the file's bytes: hashing a decoded-and-re-encoded
   * string would agree with it almost always, and the "almost" is a refusal
   * nobody could diagnose.
   */
  readBundleBytes(path: string): Uint8Array;
  sha256Hex(bytes: Uint8Array): string;
  render(request: PreviewRequest): Promise<PreviewOutcome>;
}

interface ParsedArgs {
  bundle: string;
  spec: string;
  outDir: string;
  settleMs: number;
  deviceScaleFactor: number;
  fullHeight: number;
  foldRounds: number;
  includePopulated: boolean;
  canInvoke: boolean;
  json: boolean;
}

function numberFlag(name: string, raw: string | undefined): number {
  const value = Number(raw);
  if (raw === undefined || !Number.isFinite(value) || value < 0) {
    throw usageError(
      `${name} needs a non-negative number`,
      SURFACE_PREVIEW_HELP
    );
  }
  return value;
}

function positiveFlag(name: string, raw: string | undefined): number {
  const value = numberFlag(name, raw);
  if (value <= 0) {
    throw usageError(`${name} needs a positive number`, SURFACE_PREVIEW_HELP);
  }
  return value;
}

export function parseSurfacePreviewArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  let outDir = 'surface-preview';
  let settleMs = 500;
  let deviceScaleFactor = 2;
  let fullHeight = PREVIEW_FULL_HEIGHT;
  let foldRounds = 2;
  let includePopulated = true;
  let canInvoke = true;
  let json = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case '--out': {
        const value = args[++index];
        if (value === undefined) {
          throw usageError('--out needs a directory', SURFACE_PREVIEW_HELP);
        }
        outDir = value;
        break;
      }
      case '--settle':
        settleMs = numberFlag('--settle', args[++index]);
        break;
      case '--scale':
        deviceScaleFactor = positiveFlag('--scale', args[++index]);
        break;
      case '--full-height':
        fullHeight = positiveFlag('--full-height', args[++index]);
        break;
      case '--rounds':
        foldRounds = positiveFlag('--rounds', args[++index]);
        break;
      case '--no-populated':
        includePopulated = false;
        break;
      case '--read-only':
        canInvoke = false;
        break;
      case '--json':
        json = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw usageError(`unknown option ${arg}`, SURFACE_PREVIEW_HELP);
        }
        positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw usageError(
      'preview needs a bundle path and a spec path',
      SURFACE_PREVIEW_HELP
    );
  }
  if (positional.length > 2) {
    throw usageError(
      `unexpected argument ${positional[2]}`,
      SURFACE_PREVIEW_HELP
    );
  }

  return {
    bundle: positional[0],
    spec: positional[1],
    outDir,
    settleMs,
    deviceScaleFactor,
    fullHeight,
    foldRounds,
    includePopulated,
    canInvoke,
    json,
  };
}

function read(deps: SurfacePreviewDeps, path: string, what: string): string {
  try {
    return deps.readFile(path);
  } catch (error) {
    throw commandError(
      `could not read the ${what} at ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * The machine-checked defect list, and — always, defects or none — the list of
 * things it did not check.
 *
 * The second half is not politeness. A pass that finds nothing and stops
 * reads as "the app is fine", which is false, and would make this feature
 * worse than not having it: 6a's whole finding is that the model will take any
 * available signal that it is done. So a clean pass prints "found nothing" and
 * then prints six things it cannot see.
 */
function reportDefects(
  deps: SurfacePreviewDeps,
  outcome: PreviewOutcome
): void {
  const { defects, unprobedCells, notChecked } = outcome.manifest;

  writeLine(deps.stdout);
  if (defects.length === 0) {
    writeLine(
      deps.stdout,
      'Machine-checked defects: none found in the three checks below.'
    );
  } else {
    writeLine(
      deps.stdout,
      `Machine-checked defects: ${defects.length} found. Each is a repair, not a note.`
    );
    writeLine(deps.stdout);
    for (const defect of defects) {
      writeLine(
        deps.stdout,
        `  [rubric ${defect.rubricCheck}: ${defect.check}] ${defect.message}`
      );
      writeLine(deps.stdout, `      seen in: ${defect.cells.join(', ')}`);
    }
  }

  if (unprobedCells.length > 0) {
    writeLine(deps.stdout);
    writeLine(
      deps.stdout,
      `${unprobedCells.length} cell(s) could NOT be measured, so "no defects" says nothing about them:`
    );
    for (const entry of unprobedCells) {
      writeLine(deps.stdout, `  ${entry.cell}: ${entry.problem}`);
    }
  }

  writeLine(deps.stdout);
  writeLine(
    deps.stdout,
    'That pass is mechanical: viewport overflow from layout metrics, tap-target'
  );
  writeLine(
    deps.stdout,
    'geometry, and the jargon denylist over rendered text. It did NOT check:'
  );
  for (const line of notChecked) {
    writeLine(deps.stdout, `  - ${line}`);
  }
  writeLine(deps.stdout, 'A clean machine pass is not a clean app.');
}

function report(deps: SurfacePreviewDeps, outcome: PreviewOutcome): void {
  const { manifest } = outcome;
  const label = manifest.title ?? manifest.surfaceId;
  writeLine(deps.stdout, `${label} — revision ${manifest.specRevision}`);

  if (outcome.populated.problem !== undefined) {
    writeLine(deps.stdout, `  populated state: ${outcome.populated.problem}`);
  } else if (outcome.populated.unchanged) {
    writeLine(
      deps.stdout,
      `  populated state: folding all ${manifest.actions.length} action(s) changed nothing — the populated shots will look identical to the empty ones`
    );
  } else {
    writeLine(
      deps.stdout,
      `  populated state: ${outcome.populated.invokes.length} invoke(s) folded as ${manifest.actors.join(', ')}`
    );
  }
  writeLine(deps.stdout);

  let viewport: string | null = null;
  for (const shot of manifest.shots) {
    if (shot.viewport !== viewport) {
      viewport = shot.viewport;
      writeLine(deps.stdout, `${viewport} ${shot.width}x${shot.height}`);
    }
    writeLine(
      deps.stdout,
      `  ${shot.state.padEnd(9)} ${shot.theme.padEnd(5)}  ${shot.path}`
    );
  }

  writeLine(deps.stdout);
  writeLine(deps.stdout, `manifest: ${outcome.manifestPath}`);

  reportDefects(deps, outcome);

  writeLine(deps.stdout);
  writeLine(deps.stdout, `Now score all twelve against ${manifest.rubric}.`);
  writeLine(
    deps.stdout,
    `Record the scoring in ${outcome.rubricTemplatePath} (already keyed for the`
  );
  writeLine(
    deps.stdout,
    "twelve cells and the seven checks, and stamped with this bundle's hash),"
  );
  writeLine(
    deps.stdout,
    'then pass it to `surface publish --rubric <file>`. Publish refuses without it.'
  );

  if (manifest.shellErrors.length > 0) {
    writeLine(deps.stderr);
    writeLine(
      deps.stderr,
      `The shell reported ${manifest.shellErrors.length} error(s) while capturing:`
    );
    for (const error of manifest.shellErrors) {
      writeLine(
        deps.stderr,
        `  ${error.cell} [${error.phase}] ${error.message}`
      );
    }
  }
}

export const run: CommandRunner<SurfacePreviewDeps> = async (args, deps) => {
  try {
    if (args.length === 0 || isHelpArg(args[0])) {
      return writeHelp(deps, SURFACE_PREVIEW_HELP);
    }
    const parsed = parseSurfacePreviewArgs(args);
    // Bytes once, then decoded — so the hash stamped into the rubric template
    // and the source handed to the renderer are provably the same file.
    let bundleBytes: Uint8Array;
    try {
      bundleBytes = deps.readBundleBytes(parsed.bundle);
    } catch (error) {
      throw commandError(
        `could not read the bundle at ${parsed.bundle}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    const bundleSource = new TextDecoder().decode(bundleBytes);
    const bundleSha256 = deps.sha256Hex(bundleBytes);
    const specText = read(deps, parsed.spec, 'spec');

    let spec: unknown;
    try {
      spec = JSON.parse(specText);
    } catch (error) {
      throw commandError(
        `${parsed.spec} is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    let outcome: PreviewOutcome;
    try {
      outcome = await deps.render({
        bundleSource,
        bundleSha256,
        spec,
        outDir: parsed.outDir,
        includePopulated: parsed.includePopulated,
        canInvoke: parsed.canInvoke,
        deviceScaleFactor: parsed.deviceScaleFactor,
        fullHeight: parsed.fullHeight,
        settleMs: parsed.settleMs,
        foldRounds: parsed.foldRounds,
      });
    } catch (error) {
      if (
        error instanceof PreviewError ||
        error instanceof PreviewUnavailableError
      ) {
        throw commandError(error.message);
      }
      throw error;
    }

    if (parsed.json) {
      writeLine(deps.stdout, JSON.stringify(outcome.manifest, null, 2));
    } else {
      report(deps, outcome);
    }

    return outcome.manifest.shellErrors.length > 0 ? 1 : 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) {
      return handled;
    }
    throw error;
  }
};

/**
 * The `surface *` group's calling convention, so `commands/surface.ts` can
 * wire preview with one case arm and one help entry:
 *
 *   case 'preview': return await runSurfacePreview(rest, deps);
 *
 * Typed structurally rather than against the group's `SurfaceDeps` so
 * preview keeps no dependency on the rest of the group: it needs one text
 * file and two writers, and none of the ship-facing surface the others do.
 */
export async function runSurfacePreview(
  args: string[],
  deps: CommandDeps & {
    readTextFile(path: string): string;
    readBinaryFile(path: string): Uint8Array;
    sha256Hex(bytes: Uint8Array): string;
  }
): Promise<number> {
  return run(args, {
    stdout: deps.stdout,
    stderr: deps.stderr,
    readFile: deps.readTextFile,
    // The SAME two functions `surface publish` uses to hash the bundle it
    // uploads. Sharing them is what makes the rubric's hash binding an
    // identity rather than an agreement between two implementations.
    readBundleBytes: deps.readBinaryFile,
    sha256Hex: deps.sha256Hex,
    render: renderSurfacePreview,
  });
}

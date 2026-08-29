import {
  PREVIEW_ACTORS,
  PREVIEW_FULL_HEIGHT,
  PREVIEW_RUBRIC_PATH,
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

Then score the screenshots against ${PREVIEW_RUBRIC_PATH}.`;

/**
 * Preview reads two files and drives a browser, and nothing else — no ship,
 * no credentials. Both are injected: the command layer may not touch `fs`
 * (the `command-contract` suite), and a test that had to launch Chromium to
 * check an exit code would not be a unit test.
 */
export interface SurfacePreviewDeps extends CommandDeps {
  readFile(path: string): string;
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
  writeLine(deps.stdout, `Now score these against ${manifest.rubric}.`);

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
    const bundleSource = read(deps, parsed.bundle, 'bundle');
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
  deps: CommandDeps & { readTextFile(path: string): string }
): Promise<number> {
  return run(args, {
    stdout: deps.stdout,
    stderr: deps.stderr,
    readFile: deps.readTextFile,
    render: renderSurfacePreview,
  });
}

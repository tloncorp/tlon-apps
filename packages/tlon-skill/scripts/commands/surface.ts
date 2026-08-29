import {
  type CommandDeps,
  handleExpectedCommandError,
  isHelpArg,
  writeHelp,
  writeLine,
} from './command';
import { SurfaceError, type SurfaceDeps } from './surface-common';
import { runSurfaceCreate } from './surface-create';
import { runSurfaceLint } from './surface-lint';
import { runSurfacePreview } from './surface-preview';
import { runSurfacePublish } from './surface-publish';
import {
  runSurfaceEvent,
  runSurfaceSnapshot,
  runSurfaceState,
} from './surface-records';
import { runSurfaceTemplates } from './surface-templates';

export const SURFACE_HELP = `Usage: tlon surface <subcommand> [args...]

Dashboard (surface) channels: small apps that live in a channel's definition
and fold their state out of the channel's own posts.

Subcommands:
  create      Create a dashboard channel in a group you administer
  templates   Browse the templates shipped with the authoring skill
  lint        Run the publish gate over a bundle and spec
  publish     Gate, upload, and publish an app to a channel
  event       Post a host update, or retract one
  state       Hydrate a dashboard and print its reduced state
  snapshot    Post a snapshot, compacting the channel's history

Every command that writes confirms by reading the result back and says what
it observed. A poke that resolves is never treated as a write that landed.

Options:
  --json      Available on every subcommand; emits a machine-readable result,
              and on failure a { ok: false, code, message } document
  -h, --help  Show this help, or a subcommand's help

Run "tlon surface <subcommand> --help" for the details of one command.`;

export const SURFACE_SUBCOMMANDS = [
  'create',
  'templates',
  'lint',
  'publish',
  'event',
  'state',
  'snapshot',
  'preview',
] as const;

/**
 * Renders a failure in whichever register the caller asked for.
 *
 * The `--json` document is the one a self-repair loop reads: a stable
 * `code`, the same sentence a person would have been shown, and whatever
 * structured `details` the failure carried (a gate's violation list, the
 * exact thing an observation failed to see). The plain form is the same
 * information as one line, with the code in brackets so a transcript stays
 * greppable.
 */
function reportSurfaceError(
  deps: CommandDeps,
  error: SurfaceError,
  asJson: boolean
): number {
  if (asJson) {
    writeLine(
      deps.stdout,
      JSON.stringify({
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details,
      })
    );
    return error.exitCode;
  }
  writeLine(deps.stderr, `Error: [${error.code}] ${error.message}`);
  const help = error.details.help;
  if (typeof help === 'string') {
    writeLine(deps.stderr, '');
    writeLine(deps.stderr, help);
  }
  return error.exitCode;
}

export async function run(args: string[], deps: SurfaceDeps): Promise<number> {
  const subcommand = args[0];
  const rest = args.slice(1);
  // `--json` is a per-subcommand flag, but a failure has to be rendered
  // before any subcommand has parsed anything, so the dispatcher looks for
  // it directly rather than guessing a default register.
  const asJson = args.includes('--json');

  if (!subcommand || isHelpArg(subcommand)) {
    return writeHelp(deps, SURFACE_HELP);
  }

  try {
    switch (subcommand) {
      case 'create':
        return await runSurfaceCreate(rest, deps);
      case 'templates':
        return await runSurfaceTemplates(rest, deps);
      case 'lint':
        return await runSurfaceLint(rest, deps);
      case 'publish':
        return await runSurfacePublish(rest, deps);
      case 'event':
        return await runSurfaceEvent(rest, deps);
      case 'state':
        return await runSurfaceState(rest, deps);
      case 'snapshot':
        return await runSurfaceSnapshot(rest, deps);
      case 'preview':
        return await runSurfacePreview(rest, deps);
      default:
        writeLine(deps.stderr, `Unknown surface subcommand: ${subcommand}`);
        writeLine(deps.stderr, '');
        writeLine(deps.stderr, SURFACE_HELP);
        return 1;
    }
  } catch (error) {
    if (error instanceof SurfaceError) {
      return reportSurfaceError(deps, error, asJson);
    }
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}

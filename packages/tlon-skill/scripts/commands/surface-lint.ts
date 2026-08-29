import type { SurfaceLintResult } from '../surface-lint';
import {
  type SurfaceDeps,
  parseSurfaceArgs,
  readJsonFile,
  surfaceError,
  usageSurfaceError,
  writeSurfaceJson,
} from './surface-common';
import { writeLine } from './command';

export const SURFACE_LINT_HELP = `Usage: tlon surface lint <bundle> <spec> [--json]

Run the publish gate over an app bundle and its spec, without publishing.

The bundle is JAVASCRIPT SOURCE, not a document. The sandbox injects it
inside a <script> tag and the harness wraps it in a function, so markup in
this file would never run — any extension is accepted, but the contents must
be a plain script.

Exit status is 0 when the gate passes and 1 when any error-severity rule
fires. Warnings are reported and never affect the exit status.

Options:
  --json      Emit the violation list as a machine-readable document
  -h, --help  Show this help

Example:
  tlon surface lint ./app.js ./spec.json`;

export function lintJsonDocument(
  result: SurfaceLintResult
): Record<string, unknown> {
  return {
    ok: result.ok,
    violations: result.violations,
    warnings: result.warnings,
    skipped: result.skipped,
  };
}

/**
 * Reads a bundle as text. A bundle that cannot be read at all is a usage
 * problem rather than a gate finding — the gate has nothing to say about a
 * file that is not there, and reporting it as a violation would send a
 * repair loop looking for a defect in code it never wrote.
 */
function readBundleSource(deps: SurfaceDeps, path: string): string {
  try {
    return deps.readTextFile(path);
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

export async function runSurfaceLint(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    { boolean: ['--json'] },
    SURFACE_LINT_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_LINT_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const [bundlePath, specPath, ...rest] = parsed.positional;
  if (!bundlePath || !specPath) {
    throw usageSurfaceError(
      'a bundle path and a spec path are both required',
      SURFACE_LINT_HELP
    );
  }
  if (rest.length > 0) {
    throw usageSurfaceError(
      `Unexpected argument: ${rest[0]}`,
      SURFACE_LINT_HELP
    );
  }

  const bundleSource = readBundleSource(deps, bundlePath);
  const spec = readJsonFile(deps, specPath, 'spec');
  const result = deps.lint({ bundleSource, spec });

  if (asJson) {
    writeSurfaceJson(deps, {
      ...lintJsonDocument(result),
      bundle: bundlePath,
      spec: specPath,
    });
    return result.ok ? 0 : 1;
  }

  const formatted = deps.formatLint(result);
  if (formatted.length > 0) {
    writeLine(result.ok ? deps.stdout : deps.stderr, formatted);
  }
  if (result.ok) {
    writeLine(
      deps.stdout,
      `Gate passed: ${bundlePath} is publishable against ${specPath}.`
    );
    return 0;
  }
  writeLine(
    deps.stderr,
    `Gate failed: ${result.violations.length} violation${
      result.violations.length === 1 ? '' : 's'
    } in ${bundlePath}.`
  );
  return 1;
}

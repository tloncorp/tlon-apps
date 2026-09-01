import {
  type SurfaceDeps,
  type SurfaceReport,
  emitReport,
  parseSurfaceArgs,
  surfaceError,
  usageSurfaceError,
} from './surface-common';

export const SURFACE_TEMPLATES_HELP = `Usage: tlon surface templates list [--json]
       tlon surface templates show <name> [--json]

Browse the dashboard templates shipped with the surfaces authoring skill.

A template is a directory holding the app bundle (JavaScript), its spec.json,
and NOTES.md describing what to customize.

Options:
  --json      Emit a machine-readable result
  -h, --help  Show this help`;

function describeSummary(template: {
  name: string;
  title: string | null;
  files: { bundle: string | null; spec: string | null; notes: string | null };
}): string {
  const missing = (['bundle', 'spec', 'notes'] as const).filter(
    (key) => template.files[key] === null
  );
  const suffix =
    missing.length > 0 ? `  (incomplete — no ${missing.join(', ')})` : '';
  return `  ${template.name}${template.title ? ` — ${template.title}` : ''}${suffix}`;
}

function runList(deps: SurfaceDeps, asJson: boolean): number {
  const root = deps.templates.root();
  const templates = deps.templates.exists() ? deps.templates.list() : [];

  // An empty catalogue is a fact about this install, not a failure: the
  // templates land in a later session and a bot asking "what can I start
  // from?" needs a clean empty answer rather than an error to recover from.
  const report: SurfaceReport = {
    json: {
      root,
      installed: deps.templates.exists(),
      templates: templates.map((template) => ({
        name: template.name,
        title: template.title,
        files: template.files,
      })),
    },
    lines:
      templates.length === 0
        ? [
            `No dashboard templates are installed (looked in ${root}).`,
            'Write the app bundle and spec by hand, or install a build that ships them.',
          ]
        : [
            `${templates.length} dashboard template${templates.length === 1 ? '' : 's'} in ${root}:`,
            ...templates.map(describeSummary),
          ],
  };
  return emitReport(deps, report, asJson);
}

function runShow(deps: SurfaceDeps, name: string, asJson: boolean): number {
  const detail = deps.templates.exists() ? deps.templates.read(name) : null;
  if (!detail) {
    const available = deps.templates.exists()
      ? deps.templates.list().map((template) => template.name)
      : [];
    if (available.length === 0) {
      throw surfaceError(
        'template-catalogue-empty',
        `No dashboard templates are installed (looked in ${deps.templates.root()}), so "${name}" cannot be shown.`,
        { name, root: deps.templates.root() }
      );
    }
    throw surfaceError(
      'template-not-found',
      `No dashboard template named "${name}". Available: ${available.join(', ')}.`,
      { name, available }
    );
  }

  // A template with no bundle is not a template, and this command's whole
  // job is handing a bot the bundle to copy. The lookup used to fall back to
  // an arbitrary `.js` file from the directory — so a malformed template
  // returned exit 0 and a path to something that was never an app. The
  // refusal names all three things a repair needs: which template, what was
  // expected, and what the directory actually holds.
  if (detail.files.bundle === null) {
    const absence = detail.bundleAbsence;
    const expected = absence?.expected ?? [];
    const found = absence?.found ?? [];
    throw surfaceError(
      'template-bundle-missing',
      `Template "${detail.name}" ships no app bundle, so there is nothing to show. Expected one of ${expected.join(', ')}; ${
        found.length === 0
          ? 'the directory is empty'
          : `the directory holds ${found.join(', ')}`
      }.`,
      { name: detail.name, expected, found }
    );
  }

  const actions =
    detail.spec &&
    typeof detail.spec === 'object' &&
    !Array.isArray(detail.spec) &&
    typeof (detail.spec as { actions?: unknown }).actions === 'object' &&
    (detail.spec as { actions?: unknown }).actions !== null
      ? Object.keys(
          (detail.spec as { actions: Record<string, unknown> }).actions
        )
      : [];

  const report: SurfaceReport = {
    json: {
      name: detail.name,
      title: detail.title,
      files: detail.files,
      bundleBytes: detail.bundleBytes,
      actions,
      spec: detail.spec ?? null,
      notes: detail.notes,
    },
    lines: [
      `${detail.name}${detail.title ? ` — ${detail.title}` : ''}`,
      // No `(missing)` branch: a bundle-less template was refused above.
      `  bundle: ${detail.files.bundle}${
        detail.bundleBytes === null ? '' : ` (${detail.bundleBytes} bytes)`
      }`,
      `  spec:   ${detail.files.spec ?? '(missing)'}`,
      `  notes:  ${detail.files.notes ?? '(missing)'}`,
      // An empty action map is the shape a forgotten action and a deliberate
      // display-only app share, and telling them apart is the entire purpose of
      // the `memberInteraction` marker (D133). Printing "(none declared)" with
      // the marker's sentence withheld shows an inspecting bot exactly the
      // ambiguity the marker exists to remove — so when the sentence is there,
      // it is printed, and when it is not, this says which of the two this is.
      `  actions: ${
        actions.length > 0
          ? actions.join(', ')
          : displayOnlyBecause(detail.spec) !== null
            ? '(none — display-only by declaration)'
            : '(none declared)'
      }`,
      ...(actions.length === 0 && displayOnlyBecause(detail.spec) !== null
        ? [`  because: ${displayOnlyBecause(detail.spec)}`]
        : []),
      ...(detail.notes ? ['', detail.notes.trimEnd()] : []),
    ],
  };
  return emitReport(deps, report, asJson);
}

/**
 * The display-only marker's sentence, when the spec carries one.
 *
 * Read off the spec as the template ships it, not off a validated copy: the
 * point of `show` is to report what an authoring bot would be copying.
 */
function displayOnlyBecause(spec: unknown): string | null {
  if (typeof spec !== 'object' || spec === null) return null;
  const marker = (spec as Record<string, unknown>).memberInteraction;
  if (typeof marker !== 'object' || marker === null) return null;
  const record = marker as Record<string, unknown>;
  if (record.mode !== 'none') return null;
  const because = record.because;
  return typeof because === 'string' && because.trim() !== ''
    ? because.trim()
    : null;
}

export async function runSurfaceTemplates(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    { boolean: ['--json'] },
    SURFACE_TEMPLATES_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_TEMPLATES_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const subcommand = parsed.positional[0];

  if (subcommand === undefined || subcommand === 'list') {
    if (parsed.positional.length > 1) {
      throw usageSurfaceError(
        `Unexpected argument: ${parsed.positional[1]}`,
        SURFACE_TEMPLATES_HELP
      );
    }
    return runList(deps, asJson);
  }

  if (subcommand === 'show') {
    const name = parsed.positional[1];
    if (!name) {
      throw usageSurfaceError(
        'show requires a template name',
        SURFACE_TEMPLATES_HELP
      );
    }
    if (parsed.positional.length > 2) {
      throw usageSurfaceError(
        `Unexpected argument: ${parsed.positional[2]}`,
        SURFACE_TEMPLATES_HELP
      );
    }
    return runShow(deps, name, asJson);
  }

  throw usageSurfaceError(
    `Unknown templates subcommand: ${subcommand}`,
    SURFACE_TEMPLATES_HELP
  );
}

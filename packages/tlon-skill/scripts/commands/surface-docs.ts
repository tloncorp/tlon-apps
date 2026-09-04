import {
  readSurfaceSkillDocument,
  surfaceSkillDocumentPath,
} from '../surface-docs-runtime';
import {
  type SurfaceDeps,
  type SurfaceReport,
  emitReport,
  parseSurfaceArgs,
  surfaceError,
  usageSurfaceError,
} from './surface-common';

/**
 * `tlon surface doctrine | primitives | rubric` — the skill's own documents,
 * printed to stdout.
 *
 * These exist because the skill mechanism does not deliver them. Under
 * Hermes, `skill_view` serves a plugin skill's `SKILL.md` and nothing else
 * (D74): `PARADIGM.md`, `PRIMITIVES.md` and `RUBRIC.md` are in the package
 * on disk but unreachable through the skill, so a Hermes-hosted bot reads
 * the workflow and never reads the doctrine that keeps it from writing a
 * non-idempotent `append` app. Under OpenClaw the same files ARE published
 * into the discovery tree. Two runtimes, two different skills.
 *
 * The CLI is the one thing both runtimes invoke, so the CLI is where the
 * documents are delivered, and `SKILL.md` now instructs reading them through
 * these commands rather than naming file paths a bot may or may not be able
 * to open.
 *
 * The claim this earns is precise, and smaller than "reachable everywhere":
 * the doctrine becomes exactly as reachable as the rest of the skill's own
 * workflow. It rides on ONE precondition — that the bot may run
 * `tlon surface …` at all, which `surface lint` and `surface publish`
 * already require — instead of a second, runtime-dependent one. That
 * precondition is not satisfied today: the OpenClaw plugin's tool guard
 * (`ALLOWED_TLON_COMMANDS`) does not list `surface` among the command groups
 * a model may invoke, which gates the whole skill and not just these three.
 */

export const SURFACE_DOCUMENTS = {
  doctrine: {
    file: 'PARADIGM.md',
    summary: 'the contract and doctrine — read before writing any app code',
  },
  primitives: {
    file: 'PRIMITIVES.md',
    summary: 'the component catalog — read the entries you draw with',
  },
  rubric: {
    file: 'RUBRIC.md',
    summary: "the checks you score preview's screenshots against",
  },
} as const;

export type SurfaceDocumentId = keyof typeof SURFACE_DOCUMENTS;

export const SURFACE_DOCUMENT_IDS = Object.keys(
  SURFACE_DOCUMENTS
) as SurfaceDocumentId[];

export function isSurfaceDocumentId(value: string): value is SurfaceDocumentId {
  return Object.prototype.hasOwnProperty.call(SURFACE_DOCUMENTS, value);
}

export function surfaceDocumentPath(id: SurfaceDocumentId): string {
  return surfaceSkillDocumentPath(SURFACE_DOCUMENTS[id].file);
}

export function surfaceDocumentHelp(id: SurfaceDocumentId): string {
  const document = SURFACE_DOCUMENTS[id];
  return `Usage: tlon surface ${id} [--json]

Print ${document.file}, verbatim, from the packaged surfaces skill:
${document.summary}.

The command exists because the skill mechanism is not a reliable way to read
it — one runtime publishes the whole skill directory, the other serves
SKILL.md alone. Wherever the CLI runs, this is the same document.

Options:
  --json      Emit { ok: true, document, file, path, bytes, text }
  -h, --help  Show this help`;
}

const REMEDY =
  'Set TLON_SURFACE_SKILL_DIR to the skills/surfaces directory of the @tloncorp/tlon-skill package, or invoke the "tlon" wrapper rather than the platform binary directly.';

function readDocument(id: SurfaceDocumentId): { path: string; text: string } {
  const document = SURFACE_DOCUMENTS[id];
  const read = readSurfaceSkillDocument(document.file);
  if (read.ok) return { path: read.path, text: read.text };
  const detail =
    read.reason === 'empty'
      ? `The surfaces skill document at ${read.path} is empty.`
      : `The surfaces skill document ${document.file} is not installed (looked in ${read.path}).`;
  throw surfaceError('doctrine-unavailable', `${detail} ${REMEDY}`, {
    document: id,
    file: document.file,
    path: read.path,
    root: read.root,
  });
}

export async function runSurfaceDocument(
  id: SurfaceDocumentId,
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const help = surfaceDocumentHelp(id);
  const parsed = parseSurfaceArgs(args, { boolean: ['--json'] }, help);
  if (parsed.help) {
    deps.stdout(`${help}\n`);
    return 0;
  }
  if (parsed.positional.length > 0) {
    throw usageSurfaceError(
      `Unexpected argument: ${parsed.positional[0]}`,
      help
    );
  }

  const asJson = parsed.flags.has('--json');
  const document = readDocument(id);
  const report: SurfaceReport = {
    json: {
      document: id,
      file: SURFACE_DOCUMENTS[id].file,
      path: document.path,
      bytes: Buffer.byteLength(document.text, 'utf-8'),
      text: document.text,
    },
    // The document verbatim, with its trailing blank lines collapsed to the
    // single newline `writeLine` adds — a reader gets the file, not a report
    // about the file.
    lines: [document.text.replace(/\n+$/, '')],
  };
  return emitReport(deps, report, asJson);
}

import fs from 'fs';
import path from 'path';

/**
 * Locating and reading the packaged surfaces skill documents.
 *
 * This lives here rather than in `commands/` because that directory has a
 * contract — no `fs`, no `process.env`, no adapter-only globals, enforced by
 * `commands/command-contract.test.ts`. Commands decide and report; the
 * environment is somebody else's job. `surface-preview.ts` and
 * `surface-runtime.ts` are the same shape.
 */

export type SurfaceSkillDocumentRead =
  | { ok: true; path: string; text: string }
  | { ok: false; reason: 'missing' | 'empty'; path: string; root: string };

/**
 * Where the packaged skill lives — the same problem the template catalogue
 * has (`surface-runtime.ts`), solved the same way, deliberately.
 *
 * `bun build --compile` bakes `__dirname` into the binary as a string
 * literal — the build machine's path — and the binary ships in a platform
 * package that holds nothing but itself, while `skills/` ships in the root
 * wrapper. Nothing reachable from inside the binary points at the documents.
 * `bin/tlon.js` is uncompiled JS whose `__dirname` is real at runtime, so it
 * is the one place that knows, and it passes the answer in the environment
 * as `TLON_SURFACE_SKILL_DIR`.
 *
 * A SECOND variable rather than `dirname(TLON_SURFACE_TEMPLATES_DIR)`: that
 * one is an explicit override meaning "the catalogue is over there", and a
 * developer pointing it at a scratch directory of templates must not thereby
 * move the doctrine. `TLON_SKILL_DIR` is consulted next because it is the
 * variable Hermes and OpenClaw installs already set to the package root (see
 * `resolve_tlon_surfaces_skill_path` in the Hermes adapter), so a deployment
 * that never runs the wrapper still finds the documents.
 *
 * Read at call time rather than captured at import, so a test can point the
 * resolution somewhere else and exercise the real mechanism.
 */
export function surfaceSkillDir(): string {
  const override = process.env.TLON_SURFACE_SKILL_DIR?.trim();
  if (override) return path.resolve(override);
  const packageRoot = process.env.TLON_SKILL_DIR?.trim();
  if (packageRoot) {
    const candidate = path.resolve(packageRoot, 'skills', 'surfaces');
    if (fs.existsSync(candidate)) return candidate;
  }
  return localSkillDir();
}

/**
 * The no-environment fallback: correct from a checkout, best effort in the
 * binary.
 *
 * It searches upward rather than counting `..`, because `__dirname` does not
 * mean the same thing in the two modes. From source it is this module's own
 * directory; in the compiled binary bun collapses every module into one
 * bundle and it is the ENTRYPOINT's directory. A fixed depth is therefore
 * wrong in one mode or the other — measured, not assumed: a bare
 * `dist/tlon-run` with a two-`..` computation looked for
 * `packages/skills/surfaces`, one directory above the package.
 */
function localSkillDir(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = path.join(dir, 'skills', 'surfaces');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '..', 'skills', 'surfaces');
}

export function surfaceSkillDocumentPath(file: string): string {
  return path.join(surfaceSkillDir(), file);
}

/**
 * Reads one document, and distinguishes "not there" from "there and empty".
 *
 * An empty file is a failure alongside a missing one: a command that prints
 * nothing and exits 0 is indistinguishable, to a bot, from a document with
 * nothing to say — which is the silent degradation these commands exist to
 * end.
 */
export function readSurfaceSkillDocument(
  file: string
): SurfaceSkillDocumentRead {
  const root = surfaceSkillDir();
  const full = path.join(root, file);
  let text: string;
  try {
    text = fs.readFileSync(full, 'utf-8');
  } catch {
    return { ok: false, reason: 'missing', path: full, root };
  }
  if (text.trim().length === 0) {
    return { ok: false, reason: 'empty', path: full, root };
  }
  return { ok: true, path: full, text };
}

import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';

/** Ref meaning "read the working tree", so uncommitted work can be checked. */
export const WORKTREE_REF = 'worktree';

let cachedRoot: string | null = null;

function repoRoot(): string {
  cachedRoot ??= execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  return cachedRoot;
}

function git(args: string[]) {
  return spawnSync('git', args, {
    cwd: repoRoot(),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function refExists(ref: string): boolean {
  return (
    ref === WORKTREE_REF ||
    git(['cat-file', '-e', `${ref}^{commit}`]).status === 0
  );
}

/**
 * Make `ref` readable, fetching it if the checkout lacks it.
 *
 * CI checks out at depth 1 with no tags, so neither the N-1 desk tag nor a
 * historical client SHA is present. A targeted `--no-tags --depth=1` fetch
 * covers both; deepening the whole clone is not an acceptable substitute.
 */
export function ensureRef(ref: string): void {
  if (refExists(ref)) return;
  const attempts: string[][] = [];
  const fetch = (spec: string) => [
    'fetch',
    '--no-tags',
    '--depth=1',
    'origin',
    spec,
  ];
  if (/^v\d+\.\d+\.\d+$/.test(ref))
    attempts.push(fetch(`refs/tags/${ref}:refs/tags/${ref}`));
  else if (ref.startsWith('origin/')) {
    const branch = ref.slice('origin/'.length);
    attempts.push(fetch(`refs/heads/${branch}:refs/remotes/origin/${branch}`));
  }
  // A bare SHA cannot be written to a named local ref, but fetching it leaves
  // it reachable, which is all `git archive` needs.
  attempts.push(fetch(ref));
  for (const args of attempts) {
    if (git(args).status === 0 && refExists(ref)) return;
  }
  throw new Error(
    `ref '${ref}' is not present and could not be fetched. Tried: ` +
      attempts.map((a) => `git ${a.join(' ')}`).join('; ')
  );
}

export interface Tree {
  readonly ref: string;
  readFile(relPath: string): string | null;
  exists(relPath: string): boolean;
  /** Repo-relative paths of every file under `relDir`, recursively, sorted. */
  list(relDir: string, filter?: (p: string) => boolean): string[];
  dispose(): void;
}

class DirTree implements Tree {
  constructor(
    readonly ref: string,
    private readonly root: string,
    private readonly temporary: boolean
  ) {}

  readFile(relPath: string): string | null {
    const p = join(this.root, relPath);
    try {
      return statSync(p).isDirectory() ? null : readFileSync(p, 'utf8');
    } catch {
      return null;
    }
  }

  exists(relPath: string): boolean {
    return existsSync(join(this.root, relPath));
  }

  list(relDir: string, filter?: (p: string) => boolean): string[] {
    const out: string[] = [];
    const walk = (rel: string) => {
      let entries;
      try {
        entries = readdirSync(join(this.root, rel), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const child = posix.join(rel, e.name);
        if (e.isDirectory()) walk(child);
        else if (!filter || filter(child)) out.push(child);
      }
    };
    walk(relDir);
    return out.sort();
  }

  dispose() {
    if (this.temporary) rmSync(this.root, { recursive: true, force: true });
  }
}

/**
 * Materialise `paths` at `ref` into a temp directory, or hand back the working
 * tree. `git archive` rather than a checkout, so a run never touches the
 * caller's index or working tree.
 */
export function openTree(ref: string, paths: string[]): Tree {
  if (ref === WORKTREE_REF) return new DirTree(ref, repoRoot(), false);
  ensureRef(ref);
  // Paths absent at this ref make `git archive` fail outright, so probe first.
  const present = paths.filter(
    (p) => git(['cat-file', '-e', `${ref}:${p}`]).status === 0
  );
  if (present.length === 0) {
    throw new Error(`none of [${paths.join(', ')}] exist at ref '${ref}'`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'desk-compat-'));
  const fail = (what: string, err?: Buffer) => {
    rmSync(dir, { recursive: true, force: true });
    return new Error(
      `${what} at ${ref} failed: ${err?.toString() ?? 'unknown error'}`
    );
  };
  const archive = spawnSync(
    'git',
    ['archive', '--format=tar', ref, '--', ...present],
    {
      cwd: repoRoot(),
      maxBuffer: 512 * 1024 * 1024,
    }
  );
  if (archive.status !== 0) throw fail('git archive', archive.stderr);
  const extract = spawnSync('tar', ['-x', '-C', dir], {
    input: archive.stdout,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (extract.status !== 0) throw fail('tar extract', extract.stderr);
  return new DirTree(ref, dir, true);
}

/** In-memory tree, so tests can exercise rules against hand-written agents. */
export function memoryTree(files: Record<string, string>): Tree {
  const has = (p: string) => Object.prototype.hasOwnProperty.call(files, p);
  return {
    ref: 'memory',
    readFile: (p) => (has(p) ? files[p] : null),
    exists: has,
    list: (dir, filter) =>
      Object.keys(files)
        .filter((f) => f.startsWith(`${dir}/`) && (!filter || filter(f)))
        .sort(),
    dispose: () => {},
  };
}

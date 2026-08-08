/**
 * Load kits from disk: a single kit directory (kit.json + instructions/
 * scaffolds/card files) or every kit bundled with this package under kits/.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type KitManifest, kitManifestSchema } from './manifest.js';

export type ResolveModuleFn = (id: string) => string;

export type LoadedKit = {
  /** Absolute path of the kit directory. */
  dir: string;
  manifest: KitManifest;
  /** Package-relative posix path -> file content string. */
  files: Record<string, string>;
};

/** Directories whose contents travel with the kit package. */
const KIT_FILE_DIRS = ['instructions', 'scaffolds', 'card'] as const;

function walkFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      found.push(entryPath);
    }
  }
  return found.sort();
}

function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

/**
 * Read and validate a kit directory. Throws on missing/invalid kit.json and
 * on bindings or scaffolds that reference files not present in the package.
 */
export function loadKit(kitDir: string): LoadedKit {
  const dir = resolve(kitDir);
  const kitJsonPath = join(dir, 'kit.json');
  if (!existsSync(kitJsonPath)) {
    throw new Error(`No kit.json found in ${dir}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(kitJsonPath, 'utf-8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${kitJsonPath}: ${message}`);
  }

  const manifest = kitManifestSchema.parse(raw);

  const files: Record<string, string> = {};
  for (const subdir of KIT_FILE_DIRS) {
    const filesDir = join(dir, subdir);
    if (!existsSync(filesDir)) {
      continue;
    }
    for (const filePath of walkFiles(filesDir)) {
      files[toPosixPath(relative(dir, filePath))] = readFileSync(
        filePath,
        'utf-8'
      );
    }
  }

  for (const binding of manifest.bindings) {
    if (!(binding.file in files)) {
      throw new Error(
        `Kit ${manifest.id}: binding references missing file ${binding.file}`
      );
    }
  }
  for (const scaffold of manifest.scaffolds) {
    if (!(scaffold.file in files)) {
      throw new Error(
        `Kit ${manifest.id}: scaffold references missing file ${scaffold.file}`
      );
    }
  }

  return { dir, manifest, files };
}

function defaultResolveModule(): ResolveModuleFn | null {
  try {
    return createRequire(import.meta.url).resolve;
  } catch {
    return null;
  }
}

function moduleDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export type ResolveKitsDirOptions = {
  resolveModule?: ResolveModuleFn;
  exists?: (path: string) => boolean;
};

/**
 * Locate this package's bundled kits/ directory. Mirrors the candidate-list
 * resolution pattern of packages/openclaw/src/tlon-binary.ts so consumers
 * (source imports, built dist, bundlers) all resolve correctly.
 */
export function resolvePackagedKitsDir(
  options: ResolveKitsDirOptions = {}
): string {
  const exists = options.exists ?? existsSync;
  const resolveModule = options.resolveModule ?? defaultResolveModule();

  const candidates: (string | null)[] = [];

  if (resolveModule) {
    try {
      const packageJsonPath = resolveModule('@tloncorp/tlon-kits/package.json');
      candidates.push(join(dirname(packageJsonPath), 'kits'));
    } catch {
      // Fall through to module-relative candidates.
    }
  }

  // Relative to this module: src/ or dist/ sit one level below the package
  // root, next to kits/.
  try {
    candidates.push(join(moduleDir(), '..', 'kits'));
  } catch {
    // import.meta.url may be unavailable in exotic bundling contexts.
  }

  for (const candidate of candidates) {
    if (candidate && exists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Could not locate the @tloncorp/tlon-kits kits/ directory. ' +
      'Pass an explicit directory to loadKit instead.'
  );
}

/** Load every kit bundled with this package, sorted by kit id. */
export function loadAllKits(options: ResolveKitsDirOptions = {}): LoadedKit[] {
  const kitsDir = resolvePackagedKitsDir(options);
  const kits: LoadedKit[] = [];
  for (const entry of readdirSync(kitsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const kitDir = join(kitsDir, entry.name);
    if (!existsSync(join(kitDir, 'kit.json'))) {
      continue;
    }
    kits.push(loadKit(kitDir));
  }
  return kits.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}

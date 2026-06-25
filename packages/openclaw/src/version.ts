import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sharedSlot } from './shared-state.js';
import { PLUGIN_COMMIT, PLUGIN_VERSION } from './version.generated.js';

const HARNESS = 'openclaw' as const;
const FINGERPRINT_RULE = 'fp1';
const FINGERPRINT_HEX_CHARS = 12;
const moduleDir = dirname(fileURLToPath(import.meta.url));

export type TlonVersionIdentity = {
  harness: typeof HARNESS;
  pluginVersion: string;
  pluginCommit: string;
  pluginFingerprint: string;
  adapterVersion: string;
  adapterFingerprint: string;
};

type TlonSkillVersionResolver = () => Promise<string>;

const tlonSkillVersionResolverSlot = sharedSlot<TlonSkillVersionResolver>(
  'version.tlonSkillVersionResolver'
);
const tlonSkillVersionSlot = sharedSlot<string>('version.tlonSkillVersion');

function findPackageRoot(startDir = moduleDir): string {
  let dir = startDir;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return startDir;
}

function walkFiles(
  dir: string,
  predicate: (path: string) => boolean
): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function sourceRuntimeFiles(packageRoot: string): string[] {
  const roots = ['index.ts', 'setup-entry.ts', 'setup-api.ts']
    .map((name) => join(packageRoot, name))
    .filter(existsSync);
  const srcFiles = walkFiles(
    join(packageRoot, 'src'),
    (path) =>
      path.endsWith('.ts') &&
      !path.endsWith('.test.ts') &&
      basename(path) !== 'version.generated.ts'
  );
  return [...roots, ...srcFiles].sort();
}

function distRuntimeFiles(packageRoot: string): string[] {
  return walkFiles(
    join(packageRoot, 'dist'),
    (path) => path.endsWith('.js') && basename(path) !== 'version.generated.js'
  ).sort();
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function runtimeFiles(
  packageRoot: string,
  currentModuleDir = moduleDir
): string[] {
  const distFiles = distRuntimeFiles(packageRoot);
  if (
    distFiles.length > 0 &&
    isWithin(join(packageRoot, 'dist'), currentModuleDir)
  ) {
    return distFiles;
  }

  const sourceFiles = sourceRuntimeFiles(packageRoot);
  return sourceFiles.length > 0 ? sourceFiles : distFiles;
}

function contentFingerprint(packageRoot = findPackageRoot()): string {
  const digest = createHash('sha256');
  const files = runtimeFiles(packageRoot);

  for (const file of files) {
    digest.update(relative(packageRoot, file).replaceAll('\\', '/'));
    digest.update('\0');
    try {
      digest.update(readFileSync(file));
    } catch {
      digest.update('<unreadable>');
    }
    digest.update('\0');
  }

  return `${FINGERPRINT_RULE}:${digest.digest('hex').slice(0, FINGERPRINT_HEX_CHARS)}`;
}

const pluginFingerprint = contentFingerprint();

const VERSION_IDENTITY: TlonVersionIdentity = {
  harness: HARNESS,
  pluginVersion: PLUGIN_VERSION || 'unknown',
  pluginCommit: PLUGIN_COMMIT || 'unknown',
  pluginFingerprint,
  // Hermes uses adapter* names. Keep the same fields on OpenClaw events so
  // shared PostHog charts can group both harnesses without special casing.
  adapterVersion: PLUGIN_VERSION || 'unknown',
  adapterFingerprint: pluginFingerprint,
};

export function getTlonVersionIdentity(): TlonVersionIdentity {
  return VERSION_IDENTITY;
}

export function setTlonSkillVersionResolver(
  resolver: TlonSkillVersionResolver | null
): void {
  tlonSkillVersionResolverSlot.set(resolver);
  tlonSkillVersionSlot.set(null);
}

export function getKnownTlonSkillVersion(): string {
  return tlonSkillVersionSlot.get() ?? 'unknown';
}

export async function resolveTlonSkillVersion(): Promise<string> {
  const cached = tlonSkillVersionSlot.get();
  if (cached) {
    return cached;
  }

  const resolver = tlonSkillVersionResolverSlot.get();
  if (!resolver) {
    return 'unknown';
  }

  const version = await resolver();
  tlonSkillVersionSlot.set(version || 'unknown');
  return tlonSkillVersionSlot.get() ?? 'unknown';
}

export function formatTlonVersionIdentity(options?: {
  markdown?: boolean;
  tlonSkillVersion?: string | null;
}): string {
  const markdown = options?.markdown ?? true;
  const identity = getTlonVersionIdentity();
  const tlonSkillVersion =
    options?.tlonSkillVersion?.trim() || getKnownTlonSkillVersion();
  const source =
    identity.pluginCommit === 'unknown'
      ? 'no git checkout'
      : identity.pluginCommit;
  const row = (label: string, value: string) =>
    markdown ? `*${label}*: **${value}**` : `${label}: ${value}`;

  return [
    row('Harness', 'OpenClaw'),
    row('Adapter Version', identity.pluginVersion),
    row('Tlon Skill', tlonSkillVersion),
    row('Fingerprint', identity.pluginFingerprint),
    row('Source', source),
  ].join('\n');
}

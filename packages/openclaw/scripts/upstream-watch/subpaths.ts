import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type SubpathClass =
  | 'present-both'
  | 'removed-in-next'
  | 'added-in-next'
  | 'absent-in-both';

export interface Subpath {
  // `plugin-sdk/core`, or `.` for a bare `openclaw` import
  subpath: string;
  class: SubpathClass;
  // upstream source file behind the export, for the scoped diff
  source?: string;
}

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(openclaw(?:\/[^'"]*)?)\1/g;

// Mirrors how tsc reads the plugin's tsconfig: the `include` set minus
// `exclude`, so a subpath only a test imports does not count.
export function scanPluginImports(pluginDir: string) {
  const tsconfig = JSON.parse(
    readFileSync(path.join(pluginDir, 'tsconfig.json'), 'utf8')
  ) as { include?: string[]; exclude?: string[] };
  const exclude = (tsconfig.exclude ?? []).flatMap((entry) =>
    entry.includes('*') ? [entry] : [entry, `${entry}/**`]
  );
  const files = globSync(tsconfig.include ?? [], {
    cwd: pluginDir,
    exclude,
  }).sort();

  const subpaths = new Set<string>();
  for (const file of files) {
    const source = readFileSync(path.join(pluginDir, file), 'utf8');
    for (const match of source.matchAll(SPECIFIER)) {
      subpaths.add(
        match[2] === 'openclaw' ? '.' : match[2].slice('openclaw/'.length)
      );
    }
  }
  return { files, subpaths: [...subpaths].sort() };
}

type ExportsMap = Record<string, unknown>;

export function hasExport(exportsMap: ExportsMap | undefined, subpath: string) {
  return exportTarget(exportsMap, subpath) !== undefined;
}

export function exportTarget(
  exportsMap: ExportsMap | undefined,
  subpath: string
): string | undefined {
  if (!exportsMap) {
    return undefined;
  }
  const key = subpath === '.' ? '.' : `./${subpath}`;
  if (key in exportsMap) {
    return targetPath(exportsMap[key]);
  }
  for (const [pattern, value] of Object.entries(exportsMap)) {
    const star = pattern.indexOf('*');
    if (star === -1) {
      continue;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (
      key.length >= prefix.length + suffix.length &&
      key.startsWith(prefix) &&
      key.endsWith(suffix)
    ) {
      const target = targetPath(value);
      const middle = key.slice(prefix.length, key.length - suffix.length);
      return target?.replace('*', middle);
    }
  }
  return undefined;
}

function targetPath(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const conditions = value as Record<string, unknown>;
    for (const condition of ['import', 'default', 'node', 'require']) {
      const target = targetPath(conditions[condition]);
      if (target) {
        return target;
      }
    }
  }
  return undefined;
}

// `./dist/plugin-sdk/core.js` is built from `src/plugin-sdk/core.ts`.
export function sourceCandidate(target: string) {
  const match = /^\.\/dist\/(.+)\.(?:m?js|d\.ts)$/.exec(target);
  return match ? `src/${match[1]}.ts` : undefined;
}

export function classifySubpaths(
  subpaths: string[],
  prevExports: ExportsMap | undefined,
  nextExports: ExportsMap | undefined
) {
  return subpaths.map((subpath): Subpath => {
    const inPrev = hasExport(prevExports, subpath);
    const inNext = hasExport(nextExports, subpath);
    const cls: SubpathClass =
      inPrev && inNext
        ? 'present-both'
        : inPrev
          ? 'removed-in-next'
          : inNext
            ? 'added-in-next'
            : 'absent-in-both';
    const target =
      exportTarget(nextExports, subpath) ?? exportTarget(prevExports, subpath);
    const source = target ? sourceCandidate(target) : undefined;
    return source ? { subpath, class: cls, source } : { subpath, class: cls };
  });
}

// Upstream writes deprecations as "`openclaw/plugin-sdk/x`: use `y`", so the
// subject is the text before the first colon. Matching the whole bullet would
// also hit the replacement it recommends.
export function subjectOf(text: string) {
  const colon = text.indexOf(':');
  return colon === -1 ? text : text.slice(0, colon);
}

export function namedSubpaths(text: string, subpaths: string[]) {
  return subpaths.filter((subpath) => {
    if (subpath === '.') {
      return false;
    }
    const escaped = subpath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\w/-])(?:openclaw/)?${escaped}(?![\\w/-])`).test(
      text
    );
  });
}

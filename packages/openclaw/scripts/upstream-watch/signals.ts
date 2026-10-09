import type { Subpath } from './subpaths.ts';

export interface Signal {
  fired: boolean;
  evidence: string[];
}

export interface EngineSignal extends Signal {
  prev?: string;
  next?: string;
  // whether the canary's Node version satisfies `next`; undefined when the
  // range uses syntax satisfiesRange does not read
  canarySatisfies?: boolean;
}

export interface SchemaSignal extends Signal {
  prev?: number;
  next?: number;
}

export interface Signals {
  sdkSubpathRemoved: Signal;
  engineChanged: EngineSignal;
  stateSchemaBumped: SchemaSignal;
}

export interface Hints {
  configKeyInZodDiff: Signal;
}

export function subpathSignal(
  subpaths: Subpath[],
  prev: string,
  next: string
): Signal {
  const removed = subpaths.filter((s) => s.class === 'removed-in-next');
  return {
    fired: removed.length > 0,
    evidence: removed.map(
      (s) => `openclaw/${s.subpath} is exported at ${prev} but not at ${next}`
    ),
  };
}

export function engineSignal(
  prevRange: string | undefined,
  nextRange: string | undefined,
  canaryNode: string
): EngineSignal {
  const fired = prevRange !== nextRange;
  const signal: EngineSignal = {
    fired,
    evidence: fired
      ? [`engines.node ${prevRange ?? '(unset)'} → ${nextRange ?? '(unset)'}`]
      : [],
    prev: prevRange,
    next: nextRange,
  };
  if (nextRange !== undefined) {
    signal.canarySatisfies = satisfiesRange(canaryNode, nextRange);
  }
  return signal;
}

export function schemaSignal(
  prevVersion: number | undefined,
  nextVersion: number | undefined
): SchemaSignal {
  // Unreadable on either side is not a bump; digest records it as incomplete.
  const fired =
    prevVersion !== undefined &&
    nextVersion !== undefined &&
    prevVersion !== nextVersion;
  return {
    fired,
    evidence: fired
      ? [
          `OPENCLAW_STATE_SCHEMA_VERSION ${prevVersion} → ${nextVersion} (one-way migration; rollback needs a state backup)`,
        ]
      : [],
    prev: prevVersion,
    next: nextVersion,
  };
}

export function readSchemaVersion(source: string) {
  const match = /OPENCLAW_STATE_SCHEMA_VERSION\s*=\s*(\d+)/.exec(source);
  return match ? Number(match[1]) : undefined;
}

// A removed line in a zod schema file that defines one of our config keys.
// Only the last segment of a dotted key appears in a schema line, as an
// object key.
export function zodHint(diff: string, configKeys: string[]): Signal {
  const evidence: string[] = [];
  for (const file of splitDiff(diff)) {
    if (!/zod-schema/.test(file.path)) {
      continue;
    }
    for (const line of file.lines) {
      if (!line.startsWith('-') || line.startsWith('---')) {
        continue;
      }
      for (const key of configKeys) {
        const leaf = key.split('.').at(-1) ?? key;
        const pattern = new RegExp(`(?<![\\w.])["']?${leaf}["']?\\??\\s*:`);
        if (pattern.test(line)) {
          evidence.push(
            `${key}: ${file.path}: ${line.slice(1).trim().slice(0, 120)}`
          );
        }
      }
    }
  }
  return { fired: evidence.length > 0, evidence };
}

export interface DiffFile {
  path: string;
  lines: string[];
}

export function splitDiff(diff: string) {
  const files: DiffFile[] = [];
  for (const line of diff.split('\n')) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      files.push({ path: header[2], lines: [line] });
    } else if (files.length > 0) {
      files[files.length - 1].lines.push(line);
    }
  }
  for (const file of files) {
    while (file.lines.length > 1 && file.lines.at(-1) === '') {
      file.lines.pop();
    }
  }
  return files;
}

export function truncateDiff(
  diff: string,
  { perFile = 100, total = 1500 }: { perFile?: number; total?: number } = {}
) {
  const out: string[] = [];
  let skippedFiles = 0;
  let skippedLines = 0;
  for (const file of splitDiff(diff)) {
    // one line for this file's marker, one for the closing summary
    const room = total - out.length - 2;
    if (room < 2) {
      skippedFiles++;
      skippedLines += file.lines.length;
      continue;
    }
    const keep = Math.min(perFile, room, file.lines.length);
    out.push(...file.lines.slice(0, keep));
    if (keep < file.lines.length) {
      out.push(`… ${file.lines.length - keep} lines omitted`);
    }
  }
  if (skippedFiles > 0) {
    out.push(
      `… ${skippedFiles} more files (${skippedLines} lines) omitted; see upstream-diff-files.txt`
    );
  }
  return out.join('\n') + (out.length ? '\n' : '');
}

// Enough of node-semver for `engines.node`: `||` alternatives of
// space-separated comparators (>=, >, <=, <, =, ^, ~, x-ranges).
export function satisfiesRange(version: string, range: string) {
  const v = semverParts(version);
  if (!v) {
    return undefined;
  }
  let understood = true;
  const ok = range.split('||').some((alternative) => {
    const comparators = alternative.trim().split(/\s+/).filter(Boolean);
    return comparators.every((comparator) => {
      const result = testComparator(v, comparator);
      if (result === undefined) {
        understood = false;
      }
      return result === true;
    });
  });
  return understood || ok ? ok : undefined;
}

function semverParts(version: string) {
  const match = /^v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/.exec(version);
  if (!match) {
    return undefined;
  }
  return [match[1], match[2], match[3]].map((p) =>
    p === undefined || p === 'x' || p === '*' ? undefined : Number(p)
  );
}

function compare(a: (number | undefined)[], b: number[]) {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - b[i];
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}

function testComparator(v: (number | undefined)[], comparator: string) {
  const match = /^(>=|<=|>|<|=|\^|~)?(.+)$/.exec(comparator);
  const bound = match ? semverParts(match[2]) : undefined;
  if (!match || !bound) {
    return undefined;
  }
  const version = v.map((p) => p ?? 0);
  const low = bound.map((p) => p ?? 0);
  const op = match[1] ?? '=';
  switch (op) {
    case '>=':
      return compare(version, low) >= 0;
    case '>':
      return compare(version, low) > 0;
    case '<=':
      return compare(version, low) <= 0;
    case '<':
      return compare(version, low) < 0;
    case '^':
      return compare(version, low) >= 0 && version[0] === low[0];
    case '~':
      return (
        compare(version, low) >= 0 &&
        version[0] === low[0] &&
        (bound[1] === undefined || version[1] === low[1])
      );
    default:
      return bound.every((p, i) => p === undefined || p === version[i]);
  }
}

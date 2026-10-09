import { OUR_AREAS } from './jev.ts';
import { namedSubpaths, subjectOf } from './subpaths.ts';

// One labeled.jsonl row. The probe fixtures (r2-*.jsonl) have the same shape
// minus `release`, `prs`, `labeled` and `addresses`.
export interface LabeledRow {
  release?: string;
  section: string;
  bullet: string;
  prs?: number[];
  labeled?: boolean;
  reason?: string;
  area?: string;
  area_probs?: Record<string, number>;
  kind?: string;
  kind_p?: number;
  kind_probs?: Record<string, number>;
  affects?: number;
  addresses?: Record<string, number>;
  addresses_error?: string;
  ms?: number;
}

// Thresholds read `probabilities`, never `confidence`.
export const THRESHOLD = 0.7;
export const WORKAROUND_THRESHOLD = 0.8;

export interface Classified {
  row: LabeledRow;
  ours: number;
  // imported subpaths named in a deprecation's subject
  names?: string[];
  // a changes-for-us item that got there on the breaking label
  breaking?: boolean;
}

export interface MayFix {
  row: LabeledRow;
  workaround: string;
  p: number;
}

export interface Sections {
  deprecations: Classified[];
  check: Classified[];
  changes: Classified[];
  relevant: Classified[];
  dropped: Classified[];
  mayFix: MayFix[];
  labeled: number;
  total: number;
}

export function isLabeled(row: LabeledRow) {
  return row.labeled !== false && !!row.area_probs && !!row.kind_probs;
}

// Summed so a 0.45 plugin_sdk + 0.40 config split still counts as ours.
export function oursOf(row: LabeledRow) {
  return OUR_AREAS.reduce(
    (sum, area) => sum + (row.area_probs?.[area] ?? 0),
    0
  );
}

export function classifyRows(rows: LabeledRow[], subpaths: string[]): Sections {
  const sections: Sections = {
    deprecations: [],
    check: [],
    changes: [],
    relevant: [],
    dropped: [],
    mayFix: [],
    labeled: 0,
    total: rows.length,
  };

  for (const row of rows) {
    if (!isLabeled(row)) {
      sections.dropped.push({ row, ours: 0 });
      continue;
    }
    sections.labeled++;
    const ours = oursOf(row);
    const kind = (k: string) => row.kind_probs?.[k] ?? 0;
    const deprecation = kind('deprecation_notice') >= THRESHOLD;
    const names = deprecation
      ? namedSubpaths(subjectOf(row.bullet), subpaths)
      : [];

    if (deprecation && names.length > 0) {
      sections.deprecations.push({ row, ours, names });
    } else if (deprecation && ours >= THRESHOLD) {
      sections.check.push({ row, ours });
    } else if (
      ours >= THRESHOLD &&
      kind('behavior_default_change') >= THRESHOLD
    ) {
      sections.changes.push({ row, ours });
    } else if (ours >= THRESHOLD && kind('breaking') >= THRESHOLD) {
      // A label alone never reaches breaks-us, which takes hard signals only.
      sections.changes.push({ row, ours, breaking: true });
    } else if (
      ours >= THRESHOLD &&
      // Jev splits some bullets 0.5 fix / 0.4 internal; a single-kind rule
      // dropped them.
      kind('fix') + kind('new_capability') + kind('internal_or_docs') >=
        THRESHOLD
    ) {
      sections.relevant.push({ row, ours });
    } else {
      sections.dropped.push({ row, ours });
    }

    for (const [workaround, p] of Object.entries(row.addresses ?? {})) {
      if (p >= WORKAROUND_THRESHOLD) {
        sections.mayFix.push({ row, workaround, p });
      }
    }
  }

  sections.mayFix.sort((a, b) => b.p - a.p);
  return sections;
}

export function relevantKind(row: LabeledRow) {
  const p = row.kind_probs ?? {};
  const kinds = ['fix', 'new_capability', 'internal_or_docs'] as const;
  return kinds.reduce((best, kind) =>
    (p[kind] ?? 0) > (p[best] ?? 0) ? kind : best
  );
}

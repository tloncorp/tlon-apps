import { Dependency, Surface } from './extract';

/**
 * Inventory diff: what a branch adds to, changes in, or drops from the set of
 * requests the client makes of the desk.
 *
 * Advisory by construction. It says what changed; whether the N-1 desk serves
 * it is a judgement a reader makes against that desk's arms, and nothing here
 * reads a desk.
 */

/** `file:line` for a call site. */
const at = (d: Dependency) => `${d.site.file}:${d.site.line}`;

/** The agent a request is addressed to. */
const agentOf = (d: Dependency) => (d.app ? `%${d.app}` : '(no agent)');

/** What the request asks for, in the shape the surface makes readable. */
export const target = (d: Dependency) =>
  d.surface === 'thread'
    ? `${d.thread ?? '?'} <- ${d.mark ?? '?'}`
    : (d.mark ?? d.path?.shape ?? d.path?.text ?? '?');

/** One request, with every call site that makes it. */
export interface Request {
  key: string;
  dep: Dependency;
  sites: string[];
}

/** A request whose call site survived while its app, path or mark did not. */
export interface ChangedRequest {
  before: Request;
  after: Request;
}

export interface InventoryDiff {
  added: Request[];
  changed: ChangedRequest[];
  removed: Request[];
}

export interface Refs {
  base: string;
  head: string;
}

/**
 * One row per request, keyed by the identity the extractor already assigns
 * (`Dependency.key`: surface + app + path/mark). Sorted by that key, so two
 * inventories read in the same order.
 */
export function collate(deps: Dependency[]): Request[] {
  const byKey = new Map<string, Request>();
  for (const dep of deps) {
    const row = byKey.get(dep.key);
    if (row) {
      if (!row.sites.includes(at(dep))) row.sites.push(at(dep));
    } else {
      byKey.set(dep.key, { key: dep.key, dep, sites: [at(dep)] });
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Compare two inventories.
 *
 * Membership is by `Dependency.key`, so a request is "the same request" exactly
 * when the extractor says it is. A dropped key and a new key that share a call
 * site (`file:line`) on the same surface are then reported as one change rather
 * than an unrelated pair — the usual shape of editing a path or bumping a mark
 * in place. A call site that also moved lines shows up as an add beside a
 * remove, which is the same information, less tidily.
 */
export function diffInventories(
  baseDeps: Dependency[],
  headDeps: Dependency[]
): InventoryDiff {
  const base = collate(baseDeps);
  const head = collate(headDeps);
  const baseKeys = new Set(base.map((r) => r.key));
  const headKeys = new Set(head.map((r) => r.key));
  const appeared = head.filter((r) => !baseKeys.has(r.key));
  const vanished = base.filter((r) => !headKeys.has(r.key));

  const changed: ChangedRequest[] = [];
  const paired = new Set<Request>();
  for (const before of vanished) {
    const sites = new Set(before.sites);
    const after = appeared.find(
      (a) =>
        !paired.has(a) &&
        a.dep.surface === before.dep.surface &&
        a.sites.some((s) => sites.has(s))
    );
    if (!after) continue;
    paired.add(before);
    paired.add(after);
    changed.push({ before, after });
  }
  return {
    added: appeared.filter((r) => !paired.has(r)),
    changed,
    removed: vanished.filter((r) => !paired.has(r)),
  };
}

const summarize = (d: InventoryDiff) =>
  `${d.added.length} added, ${d.changed.length} changed, ${d.removed.length} removed`;

const isEmpty = (d: InventoryDiff) =>
  d.added.length + d.changed.length + d.removed.length === 0;

/** Surfaces in report order; anything unlisted sorts after them, by name. */
const SURFACE_ORDER: Surface[] = [
  'scry',
  'subscribe',
  'poke',
  'thread',
  'http',
];

/** Group entries by surface, then by agent, both in a stable order. */
function grouped<T>(
  items: T[],
  pick: (item: T) => Dependency
): { heading: string; items: T[] }[] {
  const groups = new Map<string, { dep: Dependency; items: T[] }>();
  for (const item of items) {
    const dep = pick(item);
    const id = `${dep.surface} ${agentOf(dep)}`;
    const group = groups.get(id);
    if (group) group.items.push(item);
    else groups.set(id, { dep, items: [item] });
  }
  const rank = (s: Surface) => {
    const i = SURFACE_ORDER.indexOf(s);
    return i === -1 ? SURFACE_ORDER.length : i;
  };
  return [...groups.entries()]
    .sort(([aId, a], [bId, b]) => {
      const bySurface = rank(a.dep.surface) - rank(b.dep.surface);
      return bySurface !== 0 ? bySurface : aId.localeCompare(bId);
    })
    .map(([id, group]) => ({ heading: id, items: group.items }));
}

const SECTIONS = ['added', 'changed', 'removed'] as const;

/**
 * A request made from everywhere names a few of its call sites and says how
 * many more there are. A PR comment is read, not scrolled.
 */
const MAX_SITES = 6;

interface Entry {
  label: string;
  /**
   * An entry the extractor could not resolve is still a request the branch
   * makes, and it is the one a reviewer most needs to look at — so it is never
   * silently indistinguishable from a resolved one.
   */
  unresolved?: string;
  sites: string[];
  /** Call sites beyond `MAX_SITES`, left unlisted. */
  more: number;
}

const entryOf = (label: string, dep: Dependency, sites: string[]): Entry => ({
  label,
  unresolved: dep.unresolved,
  sites: sites.slice(0, MAX_SITES),
  more: Math.max(sites.length - MAX_SITES, 0),
});

function entries(
  diff: InventoryDiff,
  section: (typeof SECTIONS)[number]
): { heading: string; items: Entry[] }[] {
  if (section === 'changed') {
    return grouped(diff.changed, (c) => c.after.dep).map((g) => ({
      heading: g.heading,
      items: g.items.map((c) =>
        entryOf(
          `${target(c.before.dep)} -> ${target(c.after.dep)}`,
          c.after.dep,
          c.after.sites
        )
      ),
    }));
  }
  return grouped(diff[section], (r) => r.dep).map((g) => ({
    heading: g.heading,
    items: g.items.map((r) => entryOf(target(r.dep), r.dep, r.sites)),
  }));
}

const HEADER = 'Desk requests';

const GUIDANCE =
  'For every request listed here, check that the N-1 desk serves it: ' +
  'the agent has an arm for that path or mark, version injection is ' +
  'accounted for, and any `agent:neg` protocol version matches. ' +
  'See the desk-compatibility section of `AGENTS.md`. Advisory only — ' +
  'this never fails CI.';

/** Plain text, for a terminal. */
export function renderText(diff: InventoryDiff, refs: Refs): string {
  const summary = summarize(diff);
  // Nothing changed is the whole report: sections of "(none)" would only bury
  // the one fact a reader wants.
  if (isEmpty(diff)) return summary;
  const out = [`${HEADER}: ${refs.base} -> ${refs.head}`, '', summary, ''];
  for (const section of SECTIONS) {
    const groups = entries(diff, section);
    if (groups.length === 0) continue;
    out.push(section);
    for (const group of groups) {
      out.push(`  ${group.heading}`);
      for (const e of group.items) {
        out.push(`    ${e.label}`);
        if (e.unresolved) out.push(`      unresolved: ${e.unresolved}`);
        for (const site of e.sites) out.push(`      ${site}`);
        if (e.more) out.push(`      +${e.more} more`);
      }
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}

/**
 * A report that could not be computed says so in place of the list. The
 * comment this lands in is sticky, so the alternative is last push's diff
 * standing as though it were this one's.
 */
export function renderFailure(
  reason: string,
  refs: Refs,
  markdown: boolean
): string {
  const why = `could not diff ${refs.base} against ${refs.head}: ${reason}`;
  return markdown ? `## ${HEADER}\n\n${why}` : `${HEADER}: ${why}`;
}

/** Markdown, for the sticky PR comment. */
export function renderMarkdown(diff: InventoryDiff, refs: Refs): string {
  const summary = summarize(diff);
  const out = [
    `## ${HEADER}`,
    '',
    `\`${refs.base}\` → \`${refs.head}\``,
    '',
    `**${summary}**`,
    '',
  ];
  if (isEmpty(diff)) {
    out.push('Nothing added, changed or removed — no desk request to review.');
    return out.join('\n');
  }
  out.push(GUIDANCE, '');
  for (const section of SECTIONS) {
    const groups = entries(diff, section);
    if (groups.length === 0) continue;
    out.push(`### ${section[0].toUpperCase()}${section.slice(1)}`, '');
    for (const group of groups) {
      out.push(`**${group.heading}**`, '');
      for (const e of group.items) {
        const where = e.sites.map((s) => `\`${s}\``).join(', ');
        out.push(
          `- \`${e.label}\` — ${where}${e.more ? ` _+${e.more} more_` : ''}` +
            (e.unresolved ? ` _(unresolved: ${e.unresolved})_` : '')
        );
      }
      out.push('');
    }
  }
  return out.join('\n').trimEnd();
}

import { Dependency, Surface } from './extract';

/**
 * Inventory diff: what a branch adds to, changes in, or drops from the set of
 * requests the client makes of the desk.
 *
 * Advisory by construction. It says what changed; whether the N-1 desk serves
 * it is a judgement a reader makes against that desk's arms, and nothing here
 * reads a desk.
 */

/** One call site of a request, with the guard that has to hold to reach it. */
export interface SiteRecord {
  file: string;
  line: number;
  guard?: string;
}

/** `file:line` for a call site. */
const at = (s: SiteRecord) => `${s.file}:${s.line}`;

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
  records: SiteRecord[];
}

/** `file:line` per call site, deduped, in the order they were found. */
export const sitesOf = (r: Request): string[] => [
  ...new Set(r.records.map(at)),
];

/** A guard that appeared, disappeared, or was rewritten at one call site. */
export interface GuardChange {
  site: string;
  before?: string;
  after?: string;
}

/** What moved when a request's identity stayed the same. */
export interface SiteMove {
  added: string[];
  removed: string[];
  guards: GuardChange[];
}

export interface ChangedRequest {
  before: Request;
  after: Request;
  /**
   * Set when the key itself is unchanged and only the call sites moved. Absent
   * for a key change, where the `old -> new` label already says what moved.
   */
  moved?: SiteMove;
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
 *
 * Call sites are deduped on `file:line` *and* guard: one site can produce two
 * records for the same key under opposite guards, and collapsing them would
 * hide a guard being removed from one of them.
 */
export function collate(deps: Dependency[]): Request[] {
  const byKey = new Map<string, { req: Request; seen: Set<string> }>();
  for (const dep of deps) {
    const record: SiteRecord = { ...dep.site, guard: dep.guard };
    const id = `${at(record)}|${dep.guard ?? ''}`;
    const row = byKey.get(dep.key);
    if (!row) {
      byKey.set(dep.key, {
        req: { key: dep.key, dep, records: [record] },
        seen: new Set([id]),
      });
    } else if (!row.seen.has(id)) {
      row.seen.add(id);
      row.req.records.push(record);
    }
  }
  return [...byKey.values()]
    .map((r) => r.req)
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * How a base call site is matched to a head one, most specific first. The first
 * two mean "the same site"; the last two mean "the same site, guarded
 * differently". Dropping the line before dropping the guard is what makes a
 * pure line shift invisible while a guard edit in place is still reported.
 */
const MATCHERS: ((s: SiteRecord) => string)[] = [
  (s) => `${s.file}|${s.line}|${s.guard ?? ''}`,
  (s) => `${s.file}|${s.guard ?? ''}`,
  (s) => `${s.file}|${s.line}`,
  (s) => s.file,
];

/**
 * Compare the call sites of one request against itself at another ref.
 *
 * `null` when nothing moved — including when every site only shifted lines,
 * which is the common case and never worth a reviewer's attention. When
 * several sites in a file share a guard, which of them is named as the added
 * or removed one is arbitrary among that set; the count is still right.
 */
function moveOf(before: SiteRecord[], after: SiteRecord[]): SiteMove | null {
  let unmatchedBefore = [...before];
  let unmatchedAfter = [...after];
  const guards: GuardChange[] = [];
  for (const keyOf of MATCHERS) {
    const pool = new Map<string, SiteRecord[]>();
    for (const a of unmatchedAfter) {
      const bucket = pool.get(keyOf(a));
      if (bucket) bucket.push(a);
      else pool.set(keyOf(a), [a]);
    }
    const matched = new Set<SiteRecord>();
    const kept: SiteRecord[] = [];
    for (const b of unmatchedBefore) {
      const a = pool.get(keyOf(b))?.shift();
      if (!a) {
        kept.push(b);
        continue;
      }
      matched.add(a);
      if (b.guard !== a.guard)
        guards.push({ site: at(a), before: b.guard, after: a.guard });
    }
    unmatchedBefore = kept;
    unmatchedAfter = unmatchedAfter.filter((a) => !matched.has(a));
  }
  const added = unmatchedAfter.map(at);
  const removed = unmatchedBefore.map(at);
  if (!added.length && !removed.length && !guards.length) return null;
  return { added, removed, guards };
}

/**
 * Compare two inventories.
 *
 * Membership is by `Dependency.key`, so a request is "the same request" exactly
 * when the extractor says it is. Three things count as a change:
 *
 * - a dropped key and a new key that share a call site (`file:line`) on the
 *   same surface — the usual shape of editing a path or bumping a mark in
 *   place. A call site that also moved lines shows up as an add beside a
 *   remove, which is the same information, less tidily;
 * - a key present at both refs whose call sites differ;
 * - a key present at both refs where a call site's guard was added, removed or
 *   rewritten. A request that stops being guarded is exactly the kind of change
 *   this report exists to surface, and the key does not move when it happens.
 */
export function diffInventories(
  baseDeps: Dependency[],
  headDeps: Dependency[]
): InventoryDiff {
  const base = collate(baseDeps);
  const head = collate(headDeps);
  const baseByKey = new Map(base.map((r) => [r.key, r]));
  const headKeys = new Set(head.map((r) => r.key));
  const appeared = head.filter((r) => !baseByKey.has(r.key));
  const vanished = base.filter((r) => !headKeys.has(r.key));

  const changed: ChangedRequest[] = [];
  const paired = new Set<Request>();
  for (const before of vanished) {
    const sites = new Set(before.records.map(at));
    const after = appeared.find(
      (a) =>
        !paired.has(a) &&
        a.dep.surface === before.dep.surface &&
        a.records.some((r) => sites.has(at(r)))
    );
    if (!after) continue;
    paired.add(before);
    paired.add(after);
    changed.push({ before, after });
  }
  for (const after of head) {
    const before = baseByKey.get(after.key);
    if (!before) continue;
    const moved = moveOf(before.records, after.records);
    if (moved) changed.push({ before, after, moved });
  }
  changed.sort((a, b) => a.after.key.localeCompare(b.after.key));
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
 * many more there are, and so does one whose call sites moved en masse. A PR
 * comment is read, not scrolled.
 */
const MAX_SITES = 6;

const capped = (lines: string[]) =>
  lines.length <= MAX_SITES
    ? lines
    : [...lines.slice(0, MAX_SITES), `+${lines.length - MAX_SITES} more`];

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
  /** For a same-key change: what moved, one phrase per line. */
  notes: string[];
}

/**
 * How a literal is set off from the prose around it. Guard text is source and
 * can carry backticks of its own, which would break out of a markdown span.
 */
type Code = (text: string) => string;
const asText: Code = (text) => text;
const asMarkdown: Code = (text) => `\`${text.replace(/`/g, "'")}\``;

const guardPhrase = (g: GuardChange, code: Code) => {
  const where = `at ${code(g.site)}`;
  if (g.before === undefined)
    return `guard added ${where}: ${code(g.after ?? '')}`;
  if (g.after === undefined)
    return `guard removed ${where}, was: ${code(g.before)}`;
  return `guard changed ${where}: ${code(g.before)} -> ${code(g.after)}`;
};

// Guards first: a request that stopped being guarded is the highest-signal
// thing in the report, and must not be crowded out of a capped list by a
// wholesale move of call sites.
const notesFor = (m: SiteMove, code: Code) =>
  capped([
    ...m.guards.map((g) => guardPhrase(g, code)),
    ...m.added.map((s) => `call site added: ${code(s)}`),
    ...m.removed.map((s) => `call site removed: ${code(s)}`),
  ]);

/**
 * A call site, with the guard that has to hold to reach it. A request made only
 * from behind a guard is a different proposition against N-1 from one made
 * unconditionally, so the site never appears without it.
 */
const siteLine = (s: SiteRecord, code: Code) =>
  `${code(at(s))}${s.guard ? ` (guard: ${code(s.guard)})` : ''}`;

const entryOf = (
  label: string,
  dep: Dependency,
  records: SiteRecord[],
  code: Code,
  notes: string[] = []
): Entry => {
  const sites = [...new Set(records.map((s) => siteLine(s, code)))];
  return {
    label,
    unresolved: dep.unresolved,
    sites: sites.slice(0, MAX_SITES),
    more: Math.max(sites.length - MAX_SITES, 0),
    notes,
  };
};

/**
 * The label carries whatever moved. Entries are grouped by the agent they end
 * up addressed to, so a request that changed agents has to name the one it came
 * from too, or the move is invisible.
 */
const changeLabel = (before: Dependency, after: Dependency) => {
  if (agentOf(before) === agentOf(after))
    return `${target(before)} -> ${target(after)}`;
  if (target(before) === target(after))
    return `${agentOf(before)} -> ${agentOf(after)}  ${target(after)}`;
  return `${agentOf(before)} ${target(before)} -> ${agentOf(after)} ${target(after)}`;
};

/**
 * A same-key change lists what moved rather than every site it is made from:
 * the sites that did not move are what the reviewer already accepted.
 */
const changedEntry = (c: ChangedRequest, code: Code): Entry =>
  c.moved
    ? entryOf(
        target(c.after.dep),
        c.after.dep,
        [],
        code,
        notesFor(c.moved, code)
      )
    : entryOf(
        changeLabel(c.before.dep, c.after.dep),
        c.after.dep,
        c.after.records,
        code
      );

function entries(
  diff: InventoryDiff,
  section: (typeof SECTIONS)[number],
  code: Code
): { heading: string; items: Entry[] }[] {
  if (section === 'changed') {
    return grouped(diff.changed, (c) => c.after.dep).map((g) => ({
      heading: g.heading,
      items: g.items.map((c) => changedEntry(c, code)),
    }));
  }
  return grouped(diff[section], (r) => r.dep).map((g) => ({
    heading: g.heading,
    items: g.items.map((r) => entryOf(target(r.dep), r.dep, r.records, code)),
  }));
}

const HEADER = 'Desk requests';

const GUIDANCE =
  'For every **added** and **changed** request, check that the N-1 desk ' +
  'serves it: the agent has an arm for that path or mark, version injection ' +
  'is accounted for, and any `agent:neg` protocol version matches (see the ' +
  'desk-compatibility section of `AGENTS.md`). A **removed** request bears ' +
  'only on desk removal, not on this client — and nothing here fails CI.';

/** Plain text, for a terminal. */
export function renderText(diff: InventoryDiff, refs: Refs): string {
  const summary = summarize(diff);
  // Nothing changed is the whole report: sections of "(none)" would only bury
  // the one fact a reader wants.
  if (isEmpty(diff)) return summary;
  const out = [`${HEADER}: ${refs.base} -> ${refs.head}`, '', summary, ''];
  for (const section of SECTIONS) {
    const groups = entries(diff, section, asText);
    if (groups.length === 0) continue;
    out.push(section);
    for (const group of groups) {
      out.push(`  ${group.heading}`);
      for (const e of group.items) {
        out.push(`    ${e.label}`);
        if (e.unresolved) out.push(`      unresolved: ${e.unresolved}`);
        for (const note of e.notes) out.push(`      ${note}`);
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
    const groups = entries(diff, section, asMarkdown);
    if (groups.length === 0) continue;
    out.push(`### ${section[0].toUpperCase()}${section.slice(1)}`, '');
    for (const group of groups) {
      out.push(`**${group.heading}**`, '');
      for (const e of group.items) {
        // Already set off as code by `entryOf`: a site can carry a guard, and
        // that has to be its own span rather than swallowed into the site's.
        const where = e.sites.join(', ');
        out.push(
          `- \`${e.label}\`${where && ` — ${where}`}` +
            `${e.more ? ` _+${e.more} more_` : ''}` +
            (e.unresolved ? ` _(unresolved: ${e.unresolved})_` : '')
        );
        for (const note of e.notes) out.push(`  - ${note}`);
      }
      out.push('');
    }
  }
  return out.join('\n').trimEnd();
}

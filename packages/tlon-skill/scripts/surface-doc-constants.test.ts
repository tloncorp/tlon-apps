import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Deep subpaths rather than the package root, for the reason `surface-lint.ts`
// documents at length: `bunfig.toml` preloads a process-wide
// `mock.module('@tloncorp/api', …)` that does not carry the surface exports, so
// a root import would read the mock's constants instead of the real ones — and
// a pin that read a mock would be worth nothing. tsc cannot follow "exports"
// under moduleResolution:Node, hence the suppressions; the cast below restores
// the real types from the package's root declarations.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceJsonPointerModule from '@tloncorp/api/client/surface/jsonPointer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';

import { SURFACE_SUBCOMMANDS, run } from './commands/surface';
import {
  SURFACE_ERROR_CLASS,
  type SurfaceErrorClass,
  type SurfaceErrorCode,
} from './commands/surface-common';
import { readSurfaceSkillDocument } from './surface-docs-runtime';
import {
  POPULATED_CITED_CHECK,
  REACHABILITY_CITED_CHECK,
  RUBRIC_CELL_IDS,
  RUBRIC_CHECKS,
  RUBRIC_POPULATED_MARKERS,
  RUBRIC_REACHABILITY_MARKERS,
  RUBRIC_VERDICTS,
} from './surface-rubric-artifact';
import { createTestSurfaceDeps } from './surface-test-doubles';

type ApiModule = typeof import('@tloncorp/api');

const { POINTER_MAX_LENGTH, POINTER_MAX_SEGMENTS } =
  surfaceJsonPointerModule as Pick<
    ApiModule,
    'POINTER_MAX_LENGTH' | 'POINTER_MAX_SEGMENTS'
  >;
const { ACTION_ID_MAX_LENGTH, SURFACE_CAPS } = surfaceSchemasModule as Pick<
  ApiModule,
  'ACTION_ID_MAX_LENGTH' | 'SURFACE_CAPS'
>;

/**
 * The four surfaces documents are read AND WRITTEN FROM by a model, so a
 * false number in them is not a typo — it is an instruction to design
 * something the runtime will refuse.
 *
 * `surface-doc-commands.test.ts` pins one thing, that a named subcommand
 * exists, and its own header lists what it does not reach: flags, and
 * `PRIMITIVES.md` / `RUBRIC.md` entirely. Both of the dangerous errors an
 * audit later found lived inside those stated blind spots — the caps table
 * said the snapshot-state cap was 64 KB long after it had been raised to
 * 128 KB (so a model would design a state it could not snapshot), and the
 * flag doctrine put an author-owned field under the wrong command.
 *
 * This file pins the rest: every number in `PARADIGM.md` §12's caps table,
 * every `--flag` any of the four documents names, `SKILL.md`'s error-code
 * table in BOTH directions, and `RUBRIC.md`'s scoring contract.
 *
 * TWO PROPERTIES HOLD THROUGHOUT.
 *
 * **Every expected value is read from the exported constant.** A check that
 * hardcoded `128` would be the same defect one layer down.
 *
 * **A list that must grow with the artifact refuses rather than defaults**
 * (D170). Where a document is deliberately silent about something the code
 * declares — a cap with no row, an error code with no row — the silence is
 * written down as a named exemption. Adding a cap or a code therefore fails
 * this file until somebody decides which it is. A check that quietly skipped
 * what it did not recognise is how an error code got added today with no row
 * at all and nothing noticed.
 *
 * HOW THE CONTROLS WORK. Every pin below is a pure function over the document
 * text and the constants, so each one ships with a permanent control that
 * feeds it a drifted document (or a drifted constant table) and asserts the
 * message it produces. `mutate` refuses unless its anchor matched exactly
 * once, so a control cannot silently degrade into asserting on unchanged
 * text. `reads a mutated document off disk through the real resolver` closes
 * the last gap: it proves the pins are wired to files, not to strings a test
 * built.
 *
 * The shipped documents are never edited to prove a failure. They are copied,
 * and the copy is what drifts.
 */

const DOCUMENTS = [
  'SKILL.md',
  'PARADIGM.md',
  'PRIMITIVES.md',
  'RUBRIC.md',
] as const;

type DocumentName = (typeof DOCUMENTS)[number];

export function readDocument(file: DocumentName): string {
  const read = readSurfaceSkillDocument(file);
  // A missing document would silently empty every scan below, which is the
  // way a check like this rots into a no-op. Fail on it instead.
  if (!read.ok) {
    throw new Error(
      `${file} is not readable (${read.reason}) at ${read.path}; the doc/constant checks cannot run.`
    );
  }
  return read.text;
}

/**
 * An anchored, single-occurrence replacement — the only way a control edits a
 * document.
 *
 * It throws unless the anchor matched exactly once. A formatter that reflowed
 * a line, or a rewrite that moved the sentence, turns a silent no-op mutation
 * into a loud failure, which is what a control is for: a control whose
 * mutation did not apply passes for the wrong reason.
 */
export function mutate(text: string, from: string, to: string): string {
  const occurrences = text.split(from).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `control anchor ${JSON.stringify(
        from
      )} matched ${occurrences} times, not once; the mutation would not have applied as written.`
    );
  }
  return text.replace(from, to);
}

/** Markdown wraps prose mid-sentence, and code spans cross line breaks. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/* Markdown tables                                                     */
/* ------------------------------------------------------------------ */

interface MarkdownTable {
  /** 1-based line of the header row, for failure messages */
  line: number;
  headers: string[];
  rows: { line: number; cells: string[] }[];
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const SEPARATOR_ROW = /^\|[\s:|-]+\|$/;

/** Every pipe table in a document, in order. */
function markdownTables(text: string): MarkdownTable[] {
  const lines = text.split('\n');
  const tables: MarkdownTable[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index];
    const separator = lines[index + 1];
    if (!header?.trim().startsWith('|')) continue;
    if (!separator || !SEPARATOR_ROW.test(separator.trim())) continue;
    const rows: { line: number; cells: string[] }[] = [];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].trim().startsWith('|')) {
      rows.push({ line: cursor + 1, cells: splitRow(lines[cursor]) });
      cursor += 1;
    }
    tables.push({ line: index + 1, headers: splitRow(header), rows });
    index = cursor - 1;
  }
  return tables;
}

/** Strips the markdown a cell wears: bold, code spans, stray emphasis. */
function plainCell(cell: string): string {
  return cell.replace(/\*\*/g, '').replace(/`/g, '').replace(/_/g, '').trim();
}

function findTable(
  text: string,
  file: string,
  headers: string[]
): MarkdownTable {
  const wanted = headers.map((header) => header.toLowerCase());
  const found = markdownTables(text).filter(
    (table) =>
      table.headers.length === wanted.length &&
      table.headers.every(
        (header, index) => plainCell(header).toLowerCase() === wanted[index]
      )
  );
  if (found.length !== 1) {
    throw new Error(
      `${file}: expected exactly one table with headers [${headers.join(
        ', '
      )}], found ${found.length}. The table this check pins was renamed or removed; the check cannot run.`
    );
  }
  return found[0];
}

/* ------------------------------------------------------------------ */
/* 1. The caps table                                                   */
/* ------------------------------------------------------------------ */

function kb(bytes: number): string {
  return `${bytes / 1024} KB`;
}

/**
 * One row of `PARADIGM.md` §12's caps table, and the constant it states.
 *
 * `tokens` rather than whole-cell equality, because some cells carry prose
 * around the number ("8 KB (inside the spec total)"). Each token is matched
 * on a boundary that excludes digits and dots, so `12` cannot find itself
 * inside `200` and `4 KB` cannot match inside `64 KB`.
 */
interface CapExpectation {
  /** the row's first cell, with markdown stripped */
  thing: string;
  /** which `SURFACE_CAPS` key this row states, if it states one */
  capKey: keyof typeof SURFACE_CAPS | null;
  source: string;
  tokens: string[];
}

export const CAP_EXPECTATIONS: CapExpectation[] = [
  {
    thing: 'bundle',
    capKey: 'bundleSize',
    source: 'SURFACE_CAPS.bundleSize',
    tokens: [kb(SURFACE_CAPS.bundleSize)],
  },
  {
    thing: 'whole spec',
    capKey: 'specTotal',
    source: 'SURFACE_CAPS.specTotal',
    tokens: [kb(SURFACE_CAPS.specTotal)],
  },
  {
    thing: 'initialState',
    capKey: 'initialState',
    source: 'SURFACE_CAPS.initialState',
    tokens: [kb(SURFACE_CAPS.initialState)],
  },
  {
    thing: 'recipe',
    capKey: 'recipe',
    source: 'SURFACE_CAPS.recipe',
    tokens: [kb(SURFACE_CAPS.recipe)],
  },
  {
    thing: 'actions per spec',
    capKey: 'actionsPerSpec',
    source: 'SURFACE_CAPS.actionsPerSpec',
    tokens: [String(SURFACE_CAPS.actionsPerSpec)],
  },
  {
    thing: 'ops per action / per host event',
    capKey: 'opsPerEvent',
    source: 'SURFACE_CAPS.opsPerEvent',
    tokens: [String(SURFACE_CAPS.opsPerEvent)],
  },
  {
    thing: 'single op value',
    capKey: 'opValue',
    source: 'SURFACE_CAPS.opValue',
    tokens: [kb(SURFACE_CAPS.opValue)],
  },
  {
    thing: 'event entry',
    capKey: 'eventEntryTotal',
    source: 'SURFACE_CAPS.eventEntryTotal',
    tokens: [kb(SURFACE_CAPS.eventEntryTotal)],
  },
  {
    thing: 'snapshot state',
    capKey: 'snapshotState',
    source: 'SURFACE_CAPS.snapshotState',
    tokens: [kb(SURFACE_CAPS.snapshotState)],
  },
  {
    thing: 'reduced state (live)',
    capKey: 'reducedState',
    source: 'SURFACE_CAPS.reducedState',
    tokens: [kb(SURFACE_CAPS.reducedState)],
  },
  {
    thing: 'JSON depth',
    capKey: 'jsonDepth',
    source: 'SURFACE_CAPS.jsonDepth (= SURFACE_JSON_MAX_DEPTH)',
    tokens: [String(SURFACE_CAPS.jsonDepth)],
  },
  {
    thing: 'path',
    capKey: null,
    source: 'POINTER_MAX_LENGTH / POINTER_MAX_SEGMENTS (jsonPointer.ts)',
    tokens: [String(POINTER_MAX_LENGTH), String(POINTER_MAX_SEGMENTS)],
  },
  {
    thing: 'action id',
    capKey: null,
    source: 'ACTION_ID_MAX_LENGTH (schemas.ts)',
    tokens: [String(ACTION_ID_MAX_LENGTH)],
  },
];

/**
 * Caps the code declares that the table deliberately does not state.
 *
 * `provenance` is the lineage block `surface fork` writes — two ids, a
 * revision, a hash and a mode. Nothing an author writes goes near it, so a
 * row would be noise in a table whose job is to shape what an author designs.
 *
 * The list is what makes this refuse rather than default: adding a cap fails
 * until somebody decides whether an author needs to know about it.
 */
export const CAPS_WITH_NO_ROW: (keyof typeof SURFACE_CAPS)[] = ['provenance'];

/** Does the table state each row's constant? Does it state a row nothing pins? */
export function capsTableProblems(
  paradigm: string,
  expectations: CapExpectation[]
): string[] {
  const table = findTable(paradigm, 'PARADIGM.md', ['thing', 'cap']);
  const problems: string[] = [];
  const matched = new Set<string>();

  for (const row of table.rows) {
    const thing = plainCell(row.cells[0]);
    const cap = plainCell(row.cells[1] ?? '');
    const expectation = expectations.find(
      (candidate) => candidate.thing === thing
    );
    if (!expectation) {
      problems.push(
        `PARADIGM.md:${row.line} caps table has a row "${thing}" that no constant is pinned to. Add it to CAP_EXPECTATIONS naming the constant it states, or remove the row.`
      );
      continue;
    }
    matched.add(expectation.thing);
    for (const token of expectation.tokens) {
      const present = new RegExp(
        `(^|[^\\w.])${escapeForRegExp(token)}([^\\w.]|$)`
      ).test(cap);
      if (present) continue;
      problems.push(
        `PARADIGM.md:${row.line} caps table row "${thing}" says "${cap}", which does not state ${token}. ${expectation.source} is ${token}. Fix the document, not this test.`
      );
    }
  }

  for (const expectation of expectations) {
    if (matched.has(expectation.thing)) continue;
    problems.push(
      `PARADIGM.md caps table has no row for "${expectation.thing}" (${expectation.source}). The table must state it, or the expectation must go.`
    );
  }

  return problems;
}

/** Is every cap the code declares either in the table or exempt on purpose? */
export function capsCoverageProblems(
  caps: Record<string, number>,
  expectations: CapExpectation[],
  exempt: readonly string[]
): string[] {
  const problems: string[] = [];
  const rowed = new Set(
    expectations
      .map((expectation) => expectation.capKey)
      .filter((key): key is keyof typeof SURFACE_CAPS => key !== null)
  );

  for (const key of Object.keys(caps)) {
    if (rowed.has(key as keyof typeof SURFACE_CAPS)) continue;
    if (exempt.includes(key)) continue;
    problems.push(
      `SURFACE_CAPS.${key} (${caps[key]}) has no row in PARADIGM.md's caps table. Either add the row — an author designing state has to know it — or add "${key}" to CAPS_WITH_NO_ROW with the reason it does not concern an author.`
    );
  }

  for (const key of exempt) {
    if (!(key in caps)) {
      problems.push(
        `CAPS_WITH_NO_ROW names "${key}", which is not a SURFACE_CAPS key any more. Drop the exemption.`
      );
    }
    if (rowed.has(key as keyof typeof SURFACE_CAPS)) {
      problems.push(
        `CAPS_WITH_NO_ROW names "${key}", but the caps table does state it. Drop the exemption.`
      );
    }
  }

  return problems;
}

/**
 * The prose sweep, and the honest limit on it.
 *
 * §12 restates the live cap in a sentence ("any op whose result would exceed
 * 128 KB is refused"), §14 restates the recipe cap, and `SKILL.md` names the
 * live cap where it explains snapshots. Parsing those sentences would be a
 * natural-language scraper that breaks on the next rewording, so this checks
 * the one property that survives rewording: a `<n> KB` anywhere in these
 * documents must be a size the runtime actually caps something at.
 *
 * That is exactly the shape of the 64 KB error — a size no cap had. It is
 * blind, deliberately, to a REAL cap size attached to the wrong noun; the
 * table check above is what covers that, and the prose is left unpinned.
 */
export function kbSweepProblems(
  documents: { file: string; text: string }[],
  caps: Record<string, number>
): { problems: string[]; seen: number } {
  const sizes = new Set(
    Object.values(caps)
      .filter((value) => value >= 1024)
      .map((value) => value / 1024)
  );
  const known = [...sizes]
    .sort((a, b) => a - b)
    .map((size) => `${size} KB`)
    .join(', ');
  const problems: string[] = [];
  let seen = 0;

  for (const document of documents) {
    document.text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/(\d+)\s*KB\b/g)) {
        seen += 1;
        if (sizes.has(Number(match[1]))) continue;
        problems.push(
          `${document.file}:${index + 1} states "${
            match[0]
          }", which is not a cap this build enforces. SURFACE_CAPS caps sizes at ${known}.`
        );
      }
    });
  }

  return { problems, seen };
}

describe('PARADIGM.md states the caps the runtime actually enforces', () => {
  it('states every cap correctly, and states no cap that is not real', () => {
    expect(
      capsTableProblems(readDocument('PARADIGM.md'), CAP_EXPECTATIONS)
    ).toEqual([]);
  });

  it('leaves no cap the code declares silently undocumented', () => {
    expect(
      capsCoverageProblems(SURFACE_CAPS, CAP_EXPECTATIONS, CAPS_WITH_NO_ROW)
    ).toEqual([]);
  });

  it('states no KB figure that is not a real cap', () => {
    const swept = kbSweepProblems(
      DOCUMENTS.map((file) => ({ file, text: readDocument(file) })),
      SURFACE_CAPS
    );
    expect(swept.problems).toEqual([]);
    // Non-vacuity: a regex that matched nothing would pass forever.
    expect(swept.seen).toBeGreaterThanOrEqual(10);
  });

  /* -- controls ---------------------------------------------------- */

  it('reports a caps row whose number drifted from the constant', () => {
    const drifted = mutate(
      readDocument('PARADIGM.md'),
      `| snapshot state                  | ${kb(SURFACE_CAPS.snapshotState)}`,
      '| snapshot state                  | 64 KB'
    );
    const problems = capsTableProblems(drifted, CAP_EXPECTATIONS);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      `caps table row "snapshot state" says "64 KB", which does not state ${kb(
        SURFACE_CAPS.snapshotState
      )}. SURFACE_CAPS.snapshotState is ${kb(SURFACE_CAPS.snapshotState)}`
    );
  });

  it('reports a caps row nothing pins, and the pin that lost its row', () => {
    const drifted = mutate(
      readDocument('PARADIGM.md'),
      '| bundle                          |',
      '| bundle bytes                    |'
    );
    const problems = capsTableProblems(drifted, CAP_EXPECTATIONS);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain(
      'caps table has a row "bundle bytes" that no constant is pinned to'
    );
    expect(problems[1]).toContain(
      'caps table has no row for "bundle" (SURFACE_CAPS.bundleSize)'
    );
  });

  it('refuses a cap the code declares with neither a row nor an exemption', () => {
    // The D170 direction, exercised the way it will really happen: a cap
    // appears in the constants and nobody has decided about it yet. Dropping
    // `provenance` from the exemption list reproduces that state exactly,
    // without editing a shipped constant.
    const problems = capsCoverageProblems(SURFACE_CAPS, CAP_EXPECTATIONS, []);
    expect(problems).toEqual([
      `SURFACE_CAPS.provenance (${SURFACE_CAPS.provenance}) has no row in PARADIGM.md's caps table. Either add the row — an author designing state has to know it — or add "provenance" to CAPS_WITH_NO_ROW with the reason it does not concern an author.`,
    ]);
  });

  it('reports a stale exemption', () => {
    expect(
      capsCoverageProblems(SURFACE_CAPS, CAP_EXPECTATIONS, [
        ...CAPS_WITH_NO_ROW,
        'bundleSize',
      ])
    ).toEqual([
      'CAPS_WITH_NO_ROW names "bundleSize", but the caps table does state it. Drop the exemption.',
    ]);
  });

  it('reports a KB figure no cap has', () => {
    const drifted = mutate(
      readDocument('SKILL.md'),
      'approaching the 128 KB cap',
      'approaching the 64 KB cap'
    );
    const swept = kbSweepProblems(
      [{ file: 'SKILL.md', text: drifted }],
      SURFACE_CAPS
    );
    expect(swept.problems).toHaveLength(1);
    expect(swept.problems[0]).toContain(
      'states "64 KB", which is not a cap this build enforces. SURFACE_CAPS caps sizes at'
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. Flags                                                            */
/* ------------------------------------------------------------------ */

/**
 * Every `--flag` the four documents name, checked against the REAL option
 * parsing by running the real dispatcher against the hermetic test ship.
 *
 * There is no exported per-subcommand flag registry to compare a list to —
 * each command declares its `FlagSpec` inline — so this asks the parser
 * rather than a copy of it: run `surface <sub> --json <flag>` with nothing
 * else and read the refusal. `parseSurfaceArgs` rejects an unknown flag as
 * `Unknown option: <flag>`; `surface preview` hand-rolls the same rejection
 * as `unknown option <flag>`. Any OTHER outcome means the parser took it.
 *
 * Withholding the flag's value and every positional argument is what keeps
 * the probe safe as well as cheap: a known value flag fails as "<flag>
 * requires a value" and a known boolean flag fails on the missing positional,
 * so no probe reaches a write, and the deps are a fake ship regardless.
 */

interface FlagReference {
  file: string;
  line: number;
  flag: string;
  /** the subcommand the same code span named, when it named one */
  subcommand: string | null;
}

/**
 * Flags are read only out of code — fenced blocks and backticked spans.
 *
 * Nothing else in these documents that starts with `--` is a command line:
 * `var(--space-m)` in `PRIMITIVES.md` is a CSS custom property, and an
 * em-dash-heavy sentence is prose. A code span that opens on a DIFFERENT
 * `tlon` command (`tlon posts send … --bot`) is skipped whole, because its
 * flags belong to another command group's parser.
 */
export function extractFlagReferences(
  file: string,
  text: string
): FlagReference[] {
  const references: FlagReference[] = [];
  const lineOf = (index: number) => text.slice(0, index).split('\n').length;

  const chunks: { body: string; offset: number }[] = [];
  for (const match of text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
    chunks.push({ body: match[1], offset: match.index });
  }
  // Blanked rather than removed, so an inline span's offset still indexes the
  // original text and its reported line number stays true.
  const withoutFences = text.replace(/```[a-z]*\n[\s\S]*?```/g, (block) =>
    ' '.repeat(block.length)
  );
  for (const match of withoutFences.matchAll(/`([^`]+)`/g)) {
    chunks.push({ body: match[1], offset: match.index });
  }

  for (const chunk of chunks) {
    const otherCommand = /^\s*tlon\s+(\w+)/.exec(chunk.body);
    if (otherCommand && otherCommand[1] !== 'surface') continue;
    const line = lineOf(chunk.offset);
    let subcommand: string | null = null;
    // One walk, so a flag is attributed to the subcommand named before it in
    // the same span, and to nothing when the span named none.
    for (const token of chunk.body.matchAll(
      /(?:\btlon\s+)?\bsurface\s+([a-z][a-z0-9-]*)|(?<!var\()(--[a-z][a-z0-9-]*)/g
    )) {
      if (token[1] !== undefined) {
        subcommand = token[1];
        continue;
      }
      references.push({ file, line, flag: token[2], subcommand });
    }
  }
  return references;
}

function readFlagReferences(): FlagReference[] {
  return DOCUMENTS.flatMap((file) =>
    extractFlagReferences(file, readDocument(file))
  );
}

export async function parserTakesFlag(
  subcommand: string,
  flag: string
): Promise<boolean> {
  const harness = createTestSurfaceDeps({});
  try {
    await run([subcommand, '--json', flag], harness.deps);
  } catch {
    // A non-`SurfaceError` escaping the dispatcher is not a parser refusal.
    return true;
  }
  const said = `${harness.out()}\n${harness.err()}`;
  return !new RegExp(
    `unknown option:?\\s*${escapeForRegExp(flag)}(\\W|$)`,
    'i'
  ).test(said);
}

export async function attributedFlagProblems(
  references: FlagReference[]
): Promise<string[]> {
  const problems: string[] = [];
  for (const reference of references) {
    if (reference.subcommand === null) continue;
    // A subcommand that does not exist is surface-doc-commands.test.ts's
    // finding, not this one's; reporting it twice buries the flag result.
    if (!SURFACE_SUBCOMMANDS.includes(reference.subcommand as never)) continue;
    if (await parserTakesFlag(reference.subcommand, reference.flag)) continue;
    problems.push(
      `${reference.file}:${reference.line} tells the reader to run "surface ${reference.subcommand} ${reference.flag}", and that command's parser rejects ${reference.flag} as an unknown option. A bot following this line gets a usage error and no way forward.`
    );
  }
  return problems;
}

export async function looseFlagProblems(
  references: FlagReference[]
): Promise<string[]> {
  const loose = new Map<string, FlagReference>();
  for (const reference of references) {
    if (reference.subcommand !== null) continue;
    if (!loose.has(reference.flag)) loose.set(reference.flag, reference);
  }

  const problems: string[] = [];
  for (const [flag, reference] of loose) {
    let taken = false;
    for (const subcommand of SURFACE_SUBCOMMANDS) {
      if (!(await parserTakesFlag(subcommand, flag))) continue;
      taken = true;
      break;
    }
    if (taken) continue;
    problems.push(
      `${reference.file}:${reference.line} names ${flag} in prose, and no surface subcommand parses it. It was renamed or removed, and the document still tells a bot to pass it.`
    );
  }
  return problems;
}

describe('the surfaces skill may only name flags the commands parse', () => {
  it('resolves every flag a document attributes to a subcommand', async () => {
    expect(await attributedFlagProblems(readFlagReferences())).toEqual([]);
  });

  it('resolves every flag a document names loose in prose', async () => {
    expect(await looseFlagProblems(readFlagReferences())).toEqual([]);
  });

  // Non-vacuity. An extractor that matched nothing would satisfy both
  // assertions above forever, so its yield is asserted: a real count, drawn
  // from more than one document, covering the flags the workflow turns on,
  // and with the subcommand attribution actually attributing.
  it('finds a known-nonzero set of real flag references', () => {
    const references = readFlagReferences();
    expect(references.length).toBeGreaterThanOrEqual(30);
    expect(
      new Set(references.map((reference) => reference.file)).size
    ).toBeGreaterThanOrEqual(3);
    expect(
      references.filter((reference) => reference.subcommand !== null).length
    ).toBeGreaterThanOrEqual(10);

    const named = new Set(references.map((reference) => reference.flag));
    for (const required of [
      '--json',
      '--bundle',
      '--spec',
      '--rubric',
      '--preserve-state',
      '--state',
      '--out',
      '--bundle-out',
    ]) {
      expect([...named]).toContain(required);
    }
  });

  /* -- controls ---------------------------------------------------- */

  it('separates a flag the parser takes from one it refuses', async () => {
    expect(await parserTakesFlag('publish', '--preserve-state')).toBe(true);
    expect(await parserTakesFlag('publish', '--frobnicate')).toBe(false);
    // `preview` hand-rolls its parser and words the refusal differently, so
    // the probe has to read both wordings.
    expect(await parserTakesFlag('preview', '--state')).toBe(true);
    expect(await parserTakesFlag('preview', '--frobnicate')).toBe(false);
  });

  it('reports a renamed flag on a command line the document prints', async () => {
    const drifted = mutate(
      readDocument('SKILL.md'),
      '`tlon surface show <channel> --bundle-out app.js --json`',
      '`tlon surface show <channel> --bundle-output app.js --json`'
    );
    const problems = await attributedFlagProblems(
      extractFlagReferences('SKILL.md', drifted)
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'tells the reader to run "surface show --bundle-output", and that command\'s parser rejects --bundle-output as an unknown option'
    );
  });

  it('reports a renamed flag the document only names in prose', async () => {
    const drifted = mutate(
      readDocument('PARADIGM.md'),
      'The refusal is cleared by `--allow-initial-state-change`',
      'The refusal is cleared by `--permit-initial-state-change`'
    );
    const problems = await looseFlagProblems(
      extractFlagReferences('PARADIGM.md', drifted)
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'names --permit-initial-state-change in prose, and no surface subcommand parses it'
    );
  });

  // The documented blind spots of the extractor, asserted so they stay
  // documented: CSS custom properties are not flags, and another command
  // group's flags are not this parser's problem.
  it('reads neither CSS custom properties nor another command as flags', () => {
    const text = [
      'Use token values (`var(--space-m)`) and never a literal.',
      'Send it with `tlon posts send <chat-nest> "…" --bot`.',
      'Publish with `tlon surface publish <channel> --bundle app.js`.',
    ].join('\n');
    expect(
      extractFlagReferences('SKILL.md', text).map(
        (reference) => `${reference.subcommand}:${reference.flag}`
      )
    ).toEqual(['publish:--bundle']);
  });
});

/* ------------------------------------------------------------------ */
/* 3. The error-code table                                             */
/* ------------------------------------------------------------------ */

/**
 * Codes the CLI declares that `SKILL.md`'s table deliberately has no row for.
 *
 * The table is a repair manual, not a catalogue: it carries the codes a bot
 * meets inside the authoring loop and can act on. These are the ones it never
 * meets there, or whose remedy is not a bot's to carry out.
 *
 * This list is the whole point of the second direction. Every entry had to be
 * decided once; a code added tomorrow has to be decided too, and the failure
 * below is where that decision gets made. A code was added today with no row
 * at all and nothing said so.
 */
export const CODES_WITH_NO_ROW: SurfaceErrorCode[] = [
  // Never a situation to branch on: the argv was malformed, and the help text
  // rides in `details.help`.
  'usage',
  // Addressing failures no rewrite repairs — the channel, the post or the
  // definition simply is not there.
  'channel-not-found',
  'spec-absent',
  'post-not-found',
  'spec-version-too-new',
  // The publish path's own refusals, explained at length in "Maintaining a
  // live surface" rather than compressed into a table row.
  'pre-state-moved',
  'upload-failed',
  // Install- and operator-level failures. Nothing an authoring bot holds is
  // implicated, and no row would tell it to do anything but stop.
  //
  // `gate-harness-unavailable` is deliberately NOT here. It reads like one of
  // these and is not: its whole purpose is to say "your files are not
  // implicated, do not rewrite the app", and the gate raises it precisely
  // because saying anything else "sends a repair loop to rewrite a correct
  // app". A bot that meets it with no row falls back to its default, which is
  // the rewrite the code exists to prevent. It has a row.
  'template-not-found',
  'template-catalogue-empty',
  'template-bundle-missing',
  'doctrine-unavailable',
  'write-out-of-scope',
];

interface DocumentedCode {
  line: number;
  code: string;
  errorClass: string;
}

export function documentedCodes(skill: string): DocumentedCode[] {
  const table = findTable(skill, 'SKILL.md', [
    'code',
    'class',
    'what to do',
    'what the user hears',
  ]);
  return table.rows.flatMap((row) =>
    [...row.cells[0].matchAll(/`([a-z][a-z0-9-]*)`/g)].map((match) => ({
      line: row.line,
      code: match[1],
      errorClass: plainCell(row.cells[1] ?? ''),
    }))
  );
}

/** Direction one: nothing documented that the CLI cannot raise, or misclassed. */
export function documentedCodeProblems(
  documented: DocumentedCode[],
  classes: Record<string, SurfaceErrorClass>
): string[] {
  const problems: string[] = [];
  for (const entry of documented) {
    const actual = (classes as Record<string, string | undefined>)[entry.code];
    if (actual === undefined) {
      problems.push(
        `SKILL.md:${entry.line} documents the code "${entry.code}", which is not in SURFACE_ERROR_CLASS. A bot told to branch on it will never see it. Remove the row, or add the code.`
      );
      continue;
    }
    if (actual === entry.errorClass) continue;
    problems.push(
      `SKILL.md:${entry.line} classes "${entry.code}" as ${entry.errorClass}; SURFACE_ERROR_CLASS classes it as ${actual}. The document is what tells a bot whether to rewrite its own files, so this is the direction that does damage.`
    );
  }
  return problems;
}

/** Direction two — the one that failed: nothing the CLI raises without a row. */
export function undocumentedCodeProblems(
  documented: DocumentedCode[],
  classes: Record<string, SurfaceErrorClass>,
  exempt: readonly string[]
): string[] {
  const rowed = new Set(documented.map((entry) => entry.code));
  const problems: string[] = [];

  for (const code of Object.keys(classes)) {
    if (rowed.has(code)) continue;
    if (exempt.includes(code)) continue;
    problems.push(
      `SURFACE_ERROR_CLASS declares "${code}" (${classes[code]}) and SKILL.md's error table has no row for it. A bot that meets it has no instruction at all. Add the row, or add "${code}" to CODES_WITH_NO_ROW with the reason a bot never has to act on it.`
    );
  }

  // A stale exemption is not harmless: it is what tells the next reader that
  // a code is deliberately undocumented. Both ways it can go stale are
  // reported, for the reason `CAPS_WITH_NO_ROW` reports both.
  for (const code of exempt) {
    if (!(code in classes)) {
      problems.push(
        `CODES_WITH_NO_ROW names "${code}", which SURFACE_ERROR_CLASS no longer declares. Drop the exemption.`
      );
      continue;
    }
    if (!rowed.has(code)) continue;
    problems.push(
      `CODES_WITH_NO_ROW names "${code}", but SKILL.md's error table now has a row for it. Drop the exemption — it is what tells the next reader the code is undocumented on purpose.`
    );
  }

  return problems;
}

describe('SKILL.md documents the error codes the CLI can actually raise', () => {
  it('documents no code that does not exist, and classes each as the CLI does', () => {
    expect(
      documentedCodeProblems(
        documentedCodes(readDocument('SKILL.md')),
        SURFACE_ERROR_CLASS
      )
    ).toEqual([]);
  });

  it('leaves no code the CLI can raise without a row or a reason', () => {
    expect(
      undocumentedCodeProblems(
        documentedCodes(readDocument('SKILL.md')),
        SURFACE_ERROR_CLASS,
        CODES_WITH_NO_ROW
      )
    ).toEqual([]);
  });

  // Non-vacuity: the table parse yields real rows carrying real codes in both
  // classes, so neither assertion above can be satisfied by an empty parse.
  it('finds a known-nonzero set of documented codes', () => {
    const documented = documentedCodes(readDocument('SKILL.md'));
    expect(documented.length).toBeGreaterThanOrEqual(20);
    const codes = documented.map((entry) => entry.code);
    for (const required of [
      'admin-required',
      'lint-failed',
      'rubric-mismatch',
      'migration-pending',
      'bundle-unavailable',
    ]) {
      expect(codes).toContain(required);
    }
    expect(new Set(documented.map((entry) => entry.errorClass))).toEqual(
      new Set(['author', 'environment'])
    );
  });

  /* -- controls ---------------------------------------------------- */

  it('reports a documented code the CLI cannot raise', () => {
    const drifted = mutate(
      readDocument('SKILL.md'),
      '| `admin-required`, `group-not-found`',
      '| `admin-required`, `group-not-found`, `group-exploded`'
    );
    const problems = documentedCodeProblems(
      documentedCodes(drifted),
      SURFACE_ERROR_CLASS
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'documents the code "group-exploded", which is not in SURFACE_ERROR_CLASS'
    );
  });

  it('reports a documented code whose class contradicts the CLI', () => {
    const drifted = mutate(
      readDocument('SKILL.md'),
      '| `lint-failed`                                                                     | author',
      '| `lint-failed`                                                                     | environment'
    );
    const problems = documentedCodeProblems(
      documentedCodes(drifted),
      SURFACE_ERROR_CLASS
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'classes "lint-failed" as environment; SURFACE_ERROR_CLASS classes it as author'
    );
  });

  it('reports a code the CLI raises that no row covers', () => {
    // The direction that actually failed, exercised the way it failed: a code
    // exists in the class map and no row mentions it. Fed through the real
    // document so the table parse is doing the work.
    const problems = undocumentedCodeProblems(
      documentedCodes(readDocument('SKILL.md')),
      { ...SURFACE_ERROR_CLASS, 'gate-went-missing': 'environment' },
      CODES_WITH_NO_ROW
    );
    expect(problems).toEqual([
      `SURFACE_ERROR_CLASS declares "gate-went-missing" (environment) and SKILL.md's error table has no row for it. A bot that meets it has no instruction at all. Add the row, or add "gate-went-missing" to CODES_WITH_NO_ROW with the reason a bot never has to act on it.`,
    ]);
  });

  it('reports a documented code that lost its row', () => {
    const drifted = mutate(
      readDocument('SKILL.md'),
      '| `admin-required`, `group-not-found`',
      '| `admin-required`'
    );
    const problems = undocumentedCodeProblems(
      documentedCodes(drifted),
      SURFACE_ERROR_CLASS,
      CODES_WITH_NO_ROW
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      `SURFACE_ERROR_CLASS declares "group-not-found" (environment) and SKILL.md's error table has no row for it`
    );
  });

  it('reports a stale exemption', () => {
    expect(
      undocumentedCodeProblems(
        documentedCodes(readDocument('SKILL.md')),
        SURFACE_ERROR_CLASS,
        [...CODES_WITH_NO_ROW, 'code-that-was-deleted' as SurfaceErrorCode]
      )
    ).toEqual([
      'CODES_WITH_NO_ROW names "code-that-was-deleted", which SURFACE_ERROR_CLASS no longer declares. Drop the exemption.',
    ]);
  });

  it('reports an exemption the table has since made redundant', () => {
    // The other way an exemption rots, and the one that actually happened:
    // `initial-state-changed` was exempt until somebody wrote it a row.
    expect(
      undocumentedCodeProblems(
        documentedCodes(readDocument('SKILL.md')),
        SURFACE_ERROR_CLASS,
        [...CODES_WITH_NO_ROW, 'lint-failed' as SurfaceErrorCode]
      )
    ).toEqual([
      `CODES_WITH_NO_ROW names "lint-failed", but SKILL.md's error table now has a row for it. Drop the exemption — it is what tells the next reader the code is undocumented on purpose.`,
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* 4. The rubric contract                                              */
/* ------------------------------------------------------------------ */

const NUMBER_WORDS: Record<number, string> = {
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
  13: 'thirteen',
  14: 'fourteen',
};

/** `phone-populated-dark` → `phone`; the capture families. */
function cellFamily(cellId: string): string {
  return cellId.replace(/-(?:initial|populated)-(?:light|dark)$/, '');
}

export function cellProblems(
  rubric: string,
  cellIds: readonly string[]
): string[] {
  const problems: string[] = [];
  const real = new Set(cellIds);

  // No document may name a capture cell that is not a key of the sheet.
  rubric.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(
      /\b((?:phone|desktop)(?:-full)?-[a-z]+-(?:light|dark))\b/g
    )) {
      if (real.has(match[1])) continue;
      problems.push(
        `RUBRIC.md:${index + 1} names the capture cell "${
          match[1]
        }", which is not in RUBRIC_CELL_IDS. The sheet is keyed by [${[
          ...real,
        ].join(', ')}].`
      );
    }
  });

  // And the families table must list exactly the families the ids have.
  const families = [...new Set(cellIds.map(cellFamily))].sort();
  const table = findTable(rubric, 'RUBRIC.md', [
    'cell',
    'size',
    'what it answers',
  ]);
  const documented = table.rows.map((row) => plainCell(row.cells[0])).sort();
  if (JSON.stringify(documented) !== JSON.stringify(families)) {
    problems.push(
      `RUBRIC.md:${table.line} lists capture families [${documented.join(
        ', '
      )}]; RUBRIC_CELL_IDS has [${families.join(
        ', '
      )}]. Every family the sheet keys has to be a row the reader is told to open.`
    );
  }

  return problems;
}

export function cellCountProblems(
  rubric: string,
  cellIds: readonly string[]
): { problems: string[]; seen: number } {
  const expected = NUMBER_WORDS[cellIds.length];
  if (expected === undefined) {
    return {
      problems: [
        `RUBRIC_CELL_IDS has ${cellIds.length} cells and NUMBER_WORDS has no word for it; the count sentence needs a human either way.`,
      ],
      seen: 0,
    };
  }
  const problems: string[] = [];
  let seen = 0;

  // Rewording-tolerant: any count attached to the cells, wherever the
  // sentence puts it, has to be the number of cells there are.
  for (const match of flatten(rubric).matchAll(
    /\b([A-Za-z]+|\d+)\s+(?:PNGs|capture cells|cells)\b/g
  )) {
    const token = match[1].toLowerCase();
    const isCount =
      /^\d+$/.test(token) || Object.values(NUMBER_WORDS).includes(token);
    if (!isCount) continue;
    seen += 1;
    if (token === expected) continue;
    problems.push(
      `RUBRIC.md says "${match[0].trim()}"; RUBRIC_CELL_IDS has ${
        cellIds.length
      } cells, so the count is "${expected}".`
    );
  }

  return { problems, seen };
}

export function checkHeadingNumbers(rubric: string): number[] {
  return [...rubric.matchAll(/^### (\d+)\. (.+)$/gm)].map((match) =>
    Number(match[1])
  );
}

export function verdictsOffered(rubric: string, count: number): string[] {
  const text = flatten(rubric);
  const anchor = text.indexOf('`verdict` of ');
  if (anchor < 0) return [];
  return [...text.slice(anchor, anchor + 160).matchAll(/`([a-z][a-z-]*)`/g)]
    .map((match) => match[1])
    .slice(1, 1 + count);
}

export function markersQuoted(rubric: string): string[] {
  return [
    ...new Set([...flatten(rubric).matchAll(/`([^`]*:)`/g)].map((m) => m[1])),
  ].sort();
}

export function citedCheckProblems(rubric: string): {
  problems: string[];
  seen: number;
} {
  const numberOf = (id: string) =>
    RUBRIC_CHECKS.find((check) => check.id === id)?.number;
  const expected: Record<string, number | undefined> = {
    populated: numberOf(POPULATED_CITED_CHECK),
    reachability: numberOf(REACHABILITY_CITED_CHECK),
  };
  const problems: string[] = [];
  let seen = 0;

  for (const match of flatten(rubric).matchAll(
    /[Cc]heck (\d+) carries `(populated|reachability)`/g
  )) {
    seen += 1;
    const wanted = expected[match[2]];
    if (Number(match[1]) === wanted) continue;
    problems.push(
      `RUBRIC.md says "${match[0]}", but the \`${
        match[2]
      }\` line is stamped onto check ${wanted} (${
        match[2] === 'populated'
          ? `POPULATED_CITED_CHECK = ${POPULATED_CITED_CHECK}`
          : `REACHABILITY_CITED_CHECK = ${REACHABILITY_CITED_CHECK}`
      }). Publish refuses a sheet whose stamped line is missing from the check it belongs to.`
    );
  }

  return { problems, seen };
}

describe('RUBRIC.md states the scoring contract publish enforces', () => {
  it('names the same capture cells the artifact keys', () => {
    expect(cellProblems(readDocument('RUBRIC.md'), RUBRIC_CELL_IDS)).toEqual(
      []
    );
  });

  it('counts the capture cells the way the artifact counts them', () => {
    const counted = cellCountProblems(
      readDocument('RUBRIC.md'),
      RUBRIC_CELL_IDS
    );
    expect(counted.problems).toEqual([]);
    expect(counted.seen).toBeGreaterThan(0);
  });

  it('numbers its check headings the way RUBRIC_CHECKS numbers them', () => {
    const headings = checkHeadingNumbers(readDocument('RUBRIC.md'));
    const expected = RUBRIC_CHECKS.map((check) => check.number);
    expect(
      headings,
      `RUBRIC.md's numbered check headings are [${headings.join(
        ', '
      )}]; RUBRIC_CHECKS declares [${expected.join(
        ', '
      )}]. A sheet carries one entry per numbered check, so a heading the constants do not have is a check nobody can score — and a check the constants have with no heading is one nobody can read.`
    ).toEqual(expected);
  });

  it('offers the same verdict vocabulary the validator accepts', () => {
    const listed = verdictsOffered(
      readDocument('RUBRIC.md'),
      RUBRIC_VERDICTS.length
    );
    expect(
      listed,
      `RUBRIC.md offers verdicts [${listed.join(
        ', '
      )}]; RUBRIC_VERDICTS accepts [${RUBRIC_VERDICTS.join(
        ', '
      )}]. A verdict the document invents is a sheet publish refuses.`
    ).toEqual([...RUBRIC_VERDICTS]);
  });

  it('quotes exactly the machine markers preview stamps', () => {
    const quoted = markersQuoted(readDocument('RUBRIC.md'));
    const real = [
      ...new Set<string>([
        ...RUBRIC_REACHABILITY_MARKERS,
        ...RUBRIC_POPULATED_MARKERS,
      ]),
    ].sort();
    expect(
      quoted,
      `RUBRIC.md quotes the machine-stamped prefixes [${quoted.join(
        ' | '
      )}]; RUBRIC_REACHABILITY_MARKERS + RUBRIC_POPULATED_MARKERS are [${real.join(
        ' | '
      )}]. Both are read as fixed enumerations, so a prefix the document invents is one a reader will never see, and one it drops is a stamp nobody is told how to read.`
    ).toEqual(real);
  });

  it('attaches the two stamped lines to the checks that carry them', () => {
    const cited = citedCheckProblems(readDocument('RUBRIC.md'));
    expect(cited.problems).toEqual([]);
    expect(
      cited.seen,
      'RUBRIC.md no longer says which check carries `populated` and which carries `reachability`; the sentence this check reads was reworded.'
    ).toBeGreaterThanOrEqual(2);
  });

  /* -- controls ---------------------------------------------------- */

  it('reports a capture cell that is not a key of the sheet', () => {
    const drifted = mutate(
      readDocument('RUBRIC.md'),
      'phone-populated-dark',
      'phone-crowded-dark'
    );
    const problems = cellProblems(drifted, RUBRIC_CELL_IDS);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'names the capture cell "phone-crowded-dark", which is not in RUBRIC_CELL_IDS'
    );
  });

  it('reports a capture family the sheet does not key', () => {
    const drifted = mutate(
      readDocument('RUBRIC.md'),
      '| `desktop`    |',
      '| `tablet`     |'
    );
    const problems = cellProblems(drifted, RUBRIC_CELL_IDS);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'lists capture families [phone, phone-full, tablet]'
    );
    expect(problems[0]).toContain(
      'RUBRIC_CELL_IDS has [desktop, phone, phone-full]'
    );
  });

  it('reports a cell count that drifted from the artifact', () => {
    const drifted = mutate(
      readDocument('RUBRIC.md'),
      'Twelve PNGs',
      'Fourteen PNGs'
    );
    const counted = cellCountProblems(drifted, RUBRIC_CELL_IDS);
    expect(counted.problems).toHaveLength(1);
    expect(counted.problems[0]).toBe(
      `RUBRIC.md says "Fourteen PNGs"; RUBRIC_CELL_IDS has ${RUBRIC_CELL_IDS.length} cells, so the count is "twelve".`
    );
  });

  it('reports a check heading the constants do not declare', () => {
    const drifted = mutate(
      readDocument('RUBRIC.md'),
      '### 8. Display-only is what was asked for',
      '### 9. Display-only is what was asked for'
    );
    expect(checkHeadingNumbers(drifted)).not.toEqual(
      RUBRIC_CHECKS.map((check) => check.number)
    );
    expect(checkHeadingNumbers(drifted)).toEqual([1, 2, 3, 4, 5, 6, 7, 9]);
  });

  it('reports a verdict the validator does not accept', () => {
    const drifted = mutate(
      readDocument('RUBRIC.md'),
      '`repaired` or `residual`',
      '`repaired` or `provisional`'
    );
    expect(verdictsOffered(drifted, RUBRIC_VERDICTS.length)).toEqual([
      'pass',
      'fail',
      'repaired',
      'provisional',
    ]);
  });

  it('reports a machine marker the document invented', () => {
    const drifted = mutate(
      readDocument('RUBRIC.md'),
      '- `not walked:` — it never ran',
      '- `not attempted:` — it never ran'
    );
    expect(markersQuoted(drifted)).not.toContain('not walked:');
    expect(markersQuoted(drifted)).toContain('not attempted:');
  });

  it('reports a stamped line attached to the wrong check', () => {
    const drifted = mutate(
      readDocument('RUBRIC.md'),
      'check 7 carries\n  `reachability`',
      'check 6 carries\n  `reachability`'
    );
    const cited = citedCheckProblems(drifted);
    expect(cited.problems).toHaveLength(1);
    expect(cited.problems[0]).toContain(
      'RUBRIC.md says "check 6 carries `reachability`", but the `reachability` line is stamped onto check 7 (REACHABILITY_CITED_CHECK = answers-the-request)'
    );
  });
});

/* ------------------------------------------------------------------ */
/* 5. Primitive props                                                  */
/* ------------------------------------------------------------------ */

/**
 * `PRIMITIVES.md` is the catalogue an app is written from, and nothing reads
 * it today. A renamed prop there is not a compile error anywhere: the bundle
 * passes an attribute the component never reads, and the value is silently
 * `undefined` on a live board.
 *
 * WHAT THIS READS, AND THE HONEST LIMIT ON IT. There is no runtime handle on
 * the props: TypeScript erases them, and `@tloncorp/surface-shell`'s exports
 * map does not expose `primitives/index.tsx`, so `createPrimitiveKit()` is
 * not importable from here. This therefore PARSES THE REAL SOURCE FILE —
 * comments stripped, braces matched, top-level keys only. It is a source
 * scan, not a value read, and that is a weaker guarantee than every other pin
 * in this file.
 *
 * The weakness is bounded by making the parse fail loudly rather than empty:
 * the kit list has to come out non-trivial, every primitive has to resolve a
 * props type, and every primitive has to yield at least one prop. A parse
 * that stopped working reports that, instead of agreeing with everything.
 */

const PRIMITIVES_SOURCE_PATH = join(
  dirname(require.resolve('@tloncorp/surface-shell/package.json')),
  'src',
  'primitives',
  'index.tsx'
);

/** Comments stripped: a `/** … the shell: … *\/` line is not a prop. */
function readPrimitivesSource(): string {
  return readFileSync(PRIMITIVES_SOURCE_PATH, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

/** The body of the brace-delimited block that opens at or after `from`. */
function braceBlock(text: string, from: number): string {
  const open = text.indexOf('{', from);
  if (open < 0) throw new Error('no block to read');
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  throw new Error('unbalanced block');
}

/** `title?: string; children?: X` → ['title', 'children']; nesting ignored. */
function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === '{' || character === '(' || character === '[') depth += 1;
    else if (character === '}' || character === ')' || character === ']') {
      depth -= 1;
    } else if (depth === 0) {
      const match = /^([A-Za-z_$][\w$]*)\??\s*:/.exec(body.slice(index));
      if (match && (index === 0 || /[;,{\n\s]/.test(body[index - 1]))) {
        keys.push(match[1]);
        index += match[0].length - 1;
      }
    }
  }
  return [...new Set(keys)];
}

/** The kit an app bundle sees: the `primitives` object plus what the factory adds. */
function primitiveNames(source: string): string[] {
  const registry = source.indexOf('export const primitives = {');
  if (registry < 0) {
    throw new Error(
      `${PRIMITIVES_SOURCE_PATH} no longer declares "export const primitives = {"; the primitive catalogue check cannot run.`
    );
  }
  const declared = braceBlock(source, registry)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Z][\w$]*$/.test(entry));

  const factory = source.indexOf('export function createPrimitiveKit');
  if (factory < 0) {
    throw new Error(
      `${PRIMITIVES_SOURCE_PATH} no longer declares createPrimitiveKit; the primitive catalogue check cannot run.`
    );
  }
  const bound = [
    ...braceBlock(source, factory)
      .slice(braceBlock(source, factory).indexOf('return'))
      .matchAll(/([A-Z][\w$]*)\s*:/g),
  ].map((match) => match[1]);

  return [...new Set([...declared, ...bound])];
}

/** A component's props, whether declared inline or as a named type. */
function primitiveProps(source: string, name: string): string[] {
  const inline = new RegExp(`export function ${name}\\(props:\\s*`).exec(
    source
  );
  if (inline) {
    const at = inline.index + inline[0].length;
    if (source[at] === '{') return topLevelKeys(braceBlock(source, at));
    const named = /^([A-Za-z_$][\w$]*)/.exec(source.slice(at));
    if (named) return namedTypeKeys(source, named[1]);
  }
  return namedTypeKeys(source, `${name}Props`);
}

function namedTypeKeys(source: string, id: string): string[] {
  const declaration = new RegExp(
    `(?:export )?(?:interface ${id}\\s*|type ${id}\\s*=\\s*)\\{`
  ).exec(source);
  if (!declaration) {
    throw new Error(
      `no props type "${id}" in ${PRIMITIVES_SOURCE_PATH}; PRIMITIVES.md's props cannot be checked against anything.`
    );
  }
  return topLevelKeys(braceBlock(source, declaration.index));
}

/** The `## <Name>` sections that document a component. */
function primitiveSections(primitives: string): string[] {
  return [...primitives.matchAll(/^## (.+)$/gm)]
    .map((match) => match[1].trim())
    .filter((heading) => /^[A-Z][A-Za-z]*$/.test(heading));
}

/** The prop names a section's `| prop | type | notes |` table lists. */
function documentedProps(primitives: string, name: string): string[] {
  const start = primitives.indexOf(`\n## ${name}\n`);
  if (start < 0) return [];
  const next = primitives.indexOf('\n## ', start + 1);
  const section = primitives.slice(start, next < 0 ? undefined : next);
  const tables = markdownTables(section).filter(
    (table) =>
      table.headers.length === 3 && plainCell(table.headers[0]) === 'prop'
  );
  return tables.flatMap((table) =>
    table.rows.map((row) => plainCell(row.cells[0])).filter(Boolean)
  );
}

function primitiveProblems(primitives: string, source: string): string[] {
  const problems: string[] = [];
  const kit = primitiveNames(source);
  const sections = primitiveSections(primitives);

  for (const name of kit) {
    if (sections.includes(name)) continue;
    problems.push(
      `PRIMITIVES.md has no "## ${name}" section, and the kit hands every app a ${name}. An undocumented primitive is one no app will use.`
    );
  }
  for (const name of sections) {
    if (kit.includes(name)) continue;
    problems.push(
      `PRIMITIVES.md documents "## ${name}", which createPrimitiveKit does not hand to a bundle. An app written from that section destructures undefined.`
    );
  }

  for (const name of kit) {
    if (!sections.includes(name)) continue;
    const real = primitiveProps(source, name);
    const documented = documentedProps(primitives, name);
    if (real.length === 0) {
      problems.push(
        `${name} parsed to zero props out of ${PRIMITIVES_SOURCE_PATH}; the parse broke and would agree with anything.`
      );
      continue;
    }
    for (const prop of documented) {
      if (real.includes(prop)) continue;
      problems.push(
        `PRIMITIVES.md's ${name} table lists a prop "${prop}" the component does not declare. It declares [${real.join(
          ', '
        )}]. A bundle written from this row passes an attribute nothing reads, and the value is undefined at runtime with no error.`
      );
    }
    for (const prop of real) {
      if (documented.includes(prop)) continue;
      problems.push(
        `${name} declares a prop "${prop}" that PRIMITIVES.md's table does not list. The catalogue is what an app is written from, so an undocumented prop is one no app can use.`
      );
    }
  }

  return problems;
}

describe('PRIMITIVES.md catalogues the components apps are actually handed', () => {
  it('documents every primitive, and every prop each one declares', () => {
    expect(
      primitiveProblems(readDocument('PRIMITIVES.md'), readPrimitivesSource())
    ).toEqual([]);
  });

  // Non-vacuity: the source parse has to have found a real kit with real
  // props, or both directions above are satisfied by nothing.
  it('parses a real kit out of the real source file', () => {
    const source = readPrimitivesSource();
    const kit = primitiveNames(source);
    expect(kit.length).toBeGreaterThanOrEqual(8);
    for (const required of ['Card', 'ListRow', 'Button', 'Avatar', 'Chart']) {
      expect(kit).toContain(required);
    }
    // `Chart` is the one the factory binds rather than the registry declaring,
    // so its presence proves both halves of the kit parse.
    expect(primitiveProps(source, 'Chart')).toContain('data');
    expect(primitiveProps(source, 'Card')).toContain('title');
  });

  /* -- controls ---------------------------------------------------- */

  it('reports a documented prop the component does not declare', () => {
    const drifted = mutate(
      readDocument('PRIMITIVES.md'),
      '| `secondary` | nodes? |',
      '| `subtitle`  | nodes? |'
    );
    const problems = primitiveProblems(drifted, readPrimitivesSource());
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain(
      `PRIMITIVES.md's ListRow table lists a prop "subtitle" the component does not declare. It declares [left, right, secondary, children]`
    );
    expect(problems[1]).toContain(
      'ListRow declares a prop "secondary" that PRIMITIVES.md\'s table does not list'
    );
  });

  it('reports a prop the component gained and the catalogue did not', () => {
    const drifted = mutate(
      readPrimitivesSource(),
      'secondary?: ComponentChildren;',
      'secondary?: ComponentChildren;\n  trailingNote?: ComponentChildren;'
    );
    const problems = primitiveProblems(readDocument('PRIMITIVES.md'), drifted);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'ListRow declares a prop "trailingNote" that PRIMITIVES.md\'s table does not list'
    );
  });

  it('reports a primitive the catalogue renamed', () => {
    const drifted = mutate(
      readDocument('PRIMITIVES.md'),
      '\n## Badge\n',
      '\n## Chip\n'
    );
    const problems = primitiveProblems(drifted, readPrimitivesSource());
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain(
      'PRIMITIVES.md has no "## Badge" section, and the kit hands every app a Badge'
    );
    expect(problems[1]).toContain(
      'PRIMITIVES.md documents "## Chip", which createPrimitiveKit does not hand to a bundle'
    );
  });
});

/* ------------------------------------------------------------------ */
/* The wiring control                                                  */
/* ------------------------------------------------------------------ */

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

describe('the pins read the documents that ship, not strings a test built', () => {
  /**
   * Every control above hands a drifted string straight to a pin. That proves
   * the pin fires on content, but not that the content it fires on comes from
   * a file. This one closes it: the four shipped documents are copied to a
   * temp directory, ONE of them drifts, the CLI's own resolver is pointed at
   * the copy, and the pin reads it the way it reads the real install.
   *
   * The shipped documents are never touched.
   */
  it('reads a mutated document off disk through the real resolver', () => {
    const root = mkdtempSync(join(tmpdir(), 'surface-doc-constants-'));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    const previous = process.env.TLON_SURFACE_SKILL_DIR;
    cleanups.push(() => {
      if (previous === undefined) delete process.env.TLON_SURFACE_SKILL_DIR;
      else process.env.TLON_SURFACE_SKILL_DIR = previous;
    });

    const originals = Object.fromEntries(
      DOCUMENTS.map((file) => [file, readDocument(file)])
    ) as Record<DocumentName, string>;

    for (const file of DOCUMENTS) {
      writeFileSync(
        join(root, file),
        file === 'PARADIGM.md'
          ? mutate(
              originals[file],
              `| snapshot state                  | ${kb(
                SURFACE_CAPS.snapshotState
              )}`,
              '| snapshot state                  | 64 KB'
            )
          : originals[file]
      );
    }
    process.env.TLON_SURFACE_SKILL_DIR = root;

    // Read back through `readSurfaceSkillDocument`, exactly as the shipping
    // assertions do.
    const problems = capsTableProblems(
      readDocument('PARADIGM.md'),
      CAP_EXPECTATIONS
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'caps table row "snapshot state" says "64 KB"'
    );

    const swept = kbSweepProblems(
      [{ file: 'PARADIGM.md', text: readDocument('PARADIGM.md') }],
      SURFACE_CAPS
    );
    expect(swept.problems).toHaveLength(1);
    expect(swept.problems[0]).toContain(
      'states "64 KB", which is not a cap this build enforces'
    );
  });
});

import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SURFACE_SUBCOMMANDS } from './commands/surface';
import { readSurfaceSkillDocument } from './surface-docs-runtime';

/**
 * Doctrine may not instruct a capability that does not exist.
 *
 * Session 6a's central failure was this class: `SKILL.md` told the authoring
 * loop to read the published `recipe` back before revising, for four
 * sessions, and no command returned it. The bot did as it was told, found
 * nothing, and regenerated from scratch every time. Nothing in the build
 * connected the sentence to the command registry, so nothing could notice.
 *
 * This test is that connection: every `surface <subcommand>` the skill's own
 * documents name must exist in `SURFACE_SUBCOMMANDS`.
 *
 * WHAT IT MATCHES — two shapes, both of which are unambiguously an
 * instruction to run something:
 *
 *   1. `tlon surface <sub>` anywhere in the text (backticked or not)
 *   2. a code span that opens on the command: `` `surface <sub>` ``
 *
 * WHAT IT DOES NOT MATCH, deliberately, and the blind spots that leaves:
 *
 *   - Prose using "surface" as the noun it also is: "the surface shows",
 *     "a surface has no links out", "edited surface posts". Requiring the
 *     `tlon ` prefix or an opening backtick is what separates a command from
 *     the subject of a sentence, and there is no cheaper separator: this
 *     doctrine is *about* surfaces, so bare `surface <word>` is far more
 *     often English than a command line.
 *   - A capability instructed WITHOUT naming a command at all. This is the
 *     honest limit, and it is the exact shape of the 6a failure: the
 *     offending sentence was "The generation context you publish rides along
 *     in the spec (`recipe`). On revision requests, read it back instead of
 *     re-deriving intent." — an instruction to perform a read, naming no
 *     subcommand. This test would NOT have caught it. It catches the
 *     neighbouring class (a named subcommand that does not exist), which is
 *     what a doc rewrite adding `tlon surface recipe` would have produced,
 *     and which no check covers today.
 *   - Flags. `surface publish --rubric <file>` is checked for `publish`
 *     only; whether the flag exists is not asked here.
 *   - Documents other than the two named below. `PRIMITIVES.md` and
 *     `RUBRIC.md` are catalogues rather than workflow, and `SKILL.md` +
 *     `PARADIGM.md` are what the loop is told to read.
 */

const SCANNED_DOCUMENTS = ['SKILL.md', 'PARADIGM.md'] as const;

const REFERENCE_PATTERN = /(?:\btlon surface|`surface)[ \t]+([a-z][a-z0-9-]*)/g;

type Reference = { document: string; line: number; subcommand: string };

export function extractSurfaceReferences(
  document: string,
  text: string
): Reference[] {
  const references: Reference[] = [];
  text.split('\n').forEach((content, index) => {
    for (const match of content.matchAll(REFERENCE_PATTERN)) {
      references.push({
        document,
        line: index + 1,
        subcommand: match[1],
      });
    }
  });
  return references;
}

export function unknownReferences(
  references: Reference[],
  registry: readonly string[]
): Reference[] {
  return references.filter(
    (reference) => !registry.includes(reference.subcommand)
  );
}

function describeReference(reference: Reference): string {
  return `${reference.document}:${reference.line} names "surface ${reference.subcommand}"`;
}

/** Reads the shipped documents through the same resolver the CLI uses. */
function readScannedDocuments(): Reference[] {
  return SCANNED_DOCUMENTS.flatMap((file) => {
    const read = readSurfaceSkillDocument(file);
    // A missing document would silently empty the scan, which is the exact
    // way this test would rot into a no-op. Fail on it instead.
    if (!read.ok) {
      throw new Error(
        `${file} is not readable (${read.reason}) at ${read.path}; the doc/command check cannot run.`
      );
    }
    return extractSurfaceReferences(file, read.text);
  });
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

describe('the surfaces skill may only instruct commands that exist', () => {
  it('resolves every `surface <subcommand>` the documents name', () => {
    const references = readScannedDocuments();
    const unknown = unknownReferences(references, SURFACE_SUBCOMMANDS);
    expect(unknown.map(describeReference)).toEqual([]);
  });

  // Non-vacuity. A regex that matched nothing would satisfy the assertion
  // above forever, so the scan's own yield is asserted: enough occurrences to
  // be a real scan, drawn from both documents, covering the subcommands the
  // authoring workflow actually turns on.
  it('finds a known-nonzero set of real references', () => {
    const references = readScannedDocuments();
    expect(references.length).toBeGreaterThanOrEqual(20);

    for (const file of SCANNED_DOCUMENTS) {
      expect(
        references.filter((reference) => reference.document === file).length
      ).toBeGreaterThan(0);
    }

    const named = new Set(references.map((reference) => reference.subcommand));
    for (const required of [
      'create',
      'lint',
      'publish',
      'preview',
      'show',
      'doctrine',
      'primitives',
      'rubric',
    ]) {
      expect([...named]).toContain(required);
    }
  });

  // The negative control, as a permanent test: a document naming a
  // subcommand that does not exist is reported, with its location. The
  // fulcrum is the document text — the registry is held fixed and only the
  // prose moves — so a passing run here means the checker fires on content,
  // not on some property of the real files.
  it('reports a fictitious subcommand, and says where it was named', () => {
    const text = [
      'Read the spec back with `tlon surface recipe <channel>` before revising.',
      'Then run `surface frobnicate` to finish.',
      'Publishing is still `tlon surface publish`.',
    ].join('\n');

    const unknown = unknownReferences(
      extractSurfaceReferences('FICTION.md', text),
      SURFACE_SUBCOMMANDS
    );

    expect(unknown.map(describeReference)).toEqual([
      'FICTION.md:1 names "surface recipe"',
      'FICTION.md:2 names "surface frobnicate"',
    ]);
  });

  // The same control through the real wiring: a document on disk, read by
  // the resolver the CLI uses, checked against the real registry. This is
  // what proves the assertion in the first test is connected to files at
  // all, rather than to a string a test built.
  it('fails the real scan when a real document on disk names a fiction', () => {
    const root = mkdtempSync(join(tmpdir(), 'surface-docs-'));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    const previous = process.env.TLON_SURFACE_SKILL_DIR;
    cleanups.push(() => {
      if (previous === undefined) delete process.env.TLON_SURFACE_SKILL_DIR;
      else process.env.TLON_SURFACE_SKILL_DIR = previous;
    });

    writeFileSync(
      join(root, 'SKILL.md'),
      'Revise by reading `tlon surface recipe <channel>` first.\n'
    );
    writeFileSync(
      join(root, 'PARADIGM.md'),
      'Publish with `tlon surface publish`.\n'
    );
    process.env.TLON_SURFACE_SKILL_DIR = root;

    const unknown = unknownReferences(
      readScannedDocuments(),
      SURFACE_SUBCOMMANDS
    );
    expect(unknown.map(describeReference)).toEqual([
      'SKILL.md:1 names "surface recipe"',
    ]);
  });

  // The documented blind spot, asserted so it stays documented: these are
  // the shapes the scan is blind to, and a future reader can see exactly
  // which sentences never reach the registry check.
  it('does not read prose or unnamed capabilities as commands', () => {
    const text = [
      'A surface is a channel that renders an app instead of messages.',
      'The surface shows "dashboard full": snapshot, prune, post again.',
      'The reducer skips edited surface posts.',
      'The generation context rides along in the spec (`recipe`). On revision',
      'requests, read it back instead of re-deriving intent.',
    ].join('\n');

    expect(extractSurfaceReferences('PROSE.md', text)).toEqual([]);
  });
});

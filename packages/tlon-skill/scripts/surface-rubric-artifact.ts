/**
 * The rubric artifact: the completed scoring sheet `surface publish` refuses
 * to publish without.
 *
 * Session 6a measured the thing this exists to make impossible. Across six
 * runs that reached preview, the model scored the rubric **zero times**: the
 * complete rubric output for four of them is four sentences, and the count of
 * capture cells actually opened was 3/12, 3/12, 0/12, 1/12, 1/12, 3/12. One
 * app shipped with no preview at all. `surface rubric` — the doctrine — was
 * run in three of those runs and changed nothing. The one run that repaired
 * against visual feedback did so because a tool handed it a list of concrete
 * defects. Doctrine that asks for self-assessment does not produce
 * self-assessment; a refusal does.
 *
 * ## Twelve cells or seven checks
 *
 * `RUBRIC.md` has seven checks. The capture matrix has twelve cells. They are
 * not the same twelve and the artifact carries BOTH, for a measured reason:
 *
 * - The number 6a recorded as the failure is **cells opened** — 3/12, 0/12.
 *   The model was not looking at the images. So the artifact forces one
 *   observation per capture cell: twelve entries, keyed by the exact file
 *   names preview wrote.
 * - Twelve captions are not a review. A finding becomes a repair only through
 *   the seven checks, so the artifact also carries seven verdicts — and each
 *   one must name the cell it was seen in, which is what cross-links the two
 *   halves without either being decorative.
 *
 * Nineteen short strings. That is the whole cost, and it is deliberate: an
 * artifact expensive to emit correctly gets emitted incorrectly, and then the
 * refusal is measuring the model's JSON rather than its attention.
 *
 * ## What this validator will and will not do
 *
 * **Completeness only.** Every check here is presence, membership in a fixed
 * enumeration, or identity binding. None of them reads a note and decides
 * whether it is any good, because a validator that tried would be gameable
 * (any keyword heuristic is one synonym away from useless) or wrong (it would
 * reject accurate short observations). Content quality is the model's job.
 * Existence and completeness are the tool's.
 *
 * The single structural exception is `allCellNotesIdentical`: twelve copies of
 * one string is ONE observation recorded twelve times, not twelve
 * observations, and detecting that requires comparing strings to each other
 * rather than judging any of them. A model that writes twelve DIFFERENT
 * useless sentences still passes. That is the honest boundary and it is stated
 * in the refusal text so nobody reads a passing artifact as a good one.
 *
 * ## The binding that does the real work
 *
 * `bundleSha256` names the exact bytes the artifact was scored against, and
 * publish refuses when it does not match the bundle being published. So a
 * rubric cannot be scored against revision 1 and spent on revision 3, and —
 * more importantly — the bytes MUST have been through preview, because
 * preview is what prints the hash into the template. A repair round changes
 * the bytes, which invalidates the artifact, which forces a re-preview and a
 * re-score. That is expensive on purpose; the alternative is the loop 6a
 * measured.
 */

/**
 * The twelve capture cells, in the order `previewMatrix` emits them
 * (viewport, then state, then theme) so the artifact reads in the same order
 * the report prints and the rubric tells you to look.
 *
 * These are the manifest's file names without `.png`. Duplicated here rather
 * than imported from `surface-preview.ts` on purpose: `surface publish` must
 * not pull in Playwright, the shell artifact strings or the reducer to
 * validate a text file. `surface-preview.test.ts` asserts the two agree, so
 * the duplication is checked rather than hoped for.
 */
export const RUBRIC_CELL_IDS = [
  'phone-initial-light',
  'phone-initial-dark',
  'phone-populated-light',
  'phone-populated-dark',
  'phone-full-initial-light',
  'phone-full-initial-dark',
  'phone-full-populated-light',
  'phone-full-populated-dark',
  'desktop-initial-light',
  'desktop-initial-dark',
  'desktop-populated-light',
  'desktop-populated-dark',
] as const;

export type RubricCellId = (typeof RUBRIC_CELL_IDS)[number];

/**
 * The seven checks, named for `RUBRIC.md`'s own headings and numbered as it
 * numbers them. The ids are the stable handle; the prose lives in the rubric
 * and is not repeated here, because two copies of a checklist drift.
 */
export const RUBRIC_CHECKS = [
  { id: 'overflow', number: 1, title: 'Nothing overflows the viewport' },
  { id: 'tap-targets', number: 2, title: 'Tap targets are reachable' },
  { id: 'themes', number: 3, title: 'Both themes are readable' },
  { id: 'empty-state', number: 4, title: 'The empty state explains itself' },
  {
    id: 'populated-scannable',
    number: 5,
    title: 'The populated state is scannable',
  },
  { id: 'no-jargon', number: 6, title: 'No mechanism vocabulary on screen' },
  {
    id: 'answers-the-request',
    number: 7,
    title: 'The screen is the thing that was asked for',
  },
] as const;

export const RUBRIC_CHECK_IDS = RUBRIC_CHECKS.map(
  (check) => check.id
) as readonly string[];

/**
 * The verdicts a check may carry.
 *
 * `fail` and `residual` are both publishable. `RUBRIC.md` says so explicitly —
 * after two repair rounds "publish anyway and say plainly what is still
 * wrong" — and a validator that refused them would push the model to write
 * `pass` over a known defect, which is worse than shipping the defect. Publish
 * echoes every non-`pass` verdict into its own output instead, so the residual
 * is on the record rather than laundered out of it (D99: an escape hatch
 * leaves an audit trail).
 */
export const RUBRIC_VERDICTS = [
  'pass',
  'fail',
  'repaired',
  'residual',
] as const;

export type RubricVerdict = (typeof RUBRIC_VERDICTS)[number];

export interface RubricCheckEntry {
  verdict: RubricVerdict;
  /** which capture cell the verdict was read off */
  cell: RubricCellId;
  note: string;
}

export interface RubricArtifact {
  version: 1;
  surfaceId: string;
  /** sha256 of the bundle these twelve cells were rendered from */
  bundleSha256: string;
  cells: Record<string, string>;
  checks: Record<string, RubricCheckEntry>;
}

export type RubricValidation =
  | { ok: true; artifact: RubricArtifact }
  | {
      ok: false;
      code: 'rubric-unreadable' | 'rubric-incomplete';
      problems: string[];
    };

const SHA256_HEX = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The pre-filled form `surface preview` writes next to the screenshots.
 *
 * Every key the validator requires is already here, in reading order, with the
 * identity fields filled in from the render that just happened. What is left
 * for the model is nineteen strings and seven verdicts — no schema to
 * remember, no hash to compute, no cell names to get right. The cheapest
 * correct emission is "open this file and fill in the blanks", so that is the
 * emission the tool asks for.
 */
export function buildRubricTemplate(input: {
  surfaceId: string;
  bundleSha256: string;
}): string {
  const cells: Record<string, string> = {};
  for (const cell of RUBRIC_CELL_IDS) {
    cells[cell] = '';
  }
  const checks: Record<string, RubricCheckEntry> = {};
  for (const check of RUBRIC_CHECKS) {
    checks[check.id] = {
      verdict: 'pass',
      cell: RUBRIC_CELL_IDS[0],
      note: '',
    };
  }
  const artifact: RubricArtifact = {
    version: 1,
    surfaceId: input.surfaceId,
    bundleSha256: input.bundleSha256,
    cells,
    checks,
  };
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

/**
 * Reads a rubric artifact and reports whether it is COMPLETE.
 *
 * The two failure codes are kept apart deliberately. `rubric-unreadable` means
 * the bytes are not a rubric at all — bad JSON, an array, a number. That is a
 * different repair (rewrite the file) from `rubric-incomplete`, which means
 * the shape is right and some of the work is missing (fill in these cells).
 * Collapsing them would make an incomplete artifact indistinguishable from a
 * typo, and then the test for "publish refuses an incomplete rubric" could
 * pass while only ever exercising the parser.
 */
export function validateRubricArtifact(raw: unknown): RubricValidation {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      code: 'rubric-unreadable',
      problems: [
        'the rubric file must contain a JSON object, and this is not one',
      ],
    };
  }

  const problems: string[] = [];

  if (raw.version !== 1) {
    problems.push(
      `"version" must be 1, and this says ${JSON.stringify(raw.version)}`
    );
  }
  if (!nonEmpty(raw.surfaceId)) {
    problems.push('"surfaceId" must be the id of the app that was scored');
  }
  if (
    typeof raw.bundleSha256 !== 'string' ||
    !SHA256_HEX.test(raw.bundleSha256)
  ) {
    problems.push(
      '"bundleSha256" must be the 64-character hash preview printed for the bundle these captures were rendered from'
    );
  }

  const cellValues: string[] = [];
  const cells = raw.cells;
  if (!isPlainObject(cells)) {
    problems.push('"cells" must be an object with one entry per capture cell');
  } else {
    const missing = RUBRIC_CELL_IDS.filter((id) => !nonEmpty(cells[id]));
    const extra = Object.keys(cells).filter(
      (key) => !(RUBRIC_CELL_IDS as readonly string[]).includes(key)
    );
    if (missing.length > 0) {
      problems.push(
        `${missing.length} of the twelve capture cells have no observation: ${missing.join(', ')}`
      );
    }
    if (extra.length > 0) {
      problems.push(
        `"cells" names ${extra.length} thing(s) that are not capture cells: ${extra.join(', ')}`
      );
    }
    for (const id of RUBRIC_CELL_IDS) {
      const value = cells[id];
      if (nonEmpty(value)) cellValues.push(value.trim());
    }
  }

  // The one structural anti-degeneracy check. Twelve copies of "ok" is one
  // observation written down twelve times; comparing the strings to each
  // other says so without judging any of them. Twelve DIFFERENT weak
  // sentences still pass, and the refusal text says as much.
  if (
    cellValues.length === RUBRIC_CELL_IDS.length &&
    new Set(cellValues).size === 1
  ) {
    problems.push(
      'all twelve cell observations are the same string, which is one observation recorded twelve times rather than twelve cells looked at'
    );
  }

  if (!isPlainObject(raw.checks)) {
    problems.push('"checks" must be an object with one entry per rubric check');
  } else {
    const extra = Object.keys(raw.checks).filter(
      (key) => !RUBRIC_CHECK_IDS.includes(key)
    );
    if (extra.length > 0) {
      problems.push(
        `"checks" names ${extra.length} thing(s) that are not rubric checks: ${extra.join(', ')}`
      );
    }
    for (const check of RUBRIC_CHECKS) {
      const entry = raw.checks[check.id];
      if (!isPlainObject(entry)) {
        problems.push(
          `check ${check.number} (${check.id}) — "${check.title}" — was not scored`
        );
        continue;
      }
      if (
        typeof entry.verdict !== 'string' ||
        !(RUBRIC_VERDICTS as readonly string[]).includes(entry.verdict)
      ) {
        problems.push(
          `check ${check.number} (${check.id}) needs a "verdict" of ${RUBRIC_VERDICTS.join(', ')}`
        );
      }
      if (
        typeof entry.cell !== 'string' ||
        !(RUBRIC_CELL_IDS as readonly string[]).includes(entry.cell)
      ) {
        problems.push(
          `check ${check.number} (${check.id}) needs a "cell" naming the capture it was scored on`
        );
      }
      if (!nonEmpty(entry.note)) {
        problems.push(
          `check ${check.number} (${check.id}) needs a "note" saying what you saw`
        );
      }
    }
  }

  if (problems.length > 0) {
    return { ok: false, code: 'rubric-incomplete', problems };
  }
  return { ok: true, artifact: raw as unknown as RubricArtifact };
}

/** The non-`pass` verdicts, for publish's audit trail. */
export function rubricResiduals(
  artifact: RubricArtifact
): { id: string; number: number; verdict: RubricVerdict; note: string }[] {
  const residuals: {
    id: string;
    number: number;
    verdict: RubricVerdict;
    note: string;
  }[] = [];
  for (const check of RUBRIC_CHECKS) {
    const entry = artifact.checks[check.id];
    if (entry && entry.verdict !== 'pass') {
      residuals.push({
        id: check.id,
        number: check.number,
        verdict: entry.verdict,
        note: entry.note,
      });
    }
  }
  return residuals;
}

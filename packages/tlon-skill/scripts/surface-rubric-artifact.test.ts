import { describe, expect, it } from 'bun:test';

import {
  RUBRIC_CELL_IDS,
  RUBRIC_CHECKS,
  RUBRIC_CHECK_IDS,
  RUBRIC_VERDICTS,
  UNCONDITIONAL_RUBRIC_CHECKS,
  applicableRubricChecks,
  buildRubricTemplate,
  rubricResiduals,
  validateRubricArtifact,
} from './surface-rubric-artifact';

const SHA = 'c'.repeat(64);

/**
 * A complete sheet. Twelve distinguishable observations and seven scored
 * checks — the state a model reaches by filling in the template preview wrote.
 */
function complete(): Record<string, unknown> {
  const cells: Record<string, string> = {};
  for (const id of RUBRIC_CELL_IDS) {
    cells[id] = `${id}: the card fits, the copy reads as the group's own`;
  }
  const checks: Record<string, unknown> = {};
  for (const check of RUBRIC_CHECKS) {
    checks[check.id] = {
      verdict: 'pass',
      cell: RUBRIC_CELL_IDS[0],
      note: `${check.title} — scored`,
    };
  }
  return {
    version: 1,
    surfaceId: 'srf-climb',
    bundleSha256: SHA,
    cells,
    checks,
  };
}

describe('the twelve and the seven', () => {
  it('carries twelve capture cells and seven universal rubric checks', () => {
    // The resolution, asserted rather than described: the artifact is not
    // twelve OR seven, it is twelve cell observations cross-linked to seven
    // check verdicts. 6a measured the failure as cells never opened; a repair
    // only ever comes out of a check.
    expect(RUBRIC_CELL_IDS).toHaveLength(12);
    expect(new Set(RUBRIC_CELL_IDS).size).toBe(12);
    expect(UNCONDITIONAL_RUBRIC_CHECKS).toHaveLength(7);
    expect(UNCONDITIONAL_RUBRIC_CHECKS.map((check) => check.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  /**
   * The eighth check is conditional, and that is the whole design.
   *
   * A check every sheet must answer becomes a check every sheet answers the
   * same way — check 7 is the proof, having passed an expense split nobody
   * could add an expense to. Check 8 exists only for a spec that has claimed
   * to be display-only, and its subject is that claim's own sentence.
   */
  it('adds the display-only check only for a spec that declares itself one', () => {
    expect(RUBRIC_CHECKS).toHaveLength(8);
    expect(applicableRubricChecks({ actions: {} })).toEqual(
      UNCONDITIONAL_RUBRIC_CHECKS
    );
    expect(applicableRubricChecks(undefined)).toEqual(
      UNCONDITIONAL_RUBRIC_CHECKS
    );
    const declared = applicableRubricChecks({
      actions: {},
      memberInteraction: {
        mode: 'none',
        because: 'the bot posts the rollover',
      },
    });
    expect(declared.map((check) => check.id)).toContain(
      'display-only-was-asked-for'
    );
    expect(declared).toHaveLength(8);
  });

  it('requires every check to cite one of the twelve cells', () => {
    const artifact = complete();
    (artifact.checks as Record<string, Record<string, unknown>>)[
      'overflow'
    ].cell = 'phone-sideways-mauve';
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('rubric-incomplete');
    expect(result.ok === false && result.problems.join(' ')).toContain(
      'needs a "cell" naming the capture it was scored on'
    );
  });
});

describe('buildRubricTemplate', () => {
  it('emits every key the validator requires, pre-stamped with identity', () => {
    const template = JSON.parse(
      buildRubricTemplate({ surfaceId: 'srf-climb', bundleSha256: SHA })
    );
    expect(Object.keys(template.cells)).toEqual([...RUBRIC_CELL_IDS]);
    expect(Object.keys(template.checks)).toEqual(
      UNCONDITIONAL_RUBRIC_CHECKS.map((check) => check.id)
    );
    expect(template.surfaceId).toBe('srf-climb');
    expect(template.bundleSha256).toBe(SHA);
  });

  it('carries the display-only check when the spec declares one', () => {
    // The forcing function has to land where the author is already filling in
    // blanks. A check that first appears at publish time is a check discovered
    // after the work it was meant to shape.
    const template = JSON.parse(
      buildRubricTemplate({
        surfaceId: 'srf-countdown',
        bundleSha256: SHA,
        spec: {
          actions: {},
          memberInteraction: {
            mode: 'none',
            because: 'the launch date is fixed at creation',
          },
        },
      })
    );
    expect(Object.keys(template.checks)).toContain(
      'display-only-was-asked-for'
    );
  });

  it('is INCOMPLETE as emitted — the blanks are the work', () => {
    // If the template validated as-is, publish would accept an unfilled form
    // and the whole mechanism would be a formality. This is the assertion that
    // says the form has to be filled in.
    const result = validateRubricArtifact(
      JSON.parse(
        buildRubricTemplate({ surfaceId: 'srf-climb', bundleSha256: SHA })
      )
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('rubric-incomplete');
    expect(result.ok === false && result.problems[0]).toContain(
      '12 of the twelve capture cells have no observation'
    );
  });
});

/**
 * The publish-refusal control, at the validator.
 *
 * **The fulcrum is the number of filled entries in `cells` and `checks`.** In
 * this test's world the only thing that can move it is the fixture, and both
 * arms are built from the SAME `complete()` fixture — the incomplete arm is
 * that object with three cell strings emptied and nothing else touched.
 *
 * That construction is the point. An incomplete artifact that was also
 * malformed would let the refusal pass while only ever exercising
 * `JSON.parse`, and the guard would look identical whether it checked
 * completeness or not.
 */
describe('validateRubricArtifact — incomplete, not malformed', () => {
  it('accepts a complete sheet', () => {
    expect(validateRubricArtifact(complete()).ok).toBe(true);
  });

  it('refuses a sheet with three cells left blank, and names them', () => {
    const artifact = complete();
    const cells = artifact.cells as Record<string, string>;
    cells['phone-populated-dark'] = '';
    cells['desktop-initial-light'] = '';
    cells['phone-full-populated-light'] = '   ';

    // The arms differ ONLY at the fulcrum: same JSON, same shape, same keys.
    expect(JSON.parse(JSON.stringify(artifact))).toBeTruthy();
    expect(Object.keys(artifact.cells as object)).toEqual([...RUBRIC_CELL_IDS]);
    expect(
      validateRubricArtifact({ ...artifact, cells: complete().cells }).ok
    ).toBe(true);

    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('rubric-incomplete');
    const problems = result.ok === false ? result.problems.join(' ') : '';
    expect(problems).toContain('3 of the twelve capture cells');
    expect(problems).toContain('phone-populated-dark');
    expect(problems).toContain('desktop-initial-light');
    expect(problems).toContain('phone-full-populated-light');
  });

  it('refuses a sheet with a check left unscored, and names the check', () => {
    const artifact = complete();
    delete (artifact.checks as Record<string, unknown>)['no-jargon'];
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems.join(' ')).toContain(
      'check 6 (no-jargon) — "No mechanism vocabulary on screen" — was not scored'
    );
  });

  it('refuses a verdict outside the enumeration', () => {
    const artifact = complete();
    (artifact.checks as Record<string, Record<string, unknown>>)[
      'themes'
    ].verdict = 'looks fine';
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems.join(' ')).toContain(
      `check 3 (themes) needs a "verdict" of ${RUBRIC_VERDICTS.join(', ')}`
    );
  });

  it('separates "not a rubric" from "an unfinished rubric"', () => {
    // Two different repairs, so two different codes. Collapsing them is how a
    // completeness guard ends up being a parser test.
    for (const notARubric of [null, 42, 'a string', ['an', 'array']]) {
      const result = validateRubricArtifact(notARubric);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBe('rubric-unreadable');
    }
  });
});

describe('validateRubricArtifact — what it deliberately does not judge', () => {
  it('accepts twelve short, weak, DIFFERENT observations', () => {
    // The honest boundary, pinned so nobody later reads a passing artifact as
    // a good one. Any heuristic that tried to score these would be one synonym
    // from useless or would reject accurate short notes.
    const artifact = complete();
    const cells = artifact.cells as Record<string, string>;
    RUBRIC_CELL_IDS.forEach((id, index) => {
      cells[id] = `ok ${index}`;
    });
    expect(validateRubricArtifact(artifact).ok).toBe(true);
  });

  it('refuses twelve copies of ONE observation', () => {
    // The single structural exception, and the reason it is defensible: it
    // compares the strings to each other rather than judging any of them.
    const artifact = complete();
    const cells = artifact.cells as Record<string, string>;
    for (const id of RUBRIC_CELL_IDS) {
      cells[id] = 'looks good';
    }
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems.join(' ')).toContain(
      'one observation recorded twelve times rather than twelve cells looked at'
    );
  });

  it('publishes a residual rather than forcing it to be written as a pass', () => {
    // RUBRIC.md: after two repair rounds, publish anyway and say plainly what
    // is still wrong. A validator that refused `residual` would teach the
    // model to write `pass` over a known defect.
    const artifact = complete();
    (artifact.checks as Record<string, Record<string, unknown>>)[
      'tap-targets'
    ] = {
      verdict: 'residual',
      cell: 'phone-populated-dark',
      note: 'the two vote buttons still touch on a 390px phone',
    };
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(true);
    expect(result.ok === true && rubricResiduals(result.artifact)).toEqual([
      {
        id: 'tap-targets',
        number: 2,
        verdict: 'residual',
        note: 'the two vote buttons still touch on a 390px phone',
      },
    ]);
  });

  it('reports no residuals when every check passed', () => {
    const result = validateRubricArtifact(complete());
    expect(result.ok === true && rubricResiduals(result.artifact)).toEqual([]);
  });
});

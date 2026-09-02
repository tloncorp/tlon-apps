import { describe, expect, it } from 'bun:test';

import {
  POPULATED_CITED_CHECK,
  REACHABILITY_CITED_CHECK,
  RUBRIC_CELL_IDS,
  RUBRIC_CHECKS,
  RUBRIC_CHECK_IDS,
  RUBRIC_POPULATED_MARKERS,
  RUBRIC_REACHABILITY_MARKERS,
  RUBRIC_VERDICTS,
  UNCONDITIONAL_RUBRIC_CHECKS,
  applicableRubricChecks,
  buildRubricTemplate,
  populatedCitation,
  reachabilityCitation,
  rubricResiduals,
  surfaceCanonicalHash,
  validateRubricArtifact,
} from './surface-rubric-artifact';

const SHA = 'c'.repeat(64);

/** The spec every sheet in this file is scored under. */
const SPEC = {
  surfaceId: 'srf-climb',
  actions: {},
  title: 'Climb',
  initialState: { routes: [] },
};

/** A board the app does not open on — what `--state` would substitute. */
const SUPPLIED_STATE = { routes: [{ grade: 'V4', sent: true }] };

/** A closed walk that found nothing — the ordinary case. */
const CLEAN_WALK = {
  closed: true,
  nodeCount: 6,
  truncatedBy: [],
  shortfalls: [],
  findings: [],
};

/** An ordinary fold: two actions, six invokes, nothing exotic. */
const PLAIN_FOLD = {
  unchanged: false,
  invokes: [
    { actionId: 'send' },
    { actionId: 'project' },
    { actionId: 'send' },
    { actionId: 'project' },
    { actionId: 'send' },
    { actionId: 'project' },
  ],
  hostOps: [],
  restoredAfterDestructive: false,
};

/** The three ships every fold is made as. */
const CREW = ['~zod', '~ten', '~palfun-foslup'];

/** The fold as `buildRubricTemplate` takes it. */
const PLAIN_POPULATED = { fold: PLAIN_FOLD, actors: CREW };

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
      // Preview stamps this on check 7 and the validator requires it there.
      // Built from the same helper the template writer uses, so a fixture
      // cannot satisfy a marker rule the real writer would fail.
      ...(check.id === REACHABILITY_CITED_CHECK
        ? { reachability: reachabilityCitation(CLEAN_WALK) }
        : {}),
      // Preview stamps this on check 5 and the validator requires it there, on
      // exactly the terms above.
      ...(check.id === POPULATED_CITED_CHECK
        ? {
            populated: populatedCitation(PLAIN_FOLD, {
              actors: CREW,
              stateSource: 'spec-initial-state',
            }),
          }
        : {}),
    };
  }
  return {
    version: 1,
    surfaceId: 'srf-climb',
    bundleSha256: SHA,
    specSha256: surfaceCanonicalHash(SPEC),
    stateSource: 'spec-initial-state',
    stateSha256: surfaceCanonicalHash(SPEC.initialState),
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
      buildRubricTemplate({
        surfaceId: 'srf-climb',
        bundleSha256: SHA,
        spec: SPEC,
        reachability: CLEAN_WALK,
        populated: PLAIN_POPULATED,
      })
    );
    expect(Object.keys(template.cells)).toEqual([...RUBRIC_CELL_IDS]);
    expect(Object.keys(template.checks)).toEqual(
      UNCONDITIONAL_RUBRIC_CHECKS.map((check) => check.id)
    );
    expect(template.surfaceId).toBe('srf-climb');
    expect(template.bundleSha256).toBe(SHA);
    // Both halves of the identity, stamped by the writer. Publish can only
    // compare a spec hash the sheet actually carries, so if preview stopped
    // writing one the binding would fail open at the reader.
    expect(template.specSha256).toBe(surfaceCanonicalHash(SPEC));
    // The third half of the identity: with no `--state`, the cells opened on
    // the spec's own starting point and the sheet says so.
    expect(template.stateSource).toBe('spec-initial-state');
    expect(template.stateSha256).toBe(surfaceCanonicalHash(SPEC.initialState));
  });

  it('records the substituted state when --state stood in', () => {
    // Preview says this on stdout already. Until it said it here, publish had
    // no way to tell a `--state` sheet from an ordinary one.
    const template = JSON.parse(
      buildRubricTemplate({
        surfaceId: 'srf-climb',
        bundleSha256: SHA,
        spec: SPEC,
        stateOverride: SUPPLIED_STATE,
        reachability: CLEAN_WALK,
        populated: PLAIN_POPULATED,
      })
    );
    expect(template.stateSource).toBe('override');
    expect(template.stateSha256).toBe(surfaceCanonicalHash(SUPPLIED_STATE));
    expect(template.stateSha256).not.toBe(
      surfaceCanonicalHash(SPEC.initialState)
    );
    // The spec half is untouched by the substitution — same definition, other
    // board. If these moved together the state hash would be redundant.
    expect(template.specSha256).toBe(surfaceCanonicalHash(SPEC));
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
        reachability: CLEAN_WALK,
        populated: PLAIN_POPULATED,
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
        buildRubricTemplate({
          surfaceId: 'srf-climb',
          bundleSha256: SHA,
          spec: SPEC,
          reachability: CLEAN_WALK,
          populated: PLAIN_POPULATED,
          populated: PLAIN_POPULATED,
        })
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

/**
 * The second binding, at the validator: a sheet that names no spec is not a
 * completed sheet.
 *
 * This is the compatibility decision, written as a test rather than as a
 * comment. Every sheet written before the field existed lacks it, and the
 * lenient reading — accept it, warn — would hand all of them, and anyone who
 * deletes one line, a permanent pass on the spec binding. A guard whose bypass
 * is `delete sheet.specSha256` is exactly the vacuously satisfiable guard this
 * codebase keeps rediscovering. So: refused, with the remedy in the message.
 */
describe('validateRubricArtifact — the identity bindings are not optional', () => {
  it('refuses a sheet with no specSha256 at all, and says how to get one', () => {
    const artifact = complete();
    delete artifact.specSha256;
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('rubric-incomplete');
    const problems = result.ok === false ? result.problems.join(' ') : '';
    expect(problems).toContain('"specSha256"');
    expect(problems).toContain('`surface preview`');
  });

  it('refuses a specSha256 that is not a hash', () => {
    for (const bogus of ['', 'not-a-hash', 'C'.repeat(64), 'a'.repeat(63)]) {
      const artifact = complete();
      artifact.specSha256 = bogus;
      const result = validateRubricArtifact(artifact);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.problems.join(' ')).toContain(
        '"specSha256"'
      );
    }
  });

  it('accepts the same sheet once the field is back', () => {
    // The other arm, from the SAME fixture: if the refusals above fired for
    // any reason other than the missing field, this would refuse too.
    expect(validateRubricArtifact(complete()).ok).toBe(true);
  });

  it('refuses a sheet with no state provenance, and says how to get it', () => {
    // Same stance, same reason, one level down. A sheet that does not say
    // which board its captures opened on cannot be told from one that opened
    // on the app's own.
    for (const field of ['stateSource', 'stateSha256']) {
      const artifact = complete();
      delete artifact[field];
      const result = validateRubricArtifact(artifact);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBe('rubric-incomplete');
      expect(result.ok === false && result.problems.join(' ')).toContain(
        `"${field}"`
      );
    }
  });

  it('refuses a stateSource outside the two the manifest uses', () => {
    const artifact = complete();
    artifact.stateSource = 'whatever-was-lying-around';
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems.join(' ')).toContain(
      '"stateSource" must be spec-initial-state or override'
    );
  });

  it('refuses a stateSha256 that is not a hash', () => {
    const artifact = complete();
    artifact.stateSha256 = 'not-a-hash';
    const result = validateRubricArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems.join(' ')).toContain(
      '"stateSha256"'
    );
  });
});

/**
 * What `surfaceCanonicalHash` can and cannot see.
 *
 * Two properties, and the binding needs both. It must move for every change
 * that reaches a reader — otherwise it is the bundle hash again, blind in the
 * same place. It must NOT move for a difference that cannot reach a reader —
 * otherwise re-indenting a spec file invalidates a sheet, and a guard that
 * refuses correct work is a guard people route around.
 */
describe('surfaceCanonicalHash', () => {
  it('is blind to key order and to whitespace, which a JSON round trip erases', () => {
    const spec = { b: 2, a: 1, nested: { y: true, x: [1, 2, 3] } };
    const reordered = { nested: { x: [1, 2, 3], y: true }, a: 1, b: 2 };
    expect(surfaceCanonicalHash(reordered)).toBe(surfaceCanonicalHash(spec));
    expect(
      surfaceCanonicalHash(JSON.parse(JSON.stringify(spec, null, 2)))
    ).toBe(surfaceCanonicalHash(spec));
  });

  it('moves for every spec change a reader could see', () => {
    const base = surfaceCanonicalHash(SPEC);
    for (const changed of [
      { ...SPEC, title: 'Climb, renamed' },
      { ...SPEC, initialState: { climbs: [] } },
      {
        ...SPEC,
        memberInteraction: { mode: 'none', because: 'the bot posts' },
      },
      { ...SPEC, bundle: { shellVersion: 2 } },
      // Array ORDER is meaning, unlike key order.
      { ...SPEC, order: ['a', 'b'] },
    ]) {
      expect(surfaceCanonicalHash(changed)).not.toBe(base);
    }
    expect(surfaceCanonicalHash({ ...SPEC, order: ['b', 'a'] })).not.toBe(
      surfaceCanonicalHash({ ...SPEC, order: ['a', 'b'] })
    );
  });

  it('moves for a change confined to a key no schema declares', () => {
    // The discriminator. `SurfaceSpecSchema` is a `z.object` and strips what it
    // does not declare, so a hash taken over the validated view would be equal
    // here — and undeclared keys are exactly where the gate's opt-out markers
    // have twice been found. `surface-publish.test.ts` runs the same assertion
    // against the REAL schema; this one pins the raw side of it.
    expect(
      surfaceCanonicalHash({ ...SPEC, 'x-nothing-declares-this': 'present' })
    ).not.toBe(surfaceCanonicalHash(SPEC));
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

/**
 * Check 7's machine stamp.
 *
 * The reason it exists is D140: "the screen is the thing that was asked for"
 * has passed three real defects, every one of them about what happens when you
 * PRESS something, and it is scored from stills. Preview now walks the
 * reachable screens and writes what it found onto this check, so the verdict is
 * scored against a line rather than against a picture.
 */
describe('the reachability citation on check 7', () => {
  it('names a real check, and it is number 7', () => {
    // The id is a duplicated string, so it is pinned rather than trusted —
    // the same discipline `RUBRIC_CELL_IDS` gets against `previewMatrix`.
    expect(RUBRIC_CHECK_IDS).toContain(REACHABILITY_CITED_CHECK);
    expect(
      RUBRIC_CHECKS.find((check) => check.id === REACHABILITY_CITED_CHECK)
        ?.number
    ).toBe(7);
  });

  it('is stamped on check 7 and on nothing else', () => {
    const template = JSON.parse(
      buildRubricTemplate({
        surfaceId: 'srf-climb',
        bundleSha256: SHA,
        spec: SPEC,
        reachability: CLEAN_WALK,
        populated: PLAIN_POPULATED,
      })
    );
    const checks = template.checks as Record<string, Record<string, unknown>>;
    expect(checks[REACHABILITY_CITED_CHECK].reachability).toContain(
      'measured:'
    );
    for (const [id, entry] of Object.entries(checks)) {
      if (id === REACHABILITY_CITED_CHECK) continue;
      expect(entry.reachability).toBeUndefined();
    }
  });

  it('keeps "measured, found nothing" and "not measured" apart', () => {
    // The whole point of the field, and the same distinction the walk itself
    // makes. A truncated walk reporting what a clean one reports would be this
    // session's own defect committed in the sheet that records catching it.
    const clean = reachabilityCitation(CLEAN_WALK);
    const truncated = reachabilityCitation({
      closed: false,
      nodeCount: 6000,
      truncatedBy: ['the 30000-transition budget ran out'],
      shortfalls: [],
      findings: [],
    });
    expect(clean.startsWith('measured:')).toBe(true);
    expect(truncated.startsWith('not measured:')).toBe(true);
    expect(truncated.startsWith('measured:')).toBe(false);
    expect(truncated).toContain('30000-transition budget');
    expect(truncated).toContain('a path it never took could contradict');
  });

  it('treats a control it could not press as not measured, like a spent bound', () => {
    // A shortfall is a missing EDGE, which is the one thing the dominance
    // argument cannot survive — so it disarms the citation exactly as a
    // truncation does, and the sheet must not report the two differently.
    const citation = reachabilityCitation({
      closed: false,
      nodeCount: 12,
      truncatedBy: [],
      shortfalls: ['2 press(es) invoked more than one action at once'],
      findings: [],
    });
    expect(citation.startsWith('not measured:')).toBe(true);
    expect(citation).toContain('invoked more than one action at once');
  });

  it('says so, differently again, when the walk never ran', () => {
    const citation = reachabilityCitation({
      problem: 'the bundle could not be evaluated as a plain script',
      closed: false,
      nodeCount: 0,
      truncatedBy: [],
      shortfalls: [],
      findings: [],
    });
    expect(citation.startsWith('not walked:')).toBe(true);
    expect(citation).toContain('could not be evaluated');
  });

  it('carries the findings themselves when the walk closed on some', () => {
    const citation = reachabilityCitation({
      closed: true,
      nodeCount: 4096,
      truncatedBy: [],
      shortfalls: [],
      findings: [
        { message: '"done" at /tasks/*/status is reachable only through' },
      ],
    });
    expect(citation.startsWith('measured:')).toBe(true);
    expect(citation).toContain('1 finding(s)');
    expect(citation).toContain('/tasks/*/status');
  });

  it('every shape it emits satisfies the validator that requires it', () => {
    // The builder and the marker list are in one file precisely so they cannot
    // drift; this is the assertion that says so, over every branch.
    const walks = [
      CLEAN_WALK,
      { ...CLEAN_WALK, findings: [{ message: 'a finding' }] },
      { ...CLEAN_WALK, closed: false, truncatedBy: ['a bound ran out'] },
      { ...CLEAN_WALK, closed: false, shortfalls: ['a control was unpressed'] },
      { ...CLEAN_WALK, problem: 'the shell refused it' },
    ];
    for (const walk of walks) {
      const citation = reachabilityCitation(walk);
      expect(
        RUBRIC_REACHABILITY_MARKERS.some((marker) =>
          citation.startsWith(marker)
        )
      ).toBe(true);
      const sheet = complete();
      (sheet.checks as Record<string, Record<string, unknown>>)[
        REACHABILITY_CITED_CHECK
      ].reachability = citation;
      expect(validateRubricArtifact(sheet).ok).toBe(true);
    }
  });

  it('refuses a sheet whose check-7 citation was deleted, and accepts the same sheet with it', () => {
    // Both directions off ONE fixture, so the fulcrum is the field and nothing
    // else. Satisfiable-by-omission is the hole `stateSha256` closed and this
    // closes again: "nothing to report" and "the line was deleted" must not be
    // the same shape.
    const withIt = complete();
    expect(validateRubricArtifact(withIt).ok).toBe(true);

    const without = complete();
    delete (without.checks as Record<string, Record<string, unknown>>)[
      REACHABILITY_CITED_CHECK
    ].reachability;
    const result = validateRubricArtifact(without);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('rubric-incomplete');
    expect(result.ok === false && result.problems.join(' ')).toContain(
      'needs the "reachability" line'
    );
  });

  it('refuses a citation that did not come from preview', () => {
    const sheet = complete();
    (sheet.checks as Record<string, Record<string, unknown>>)[
      REACHABILITY_CITED_CHECK
    ].reachability = 'looks reachable to me';
    const result = validateRubricArtifact(sheet);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems.join(' ')).toContain(
      'did not come from'
    );
  });

  it('requires it on check 7 only — the other checks may carry nothing', () => {
    const sheet = complete();
    const checks = sheet.checks as Record<string, Record<string, unknown>>;
    for (const id of Object.keys(checks)) {
      if (id !== REACHABILITY_CITED_CHECK) delete checks[id].reachability;
    }
    expect(validateRubricArtifact(sheet).ok).toBe(true);
  });
});

/**
 * The `populated` citation on check 5.
 *
 * The reason it exists is D167 and a measurement. Check 5's whole subject is
 * the `populated` captures, and those captures are `foldPopulatedState`'s
 * output: every declared action handed to every one of three invented ships.
 * Six of the nine shipped templates produce a board no group could plausibly
 * reach — the potluck sheet reads "Dessert 4 of 3" over "10 more wanted", the
 * RSVP reads a headline "0 Coming" with all three members on "Can't make it" —
 * and a careful reader who had already read the caveat in `RUBRIC.md` and in
 * preview's own did-NOT-check list still scored those numbers as the app's and
 * filed the templates as defective. Prose where the reader will see it did not
 * work, so the line is stamped into the sheet they are filling in.
 */
describe('the populated citation on check 5', () => {
  it('names a real check, and it is number 5', () => {
    // A duplicated string, pinned rather than trusted — the same discipline
    // `REACHABILITY_CITED_CHECK` and `RUBRIC_CELL_IDS` get.
    expect(RUBRIC_CHECK_IDS).toContain(POPULATED_CITED_CHECK);
    expect(
      RUBRIC_CHECKS.find((check) => check.id === POPULATED_CITED_CHECK)?.number
    ).toBe(5);
  });

  it('is stamped on check 5 and on nothing else', () => {
    const template = JSON.parse(
      buildRubricTemplate({
        surfaceId: 'srf-climb',
        bundleSha256: SHA,
        spec: SPEC,
        reachability: CLEAN_WALK,
        populated: PLAIN_POPULATED,
      })
    );
    const checks = template.checks as Record<string, Record<string, unknown>>;
    expect(checks[POPULATED_CITED_CHECK].populated).toContain('folded:');
    for (const [id, entry] of Object.entries(checks)) {
      if (id === POPULATED_CITED_CHECK) continue;
      expect(entry.populated).toBeUndefined();
    }
  });

  it("says the board is the harness's, and what the cells can still be scored for", () => {
    const citation = populatedCitation(PLAIN_FOLD, {
      actors: CREW,
      stateSource: 'spec-initial-state',
    });
    expect(citation.startsWith('folded:')).toBe(true);
    // The counts come off the fold itself, so the sheet cannot name a fold that
    // did not happen: six invokes over two distinct actions.
    expect(citation).toContain('6 invoke(s) of all 2 declared action(s)');
    expect(citation).toContain('~zod, ~ten, ~palfun-foslup');
    expect(citation).toContain('No group produced this board');
    // The half that survives: layout is scorable off a synthetic board, the
    // numbers are not.
    expect(citation).toContain('Score the LAYOUT');
    expect(citation).toContain('take no number');
  });

  it("keeps a fold over a SUPPLIED board apart from a fold over the app's own", () => {
    // The distinction is the point, and it is the run the shipped templates are
    // reviewed with: `--state` puts a realistic board underneath, and then the
    // fold overwrites every supplied member sharing a name with the synthetic
    // crew. That is how the potluck's "~zod bringing mains" became "~zod
    // bringing dessert" and the sheet read "Dessert 4 of 3".
    const plain = populatedCitation(PLAIN_FOLD, {
      actors: CREW,
      stateSource: 'spec-initial-state',
    });
    const supplied = populatedCitation(PLAIN_FOLD, {
      actors: CREW,
      stateSource: 'override',
    });
    expect(plain.startsWith('folded:')).toBe(true);
    expect(supplied.startsWith('folded onto a supplied state:')).toBe(true);
    expect(supplied.startsWith('folded:')).toBe(false);
    expect(supplied).toContain('had their entry overwritten');
    expect(plain).not.toContain('overwritten');
  });

  it('says so, differently again, when nothing was folded at all', () => {
    const citation = populatedCitation(
      {
        problem:
          'the spec declares no actions and no host ops were supplied, so nothing can populate it',
        unchanged: true,
        invokes: [],
        hostOps: [],
        restoredAfterDestructive: false,
      },
      { actors: CREW, stateSource: 'spec-initial-state' }
    );
    expect(citation.startsWith('not folded:')).toBe(true);
    expect(citation).toContain('the spec declares no actions');
    expect(citation).toContain('the populated captures are the initial ones');
  });

  it("attributes the restore pass's extra invokes to the tool", () => {
    // Those invokes are not the app's doing, and a scorer counting members
    // against the invoke list would otherwise read them as the spec's.
    const citation = populatedCitation(
      { ...PLAIN_FOLD, restoredAfterDestructive: true },
      { actors: CREW, stateSource: 'spec-initial-state' }
    );
    expect(citation).toContain('a restore pass replayed every constructive');
    expect(
      populatedCitation(PLAIN_FOLD, {
        actors: CREW,
        stateSource: 'spec-initial-state',
      })
    ).not.toContain('restore pass');
  });

  it('says when the fold changed nothing, and when host events were folded', () => {
    const unchanged = populatedCitation(
      { ...PLAIN_FOLD, unchanged: true },
      { actors: CREW, stateSource: 'spec-initial-state' }
    );
    expect(unchanged).toContain(
      'these captures are the same screen as the initial ones'
    );
    const withHostOps = populatedCitation(
      { ...PLAIN_FOLD, hostOps: [{ at: 'before' }, { at: 'after' }] },
      { actors: CREW, stateSource: 'spec-initial-state' }
    );
    expect(withHostOps).toContain('2 supplied host event(s)');
  });

  it('every shape it emits satisfies the validator that requires it', () => {
    // The builder and the marker list are in one file precisely so they cannot
    // drift; this is the assertion that says so, over every branch.
    const folds = [
      PLAIN_FOLD,
      { ...PLAIN_FOLD, unchanged: true },
      { ...PLAIN_FOLD, restoredAfterDestructive: true },
      { ...PLAIN_FOLD, hostOps: [{ at: 'after' as const }] },
      { ...PLAIN_FOLD, problem: 'the reducer returned refused' },
    ];
    for (const fold of folds) {
      for (const stateSource of ['spec-initial-state', 'override'] as const) {
        const citation = populatedCitation(fold, {
          actors: CREW,
          stateSource,
        });
        expect(
          RUBRIC_POPULATED_MARKERS.some((marker) => citation.startsWith(marker))
        ).toBe(true);
        const sheet = complete();
        (sheet.checks as Record<string, Record<string, unknown>>)[
          POPULATED_CITED_CHECK
        ].populated = citation;
        expect(validateRubricArtifact(sheet).ok).toBe(true);
      }
    }
  });

  it('refuses a sheet whose check-5 citation was deleted, and accepts the same sheet with it', () => {
    // Both directions off ONE fixture, so the fulcrum is the field and nothing
    // else. Satisfiable-by-omission is the hole `stateSha256` closed and check
    // 7's citation closed again: "nothing to report" and "the line was deleted"
    // must not be the same shape.
    const withIt = complete();
    expect(validateRubricArtifact(withIt).ok).toBe(true);

    const without = complete();
    delete (without.checks as Record<string, Record<string, unknown>>)[
      POPULATED_CITED_CHECK
    ].populated;
    const result = validateRubricArtifact(without);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('rubric-incomplete');
    expect(result.ok === false && result.problems.join(' ')).toContain(
      'needs the "populated" line'
    );
  });

  it('refuses a citation that did not come from preview', () => {
    const sheet = complete();
    (sheet.checks as Record<string, Record<string, unknown>>)[
      POPULATED_CITED_CHECK
    ].populated = 'looks like a real potluck to me';
    const result = validateRubricArtifact(sheet);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems.join(' ')).toContain(
      'did not come from'
    );
  });

  it('requires it on check 5 only — the other checks may carry nothing', () => {
    const sheet = complete();
    const checks = sheet.checks as Record<string, Record<string, unknown>>;
    for (const id of Object.keys(checks)) {
      if (id !== POPULATED_CITED_CHECK) delete checks[id].populated;
    }
    expect(validateRubricArtifact(sheet).ok).toBe(true);
  });

  it("is a second stamp, not a replacement for check 7's", () => {
    // The two answer different questions off different passes, and a sheet
    // missing either is refused. Merging them would put one line where two
    // claims are made.
    const sheet = complete();
    const checks = sheet.checks as Record<string, Record<string, unknown>>;
    expect(checks[POPULATED_CITED_CHECK].reachability).toBeUndefined();
    expect(checks[REACHABILITY_CITED_CHECK].populated).toBeUndefined();
    expect(POPULATED_CITED_CHECK).not.toBe(REACHABILITY_CITED_CHECK);
  });
});

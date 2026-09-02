import { describe, expect, it } from 'bun:test';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';

// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { wrapBundleSource } from '@tloncorp/surface-shell/sandbox';

import {
  KANBAN_ALL_COLUMNS_BUNDLE,
  KANBAN_ALL_COLUMNS_SPEC,
} from './surface-transition-fixtures';
import {
  ALL_FIXTURES,
  BEACH_TRIP_SPLIT_BUNDLE,
  BEACH_TRIP_SPLIT_SHA256,
  BEACH_TRIP_SPLIT_SPEC,
  COMPLIANT_FIXTURE,
  RULE_FIXTURES,
  SUPPLEMENTARY_FIXTURES,
  type SurfaceLintFixture,
} from './surface-lint-fixtures';
import {
  GATE_ACTOR_SHIP,
  GATE_HOST_SHIP,
  SURFACE_LINT_RULES,
  type SurfaceLintRule,
  type SurfaceLintViolation,
  formatSurfaceLintResult,
  lintSurfaceBundle,
} from './surface-lint';

/**
 * The gate's self-test suite.
 *
 * The contract every fixture is held to is "exactly", not "at least": a
 * fixture must trip its own rule and no other. That is what distinguishes a
 * rule that works from one that never fires (caught by the per-rule
 * assertion) and from one that over-reaches into its neighbours (caught by
 * every OTHER fixture's assertion). `every rule has a fixture` closes the
 * third gap — a rule added without a fixture proving it fires.
 */

function ruleSet(violations: SurfaceLintViolation[]): SurfaceLintRule[] {
  return [...new Set(violations.map((violation) => violation.rule))].sort();
}

/* ------------------------------------------------------------------ */
/* The count-agreement fixture pair                                    */
/* ------------------------------------------------------------------ */

/**
 * Derived here rather than in `surface-lint-fixtures.ts` because the fixture
 * file belongs to a task running beside this one. The derivation is the same
 * one that file uses — one anchored span of the compliant baseline swapped for
 * a defective one — and the anchor assertion below is what keeps it honest:
 * a baseline edit that moved this line would otherwise leave a fixture that
 * silently stopped containing the defect.
 */
function mutateCompliant(from: string, to: string): string {
  const occurrences = COMPLIANT_FIXTURE.bundleSource.split(from).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `fixture anchor appears ${occurrences} times in the baseline, expected 1: ${from}`
    );
  }
  return COMPLIANT_FIXTURE.bundleSource.replace(from, to);
}

const COMPLIANT_SIGNUP_STAT =
  '<${Stat} value=${String(names.length)} label="signed up" />';

/**
 * The baseline with the count and its noun written into ONE run of copy.
 *
 * The compliant spec's `initialState.bringing` holds exactly one entry, so
 * `names.length` is 1 on the opening render and the header reads
 * **"1 people signed up"** — the string a real board shipped, in the form it
 * shipped in. Nothing else about the app changes, which is what makes the
 * finding attributable to this line.
 *
 * A `SectionHeader` and not the `Stat` it replaces, and that is the whole
 * point of the pair: `Stat` paints its value and its label in two separate
 * spans, so "1" over "signed up" is a stat block and stays out of scope. Move
 * the same two words into one element and it is a sentence.
 */
const COUNT_AGREEMENT_BUNDLE = mutateCompliant(
  COMPLIANT_SIGNUP_STAT,
  '<${SectionHeader}>${String(names.length)} people signed up<//>'
);

/** The same header with the word picked from the number. */
const COUNT_AGREEMENT_REPAIRED_BUNDLE = mutateCompliant(
  COMPLIANT_SIGNUP_STAT,
  "<${SectionHeader}>${String(names.length)} ${names.length === 1 ? 'person' : 'people'} signed up<//>"
);

/**
 * Two elements that are innocent apart and guilty glued.
 *
 * The leaf runs are `Week 1` and `people are here`, neither of which is a
 * count against a plural. Their PARENT's `textContent` is
 * `…I will bring saladWeek 1 people are here`, which reads as "1 people" and
 * describes nothing any member sees. This is the precision half of reading
 * leaf runs: the restriction is not only about finding the defect behind a
 * full stop, it is about not inventing one across a boundary.
 */
const COUNT_GLUE_BAIT_BUNDLE = mutateCompliant(
  COMPLIANT_SIGNUP_STAT,
  '<${SectionHeader}><div>Week 1</div><div> people are here</div><//>'
);

/**
 * Three near-misses in one run of copy, one per boundary the pattern carries.
 *
 * `31 people` — the `1` continues a number. `0.1 people` — it continues a
 * decimal. `1 peoples` — the noun continues past the word. All three would
 * match a pattern with the boundaries dropped, and none of them is a defect.
 */
const COUNT_NEAR_MISS_BUNDLE = mutateCompliant(
  COMPLIANT_SIGNUP_STAT,
  '<${SectionHeader}>31 people signed up · 1 peoples · 0.1 people<//>'
);

/**
 * An action the reducer refuses on EVERY path, which shipped green.
 *
 * `$actor` must be a whole path segment; `resolveActorSegments` rejects
 * `$actor-choice` as a grammar error, and a grammar refusal aborts the whole
 * entry. So this action is declared, rendered, pressable — and incapable of
 * changing the board, ever.
 *
 * Every other rule is structurally blind to it, which is the point of the
 * fixture: `pointer-hygiene` sees a legal pointer, `action-idempotency` sees
 * two identical states (a refused fold is trivially idempotent), the
 * activation shortfall sees a control that does invoke it, and
 * `no-op-control` EXCLUDES it because the walk skips aborted edges. Before
 * `inert-action` this spec passed the gate clean.
 */
const INERT_ACTION_SPEC = (() => {
  const spec = structuredClone(COMPLIANT_FIXTURE.spec) as {
    actions: Record<string, { ops: unknown[] }>;
  };
  spec.actions['bring-salad'].ops = [
    { op: 'set', path: '/bringing/$actor-choice', value: 'salad' },
  ];
  return spec as unknown as SurfaceLintFixture['spec'];
})();

/**
 * Fixtures this file owns, folded into the same per-rule contract as the ones
 * `surface-lint-fixtures.ts` carries: trip exactly one rule, and no other.
 */
const LOCAL_RULE_FIXTURES: SurfaceLintFixture[] = [
  {
    name: 'inert-action',
    rule: 'inert-action',
    bundleSource: COMPLIANT_FIXTURE.bundleSource,
    spec: INERT_ACTION_SPEC,
    defect:
      'partial-segment $actor makes every fold of the action a refusal, so the control is dead',
  },
  {
    name: 'count-agreement',
    rule: 'count-agreement',
    bundleSource: COUNT_AGREEMENT_BUNDLE,
    spec: COMPLIANT_FIXTURE.spec,
    defect: 'renders "1 people signed up" — a count of one against a plural',
  },
];

const EVERY_RULE_FIXTURE: SurfaceLintFixture[] = [
  ...RULE_FIXTURES,
  ...LOCAL_RULE_FIXTURES,
];

describe('surface publish gate — one fixture per rule', () => {
  it('covers every declared rule with a fixture', () => {
    const covered = new Set(EVERY_RULE_FIXTURE.map((fixture) => fixture.rule));
    const uncovered = SURFACE_LINT_RULES.filter((rule) => !covered.has(rule));
    expect(uncovered).toEqual([]);
  });

  it('has no duplicate fixture names', () => {
    const names = [...ALL_FIXTURES, ...LOCAL_RULE_FIXTURES].map(
      (fixture) => fixture.name
    );
    expect(new Set(names).size).toBe(names.length);
  });

  for (const fixture of EVERY_RULE_FIXTURE) {
    it(`${fixture.name}: trips ${fixture.rule} and nothing else (${fixture.defect})`, () => {
      const result = lintSurfaceBundle({
        bundleSource: fixture.bundleSource,
        spec: fixture.spec,
      });

      // A warning-severity rule reports the OPPOSITE outcome for `ok`, and
      // asserting it that way is the point: `ok === true` alongside exactly
      // one warning is the contract ("warnings never block"), and a rule
      // that quietly became an error would fail here rather than pass by
      // being a stricter version of itself.
      if (fixture.severity === 'warning') {
        expect(result.ok).toBe(true);
        expect(result.violations).toEqual([]);
        expect(ruleSet(result.warnings)).toEqual([
          fixture.rule as SurfaceLintRule,
        ]);
        return;
      }

      expect(result.ok).toBe(false);
      // the right rule fired ...
      expect(ruleSet(result.violations)).toEqual([
        fixture.rule as SurfaceLintRule,
      ]);
      // ... and nothing else did, warnings included
      expect(
        ruleSet(result.warnings).filter((rule) => rule !== fixture.rule)
      ).toEqual([]);
    });
  }

  it('compliant: passes clean, with no warnings and nothing skipped', () => {
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(formatSurfaceLintResult(result)).toBe('');
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});

describe('machine readability', () => {
  it('gives bundle findings a line and column', () => {
    const fixture = RULE_FIXTURES.find(
      (entry) => entry.name === 'navigation-vector'
    )!;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    // rule 5 has a lexical half and a behavioral half, and only the lexical
    // one can carry a source position — the other read the rendered DOM
    const violation = result.violations.find(
      (entry) => entry.line !== undefined
    )!;
    expect(violation.line).toBeGreaterThan(0);
    expect(violation.column).toBeGreaterThan(0);
    // the line really is the offending one
    const line = fixture.bundleSource.split('\n')[violation.line! - 1];
    expect(line).toContain('<a href=');
  });

  it('gives spec findings a spec path instead of a line', () => {
    const fixture = RULE_FIXTURES.find(
      (entry) => entry.name === 'pointer-hygiene'
    )!;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].specPath).toBe(
      'actions.bring-salad.ops[0].path'
    );
    expect(result.violations[0].line).toBeUndefined();
  });

  it('formats every finding on one parseable line', () => {
    const fixture = RULE_FIXTURES.find((entry) => entry.name === 'style')!;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    const lines = formatSurfaceLintResult(result).split('\n');
    expect(lines.length).toBe(result.violations.length);
    for (const line of lines) {
      expect(line).toMatch(/^error style bundle:\d+:\d+: /);
    }
  });
});

describe('rule 8 — pointer hygiene knows where a ship is escaped', () => {
  it('does not flag a bare ship used as an object key inside a value', () => {
    // the compliant spec seeds `initialState.bringing['~zod']`; that is a
    // value, not a pointer, and the bare form is correct there
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });

  it('does not flag a bare ship in an op VALUE', () => {
    const spec = JSON.parse(JSON.stringify(COMPLIANT_FIXTURE.spec));
    spec.actions['bring-salad'].ops = [
      { op: 'set', path: '/hosts/$actor', value: { partner: '~zod' } },
    ];
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });

  it('accepts the escaped form of the same ship in a path', () => {
    const spec = JSON.parse(JSON.stringify(COMPLIANT_FIXTURE.spec));
    spec.actions['bring-salad'].ops = [
      { op: 'set', path: '/bringing/~0sampel-palnet', value: 'salad' },
    ];
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });
});

describe('rule 11 — the canvas check is behavioral', () => {
  it('catches a live chart built with responsive: false', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.rawChartNotResponsive;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['chart-sizing']);
    const messages = result.violations.map((violation) => violation.message);
    expect(messages.some((message) => message.includes('responsive'))).toBe(
      true
    );
    expect(
      messages.some((message) => message.includes('maintainAspectRatio'))
    ).toBe(true);
  });

  it('reports the `new Chart(` grep as a warning, never as the gate', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.rawChartNotResponsive;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    const greps = result.warnings.filter((violation) =>
      violation.message.includes('raw Chart constructor')
    );
    expect(greps).toHaveLength(1);
    expect(greps[0].severity).toBe('warning');
  });

  it('does not fire on `new Chart(` inside a comment — the grep cannot be the gate', () => {
    const bundleSource = `${COMPLIANT_FIXTURE.bundleSource}\n// never do: new Chart(canvas, { options: { responsive: false } })\n`;
    const result = lintSurfaceBundle({
      bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('passes a chart built through the primitive, which owns sizing', () => {
    const bundleSource = COMPLIANT_FIXTURE.bundleSource.replace(
      '<${SectionHeader}>Who is bringing what<//>',
      '<${primitives.Chart} type="bar" data=${{ datasets: [] }} label="Signups" />'
    );
    const result = lintSurfaceBundle({
      bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });
});

describe('rule 13 — idempotency is folded through the real reducer', () => {
  it('accepts an append action that declares duplicatesTolerated', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.appendTolerated;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('names the offending action in the spec path', () => {
    const fixture = RULE_FIXTURES.find(
      (entry) => entry.name === 'action-idempotency'
    )!;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    for (const violation of result.violations) {
      expect(violation.specPath).toBe('actions.add-note');
    }
    // both legs fire: the observed divergence, and the structural rule that
    // an `append` action must declare the marking regardless
    expect(result.violations).toHaveLength(2);
  });

  it('folds a preserving spec above a stand-in migration snapshot', () => {
    const spec = JSON.parse(JSON.stringify(COMPLIANT_FIXTURE.spec));
    spec.preserveState = true;
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });
});

describe('rule 12 — jargon is about copy, not about comments', () => {
  it('ignores mechanism vocabulary in comments', () => {
    const bundleSource = `// the host posts a rollover event and bumps the spec revision\n// invoke() resolves $actor from the scratch log\n${COMPLIANT_FIXTURE.bundleSource}`;
    const result = lintSurfaceBundle({
      bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(result.ok).toBe(true);
  });

  it('catches jargon that only the rendered output exposes', () => {
    const fixture = RULE_FIXTURES.find((entry) => entry.name === 'jargon')!;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    const rendered = result.violations.filter((violation) =>
      violation.message.startsWith('rendered copy')
    );
    expect(rendered.length).toBeGreaterThan(0);
  });

  it('takes an extensible denylist', () => {
    const bundleSource = COMPLIANT_FIXTURE.bundleSource.replace(
      'Who is bringing what',
      'Who is bringing what this epoch'
    );
    const clean = lintSurfaceBundle({
      bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(clean.ok).toBe(true);

    const strict = lintSurfaceBundle({
      bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
      extraJargon: ['epoch'],
    });
    expect(ruleSet(strict.violations)).toEqual(['jargon']);
  });
});

describe('skipping is explicit, never a silent pass', () => {
  it('skips the behavioral phase when the bundle is not a plain script', () => {
    const fixture = RULE_FIXTURES.find(
      (entry) => entry.name === 'module-syntax'
    )!;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.skipped.map((skip) => skip.rule).sort()).toEqual([
      'action-idempotency',
      'chart-sizing',
      'count-agreement',
      'smoke-render',
      'time-display',
    ]);
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('module syntax');
    }
  });

  it('skips the behavioral phase when the spec fails its schema', () => {
    const fixture = RULE_FIXTURES.find(
      (entry) => entry.name === 'spec-schema'
    )!;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.skipped).toHaveLength(5);
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('schema');
    }
  });

  it('reports an unevaluatable bundle as a smoke-render failure', () => {
    const result = lintSurfaceBundle({
      bundleSource: `${COMPLIANT_FIXTURE.bundleSource}\nfunction ( {\n`,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(
      result.violations.some((violation) => violation.rule === 'smoke-render')
    ).toBe(true);
  });
});

describe('warnings never fail the gate', () => {
  it('warns on a computed invoke id without failing', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.computedInvoke;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.ok).toBe(true);
    expect(ruleSet(result.warnings)).toEqual(['undeclared-action']);
  });
});

describe('caps come from the shared schema, not a local copy', () => {
  it('rejects an over-cap initialState through the spec schema', () => {
    const spec = JSON.parse(JSON.stringify(COMPLIANT_FIXTURE.spec));
    spec.initialState.filler = 'x'.repeat(9 * 1024);
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec,
    });
    expect(ruleSet(result.violations)).toEqual(['spec-schema']);
  });

  it('rejects an action id outside the declared grammar', () => {
    const spec = JSON.parse(JSON.stringify(COMPLIANT_FIXTURE.spec));
    spec.actions['Bring Salad'] = spec.actions['bring-salad'];
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec,
    });
    expect(
      result.violations.some((violation) => violation.rule === 'spec-schema')
    ).toBe(true);
  });
});

describe('span-straddling forms the scanner splits apart', () => {
  function variant(markup: string) {
    return COMPLIANT_FIXTURE.bundleSource.replace(
      '<${SectionHeader}>Who is bringing what<//>',
      markup
    );
  }

  it('catches an interpolated src, which the markup span ends before', () => {
    const result = lintSurfaceBundle({
      bundleSource: variant('<img src=${state.logo} />'),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['external-reference']);
    expect(result.violations[0].message).toContain('built at runtime');
  });

  it('catches a style object, which lives in a code span', () => {
    const result = lintSurfaceBundle({
      bundleSource: variant(
        '<div style=${{ fontFamily: "Comic Sans", boxShadow: "0 0 2px" }}>Menu</div>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['style']);
    expect(
      result.violations.map((violation) => violation.message).join(' ')
    ).toContain('font-family');
  });

  it('catches a canvas sized imperatively through a ref', () => {
    const result = lintSurfaceBundle({
      bundleSource: variant(
        '<canvas ref=${(el) => { if (el) { el.width = 480; el.height = 320; } }}></canvas>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['chart-sizing']);
  });

  it('catches an interpolated canvas dimension', () => {
    const result = lintSurfaceBundle({
      bundleSource: variant('<canvas width=${480} height=${320}></canvas>'),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['chart-sizing']);
  });

  it('reports one finding per defect, not one per render pass', () => {
    const spec = JSON.parse(JSON.stringify(COMPLIANT_FIXTURE.spec));
    spec.actions['bring-bread'] = spec.actions['bring-salad'];
    spec.actions['bring-pie'] = spec.actions['bring-salad'];
    const result = lintSurfaceBundle({
      bundleSource: variant('<canvas width="480"></canvas>'),
      spec,
    });
    // three actions means four render passes; still one violation
    expect(result.violations).toHaveLength(1);
  });
});

describe('forbidden APIs the scanner must not confuse with text', () => {
  function withCode(code: string) {
    return COMPLIANT_FIXTURE.bundleSource.replace(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      `  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n${code}`
    );
  }

  const forbidden: [string, string][] = [
    ['XMLHttpRequest', '  const x = new XMLHttpRequest();'],
    ['WebSocket', '  const s = new WebSocket("wss://example.com");'],
    ['eval', '  const run = () => eval("1 + 1");'],
    ['dynamic import', '  const load = () => import("./more.js");'],
  ];
  for (const [name, code] of forbidden) {
    it(`rejects ${name}`, () => {
      const result = lintSurfaceBundle({
        bundleSource: withCode(code),
        spec: COMPLIANT_FIXTURE.spec,
      });
      expect(
        result.violations.some(
          (violation) => violation.rule === 'forbidden-api'
        )
      ).toBe(true);
    });
  }

  it('does not fire on a forbidden name inside a comment or a string', () => {
    const result = lintSurfaceBundle({
      bundleSource: withCode(
        '  // never call fetch() or eval() from a bundle\n  const note = "we do not use XMLHttpRequest here";'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(result.ok).toBe(true);
  });

  it('does not fire on a name that merely contains a forbidden one', () => {
    const result = lintSurfaceBundle({
      bundleSource: withCode(
        '  const prefetchCount = 2;\n  void prefetchCount;'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(result.ok).toBe(true);
  });
});

describe('navigation vectors', () => {
  function withCode(code: string) {
    return COMPLIANT_FIXTURE.bundleSource.replace(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      `  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n${code}`
    );
  }

  const vectors: [string, string][] = [
    [
      'window.location',
      '  const go = () => { window.location.href = "https://example.com"; };',
    ],
    [
      'document.location',
      '  const go = () => { document.location.href = "https://example.com"; };',
    ],
    ['document.write', '  const go = () => document.write("<b>x</b>");'],
    ['window.open', '  const go = () => window.open("https://example.com");'],
    ['synthesized anchor', '  const go = () => document.createElement("a");'],
    [
      'a synthesized <area>',
      '  const go = () => document.createElement("area");',
    ],
    // One receiver list, exercised through each receiver it gained. Each of
    // these passed the whole gate clean before the two lists were merged.
    ['frames.open', '  const go = () => frames.open("https://example.com");'],
    [
      'document.open',
      '  const go = () => document.open("text/html", "replace");',
    ],
    [
      'location through el.ownerDocument',
      '  const go = (el) => el.ownerDocument.location.replace("https://example.com");',
    ],
    [
      'location through document.defaultView',
      '  const go = () => { document.defaultView.location.href = "https://example.com"; };',
    ],
    [
      'location through iframe.contentWindow',
      '  const go = (f) => { f.contentWindow.location.href = "https://example.com"; };',
    ],
    // The markup route with every operator markup is actually built with.
    [
      'innerHTML +=',
      '  const addRow = (el, t) => { el.innerHTML += t; };\n  void addRow;',
    ],
    [
      'innerHTML ||=',
      '  const seed = (el, t) => { el.innerHTML ||= t; };\n  void seed;',
    ],
    [
      'outerHTML ??=',
      '  const seed = (el, t) => { el.outerHTML ??= t; };\n  void seed;',
    ],
  ];
  for (const [name, code] of vectors) {
    it(`rejects ${name}`, () => {
      const result = lintSurfaceBundle({
        bundleSource: withCode(code),
        spec: COMPLIANT_FIXTURE.spec,
      });
      expect(
        result.violations.some(
          (violation) => violation.rule === 'navigation-vector'
        )
      ).toBe(true);
    });
  }

  it('rejects meta refresh markup', () => {
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '<${SectionHeader}>Who is bringing what<//>',
        '<meta http-equiv="refresh" content="0; url=https://example.com" />'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(
      result.violations.some(
        (violation) => violation.rule === 'navigation-vector'
      )
    ).toBe(true);
  });

  /**
   * The routes an audit found the rule did not model. Each is a fixture, and
   * each fixture is held to the same "trips its own rule and no other"
   * contract as the one-per-rule corpus.
   */
  const newlyModeled = [
    SUPPLEMENTARY_FIXTURES.navigationApi,
    SUPPLEMENTARY_FIXTURES.bareNavigationApi,
    SUPPLEMENTARY_FIXTURES.areaHref,
    SUPPLEMENTARY_FIXTURES.spreadAnchor,
    SUPPLEMENTARY_FIXTURES.imperativeMarkup,
    SUPPLEMENTARY_FIXTURES.insertAdjacentMarkup,
    SUPPLEMENTARY_FIXTURES.compoundMarkupAssignment,
    SUPPLEMENTARY_FIXTURES.framesOpen,
    SUPPLEMENTARY_FIXTURES.ownerDocumentLocation,
  ];
  for (const fixture of newlyModeled) {
    it(`${fixture.name}: trips navigation-vector and nothing else (${fixture.defect})`, () => {
      const result = lintSurfaceBundle({
        bundleSource: fixture.bundleSource,
        spec: fixture.spec,
      });
      expect(result.ok).toBe(false);
      expect(ruleSet(result.violations)).toEqual(['navigation-vector']);
      expect(ruleSet(result.warnings)).toEqual([]);
    });
  }

  /**
   * Both halves of the two markup routes are pinned separately, because
   * either one alone would keep the fixture failing and hide the loss of
   * the other. A lexical finding is the one that carries a source position.
   */
  const lexicalHalves: [string, string, string][] = [
    [
      '<area href>',
      SUPPLEMENTARY_FIXTURES.areaHref.bundleSource,
      'anchor-driven navigation',
    ],
    [
      'a spread-prop anchor',
      SUPPLEMENTARY_FIXTURES.spreadAnchor.bundleSource,
      'spread attributes',
    ],
  ];
  for (const [name, bundleSource, fragment] of lexicalHalves) {
    it(`catches ${name} in the source too, not only in the rendered DOM`, () => {
      const result = lintSurfaceBundle({
        bundleSource,
        spec: COMPLIANT_FIXTURE.spec,
      });
      expect(
        result.violations.some(
          (violation) =>
            violation.line !== undefined && violation.message.includes(fragment)
        )
      ).toBe(true);
    });
  }

  it('does not fire on READING innerHTML, which injects nothing', () => {
    // the widened operator has to admit `+=` without admitting `===`, and
    // a comparison of two innerHTMLs is the shape that would break first
    const fixture = SUPPLEMENTARY_FIXTURES.markupComparison;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(formatSurfaceLintResult(result)).toBe('');
    expect(result.ok).toBe(true);
  });

  it('catches an anchor that only a press turns into a link', () => {
    // `<a>` with no href passes the lexical patterns (there is no `href` to
    // match) and `setAttribute` is not a route this file models, so the
    // rendered DOM after the press is the only thing that can see this
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '<${SectionHeader}>Who is bringing what<//>',
        '<a onClick=${(event) => { event.target.setAttribute("hre" + "f", "https://example.com/menu"); }}>Who is bringing what</a>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['navigation-vector']);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain('controls activated');
  });

  it('reads an anchor out of the rendered DOM, not only out of the source', () => {
    // the spread form carries no attribute NAME in the markup, so this is
    // the leg that does not depend on how the anchor was spelled
    const result = lintSurfaceBundle({
      bundleSource: SUPPLEMENTARY_FIXTURES.spreadAnchor.bundleSource,
      spec: SUPPLEMENTARY_FIXTURES.spreadAnchor.spec,
    });
    expect(
      result.violations.some((violation) =>
        violation.message.includes('the rendered output')
      )
    ).toBe(true);
  });
});

describe('rule 5 — the false positives it used to fire on', () => {
  it('passes an app with a data field named `location`', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.locationField;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(formatSurfaceLintResult(result)).toBe('');
    expect(result.ok).toBe(true);
  });

  it('passes a modal that declares its own `open`', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.modalOpen;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(formatSurfaceLintResult(result)).toBe('');
    expect(result.ok).toBe(true);
  });

  it('still rejects a bare open() when nothing binds the name', () => {
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
        '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const go = () => open("https://example.com");\n  void go;'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['navigation-vector']);
  });

  it('still rejects window.open even when the bundle declares an `open`', () => {
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
        '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  function open(id) { return id; }\n  const go = () => window.open(open("https://example.com"));\n  void go;'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['navigation-vector']);
  });

  it('the bare `location` narrowing rests on the shim, which is still there', () => {
    // Dropping the bare-identifier pattern is only free while the sandbox
    // keeps shadowing that identifier. If `wrapBundleSource` stops doing
    // this, the narrowing stops being free and this fails rather than
    // rotting silently.
    expect(wrapBundleSource('void 0;')).toContain('(function (location) {');
  });
});

describe('per-detector coverage inside multi-detector rules', () => {
  function withMarkup(markup: string) {
    return COMPLIANT_FIXTURE.bundleSource.replace(
      '<${SectionHeader}>Who is bringing what<//>',
      markup
    );
  }
  function withCode(code: string) {
    return COMPLIANT_FIXTURE.bundleSource.replace(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      `  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n${code}`
    );
  }

  it('rule 2: catches import.meta', () => {
    const result = lintSurfaceBundle({
      bundleSource: withCode('  const base = import.meta.url;'),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['module-syntax']);
  });

  it('rule 2: catches a static import', () => {
    const result = lintSurfaceBundle({
      bundleSource: `import { h } from 'preact';\n${COMPLIANT_FIXTURE.bundleSource}`,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['module-syntax']);
  });

  it('rule 3: catches CSS @import', () => {
    const result = lintSurfaceBundle({
      bundleSource: withMarkup(
        "<style>@import url('https://fonts.example.com/x.css');</style>"
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['external-reference']);
  });

  it('rule 3: catches a CSS url() pointing off-bundle', () => {
    const result = lintSurfaceBundle({
      bundleSource: withMarkup(
        '<div style="background: url(https://example.com/bg.png)">Menu</div>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations).includes('external-reference')).toBe(
      true
    );
  });

  it('rule 3: allows a data: url(), which is inline', () => {
    const result = lintSurfaceBundle({
      bundleSource: withMarkup(
        '<div style="width: 4px; height: url(data:image/gif;base64,R0lGODlh)">Menu</div>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });

  it('rule 3: catches importScripts', () => {
    const result = lintSurfaceBundle({
      bundleSource: withCode(
        '  const load = () => importScripts("/extra.js");'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['external-reference']);
  });

  it('rule 3: allows an inline data: src', () => {
    const result = lintSurfaceBundle({
      bundleSource: withMarkup(
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });

  it('rule 10: lints declarations inside a <style> block', () => {
    const result = lintSurfaceBundle({
      bundleSource: withMarkup(
        '<style>.menu { box-shadow: 0 0 2px; display: flex; }</style>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['style']);
    const messages = result.violations.map((violation) => violation.message);
    expect(messages.some((message) => message.includes('box-shadow'))).toBe(
      true
    );
    // `display` is inside the layout subset and must not be reported
    expect(messages.some((message) => message.includes('"display"'))).toBe(
      false
    );
  });

  it('rule 10: allows layout properties in a style attribute', () => {
    const result = lintSurfaceBundle({
      bundleSource: withMarkup(
        '<div style="display: flex; gap: 8px; justify-content: space-between">Menu</div>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });

  it('rule 10: catches rgb() and hsl() literals as well as hex', () => {
    for (const color of ['rgb(255, 0, 0)', 'hsl(0, 100%, 50%)']) {
      const result = lintSurfaceBundle({
        bundleSource: withCode(`  const accent = "${color}";\n  void accent;`),
        spec: COMPLIANT_FIXTURE.spec,
      });
      expect(ruleSet(result.violations)).toEqual(['style']);
    }
  });

  it('rule 12: catches jargon in a string the initial state never renders', () => {
    const result = lintSurfaceBundle({
      bundleSource: withCode(
        '  const emptyCopy = "No scratch entries yet";\n  void emptyCopy;'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['jargon']);
    // this one is only reachable lexically — nothing rendered it
    expect(result.violations[0].line).toBeGreaterThan(0);
  });

  it('rule 12: covers every term on the built-in denylist', () => {
    for (const term of [
      'rollover',
      'revision',
      'invoke',
      'spec',
      'scratch',
      '$actor',
    ]) {
      const result = lintSurfaceBundle({
        bundleSource: withCode(
          `  const copy = "the ${term} is here";\n  void copy;`
        ),
        spec: COMPLIANT_FIXTURE.spec,
      });
      expect(ruleSet(result.violations)).toEqual(['jargon']);
    }
  });
});

describe('rule 6 — entry-point has a lexical and a behavioral half', () => {
  it('rejects a bundle that registers twice', () => {
    const result = lintSurfaceBundle({
      bundleSource: `${COMPLIANT_FIXTURE.bundleSource}\nsurface.register({ render: () => null });\n`,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['entry-point']);
    expect(result.violations[0].message).toContain('more than once');
  });

  it('rejects a registration the shell itself refuses', () => {
    // lexically there IS a registration; only the shell can say it was not an
    // object with render()
    const result = lintSurfaceBundle({
      bundleSource: '(function () { surface.register(function () {}); })();',
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['entry-point']);
    expect(result.violations[0].message).toContain('shell refused');
  });
});

describe('detectors that only one input can distinguish', () => {
  function withMarkup(markup: string) {
    return COMPLIANT_FIXTURE.bundleSource.replace(
      '<${SectionHeader}>Who is bringing what<//>',
      markup
    );
  }
  function withCode(code: string) {
    return COMPLIANT_FIXTURE.bundleSource.replace(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      `  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n${code}`
    );
  }

  it('rule 3: @import without url() — nothing else can catch it', () => {
    const result = lintSurfaceBundle({
      bundleSource: withMarkup('<style>@import "brand.css";</style>'),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['external-reference']);
    expect(result.violations[0].message).toContain('@import');
  });

  it('rule 5: a bare global open() — the qualified pattern cannot see it', () => {
    const result = lintSurfaceBundle({
      bundleSource: withCode('  const go = () => open("https://example.com");'),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['navigation-vector']);
    expect(result.violations[0].message).toContain('open()');
  });

  it('rule 10: font-family in a plain string, outside any style attribute', () => {
    const result = lintSurfaceBundle({
      bundleSource: withCode(
        '  const css = "font-family: Comic Sans MS";\n  void css;'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['style']);
    expect(result.violations[0].message).toContain('font-family is not');
  });

  it('rule 10: a style attribute whose only fault is the property itself', () => {
    // no color, no font: only the declaration parser can report this
    const result = lintSurfaceBundle({
      bundleSource: withMarkup('<div style="box-shadow: 0 0 2px">Menu</div>'),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['style']);
    expect(result.violations[0].message).toContain('style attribute');
  });

  it('rule 13: a render that throws is reported, not swallowed', () => {
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '      const bringing = state.bringing || {};',
        "      throw new Error('deliberate failure');"
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['smoke-render']);
    expect(result.violations[0].message).toContain('render threw');
  });

  it('rule 13: a bundle that will not parse is reported as unevaluatable', () => {
    const result = lintSurfaceBundle({
      bundleSource: `${COMPLIANT_FIXTURE.bundleSource}\nfunction ( {\n`,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['smoke-render']);
    expect(result.violations[0].message).toContain('could not be evaluated');
  });
});

describe('the behavioral fold really folds', () => {
  it('resolves $actor to the synthetic actor and re-renders the folded state', () => {
    // the compliant app renders the keys of `bringing`, so if the fold applied
    // `set /bringing/$actor` the actor's ship is on screen after the invoke —
    // which also proves the op was applied rather than skipped
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
      extraJargon: ['sampel'],
    });
    expect(ruleSet(result.violations)).toEqual(['jargon']);
    expect(result.violations[0].message).toContain('after invoking');
  });

  it('exposes the identities it folds as', () => {
    expect(GATE_ACTOR_SHIP).not.toBe(GATE_HOST_SHIP);
  });
});

describe('the smoke render is hosted, not ambient', () => {
  /**
   * Two windows, both from the factory: one for the gate's own canary and one
   * for the caller's bundle. They are separate on purpose — a canary that
   * mounted its shell root into the document the real run then renders into
   * would change what the activation pass sees, and a control that perturbs
   * its subject is not a control.
   */
  it('uses the injected window factory, once per window it needs', () => {
    let built = 0;
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
      createWindow: () => {
        built += 1;
        return new Window();
      },
    });
    expect(built).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.environment).toBeNull();
  });

  /**
   * The environment classification, exercised: a window the harness cannot
   * render into must produce an `environment` reading and NO violations —
   * because a violation is an author error, and this codebase's own doctrine
   * tells a bot that an author error means "rewrite the app". The cwd-
   * dependent JSX-runtime mismatch that motivated this reported a correct,
   * shipped template as a `smoke-render` violation.
   */
  it('reports a harness it cannot render in as environment, not as a violation', () => {
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
      // a window with no document at all: the harness cannot mount in it
      createWindow: () => ({}) as unknown as Window,
    });
    expect(result.environment).not.toBeNull();
    expect(result.violations).toEqual([]);
    expect(result.skipped.map((skip) => skip.rule).sort()).toEqual([
      'action-idempotency',
      'chart-sizing',
      'count-agreement',
      'smoke-render',
      'time-display',
    ]);
  });

  it('leaves the process globals exactly as it found them', () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = ['window', 'document', 'Node', 'Element', 'HTMLElement'].map(
      (name) => [name in globals, globals[name]] as const
    );
    lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    const after = ['window', 'document', 'Node', 'Element', 'HTMLElement'].map(
      (name) => [name in globals, globals[name]] as const
    );
    expect(after).toEqual(before);
  });
});

describe('the behavioral phase presses the app’s controls', () => {
  const WIDENED: SurfaceLintRule[] = [
    'chart-sizing',
    // Fifth once count agreement joined them, and for the same reason: the
    // count that disagrees is usually not the opening one. The board that rule
    // was written about opens with no claims at all, so its "1 people active"
    // badge exists only on a screen activation reached.
    'count-agreement',
    'jargon',
    'navigation-vector',
    'smoke-render',
  ];

  it('presses the control that invokes each declared action', () => {
    // the compliant app wires one Button to its one declared action, and the
    // absence of any shortfall is how the suite knows the press landed
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(result.skipped).toEqual([]);
  });

  it('finds a handler on a plain element, not only on a button', () => {
    // a selector sweep over `button, [role=button]` would miss this, and a
    // control the gate cannot find is a handler the gate cannot run
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '<${SectionHeader}>Who is bringing what<//>',
        '<div onClick=${() => { throw new Error("plain element handler"); }}>Who is bringing what</div>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['smoke-render']);
    expect(result.violations[0].message).toContain('plain element handler');
  });

  it('catches a chart made non-responsive on press — the live instance, not the config', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.chartReassignedOnPress;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['chart-sizing']);
    // and it is the ACTIVATED pass that saw it: the constructor config was
    // responsive, so nothing before the press had anything to report
    for (const violation of result.violations) {
      expect(violation.message).toContain('controls activated');
    }
  });

  /**
   * A DOCUMENTED GAP, pinned rather than papered over.
   *
   * The live-instance oracle reads on the gate's synchronous stack, so a
   * reassignment the handler defers to a microtask lands after the result
   * has already been returned. Draining is not the fix: it needs `await`,
   * which would make `lintSurfaceBundle` async across four synchronous
   * callers; one drain is one tick against a chain the app chooses the
   * length of; and timers are a different scheduler a drain never touches.
   * `checkChartSizing` says all of that. This test is what stops the doc
   * and the code drifting apart — if the miss is ever closed, it fails.
   */
  it('does NOT catch a chart reassigned off the synchronous stack (known gap)', () => {
    const deferred = SUPPLEMENTARY_FIXTURES.chartReassignedInMicrotask;
    const deferredResult = lintSurfaceBundle({
      bundleSource: deferred.bundleSource,
      spec: deferred.spec,
    });
    expect(ruleSet(deferredResult.violations)).toEqual([]);
    expect(deferredResult.skipped).toEqual([]);
    // the source grep still warns, which is the same rule and never the gate
    expect(ruleSet(deferredResult.warnings)).toEqual(['chart-sizing']);

    // and the ONLY difference from the caught case is the deferral: the same
    // reassignment made synchronously is reported
    const immediate = SUPPLEMENTARY_FIXTURES.chartReassignedOnPress;
    const immediateResult = lintSurfaceBundle({
      bundleSource: immediate.bundleSource,
      spec: immediate.spec,
    });
    expect(ruleSet(immediateResult.violations)).toEqual(['chart-sizing']);
  });

  it('catches a handler that throws, which no lexical rule can see', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.handlerThrows;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['smoke-render']);
    expect(result.violations[0].message).toContain('nothing to show');
  });

  it('reports jargon that only a press puts on screen', () => {
    // the term is assembled from pieces, so no string span contains it and
    // the lexical half is blind — pressing the control is the only way to
    // find out what this app says
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '<${SectionHeader}>Who is bringing what<//>',
        '<div onClick=${(event) => { event.target.textContent = "No " + "scr" + "atch" + " entries yet"; }}>Who is bringing what</div>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['jargon']);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain('controls activated');
  });

  it('skips, with the action named, when no control invokes it', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.appendTolerated;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped.map((skip) => skip.rule).sort()).toEqual(WIDENED);
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('"add-note"');
    }
  });

  it('names the event types it did not dispatch', () => {
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '<${SectionHeader}>Who is bringing what<//>',
        '<select onChange=${() => invoke("bring-salad")}><option>salad</option></select>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(result.skipped.map((skip) => skip.rule).sort()).toEqual(WIDENED);
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('change');
    }
  });

  /**
   * The three routes where activation used to reach nothing while all four
   * widened rules reported clean with ZERO skips. Each keeps the baseline's
   * Button, so the one declared action IS invoked and the action-shaped
   * shortfall stays silent — which is the condition that made a control the
   * gate never pressed invisible. The defect behind each control is jargon
   * assembled from pieces, so it exists but no lexical rule can see it.
   */
  it('presses a control bound through the onclick property, and reports what it does', () => {
    // `el.onclick = fn` never calls addEventListener; before the setter was
    // wrapped the recorder did not know this element existed
    const fixture = SUPPLEMENTARY_FIXTURES.onClickProperty;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['jargon']);
    expect(result.violations).toHaveLength(1);
    // it is the ACTIVATED pass that saw it — nothing before the press said this
    expect(result.violations[0].message).toContain('controls activated');
    // and having pressed it, there is nothing left to report as missed
    expect(result.skipped).toEqual([]);
  });

  it('reports a control delegated onto the document instead of dropping it', () => {
    // recorded, then dropped by the reachability filter because the rendered
    // root does not contain the document. The gate cannot press it; the
    // change is that it no longer passes clean while pretending otherwise.
    const fixture = SUPPLEMENTARY_FIXTURES.delegatedOnDocument;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.violations).toEqual([]);
    expect(result.skipped.map((skip) => skip.rule).sort()).toEqual(WIDENED);
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('1 control');
      expect(skip.reason).toContain('outside the rendered output');
    }
  });

  it('reports a control bound on the shell root, whose click lands on nothing', () => {
    // it survives `contains` (a node contains itself), is marked, and spends
    // budget — then `root.querySelector` searches descendants and never
    // matches the root, so `click` returns false and no press happens
    const fixture = SUPPLEMENTARY_FIXTURES.boundOnTheRoot;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.violations).toEqual([]);
    expect(result.skipped.map((skip) => skip.rule).sort()).toEqual(WIDENED);
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('1 control');
      expect(skip.reason).toContain('could not dispatch to');
    }
  });

  it('does not report a control it pressed and a later re-render removed', () => {
    // This control exists only while `bringing` has one entry, so invoking
    // the declared action renders it away. It IS pressed on the initial
    // state — the jargon it writes is the proof — and it IS outside the
    // rendered root by the time the last pass sweeps. Reachability is
    // therefore tracked across the whole phase and not per pass: asking
    // only "is it reachable now" reports a control that was fully
    // exercised, and a shortfall nobody can act on is worse than none.
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '<${SectionHeader}>Who is bringing what<//>',
        '${names.length === 1 ? html`<div onClick=${(event) => { event.currentTarget.textContent = "No " + "scr" + "atch" + " entries yet"; }}>Who is bringing what</div>` : null}'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['jargon']);
    expect(result.violations[0].message).toContain('controls activated');
    for (const skip of result.skipped) {
      expect(skip.reason).not.toContain('outside the rendered output');
    }
  });

  it('counts one unreachable control once, not once per rendered state', () => {
    // activation runs per rendered state, so the same dropped binding is seen
    // again on every pass; three actions means four passes
    const spec = JSON.parse(
      JSON.stringify(SUPPLEMENTARY_FIXTURES.delegatedOnDocument.spec)
    );
    spec.actions['bring-bread'] = spec.actions['bring-salad'];
    spec.actions['bring-pie'] = spec.actions['bring-salad'];
    const result = lintSurfaceBundle({
      bundleSource: SUPPLEMENTARY_FIXTURES.delegatedOnDocument.bundleSource,
      spec,
    });
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('1 control bound outside');
    }
  });

  it('bounds the presses, and says so when the bound is reached', () => {
    // a control that adds another control on every press: the budget is what
    // makes this terminate, and running out is reported rather than swallowed
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource.replace(
        '<${SectionHeader}>Who is bringing what<//>',
        '<div onClick=${(event) => { const more = document.createElement("span"); more.addEventListener("click", () => {}); event.target.appendChild(more); }}>Who is bringing what</div>'
      ),
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(result.skipped.map((skip) => skip.rule).sort()).toEqual(WIDENED);
    for (const skip of result.skipped) {
      expect(skip.reason).toContain('activation budget ran out');
    }
  });
});

/**
 * Rule 15 — an inert app is a declared choice, not a silent one.
 *
 * The defect it holds shut, verbatim from this session's run of the gate
 * over both apps session 6a.5 published, BEFORE the rule existed:
 *
 *     --- beach-trip-split  (surfaceId=srf-beach-split, actions={})
 *         ok=true violations=0 warnings=0 skipped=0
 *         <gate output: empty — nothing to say>
 *     --- dash-wqxxcy7q  (surfaceId=srf-ski-trip-split, actions={})
 *         ok=true violations=0 warnings=0 skipped=0
 *         <gate output: empty — nothing to say>
 *
 * FULCRUM: the observed value is the warning list, and exactly two things in
 * this test's world move it — the NUMBER OF KEYS in the spec's `actions`
 * object, and the presence of `memberInteraction: "none"`. The two fixtures
 * below differ in the second and in nothing else, and the `actions` arm is
 * moved by adding one key. Delete `checkMemberInteraction`'s call site and
 * the first test fails on an empty warning list; make the rule ignore the
 * marker and the second fails on a non-empty one; make it an error instead
 * of a warning and the per-rule assertion in `one fixture per rule` fails on
 * `ok`.
 */
describe('rule 15 — zero member actions is warned about, not refused', () => {
  const fixture = RULE_FIXTURES.find(
    (entry) => entry.name === 'member-interaction'
  )!;

  it('is the app that shipped, byte for byte', async () => {
    // Without this, the fixture is a paraphrase of the incident and the
    // suite could not tell an edited copy from the published bytes. The
    // digest is the one `chat/~zod/beach-trip-split`'s definition pins.
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(BEACH_TRIP_SPLIT_BUNDLE)
      )
    );
    const hex = [...digest]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toBe(BEACH_TRIP_SPLIT_SHA256);
    expect(BEACH_TRIP_SPLIT_SPEC.actions as Record<string, unknown>).toEqual(
      {}
    );
  });

  it('warns, and lets the publish through', () => {
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    // Not a refusal. The gate's contract is `ok = violations.length === 0`
    // over severity `error` only, and this rule relies on that being true.
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].rule).toBe('member-interaction');
    expect(result.warnings[0].severity).toBe('warning');
    expect(result.warnings[0].specPath).toBe('actions');
    // The message has to teach the opt-out; a warning nobody can act on is
    // noise that gets tuned out.
    expect(result.warnings[0].message).toContain('"mode": "none"');
    expect(result.warnings[0].message).toContain('"because"');
    // And it must actually reach the publisher's eyes.
    expect(formatSurfaceLintResult(result)).toContain(
      'warning member-interaction actions:'
    );
  });

  it('says nothing when the app declares itself display-only', () => {
    const declared = SUPPLEMENTARY_FIXTURES.memberInteractionDeclared;
    const result = lintSurfaceBundle({
      bundleSource: declared.bundleSource,
      spec: declared.spec,
    });
    expect(result.violations).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(formatSurfaceLintResult(result)).toBe('');
  });

  it('says nothing about an app with even one member action', () => {
    // The other arm of the fulcrum: same bundle, one action added. Without
    // this, "warns" above would pass equally against a rule that warned on
    // every spec it was handed.
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: {
        ...BEACH_TRIP_SPLIT_SPEC,
        actions: {
          settle: { ops: [{ op: 'set', path: '/settled', value: 1 }] },
        },
      },
    });
    expect(ruleSet(result.warnings)).toEqual([]);
  });

  it('does not accept a marker that says something else', () => {
    // `mode` is an enum with one legal value on purpose. A truthy-but-wrong
    // value is an undeclared app, not a declared one — and so is the bare
    // string the marker used to be, which is what makes this an upgrade rather
    // than a rename.
    for (const value of [
      'none',
      'None',
      'members',
      true,
      1,
      null,
      { mode: 'None', because: 'x' },
      { mode: 'members', because: 'x' },
    ]) {
      const result = lintSurfaceBundle({
        bundleSource: fixture.bundleSource,
        spec: { ...BEACH_TRIP_SPLIT_SPEC, memberInteraction: value },
      });
      expect(ruleSet(result.warnings)).toEqual(['member-interaction']);
    }
  });

  /**
   * The reason the marker costs a sentence.
   *
   * The first app ever to carry `memberInteraction` was the app this rule was
   * written to catch: the same expense split, shipped inert a SECOND time, one
   * session after the failure was named — declared this time, so the warning
   * never fired. The marker was in the first spec written, before any lint
   * ran, copied out of the doctrine's example. A marker that costs nothing to
   * write gets written.
   *
   * `because` cannot be checked by a machine and is not trying to be. What it
   * does is make an author who cannot name the host event notice that they
   * cannot, while they are typing.
   */
  it('a bare marker with no reason silences nothing, and says what is missing', () => {
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: { ...BEACH_TRIP_SPLIT_SPEC, memberInteraction: { mode: 'none' } },
    });
    expect(ruleSet(result.warnings)).toEqual(['member-interaction']);
    expect(result.warnings[0].specPath).toBe('memberInteraction');
    expect(result.warnings[0].message).toContain('no "because"');
    expect(result.warnings[0].message).toContain('Name the host event');
  });

  it('an empty or whitespace reason is not a reason', () => {
    for (const because of ['', '   ', '\n']) {
      const result = lintSurfaceBundle({
        bundleSource: fixture.bundleSource,
        spec: {
          ...BEACH_TRIP_SPLIT_SPEC,
          memberInteraction: { mode: 'none', because },
        },
      });
      expect(ruleSet(result.warnings)).toEqual(['member-interaction']);
    }
  });
});

/* ------------------------------------------------------------------ */
/* rule 16 — time                                                      */
/* ------------------------------------------------------------------ */

/**
 * Two legs, and the suite is arranged so neither can be mistaken for the
 * other. The lexical leg refuses the clock BY NAME; the behavioral leg
 * compares two renders a day apart. Each has a fixture the other cannot see,
 * which is the whole argument for keeping both.
 */
describe('rule 16 — time is a host input, never an ambient one', () => {
  it('refuses a clock read whose painted value never changes', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.ambientDateRead;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['time-display']);
    expect(result.violations[0].message).toContain('Date is forbidden');
    // and the line, so a repair loop knows where to look
    expect(result.violations[0].line).toBeGreaterThan(0);
  });

  /**
   * The reason the lexical leg is not redundant, stated as an assertion: this
   * bundle's painted output is IDENTICAL at both clock readings, so the
   * differential probe reports nothing about it. Only the name gives it away.
   */
  it('catches it where the behavioral probe is blind by construction', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.ambientDateRead;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      // declaring the flag removes any chance the behavioral leg is what fired
      spec: {
        ...(fixture.spec as object),
        timeDisplay: { refreshSeconds: 60 },
      },
    });
    expect(ruleSet(result.violations)).toEqual(['time-display']);
    expect(result.violations.every((v) => v.message.includes('Date'))).toBe(
      true
    );
    // the behavioral leg's own finding is a WARNING and is not what we caught
    expect(result.violations.every((v) => v.severity === 'error')).toBe(true);
  });

  it('refuses a self-scheduled repaint', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.ambientTimer;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(ruleSet(result.violations)).toEqual(['time-display']);
    expect(result.violations[0].message).toContain('setTimeout/setInterval');
  });

  /**
   * Comments are not code. Five shipped templates carry a line saying "this
   * app never calls `Date`", and a rule that fired on those would make its own
   * doctrine unwritable.
   */
  it('does not fire on the word in a comment', () => {
    const result = lintSurfaceBundle({
      bundleSource: `// this app never calls Date, and never sets an interval\n${COMPLIANT_FIXTURE.bundleSource}`,
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(ruleSet(result.violations)).toEqual([]);
  });

  it('accepts a clock-derived screen that declares the flag', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.timeDisplayDeclared;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('warns when the flag is declared by a screen that never moves', () => {
    const fixture = SUPPLEMENTARY_FIXTURES.timeDisplayDeclaredButStatic;
    const result = lintSurfaceBundle({
      bundleSource: fixture.bundleSource,
      spec: fixture.spec,
    });
    expect(result.ok).toBe(true);
    expect(ruleSet(result.warnings)).toEqual(['time-display']);
    expect(result.warnings[0].specPath).toBe('timeDisplay');
  });
});

/* ------------------------------------------------------------------ */
/* Rule 17 — a count and its noun have to agree                        */
/* ------------------------------------------------------------------ */

describe('rule 17 — a number rendered against a plural noun', () => {
  const lintNouns = (bundleSource: string, extra?: readonly string[]) =>
    lintSurfaceBundle({
      bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
      ...(extra === undefined ? {} : { extraCountNouns: extra }),
    });

  it('quotes the offending words and the run they came from', () => {
    const result = lintNouns(COUNT_AGREEMENT_BUNDLE);
    const found = result.violations.filter(
      (violation) => violation.rule === 'count-agreement'
    );
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('"1 people"');
    // The evidence is what was ON SCREEN, so the report can be checked
    // against the app without re-running it.
    expect(found[0].evidence).toBe('1 people signed up');
  });

  it('goes quiet when the word is picked from the number', () => {
    // The precision half. Same app, same state, same two words in the same
    // element — only the singular is handled — so a rule that read the shape
    // rather than the agreement would say the same thing about both.
    const result = lintNouns(COUNT_AGREEMENT_REPAIRED_BUNDLE);
    expect(ruleSet(result.violations)).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('leaves a Stat alone: its value and its label are two elements', () => {
    // The compliant baseline already renders `Stat value="1" label="signed
    // up"`, which reads "1 / signed up" on screen and is how every dashboard
    // writes a stat. Three shipped templates depend on this staying quiet —
    // `poll` paints "votes so far", `leaderboard` "rounds played", `potluck`
    // "bringing something" — so a rule that folded the two spans together
    // would refuse the templates it is supposed to be teaching from.
    expect(COMPLIANT_FIXTURE.bundleSource).toContain(COMPLIANT_SIGNUP_STAT);
    const result = lintNouns(COMPLIANT_FIXTURE.bundleSource);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('draws it on the board that shipped it, off the vendored artifact', () => {
    // The real control, not a synthetic one: the bundle the bot published to
    // `chat/~zod/dash-gm1ekjow`, byte for byte.
    //
    // It is also what pins the leaf-run reading. This board paints
    // `Choose a column on any task to update the shared board.` in one `div`
    // and the badge in the next, so the whole-tree `textContent` the jargon
    // rule reads is `…the shared board.1 people active` — where the count sits
    // behind a full stop and the pattern's left boundary rejects it. Read the
    // element's OWN run and it is `1 people active`, which is what a member
    // sees.
    const result = lintSurfaceBundle({
      bundleSource: KANBAN_ALL_COLUMNS_BUNDLE,
      spec: KANBAN_ALL_COLUMNS_SPEC,
    });
    const drawn = result.violations.filter(
      (entry) => entry.rule === 'count-agreement'
    );
    expect(drawn).toHaveLength(1);
    expect(drawn[0].evidence).toBe('1 people active');
    // The badge is absent from the opening screen — `claims` starts empty — so
    // this is only ever reachable through activation.
    expect(drawn[0].message).toContain('after invoking');
  });

  it('does not invent a count by gluing two elements together', () => {
    const result = lintNouns(COUNT_GLUE_BAIT_BUNDLE);
    expect(
      result.violations.filter((entry) => entry.rule === 'count-agreement')
    ).toEqual([]);
  });

  it('holds all three boundaries: 31 people, 0.1 people, 1 peoples', () => {
    const result = lintNouns(COUNT_NEAR_MISS_BUNDLE);
    expect(
      result.violations.filter((entry) => entry.rule === 'count-agreement')
    ).toEqual([]);
  });

  it('does not fire on a count that is not one', () => {
    const twoSignedUp = {
      ...(COMPLIANT_FIXTURE.spec as Record<string, unknown>),
      initialState: {
        bringing: { '~zod': 'bread', '~sampel-palnet': 'salad' },
      },
    };
    const result = lintSurfaceBundle({
      bundleSource: COUNT_AGREEMENT_BUNDLE,
      spec: twoSignedUp,
    });
    expect(
      result.violations.filter((entry) => entry.rule === 'count-agreement')
    ).toEqual([]);
  });

  it('the shipped templates draw nothing, and that is the list and not luck', () => {
    // Direction (b), and the reason it is a real control rather than an empty
    // one. `expense-split` paints "a head, split 1 ways" — a genuine
    // agreement defect, in the TEMPLATE, that the curated list deliberately
    // does not claim because "split N ways" counts people and not ways, and
    // widening to idiomatic adverbials is the road to a general `1 \w+s`
    // pattern that fires on "1 status". Hand the rule that one word and the
    // template fails, which is what proves the quiet result above is a
    // property of `SURFACE_COUNT_NOUNS` and not of a rule that never runs.
    const dir = path.join(
      __dirname,
      '..',
      'skills',
      'surfaces',
      'templates',
      'expense-split'
    );
    const bundleSource = fs.readFileSync(path.join(dir, 'app.js'), 'utf-8');
    const spec = JSON.parse(
      fs.readFileSync(path.join(dir, 'spec.json'), 'utf-8')
    );

    const asShipped = lintSurfaceBundle({ bundleSource, spec });
    expect(
      asShipped.violations.filter((entry) => entry.rule === 'count-agreement')
    ).toEqual([]);

    const widened = lintSurfaceBundle({
      bundleSource,
      spec,
      extraCountNouns: ['ways'],
    });
    const drawn = widened.violations.filter(
      (entry) => entry.rule === 'count-agreement'
    );
    expect(drawn).toHaveLength(1);
    expect(drawn[0].message).toContain('"1 ways"');
    // …and the clean assertion above would fail on it.
    expect(() => expect(drawn).toEqual([])).toThrow();
  });

  it('is skipped, not silently passed, when nothing could be rendered', () => {
    const result = lintSurfaceBundle({
      bundleSource: 'import x from "y";',
      spec: COMPLIANT_FIXTURE.spec,
    });
    expect(
      result.skipped.map((entry) => entry.rule).includes('count-agreement')
    ).toBe(true);
  });
});

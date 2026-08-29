import { describe, expect, it } from 'bun:test';
import { Window } from 'happy-dom';

// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { wrapBundleSource } from '@tloncorp/surface-shell/sandbox';

import {
  ALL_FIXTURES,
  COMPLIANT_FIXTURE,
  RULE_FIXTURES,
  SUPPLEMENTARY_FIXTURES,
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

describe('surface publish gate — one fixture per rule', () => {
  it('covers every declared rule with a fixture', () => {
    const covered = new Set(RULE_FIXTURES.map((fixture) => fixture.rule));
    const uncovered = SURFACE_LINT_RULES.filter((rule) => !covered.has(rule));
    expect(uncovered).toEqual([]);
  });

  it('has no duplicate fixture names', () => {
    const names = ALL_FIXTURES.map((fixture) => fixture.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const fixture of RULE_FIXTURES) {
    it(`${fixture.name}: trips ${fixture.rule} and nothing else (${fixture.defect})`, () => {
      const result = lintSurfaceBundle({
        bundleSource: fixture.bundleSource,
        spec: fixture.spec,
      });

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
      'smoke-render',
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
    expect(result.skipped).toHaveLength(3);
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
  it('uses the injected window factory', () => {
    let built = 0;
    const result = lintSurfaceBundle({
      bundleSource: COMPLIANT_FIXTURE.bundleSource,
      spec: COMPLIANT_FIXTURE.spec,
      createWindow: () => {
        built += 1;
        return new Window();
      },
    });
    expect(built).toBe(1);
    expect(result.ok).toBe(true);
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

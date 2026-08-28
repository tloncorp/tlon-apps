import type { SurfaceLintRule } from './surface-lint';

/**
 * The publish gate's self-test corpus: one bundle+spec pair per rule that
 * violates EXACTLY that rule, plus one fully compliant pair that passes
 * clean.
 *
 * The "exactly" is the point. A suite that only asserts "some violation was
 * found" cannot tell a working rule from a rule that never fires and a
 * neighbour that over-reaches, and a rule with no fixture proving it fires
 * is a rule nobody can claim works. Each fixture below is the compliant
 * baseline plus one defect, so any extra rule firing is a false positive in
 * that rule and any missing rule is a hole in this one.
 *
 * Fixtures live as source strings rather than files so line numbers are
 * stable, the suite stays hermetic, and the corpus is importable by whatever
 * wraps the gate next (`surface lint`, the CI template sweep).
 */

export interface SurfaceLintFixture {
  name: string;
  /** the rule this fixture must trip — and the only rule it may trip */
  rule: SurfaceLintRule | null;
  bundleSource: string;
  spec: unknown;
  /** what the defect is, for the failure message when it stops firing */
  defect: string;
}

const SHA256 = 'a'.repeat(64);

function baseSpec(): Record<string, unknown> {
  return {
    version: 1,
    surfaceId: 'srf-potluck',
    specRevision: 1,
    title: 'Potluck',
    bundle: {
      assetRef: 'storage://bundles/potluck.js',
      sha256: SHA256,
      size: 2048,
      shellVersion: 1,
    },
    initialState: {
      bringing: {
        // A ship as an object KEY INSIDE A VALUE is bare. The same ship in a
        // pointer PATH would need `~0zod` (D51). Rule 8 must not confuse the
        // two, so the compliant fixture carries the bare form on purpose.
        '~zod': 'bread',
      },
    },
    actions: {
      'bring-salad': {
        ops: [{ op: 'set', path: '/bringing/$actor', value: 'salad' }],
      },
    },
  };
}

/**
 * The compliant baseline every fixture is derived from: a plain script that
 * registers one pure render, composes only shell primitives, and drives an
 * idempotent per-member action.
 */
const COMPLIANT_BUNDLE = `(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;

  surface.register({
    render(state) {
      const bringing = state.bringing || {};
      const names = Object.keys(bringing);
      return html\`
        <\${Card} title="Potluck">
          <\${SectionHeader}>Who is bringing what<//>
          \${names.map(
            (name) => html\`
              <\${ListRow}>\${name} is bringing \${bringing[name]}<//>
            \`
          )}
          <\${Button}
            disabled=\${!canInvoke()}
            onPress=\${() => invoke('bring-salad')}
          >
            I will bring salad
          <//>
          <\${Stat} value=\${String(names.length)} label="signed up" />
        <//>
      \`;
    },
  });
})();
`;

/** Swap one span of the baseline for a defective one. */
function mutateBundle(from: string, to: string): string {
  if (!COMPLIANT_BUNDLE.includes(from)) {
    throw new Error(`fixture anchor not present in the baseline: ${from}`);
  }
  return COMPLIANT_BUNDLE.replace(from, to);
}

const SECTION_HEADER = '<${SectionHeader}>Who is bringing what<//>';

export const COMPLIANT_FIXTURE: SurfaceLintFixture = {
  name: 'compliant',
  rule: null,
  bundleSource: COMPLIANT_BUNDLE,
  spec: baseSpec(),
  defect: 'none — this one must pass clean',
};

export const RULE_FIXTURES: SurfaceLintFixture[] = [
  {
    name: 'byte-cap',
    rule: 'byte-cap',
    // padded inside a comment so no other rule can see the padding
    bundleSource: `${COMPLIANT_BUNDLE}\n/* ${'x'.repeat(280 * 1024)} */\n`,
    spec: baseSpec(),
    defect: 'bundle exceeds the 256 KB cap',
  },
  {
    name: 'module-syntax',
    rule: 'module-syntax',
    bundleSource: `${COMPLIANT_BUNDLE}\nexport const buildStamp = 1;\n`,
    spec: baseSpec(),
    defect: 'top-level export makes the bundle a module, not a plain script',
  },
  {
    name: 'external-reference',
    rule: 'external-reference',
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<img src="https://example.com/logo.png" />'
    ),
    spec: baseSpec(),
    defect: 'an <img> pulls bytes from outside the bundle',
  },
  {
    name: 'forbidden-api',
    rule: 'forbidden-api',
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const refresh = () => fetch("/potluck.json");'
    ),
    spec: baseSpec(),
    defect: 'calls fetch()',
  },
  {
    name: 'navigation-vector',
    rule: 'navigation-vector',
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<a href="https://example.com/potluck">Full menu</a>'
    ),
    spec: baseSpec(),
    defect: 'an anchor navigates the frame',
  },
  {
    name: 'entry-point',
    rule: 'entry-point',
    bundleSource: mutateBundle(
      '  surface.register({\n',
      '  const app = {\n'
    ).replace('  });\n})();', '  };\n  void app;\n})();'),
    spec: baseSpec(),
    defect: 'never calls surface.register({ render })',
  },
  {
    name: 'undeclared-action',
    rule: 'undeclared-action',
    bundleSource: mutateBundle(
      "invoke('bring-salad')",
      "invoke('bring-dessert')"
    ),
    spec: baseSpec(),
    defect: 'invokes an action the spec does not declare',
  },
  {
    name: 'pointer-hygiene',
    rule: 'pointer-hygiene',
    bundleSource: COMPLIANT_BUNDLE,
    spec: (() => {
      const spec = baseSpec();
      (spec.actions as Record<string, { ops: unknown[] }>)['bring-salad'].ops =
        [{ op: 'set', path: '/bringing/~sampel-palnet', value: 'salad' }];
      return spec;
    })(),
    defect: 'a raw ~ in a pointer segment; must be ~0 (D51)',
  },
  {
    name: 'spec-schema',
    rule: 'spec-schema',
    bundleSource: COMPLIANT_BUNDLE,
    spec: (() => {
      const spec = baseSpec();
      (spec.bundle as Record<string, unknown>).sha256 = 'not-a-hash';
      return spec;
    })(),
    defect: 'bundle.sha256 is not a 64-char hex digest',
  },
  {
    name: 'style',
    rule: 'style',
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<div style="font-family: Comic Sans MS; color: #ff0000; box-shadow: 0 0 4px">Menu</div>'
    ),
    spec: baseSpec(),
    defect: 'picks a font, a literal color, and a non-layout property',
  },
  {
    name: 'chart-sizing',
    rule: 'chart-sizing',
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<canvas width="480" height="320"></canvas>'
    ),
    spec: baseSpec(),
    defect: 'a canvas pinned to pixel dimensions',
  },
  {
    name: 'jargon',
    rule: 'jargon',
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<${SectionHeader}>Signups since the last rollover<//>'
    ),
    spec: baseSpec(),
    defect: 'user-facing copy narrates the mechanism (D55)',
  },
  {
    name: 'smoke-render',
    rule: 'smoke-render',
    bundleSource: mutateBundle(
      '      const bringing = state.bringing || {};',
      "      throw new Error('deliberate failure');"
    ),
    spec: baseSpec(),
    defect: 'render() throws on the initial state',
  },
  {
    name: 'action-idempotency',
    rule: 'action-idempotency',
    bundleSource: COMPLIANT_BUNDLE,
    spec: (() => {
      const spec = baseSpec();
      (spec.initialState as Record<string, unknown>).log = [];
      (spec.actions as Record<string, unknown>)['add-note'] = {
        ops: [{ op: 'append', path: '/log', value: '$actor' }],
      };
      return spec;
    })(),
    defect: 'an append action with no duplicatesTolerated marking (D54)',
  },
];

/**
 * Extra fixtures that are not the one-per-rule corpus: each proves a
 * specific leg of a rule, or a specific NON-violation the rule must not
 * report.
 */
export const SUPPLEMENTARY_FIXTURES = {
  /** the responsive leg of rule 11, reached through the raw escape hatch */
  rawChartNotResponsive: {
    name: 'raw-chart-not-responsive',
    rule: 'chart-sizing' as SurfaceLintRule,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      "<canvas ref=${(el) => { if (el) { new surface.Chart(el, { type: 'bar', data: { datasets: [] }, options: { responsive: false, maintainAspectRatio: true } }); } }}></canvas>"
    ),
    spec: baseSpec(),
    defect: 'a live chart built with responsive: false',
  } satisfies SurfaceLintFixture,

  /** the same append action, correctly marked — must pass clean */
  appendTolerated: {
    name: 'append-duplicates-tolerated',
    rule: null,
    bundleSource: COMPLIANT_BUNDLE,
    spec: (() => {
      const spec = baseSpec();
      (spec.initialState as Record<string, unknown>).log = [];
      (spec.actions as Record<string, unknown>)['add-note'] = {
        ops: [{ op: 'append', path: '/log', value: '$actor' }],
        duplicatesTolerated: true,
      };
      return spec;
    })(),
    defect: 'none — the declared escape hatch must actually work',
  } satisfies SurfaceLintFixture,

  /** a computed invoke argument: a warning, never an error */
  computedInvoke: {
    name: 'computed-invoke',
    rule: null,
    bundleSource: mutateBundle(
      "invoke('bring-salad')",
      'invoke(state.actionId)'
    ),
    spec: baseSpec(),
    defect: 'none — a computed invoke id is unverifiable, not wrong',
  } satisfies SurfaceLintFixture,
};

export const ALL_FIXTURES: SurfaceLintFixture[] = [
  COMPLIANT_FIXTURE,
  ...RULE_FIXTURES,
];

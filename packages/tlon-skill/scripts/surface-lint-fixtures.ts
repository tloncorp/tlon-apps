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

  /**
   * The chart oracle's root defect (finding 6), and the demonstration that
   * activating controls is load-bearing.
   *
   * The chart is constructed responsively — the old oracle read the
   * CONSTRUCTOR CONFIG and passed this bundle clean — and then reassigned
   * on press. Both halves are needed to trip it: without the live-instance
   * read there is nothing wrong in the saved config, and without the click
   * the reassignment never runs. The `new surface.Chart(` grep still fires
   * as a warning, which is the same rule and never the gate.
   */
  chartReassignedOnPress: {
    name: 'chart-options-reassigned-on-press',
    rule: 'chart-sizing' as SurfaceLintRule,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      "<canvas ref=${(el) => { if (el) { held = new surface.Chart(el, { type: 'bar', data: { datasets: [] }, options: { responsive: true, maintainAspectRatio: false } }); } }}></canvas>\n          <${Button} onPress=${() => { held.options = { responsive: false, maintainAspectRatio: true }; }}>Resize<//>"
    ).replace(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  let held = null;'
    ),
    spec: baseSpec(),
    defect: 'a chart made responsive at construction and unmade on press',
  } satisfies SurfaceLintFixture,

  /**
   * A control whose handler throws. There is no lexical form of this
   * defect: the only way to find out is to press the button, and the DOM
   * swallows the exception, so the gate has to watch for it.
   */
  handlerThrows: {
    name: 'handler-throws-on-press',
    rule: 'smoke-render' as SurfaceLintRule,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      "<${Button} onPress=${() => { throw new Error('nothing to show'); }}>Details<//>"
    ),
    spec: baseSpec(),
    defect: 'pressing a control throws, which only activation can see',
  } satisfies SurfaceLintFixture,

  /**
   * The platform navigation API an audit found unmodeled: it moves the
   * frame without ever touching `location`, so every pattern the rule had
   * passed it clean — verified with the request leaving the frame in
   * Chromium while the gate reported `ok`.
   */
  navigationApi: {
    name: 'navigation-api',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const leave = () => window.navigation.navigate("https://example.com/menu");\n  void leave;'
    ),
    spec: baseSpec(),
    defect: 'window.navigation.navigate() navigates without touching location',
  } satisfies SurfaceLintFixture,

  /** the same API in its bare spelling, with nothing binding the name */
  bareNavigationApi: {
    name: 'navigation-api-bare',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const leave = () => navigation.navigate("https://example.com/menu");\n  void leave;'
    ),
    spec: baseSpec(),
    defect: 'navigation.navigate() reaches the same global unqualified',
  } satisfies SurfaceLintFixture,

  /**
   * `<area href>`: rule 3 skips an `href` on `a` AND `area` as "navigation,
   * handled by rule 5", and rule 5's anchor pattern only matched `<a`. The
   * tag was handled by neither and passed the whole gate.
   */
  areaHref: {
    name: 'area-href',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<map name="m"><area shape="rect" href="https://example.com/menu" /></map>'
    ),
    spec: baseSpec(),
    defect: 'an <area> href is a link out that neither rule 3 nor 5 saw',
  } satisfies SurfaceLintFixture,

  /**
   * htm's spread form supplies the attributes from an object, so no
   * attribute NAME is in the markup and the literal patterns see only
   * `<a `. Caught twice over now: lexically at the tail of the span, and
   * behaviorally as an anchor in the rendered DOM.
   */
  spreadAnchor: {
    name: 'spread-anchor',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      "<a ...${{ href: 'https://example.com/menu' }}>Full menu</a>"
    ),
    spec: baseSpec(),
    defect: 'an anchor whose href is supplied by a spread prop',
  } satisfies SurfaceLintFixture,

  /**
   * The imperative markup routes — `document.write`'s trick spelled
   * without `document.write`. Whatever goes in is markup no span ever
   * separated, so a meta refresh or an anchor inside it is invisible.
   */
  imperativeMarkup: {
    name: 'imperative-markup',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const paint = (el, text) => { el.innerHTML = text; };\n  void paint;'
    ),
    spec: baseSpec(),
    defect: 'innerHTML injects markup no rule scanned',
  } satisfies SurfaceLintFixture,

  /** the same route through insertAdjacentHTML */
  insertAdjacentMarkup: {
    name: 'insert-adjacent-markup',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const paint = (el, text) => { el.insertAdjacentHTML("beforeend", text); };\n  void paint;'
    ),
    spec: baseSpec(),
    defect: 'insertAdjacentHTML injects markup no rule scanned',
  } satisfies SurfaceLintFixture,

  /**
   * FALSE POSITIVE, now passing: a potluck with a `location` field. The
   * bare identifier is what rule 5 used to match, and it is shadowed at
   * runtime by `wrapBundleSource`, so nothing was ever protected by
   * flagging it — while "location" is what a potluck, a meetup or an event
   * app calls the place it happens.
   */
  locationField: {
    name: 'data-field-named-location',
    rule: null,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<${SectionHeader}>Who is bringing what<//>\n          <${ListRow}>We are meeting at ${state.location}<//>'
    ),
    spec: (() => {
      const spec = baseSpec();
      (spec.initialState as Record<string, unknown>).location =
        'the big table by the window';
      return spec;
    })(),
    defect: 'none — `location` is an ordinary field name, not a vector',
  } satisfies SurfaceLintFixture,

  /**
   * FALSE POSITIVE, now passing: a modal with an `open` function. Both
   * spellings the rule used to trip on are here — the declaration and the
   * method shorthand — plus the call, which is the part that made this
   * unavoidable for any app with a drawer.
   */
  modalOpen: {
    name: 'modal-with-an-open-function',
    rule: null,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  function open(id) { return "Showing " + id; }\n  const drawer = { open() { return open("the menu"); } };'
    ).replace(
      SECTION_HEADER,
      '<${SectionHeader}>${drawer.open()}<//>\n          <${ListRow}>${open("the sign-up sheet")}<//>'
    ),
    spec: baseSpec(),
    defect: "none — a declared `open` is the app's own, not window.open",
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

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
  /**
   * The severity the fixture's rule reports at; `error` when omitted.
   *
   * A warning-severity rule can never make `ok` false, so the per-rule
   * assertion has to expect a DIFFERENT outcome for it — a gate that passes,
   * carrying exactly one warning. Declared per fixture rather than inferred
   * from the result, because inferring it from the result is how a rule that
   * silently downgrades to a warning keeps its test green.
   */
  severity?: 'error' | 'warning';
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

/**
 * A jargon term (D55) assembled from pieces, as a source EXPRESSION.
 *
 * No string span of the bundle contains "scratch", so the lexical half of
 * rule 12 is blind to it and only a handler that actually runs can put it
 * on screen. That makes it the right defect to hide behind a control the
 * gate may or may not reach: if the gate reports it, the control was
 * pressed; if the gate reports nothing, it was not — and from the outside
 * the two are otherwise indistinguishable.
 */
const DEFERRED_JARGON = '"No " + "scr" + "atch" + " entries yet"';

/* ------------------------------------------------------------------ */
/* Rule 15's fixture: a real shipped app, read back off the channel     */
/* ------------------------------------------------------------------ */

/**
 * `chat/~zod/beach-trip-split`, exactly as session 6a.5 published it —
 * fetched with `surface show --bundle-out` (which hash-verifies against the
 * definition before writing) rather than written here from memory.
 *
 * It is the incident rule 15 exists for: an expense split that renders a
 * "Who owes what" card and declares `actions: {}`, so no member can add an
 * expense to it. It passed every gate rule and rubric check 7. The gate's
 * whole output for it was empty.
 *
 * `BEACH_TRIP_SPLIT_SHA256` is the sha256 the published definition pins, and
 * `surface-lint.test.ts` re-hashes the string below against it. That is what
 * makes "this fixture IS the shipped app" a checked claim rather than a
 * comment: an edit to the source string, however small, breaks the hash.
 */
export const BEACH_TRIP_SPLIT_SHA256 =
  'ea79c417ffa51e1b1cd660652782934fc61ccb502c05fce254d054548f0837c3';

export const BEACH_TRIP_SPLIT_BUNDLE = `(function () {
  const { html, primitives } = surface;
  const { Card, ListRow, Stat, SectionHeader, Badge, Avatar, EmptyState } = primitives;

  const cents = function (value) {
    return Math.round(value);
  };

  const money = function (value) {
    const sign = value < 0 ? '-' : '';
    const absolute = Math.abs(value);
    return sign + '$' + String(Math.floor(absolute / 100)) + '.' + String(absolute % 100).padStart(2, '0');
  };

  surface.register({
    render(state) {
      const people = Array.isArray(state.people) ? state.people : [];
      const expenses = Array.isArray(state.expenses) ? state.expenses : [];
      const paid = {};
      for (const person of people) paid[person.ship] = 0;
      for (const expense of expenses) {
        if (expense && typeof expense.paidBy === 'string') {
          paid[expense.paidBy] = cents((paid[expense.paidBy] || 0) + cents(expense.amountCents || 0));
        }
      }
      const total = people.reduce(function (sum, person) { return sum + (paid[person.ship] || 0); }, 0);
      const share = people.length === 0 ? 0 : Math.floor(total / people.length);

      return html\`
        <\${Card} title=\${state.title || 'Beach trip split'}>
          <\${Stat} value=\${money(total)} label="total trip costs" hint="split equally between everyone" />
          <\${SectionHeader}>What was paid<//>
          \${expenses.length === 0
            ? html\`<\${EmptyState} title="No expenses yet" description="Add the trip costs to see who owes what." />\`
            : expenses.map(function (expense) {
                return html\`
                  <\${ListRow}
                    left=\${html\`<\${Avatar} ship=\${expense.paidBy} />\`}
                    right=\${html\`<\${Badge}>\${money(expense.amountCents || 0)}<//>\`}
                  >
                    <div>\${expense.label || 'Trip expense'}</div>
                    <div>Paid by \${expense.paidBy}</div>
                  <//>
                \`;
              })}
        <//>

        <\${Card} title="Who owes what">
          <\${SectionHeader}>Equal share: \${money(share)} each<//>
          \${people.length === 0
            ? html\`<\${EmptyState} title="Nobody added yet" description="Add the travelers to calculate the split." />\`
            : people.map(function (person) {
                const balance = (paid[person.ship] || 0) - share;
                const label = balance > 0 ? 'gets back ' + money(balance) : balance < 0 ? 'owes ' + money(-balance) : 'settled up';
                return html\`
                  <\${ListRow}
                    left=\${html\`<\${Avatar} ship=\${person.ship} />\`}
                    right=\${html\`<\${Badge} tone=\${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}>\${label}<//>\`}
                  >
                    <div>\${person.ship}</div>
                    <div>Paid \${money(paid[person.ship] || 0)}</div>
                  <//>
                \`;
              })}
        <//>
      \`;
    },
  });
})();
`;

/** The verbatim `surfaceSpec` cell, as `surface show` served it. */
export const BEACH_TRIP_SPLIT_SPEC: Record<string, unknown> = {
  version: 1,
  surfaceId: 'srf-beach-split',
  title: 'Beach trip split',
  initialState: {
    title: 'Beach trip split',
    people: [
      {
        ship: '~ten',
      },
      {
        ship: '~zod',
      },
    ],
    expenses: [
      {
        paidBy: '~ten',
        amountCents: 24000,
        label: 'House',
      },
      {
        paidBy: '~zod',
        amountCents: 9000,
        label: 'Gas',
      },
      {
        paidBy: '~zod',
        amountCents: 6000,
        label: 'Groceries',
      },
    ],
  },
  actions: {},
  recipe:
    "A shared beach-trip expense split for two travelers. The board lists fixed trip expenses and derives an equal share and each person's balance from integer cents. Positive balances mean money back; negative balances mean money owed. The initial board records the house, gas, and groceries already paid.",
  specRevision: 1,
  bundle: {
    assetRef:
      'http://127.0.0.1:4323/ea79c417ffa51e1b1cd660652782934fc61ccb502c05fce254d054548f0837c3.js',
    sha256: 'ea79c417ffa51e1b1cd660652782934fc61ccb502c05fce254d054548f0837c3',
    size: 2974,
    shellVersion: 1,
  },
};

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
  {
    name: 'member-interaction',
    rule: 'member-interaction',
    severity: 'warning',
    // The shipped app, not a reconstruction of it. Every other fixture here
    // is the compliant baseline plus one injected defect; this one is the
    // defect as it actually reached a channel, which is why it is worth the
    // bytes.
    bundleSource: BEACH_TRIP_SPLIT_BUNDLE,
    spec: BEACH_TRIP_SPLIT_SPEC,
    defect:
      'a published expense split with actions: {} — no member can add an expense, and nothing said so',
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
   * Rule 15's escape hatch: the same zero-action app, declared.
   *
   * A countdown-shaped surface — nothing a member can press, state moved by
   * host events — is a legitimate app, and the rule's job is to make that a
   * DECLARED shape rather than an accident. The two fixtures differ in
   * exactly one key, so the warning is attributable to the declaration and
   * to nothing else about the pair.
   */
  memberInteractionDeclared: {
    name: 'member-interaction-declared',
    rule: null,
    bundleSource: BEACH_TRIP_SPLIT_BUNDLE,
    spec: { ...BEACH_TRIP_SPLIT_SPEC, memberInteraction: 'none' },
    defect: 'none — the declared display-only marker must actually work',
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
   * The same markup route with the operator markup is actually accumulated
   * with. The pattern demanded a BARE `=`, so `+=` — the reason to reach
   * for `innerHTML` in the first place, since it is how a loop appends
   * rows — walked past a rule that stopped the plain assignment cold.
   */
  compoundMarkupAssignment: {
    name: 'compound-markup-assignment',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const addRow = (el, text) => { el.innerHTML += text; };\n  void addRow;'
    ),
    spec: baseSpec(),
    defect: 'innerHTML += accumulates markup no rule scanned',
  } satisfies SurfaceLintFixture,

  /**
   * `window.frames === window`, so this is `window.open`. The rule stopped
   * `frames.location` because that detector read the shared receiver list,
   * and let `frames.open` through because the `open` detector carried a
   * shorter hardcoded one. Two lists in one function.
   */
  framesOpen: {
    name: 'frames-open',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const go = () => frames.open("https://example.com/menu");\n  void go;'
    ),
    spec: baseSpec(),
    defect: 'frames.open is window.open through a receiver the list omitted',
  } satisfies SurfaceLintFixture,

  /**
   * The window reached through the DOM rather than through a global.
   * `ownerDocument`, `defaultView` and `contentWindow` are how ref-driven
   * code arrives at the same Location, and none was in the receiver list.
   */
  ownerDocumentLocation: {
    name: 'owner-document-location',
    rule: 'navigation-vector' as SurfaceLintRule,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const go = (el) => el.ownerDocument.location.replace("https://example.com/menu");\n  void go;'
    ),
    spec: baseSpec(),
    defect: 'a ref reaches the real Location through el.ownerDocument',
  } satisfies SurfaceLintFixture,

  /**
   * FALSE POSITIVE the widened operator must not introduce: READING
   * `innerHTML` injects nothing, and comparing two of them is not an
   * assignment at all. This is what the `(?!=)` in `ASSIGNMENT_OPERATOR`
   * protects, and without it the widening would fire on every `===`.
   */
  markupComparison: {
    name: 'markup-comparison',
    rule: null,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const same = (a, b) => a.innerHTML === b.innerHTML;\n  void same;'
    ),
    spec: baseSpec(),
    defect: 'none — reading innerHTML is not injecting markup',
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

  /**
   * The three routes where activation used to reach nothing while every
   * widened rule reported clean with ZERO skips.
   *
   * All three keep the baseline's Button, so the one declared action IS
   * invoked and the action-shaped shortfall stays silent — which is exactly
   * the condition under which a control the gate never pressed was
   * invisible. Each carries a real defect behind the unreachable control,
   * assembled from pieces so no string span holds it and only running the
   * handler can put it on screen.
   */

  /**
   * `el.onclick = fn` never calls `addEventListener`, so the recorder did
   * not see the element and the gate never pressed it. Recorded at the
   * property setter now, so the press lands and the defect is REPORTED —
   * not merely accounted for.
   */
  onClickProperty: {
    name: 'control-bound-through-the-onclick-property',
    rule: 'jargon' as SurfaceLintRule,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      `<div ref=\${(el) => { if (el) { el.onclick = () => { el.textContent = ${DEFERRED_JARGON}; }; } }}>Who is bringing what</div>`
    ),
    spec: baseSpec(),
    defect: 'a control bound by property, which addEventListener never sees',
  } satisfies SurfaceLintFixture,

  /**
   * A delegated listener on `document`. The recorder sees it; the pending
   * filter then drops it, because the rendered root does not contain the
   * document. The gate cannot press it and does not pretend to — it says
   * so, which is the whole change.
   */
  delegatedOnDocument: {
    name: 'control-delegated-onto-the-document',
    rule: null,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      '<div class="tile">Who is bringing what</div>'
    ).replace(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      `  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  document.addEventListener("click", (e) => { if (e.target.className === "tile") { e.target.textContent = ${DEFERRED_JARGON}; } });`
    ),
    spec: baseSpec(),
    defect: 'a delegated listener the gate cannot reach, and must report',
  } satisfies SurfaceLintFixture,

  /**
   * A listener on the shell root itself. It survives `contains` — a node
   * contains itself — is marked, and spends budget; then the click resolves
   * the marker with `root.querySelector`, which searches descendants and
   * never matches the root. The handler only fires when the root is the
   * target, so nothing bubbling into it stands in for the press.
   */
  boundOnTheRoot: {
    name: 'control-bound-on-the-shell-root',
    rule: null,
    bundleSource: mutateBundle(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      `  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  const shellRoot = document.querySelector(".tsh-root");\n  if (shellRoot) { shellRoot.addEventListener("click", (e) => { if (e.target === e.currentTarget) { e.target.textContent = ${DEFERRED_JARGON}; } }); }`
    ),
    spec: baseSpec(),
    defect: 'a root listener the click dispatcher cannot deliver to',
  } satisfies SurfaceLintFixture,

  /**
   * A DOCUMENTED GAP, pinned so it cannot be quietly re-described as
   * closed: the same reassignment as `chartReassignedOnPress`, deferred one
   * microtask. Every `inspect()` runs on the gate's synchronous stack, so
   * the microtask flushes after the result is already returned and this
   * passes clean. A timer passes for the same reason. `checkChartSizing`
   * carries why draining is neither available nor sufficient; if that ever
   * changes, this fixture fails and the doc has to be rewritten with it.
   */
  chartReassignedInMicrotask: {
    name: 'chart-options-reassigned-in-a-microtask',
    rule: null,
    bundleSource: mutateBundle(
      SECTION_HEADER,
      "<canvas ref=${(el) => { if (el) { held = new surface.Chart(el, { type: 'bar', data: { datasets: [] }, options: { responsive: true, maintainAspectRatio: false } }); } }}></canvas>\n          <${Button} onPress=${() => { Promise.resolve().then(() => { held.options = { responsive: false, maintainAspectRatio: true }; }); }}>Resize<//>"
    ).replace(
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;',
      '  const { Card, ListRow, Button, Stat, SectionHeader } = primitives;\n  let held = null;'
    ),
    spec: baseSpec(),
    defect:
      'NOT CAUGHT — a reassignment deferred past the gate’s synchronous stack',
  } satisfies SurfaceLintFixture,
};

export const ALL_FIXTURES: SurfaceLintFixture[] = [
  COMPLIANT_FIXTURE,
  ...RULE_FIXTURES,
];

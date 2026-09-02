import { beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  type PreviewContext,
  type PreviewFrame,
  type PreviewLauncher,
  type PreviewPage,
  renderSurfacePreview,
} from './surface-preview';
import type { PreviewCellObservation } from './surface-preview-defects';
import { REACHABILITY_CITED_CHECK } from './surface-rubric-artifact';

import {
  BYPASS_GRAPH,
  CHECKPOINT_GRAPH,
  DOUBLE_INVOKE_BUNDLE,
  DOUBLE_INVOKE_SPEC,
  FREE_GRAPH,
  KANBAN_ALL_COLUMNS_BUNDLE,
  KANBAN_ALL_COLUMNS_SPEC,
  KANBAN_OWN_COLUMN_DROPPED_BUNDLE,
  KANBAN_V2_BUNDLE,
  KANBAN_V2_SPEC,
  LOCKED_SCREEN_BUNDLE,
  LOCKED_SCREEN_SPEC,
  UNLOCKED_SCREEN_BUNDLE,
  fixtureSpec,
  syntheticGraph,
  syntheticSpec,
  syntheticSpecWithOps,
} from './surface-transition-fixtures';
import {
  ABSENT_VALUE,
  NESTED_VALUE,
  type ReachabilityOutcome,
  type ReachabilityReport,
  analyzeReachability,
  analyzeSurfaceReachability,
  dominators,
  formatReachabilityReport,
  mergePointerLabel,
  statePointers,
} from './surface-transitions';

/**
 * The reachability pass, held to the case it was built for.
 *
 * Its own file rather than an addition to `surface-preview.test.ts`: this pass
 * runs entirely in happy-dom, so none of it is browser-gated, and mixing it
 * into the file that owns the Chromium capture matrix would make a fast suite
 * look like a slow one.
 */

/* ------------------------------------------------------------------ */
/* The corpus, walked once                                             */
/* ------------------------------------------------------------------ */

const TEMPLATES_ROOT = path.join(
  __dirname,
  '..',
  'skills',
  'surfaces',
  'templates'
);

function templateNames(): string[] {
  return fs
    .readdirSync(TEMPLATES_ROOT)
    .filter(
      (entry) =>
        !entry.startsWith('.') &&
        fs.statSync(path.join(TEMPLATES_ROOT, entry)).isDirectory()
    )
    .sort();
}

/** D140's board is a 4096-state walk; memoised so it is paid for once. */
function once<T>(build: () => T): () => T {
  let value: T | undefined;
  let built = false;
  return () => {
    if (!built) {
      value = build();
      built = true;
    }
    return value as T;
  };
}

const kanbanV2 = once<ReachabilityOutcome>(() =>
  analyzeSurfaceReachability({
    bundleSource: KANBAN_V2_BUNDLE,
    spec: fixtureSpec(KANBAN_V2_SPEC),
  })
);

const walkTemplate = (name: string): ReachabilityOutcome => {
  const dir = path.join(TEMPLATES_ROOT, name);
  return analyzeSurfaceReachability({
    bundleSource: fs.readFileSync(path.join(dir, 'app.js'), 'utf-8'),
    spec: fixtureSpec(
      JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf-8'))
    ),
  });
};

// The GRAPHS are memoised, not just the reports: the `$actor`-exemption
// vacuity guard reads edges, and re-walking nine templates to look at them
// would pay the `kanban` template's three seconds a second time.
const templateWalks = once<Map<string, ReachabilityOutcome>>(() => {
  const walks = new Map<string, ReachabilityOutcome>();
  for (const name of templateNames()) {
    walks.set(name, walkTemplate(name));
  }
  return walks;
});

const templateReports = (): Map<string, ReachabilityReport> =>
  new Map(
    [...templateWalks()].map(([name, outcome]) => [name, outcome.report])
  );

/* ------------------------------------------------------------------ */
/* Control 1 — the case the pass exists for                            */
/* ------------------------------------------------------------------ */

describe('kanban-v2, the board D140 was written about', () => {
  // The walk is memoised, so whichever test runs first pays for all 4096
  // states. That put exactly one assertion over bun's 5s default on a CI
  // runner while every other test in this block read the memo in under a
  // millisecond. Paying it in a hook with its own budget attaches the timeout
  // to the work rather than to whichever assertion happens to be listed first.
  beforeAll(() => {
    kanbanV2();
  }, 120_000);

  it('closes: every reachable state explored, with the bound unspent', () => {
    const { report } = kanbanV2();
    expect(report.problem).toBeUndefined();
    expect(report.shortfalls).toEqual([]);
    expect(report.truncatedBy).toEqual([]);
    expect(report.closed).toBe(true);
    // Six cards over four columns, with one button each. The exact numbers are
    // pinned because a walk that quietly stopped composing presses would still
    // "close", on a much smaller graph.
    expect(report.nodeCount).toBe(4096);
    expect(report.edgeCount).toBe(24576);
    expect(report.depthReached).toBe(18);
  });

  it('draws the mandatory checkpoint: no card reaches Done except via Blocked', () => {
    const { report } = kanbanV2();
    const done = report.findings.find((finding) =>
      finding.key.includes('"done"')
    );
    expect(done).toBeDefined();
    expect(done?.kind).toBe('mandatory-checkpoint');
    expect(done?.rubricCheck).toBe(7);
    expect(done?.message).toContain('"done" at /tasks/*/status');
    expect(done?.message).toContain('"doing", then "blocked"');

    const checkpoint = report.checkpoints.find(
      (entry) => entry.value === '"done"'
    );
    expect(checkpoint?.through).toEqual(['"doing"', '"blocked"']);
    // Six identical findings collapsed behind one wildcard, with the concrete
    // pointers kept so the label is checkable.
    expect(checkpoint?.pointers).toHaveLength(6);
    expect(checkpoint?.pointers).toContain('/tasks/theme/status');
  });

  it('reports the value domain the columns actually take', () => {
    const { report } = kanbanV2();
    const status = report.valueDomains.find(
      (domain) => domain.pointer === '/tasks/*/status'
    );
    expect(status?.values).toEqual([
      '"blocked"',
      '"doing"',
      '"done"',
      '"todo"',
    ]);
    expect(status?.rootValue).toBe('"todo"');
    expect(status?.truncated).toBe(false);
  });

  it('finds no unreachable action — the defect is the ORDER, not a missing control', () => {
    const { report } = kanbanV2();
    expect(report.declaredActions).toHaveLength(24);
    expect(report.unreachedActions).toEqual([]);
    expect(
      report.findings.every(
        (finding) => finding.kind === 'mandatory-checkpoint'
      )
    ).toBe(true);
  });

  it('names the shape and the bound in the printed report', () => {
    const printed = formatReachabilityReport(kanbanV2().report).join('\n');
    expect(printed).toContain('closed: all 4096 reachable screen(s)');
    expect(printed).toContain('bounds: 24 presses deep');
    expect(printed).toContain('This pass did NOT check:');
  });
});

/* ------------------------------------------------------------------ */
/* Control 2 — a declared action no reachable control invokes          */
/* ------------------------------------------------------------------ */

describe('a declared action behind a screen nobody can reach', () => {
  const locked = once<ReachabilityOutcome>(() =>
    analyzeSurfaceReachability({
      bundleSource: LOCKED_SCREEN_BUNDLE,
      spec: fixtureSpec(LOCKED_SCREEN_SPEC),
    })
  );
  const unlocked = once<ReachabilityOutcome>(() =>
    analyzeSurfaceReachability({
      bundleSource: UNLOCKED_SCREEN_BUNDLE,
      spec: fixtureSpec(LOCKED_SCREEN_SPEC),
    })
  );

  it('is a closed walk, so the finding is an assertion and not a guess', () => {
    expect(locked().report.closed).toBe(true);
    expect(locked().report.nodeCount).toBe(4);
  });

  it('names exactly the action no control reaches', () => {
    const { report } = locked();
    expect(report.unreachedActions).toEqual(['reopen']);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].kind).toBe('unreachable-actions');
    expect(report.findings[0].rubricCheck).toBe(7);
    expect(report.findings[0].message).toContain('"reopen"');
  });

  it('goes quiet on the repaired twin, which differs by one condition', () => {
    const { report } = unlocked();
    expect(report.closed).toBe(true);
    expect(report.unreachedActions).toEqual([]);
    expect(report.reachedActions).toContain('reopen');
    expect(report.findings).toEqual([]);
  });

  it('composes presses — the repaired control is two presses in, not one', () => {
    // The whole difference from the gate's depth-1 star walk. `reopen`'s button
    // appears only once BOTH items are got, which is depth 2, so a walk that
    // folded each action once from the opening state would still miss it.
    const { graph } = unlocked();
    const reopening = graph.edges.filter((edge) => edge.actionId === 'reopen');
    expect(reopening.length).toBeGreaterThan(0);
    expect(reopening.every((edge) => graph.nodes[edge.from].depth === 2)).toBe(
      true
    );
  });
});

/* ------------------------------------------------------------------ */
/* Control 3 — the shipped templates                                   */
/* ------------------------------------------------------------------ */

describe('the shipped templates', () => {
  const names = templateNames();

  // Same reason as kanban-v2's hook: the nine walks are memoised together, so
  // the alphabetically-first template was paying for all of them and timing
  // out on CI while the other eight read the memo instantly.
  beforeAll(() => {
    templateWalks();
  }, 300_000);

  it('ships templates to walk', () => {
    // A loop over an empty list is a green suite that checks nothing.
    expect(names.length).toBeGreaterThan(0);
  });

  for (const name of names) {
    it(`${name} draws no reachability defect`, () => {
      const report = templateReports().get(name) as ReachabilityReport;
      expect(report.problem).toBeUndefined();
      expect(report.shortfalls).toEqual([]);
      expect(report.findings).toEqual([]);
    });

    it(`${name} draws every control somewhere it can move the board`, () => {
      // Asserted on `noOpControls` and not on `findings`, deliberately.
      // Findings are gated on a closed walk and the `kanban` template does not
      // close, so for that one template `findings === []` says nothing at all.
      // The observation is computed on every walk, so this is the assertion
      // that actually covers all nine.
      const report = templateReports().get(name) as ReachabilityReport;
      expect(report.noOpControls).toEqual([]);
    });
  }

  it('the eight idempotent templates would fail a rule without the $actor exemption', () => {
    // The vacuity guard on the control above, and the measurement the
    // exemption was built from. A bare self-loop rule — press it, state
    // unchanged, report it — fires on EIGHT of the nine: `vote-pizza`
    // re-pressed, `bench-ok` re-pressed, `answer-yes` re-pressed. If this ever
    // drops to zero, the templates stopped exercising the idempotent pattern
    // and "no template draws a no-op control" became free.
    const loopy = [...templateWalks().values()].filter((outcome) =>
      outcome.graph.edges.some((edge) => edge.from === edge.to)
    );
    expect(loopy.length).toBeGreaterThanOrEqual(7);
  });

  it('at most one template is too large to verify', () => {
    // The vacuity guard on the control above. A truncated walk asserts nothing,
    // so a change that made every template truncate would turn "no template
    // draws a defect" into "no template was checked" with no test failing.
    // Eight of the nine close today; the `kanban` template does not, because it
    // writes `/claims/$actor` on every move and its space is 24577 states.
    const truncated = [...templateReports().entries()]
      .filter(([, report]) => !report.closed)
      .map(([name]) => name);
    expect(truncated.length).toBeLessThanOrEqual(1);
  });

  it('a declared display-only app is one state with no edges, and that is not a defect', () => {
    // The silence rule, decided in advance: an app that declares zero actions
    // and renders zero controls has a one-node graph, and that is the CORRECT
    // shape for it. `countdown` is the shipped case.
    const report = templateReports().get('countdown') as ReachabilityReport;
    expect(report.declaredActions).toEqual([]);
    expect(report.nodeCount).toBe(1);
    expect(report.edgeCount).toBe(0);
    expect(report.closed).toBe(true);
    expect(report.findings).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Control 4 — negative controls, both directions                      */
/* ------------------------------------------------------------------ */

/** A scorer that reports everything, to prove the quiet result means something. */
function flagEverything(report: ReachabilityReport): string[] {
  return [
    ...report.valueDomains.map(
      (domain) => `every value at ${domain.pointer} is suspicious`
    ),
    ...report.declaredActions.map((id) => `action ${id} is suspicious`),
  ];
}

describe('negative controls', () => {
  it('flags a value that is only reachable through another', () => {
    const report = analyzeReachability(
      CHECKPOINT_GRAPH(),
      syntheticSpec(['advance'])
    );
    expect(report.closed).toBe(true);
    const done = report.checkpoints.find((entry) => entry.value === '"done"');
    expect(done?.pointer).toBe('/status');
    expect(done?.through).toEqual(['"doing"', '"blocked"']);
    expect(
      report.findings.some((finding) => finding.kind === 'mandatory-checkpoint')
    ).toBe(true);
  });

  it('drops the middle from the finding when one press skips it', () => {
    // The state space is identical to the graph above; only the navigation
    // differs. A scorer reading the SPACE rather than the navigation would say
    // the same thing about both, so what has to change is the content of the
    // finding: Done is still ordered after Doing, and Blocked is no longer on
    // the way.
    const report = analyzeReachability(
      BYPASS_GRAPH(),
      syntheticSpec(['advance', 'block', 'finish'])
    );
    expect(report.closed).toBe(true);
    const done = report.checkpoints.find((entry) => entry.value === '"done"');
    expect(done?.through).toEqual(['"doing"']);
    expect(
      report.checkpoints.some((entry) => entry.through.includes('"blocked"'))
    ).toBe(false);
  });

  it('goes quiet on the repair the shipped template actually made', () => {
    // One destination button per column: every value is one press from every
    // other, so nothing is a mandatory step. A scorer that reports here reports
    // on every well-built board that happens to have an ordering.
    const report = analyzeReachability(
      FREE_GRAPH(),
      syntheticSpec(['to-todo', 'to-doing', 'to-blocked', 'to-done'])
    );
    expect(report.closed).toBe(true);
    expect(report.checkpoints).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it('the clean-template result is not vacuous: a scorer that flags everything fails it', () => {
    // Direction (b). The templates draw nothing under the real scorer; this
    // shows that is a property of the templates and not of an empty report —
    // there is material in every one of them for a scorer to flag.
    for (const [name, report] of templateReports()) {
      if (report.declaredActions.length === 0) {
        // `countdown` declares nothing on purpose; the guard below would be
        // asserting about an app that correctly has nothing to score.
        continue;
      }
      const mutant = flagEverything(report);
      expect(mutant.length).toBeGreaterThan(0);
      // …and the assertion the control above makes would fail on them.
      expect(() => expect(mutant).toEqual([])).toThrow();
      expect(name).toBeTruthy();
    }
  });

  it('reports an inert app only when the spec declares actions', () => {
    const inert = syntheticGraph({ states: [{ n: 1 }], edges: [] });
    expect(analyzeReachability(inert, syntheticSpec([])).findings).toEqual([]);
    const withActions = analyzeReachability(inert, syntheticSpec(['tap']));
    expect(withActions.findings).toHaveLength(1);
    expect(withActions.findings[0].kind).toBe('inert');
  });

  it('names a declared action no edge in the graph uses', () => {
    const graph = syntheticGraph({
      states: [{ n: 0 }, { n: 1 }],
      edges: [[0, 'used', 1]],
    });
    const report = analyzeReachability(graph, syntheticSpec(['used', 'never']));
    expect(report.unreachedActions).toEqual(['never']);
    expect(report.findings[0].kind).toBe('unreachable-actions');
  });
});

/* ------------------------------------------------------------------ */
/* Control 5 — the board the live loop shipped                         */
/* ------------------------------------------------------------------ */

describe('a card that offers the column it is already in', () => {
  const broken = once<ReachabilityOutcome>(() =>
    analyzeSurfaceReachability({
      bundleSource: KANBAN_ALL_COLUMNS_BUNDLE,
      spec: fixtureSpec(KANBAN_ALL_COLUMNS_SPEC),
    })
  );
  const repaired = once<ReachabilityOutcome>(() =>
    analyzeSurfaceReachability({
      bundleSource: KANBAN_OWN_COLUMN_DROPPED_BUNDLE,
      spec: fixtureSpec(KANBAN_ALL_COLUMNS_SPEC),
    })
  );

  beforeAll(() => {
    broken();
    repaired();
  }, 120_000);

  it('closes, so the finding is an assertion and not a guess', () => {
    const { report } = broken();
    expect(report.problem).toBeUndefined();
    expect(report.shortfalls).toEqual([]);
    expect(report.truncatedBy).toEqual([]);
    expect(report.closed).toBe(true);
    // Three cards over four columns, times the four values `/claims/$actor`
    // takes (absent, then each card), less the combinations no press reaches.
    expect(report.nodeCount).toBe(193);
  });

  it('names every action whose button is drawn where it does nothing', () => {
    const { report } = broken();
    expect(report.noOpControls).toHaveLength(12);
    expect(report.noOpControls.map((entry) => entry.actionId)).toContain(
      'cover-art-doing'
    );
    // Every one of the twelve is dead on the same sixteen screens: the states
    // where that card already sits in that column AND the claim already points
    // at that card, which is exactly "the member who last moved it, looking at
    // what they did".
    for (const control of report.noOpControls) {
      expect(control.deadStates).toBe(16);
      expect(control.renderedStates).toBe(193);
    }
  });

  it('draws exactly one finding, and it is the no-op one', () => {
    const { report } = broken();
    expect(report.findings.map((finding) => finding.kind)).toEqual([
      'no-op-control',
    ]);
    const finding = report.findings[0];
    expect(finding.rubricCheck).toBe(7);
    expect(finding.message).toContain(
      '"copy-edit-blocked" on 16 of the 193 screen(s)'
    );
    expect(finding.message).toContain('and 4 more action(s)');
    expect(finding.key).toContain('cover-art-todo');
  });

  it('is NOT an unreachable action — every one of the twelve gets pressed', () => {
    // The precision statement. `unreachable-actions` and `no-op-control` are
    // opposite failures — a control nobody can reach against a control that
    // reaches nothing — and a board that drew both would mean one of them is
    // firing on the other's shape.
    const { report } = broken();
    expect(report.declaredActions).toHaveLength(12);
    expect(report.unreachedActions).toEqual([]);
  });

  it('goes quiet on the twin that drops the card own column, one filter apart', () => {
    const { report } = repaired();
    expect(report.closed).toBe(true);
    // Same app, same spec, same state space — only the button row differs.
    expect(report.nodeCount).toBe(broken().report.nodeCount);
    expect(report.noOpControls).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it('prints the finding, and prints the clean twin as clean', () => {
    expect(formatReachabilityReport(broken().report).join('\n')).toContain(
      '[rubric 7: no-op-control]'
    );
    expect(formatReachabilityReport(repaired().report).join('\n')).toContain(
      'every control drawn can move the board'
    );
  });
});

/* ------------------------------------------------------------------ */
/* Control 6 — the idempotent pattern the templates are built on       */
/* ------------------------------------------------------------------ */

describe('an idempotent action is not a no-op control', () => {
  /** One state, one press, back to the same state. */
  const selfLoop = () =>
    syntheticGraph({
      states: [{ votes: { '~sampel-palnet': 'pizza' } }],
      edges: [[0, 'vote-pizza', 0]],
    });

  it('exempts $actor in the PATH — the documented default', () => {
    // `PARADIGM.md`: "Per-member state … is a `set` at a path keyed by
    // `$actor`. Pressing twice writes the same literal to the same path: the
    // second press changes nothing. Reach for this first, every time."
    const report = analyzeReachability(
      selfLoop(),
      syntheticSpecWithOps({
        'vote-pizza': [{ op: 'set', path: '/votes/$actor', value: 'pizza' }],
      })
    );
    expect(report.noOpControls).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it('exempts $actor in the VALUE — the expense-split spelling', () => {
    // `set /paidBy/ferry "$actor"` is the same idempotence seen from the other
    // side: a shared slot recording WHO, where pressing again re-writes your
    // own name. The shipped template does this, so a path-only test would
    // report on it.
    const report = analyzeReachability(
      selfLoop(),
      syntheticSpecWithOps({
        'vote-pizza': [{ op: 'set', path: '/paidBy/ferry', value: '$actor' }],
      })
    );
    expect(report.noOpControls).toEqual([]);
  });

  it('exempts $actor nested inside a value', () => {
    const report = analyzeReachability(
      selfLoop(),
      syntheticSpecWithOps({
        'vote-pizza': [
          { op: 'set', path: '/claims/ferry', value: { by: ['$actor'] } },
        ],
      })
    );
    expect(report.noOpControls).toEqual([]);
  });

  it('reports a SHARED write with no $actor anywhere', () => {
    // The other half of the same graph. Identical states, identical edge —
    // only the op differs — so a scorer reading the graph alone would say the
    // same thing about both, and this is what proves the exemption is doing
    // the separating rather than the shape.
    const report = analyzeReachability(
      selfLoop(),
      syntheticSpecWithOps({
        'vote-pizza': [
          { op: 'set', path: '/tasks/theme/status', value: 'doing' },
        ],
      })
    );
    expect(report.noOpControls).toEqual([
      { actionId: 'vote-pizza', deadStates: 1, renderedStates: 1 },
    ]);
    expect(report.findings.map((finding) => finding.kind)).toEqual([
      'no-op-control',
    ]);
  });

  it('needs EVERY op to name the actor, not merely one', () => {
    // The shipped board's exact shape: a shared write and an actor write in
    // one action. An "any op" exemption would let it through on the strength
    // of the second while the first is the dead half.
    const report = analyzeReachability(
      selfLoop(),
      syntheticSpecWithOps({
        'vote-pizza': [
          { op: 'set', path: '/tasks/theme/status', value: 'doing' },
          { op: 'set', path: '/claims/$actor', value: 'theme' },
        ],
      })
    );
    expect(report.noOpControls).toHaveLength(1);
  });

  it('does not exempt an action with no ops at all', () => {
    // `syntheticSpec` builds `ops: []`. That action cannot change anything
    // anywhere, which is the strongest form of the defect and not an instance
    // of the idempotent pattern.
    const report = analyzeReachability(
      selfLoop(),
      syntheticSpec(['vote-pizza'])
    );
    expect(report.noOpControls).toHaveLength(1);
  });

  it('does not count an aborted fold as a pointless control', () => {
    // The reducer stopping part-way (§7) can also leave state where it was,
    // but the cause is the fold being refused rather than the control being
    // pointless, and the two must not read the same.
    const graph = selfLoop();
    graph.edges[0].aborted = true;
    const report = analyzeReachability(
      graph,
      syntheticSpecWithOps({
        'vote-pizza': [
          { op: 'set', path: '/tasks/theme/status', value: 'doing' },
        ],
      })
    );
    expect(report.noOpControls).toEqual([]);
  });

  it('withholds the finding on a walk that did not close', () => {
    const graph = selfLoop();
    graph.exhaustive = false;
    graph.truncatedBy = ['the budget ran out'];
    const report = analyzeReachability(
      graph,
      syntheticSpecWithOps({
        'vote-pizza': [
          { op: 'set', path: '/tasks/theme/status', value: 'doing' },
        ],
      })
    );
    expect(report.closed).toBe(false);
    expect(report.findings).toEqual([]);
    // Observed, not asserted — and it says so.
    expect(report.noOpControls).toHaveLength(1);
    expect(formatReachabilityReport(report).join('\n')).toContain(
      'observed: pressing "vote-pizza" changed nothing'
    );
  });
});

/* ------------------------------------------------------------------ */
/* Truncation is reported, and it disarms every assertion              */
/* ------------------------------------------------------------------ */

describe('a walk that did not close', () => {
  it('asserts nothing, and says which bound stopped it', () => {
    const { report } = analyzeSurfaceReachability({
      bundleSource: KANBAN_V2_BUNDLE,
      spec: fixtureSpec(KANBAN_V2_SPEC),
      bounds: { maxNodes: 50 },
    });
    expect(report.closed).toBe(false);
    expect(report.truncatedBy.join(' ')).toContain('50-state budget');
    expect(report.findings).toEqual([]);
    // The observation survives; only the assertion is withheld. That is what
    // makes the truncated output worth printing at all.
    expect(report.checkpoints.length).toBeGreaterThan(0);
    expect(formatReachabilityReport(report).join('\n')).toContain(
      'no defect ASSERTED'
    );
  });

  it('reports the depth bound separately from the state bound', () => {
    const { report } = analyzeSurfaceReachability({
      bundleSource: KANBAN_V2_BUNDLE,
      spec: fixtureSpec(KANBAN_V2_SPEC),
      bounds: { maxDepth: 2 },
    });
    expect(report.closed).toBe(false);
    expect(report.truncatedBy.join(' ')).toContain('2-press depth bound');
    expect(report.depthReached).toBe(2);
  });

  it('a transition budget stops the walk outright', () => {
    const { report } = analyzeSurfaceReachability({
      bundleSource: KANBAN_V2_BUNDLE,
      spec: fixtureSpec(KANBAN_V2_SPEC),
      bounds: { maxTransitions: 40 },
    });
    expect(report.closed).toBe(false);
    expect(report.truncatedBy.join(' ')).toContain('40-transition budget');
    expect(report.edgeCount).toBeLessThanOrEqual(40);
  });
});

/* ------------------------------------------------------------------ */
/* Could not measure is not measured and found nothing                 */
/* ------------------------------------------------------------------ */

describe('a bundle the walk cannot run', () => {
  it('reports the problem instead of an empty finding list', () => {
    const { report } = analyzeSurfaceReachability({
      bundleSource: 'this is not javascript ((( ',
      spec: fixtureSpec(LOCKED_SCREEN_SPEC),
    });
    expect(report.problem).toBeDefined();
    expect(report.closed).toBe(false);
    expect(report.findings).toEqual([]);
    expect(formatReachabilityReport(report)[0]).toContain('NOT WALKED');
  });

  it('reports a bundle that registers nothing as unwalked, not as inert', () => {
    const { report } = analyzeSurfaceReachability({
      bundleSource: '(function () { surface.register({}); })();',
      spec: fixtureSpec(LOCKED_SCREEN_SPEC),
    });
    expect(report.problem).toBeDefined();
    expect(report.findings).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* The pieces                                                          */
/* ------------------------------------------------------------------ */

describe('dominators', () => {
  const preds = (edges: [number, number][], count: number) => {
    const out: number[][] = Array.from({ length: count }, () => []);
    for (const [from, to] of edges) {
      out[to].push(from);
    }
    return out;
  };

  it('a chain dominates transitively', () => {
    const dom = dominators(
      4,
      preds(
        [
          [0, 1],
          [1, 2],
          [2, 3],
        ],
        4
      ),
      0
    );
    expect([...dom[3]].sort()).toEqual([0, 1, 2, 3]);
  });

  it('a bypass removes the dominator', () => {
    const dom = dominators(
      4,
      preds(
        [
          [0, 1],
          [1, 2],
          [2, 3],
          [1, 3],
        ],
        4
      ),
      0
    );
    expect([...dom[3]].sort()).toEqual([0, 1, 3]);
  });

  it('says nothing about a node no path reaches', () => {
    const dom = dominators(3, preds([[0, 1]], 3), 0);
    expect([...dom[2]]).toEqual([]);
  });

  it('a back edge does not make the target dominate its own predecessor', () => {
    const dom = dominators(
      3,
      preds(
        [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
        3
      ),
      0
    );
    expect([...dom[1]].sort()).toEqual([0, 1]);
  });
});

describe('mergePointerLabel', () => {
  it('merges siblings under one parent', () => {
    expect(
      mergePointerLabel(['/tasks/theme/status', '/tasks/print/status'])
    ).toBe('/tasks/*/status');
  });

  it('refuses two unrelated top-level keys', () => {
    // `/crew` and `/paidBy` differ in exactly one segment and merged to a bare
    // `/*`, which reads as nothing. The wildcard needs a named parent.
    expect(mergePointerLabel(['/crew', '/paidBy'])).toBeNull();
  });

  it('refuses pointers that differ in two places', () => {
    expect(mergePointerLabel(['/a/b/c', '/a/x/y'])).toBeNull();
  });

  it('refuses pointers of different depths', () => {
    expect(mergePointerLabel(['/a/b', '/a/b/c'])).toBeNull();
  });

  it('passes a single pointer through unchanged', () => {
    expect(mergePointerLabel(['/a/b'])).toBe('/a/b');
  });
});

describe('statePointers', () => {
  it('records scalars at their pointer', () => {
    const found = statePointers({ a: 1, b: { c: 'x' } });
    expect(found.get('/a')).toBe('1');
    expect(found.get('/b/c')).toBe('"x"');
  });

  it('distinguishes a container with entries from one that is empty', () => {
    expect(statePointers({ a: {} }).get('/a')).toBe('{}');
    expect(statePointers({ a: { b: 1 } }).get('/a')).toBe(NESTED_VALUE);
  });

  it('escapes a key that would otherwise split the pointer', () => {
    const found = statePointers({ '~zod': 1, 'a/b': 2 });
    expect(found.get('/~0zod')).toBe('1');
    expect(found.get('/a~1b')).toBe('2');
  });

  it('walks arrays by index', () => {
    expect(statePointers({ xs: ['a', 'b'] }).get('/xs/1')).toBe('"b"');
    expect(statePointers({ xs: [] }).get('/xs')).toBe('[]');
  });
});

describe('the sentinels', () => {
  it('a checkpoint stated only in "has entries" is not reported', () => {
    // `potluck` produced exactly this: "your entry can only be emptied after it
    // had entries in it", which is true of every container ever written to and
    // is a fact about this pass's vocabulary rather than about the app.
    const graph = syntheticGraph({
      states: [{ bag: {} }, { bag: { x: 1 } }, { bag: {}, done: true }],
      edges: [
        [0, 'fill', 1],
        [1, 'clear', 2],
      ],
    });
    const report = analyzeReachability(graph, syntheticSpec(['fill', 'clear']));
    expect(
      report.checkpoints.some((entry) => entry.through.includes(NESTED_VALUE))
    ).toBe(false);
  });

  it('"nothing there" is a value, and can be a mandatory step', () => {
    const graph = syntheticGraph({
      states: [{ answer: 'yes' }, {}, { answer: 'no' }],
      edges: [
        [0, 'clear', 1],
        [1, 'no', 2],
      ],
    });
    const report = analyzeReachability(graph, syntheticSpec(['clear', 'no']));
    const finding = report.checkpoints.find((entry) => entry.value === '"no"');
    expect(finding?.through).toEqual([ABSENT_VALUE]);
  });
});

/* ------------------------------------------------------------------ */
/* The wiring into `surface preview`                                   */
/* ------------------------------------------------------------------ */

/**
 * The smallest launcher `renderSurfacePreview` will accept.
 *
 * Deliberately thin: this file is not testing the capture matrix, it is
 * testing that the walk reaches the manifest. Every cell reports a clean
 * geometry probe, so `defects` stays empty and any entry in the printed list
 * came from the walk.
 */
function stubLauncher(): PreviewLauncher {
  const observation: PreviewCellObservation = {
    viewportWidth: 390,
    viewportHeight: 844,
    documentScrollWidth: 390,
    overflowing: [],
    controls: [],
    text: 'Zine tasks',
  };
  const appFrame: PreviewFrame = {
    async evaluate() {
      return observation;
    },
  };
  const hostFrame: PreviewFrame = {
    async evaluate() {
      return null;
    },
  };
  const page: PreviewPage = {
    async setContent() {},
    async evaluate(_fn, arg) {
      return arg === undefined ? { errors: [] } : undefined;
    },
    async waitForFunction() {
      return undefined;
    },
    async waitForTimeout() {},
    async screenshot({ path }) {
      fs.mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true });
      fs.writeFileSync(path, 'png');
      return undefined;
    },
    mainFrame() {
      return hostFrame;
    },
    frames() {
      return [hostFrame, appFrame];
    },
    async close() {},
  };
  const context: PreviewContext = {
    async newPage() {
      return page;
    },
    async close() {},
  };
  return {
    async launch() {
      return {
        async newContext() {
          return context;
        },
        async close() {},
      };
    },
  };
}

describe('surface preview carries the walk', () => {
  it('puts the reachability report in the manifest it writes', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-manifest-'));
    const outcome = await renderSurfacePreview({
      bundleSource: KANBAN_V2_BUNDLE,
      bundleSha256: 'c'.repeat(64),
      spec: KANBAN_V2_SPEC,
      outDir,
      launcher: stubLauncher(),
    });

    // The cell pass found nothing, so anything the reader sees came from the
    // walk — which is the point of the stub above.
    expect(outcome.manifest.defects).toEqual([]);
    expect(outcome.manifest.reachability.closed).toBe(true);
    expect(outcome.manifest.reachability.nodeCount).toBe(4096);
    expect(outcome.manifest.reachability.findings).toHaveLength(2);

    const written = JSON.parse(
      fs.readFileSync(outcome.manifestPath, 'utf-8')
    ) as { reachability: ReachabilityReport };
    expect(written.reachability.checkpoints[0].pointer).toBe('/tasks/*/status');
  }, 30_000);

  it('honours a caller-supplied bound, so a big app is not walked forever', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-bounded-'));
    const outcome = await renderSurfacePreview({
      bundleSource: KANBAN_V2_BUNDLE,
      bundleSha256: 'c'.repeat(64),
      spec: KANBAN_V2_SPEC,
      outDir,
      launcher: stubLauncher(),
      reachabilityBounds: { maxNodes: 20 },
    });
    expect(outcome.manifest.reachability.closed).toBe(false);
    expect(outcome.manifest.reachability.findings).toEqual([]);
    expect(outcome.manifest.reachability.truncatedBy.join(' ')).toContain(
      '20-state budget'
    );
  }, 30_000);
});

describe('a control that invokes two actions at once', () => {
  it('is reported as a shortfall, and disarms every assertion', () => {
    // The walk folds one action per press, so the state that press really
    // produces is not a node in this graph. Rather than guess at the
    // combination, the walk says so — and a graph with a shortfall is never
    // closed, so nothing is asserted about it.
    const { report } = analyzeSurfaceReachability({
      bundleSource: DOUBLE_INVOKE_BUNDLE,
      spec: fixtureSpec(DOUBLE_INVOKE_SPEC),
    });
    expect(report.problem).toBeUndefined();
    expect(report.shortfalls.join(' ')).toContain(
      'invoked more than one action at once'
    );
    expect(report.closed).toBe(false);
    expect(report.findings).toEqual([]);
  });
});

describe('the sheet check 7 is scored on', () => {
  const templateFor = async (bounds?: {
    maxNodes: number;
  }): Promise<Record<string, { reachability?: string }>> => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-sheet-'));
    const outcome = await renderSurfacePreview({
      bundleSource: KANBAN_V2_BUNDLE,
      bundleSha256: 'c'.repeat(64),
      spec: KANBAN_V2_SPEC,
      outDir,
      launcher: stubLauncher(),
      ...(bounds === undefined ? {} : { reachabilityBounds: bounds }),
    });
    return JSON.parse(fs.readFileSync(outcome.rubricTemplatePath, 'utf-8'))
      .checks;
  };

  it('stamps what the walk found onto check 7, not a still', async () => {
    // The end of the chain this whole session is about: D140's board reaches
    // the sheet the scorer fills in, as a line rather than as a picture they
    // are asked to look harder at.
    const checks = await templateFor();
    const citation = checks[REACHABILITY_CITED_CHECK].reachability as string;
    expect(citation.startsWith('measured:')).toBe(true);
    expect(citation).toContain('closed over all 4096 reachable screen(s)');
    expect(citation).toContain('2 finding(s)');
    expect(citation).toContain('"done" at /tasks/*/status');
  }, 30_000);

  it('stamps NOT MEASURED when the walk ran into a bound', async () => {
    // The other direction, off the same app. Same bundle, same spec, one
    // smaller bound — so the only thing that can move the line is how much of
    // the app the walk actually saw, which is exactly what it has to report.
    const checks = await templateFor({ maxNodes: 20 });
    const citation = checks[REACHABILITY_CITED_CHECK].reachability as string;
    expect(citation.startsWith('not measured:')).toBe(true);
    expect(citation).toContain('20-state budget');
    expect(citation).not.toContain('/tasks/*/status');
  }, 30_000);
});

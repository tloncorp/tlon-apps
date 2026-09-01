// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';

import {
  SURFACE_TRANSITION_BOUNDS,
  type SurfaceSpec,
  type TransitionGraph,
} from './surface-transitions';

const { SurfaceSpecSchema } = surfaceSchemasModule as Pick<
  typeof import('@tloncorp/api'),
  'SurfaceSpecSchema'
>;

/**
 * Validate a fixture spec the way the tool does, and throw loudly when it does
 * not validate.
 *
 * The walk takes a VALIDATED spec, so a fixture that quietly failed the schema
 * would be walked as an empty action map and every assertion about it would be
 * about nothing. The throw is the difference between a broken fixture and a
 * silently vacuous test.
 */
export function fixtureSpec(raw: unknown): SurfaceSpec {
  const parsed = SurfaceSpecSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `fixture spec did not validate: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`
    );
  }
  return parsed.data;
}

/**
 * Fixtures for the reachability pass.
 *
 * Source strings rather than files, following `surface-lint-fixtures.ts`: the
 * suite stays hermetic, line numbers are stable, and the corpus is importable
 * by whatever wraps the pass next.
 *
 * ## Why the kanban pair is here verbatim
 *
 * `KANBAN_V2_BUNDLE` and `KANBAN_V2_SPEC` are the artifacts D140 was written
 * against, copied byte for byte out of the verdict run
 * (`packages/openclaw/dev/surfaces-6a-out/verdict-run/artifacts/kanban-v2/`).
 * That directory is gitignored as regenerable evidence, so a test that read it
 * would pass on one machine and vanish on every other one. The defect this
 * whole pass exists to catch has to have a fixture that travels with the
 * repository.
 *
 * Read the bundle's `next` table: `todo → doing → blocked → done → todo`, with
 * ONE button per card. Every one of the twenty-four declared actions is
 * reachable, the board renders four columns, and no card can reach Done without
 * being marked Blocked on the way. Rubric check 7 passed it.
 */

/** `kanban-v2/bundle.js`, verbatim. */
export const KANBAN_V2_BUNDLE = `(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const { Card, Button, ListRow, SectionHeader, Badge, EmptyState } = primitives;
  const has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  const TASKS = {
    theme: { todo: function () { return invoke('theme-todo'); }, doing: function () { return invoke('theme-doing'); }, blocked: function () { return invoke('theme-blocked'); }, done: function () { return invoke('theme-done'); } },
    pitches: { todo: function () { return invoke('pitches-todo'); }, doing: function () { return invoke('pitches-doing'); }, blocked: function () { return invoke('pitches-blocked'); }, done: function () { return invoke('pitches-done'); } },
    interviews: { todo: function () { return invoke('interviews-todo'); }, doing: function () { return invoke('interviews-doing'); }, blocked: function () { return invoke('interviews-blocked'); }, done: function () { return invoke('interviews-done'); } },
    layout: { todo: function () { return invoke('layout-todo'); }, doing: function () { return invoke('layout-doing'); }, blocked: function () { return invoke('layout-blocked'); }, done: function () { return invoke('layout-done'); } },
    proof: { todo: function () { return invoke('proof-todo'); }, doing: function () { return invoke('proof-doing'); }, blocked: function () { return invoke('proof-blocked'); }, done: function () { return invoke('proof-done'); } },
    print: { todo: function () { return invoke('print-todo'); }, doing: function () { return invoke('print-doing'); }, blocked: function () { return invoke('print-blocked'); }, done: function () { return invoke('print-done'); } }
  };
  const next = { todo: 'doing', doing: 'blocked', blocked: 'done', done: 'todo' };
  const labels = { todo: 'To do', doing: 'Doing', blocked: 'Blocked', done: 'Done' };
  surface.register({ render(state) {
    const tasks = state.tasks || {};
    const order = Array.isArray(state.taskOrder) ? state.taskOrder : Object.keys(tasks);
    return html\`<\${Card} title=\${state.title || 'Zine tasks'}>
      <div>\${order.length} tasks · Move each card with the buttons.</div>
      \${['todo', 'doing', 'blocked', 'done'].map(function (status) {
        const ids = order.filter(function (id) { return (tasks[id] || {}).status === status; });
        return html\`<\${SectionHeader}>\${labels[status]} <\${Badge}>\${String(ids.length)}<//><//>
          \${ids.length === 0 ? html\`<\${EmptyState} title=\${'Nothing in ' + labels[status]} />\` : ids.map(function (id) {
            const task = tasks[id] || {};
            const target = next[status];
            const handler = (TASKS[id] || {})[target];
            return html\`<\${ListRow} right=\${html\`<\${Button} disabled=\${!canInvoke() || !handler} onPress=\${handler}>\${'Move to ' + labels[target]}<//>\`}>
              <div>\${task.label || id}</div><div>\${task.note || ''}</div>
            <//>\`;
          })}\`;
      })}
    <//>\`;
  }});
})();`;

/** `kanban-v2/spec.json`, verbatim. */
export const KANBAN_V2_SPEC: unknown = {
  version: 1,
  surfaceId: 'srf-zine-tasks',
  title: 'Zine tasks',
  initialState: {
    title: 'Zine tasks',
    taskOrder: ['theme', 'pitches', 'interviews', 'layout', 'proof', 'print'],
    tasks: {
      theme: {
        label: 'Choose the issue theme',
        note: 'Agree on the central idea',
        status: 'todo',
      },
      pitches: {
        label: 'Collect contributor pitches',
        note: 'Gather ideas and assignments',
        status: 'todo',
      },
      interviews: {
        label: 'Do interviews and reporting',
        note: 'Finish the source material',
        status: 'todo',
      },
      layout: {
        label: 'Lay out the pages',
        note: 'Assemble text and images',
        status: 'todo',
      },
      proof: {
        label: 'Proofread the issue',
        note: 'Final copy and fact check',
        status: 'todo',
      },
      print: {
        label: 'Send to print',
        note: 'Prepare files and place the order',
        status: 'todo',
      },
    },
  },
  actions: {
    'theme-todo': {
      ops: [
        {
          op: 'set',
          path: '/tasks/theme/status',
          value: 'todo',
        },
      ],
    },
    'theme-doing': {
      ops: [
        {
          op: 'set',
          path: '/tasks/theme/status',
          value: 'doing',
        },
      ],
    },
    'theme-blocked': {
      ops: [
        {
          op: 'set',
          path: '/tasks/theme/status',
          value: 'blocked',
        },
      ],
    },
    'theme-done': {
      ops: [
        {
          op: 'set',
          path: '/tasks/theme/status',
          value: 'done',
        },
      ],
    },
    'pitches-todo': {
      ops: [
        {
          op: 'set',
          path: '/tasks/pitches/status',
          value: 'todo',
        },
      ],
    },
    'pitches-doing': {
      ops: [
        {
          op: 'set',
          path: '/tasks/pitches/status',
          value: 'doing',
        },
      ],
    },
    'pitches-blocked': {
      ops: [
        {
          op: 'set',
          path: '/tasks/pitches/status',
          value: 'blocked',
        },
      ],
    },
    'pitches-done': {
      ops: [
        {
          op: 'set',
          path: '/tasks/pitches/status',
          value: 'done',
        },
      ],
    },
    'interviews-todo': {
      ops: [
        {
          op: 'set',
          path: '/tasks/interviews/status',
          value: 'todo',
        },
      ],
    },
    'interviews-doing': {
      ops: [
        {
          op: 'set',
          path: '/tasks/interviews/status',
          value: 'doing',
        },
      ],
    },
    'interviews-blocked': {
      ops: [
        {
          op: 'set',
          path: '/tasks/interviews/status',
          value: 'blocked',
        },
      ],
    },
    'interviews-done': {
      ops: [
        {
          op: 'set',
          path: '/tasks/interviews/status',
          value: 'done',
        },
      ],
    },
    'layout-todo': {
      ops: [
        {
          op: 'set',
          path: '/tasks/layout/status',
          value: 'todo',
        },
      ],
    },
    'layout-doing': {
      ops: [
        {
          op: 'set',
          path: '/tasks/layout/status',
          value: 'doing',
        },
      ],
    },
    'layout-blocked': {
      ops: [
        {
          op: 'set',
          path: '/tasks/layout/status',
          value: 'blocked',
        },
      ],
    },
    'layout-done': {
      ops: [
        {
          op: 'set',
          path: '/tasks/layout/status',
          value: 'done',
        },
      ],
    },
    'proof-todo': {
      ops: [
        {
          op: 'set',
          path: '/tasks/proof/status',
          value: 'todo',
        },
      ],
    },
    'proof-doing': {
      ops: [
        {
          op: 'set',
          path: '/tasks/proof/status',
          value: 'doing',
        },
      ],
    },
    'proof-blocked': {
      ops: [
        {
          op: 'set',
          path: '/tasks/proof/status',
          value: 'blocked',
        },
      ],
    },
    'proof-done': {
      ops: [
        {
          op: 'set',
          path: '/tasks/proof/status',
          value: 'done',
        },
      ],
    },
    'print-todo': {
      ops: [
        {
          op: 'set',
          path: '/tasks/print/status',
          value: 'todo',
        },
      ],
    },
    'print-doing': {
      ops: [
        {
          op: 'set',
          path: '/tasks/print/status',
          value: 'doing',
        },
      ],
    },
    'print-blocked': {
      ops: [
        {
          op: 'set',
          path: '/tasks/print/status',
          value: 'blocked',
        },
      ],
    },
    'print-done': {
      ops: [
        {
          op: 'set',
          path: '/tasks/print/status',
          value: 'done',
        },
      ],
    },
  },
  recipe:
    'A shared kanban board for zine production. Six starter tasks move among To do, Doing, Blocked, and Done. Members use the buttons on each task to advance or return it; task labels and notes stay visible while status changes.',
  specRevision: 2,
  bundle: {
    assetRef:
      'http://127.0.0.1:4323/616bdf724372ba9e265016714d5d60e659fe6645399322b3275a3c83b31cba5a.js',
    sha256: '616bdf724372ba9e265016714d5d60e659fe6645399322b3275a3c83b31cba5a',
    size: 2978,
    shellVersion: 1,
  },
  preserveState: true,
};

/**
 * A declared action whose control renders on a screen nobody can reach.
 *
 * Built rather than found, and it had to be. The one inert app in the verdict
 * run (`expense-v1`) declares `actions: {}` and contains no `invoke(` at all,
 * so "every declared action no control reaches" over it is the EMPTY set and a
 * control built on it would pass without the rule ever firing. It is
 * structurally the same app as the shipped `countdown` template under this
 * pass, and any rule that fired on it would fire on a shipped template.
 *
 * So this one has three declared actions and the defect is in the third.
 * `reopen`'s button is rendered only when `/closed` is true, and no action ever
 * sets `/closed`, so the screen carrying that button is not reachable from the
 * opening screen by any sequence of presses. The gate's depth-1 star walk does
 * not see it either: folding `reopen` from `initialState` leaves `/closed`
 * false, so the button is absent from that render too — which is why the gate
 * reports it as a partial SKIP on four rules and this pass reports it as a
 * defect about the app.
 */
export const LOCKED_SCREEN_BUNDLE = `(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const { Card, Button, ListRow, SectionHeader, EmptyState } = primitives;
  const GOT = {
    milk: function () { return invoke('milk-got'); },
    bread: function () { return invoke('bread-got'); }
  };
  surface.register({ render(state) {
    const list = state.list || {};
    const order = Array.isArray(state.order) ? state.order : Object.keys(list);
    const outstanding = order.filter(function (id) { return list[id] === 'needed'; });
    return html\`<\${Card} title=\${state.title || 'Supply run'}>
      <\${SectionHeader}>Still needed<//>
      \${outstanding.length === 0
        ? html\`<\${EmptyState} title="Everything is in" />\`
        : outstanding.map(function (id) {
            return html\`<\${ListRow} right=\${html\`<\${Button} disabled=\${!canInvoke()} onPress=\${GOT[id]}>Got it<//>\`}>
              <div>\${id}</div>
            <//>\`;
          })}
      \${state.closed === true
        ? html\`<\${Button} onPress=\${function () { return invoke('reopen'); }}>Start a new run<//>\`
        : null}
    <//>\`;
  }});
})();`;

export const LOCKED_SCREEN_SPEC: unknown = {
  version: 1,
  surfaceId: 'srf-supply-run',
  specRevision: 1,
  title: 'Supply run',
  bundle: {
    assetRef: 'storage://bundles/supply-run.js',
    sha256: 'b'.repeat(64),
    size: 1024,
    shellVersion: 1,
  },
  initialState: {
    title: 'Supply run',
    order: ['milk', 'bread'],
    list: { milk: 'needed', bread: 'needed' },
    closed: false,
  },
  actions: {
    'milk-got': { ops: [{ op: 'set', path: '/list/milk', value: 'got' }] },
    'bread-got': { ops: [{ op: 'set', path: '/list/bread', value: 'got' }] },
    reopen: {
      ops: [
        { op: 'set', path: '/list/milk', value: 'needed' },
        { op: 'set', path: '/list/bread', value: 'needed' },
      ],
    },
  },
};

/**
 * The same app with the one repair that makes `reopen` reachable: the button
 * is rendered once the list is empty instead of behind a flag nothing sets.
 *
 * A fixture pair, not a single fixture. A rule that fires on the broken one
 * proves nothing on its own — a rule that fires on everything would too — so
 * the repaired twin is what shows the finding tracks the defect and not the
 * app.
 */
export const UNLOCKED_SCREEN_BUNDLE = LOCKED_SCREEN_BUNDLE.replace(
  'state.closed === true',
  'outstanding.length === 0'
);

/* ------------------------------------------------------------------ */
/* Synthetic graphs, for scoring without a walk                        */
/* ------------------------------------------------------------------ */

/**
 * A hand-built graph, so the scorer can be tested without the harness.
 *
 * `analyzeReachability` and `exploreTransitionGraph` fail differently, and a
 * suite that only ever ran them together could not tell a scorer that misses a
 * dominator from a walk that missed an edge. These fixtures pin the scorer.
 */
export function syntheticGraph(options: {
  /** node id → the state at it */
  states: Record<string, unknown>[];
  /** `[from, actionId, to]` */
  edges: [number, string, number][];
  exhaustive?: boolean;
  shortfalls?: string[];
  truncatedBy?: string[];
}): TransitionGraph {
  return {
    nodes: options.states.map((state, id) => ({
      id,
      depth: id === 0 ? 0 : 1,
      state: state as never,
      key: JSON.stringify(state),
    })),
    edges: options.edges.map(([from, actionId, to]) => ({
      from,
      to,
      actionId,
      aborted: false,
    })),
    depthReached: 1,
    exhaustive: options.exhaustive ?? true,
    truncatedBy: options.truncatedBy ?? [],
    shortfalls: options.shortfalls ?? [],
    bounds: SURFACE_TRANSITION_BOUNDS,
  };
}

/** A spec that declares exactly these action ids and nothing else. */
export function syntheticSpec(actionIds: readonly string[]): SurfaceSpec {
  return {
    surfaceId: 'srf-synthetic',
    specRevision: 1,
    initialState: {},
    actions: Object.fromEntries(actionIds.map((id) => [id, { ops: [] }])),
  } as unknown as SurfaceSpec;
}

/** D140's shape, reduced to four states: Done sits behind Blocked. */
export const CHECKPOINT_GRAPH = (): TransitionGraph =>
  syntheticGraph({
    states: [
      { status: 'todo' },
      { status: 'doing' },
      { status: 'blocked' },
      { status: 'done' },
    ],
    edges: [
      [0, 'advance', 1],
      [1, 'advance', 2],
      [2, 'advance', 3],
      [3, 'advance', 0],
    ],
  });

/**
 * The same four states with ONE of the missing buttons: Doing can go straight
 * to Done, so Blocked stops being mandatory.
 *
 * The precision half of the pair. The state space is identical to
 * `CHECKPOINT_GRAPH` and only the navigation differs, so a scorer that read the
 * space rather than the navigation would report the same thing about both. What
 * must change is the CONTENT of the finding: Done is still only reachable
 * through Doing (it is, and that is the ordering the board really has), but
 * "blocked" must drop out of the mandatory list.
 */
export const BYPASS_GRAPH = (): TransitionGraph =>
  syntheticGraph({
    states: [
      { status: 'todo' },
      { status: 'doing' },
      { status: 'blocked' },
      { status: 'done' },
    ],
    edges: [
      [0, 'advance', 1],
      [1, 'block', 2],
      [2, 'advance', 3],
      [1, 'finish', 3],
      [3, 'advance', 0],
    ],
  });

/**
 * The repair the shipped `kanban` template actually made: one destination
 * button per column, so every value is one press from every other.
 *
 * The negative control proper. No value is a mandatory step on the way to any
 * other, so a scorer that reports anything here reports on every well-built
 * board that happens to have an ordering.
 */
export const FREE_GRAPH = (): TransitionGraph => {
  const columns = ['todo', 'doing', 'blocked', 'done'];
  const edges: [number, string, number][] = [];
  columns.forEach((_, from) => {
    columns.forEach((to, index) => {
      if (from !== index) {
        edges.push([from, `to-${to}`, index]);
      }
    });
  });
  return syntheticGraph({
    states: columns.map((status) => ({ status })),
    edges,
  });
};

/**
 * One press, two invokes — the shape the walk cannot model.
 *
 * The walk folds ONE action per press, so a control that invokes two lands the
 * member somewhere neither of the walk's two single-fold edges points at. That
 * is a MISSING node, and a missing node is a missing edge, which is the one
 * thing the dominance argument cannot survive. The fixture exists so the
 * shortfall that withholds every assertion has a case that trips it.
 */
export const DOUBLE_INVOKE_BUNDLE = `(function () {
  const { html, primitives, invoke } = surface;
  const { Card, Button } = primitives;
  surface.register({ render(state) {
    return html\`<\${Card} title="Sign-up">
      <div>\${state.name || 'nobody'} is \${state.going === true ? 'coming' : 'undecided'}</div>
      <\${Button} onPress=\${function () { invoke('set-name'); invoke('set-going'); }}>Count me in<//>
    <//>\`;
  }});
})();`;

export const DOUBLE_INVOKE_SPEC: unknown = {
  version: 1,
  surfaceId: 'srf-double-invoke',
  specRevision: 1,
  title: 'Sign-up',
  bundle: {
    assetRef: 'storage://bundles/double.js',
    sha256: 'c'.repeat(64),
    size: 512,
    shellVersion: 1,
  },
  initialState: { name: '', going: false },
  actions: {
    'set-name': { ops: [{ op: 'set', path: '/name', value: 'somebody' }] },
    'set-going': { ops: [{ op: 'set', path: '/going', value: true }] },
  },
};

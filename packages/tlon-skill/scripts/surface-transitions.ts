// The value imports below use deep subpaths for the same reason the gate and
// preview do (see surface-lint.ts): `bunfig.toml` preloads a process-wide
// `mock.module('@tloncorp/api', …)` for unit tests and that mock does not
// carry the surface exports, so a root import resolves to it and fails ESM
// named-export validation. Subpaths resolve to the real modules, so this walk
// folds with the SAME reducer the client folds with.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceJsonPointerModule from '@tloncorp/api/client/surface/jsonPointer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceReducerModule from '@tloncorp/api/client/surface/reducer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { runShellFixture } from '@tloncorp/surface-shell/node';
import { Window } from 'happy-dom';

import {
  activateControls,
  installDomGlobals,
  invokePost,
  recordEventBindings,
  snapshotPost,
  watchHandlerErrors,
  type ShellRun,
} from './surface-activation';
import { canonicalJson } from './surface-canonical-json';
import { GATE_ACTOR_SHIP, GATE_HOST_SHIP, GATE_NOW } from './surface-lint';

/**
 * The reachability pass: what a member can get to by PRESSING things.
 *
 * ## The gap this closes
 *
 * `surface preview` renders twelve cells — three viewports, two states, two
 * themes — and every one of them is a still. Rubric check 7 ("the screen is the
 * thing that was asked for") is scored off those stills, and it has now passed
 * three real defects with the same structure: every one was about what happens
 * when you press something. The worst of them (D140) is a kanban board whose
 * revision added a Blocked column and left one button per card, so the cycle
 * became `todo → doing → blocked → done` and no card could reach Done without
 * being marked Blocked first. Check 7 passed it with the note "Blocked is
 * visibly present as its own section between Doing and Done" — true of the
 * screen, silent about the board. A still cannot see reachability, so no amount
 * of care in scoring one can catch that class.
 *
 * ## What this walks, and why the browser is not in it
 *
 * A transition is a PURE function. Surface actions take no parameters, so
 * `state + actionId --reduceSurface--> state'` needs no DOM at all. What needs
 * a DOM is the other half of the question: **which controls does state S
 * render, and what does each of them invoke.** That is what
 * `activateControls` answers, through the same happy-dom shell run the publish
 * gate uses (`surface-activation.ts`, extracted from the gate rather than
 * copied), and it is the whole difference between this pass and what already
 * existed.
 *
 * The gate does a **depth-1 star walk**: it renders `initialState`, then for
 * each declared action INDEPENDENTLY folds that one action from `initialState`
 * and renders the result. It never composes two actions, so it cannot tell a
 * control that appears two presses in from a control that appears never. This
 * walks the real graph instead: the edges out of a state are the actions the
 * controls RENDERED IN THAT STATE actually invoke — never the declared action
 * list, which is what makes an unreachable action visible.
 *
 * ## Bounds, and saying which one stopped it
 *
 * The state space is not always small. D140's board is six tasks over four
 * columns: 4096 states with six edges each, and it closes in about three
 * seconds. The shipped `kanban` template also writes `/claims/$actor` on every
 * move, which multiplies that by the number of cards and puts it out of reach.
 * So the walk is bounded three ways — depth, node count and transitions
 * computed — and reports `closed` or `truncated` explicitly, naming the bound
 * that stopped it. A truncated graph is never described as if it were
 * exhaustive.
 *
 * ## What is asserted, and what is only observed
 *
 * Every finding here is gated on `closed`. On a truncated walk the same
 * observations are still reported — they are usually right — but they are not
 * asserted as defects, because a path the walk never took could refute any of
 * them. See `analyzeReachability` for the per-claim reasoning.
 *
 * ## Scope limits, stated so they are not quietly exceeded
 *
 * - **"Whether members can reach the states the request implies" is not
 *   machine-decidable here.** Nothing mechanical has access to the request,
 *   which is exactly why check 7 is a human check. `RUBRIC.md` says of it
 *   "Machine pass: reaches none of this, and could not." That stays true. What
 *   changes is that the human now scores check 7 against a reachability report
 *   instead of against a still. This pass is INPUT TO check 7, not an answer to
 *   it.
 * - **"Every option no sequence reaches" in full generality needs a notion of
 *   what options OUGHT to exist**, and the spec does not carry one. The
 *   decidable part is the observed value domain per state pointer, which is
 *   what `valueDomains` reports. No stronger claim is invented.
 * - The walk presses as ONE member, in ONE theme, with `canInvoke` true. See
 *   `REACHABILITY_NOT_CHECKED` for the rest.
 */

/* ------------------------------------------------------------------ */
/* Shared implementations, pulled in through subpaths                  */
/* ------------------------------------------------------------------ */

type ApiModule = typeof import('@tloncorp/api');

const { reduceSurface } = surfaceReducerModule as Pick<
  ApiModule,
  'reduceSurface'
>;
const { ACTOR_PLACEHOLDER } = surfaceJsonPointerModule as Pick<
  ApiModule,
  'ACTOR_PLACEHOLDER'
>;

export type SurfaceSpec = ApiModule['SurfaceSpecSchema']['_output'];
type JsonObject = SurfaceSpec['initialState'];

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

export interface TransitionBounds {
  /** presses from the opening screen; a node at this depth is not expanded */
  maxDepth: number;
  /** distinct states held; a state discovered past this is dropped */
  maxNodes: number;
  /** folds computed; the walk stops outright when this runs out */
  maxTransitions: number;
}

/**
 * The default bounds, and the measurements behind each number.
 *
 * Taken against the artifacts, not guessed. On this machine a node costs one
 * happy-dom re-render plus one fold per rendered control, which measured at
 * 0.65ms/node for D140's six-button board and 3.8ms/node for the shipped
 * `kanban` template's eighteen.
 *
 * - `maxTransitions` is the one that usually bites, because it is proportional
 *   to the actual work. 30000 lets D140's board close (4096 states, 24576
 *   transitions, ~2.7s) and stops the `kanban` template at about 1700 states
 *   and seven seconds instead of the ninety its 24577-state space would cost.
 *   That is the trade this number encodes: an app whose whole space is smaller
 *   than a six-card board's gets a closed answer; a bigger one gets a truncated
 *   one and is told so.
 * - `maxNodes` bounds memory rather than time — every held state is a full copy
 *   — and sits above the transition bound so it is rarely the binding one.
 * - `maxDepth` bounds the pathological shape the other two do not: an `append`
 *   action has no fixed point, so its chain is infinite and every step of it is
 *   a new state. 24 is above the diameter of a six-card four-column board (18),
 *   so the shape this pass was built for is not cut short by it.
 */
export const SURFACE_TRANSITION_BOUNDS: TransitionBounds = {
  maxDepth: 24,
  maxNodes: 6000,
  maxTransitions: 30000,
};

/**
 * How many distinct state pointers the value-domain pass tracks, and how many
 * distinct values it keeps per pointer.
 *
 * Both exist for the same reason the walk is bounded: a list-shaped state gives
 * every element its own pointer, and a counter gives one pointer thousands of
 * values. Overflowing either is REPORTED (`pointerOverflow`,
 * `ReachabilityValueDomain.truncated`) rather than silently absorbed — a
 * pointer nobody looked at must not read like a pointer that held still.
 */
export const MAX_TRACKED_POINTERS = 240;
export const MAX_TRACKED_VALUES = 32;

/**
 * The value recorded for a pointer that does not exist in a given state.
 *
 * Deliberately not valid JSON, so it cannot collide with any value
 * `canonicalJson` produces — a state holding the string `<absent>` serializes
 * as `"<absent>"`, quotes included, and stays distinguishable from a key that
 * is not there. "Not there" is a value worth seeing: an entry appearing is a
 * transition.
 */
export const ABSENT_VALUE = '<absent>';

/* ------------------------------------------------------------------ */
/* The graph                                                           */
/* ------------------------------------------------------------------ */

export interface TransitionNode {
  id: number;
  /** presses from the root state along the shortest path the walk found */
  depth: number;
  state: JsonObject;
  /** the canonical serialization that IS this node's identity */
  key: string;
}

export interface TransitionEdge {
  from: number;
  to: number;
  actionId: string;
  /**
   * The reducer stopped part-way through this action's ops (§7), so the target
   * state is the prefix that applied. Recorded rather than dropped: a member
   * pressing that control really does land there.
   */
  aborted: boolean;
}

export interface TransitionGraph {
  nodes: TransitionNode[];
  edges: TransitionEdge[];
  /** the greatest depth any discovered node sits at */
  depthReached: number;
  /** the frontier drained with every bound still unspent */
  exhaustive: boolean;
  /** every bound that stopped the walk, in words */
  truncatedBy: string[];
  /**
   * What activation could not press, anywhere in the walk — the same
   * shortfalls the gate reports, phrased the same way. A graph with any of
   * these is missing edges it does not know about, so it is never `closed`.
   */
  shortfalls: string[];
  bounds: TransitionBounds;
  /**
   * Set when the walk could not run at all — the bundle would not evaluate, or
   * the shell refused it. "Could not measure" and "measured, found nothing"
   * must never render the same.
   */
  problem?: string;
}

/** Every bound spent, and every control unpressed, is a missing edge. */
export function graphIsClosed(graph: TransitionGraph): boolean {
  return (
    graph.problem === undefined &&
    graph.exhaustive &&
    graph.shortfalls.length === 0
  );
}

export interface TransitionWalkInput {
  bundleSource: string;
  /** the VALIDATED spec; the walk folds through the real reducer */
  spec: SurfaceSpec;
  /** where the walk starts; `spec.initialState` when omitted */
  rootState?: JsonObject;
  bounds?: Partial<TransitionBounds>;
  /** injected for tests; a fresh happy-dom `Window` otherwise */
  createWindow?: () => unknown;
}

/* ------------------------------------------------------------------ */
/* The walk                                                            */
/* ------------------------------------------------------------------ */

/**
 * Breadth-first from the root state, pressing what is on screen.
 *
 * Breadth-first rather than depth-first on purpose: when a bound cuts the walk
 * short, what survives is everything within N presses of the opening screen,
 * which is the region a member actually explores. A depth-first cut keeps one
 * long corridor and nothing beside it.
 */
export function exploreTransitionGraph(
  input: TransitionWalkInput
): TransitionGraph {
  const bounds: TransitionBounds = {
    ...SURFACE_TRANSITION_BOUNDS,
    ...(input.bounds ?? {}),
  };
  const spec = input.spec;
  const rootState = input.rootState ?? spec.initialState;
  const makeWindow = input.createWindow ?? (() => new Window());

  const nodes: TransitionNode[] = [];
  const edges: TransitionEdge[] = [];
  const truncatedBy = new Set<string>();
  const shortfalls = new Set<string>();
  const bail = (problem: string): TransitionGraph => ({
    nodes,
    edges,
    depthReached: 0,
    exhaustive: false,
    truncatedBy: [...truncatedBy],
    shortfalls: [...shortfalls],
    bounds,
    problem,
  });

  const win = makeWindow() as Record<string, unknown>;
  const restoreGlobals = installDomGlobals(win);
  const recorder = recordEventBindings(win);
  const errors = watchHandlerErrors(win);
  try {
    let run: ShellRun;
    try {
      run = runShellFixture({
        window: win,
        bundleSource: input.bundleSource,
        spec,
        state: rootState,
        canInvoke: true,
        now: GATE_NOW,
      }) as ShellRun;
    } catch (error) {
      return bail(
        `the bundle could not be evaluated as a plain script: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const firstError = run.messages.find(
      (message) => message.type === 'error' && message.phase !== 'bridge'
    );
    if (firstError !== undefined) {
      return bail(
        `the shell reported an error on the opening render (${
          firstError.phase ?? 'unknown phase'
        }): ${firstError.message ?? ''}`.trim()
      );
    }
    if (recorder.unavailable !== null) {
      return bail(`no control could be pressed: ${recorder.unavailable}`);
    }

    const byKey = new Map<string, number>();
    // The queue is its own array, not an index into `nodes`. A state
    // discovered AT the depth bound is still recorded — its values are worth
    // seeing — but it is never expanded, and those two facts have to be able
    // to come apart.
    const queue: number[] = [];
    const push = (state: JsonObject, key: string, depth: number): number => {
      const id = nodes.length;
      nodes.push({ id, depth, state, key });
      byKey.set(key, id);
      if (depth < bounds.maxDepth) {
        queue.push(id);
      } else {
        truncatedBy.add(
          `state(s) reached at the ${bounds.maxDepth}-press depth bound were not expanded`
        );
      }
      return id;
    };
    push(rootState, canonicalJson(rootState), 0);

    const everReachable = new Set<object>();
    const reportedErrors = new Set<string>();
    const onProblem = (message: string) => shortfalls.add(message);

    let head = 0;
    let transitions = 0;
    let depthReached = 0;
    let stopped = false;

    while (head < queue.length && !stopped) {
      const node = nodes[queue[head]];
      head += 1;
      run.sendState(node.state);

      const outcome = activateControls(
        onProblem,
        run,
        recorder,
        errors,
        reportedErrors,
        everReachable,
        `state #${node.id}`
      );
      if (outcome.otherEvents.size > 0) {
        shortfalls.add(
          `controls bound only to ${[...outcome.otherEvents].sort().join(', ')} were left alone (the walk dispatches click)`
        );
      }
      if (outcome.outsideRoot.size > 0) {
        shortfalls.add(
          `${outcome.outsideRoot.size} control(s) bound outside the rendered output (a delegated listener on the document, or a detached element) could not be pressed`
        );
      }
      if (outcome.undispatched.size > 0) {
        shortfalls.add(
          `${outcome.undispatched.size} control(s) took a click the walk could not dispatch to (a listener on the rendered root itself)`
        );
      }
      if (outcome.multiInvokePresses > 0) {
        // One press, two folds. The walk models a press as ONE fold, so the
        // state that press really produces is a node this graph does not have
        // — and a missing node is a missing edge, which is the one thing the
        // dominance argument cannot survive. Reported rather than modelled: an
        // app that does this is rare enough that guessing at the combination
        // would be more machinery than the case is worth, and the shortfall
        // withholds every assertion, which is the safe direction.
        shortfalls.add(
          `${outcome.multiInvokePresses} press(es) invoked more than one action at once, and the walk folds one action per press, so where those controls really lead is not in this graph`
        );
      }
      if (outcome.budgetExhausted) {
        shortfalls.add(
          `a single screen had more controls than one activation pass may press`
        );
      }

      // Preact reuses DOM nodes across renders, but a list that reorders
      // detaches some — and the recorder holds every element it ever saw, so
      // without this the map grows with the walk and every pass rescans it.
      // Only elements that have ALREADY been inside the rendered root are
      // dropped, which is exactly the set `outsideRoot` never counts, so the
      // accounting above is untouched.
      for (const [element] of recorder.bindings) {
        if (everReachable.has(element) && !run.root.contains(element)) {
          recorder.bindings.delete(element);
        }
      }

      // One snapshot per NODE, reused by every action folded out of it: it
      // serializes the whole state, and building it per action was measured
      // as the walk's second-largest cost after the render itself.
      const base = snapshotPost(spec, GATE_HOST_SHIP, node.state);

      for (const actionId of [...outcome.invoked].sort()) {
        if (transitions >= bounds.maxTransitions) {
          truncatedBy.add(
            `the ${bounds.maxTransitions}-transition budget ran out`
          );
          stopped = true;
          break;
        }
        transitions += 1;
        const reduction = reduceSurface({
          spec,
          hostShip: GATE_HOST_SHIP,
          posts: [base, invokePost(spec, actionId, GATE_ACTOR_SHIP, 1)],
        });
        if (reduction.status !== 'reduced') {
          shortfalls.add(
            `folding "${actionId}" out of a reachable state produced no state (${reduction.status}), so where that control leads is unknown`
          );
          continue;
        }
        const key = canonicalJson(reduction.state);
        let target = byKey.get(key);
        if (target === undefined) {
          if (nodes.length >= bounds.maxNodes) {
            truncatedBy.add(`the ${bounds.maxNodes}-state budget ran out`);
            continue;
          }
          target = push(reduction.state, key, node.depth + 1);
          depthReached = Math.max(depthReached, node.depth + 1);
        }
        edges.push({
          from: node.id,
          to: target,
          actionId,
          aborted: reduction.abortedSequenceNums.length > 0,
        });
      }
    }

    return {
      nodes,
      edges,
      depthReached,
      exhaustive: !stopped && truncatedBy.size === 0,
      truncatedBy: [...truncatedBy].sort(),
      shortfalls: [...shortfalls].sort(),
      bounds,
    };
  } finally {
    errors.restore();
    recorder.restore();
    restoreGlobals();
  }
}

/* ------------------------------------------------------------------ */
/* Pointers and their value domains                                    */
/* ------------------------------------------------------------------ */

/** RFC 6901 escaping, so a key containing `/` or `~` still names one segment. */
function escapeSegment(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Every pointer in one state, mapped to the value the projection uses for it.
 *
 * A SCALAR pointer maps to its canonical value; an empty object or array maps
 * to `{}` or `[]`, which are real values a member can see change. A pointer
 * whose value has children maps to `NESTED_VALUE` instead of to the subtree:
 * projecting on the subtree would just be the graph again, and the children's
 * own pointers already carry everything that moved inside it.
 *
 * `NESTED_VALUE` exists so "this key has entries" and "this key is not there"
 * stay apart. Without it both read as `<absent>`, and a row saying a bucket
 * took the values `<absent>` and `{}` cannot be read: it means "empty, then
 * populated" and "empty, then deleted" equally well. Conflating them is sound
 * — a coarser abstraction still over-approximates every path, so a dominator
 * found on it still holds — but it is not legible, and this row is read by
 * people.
 */
export const NESTED_VALUE = '<has entries>';

export function statePointers(
  state: unknown,
  into: Map<string, string> = new Map(),
  prefix = ''
): Map<string, string> {
  if (state === null || typeof state !== 'object') {
    into.set(prefix, canonicalJson(state));
    return into;
  }
  if (Array.isArray(state)) {
    if (state.length === 0) {
      into.set(prefix, '[]');
      return into;
    }
    into.set(prefix, NESTED_VALUE);
    state.forEach((entry, index) => {
      statePointers(entry, into, `${prefix}/${index}`);
    });
    return into;
  }
  const record = state as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) {
    into.set(prefix, '{}');
    return into;
  }
  into.set(prefix, NESTED_VALUE);
  for (const key of keys) {
    statePointers(record[key], into, `${prefix}/${escapeSegment(key)}`);
  }
  return into;
}

export interface ReachabilityValueDomain {
  /** the pointer, or a `*`-wildcarded label standing for `pointers` */
  pointer: string;
  /** the concrete pointers this row covers */
  pointers: string[];
  /** the value at the root state, canonically serialized */
  rootValue: string;
  /** every value observed anywhere in the graph, sorted */
  values: string[];
  /** more distinct values than the pass tracks; `values` is a prefix */
  truncated: boolean;
}

/* ------------------------------------------------------------------ */
/* Dominators, on the projection                                       */
/* ------------------------------------------------------------------ */

/**
 * Classic iterative dominators: `Dom(n) = {n} ∪ ⋂ Dom(p)` over n's
 * predecessors, `Dom(root) = {root}`, to a fixpoint.
 *
 * Written out rather than pulled in because the graphs it runs on are the
 * PROJECTED ones — at most `MAX_TRACKED_VALUES` nodes — so the naive set
 * formulation is both fast enough and readable, and the alternative is a
 * dependency for thirty lines.
 *
 * Nodes unreachable from `root` get an empty set, which is not a dominator
 * claim about them: nothing is asserted about a value no path reaches.
 */
export function dominators(
  nodeCount: number,
  predecessors: readonly (readonly number[])[],
  root: number
): Set<number>[] {
  const successors: number[][] = Array.from({ length: nodeCount }, () => []);
  predecessors.forEach((preds, node) => {
    for (const pred of preds) {
      successors[pred].push(node);
    }
  });

  const reachable = new Set<number>([root]);
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop() as number;
    for (const next of successors[node]) {
      if (!reachable.has(next)) {
        reachable.add(next);
        stack.push(next);
      }
    }
  }

  const all = [...reachable];
  const dom: Set<number>[] = Array.from({ length: nodeCount }, () => new Set());
  for (const node of all) {
    dom[node] = node === root ? new Set([root]) : new Set(all);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of all) {
      if (node === root) {
        continue;
      }
      let next: Set<number> | null = null;
      for (const pred of predecessors[node]) {
        if (!reachable.has(pred)) {
          continue;
        }
        if (next === null) {
          next = new Set(dom[pred]);
          continue;
        }
        for (const candidate of [...next]) {
          if (!dom[pred].has(candidate)) {
            next.delete(candidate);
          }
        }
      }
      const updated = next ?? new Set<number>();
      updated.add(node);
      if (
        updated.size !== dom[node].size ||
        [...updated].some((entry) => !dom[node].has(entry))
      ) {
        dom[node] = updated;
        changed = true;
      }
    }
  }
  return dom;
}

export interface ReachabilityCheckpoint {
  /** the pointer, or a `*`-wildcarded label standing for `pointers` */
  pointer: string;
  pointers: string[];
  /** the value that is only reachable through the others */
  value: string;
  /** the mandatory values, outermost first */
  through: string[];
}

/* ------------------------------------------------------------------ */
/* Controls that cannot do anything where they are drawn                */
/* ------------------------------------------------------------------ */

/**
 * One action, and the screens on which a control invoking it does nothing.
 *
 * A SELF-LOOP in the walked graph — press it, and the state is byte-identical
 * — is the whole measurement. `renderedStates` is carried beside
 * `deadStates` because the two together are what makes the finding legible:
 * "dead on 16 of the 193 screens" is a different report from "dead on all 193".
 */
export interface ReachabilityNoOpControl {
  actionId: string;
  /** screens where a control invoked it and the fold changed nothing */
  deadStates: number;
  /** screens where some rendered control invoked it at all */
  renderedStates: number;
}

/**
 * Does every one of this action's ops name the presser?
 *
 * This is the whole false-positive defence, and it is not a heuristic: it is
 * the pattern `PARADIGM.md` documents under "The default: idempotent `set`
 * keyed by `$actor`" — *"Pressing twice writes the same literal to the same
 * path: the second press changes nothing. Reach for this first, every time."*
 * A control whose write is the presser's OWN answer is a radio button. Drawing
 * it on the screen where it already holds is how you show somebody what they
 * picked, and pressing it again correctly does nothing.
 *
 * Measured before it was believed. Walking the nine shipped templates, a bare
 * self-loop rule fires on EIGHT of them — `vote-pizza` re-pressed, `bench-ok`
 * re-pressed, `answer-yes` re-pressed — which is a check nobody would leave
 * switched on. With this exemption it fires on none of them, and still fires
 * on the board that shipped the defect.
 *
 * Two spellings of "the presser's own answer" are both accepted, because both
 * ship in the templates:
 *
 * - `$actor` in the PATH — `set /votes/$actor "pizza"` (poll, rsvp, potluck,
 *   habit-tracker, workout-tracker, leaderboard). A per-member slot.
 * - `$actor` in the VALUE — `set /paidBy/ferry "$actor"` (expense-split).
 *   A shared slot that records WHO, which is the same idempotence seen from
 *   the other side: pressing again re-writes your own name.
 *
 * EVERY op must qualify, not merely one. The board this pass was written
 * about writes two ops — `set /tasks/cover-art/status "doing"` and
 * `set /claims/$actor "cover-art"` — and an "any op" test would exempt it on
 * the strength of the second while the first is the dead half.
 *
 * An action with no ops is not exempt: it cannot change anything anywhere,
 * which is the strongest form of the defect and not an instance of the
 * pattern.
 */
export function actionWritesOnlyTheActor(
  spec: SurfaceSpec,
  actionId: string
): boolean {
  const action = spec.actions[actionId];
  if (action === undefined || action.ops.length === 0) {
    return false;
  }
  return action.ops.every((op) => {
    const path = (op as { path?: string }).path ?? '';
    if (path.split('/').includes(ACTOR_PLACEHOLDER)) {
      return true;
    }
    return valueNamesActor((op as { value?: unknown }).value);
  });
}

/** `$actor` anywhere in an op's value, at any depth. */
function valueNamesActor(value: unknown): boolean {
  if (value === ACTOR_PLACEHOLDER) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(valueNamesActor);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(valueNamesActor);
  }
  return false;
}

/**
 * Every action with a control that leads nowhere from where it is drawn.
 *
 * The measurement is one line — `edge.from === edge.to` — because the walk has
 * already done the work: an edge exists only because a control RENDERED IN
 * THAT STATE invoked that action, and its target is what the real reducer
 * produced. So a self-loop is exactly "a member looking at this screen can
 * press this, and the board will not move".
 *
 * Aborted edges are excluded. The reducer stopping part-way through an
 * action's ops (§7) can also leave the state where it was, but the cause is
 * the fold being refused rather than the control being pointless, and the two
 * must not be reported as the same thing.
 */
export function collectNoOpControls(
  graph: TransitionGraph,
  spec: SurfaceSpec
): ReachabilityNoOpControl[] {
  const dead = new Map<string, Set<number>>();
  const rendered = new Map<string, Set<number>>();
  for (const edge of graph.edges) {
    let seen = rendered.get(edge.actionId);
    if (seen === undefined) {
      seen = new Set<number>();
      rendered.set(edge.actionId, seen);
    }
    seen.add(edge.from);
    if (edge.from !== edge.to || edge.aborted) {
      continue;
    }
    let stuck = dead.get(edge.actionId);
    if (stuck === undefined) {
      stuck = new Set<number>();
      dead.set(edge.actionId, stuck);
    }
    stuck.add(edge.from);
  }

  const controls: ReachabilityNoOpControl[] = [];
  for (const [actionId, states] of dead) {
    if (actionWritesOnlyTheActor(spec, actionId)) {
      continue;
    }
    controls.push({
      actionId,
      deadStates: states.size,
      renderedStates: (rendered.get(actionId) as Set<number>).size,
    });
  }
  return controls.sort((left, right) =>
    left.actionId.localeCompare(right.actionId)
  );
}

/** How many action ids the printed no-op finding names before summarising. */
export const PRINTED_NO_OP_ACTIONS = 8;

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

export type ReachabilityFindingKind =
  | 'inert'
  | 'unreachable-actions'
  | 'mandatory-checkpoint'
  | 'no-op-control';

export interface ReachabilityFinding {
  kind: ReachabilityFindingKind;
  /** the numbered check in `RUBRIC.md` this belongs to */
  rubricCheck: number;
  /** identical for the same finding across runs, so a report can group */
  key: string;
  message: string;
}

export interface ReachabilityReport {
  bounds: TransitionBounds;
  nodeCount: number;
  edgeCount: number;
  depthReached: number;
  /** the frontier drained inside every bound */
  exhaustive: boolean;
  /** exhaustive AND every control pressed AND the walk ran at all */
  closed: boolean;
  truncatedBy: string[];
  shortfalls: string[];
  declaredActions: string[];
  /** declared actions some rendered control invoked, somewhere in the graph */
  reachedActions: string[];
  unreachedActions: string[];
  valueDomains: ReachabilityValueDomain[];
  /** more state pointers than the pass tracks; `valueDomains` is partial */
  pointerOverflow: boolean;
  checkpoints: ReachabilityCheckpoint[];
  /** actions a rendered control invokes on a screen where they change nothing */
  noOpControls: ReachabilityNoOpControl[];
  /**
   * The subset of the observations above that is ASSERTED. Empty on a walk
   * that was not closed, however suggestive the observations are.
   */
  findings: ReachabilityFinding[];
  /** printed on every run, findings or none */
  notChecked: string[];
  problem?: string;
}

/**
 * Printed whether or not anything was found.
 *
 * The same discipline as `PREVIEW_DEFECTS_NOT_CHECKED`: a pass that finds
 * nothing and says nothing else reads as "the app is fine", and that reading is
 * false in a way that would make this feature worse than not having it.
 */
export const REACHABILITY_NOT_CHECKED = [
  'whether the states it CAN reach are the states the request implies — nothing here has access to the request, which is why check 7 is yours',
  'anything a control does that is not `invoke` — the walk dispatches click and reads the invokes that come back, so a handler bound to change, input or keydown is neither pressed nor seen',
  'a second member — every press is made by one ship, so an app whose state branches per member is walked along one branch',
  'the other theme, and the read-only screen — every state is rendered light, with permission to act',
  'anything the host does — host events (`--host-ops`) move state without any control, and none of them are in this graph',
  'whether a reachable screen is any good; reachable and legible are different questions, and only the first is here',
];

interface PointerProjection {
  pointer: string;
  values: string[];
  valueIndexByNode: number[];
  rootValue: number;
  truncated: boolean;
}

/**
 * Group pointers that differ in exactly one segment behind a `*`.
 *
 * D140's board carries the same finding at `/tasks/theme/status`,
 * `/tasks/pitches/status` and four more. Six identical lines is a wall, and the
 * one line a reader wants is `/tasks` then a star then `/status`. Merging is
 * refused unless the pointers agree everywhere but one segment, so two
 * unrelated pointers that happen to share a finding stay apart.
 */
export function mergePointerLabel(pointers: readonly string[]): string | null {
  if (pointers.length === 0) {
    return null;
  }
  if (pointers.length === 1) {
    return pointers[0];
  }
  const split = pointers.map((pointer) => pointer.split('/'));
  const width = split[0].length;
  if (split.some((segments) => segments.length !== width)) {
    return null;
  }
  const differing: number[] = [];
  for (let index = 0; index < width; index += 1) {
    const distinct = new Set(split.map((segments) => segments[index]));
    if (distinct.size > 1) {
      differing.push(index);
    }
  }
  if (differing.length !== 1) {
    return null;
  }
  // The wildcard must have a named parent above it. `split[0]` is always the
  // empty string before the leading slash, so a difference at index 1 means two
  // unrelated TOP-LEVEL keys — `/crew` and `/paidBy` merging into a bare `/*`,
  // which was the first thing this produced and reads as nothing at all.
  // Siblings under a shared parent are a family; two roots are not.
  if (differing[0] < 2) {
    return null;
  }
  const merged = [...split[0]];
  merged[differing[0]] = '*';
  return merged.join('/');
}

/**
 * Turn one walked graph into the report.
 *
 * ## Why the projection, and why it is sound
 *
 * Computing "state X is on every path to state Y" on the full graph is
 * expensive and — worse — unsound the moment the walk was truncated, because
 * the bypass could sit beyond the bound. The cheap and sound route is
 * projection: for each state pointer whose value moves, build the graph over
 * that pointer's VALUES (nodes = distinct values, edges = observed
 * transitions), and take dominators there.
 *
 * The transfer argument, in full, because a wrong one here would ship an
 * unsound claim. Let π be "the value at pointer p". Every real edge S→T
 * contributes π(S)→π(T) by construction, so the image of any real path from the
 * root is a walk in the projection from π(root). Suppose value u dominates
 * value v in the projection, and suppose some real path reached a state S with
 * π(S)=v without passing through any state whose value is u. Its image is then a
 * walk from π(root) to v avoiding u, so v is reachable from π(root) in the
 * projection with u removed — which contradicts u dominating v. So dominance in
 * the projection transfers: every real path to a v-valued state passes through
 * a u-valued one.
 *
 * The transfer holds because the projection OVER-approximates the real paths.
 * Truncation is the one thing that breaks it, because a truncated walk projects
 * FEWER edges than exist, and a missing edge is exactly the bypass the argument
 * assumed away. That is why the checkpoints below are computed on every walk
 * and asserted on none that was not closed.
 *
 * ## The silence rule
 *
 * A one-state, zero-edge graph is a defect ONLY IF the spec declares actions.
 * An app that declares no actions and renders no controls has exactly that
 * graph, and it is the CORRECT shape for a declared display-only app — the
 * shipped `countdown` template is one. The rule is written this way so that
 * template stays clean by construction rather than by exception.
 */
export function analyzeReachability(
  graph: TransitionGraph,
  spec: SurfaceSpec
): ReachabilityReport {
  const declaredActions = Object.keys(spec.actions).sort();
  const reached = new Set(graph.edges.map((edge) => edge.actionId));
  const reachedActions = declaredActions.filter((id) => reached.has(id));
  const unreachedActions = declaredActions.filter((id) => !reached.has(id));
  const closed = graphIsClosed(graph);

  const projections =
    graph.problem === undefined
      ? projectPointers(graph)
      : { projections: [] as PointerProjection[], pointerOverflow: false };

  const checkpoints = collectCheckpoints(graph, projections.projections);
  const valueDomains = collectValueDomains(projections.projections);
  const noOpControls = collectNoOpControls(graph, spec);

  const findings: ReachabilityFinding[] = [];
  if (closed) {
    if (graph.nodes.length === 1 && graph.edges.length === 0) {
      if (declaredActions.length > 0) {
        findings.push({
          kind: 'inert',
          rubricCheck: 7,
          key: 'inert',
          message:
            `nothing on the opening screen leads anywhere: no control invoked any of the ` +
            `${declaredActions.length} declared action(s), so the app a member opens is the only ` +
            `screen the app has. Give each declared action a control, or drop the actions`,
        });
      }
    } else if (unreachedActions.length > 0) {
      findings.push({
        kind: 'unreachable-actions',
        rubricCheck: 7,
        key: `unreachable-actions:${unreachedActions.join(',')}`,
        message:
          `no control on any of the ${graph.nodes.length} screens a member can reach invokes ` +
          `${unreachedActions.map((id) => `"${id}"`).join(', ')} — declared and unpressable. ` +
          `Render a control for each, or drop them from the spec`,
      });
    }
    for (const checkpoint of checkpoints) {
      findings.push({
        kind: 'mandatory-checkpoint',
        rubricCheck: 7,
        key: `checkpoint:${checkpoint.pointer}:${checkpoint.value}`,
        message:
          `${checkpoint.value} at ${checkpoint.pointer} is reachable only through ` +
          `${checkpoint.through.join(', then ')} — every sequence of presses that gets there ` +
          `passes through ${checkpoint.through.length === 1 ? 'it' : 'them'} first. If that is ` +
          `not a step of the real process, the control that skips it is missing`,
      });
    }
    if (noOpControls.length > 0) {
      const named = noOpControls.slice(0, PRINTED_NO_OP_ACTIONS);
      const rest = noOpControls.length - named.length;
      findings.push({
        kind: 'no-op-control',
        rubricCheck: 7,
        key: `no-op-control:${noOpControls.map((entry) => entry.actionId).join(',')}`,
        message:
          `a control is drawn on screens where pressing it changes nothing: ` +
          `${named
            .map(
              (entry) =>
                `"${entry.actionId}" on ${entry.deadStates} of the ${entry.renderedStates} screen(s) it appears on`
            )
            .join(', ')}${rest > 0 ? `, and ${rest} more action(s)` : ''}. ` +
          `A member presses it and the board does not move. Do not render the control in the ` +
          `state it is already in — the shipped \`kanban\` template drops the card's OWN column ` +
          `from its button row for exactly this reason. (An idempotent re-press of your own ` +
          `answer is not this: an action whose every op writes \`$actor\` is exempt.)`,
      });
    }
  }

  return {
    bounds: graph.bounds,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    depthReached: graph.depthReached,
    exhaustive: graph.exhaustive,
    closed,
    truncatedBy: graph.truncatedBy,
    shortfalls: graph.shortfalls,
    declaredActions,
    reachedActions,
    unreachedActions,
    valueDomains,
    pointerOverflow: projections.pointerOverflow,
    checkpoints,
    noOpControls,
    findings,
    notChecked: [...REACHABILITY_NOT_CHECKED],
    ...(graph.problem === undefined ? {} : { problem: graph.problem }),
  };
}

/** Every pointer whose value moves, with each node's value at it. */
function projectPointers(graph: TransitionGraph): {
  projections: PointerProjection[];
  pointerOverflow: boolean;
} {
  const perNode = graph.nodes.map((node) => statePointers(node.state));
  const domains = new Map<string, { values: Set<string>; overflow: boolean }>();
  let pointerOverflow = false;
  for (const leaves of perNode) {
    for (const [pointer, value] of leaves) {
      let seen = domains.get(pointer);
      if (seen === undefined) {
        if (domains.size >= MAX_TRACKED_POINTERS) {
          pointerOverflow = true;
          continue;
        }
        seen = { values: new Set<string>(), overflow: false };
        domains.set(pointer, seen);
      }
      if (seen.values.has(value)) {
        continue;
      }
      if (seen.values.size >= MAX_TRACKED_VALUES) {
        // A pointer with more values than this holds a counter or a
        // timestamp, and its "domain" is not a domain anybody reads. The
        // overflow is carried so the row says so rather than looking settled.
        seen.overflow = true;
        continue;
      }
      seen.values.add(value);
    }
  }

  const projections: PointerProjection[] = [];
  for (const [pointer, seen] of domains) {
    // A pointer missing from some state is a pointer whose value moves, even
    // when every state that HAS it agrees — an entry appearing is a transition.
    const presentEverywhere = perNode.every((leaves) => leaves.has(pointer));
    const values = new Set(seen.values);
    if (!presentEverywhere) {
      values.add(ABSENT_VALUE);
    }
    if (values.size < 2) {
      continue;
    }
    const ordered = [...values].sort();
    const indexOf = new Map(ordered.map((value, index) => [value, index]));
    // -1 for a value the overflow dropped: it takes part in no projected edge,
    // so a dominator claim is never made about it or through it.
    const valueIndexByNode = perNode.map((leaves) => {
      const value = leaves.get(pointer) ?? ABSENT_VALUE;
      return indexOf.get(value) ?? -1;
    });
    projections.push({
      pointer,
      values: ordered,
      valueIndexByNode,
      rootValue: valueIndexByNode[0],
      truncated: seen.overflow,
    });
  }
  return { projections, pointerOverflow };
}

/** One row per pointer group, with what the pass actually saw at it. */
function collectValueDomains(
  projections: readonly PointerProjection[]
): ReachabilityValueDomain[] {
  const groups = new Map<string, PointerProjection[]>();
  for (const projection of projections) {
    const signature = `${projection.values.join(' ')}${
      projection.values[projection.rootValue] ?? ABSENT_VALUE
    }${projection.truncated}`;
    const existing = groups.get(signature);
    if (existing === undefined) {
      groups.set(signature, [projection]);
    } else {
      existing.push(projection);
    }
  }

  const rows: ReachabilityValueDomain[] = [];
  for (const group of groups.values()) {
    for (const bucket of splitByMergeability(group.map((p) => p.pointer))) {
      const first = group.find((p) => p.pointer === bucket.pointers[0]) as
        | PointerProjection
        | undefined;
      if (first === undefined) {
        continue;
      }
      rows.push({
        pointer: bucket.label,
        pointers: bucket.pointers,
        rootValue: first.values[first.rootValue] ?? ABSENT_VALUE,
        values: first.values,
        truncated: first.truncated,
      });
    }
  }
  return rows.sort((left, right) => left.pointer.localeCompare(right.pointer));
}

/** Mergeable pointers behind one `*` label; the rest one row each. */
function splitByMergeability(
  pointers: readonly string[]
): { label: string; pointers: string[] }[] {
  const merged = mergePointerLabel(pointers);
  if (merged !== null) {
    return [{ label: merged, pointers: [...pointers].sort() }];
  }
  return [...pointers]
    .sort()
    .map((pointer) => ({ label: pointer, pointers: [pointer] }));
}

/** Strict dominators on every projection, grouped and ordered for reading. */
function collectCheckpoints(
  graph: TransitionGraph,
  projections: readonly PointerProjection[]
): ReachabilityCheckpoint[] {
  interface Raw {
    pointer: string;
    value: string;
    through: string[];
  }
  const raw: Raw[] = [];

  for (const projection of projections) {
    const count = projection.values.length;
    const root = projection.rootValue;
    if (root < 0) {
      continue;
    }
    // An overflowed pointer dropped values, so some of its states project to
    // nothing and the edges touching them are gone. That makes the projection
    // an UNDER-approximation, which is the one direction dominance cannot
    // survive: a bypass could be sitting in a dropped edge. No claim is made.
    if (projection.truncated) {
      continue;
    }
    const predecessors: number[][] = Array.from({ length: count }, () => []);
    const seenEdge = new Set<string>();
    for (const edge of graph.edges) {
      const from = projection.valueIndexByNode[edge.from];
      const to = projection.valueIndexByNode[edge.to];
      if (from < 0 || to < 0 || from === to) {
        continue;
      }
      const signature = `${from}>${to}`;
      if (seenEdge.has(signature)) {
        continue;
      }
      seenEdge.add(signature);
      predecessors[to].push(from);
    }
    const dom = dominators(count, predecessors, root);
    for (let value = 0; value < count; value += 1) {
      if (value === root || dom[value].size === 0) {
        continue;
      }
      const strict = [...dom[value]].filter(
        (entry) => entry !== value && entry !== root
      );
      if (strict.length === 0) {
        continue;
      }
      // Outermost first: a dominator with a smaller dominator set sits nearer
      // the root, so `doing, then blocked` reads in the order a member walks.
      strict.sort((left, right) => dom[left].size - dom[right].size);
      const destination = projection.values[value];
      const through = strict.map((entry) => projection.values[entry]);
      // A checkpoint stated in `NESTED_VALUE` is a fact about this pass's own
      // vocabulary, not about the app: "your entry can only be emptied after it
      // had entries in it" is true of every container that is ever written to,
      // and the shipped `potluck` template produced exactly that line. The
      // sentinel is the pass declining to descend, so a mandatory step
      // expressed as it is not a step a member takes. `ABSENT_VALUE` is NOT
      // suppressed with it: "nothing there" is a state of the data a member can
      // see, and "you can only change your answer by clearing it first" is a
      // real finding.
      if (destination === NESTED_VALUE || through.includes(NESTED_VALUE)) {
        continue;
      }
      raw.push({
        pointer: projection.pointer,
        value: destination,
        through,
      });
    }
  }

  const groups = new Map<string, Raw[]>();
  for (const entry of raw) {
    const signature = `${entry.value}${entry.through.join(' ')}`;
    const existing = groups.get(signature);
    if (existing === undefined) {
      groups.set(signature, [entry]);
    } else {
      existing.push(entry);
    }
  }

  const checkpoints: ReachabilityCheckpoint[] = [];
  for (const group of groups.values()) {
    for (const bucket of splitByMergeability(
      group.map((entry) => entry.pointer)
    )) {
      checkpoints.push({
        pointer: bucket.label,
        pointers: bucket.pointers,
        value: group[0].value,
        through: group[0].through,
      });
    }
  }
  return checkpoints.sort(
    (left, right) =>
      left.pointer.localeCompare(right.pointer) ||
      left.value.localeCompare(right.value)
  );
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export interface ReachabilityOutcome {
  graph: TransitionGraph;
  report: ReachabilityReport;
}

/** Walk, then score. The graph is returned too, for tests and for debugging. */
export function analyzeSurfaceReachability(
  input: TransitionWalkInput
): ReachabilityOutcome {
  const graph = exploreTransitionGraph(input);
  return { graph, report: analyzeReachability(graph, input.spec) };
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

/** How many value-domain rows the printed report shows before summarising. */
export const PRINTED_VALUE_DOMAINS = 12;

/**
 * The report as lines a person reads, with the bound named on every run.
 *
 * The header is the part that must never be dropped: a reader who does not know
 * whether the walk closed cannot tell "no mandatory checkpoint" from "no
 * mandatory checkpoint was looked for past state 1700".
 *
 * `options.findings` exists for one caller: `surface preview` prints the
 * findings itself, in the same numbered defect list the cell pass writes into,
 * so a model reading that list reads one list and not two. It suppresses the
 * findings here rather than printing them twice — but never the truncation
 * caveat, which is the reason a short list is short.
 */
export function formatReachabilityReport(
  report: ReachabilityReport,
  options: { findings?: boolean } = {}
): string[] {
  const withFindings = options.findings ?? true;
  const lines: string[] = [];
  if (report.problem !== undefined) {
    lines.push(`Reachability: NOT WALKED — ${report.problem}`);
    lines.push(
      'Nothing below is a statement about this app; the walk never ran.'
    );
    return lines;
  }

  const shape = report.closed
    ? `closed: all ${report.nodeCount} reachable screen(s) explored, ${report.edgeCount} press(es) between them, ${report.depthReached} deep`
    : `TRUNCATED: ${report.nodeCount} screen(s) reached, ${report.edgeCount} press(es), ${report.depthReached} deep — this is a part of the app, not all of it`;
  lines.push(`Reachability (${shape})`);
  lines.push(
    `  bounds: ${report.bounds.maxDepth} presses deep, ${report.bounds.maxNodes} states, ${report.bounds.maxTransitions} transitions`
  );
  for (const reason of report.truncatedBy) {
    lines.push(`  stopped because ${reason}`);
  }
  for (const shortfall of report.shortfalls) {
    lines.push(`  not fully pressed: ${shortfall}`);
  }
  if (report.pointerOverflow) {
    lines.push(
      `  more than ${MAX_TRACKED_POINTERS} state pointers; the value domains below are partial`
    );
  }

  if (report.findings.length === 0) {
    if (!report.closed) {
      lines.push(
        '  no defect ASSERTED: a truncated walk cannot rule out a path it never took, so the observations below are reported and not scored'
      );
    } else if (withFindings) {
      lines.push(
        '  no reachability defect found — every declared action is pressable, every control drawn can move the board, and no value is a mandatory checkpoint'
      );
    }
  }
  if (withFindings) {
    for (const finding of report.findings) {
      lines.push(
        `  [rubric ${finding.rubricCheck}: ${finding.kind}] ${finding.message}`
      );
    }
  }

  if (!report.closed && report.unreachedActions.length > 0) {
    lines.push(
      `  observed: ${report.unreachedActions.length} declared action(s) went unpressed inside the bound — ${report.unreachedActions.join(', ')}`
    );
  }
  if (!report.closed) {
    for (const control of report.noOpControls) {
      lines.push(
        `  observed: pressing "${control.actionId}" changed nothing on ${control.deadStates} of the ${control.renderedStates} screen(s) it was drawn on inside the bound`
      );
    }
    for (const checkpoint of report.checkpoints) {
      lines.push(
        `  observed: ${checkpoint.value} at ${checkpoint.pointer} came only after ${checkpoint.through.join(', then ')} inside the bound`
      );
    }
  }

  // Bounded, because a list-shaped app has a row per element and a wall of
  // rows is how a report stops being read. The count is always printed, so a
  // reader knows there is more rather than believing they saw it all.
  const shownDomains = report.valueDomains.slice(0, PRINTED_VALUE_DOMAINS);
  for (const domain of shownDomains) {
    lines.push(
      `  ${domain.pointer} took ${domain.values.length}${domain.truncated ? '+' : ''} value(s): ${domain.values.join(', ')} (opens at ${domain.rootValue})`
    );
  }
  if (report.valueDomains.length > shownDomains.length) {
    lines.push(
      `  … and ${report.valueDomains.length - shownDomains.length} more state pointer(s) that moved; the full list is in the manifest`
    );
  }

  lines.push('  This pass did NOT check:');
  for (const line of report.notChecked) {
    lines.push(`    - ${line}`);
  }
  return lines;
}

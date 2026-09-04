/**
 * The control-activation harness, shared by the publish gate and the
 * reachability pass.
 *
 * All of this used to live inside `surface-lint.ts`, written for one caller:
 * render a state, press every control the app bound a click to, and report
 * which declared actions those presses invoked. `surface-transitions.ts` needs
 * exactly that answer — asked once per reachable state instead of once per run
 * — so the machinery moved here rather than being written a second time. A
 * second copy would be a second answer to "which controls does this screen
 * have", free to disagree with the gate's, and the two would be compared by
 * nobody.
 *
 * One change the move required. `activateControls` used to report a throwing
 * handler straight into the gate's violation collector under the
 * `smoke-render` rule. It now takes an `onProblem` callback: the gate passes
 * one that files the same violation it always filed, and the reachability pass
 * passes one that records the same event as a shortfall, without either
 * inheriting a rule id that means nothing to the other.
 */

/* ------------------------------------------------------------------ */
/* The shell run, hand-mirrored                                        */
/* ------------------------------------------------------------------ */

/**
 * The slice of `@tloncorp/surface-shell`'s `ShellFixtureRun` this package uses.
 * Hand-mirrored because the shell package publishes only "exports" subpaths,
 * which tsc cannot follow under moduleResolution:Node. Tracks
 * `packages/surface-shell/src/node/index.ts` — if that changes shape, this
 * changes with it (same discipline as D33's mirrored protocol types).
 */
export interface ShellRun {
  root: {
    textContent: string | null;
    querySelectorAll(selector: string): ArrayLike<ShellElement>;
    contains(node: unknown): boolean;
  };
  messages: ShellMessage[];
  sendState(state: Record<string, unknown>): void;
  /** deliver a new host-supplied timestamp and repaint */
  sendNow(now: number): void;
  /** dispatch a click on the first element matching the selector */
  click(selector: string): boolean;
}

export interface ShellElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface ShellMessage {
  type: string;
  phase?: string;
  message?: string;
  actionId?: string;
}

/* ------------------------------------------------------------------ */
/* Posts the reducer folds                                             */
/* ------------------------------------------------------------------ */

/**
 * All a post helper needs off a spec: the two fields that decide whether the
 * reducer will fold the entry at all.
 *
 * Structural rather than the validated `SurfaceSpec`, so this module does not
 * pull in the api package's schema types for two string fields — and so a
 * caller holding a raw spec can build a post without validating it first.
 */
export interface SurfaceSpecIdentity {
  surfaceId: string;
  specRevision: number;
}

export interface SurfacePostLike {
  authorId: string;
  sequenceNum: number;
  blob: string;
  /**
   * The tie-break key the reducer requires (D189).
   *
   * A synthetic post set has no host to stamp one, so it mints its own. It is
   * not decoration: without it the gate, the preview and the transition walk
   * would fold in ARRAY order while a real channel folds in id order, and the
   * one thing those tools exist to predict is what the channel will do.
   */
  id: string;
}

/**
 * A deterministic id for a post no host ever stamped.
 *
 * Zero-padded so a raw string compare on two synthetic ids agrees with their
 * sequence numbers, and prefixed by kind so two records minted at the same
 * sequence number (a boundary-0 snapshot and the invoke above it) still order
 * the same way on every run.
 */
export function syntheticPostId(kind: string, sequenceNum: number): string {
  return `synthetic-${kind}-${String(sequenceNum).padStart(6, '0')}`;
}

export function invokePost(
  spec: SurfaceSpecIdentity,
  actionId: string,
  actor: string,
  sequenceNum: number
): SurfacePostLike {
  return {
    authorId: actor,
    sequenceNum,
    id: syntheticPostId('invoke', sequenceNum),
    blob: JSON.stringify([
      {
        type: 'surface-event',
        version: 1,
        surfaceId: spec.surfaceId,
        specRevision: spec.specRevision,
        mode: 'invoke',
        actionId,
      },
    ]),
  };
}

/**
 * A host-authored snapshot of `state`, at the current revision.
 *
 * Two callers, one shape. The gate stands one in because a preserving spec has
 * no state until the host posts a snapshot at the current revision (plan §6),
 * so a fold without one reports migration-pending and proves nothing. The
 * reachability pass stands one in for a different reason: it is how an
 * ARBITRARY state becomes something the real reducer will fold an invoke on
 * top of, which is what makes a transition out of an interior node a fold and
 * not a hand-written state edit.
 */
export function snapshotPost(
  spec: SurfaceSpecIdentity,
  hostShip: string,
  state: Record<string, unknown>,
  upToSequenceNum = 0
): SurfacePostLike {
  return {
    authorId: hostShip,
    sequenceNum: upToSequenceNum,
    id: syntheticPostId('snapshot', upToSequenceNum),
    blob: JSON.stringify([
      {
        type: 'surface-snapshot',
        version: 1,
        surfaceId: spec.surfaceId,
        specRevision: spec.specRevision,
        upToSequenceNum,
        state,
      },
    ]),
  };
}

/**
 * Preact reaches for the ambient `document`, not the window the shell was
 * handed — under vitest's happy-dom environment those are the same object,
 * but a CLI process has no DOM at all, so the smoke render would throw
 * `document is not defined` before it reached any app code. The gate stands
 * the injected window up as the ambient one for the duration of the render
 * and puts back whatever was there.
 *
 * The whole lint is synchronous, so nothing of ours can observe the swap;
 * an async caller sharing the process could, which is why it is scoped this
 * tightly rather than installed once at import.
 */
export function installDomGlobals(win: Record<string, unknown>): () => void {
  const names = ['window', 'document', 'Node', 'Element', 'HTMLElement'];
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map<string, { present: boolean; value: unknown }>();
  for (const name of names) {
    previous.set(name, {
      present: name in globals,
      value: globals[name],
    });
    const replacement = name === 'window' ? win : win[name];
    if (replacement !== undefined) {
      globals[name] = replacement;
    }
  }
  return () => {
    for (const [name, saved] of previous) {
      if (saved.present) {
        globals[name] = saved.value;
      } else {
        delete globals[name];
      }
    }
  };
}

/* ------------------------------------------------------------------ */
/* Control activation                                                  */
/* ------------------------------------------------------------------ */

/**
 * How many clicks one activation pass may spend. A control that adds
 * another control on every press is otherwise unbounded, and a lint that
 * does not terminate is worse than one that misses something — so the
 * budget exists, and running out is REPORTED rather than swallowed.
 */
export const MAX_ACTIVATION_CLICKS = 64;

/** Temporary hook for `ShellFixtureRun.click`, which takes a selector. */
const CONTROL_MARKER = 'data-surface-lint-control';

export interface ControlRecorder {
  /** every event target that took a listener, and the types it took */
  bindings: Map<object, Set<string>>;
  /** set when activation cannot run at all, with the reason */
  unavailable: string | null;
  restore(): void;
}

/**
 * Records where the app bound its event listeners.
 *
 * Finding an app's controls by SELECTOR (`button`, `[role=button]`, …)
 * would miss `<div onClick=…>`, which htm/Preact bind as readily as a
 * button — and a control the gate cannot find is a handler the gate cannot
 * run. Preact attaches through `addEventListener`, so wrapping the method
 * on the prototype that owns it enumerates every listener the app took,
 * whatever element it sat on.
 *
 * The prototype is located by walking a real element's chain rather than by
 * reading `win.EventTarget`: on happy-dom those are two different objects
 * that happen to share the same function, so patching the latter records
 * nothing. Measured, and the reason this looks more indirect than it needs
 * to be.
 *
 * `addEventListener` is not the only way to take a click. `el.onclick = fn`
 * is an accessor on `HTMLElement.prototype` that stores the handler without
 * ever calling `addEventListener` — measured on happy-dom — so an element
 * bound that way was invisible to the recorder, never pressed, and never
 * reported. The setter is wrapped too, which puts the property route into
 * the SAME bindings map: it is then pressed when it sits inside the rendered
 * root, and counted as unreachable by `activateControls` when it does not.
 * A sweep of the rendered DOM for elements whose `onclick` reads back as a
 * function would have pressed the first group without ever noticing the
 * second, which is the silent miss this whole leg exists to remove.
 *
 * Only `onclick` is wrapped. The other handler properties (`onchange`,
 * `oninput`, …) are NOT observed, so an element bound only through one of
 * them is missed entirely rather than reported — the gate dispatches click
 * and nothing else, so `otherEvents` could name them but never press them.
 * That is a hole, it is the enumeration kind, and it is not closed here.
 */
export function recordEventBindings(
  win: Record<string, unknown>
): ControlRecorder {
  const bindings = new Map<object, Set<string>>();
  const inert = { bindings, unavailable: null as string | null, restore() {} };
  const doc = win.document as
    | { createElement?: (tag: string) => object }
    | undefined;
  if (doc === undefined || typeof doc.createElement !== 'function') {
    return {
      ...inert,
      unavailable: 'the injected window exposes no document.createElement',
    };
  }
  let proto = Object.getPrototypeOf(doc.createElement('div')) as Record<
    string,
    unknown
  > | null;
  while (
    proto !== null &&
    !Object.prototype.hasOwnProperty.call(proto, 'addEventListener')
  ) {
    proto = Object.getPrototypeOf(proto) as Record<string, unknown> | null;
  }
  if (proto === null) {
    return {
      ...inert,
      unavailable:
        "the injected DOM's elements own no addEventListener to observe",
    };
  }
  const owner = proto;
  const record = (target: object, type: string) => {
    const types = bindings.get(target) ?? new Set<string>();
    types.add(type);
    bindings.set(target, types);
  };
  const original = owner.addEventListener as (...args: unknown[]) => unknown;
  owner.addEventListener = function (
    this: object,
    type: unknown,
    ...rest: unknown[]
  ) {
    record(this, String(type));
    return original.call(this, type, ...rest);
  };
  const restoreOnClick = wrapOnClickSetter(doc as object, record);
  return {
    bindings,
    unavailable: null,
    restore() {
      owner.addEventListener = original;
      restoreOnClick();
    },
  };
}

/**
 * Wraps the `onclick` accessor so an `el.onclick = fn` binding is recorded
 * alongside the `addEventListener` ones, and puts the original descriptor
 * back afterwards.
 *
 * A DOM that does not define the accessor needs no wrapping and gets none:
 * there, `el.onclick = fn` writes an ordinary own property that dispatch
 * never consults, so there is no handler to miss.
 *
 * Deliberately NOT guarded against a non-configurable descriptor. WebIDL
 * requires interface members to be configurable, and this only ever runs
 * against the injected window, so the guard would protect against nothing
 * reachable — and it could not be given a fixture that trips it.
 */
function wrapOnClickSetter(
  doc: object,
  record: (target: object, type: string) => void
): () => void {
  const create = (doc as { createElement?: (tag: string) => object })
    .createElement;
  if (typeof create !== 'function') {
    return () => {};
  }
  let proto = Object.getPrototypeOf(create.call(doc, 'div')) as object | null;
  let descriptor: PropertyDescriptor | undefined;
  while (proto !== null) {
    descriptor = Object.getOwnPropertyDescriptor(proto, 'onclick');
    if (descriptor !== undefined) {
      break;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  if (proto === null || descriptor?.set === undefined) {
    return () => {};
  }
  const owner = proto;
  const saved = descriptor;
  const originalSet = descriptor.set;
  Object.defineProperty(owner, 'onclick', {
    ...saved,
    set(this: object, value: unknown) {
      if (typeof value === 'function') {
        record(this, 'click');
      }
      originalSet.call(this, value);
    },
  });
  return () => {
    Object.defineProperty(owner, 'onclick', saved);
  };
}

export interface HandlerErrorWatch {
  /** only errors raised while a click is in flight are attributed to it */
  armed: boolean;
  messages: string[];
  restore(): void;
}

/**
 * A throwing click handler is swallowed by the DOM's own dispatch — the
 * exception never reaches `el.click()`'s caller — and reported as an
 * `error` event on the window instead. Without this watch, "the app breaks
 * when you press the button" is a defect the smoke render runs into and
 * then discards.
 */
export function watchHandlerErrors(
  win: Record<string, unknown>
): HandlerErrorWatch {
  const watch: HandlerErrorWatch = {
    armed: false,
    messages: [],
    restore() {},
  };
  const target = win as unknown as {
    addEventListener?: (
      type: string,
      listener: (event: unknown) => void
    ) => void;
    removeEventListener?: (
      type: string,
      listener: (event: unknown) => void
    ) => void;
  };
  if (typeof target.addEventListener !== 'function') {
    return watch;
  }
  const listener = (event: unknown) => {
    if (!watch.armed) {
      return;
    }
    const detail = event as
      | { message?: unknown; error?: { message?: unknown } }
      | undefined;
    const message =
      typeof detail?.message === 'string' && detail.message.length > 0
        ? detail.message
        : typeof detail?.error?.message === 'string'
          ? detail.error.message
          : 'an unnamed error';
    watch.messages.push(message);
  };
  target.addEventListener('error', listener);
  watch.restore = () => {
    target.removeEventListener?.('error', listener);
  };
  return watch;
}

export interface ActivationOutcome {
  /** action ids an activated control actually invoked */
  invoked: Set<string>;
  /** event types bound to controls the gate never dispatched */
  otherEvents: Set<string>;
  /**
   * controls the recorder saw but the pending filter dropped — bound on
   * something that is not an element, or outside the rendered root
   *
   * Kept as the targets themselves, not a count: activation runs once per
   * rendered state, so the same unreachable control is dropped again on
   * every pass and a count would report one control as many.
   */
  outsideRoot: Set<object>;
  /** controls the gate marked and clicked, where the click landed on nothing */
  undispatched: Set<object>;
  /**
   * Presses whose handler invoked MORE THAN ONE action.
   *
   * The gate does not care — every one of those actions ran, which is all its
   * behavioral rules need. The reachability walk does: it models a press as one
   * fold, so a press that folds two lands somewhere neither of its single-fold
   * edges points at, and a graph missing an edge is a graph whose dominators
   * cannot be trusted. Counted here rather than inferred there, because only
   * the press knows how many invokes it produced.
   */
  multiInvokePresses: number;
  budgetExhausted: boolean;
}

function isActivatable(candidate: object): candidate is ShellElement {
  const element = candidate as Partial<ShellElement>;
  return (
    typeof element.setAttribute === 'function' &&
    typeof element.removeAttribute === 'function'
  );
}

/**
 * Presses every control the app bound a click to, and reports what came
 * back. Controls that appear only after another control is pressed are
 * picked up on the next round, because the recorder keeps seeing bindings
 * as they are made.
 */
export function activateControls(
  onProblem: (message: string) => void,
  run: ShellRun,
  recorder: ControlRecorder,
  errors: HandlerErrorWatch,
  reportedErrors: Set<string>,
  /**
   * every control that has been inside the rendered root on ANY pass of the
   * whole phase, not just this one — a control pressed on the initial state
   * and then detached by a later re-render was already exercised, and must
   * not be reported as one the gate could not reach
   */
  everReachable: Set<object>,
  when: string
): ActivationOutcome {
  const outcome: ActivationOutcome = {
    invoked: new Set<string>(),
    otherEvents: new Set<string>(),
    outsideRoot: new Set<object>(),
    undispatched: new Set<object>(),
    multiInvokePresses: 0,
    budgetExhausted: false,
  };
  const visited = new Set<object>();
  let budget = MAX_ACTIVATION_CLICKS;

  /**
   * Reachable means: an element (so the marker can go on it) that is inside
   * the tree the gate renders into. A listener on `document`, on `window`,
   * or on an element the app kept detached fails this, and used to be
   * dropped here with no accounting at all.
   */
  const reachable = (element: object) =>
    isActivatable(element) && run.root.contains(element);

  for (;;) {
    const pending = [...recorder.bindings.entries()].filter(
      ([element]) => !visited.has(element) && reachable(element)
    );
    if (pending.length === 0) {
      break;
    }
    for (const [element, types] of pending) {
      visited.add(element);
      everReachable.add(element);
      if (!types.has('click')) {
        for (const type of types) {
          outcome.otherEvents.add(type);
        }
        continue;
      }
      if (budget <= 0) {
        outcome.budgetExhausted = true;
        break;
      }
      budget -= 1;
      const control = element as ShellElement;
      const before = run.messages.length;
      control.setAttribute(CONTROL_MARKER, '');
      errors.armed = true;
      try {
        // `run.click` resolves the marker with `root.querySelector`, which
        // searches DESCENDANTS. A listener taken on the root itself passes
        // `contains` (a node contains itself), gets marked, spends budget —
        // and matches nothing, so no press happens. The return value used
        // to be discarded, which is what made that silent.
        if (!run.click(`[${CONTROL_MARKER}]`)) {
          outcome.undispatched.add(element);
        }
      } catch (error) {
        onProblem(
          `activating a control (${when}) threw: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        errors.armed = false;
        control.removeAttribute(CONTROL_MARKER);
      }
      let invokedByThisPress = 0;
      for (let index = before; index < run.messages.length; index++) {
        const message = run.messages[index];
        if (message.type === 'invoke' && typeof message.actionId === 'string') {
          outcome.invoked.add(message.actionId);
          invokedByThisPress += 1;
        }
      }
      if (invokedByThisPress > 1) {
        outcome.multiInvokePresses += 1;
      }
    }
    if (outcome.budgetExhausted) {
      break;
    }
  }

  // Counted once the loop has finished, and only for bindings that have
  // NEVER been inside the rendered root. Two false reports this avoids: an
  // element bound while detached and attached by a later press, which
  // becomes pending on the next round; and one pressed on an earlier
  // rendered state that a re-render has since detached, which is why the
  // set is the phase's and not this pass's. Bindings left unvisited by an
  // exhausted budget are reachable, so they fall out here and are reported
  // as the budget shortfall instead.
  for (const [element] of recorder.bindings) {
    if (!everReachable.has(element) && !reachable(element)) {
      outcome.outsideRoot.add(element);
    }
  }

  for (const message of errors.messages.splice(0)) {
    if (reportedErrors.has(message)) {
      continue;
    }
    reportedErrors.add(message);
    onProblem(`a control's handler threw (${when}): ${message}`);
  }
  return outcome;
}

/** `1 control` / `2 controls` — shortfall reasons are read by people. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

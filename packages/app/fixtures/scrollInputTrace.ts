/** Exact input state is separate evidence from composer/list geometry. */
export const SCROLL_INPUT_GROWTH_DRAFT =
  'Growing draft\nsecond line\nthird line\nfourth line\nfifth line\nsixth line';
export type ScrollInputState = {
  scopeKey: string;
  inputId: string;
  draft: string;
  selection: { start: number; end: number };
  composing: boolean;
  focused: boolean;
  /** Null means the collector cannot measure the actual caret geometry. */
  caretVisible: boolean | null;
  sendVisible: boolean;
  sendHitTestable: boolean;
};

export type ScrollInputSample = ScrollInputState & {
  time: number;
  valid: boolean;
};

export type ScrollInputAction = {
  id: string;
  time: number;
  kind:
    | 'input'
    | 'select-all'
    | 'send'
    | 'composition-start'
    | 'composition-end'
    | 'focus'
    | 'blur';
  scopeKey: string;
  inputId: string;
  payload: string;
};

export type ScrollInputContract = {
  version: 1 | 2;
  declaredAt: number;
  start: number;
  end: number;
  deferredThrough: number;
  actions: Omit<ScrollInputAction, 'time'>[];
  phases: {
    id: string;
    start: number;
    end: number;
    /** Omit for a stationary interval whose exact state must already hold. */
    triggerActionId?: string;
    expected: ScrollInputState;
  }[];
};

export type ScrollInputDispatch = Omit<ScrollInputAction, 'time'> & {
  start: number;
  end: number;
};

/** Raw trusted key delivery, separate from the resulting selection/input state. */
export type ScrollInputKey = {
  time: number;
  observedAt: number;
  scopeKey: string;
  inputId: string;
  trusted: boolean;
  targetIsInput: boolean;
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
};

/** Bind all raw deliveries to independently timed, predeclared driver commands. */
export function bindScrollInputDeliveries({
  declaredAt,
  expected,
  dispatches,
  events,
  keyboard,
}: {
  declaredAt: number;
  expected: Omit<ScrollInputAction, 'time'>[];
  dispatches: ScrollInputDispatch[];
  events: (ScrollInputAction & { trusted: boolean; observedAt: number })[];
  keyboard?: ScrollInputKey[];
}) {
  const issues: { code: string; kind: 'failure' | 'incomplete' }[] = [];
  const actions: ScrollInputAction[] = [];
  const keys = ['id', 'kind', 'scopeKey', 'inputId', 'payload'] as const;
  if (
    !Number.isFinite(declaredAt) ||
    !Array.isArray(expected) ||
    !expected.length ||
    !Array.isArray(dispatches) ||
    dispatches.length !== expected.length ||
    dispatches.some(
      (command, index) =>
        !command ||
        !Number.isFinite(command.start) ||
        !Number.isFinite(command.end) ||
        command.start < declaredAt ||
        command.end <= command.start ||
        command.end - command.start > 250 ||
        (index > 0 && command.start <= dispatches[index - 1].end) ||
        keys.some((key) => command[key] !== expected[index]?.[key])
    ) ||
    !Array.isArray(events) ||
    events.some(
      (event, index) =>
        !event ||
        !Number.isFinite(event.time) ||
        !Number.isFinite(event.observedAt) ||
        event.observedAt < event.time ||
        (index > 0 && event.time < events[index - 1].time) ||
        event.trusted !== true
    )
  ) {
    return {
      actions,
      issues: [
        {
          code: 'invalid-input-dispatch-evidence',
          kind: 'incomplete' as const,
        },
      ],
    };
  }
  for (const [index, command] of dispatches.entries()) {
    const delivered = events.filter(
      (event) => event.time >= command.start && event.time <= command.end
    );
    if (!delivered.length) {
      issues.push({ code: 'input-command-undelivered', kind: 'failure' });
      continue;
    }
    if (
      delivered.some((event) =>
        (['kind', 'scopeKey', 'inputId', 'payload'] as const).some(
          (key) => event[key] !== command[key]
        )
      )
    )
      issues.push({ code: 'input-command-delivery-mismatch', kind: 'failure' });
    if (delivered.some((event) => event.observedAt > command.end))
      issues.push({
        code: 'input-event-observed-after-dispatch',
        kind: 'incomplete',
      });
    actions.push({ ...expected[index], time: delivered[0].time });
  }
  if (
    events.some(
      (event) =>
        !dispatches.some(
          (command) => event.time >= command.start && event.time <= command.end
        )
    )
  )
    issues.push({ code: 'input-event-outside-dispatch', kind: 'failure' });
  if (expected.some((command) => command.kind === 'select-all')) {
    if (
      !Array.isArray(keyboard) ||
      keyboard.some(
        (key, index) =>
          !key ||
          !Number.isFinite(key.time) ||
          !Number.isFinite(key.observedAt) ||
          key.observedAt < key.time ||
          (index > 0 && key.time < keyboard[index - 1].time) ||
          typeof key.key !== 'string' ||
          typeof key.code !== 'string' ||
          [
            'trusted',
            'targetIsInput',
            'ctrlKey',
            'metaKey',
            'altKey',
            'shiftKey',
            'repeat',
          ].some(
            (field) => typeof key[field as keyof ScrollInputKey] !== 'boolean'
          )
      )
    ) {
      issues.push({
        code: 'invalid-input-keyboard-evidence',
        kind: 'incomplete',
      });
    } else {
      const selectIndex = expected.findIndex(
        (command) => command.kind === 'select-all'
      );
      const clearIndex = selectIndex + 1;
      const nonModifiers = keyboard.filter(
        (key) => !['Control', 'Meta'].includes(key.key)
      );
      const selectKey = nonModifiers[0],
        deleteKey = nonModifiers[1];
      const selectAction = actions.find(
        (action) => action.id === expected[selectIndex]?.id
      );
      const clearAction = actions.find(
        (action) => action.id === expected[clearIndex]?.id
      );
      if (
        nonModifiers.length !== 2 ||
        !selectKey ||
        selectKey.key.toLowerCase() !== 'a' ||
        selectKey.code !== 'KeyA' ||
        selectKey.ctrlKey === selectKey.metaKey ||
        !deleteKey ||
        deleteKey.key !== 'Delete' ||
        deleteKey.code !== 'Delete' ||
        deleteKey.ctrlKey ||
        deleteKey.metaKey ||
        !selectAction ||
        selectAction.time !== selectKey.time ||
        !clearAction ||
        expected[clearIndex]?.kind !== 'input' ||
        expected[clearIndex]?.payload !== '' ||
        deleteKey.time > clearAction.time ||
        keyboard.some((key) => {
          const index = key === deleteKey ? clearIndex : selectIndex;
          const command = dispatches[index];
          return (
            !command ||
            !key.trusted ||
            !key.targetIsInput ||
            key.altKey ||
            key.shiftKey ||
            key.repeat ||
            key.scopeKey !== command.scopeKey ||
            key.inputId !== command.inputId ||
            key.time < command.start ||
            key.time > command.end ||
            (key.key === 'Control' &&
              (!key.ctrlKey || key.metaKey || !selectKey?.ctrlKey)) ||
            (key.key === 'Meta' &&
              (!key.metaKey || key.ctrlKey || !selectKey?.metaKey))
          );
        })
      )
        issues.push({
          code: 'input-keyboard-delivery-mismatch',
          kind: 'failure',
        });
      if (
        keyboard.some((key) => {
          const command =
            dispatches[key === deleteKey ? clearIndex : selectIndex];
          return command && key.observedAt > command.end;
        })
      )
        issues.push({
          code: 'input-key-observed-after-dispatch',
          kind: 'incomplete',
        });
    }
  }
  return { actions, issues };
}

const MAX_GAP_MS = 100;
const MAX_ACK_MS = 100;
const P95_ACK_MS = 50;
const QUIET_TAIL_MS = 1000;
const finite = Number.isFinite;
const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const validState = (state: ScrollInputState) =>
  nonempty(state.scopeKey) &&
  nonempty(state.inputId) &&
  typeof state.draft === 'string' &&
  state.selection != null &&
  Number.isInteger(state.selection.start) &&
  Number.isInteger(state.selection.end) &&
  state.selection.start >= 0 &&
  state.selection.end >= state.selection.start &&
  state.selection.end <= state.draft.length &&
  ['composing', 'focused', 'sendVisible', 'sendHitTestable'].every(
    (key) => typeof state[key as keyof ScrollInputState] === 'boolean'
  ) &&
  (typeof state.caretVisible === 'boolean' || state.caretVisible === null);

function differences(actual: ScrollInputState, expected: ScrollInputState) {
  return [
    ...(
      [
        'scopeKey',
        'inputId',
        'draft',
        'composing',
        'focused',
        'caretVisible',
        'sendVisible',
        'sendHitTestable',
      ] as const
    ).filter(
      (key) =>
        !(key === 'caretVisible' && actual[key] === null) &&
        actual[key] !== expected[key]
    ),
    ...(actual.selection.start !== expected.selection.start ||
    actual.selection.end !== expected.selection.end
      ? ['selection']
      : []),
  ];
}

export function assessScrollInputTrace({
  contract,
  samples,
  actions,
}: {
  contract: ScrollInputContract;
  samples: readonly ScrollInputSample[];
  actions: readonly ScrollInputAction[];
}) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    phase?: string;
    time?: number;
  }[] = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete',
    phase?: string,
    time?: number
  ) => issues.push({ code, kind, phase, time });
  const acknowledgeMs: number[] = [];
  const result = () => ({
    verdict: issues.some((issue) => issue.kind === 'failure')
      ? ('FAIL' as const)
      : issues.length
        ? ('INCOMPLETE' as const)
        : ('PASS' as const),
    evidenceLevel: 'sampled-input' as const,
    semanticVerdict: issues.some(
      (issue) =>
        issue.kind === 'failure' && !issue.code.startsWith('input-caret')
    )
      ? ('FAIL' as const)
      : issues.some(
            (issue) =>
              issue.kind === 'incomplete' &&
              !issue.code.startsWith('input-caret')
          )
        ? ('INCOMPLETE' as const)
        : ('PASS' as const),
    issues,
    acknowledgeMs,
    maxAcknowledgementMs: acknowledgeMs.length
      ? Math.max(...acknowledgeMs)
      : null,
    p95AcknowledgementMs: acknowledgeMs.length
      ? [...acknowledgeMs].sort((a, b) => a - b)[
          Math.ceil(acknowledgeMs.length * 0.95) - 1
        ]
      : null,
  });
  if (
    (contract.version !== 1 && contract.version !== 2) ||
    ![
      contract.declaredAt,
      contract.start,
      contract.end,
      contract.deferredThrough,
    ].every(finite) ||
    contract.declaredAt > contract.start ||
    contract.end <= contract.start ||
    contract.deferredThrough < contract.start ||
    contract.end - contract.deferredThrough < QUIET_TAIL_MS ||
    !contract.phases.length ||
    contract.phases[0].start !== contract.start ||
    contract.phases.at(-1)!.end !== contract.end ||
    contract.phases.at(-1)!.start > contract.deferredThrough ||
    new Set(contract.phases.map((phase) => phase.id)).size !==
      contract.phases.length ||
    new Set(contract.actions.map((action) => action.id)).size !==
      contract.actions.length ||
    contract.phases.some(
      (phase, index) =>
        !nonempty(phase.id) ||
        !finite(phase.start) ||
        !finite(phase.end) ||
        phase.end <= phase.start ||
        !validState(phase.expected) ||
        phase.expected.caretVisible === null ||
        (index > 0 && phase.start !== contract.phases[index - 1].end) ||
        (phase.triggerActionId !== undefined &&
          !contract.actions.some(
            (action) => action.id === phase.triggerActionId
          ))
    )
  ) {
    add('invalid-input-contract', 'incomplete');
    return result();
  }
  if (
    !samples.length ||
    samples.some(
      (sample, index) =>
        !sample ||
        !finite(sample.time) ||
        sample.valid !== true ||
        !validState(sample) ||
        (index > 0 && sample.time <= samples[index - 1].time)
    )
  ) {
    add('invalid-input-samples', 'incomplete');
    return result();
  }
  const captureComplete = !(
    samples[0].time > contract.start ||
    samples.at(-1)!.time < contract.end ||
    samples.some(
      (sample, index) =>
        index > 0 &&
        sample.time > contract.start &&
        samples[index - 1].time < contract.end &&
        sample.time - samples[index - 1].time > MAX_GAP_MS
    )
  );
  if (!captureComplete) {
    add('input-capture-gap', 'incomplete');
  }
  if (
    actions.some(
      (action, index) =>
        !finite(action.time) ||
        !nonempty(action.id) ||
        action.time < contract.start ||
        action.time > contract.end ||
        (index > 0 && action.time < actions[index - 1].time)
    )
  ) {
    add('invalid-input-actions', 'incomplete');
    return result();
  }
  if (
    actions.length !== contract.actions.length ||
    actions.some((action, index) => {
      const expected = contract.actions[index];
      return (
        !expected ||
        (['id', 'kind', 'scopeKey', 'inputId', 'payload'] as const).some(
          (key) => action[key] !== expected[key]
        )
      );
    })
  )
    add('input-action-mismatch', 'failure');

  for (const [index, phase] of contract.phases.entries()) {
    const inPhase = samples.filter(
      (sample) =>
        sample.time >= phase.start &&
        (index === contract.phases.length - 1
          ? sample.time <= phase.end
          : sample.time < phase.end)
    );
    if (!inPhase.length) {
      add('input-phase-unobserved', 'incomplete', phase.id);
      continue;
    }
    const trigger = phase.triggerActionId
      ? actions.find((action) => action.id === phase.triggerActionId)
      : undefined;
    if (
      phase.triggerActionId &&
      (!trigger ||
        trigger.time !== phase.start ||
        trigger.scopeKey !== phase.expected.scopeKey ||
        trigger.inputId !== phase.expected.inputId)
    ) {
      add('input-phase-trigger-mismatch', 'incomplete', phase.id);
      continue;
    }
    const firstMatch = inPhase.findIndex(
      (sample) => differences(sample, phase.expected).length === 0
    );
    const deadline = phase.start + (trigger ? MAX_ACK_MS : 0);
    const acknowledged =
      firstMatch >= 0 &&
      inPhase[firstMatch].time <= (trigger ? deadline : inPhase[0].time);
    if (!acknowledged || (!trigger && firstMatch !== 0)) {
      add(
        'input-acknowledgement-missing-or-late',
        captureComplete ? 'failure' : 'incomplete',
        phase.id
      );
      continue;
    }
    if (trigger) acknowledgeMs.push(inPhase[firstMatch].time - trigger.time);
    for (const sample of inPhase.slice(firstMatch)) {
      if (sample.caretVisible === null)
        add('input-caret-unmeasured', 'incomplete', phase.id, sample.time);
      for (const field of differences(sample, phase.expected))
        add(`input-${field}-changed`, 'failure', phase.id, sample.time);
    }
  }
  if (
    result().p95AcknowledgementMs !== null &&
    result().p95AcknowledgementMs! > P95_ACK_MS
  )
    add(
      'input-acknowledgement-p95',
      captureComplete ? 'failure' : 'incomplete'
    );
  return result();
}

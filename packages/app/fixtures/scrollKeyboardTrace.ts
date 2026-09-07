export type KeyboardState = {
  value: string;
  start: number;
  end: number;
  focus: 'input' | 'send' | 'other';
  composing: boolean;
};
export type KeyboardStep = {
  id: string;
  key: string;
  mainKey: string;
  before: KeyboardState;
  after: KeyboardState;
  input?: { type: string; data: string | null };
};
export type KeyboardPlan = {
  version: 1;
  scope: string;
  token: string;
  modifier: 'Meta' | 'Control';
  position: 'latest' | 'history';
  anchorId: string;
  steps: KeyboardStep[];
  finalText: string;
};
export type KeyboardEvent = {
  type: string;
  time: number;
  observedAt: number;
  trusted: boolean;
  scope: string;
  target: 'input' | 'send' | 'other';
  key?: string;
  inputType?: string;
  data?: string | null;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
};
export type KeyboardSample = {
  time: number;
  duration: number;
  valid: boolean;
  scope: string;
  sameInput: boolean;
  state: KeyboardState;
  caret: null;
  inputVisible: boolean;
  sendVisible: boolean;
  geometry: {
    offset: number;
    extent: number;
    height: number;
    rows: { id: string; top: number; height: number }[];
  };
};
export type KeyboardTrace = {
  declaredAt: number;
  plan: KeyboardPlan;
  dispatches: { id: string; key: string; start: number; end: number }[];
  events: KeyboardEvent[];
  samples: KeyboardSample[];
  plannedEnd: number;
  errors: string[];
};
export type KeyboardBackend = {
  channel: string;
  posts: { id: string; author: string; text: string; essay: unknown }[];
  requests: {
    time: number;
    scope: string;
    channel: string;
    author: string;
    text: string;
    actions: unknown;
  }[];
};

/** The fixed operation plan is derived from test input, never recorded success. */
export function createKeyboardPlan(
  scope: string,
  token: string,
  modifier: 'Meta' | 'Control',
  position: 'latest' | 'history',
  anchorId: string
): KeyboardPlan {
  const steps: KeyboardStep[] = [];
  let state: KeyboardState = {
    value: '',
    start: 0,
    end: 0,
    focus: 'input',
    composing: false,
  };
  const step = (
    key: string,
    after: KeyboardState,
    input?: KeyboardStep['input'],
    mainKey = key.split('+').at(-1)!
  ) => {
    steps.push({
      id: `key-${steps.length + 1}`,
      key,
      mainKey,
      before: { ...state },
      after: { ...after },
      ...(input ? { input } : {}),
    });
    state = after;
  };
  const type = (text: string) => {
    for (const char of text) {
      const value =
        state.value.slice(0, state.start) + char + state.value.slice(state.end);
      step(
        char === ' ' ? 'Space' : char,
        { ...state, value, start: state.start + 1, end: state.start + 1 },
        { type: 'insertText', data: char },
        char
      );
    }
  };
  type(`keyboard ${token} alpha beta omega`);
  for (let i = 0; i < 10; i++)
    step('ArrowLeft', {
      ...state,
      start: state.start - 1,
      end: state.start - 1,
    });
  for (let i = 0; i < 4; i++)
    step('Shift+ArrowRight', { ...state, end: state.end + 1 });
  type('z');
  const restored = { ...state, start: state.start - 1 };
  step(
    'Backspace',
    {
      ...state,
      value:
        state.value.slice(0, state.start - 1) + state.value.slice(state.end),
      start: state.start - 1,
      end: state.end - 1,
    },
    { type: 'deleteContentBackward', data: null }
  );
  const deleted = { ...state };
  step(`${modifier}+z`, restored, { type: 'historyUndo', data: null });
  step(`${modifier}+Shift+z`, deleted, { type: 'historyRedo', data: null });
  step('Tab', { ...state, focus: 'send' });
  step('Shift+Tab', { ...state, focus: 'input' });
  type('q');
  step(
    'Shift+Enter',
    {
      ...state,
      value:
        state.value.slice(0, state.start) + '\n' + state.value.slice(state.end),
      start: state.start + 1,
      end: state.end + 1,
    },
    { type: 'insertLineBreak', data: null }
  );
  type('tail');
  const finalText = state.value;
  step('Enter', { ...state, value: '', start: 0, end: 0 });
  return {
    version: 1,
    scope,
    token,
    modifier,
    position,
    anchorId,
    steps,
    finalText,
  };
}

const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [key, canonical(value)])
        )
      : v;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const finite = (...values: unknown[]) =>
  values.every((v) => typeof v === 'number' && Number.isFinite(v));
const validState = (s: KeyboardState) =>
  s &&
  typeof s.value === 'string' &&
  Number.isInteger(s.start) &&
  Number.isInteger(s.end) &&
  s.start >= 0 &&
  s.end >= s.start &&
  s.end <= s.value.length &&
  ['input', 'send', 'other'].includes(s.focus) &&
  typeof s.composing === 'boolean';
export function assessScrollKeyboardTrace(
  trace: KeyboardTrace,
  expected: KeyboardPlan,
  backend?: KeyboardBackend
) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    dimension: 'input' | 'geometry' | 'routing';
    index?: number;
  }[] = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete',
    dimension: 'input' | 'geometry' | 'routing' = 'input',
    index?: number
  ) =>
    issues.push({
      code,
      kind,
      dimension,
      ...(index === undefined ? {} : { index }),
    });
  const finish = (latencies: number[] = []) => ({
    verdict: issues.some((i) => i.kind === 'failure')
      ? 'FAIL'
      : issues.length
        ? 'INCOMPLETE'
        : 'PASS',
    issues,
    acknowledgement: {
      max: latencies.length ? Math.max(...latencies) : null,
      p95: latencies.length
        ? [...latencies].sort((a, b) => a - b)[
            Math.ceil(latencies.length * 0.95) - 1
          ]
        : null,
    },
    caretGeometry: 'INCOMPLETE',
    presentedFrames: 'INCOMPLETE',
    evidenceLevel: 'sampled-real-keyboard-dom-and-geometry',
  });
  if (
    !trace ||
    !expected ||
    !/^[0-9a-f]{8}$/.test(expected.token) ||
    !['Meta', 'Control'].includes(expected.modifier) ||
    !['latest', 'history'].includes(expected.position) ||
    !same(
      expected,
      createKeyboardPlan(
        expected.scope,
        expected.token,
        expected.modifier,
        expected.position,
        expected.anchorId
      )
    ) ||
    !same(trace.plan, expected) ||
    !finite(trace.declaredAt, trace.plannedEnd) ||
    !Array.isArray(trace.errors) ||
    trace.errors.length ||
    !Array.isArray(trace.samples) ||
    trace.samples.length < 6 ||
    !Array.isArray(trace.events) ||
    !Array.isArray(trace.dispatches)
  ) {
    add('invalid-keyboard-contract-or-capture', 'incomplete');
    return finish();
  }
  const commands = trace.dispatches;
  const first = trace.samples[0];
  const last = trace.samples.at(-1)!;
  if (
    commands.length !== expected.steps.length ||
    commands.some(
      (c, i) =>
        c?.id !== expected.steps[i]?.id ||
        c.key !== expected.steps[i]?.key ||
        !finite(c.start, c.end) ||
        c.start < trace.declaredAt ||
        c.end <= c.start ||
        c.end - c.start > 250 ||
        (i && c.start < commands[i - 1].end + 120)
    ) ||
    first?.time < trace.declaredAt ||
    commands[0]?.start - first?.time < 200 ||
    trace.plannedEnd !== commands.at(-1)?.end! + 2000 ||
    last?.time < trace.plannedEnd
  ) {
    add('missing-dispatch-or-independent-coverage', 'incomplete');
    return finish();
  }
  let acquisition = true;
  let structurallyValid = true;
  trace.samples.forEach((s, i) => {
    const g = s?.geometry;
    if (
      !s ||
      !finite(s.time, s.duration) ||
      s.duration < 0 ||
      s.duration > 32 ||
      s.valid !== true ||
      typeof s.scope !== 'string' ||
      typeof s.sameInput !== 'boolean' ||
      !validState(s.state) ||
      s.caret !== null ||
      typeof s.inputVisible !== 'boolean' ||
      typeof s.sendVisible !== 'boolean' ||
      !g ||
      !finite(g.offset, g.extent, g.height) ||
      g.height <= 0 ||
      g.extent <= g.height ||
      !Array.isArray(g.rows) ||
      g.rows.some(
        (r) =>
          !r ||
          typeof r.id !== 'string' ||
          !finite(r.top, r.height) ||
          r.height <= 0
      ) ||
      new Set(g.rows.map((r) => r.id)).size !== g.rows.length ||
      (i && s.time < trace.samples[i - 1].time)
    ) {
      acquisition = false;
      structurallyValid = false;
      add('invalid-or-gapped-keyboard-sample', 'incomplete', 'input', i);
    } else if (i && s.time - trace.samples[i - 1].time > 100) {
      acquisition = false;
      add('invalid-or-gapped-keyboard-sample', 'incomplete', 'input', i);
    }
  });
  if (!acquisition)
    add('incomplete-geometry-acquisition', 'incomplete', 'geometry');
  if (!structurallyValid) return finish();
  const baselineAnchor = first.geometry.rows.find(
    (r) => r.id === expected.anchorId
  );
  const gap = (s: KeyboardSample) =>
    s.geometry.extent - s.geometry.height - s.geometry.offset;
  if (
    !same(first.state, expected.steps[0].before) ||
    first.scope !== expected.scope ||
    !first.sameInput ||
    !first.inputVisible ||
    !first.sendVisible ||
    (expected.position === 'latest'
      ? Math.abs(gap(first)) > 1
      : gap(first) <= 100 ||
        !baselineAnchor ||
        baselineAnchor.top + baselineAnchor.height <= 0 ||
        baselineAnchor.top >= first.geometry.height)
  ) {
    add('invalid-keyboard-baseline', 'incomplete');
    return finish();
  }
  const eventsValid = trace.events.every(
    (e, i) =>
      e &&
      finite(e.time, e.observedAt) &&
      e.time >= first.time &&
      e.observedAt <= last.time &&
      e.observedAt >= e.time - 0.1 &&
      e.observedAt - e.time <= 100 &&
      e.trusted === true &&
      typeof e.scope === 'string' &&
      ['input', 'send', 'other'].includes(e.target) &&
      [
        'keydown',
        'keyup',
        'beforeinput',
        'input',
        'focus',
        'blur',
        'compositionstart',
        'compositionend',
      ].includes(e.type) &&
      (i === 0 || e.time >= trace.events[i - 1].time)
  );
  if (!eventsValid) {
    add('invalid-or-delayed-trusted-event-capture', 'incomplete');
    return finish();
  }
  const send = commands.at(-1)!;
  const scanGeometry = () =>
    trace.samples.forEach((s, i) => {
      if (
        !s.geometry.rows.some(
          (r) => r.top + r.height > 0 && r.top < s.geometry.height
        )
      )
        add('blank-message-viewport', 'failure', 'geometry', i);
      if (expected.position === 'latest' || s.time >= send.end + 1000) {
        if (Math.abs(gap(s)) > 1) add('latest-gap', 'failure', 'geometry', i);
      } else if (s.time < send.start) {
        const anchor = s.geometry.rows.find((r) => r.id === expected.anchorId);
        if (
          !anchor ||
          anchor.top + anchor.height <= 0 ||
          anchor.top >= s.geometry.height ||
          Math.abs(anchor.top - baselineAnchor!.top) > 1 ||
          Math.abs(anchor.height - baselineAnchor!.height) > 1
        )
          add('reading-anchor-moved', 'failure', 'geometry', i);
      }
    });
  if (!acquisition) {
    const ownership =
      trace.samples.every((s) => s.scope === expected.scope && s.sameInput) &&
      trace.events.every((e) => e.scope === expected.scope);
    const witnessed = commands.every((c, i) =>
      ['keydown', 'keyup'].every(
        (type) =>
          trace.events.filter(
            (e) =>
              e.type === type &&
              e.time >= c.start &&
              e.time <= c.end &&
              e.key?.toLowerCase() === expected.steps[i].mainKey.toLowerCase()
          ).length === 1
      )
    );
    if (ownership && witnessed) scanGeometry();
    return finish();
  }
  const latencies: number[] = [];
  commands.forEach((command, index) => {
    const step = expected.steps[index];
    const events = trace.events.filter(
      (e) => e.time >= command.start && e.time <= command.end
    );
    const main = (e: KeyboardEvent) =>
      e.key?.toLowerCase() === step.mainKey.toLowerCase();
    const down = events.filter((e) => e.type === 'keydown' && main(e));
    const up = events.filter((e) => e.type === 'keyup' && main(e));
    const modifier = (key: string) =>
      step.key.split('+').slice(0, -1).includes(key);
    if (
      down.length !== 1 ||
      up.length !== 1 ||
      down[0]?.target !== step.before.focus ||
      up[0]?.target !== step.after.focus ||
      up[0]?.time < down[0]?.time ||
      down[0]?.shift !== modifier('Shift') ||
      down[0]?.meta !== modifier('Meta') ||
      down[0]?.ctrl !== modifier('Control') ||
      down[0]?.alt !== false ||
      events.some(
        (e) =>
          e.scope !== expected.scope ||
          ((e.type === 'keydown' || e.type === 'keyup') &&
            !main(e) &&
            !step.key
              .split('+')
              .slice(0, -1)
              .includes(e.key ?? ''))
      )
    )
      add('missing-extra-or-wrong-key-delivery', 'failure', 'input', index);
    for (const type of ['beforeinput', 'input']) {
      const inputs = events.filter((e) => e.type === type);
      if (
        step.input
          ? inputs.length !== 1 ||
            inputs[0].target !== 'input' ||
            inputs[0].inputType !== step.input.type ||
            inputs[0].data !== step.input.data ||
            inputs[0].time < down[0]?.time
          : inputs.length !== 0
      )
        add('wrong-keyboard-input-delivery', 'failure', 'input', index);
    }
    const focusEvents = events.filter(
      (e) => e.type === 'focus' || e.type === 'blur'
    );
    if (
      step.before.focus !== step.after.focus
        ? focusEvents.length !== 2 ||
          focusEvents[0].type !== 'blur' ||
          focusEvents[0].target !== step.before.focus ||
          focusEvents[1].type !== 'focus' ||
          focusEvents[1].target !== step.after.focus
        : focusEvents.length !== 0
    )
      add('wrong-focus-route', 'failure', 'input', index);
    if (events.some((e) => e.type.startsWith('composition')))
      add('unexpected-composition', 'failure', 'input', index);
    const until = commands[index + 1]?.start ?? trace.plannedEnd;
    const observed = trace.samples.filter(
      (s) => s.time >= command.start && s.time < until
    );
    const ack = observed.find((s) => same(s.state, step.after));
    if (!ack || !down.length || ack.time - down[0].time > 100)
      add('missing-or-late-keyboard-ack', 'failure', 'input', index);
    else {
      // Browser focus transfer may expose document.body between its blur and
      // focus events. Permit that exact event-bounded bridge, never a later gap.
      const focusBridge = (s: KeyboardSample) =>
        focusEvents.length === 2 &&
        focusEvents[0].type === 'blur' &&
        focusEvents[1].type === 'focus' &&
        s.time >= focusEvents[0].time &&
        s.time <= focusEvents[1].time &&
        same(s.state, { ...step.before, focus: 'other' });
      latencies.push(Math.max(0, ack.time - down[0].time));
      if (
        observed.some((s) =>
          s.time >= ack.time
            ? !same(s.state, step.after)
            : !same(s.state, step.before) &&
              !same(s.state, step.after) &&
              !focusBridge(s)
        )
      )
        add('transient-or-reverted-keyboard-state', 'failure', 'input', index);
    }
  });
  if (
    trace.events.some(
      (e) => !commands.some((c) => e.time >= c.start && e.time <= c.end)
    )
  )
    add('event-outside-key-dispatch', 'failure');
  if (
    trace.samples.some(
      (s) =>
        s.time < commands[0].start && !same(s.state, expected.steps[0].before)
    )
  )
    add('draft-changed-before-first-key', 'failure');
  if (
    trace.samples.some(
      (s) =>
        s.scope !== expected.scope ||
        !s.sameInput ||
        !s.inputVisible ||
        !s.sendVisible
    )
  )
    add('input-owner-hidden-or-replaced', 'failure');
  const p95 = [...latencies].sort((a, b) => a - b)[
    Math.ceil(latencies.length * 0.95) - 1
  ];
  if (p95 > 50) add('keyboard-ack-p95-exceeded', 'failure');
  scanGeometry();
  let channel = '';
  try {
    channel = decodeURIComponent(expected.scope.split('/channel/')[1] ?? '');
  } catch {
    /* rejected below */
  }
  if (
    !backend ||
    backend.channel !== channel ||
    !Array.isArray(backend.requests) ||
    !Array.isArray(backend.posts)
  )
    add('missing-backend-send-evidence', 'incomplete', 'routing');
  else {
    if (backend.requests.some((r) => !finite(r.time)))
      add('missing-actual-send-start-time', 'incomplete', 'routing');
    if (
      backend.requests.length !== 1 ||
      backend.requests.some(
        (r) =>
          finite(r.time) &&
          (r.time < send.start ||
            r.time > send.end + 1000 ||
            r.scope !== expected.scope ||
            r.channel !== channel ||
            r.author !== '~zod' ||
            r.text !==
              expected.finalText
                .split('\n')
                .map((line) => line + ' ')
                .join('\n'))
      )
    )
      add('wrong-or-premature-send-route', 'failure', 'routing');
    if (
      backend.posts.length !== 1 ||
      backend.posts.some(
        (p) =>
          !p.id ||
          p.author !== '~zod' ||
          p.text !==
            expected.finalText
              .split('\n')
              .map((line) => line + ' ')
              .join('\n') ||
          !p.essay
      )
    )
      add('wrong-or-duplicate-committed-message', 'failure', 'routing');
  }
  return finish(latencies);
}

export type PendingSendEvidence = {
  version: 1;
  title: 'pending Enter send cannot reclaim latest after deliberate upward scrolling';
  token: string;
  scope: string;
  channel: string;
  text: string;
  declaredAt: number;
  timeOrigin: number;
  preparation: {
    ship: string;
    e2eMode: boolean;
    origin: string;
    browser: string;
    headed: boolean;
    driver: {
      project: string;
      headless: boolean | undefined;
      channel: string | undefined;
    };
    scripts: string[];
    developmentRuntime: boolean;
  };
  events: {
    type: string;
    time: number;
    observedAt: number;
    trusted: boolean;
    scope: string;
    target: 'input' | 'list' | 'other';
    key?: string;
    deltaY?: number;
    value: string;
  }[];
  samples: {
    time: number;
    duration: number;
    valid: boolean;
    scope: string;
    value: string;
    offset: number;
    extent: number;
    height: number;
    sentRows: { id: string; text: string; deliveryCount: number }[];
  }[];
  marks: {
    id: 'enter' | 'pending' | 'read' | 'release' | 'terminal';
    time: number;
  }[];
  request: {
    url: string;
    method: string;
    body: string;
    actions: unknown;
    heldAt: number;
    releasedAt: number;
    continuedAt: number;
    overridesProvided: boolean;
  } | null;
  backend: {
    phase: 'held' | 'terminal';
    url: string;
    status: number;
    startedAt: number;
    completedAt: number;
    body: unknown;
  }[];
  sse: {
    supported: boolean;
    errors: string[];
    messages: { url: string; receivedAt: number; raw: string }[];
  };
  reading: import('./scrollReadingTrace').ScrollReadingTrace | null;
  readingContract: import('./scrollReadingTrace').ScrollReadingContract | null;
  plannedEnd: number | null;
  errors: string[];
};

/** One delayed real send, then deliberate READ. This reuses the reading oracle;
 * it neither models the scroller's desired state nor certifies presented pixels. */
export function assessPendingSendEvidence(
  proof: PendingSendEvidence,
  evaluateReading: typeof import('./scrollReadingTrace').assessScrollReadingTrace
) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    dimension: 'input' | 'geometry' | 'routing';
  }[] = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete' = 'incomplete',
    dimension: 'input' | 'geometry' | 'routing' = 'routing'
  ) => issues.push({ code, kind, dimension });
  const finish = () => ({
    verdict: issues.some((i) => i.kind === 'failure')
      ? ('FAIL' as const)
      : issues.length
        ? ('INCOMPLETE' as const)
        : ('PASS' as const),
    issues,
    presentedFrames: 'INCOMPLETE' as const,
    caretGeometry: 'INCOMPLETE' as const,
  });
  const finite = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n);
  try {
    if (
      proof.version !== 1 ||
      proof.title !==
        'pending Enter send cannot reclaim latest after deliberate upward scrolling' ||
      !/^[a-f0-9]{8}$/.test(proof.token) ||
      proof.text !==
        `Pending send ${proof.token} keeps later reading intent.` ||
      proof.preparation.ship !== 'zod' ||
      proof.preparation.e2eMode !== false ||
      proof.preparation.headed !== true ||
      proof.preparation.driver?.headless !== false ||
      proof.preparation.driver?.channel !== 'chromium' ||
      !proof.preparation.driver?.project ||
      proof.preparation.origin !== 'http://localhost:3000' ||
      !proof.preparation.browser ||
      !Array.isArray(proof.preparation.scripts) ||
      !proof.preparation.scripts.length ||
      !/^chat\/~zod\/[^/]+$/.test(proof.channel) ||
      decodeURIComponent(proof.scope.split('/channel/')[1] ?? '') !==
        proof.channel ||
      !finite(proof.timeOrigin) ||
      !finite(proof.declaredAt)
    ) {
      add('invalid-pending-send-identity');
      return finish();
    }
    const marks = new Map(proof.marks.map((m) => [m.id, m.time]));
    const ids = ['enter', 'pending', 'read', 'release', 'terminal'] as const;
    if (
      proof.marks.length !== ids.length ||
      marks.size !== ids.length ||
      ids.some(
        (id, i) =>
          !finite(marks.get(id)) ||
          (i > 0 && marks.get(id)! <= marks.get(ids[i - 1])!)
      ) ||
      marks.get('enter')! <= proof.declaredAt ||
      proof.plannedEnd !== marks.get('release')! + 5000 ||
      marks.get('terminal')! > marks.get('release')! + 4000
    ) {
      add('invalid-pending-send-phase-order-or-deadline');
      return finish();
    }
    const enter = marks.get('enter')!,
      pending = marks.get('pending')!,
      read = marks.get('read')!,
      release = marks.get('release')!,
      terminal = marks.get('terminal')!;
    const samples = proof.samples;
    const baseline = samples[0];
    const phaseSample = (time: number) => samples.find((s) => s.time >= time);
    if (
      !baseline ||
      samples.length < 3 ||
      baseline.time < proof.declaredAt ||
      baseline.time > enter ||
      !baseline.valid ||
      baseline.scope !== proof.scope ||
      ![baseline.time, baseline.offset, baseline.extent, baseline.height].every(
        finite
      ) ||
      baseline.height <= 0 ||
      Math.abs(baseline.extent - baseline.height - baseline.offset) > 1 ||
      baseline.value !== '' ||
      baseline.sentRows.length
    ) {
      add('invalid-pending-send-latest-baseline');
      return finish();
    }
    if (
      !Array.isArray(proof.events) ||
      proof.events.some(
        (e, i) =>
          !finite(e.time) ||
          !finite(e.observedAt) ||
          e.observedAt < e.time ||
          e.observedAt - e.time > 100 ||
          e.scope !== proof.scope ||
          (i > 0 && e.time < proof.events[i - 1].time)
      )
    ) {
      add('invalid-pending-send-input-events');
      return finish();
    }
    const keys = proof.events.filter(
      (e) => e.type === 'keydown' && e.key === 'Enter'
    );
    const wheels = proof.events.filter((e) => e.type === 'wheel');
    const pendingSample = phaseSample(pending),
      readSample = phaseSample(read);
    if (
      keys.length !== 1 ||
      !keys[0].trusted ||
      keys[0].target !== 'input' ||
      keys[0].time < enter ||
      keys[0].time > pending ||
      keys[0].value !== proof.text ||
      !wheels.some(
        (e) =>
          e.trusted &&
          e.target === 'list' &&
          (e.deltaY ?? 0) < 0 &&
          e.time > pending &&
          e.time < read
      ) ||
      wheels.some((e) => e.time >= read) ||
      !pendingSample ||
      pendingSample.time - pending > 100 ||
      pendingSample.sentRows.length !== 1 ||
      pendingSample.sentRows[0].deliveryCount !== 1 ||
      !pendingSample.sentRows[0].text.includes(proof.text) ||
      pendingSample.value !== '' ||
      !readSample ||
      readSample.time - read > 100 ||
      readSample.offset >= pendingSample.offset - 20 ||
      readSample.extent - readSample.height - readSample.offset <= 20
    ) {
      add('missing-actual-pending-send-or-deliberate-read');
      return finish();
    }
    const request = proof.request;
    let action:
      | {
          id: number;
          action: string;
          app: string;
          json: {
            channel: {
              nest: string;
              action: {
                post: {
                  add: { content: unknown; author: string; sent: number };
                };
              };
            };
          };
        }
      | undefined;
    if (
      request &&
      Array.isArray(request.actions) &&
      request.actions.length === 1
    )
      action = request.actions[0];
    if (
      !request ||
      !action ||
      request.method !== 'PUT' ||
      !request.url.startsWith(`${proof.preparation.origin}/~/channel/`) ||
      request.overridesProvided !== false ||
      JSON.stringify(JSON.parse(request.body)) !==
        JSON.stringify(request.actions) ||
      action.action !== 'poke' ||
      action.app !== 'channels' ||
      !Number.isInteger(action.id) ||
      action.json.channel.nest !== proof.channel ||
      action.json.channel.action.post.add.author !== '~zod' ||
      JSON.stringify(action.json.channel.action.post.add.content) !==
        JSON.stringify([{ inline: [proof.text + ' '] }]) ||
      ![
        request.heldAt,
        request.releasedAt,
        request.continuedAt,
        action.json.channel.action.post.add.sent,
      ].every(finite) ||
      request.heldAt < keys[0].time ||
      request.heldAt >= pending ||
      request.releasedAt !== release ||
      request.continuedAt < release ||
      request.continuedAt > release + 100
    ) {
      add('missing-exact-held-and-unchanged-send-request');
      return finish();
    }
    const url = `${proof.preparation.origin}/~/scry/channels/v5/${proof.channel}/posts/newest/50/post.json`;
    const reads = proof.backend;
    // Never coerce Urbit IDs to Number: these integers exceed JS precision.
    const canonicalId = (value: unknown): string | null => {
      if (
        typeof value !== 'string' ||
        !/^(?:[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(value)
      )
        return null;
      return value.replaceAll('.', '');
    };
    type WirePost = {
      seal: { id: string; seq: number };
      essay: { author: string; sent: number; content: unknown };
    };
    const completeWindow = (body: unknown): Map<string, WirePost> | null => {
      if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
      const window = body as {
        posts?: Record<string, WirePost>;
        total?: number;
        newest?: number;
        older?: unknown;
        newer?: unknown;
      };
      if (
        !window.posts ||
        typeof window.posts !== 'object' ||
        Array.isArray(window.posts) ||
        window.older !== null ||
        window.newer !== null ||
        !Number.isInteger(window.total) ||
        !Number.isInteger(window.newest)
      )
        return null;
      const entries = Object.entries(window.posts);
      if (
        entries.length !== window.total ||
        entries.length > 50 ||
        entries.length === 0 ||
        window.newest !== entries.length
      )
        return null;
      const result = new Map<string, WirePost>(),
        sequences = new Set<number>();
      for (const [key, post] of entries) {
        const id = canonicalId(post?.seal?.id);
        if (
          !id ||
          canonicalId(key) !== id ||
          result.has(id) ||
          !Number.isInteger(post.seal.seq) ||
          post.seal.seq < 1 ||
          post.seal.seq > entries.length ||
          sequences.has(post.seal.seq) ||
          !post.essay ||
          typeof post.essay.author !== 'string' ||
          !finite(post.essay.sent) ||
          !Array.isArray(post.essay.content)
        )
          return null;
        result.set(id, post);
        sequences.add(post.seal.seq);
      }
      return result;
    };
    const heldReadValid =
      reads.length >= 1 &&
      reads[0].phase === 'held' &&
      reads[0].url === url &&
      reads[0].status === 200 &&
      finite(reads[0].startedAt) &&
      finite(reads[0].completedAt) &&
      reads[0].completedAt >= reads[0].startedAt &&
      reads[0].startedAt >= pending &&
      reads[0].completedAt < release;
    const heldWindow = heldReadValid ? completeWindow(reads[0].body) : null;
    if (!heldWindow || heldWindow.size !== 36)
      add('incomplete-held-backend-window');
    const matches = (window: Map<string, WirePost>) =>
      [...window.values()].filter((post) =>
        JSON.stringify(post.essay.content).includes(proof.token)
      );
    if (heldWindow && matches(heldWindow).length !== 0)
      add('send-already-committed-before-release');
    const terminalReadValid =
      reads.length === 2 &&
      reads[1].phase === 'terminal' &&
      reads[1].url === url &&
      reads[1].status === 200 &&
      finite(reads[1].startedAt) &&
      finite(reads[1].completedAt) &&
      reads[1].startedAt >= release &&
      reads[1].completedAt >= reads[1].startedAt &&
      reads[1].completedAt <= terminal;
    const terminalWindow = terminalReadValid
      ? completeWindow(reads[1].body)
      : null;
    if (!terminalWindow) add('incomplete-terminal-backend-window');
    const committed = terminalWindow ? matches(terminalWindow) : null;
    if (terminalWindow && terminalWindow.size !== 37)
      add('unexpected-terminal-backend-post-count', 'failure');
    if (
      heldWindow &&
      terminalWindow &&
      [...heldWindow].some(
        ([id, post]) =>
          !terminalWindow.has(id) ||
          JSON.stringify(terminalWindow.get(id)!.essay) !==
            JSON.stringify(post.essay)
      )
    )
      add('original-backend-posts-changed-during-send', 'failure');
    if (committed && committed.length !== 1)
      add('send-commit-count-is-not-one', 'failure');
    else if (
      committed &&
      (committed[0].essay.author !== '~zod' ||
        committed[0].essay.sent !== action.json.channel.action.post.add.sent ||
        JSON.stringify(committed[0].essay.content) !==
          JSON.stringify(action.json.channel.action.post.add.content))
    )
      add('send-committed-essay-or-identity-mismatch', 'failure');
    const committedId =
      committed?.length === 1 ? canonicalId(committed[0].seal.id) : null;
    const contract = proof.readingContract,
      trace = proof.reading;
    if (
      !trace ||
      !contract ||
      contract.scope !== proof.scope ||
      contract.point.tolerancePx !== 1 ||
      contract.point.start !== 2 ||
      contract.point.end !== 3 ||
      !/^Send reader row (?:[0-9]|[12][0-9]|3[0-5]): An unchanged reading character remains visible here\.$/.test(
        contract.revision.text
      ) ||
      contract.revision.id !== contract.rowId + ':unchanged' ||
      contract.coverage.maxGapMs !== 100 ||
      contract.coverage.maxMeasurementDurationMs !== 32 ||
      contract.coverage.startTime < read ||
      contract.coverage.startTime >= release ||
      contract.coverage.endTime !== terminal + 1000 ||
      contract.coverage.endTime > proof.plannedEnd! ||
      contract.terminalTime !== terminal ||
      trace.samples[0]?.time !== contract.coverage.startTime ||
      (trace.samples.at(-1)?.time ?? -1) < proof.plannedEnd!
    )
      add('missing-fixed-pending-send-reading-contract');
    else {
      const reading = evaluateReading(trace, contract);
      const badBaseline = reading.issues.some(
        (issue) =>
          issue.sampleIndex === 0 ||
          (issue.kind === 'incomplete' &&
            issue.sampleIndex === undefined &&
            !['missing-terminal-tail', 'sample-gap'].includes(issue.code))
      );
      for (const issue of reading.issues)
        add(
          `reading:${issue.code}`,
          badBaseline ? 'incomplete' : issue.kind,
          'geometry'
        );
    }
    if (proof.errors.length) add('pending-send-collector-error');
    if (
      samples.at(-1)!.time < proof.plannedEnd! ||
      samples.at(-1)!.time > proof.plannedEnd! + 100
    )
      add('missing-pending-send-fixed-tail');
    samples.forEach((sample, i) => {
      if (
        !finite(sample.time) ||
        !finite(sample.duration) ||
        ![sample.offset, sample.extent, sample.height].every(finite) ||
        !sample.valid ||
        sample.duration < 0 ||
        sample.duration > 32 ||
        sample.scope !== proof.scope ||
        sample.height <= 0 ||
        (i > 0 &&
          (sample.time <= samples[i - 1].time ||
            sample.time - samples[i - 1].time > 100))
      )
        add('invalid-or-gapped-pending-send-sample');
      if (sample.time >= pending && sample.value !== '')
        add('late-send-draft-restoration', 'failure', 'input');
      if (sample.time >= pending && sample.sentRows.length > 1)
        add('duplicate-visible-send-row', 'failure');
      // The sent row may be virtualized out after READ. Missing semantic evidence
      // remains incomplete, rather than bringing it back by changing position.
      if (
        sample.time >= terminal &&
        (sample.sentRows.length !== 1 ||
          sample.sentRows[0].deliveryCount !== 0 ||
          !sample.sentRows[0].text.includes(proof.text))
      )
        add('terminal-delivery-row-not-reconciled');
      if (
        sample.time >= terminal &&
        sample.valid &&
        sample.scope === proof.scope &&
        sample.sentRows.length === 1 &&
        committedId &&
        canonicalId(sample.sentRows[0].id) !== committedId
      )
        add('terminal-delivery-row-identity-mismatch', 'failure');
    });
    const acknowledgements = proof.sse.messages.flatMap((message) => {
      try {
        const data = JSON.parse(message.raw);
        return data.response === 'poke' && data.id === action!.id
          ? [{ ...message, data }]
          : [];
      } catch {
        return [];
      }
    });
    if (
      !proof.sse.supported ||
      proof.sse.errors.length ||
      acknowledgements.length !== 1 ||
      acknowledgements[0].url !== request.url ||
      !('ok' in acknowledgements[0].data) ||
      'err' in acknowledgements[0].data ||
      !finite(acknowledgements[0].receivedAt) ||
      acknowledgements[0].receivedAt < release ||
      acknowledgements[0].receivedAt > terminal
    )
      add('matching-real-send-acknowledgement-unavailable');
  } catch {
    add('malformed-pending-send-proof');
  }
  return finish();
}

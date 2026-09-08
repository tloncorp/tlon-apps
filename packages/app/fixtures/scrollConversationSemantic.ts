import type {
  assessScrollChromeTrace,
  ScrollChromeTrace,
  ScrollChromeContract,
} from './scrollChromeTrace';

export type ConversationSemanticTrace = {
  scope: string;
  followSetup?: {
    scope: string;
    requestedAt: number;
    completedAt: number;
    postId: string;
    bottomGap: number;
    targetClipPixels: number;
    actions: {
      eventTime: number;
      capturedAt: number;
      isTrusted: boolean;
      sameControl: boolean;
      scope: string;
      button: number;
      detail: number;
    }[];
  };
  errors: string[];
  samples: {
    time: number;
    scope: string;
    measurement: { valid: boolean; durationMs: number };
    posts: { id: string; texts: string[] }[];
  }[];
  chrome: ScrollChromeTrace;
  marks: { id: string; time: number; postId?: string; text?: string }[];
  presence: {
    markId: string;
    active: boolean;
    origin: string;
    observerOrigin: string;
    channelId: string;
    ship: string;
    request: { url: string; status: number; body: unknown };
    observer: { status: number; body: unknown };
    completedTime: number;
  }[];
};
export type ConversationSemanticContract = {
  version: 1 | 2;
  messageExpectations?: {
    inputText: string;
    wireText: string;
    renderedLeaf: string;
  }[];
  mode: 'thinking' | 'remote';
  scope: string;
  expectedTexts: string[];
  startTime: number;
  terminalTime: number;
  endTime: number;
};
/** Fixed single-paragraph inputs, independent of producer markers and DOM. */
export function conversationMessageExpectations(mode: 'thinking' | 'remote') {
  const inputs =
    mode === 'remote'
      ? Array.from({ length: 5 }, (_, i) => `Remote burst ${i}`)
      : ['Response before computing presence cleared'];
  return inputs.map((inputText) => ({
    inputText,
    wireText: `${inputText} `,
    renderedLeaf: `${inputText} `,
  }));
}

const object = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);
const computing = 'Scroll stability computing';
const held = 'Thinking...';
/** Fixed four product situations; phase and payload requirements cannot be weakened by a producer verdict. */
export function assessConversationSemantics(
  raw: ConversationSemanticTrace,
  contract: ConversationSemanticContract,
  evaluateChrome: typeof assessScrollChromeTrace
) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    sampleIndex?: number;
  }[] = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete' = 'incomplete',
    sampleIndex?: number
  ) => issues.push({ code, kind, sampleIndex });
  const finish = () => ({
    verdict: issues.some((i) => i.kind === 'failure')
      ? 'FAIL'
      : issues.length
        ? 'INCOMPLETE'
        : 'PASS',
    issues,
    evidence: 'sampled-dom-semantics',
    presentation: 'INCOMPLETE',
    readerRevision: 2,
    textInterpretation:
      contract?.version === 1
        ? 'legacy-fixed-plain-paragraph-correction'
        : 'declared-input-wire-rendered-leaf',
  });
  const messages = conversationMessageExpectations(contract?.mode);
  const expectedTexts = messages.map((message) => message.inputText);
  if (
    !raw ||
    !contract ||
    ![1, 2].includes(contract.version) ||
    (contract.version === 2 &&
      JSON.stringify(contract.messageExpectations) !==
        JSON.stringify(messages)) ||
    (contract.messageExpectations !== undefined &&
      JSON.stringify(contract.messageExpectations) !==
        JSON.stringify(messages)) ||
    !['remote', 'thinking'].includes(contract.mode) ||
    raw.scope !== contract.scope ||
    !contract.scope ||
    JSON.stringify(contract.expectedTexts) !== JSON.stringify(expectedTexts) ||
    ![contract.startTime, contract.terminalTime, contract.endTime].every(
      finite
    ) ||
    contract.terminalTime <= contract.startTime ||
    contract.endTime !== contract.terminalTime + 1000 ||
    !Array.isArray(raw.samples) ||
    raw.samples.length < 6 ||
    !Array.isArray(raw.marks) ||
    !Array.isArray(raw.errors) ||
    raw.errors.length ||
    !Array.isArray(raw.presence)
  ) {
    add('invalid-conversation-semantic-contract');
    return finish();
  }
  const mark = (id: string) => {
    const matches = raw.marks.filter((m) => m?.id === id);
    if (matches.length !== 1 || !finite(matches[0]?.time)) {
      add(`missing-semantic-mark:${id}`);
      return undefined;
    }
    return matches[0];
  };
  if (
    raw.marks.some(
      (m, i) =>
        !m ||
        !finite(m.time) ||
        m.time < contract.startTime ||
        m.time > contract.endTime ||
        (i > 0 && m.time < raw.marks[i - 1].time)
    )
  )
    add('invalid-semantic-marks');
  if (mark('terminal')?.time !== contract.terminalTime)
    add('semantic-terminal-deadline-mismatch');
  if (
    raw.samples[0].time !== contract.startTime ||
    raw.samples.at(-1)!.time < contract.endTime
  )
    add('missing-semantic-boundary');
  const delivered = expectedTexts.map((text, i) => ({
    text,
    renderedLeaf: messages[i].renderedLeaf,
    mark: mark(`delivered-${i}`),
  }));
  const ids = new Set<string>();
  for (const [i, d] of delivered.entries()) {
    if (
      !d.mark ||
      d.mark.text !== d.text ||
      typeof d.mark.postId !== 'string' ||
      !d.mark.postId ||
      ids.has(d.mark.postId) ||
      (i > 0 &&
        (!delivered[i - 1].mark || d.mark.time <= delivered[i - 1].mark!.time))
    )
      add('invalid-delivery-identity');
    else ids.add(d.mark.postId);
  }
  for (const [index, sample] of raw.samples.entries()) {
    const previous = raw.samples[index - 1];
    if (
      !sample ||
      !finite(sample.time) ||
      sample.scope !== contract.scope ||
      !sample.measurement ||
      sample.measurement.valid !== true ||
      !finite(sample.measurement.durationMs) ||
      sample.measurement.durationMs < 0 ||
      sample.measurement.durationMs > 32 ||
      !Array.isArray(sample.posts) ||
      sample.posts.some(
        (p) =>
          !p ||
          typeof p.id !== 'string' ||
          !p.id ||
          !Array.isArray(p.texts) ||
          p.texts.some((t) => typeof t !== 'string')
      ) ||
      new Set(sample.posts.map((p) => p.id)).size !== sample.posts.length ||
      (previous &&
        (sample.time <= previous.time || sample.time - previous.time > 100))
    ) {
      add('invalid-semantic-sample', 'incomplete', index);
      continue;
    }
    let previousPosition = -1;
    for (const d of delivered) {
      if (!d.mark || !finite(d.mark.time) || sample.time < d.mark.time)
        continue;
      const matching = sample.posts.filter((p) =>
        p.texts.includes(d.renderedLeaf)
      );
      const position = sample.posts.findIndex((p) => p.id === d.mark!.postId);
      if (
        matching.length !== 1 ||
        matching[0].id !== d.mark.postId ||
        matching[0].texts.filter((t) => t === d.renderedLeaf).length !== 1 ||
        position <= previousPosition
      )
        add('delivered-post-lost-replaced-or-reordered', 'failure', index);
      previousPosition = position;
    }
  }
  // Each delivery mark must identify real text in an immediately following coherent DOM sample.
  for (const d of delivered) {
    if (!d.mark) continue;
    const witness = raw.samples.find((s) => s.time >= d.mark!.time);
    if (
      !witness ||
      witness.time - d.mark.time > 100 ||
      !Array.isArray(witness.posts) ||
      !witness.posts.some(
        (p) =>
          p &&
          p.id === d.mark!.postId &&
          Array.isArray(p.texts) &&
          p.texts.includes(d.renderedLeaf)
      )
    )
      add('delivery-unwitnessed');
  }
  if (contract.mode === 'remote') {
    if (raw.presence.length) add('unexpected-presence-proof');
    return finish();
  }
  const baseline = raw.chrome?.samples?.[0];
  if (
    !baseline ||
    baseline.time !== contract.startTime ||
    baseline.scope !== contract.scope ||
    baseline.semanticState !== 'list-visible' ||
    baseline.loading !== false ||
    !Array.isArray(baseline.controls) ||
    baseline.controls.length !== 0 ||
    !baseline.measurement ||
    baseline.measurement.valid !== true ||
    !finite(baseline.measurement.durationMs) ||
    baseline.measurement.durationMs < 0 ||
    baseline.measurement.durationMs > 32
  ) {
    add('invalid-thinking-baseline');
    return finish();
  }
  if (
    raw.chrome.samples.length !== raw.samples.length ||
    raw.chrome.samples.some(
      (sample, i) =>
        sample.time !== raw.samples[i]?.time ||
        sample.scope !== raw.samples[i]?.scope ||
        sample.measurement.valid !== raw.samples[i]?.measurement?.valid ||
        sample.measurement.durationMs !==
          raw.samples[i]?.measurement?.durationMs
    )
  ) {
    add('thinking-semantic-capture-crosslink-mismatch');
    return finish();
  }
  const names = [
    'show-1',
    'show-ready-1',
    'clear-1',
    'held-ready',
    'hidden-ready-1',
    'show-2',
    'show-ready-2',
    'clear-2',
    'hidden-ready-2',
  ];
  const times = Object.fromEntries(
    names.map((name) => [name, mark(name)?.time])
  );
  if (
    names.some((name) => !finite(times[name])) ||
    names.some((name, i) => i > 0 && times[name]! < times[names[i - 1]]!)
  ) {
    add('thinking-phase-missing-or-reordered');
    return finish();
  }
  const at = (name: string) => times[name]!;
  if (
    at('held-ready') >= at('clear-1') + 2000 ||
    at('hidden-ready-1') < at('clear-1') + 2000 ||
    !delivered[0].mark ||
    at('clear-2') < delivered[0].mark.time ||
    at('hidden-ready-2') > contract.terminalTime
  )
    add('invalid-thinking-hold-or-handoff-window');
  if (raw.presence.length !== 4) add('missing-actual-presence-responses');
  const requestMarks = ['show-1', 'clear-1', 'show-2', 'clear-2'];
  for (const [i, p] of raw.presence.entries()) {
    const expectedActive = i % 2 === 0;
    if (
      !p ||
      !object(p.request) ||
      !object(p.observer) ||
      !finite(p.request.status) ||
      !finite(p.observer.status) ||
      typeof p.request.url !== 'string' ||
      typeof p.channelId !== 'string'
    ) {
      add('invalid-presence-response');
      continue;
    }
    const body = p?.request?.body;
    const action =
      Array.isArray(body) && body.length === 1 ? body[0] : undefined;
    const json = object(action) ? action.json : undefined;
    const state = object(p?.observer?.body) ? p.observer.body.init : undefined;
    const context = `/channel/${p?.channelId}`;
    const entry =
      object(state) && object(state[context]) ? state[context] : undefined;
    const actual =
      object(entry) && object(entry.computing)
        ? entry.computing[`~${p?.ship}`]
        : undefined;
    const key =
      object(json) && object(json[expectedActive ? 'set' : 'clear'])
        ? json[expectedActive ? 'set' : 'clear']
        : undefined;
    const actualKey = expectedActive && object(key) ? key.key : key;
    if (
      !p ||
      p.markId !== requestMarks[i] ||
      p.active !== expectedActive ||
      p.ship !== 'ten' ||
      !['http://localhost:3000', 'http://localhost:3002'].includes(p.origin) ||
      !['http://localhost:3000', 'http://localhost:3002'].includes(
        p.observerOrigin
      ) ||
      decodeURIComponent(contract.scope)
        .split('/channel/')[1]
        ?.replace(/\/$/, '') !== p.channelId ||
      !finite(p.completedTime) ||
      p.completedTime < at(p.markId) ||
      p.completedTime > contract.endTime ||
      p.request.status < 200 ||
      p.request.status >= 300 ||
      p.observer.status !== 200 ||
      !p.request.url.startsWith(`${p.origin}/~/channel/scroller-`) ||
      !object(action) ||
      action.action !== 'poke' ||
      action.app !== 'presence' ||
      action.ship !== p.ship ||
      action.mark !== 'presence-action-1' ||
      !object(actualKey) ||
      actualKey.context !== context ||
      actualKey.ship !== '~ten' ||
      actualKey.topic !== 'computing' ||
      Boolean(actual) !== expectedActive ||
      (expectedActive &&
        (!object(key) ||
          !object(key.display) ||
          key.display.text !== computing))
    )
      add('unqualified-presence-request-response');
  }
  if (
    issues.some((i) =>
      [
        'missing-actual-presence-responses',
        'invalid-presence-response',
        'unqualified-presence-request-response',
      ].includes(i.code)
    )
  )
    return finish();
  const phase = (
    id: string,
    startTime: number,
    endTime: number,
    label: string | null
  ) => ({
    id,
    startTime,
    endTime,
    loading: label === computing,
    semanticState: 'list-visible',
    controls: [
      {
        id: 'thinking',
        kind: label ?? computing,
        visibility: label ? ('visible' as const) : ('absent' as const),
      },
    ],
  });
  const phases = [
    phase('empty-1', contract.startTime, at('show-1'), null),
    phase('active-1', at('show-ready-1'), at('clear-1'), computing),
    phase('held', at('held-ready'), at('clear-1') + 2000, held),
    phase('empty-2', at('hidden-ready-1'), at('show-2'), null),
    phase('active-2', at('show-ready-2'), at('clear-2'), computing),
    phase('terminal', at('hidden-ready-2'), contract.endTime, null),
  ];
  const chromeContract: ScrollChromeContract = {
    scope: contract.scope,
    coverage: {
      startTime: contract.startTime,
      endTime: contract.endTime,
      maxGapMs: 100,
      maxMeasurementDurationMs: 32,
    },
    action: {
      id: 'presence-lifecycle',
      startTime: at('show-1'),
      endTime: at('hidden-ready-2'),
    },
    phases,
    transitions: phases.slice(1).map((p, i) => ({
      from: phases[i].id,
      to: p.id,
      startTime: phases[i].endTime,
      endTime: p.startTime,
      opacity: 'instant',
    })),
  };
  for (const i of evaluateChrome(raw.chrome, chromeContract).issues)
    add(`thinking:${i.code}`, i.kind, i.sampleIndex);
  return finish();
}

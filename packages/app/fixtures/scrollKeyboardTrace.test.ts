import { describe, expect, it } from 'vitest';
import {
  assessScrollKeyboardTrace,
  createKeyboardPlan,
  type KeyboardBackend,
  type KeyboardEvent,
  type KeyboardSample,
  type KeyboardTrace,
} from './scrollKeyboardTrace';

// Synthetic detector controls only; no measured browser/native claim.
export function keyboardDetectorEvidence(
  position: 'latest' | 'history' = 'latest'
) {
  const scope = '/apps/groups/group/~zod%2Fgroup/channel/chat%2F~zod%2Fchannel';
  const plan = createKeyboardPlan(scope, '1234abcd', 'Meta', position, '100');
  const dispatches = plan.steps.map((s, i) => ({
    id: s.id,
    key: s.key,
    start: 230 + i * 200,
    end: 250 + i * 200,
  }));
  const events: KeyboardEvent[] = [];
  const append = (
    index: number,
    type: string,
    time: number,
    extra: Partial<KeyboardEvent> = {}
  ) => {
    const step = plan.steps[index];
    const modifiers = step.key.split('+').slice(0, -1);
    events.push({
      type,
      time,
      observedAt: time + 1,
      trusted: true,
      scope,
      target: step.before.focus,
      shift: modifiers.includes('Shift'),
      meta: modifiers.includes('Meta'),
      ctrl: modifiers.includes('Control'),
      alt: false,
      ...extra,
    });
  };
  dispatches.forEach((d, i) => {
    const s = plan.steps[i];
    append(i, 'keydown', d.start + 2, { key: s.mainKey });
    if (s.input) {
      append(i, 'beforeinput', d.start + 3, {
        inputType: s.input.type,
        data: s.input.data,
      });
      append(i, 'input', d.start + 4, {
        inputType: s.input.type,
        data: s.input.data,
      });
    }
    if (s.before.focus !== s.after.focus) {
      append(i, 'blur', d.start + 3);
      append(i, 'focus', d.start + 4, { target: s.after.focus });
    }
    append(i, 'keyup', d.start + 8, { key: s.mainKey, target: s.after.focus });
  });
  const plannedEnd = dispatches.at(-1)!.end + 2000;
  const samples: KeyboardSample[] = [];
  for (let time = 10; time <= plannedEnd; time += 10) {
    const index = dispatches.findLastIndex((d) => d.start + 5 <= time);
    const state = index < 0 ? plan.steps[0].before : plan.steps[index].after;
    const geometry = {
      offset:
        position === 'latest' || time >= dispatches.at(-1)!.end ? 1200 : 800,
      extent: 2000,
      height: 800,
      rows: [
        { id: '100', top: 100, height: 60 },
        { id: '101', top: 600, height: 60 },
      ],
    };
    samples.push({
      time,
      duration: 1,
      valid: true,
      scope,
      sameInput: true,
      state: { ...state },
      caret: null,
      inputVisible: true,
      sendVisible: true,
      geometry,
    });
  }
  const trace: KeyboardTrace = {
    declaredAt: 0,
    plan,
    dispatches,
    events,
    samples,
    plannedEnd,
    errors: [],
  };
  const backend: KeyboardBackend = {
    channel: 'chat/~zod/channel',
    requests: [
      {
        time: dispatches.at(-1)!.start + 4,
        scope,
        channel: 'chat/~zod/channel',
        author: '~zod',
        text: plan.finalText
          .split('\n')
          .map((line) => line + ' ')
          .join('\n'),
        actions: [{}],
      },
    ],
    posts: [
      {
        id: '123',
        author: '~zod',
        text: plan.finalText
          .split('\n')
          .map((line) => line + ' ')
          .join('\n'),
        essay: { content: [{ inline: [plan.finalText] }] },
      },
    ],
  };
  return { trace, plan, backend };
}

describe('real keyboard plan and independent detector', () => {
  it('declares selection, replacement, deletion, history and newline before dispatch', () => {
    const { plan } = keyboardDetectorEvidence();
    const undo = plan.steps.find((s) => s.key === 'Meta+z')!;
    expect(undo.before.value).toBe('keyboard 1234abcd alpha  omega');
    expect(undo.after.value).toBe('keyboard 1234abcd alpha z omega');
    expect(
      plan.steps.find((s) => s.before.end - s.before.start === 4)?.after.value
    ).toBe('keyboard 1234abcd alpha z omega');
    expect(plan.finalText).toBe('keyboard 1234abcd alpha q\ntail omega');
    expect(plan.steps.at(-1)!.after).toEqual({
      value: '',
      start: 0,
      end: 0,
      focus: 'input',
      composing: false,
    });
  });
  it.each(['latest', 'history'] as const)(
    'accepts complete %s keyboard evidence but keeps caret/presentation separate',
    (position) => {
      const d = keyboardDetectorEvidence(position);
      const result = assessScrollKeyboardTrace(d.trace, d.plan, d.backend);
      expect(result.issues).toEqual([]);
      expect(result.verdict).toBe('PASS');
      expect(result.caretGeometry).toBe('INCOMPLETE');
      expect(result.presentedFrames).toBe('INCOMPLETE');
    }
  );
  it.each([
    [
      'dropped main key',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events.shift();
      },
    ],
    [
      'duplicate input',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events.splice(3, 0, { ...d.trace.events[2] });
      },
    ],
    [
      'wrong key target',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events[0].target = 'other';
      },
    ],
    [
      'wrong key modifier',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events[0].meta = true;
      },
    ],
    [
      'wrong input payload',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events.find((e) => e.type === 'input')!.data = 'x';
      },
    ],
    [
      'wrong input type',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events.find((e) => e.type === 'input')!.inputType =
          'insertFromPaste';
      },
    ],
    [
      'stale character',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].state.value += 'x';
        d.trace.samples[40].state.start++;
        d.trace.samples[40].state.end++;
      },
    ],
    [
      'selection drift',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].state.start = 0;
      },
    ],
    [
      'focus leak',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].state.focus = 'other';
      },
    ],
    [
      'wrong scope',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].scope = '/other';
      },
    ],
    [
      'input replaced',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].sameInput = false;
      },
    ],
    [
      'hidden composer',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].inputVisible = false;
      },
    ],
    [
      'composition starts unexpectedly',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].state.composing = true;
      },
    ],
    [
      'unexpected key between dispatches',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events.splice(4, 0, {
          ...d.trace.events[0],
          time: 300,
          observedAt: 301,
        });
      },
    ],
    [
      'newline submits',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.backend.requests[0].time =
          d.trace.dispatches.find((c) => c.key === 'Shift+Enter')!.start + 4;
      },
    ],
    [
      'wrong channel send',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.backend.requests[0].channel = 'chat/~zod/elsewhere';
      },
    ],
    [
      'duplicate send',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.backend.requests.push({ ...d.backend.requests[0] });
      },
    ],
    [
      'wrong committed draft',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.backend.posts[0].text += 'x';
      },
    ],
    [
      'wrong committed author',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.backend.posts[0].author = '~nec';
      },
    ],
    [
      'duplicate committed post',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.backend.posts.push({ ...d.backend.posts[0], id: '456' });
      },
    ],
    [
      'transient latest gap',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].geometry.offset -= 25;
      },
    ],
    [
      'blank viewport',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].geometry.rows = [];
      },
    ],
  ] as const)('rejects witnessed %s', (_name, corrupt) => {
    const d = keyboardDetectorEvidence();
    corrupt(d);
    expect(assessScrollKeyboardTrace(d.trace, d.plan, d.backend).verdict).toBe(
      'FAIL'
    );
  });
  it.each([
    [
      'missing actual request start',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.backend.requests[0].time = NaN;
      },
    ],
    [
      'untrusted key',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events[0].trusted = false;
      },
    ],
    [
      'event handler hides original delay',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events[0].observedAt += 101;
      },
    ],
    [
      'event order',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.events[1].time = 1;
      },
    ],
    [
      'capture gap',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples.splice(35, 11);
      },
    ],
    [
      'slow geometry',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[40].duration = 33;
      },
    ],
    [
      'absent final tail',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples.splice(-5);
      },
    ],
    [
      'posthoc shortened deadline',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.plannedEnd -= 500;
      },
    ],
    [
      'missing dispatch',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.dispatches.pop();
      },
    ],
    [
      'posthoc command plan',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.plan = structuredClone(d.plan);
        d.trace.plan.steps[0].after.value = 'x';
      },
    ],
    [
      'baseline not latest',
      (d: ReturnType<typeof keyboardDetectorEvidence>) => {
        d.trace.samples[0].geometry.offset -= 10;
      },
    ],
  ] as const)('keeps %s incomplete', (_name, corrupt) => {
    const d = keyboardDetectorEvidence();
    corrupt(d);
    expect(assessScrollKeyboardTrace(d.trace, d.plan, d.backend).verdict).toBe(
      'INCOMPLETE'
    );
  });
  it('does not hide qualified geometry failure behind missing send evidence', () => {
    const d = keyboardDetectorEvidence();
    d.trace.samples[40].geometry.offset -= 20;
    const r = assessScrollKeyboardTrace(d.trace, d.plan);
    expect(r.verdict).toBe('FAIL');
    expect(
      r.issues.some((i) => i.code === 'missing-backend-send-evidence')
    ).toBe(true);
  });
  it('holds READ before own send and requires its independent landing deadline', () => {
    const d = keyboardDetectorEvidence('history');
    d.trace.samples[40].geometry.rows[0].top += 10;
    expect(
      assessScrollKeyboardTrace(d.trace, d.plan, d.backend).issues.some(
        (i) => i.code === 'reading-anchor-moved'
      )
    ).toBe(true);
    const last = d.trace.samples.at(-1)!;
    last.geometry.offset = 800;
    expect(
      assessScrollKeyboardTrace(d.trace, d.plan, d.backend).issues.some(
        (i) => i.code === 'latest-gap'
      )
    ).toBe(true);
  });
  it('rejects undo no-op even when redo and final state are correct', () => {
    const d = keyboardDetectorEvidence();
    const index = d.plan.steps.findIndex((s) => s.key === 'Meta+z');
    const cmd = d.trace.dispatches[index];
    d.trace.samples
      .filter(
        (s) =>
          s.time >= cmd.start && s.time < d.trace.dispatches[index + 1].start
      )
      .forEach((s) => (s.state = { ...d.plan.steps[index].before }));
    expect(assessScrollKeyboardTrace(d.trace, d.plan, d.backend).verdict).toBe(
      'FAIL'
    );
  });
});

// Raw replay controls are synthetic detector checks, not application proof.
import {
  replayKeyboardEvidence,
  keyboardScenarios,
} from '../../../scripts/scroll-stability-keyboard-evidence.mjs';
function importEvidence(position: 'latest' | 'history' = 'latest') {
  const { trace, plan, backend } = keyboardDetectorEvidence(position);
  const timeOrigin = Date.parse('2026-09-07T12:00:00Z');
  const preparation = {
    scope: plan.scope,
    origin: 'http://localhost:3000',
    ship: 'zod',
    e2eMode: false,
    headed: true,
    assets: 'Vite development assets',
    browser: 'Chromium test control',
    platform: 'MacIntel',
    timeOrigin,
    capturedAt: -100,
    wallTime: timeOrigin - 100,
  };
  const essay = {
    author: '~zod',
    content: plan.finalText
      .split('\n')
      .map((line) => ({ inline: [line + ' '] })),
  };
  const request = {
    ...backend.requests[0],
    actions: [
      {
        action: 'poke',
        app: 'channels',
        mark: 'channel-action-2',
        json: {
          channel: { nest: backend.channel, action: { post: { add: essay } } },
        },
      },
    ],
    method: 'PUT',
    url: 'http://localhost:3000/~/channel/current',
    wallStart: timeOrigin + backend.requests[0].time,
  };
  backend.posts = [
    {
      id: '123',
      author: '~zod',
      text: plan.finalText
        .split('\n')
        .map((line) => line + ' ')
        .join('\n'),
      essay,
    },
  ];
  backend.requests = [request];
  const wheel =
    position === 'history' ? [{ time: -200, deltaY: -500, trusted: true }] : [];
  const readTime = trace.plannedEnd + 10;
  const proof = {
    trace,
    plan,
    preparation,
    wheel,
    requests: [request],
    backend,
    rawBackend: { posts: { '123': { seal: { id: '123' }, essay } } },
    backendRead: {
      url: 'http://localhost:3000/~/scry/channels/v5/chat/~zod/channel/posts/newest/50/post.json',
      status: 200,
      started: { time: readTime, wall: timeOrigin + readTime },
      completed: { time: readTime + 10, wall: timeOrigin + readTime + 10 },
    },
    transportErrors: [],
    assessment: { verdict: 'PASS' },
  };
  const raw = {
    trace,
    preparation,
    wheel,
    requests: [request],
    transportErrors: [],
  };
  const attempt = {
    title: keyboardScenarios.find((r) => r.position === position)!.title,
    startTime: new Date(timeOrigin - 1000).toISOString(),
    duration: trace.plannedEnd + 5000,
  };
  return JSON.parse(JSON.stringify({ proof, raw, attempt, position }));
}
describe('standalone keyboard proof import', () => {
  it.each(['latest', 'history'] as const)(
    'independently accepts complete serialized %s proof',
    (position) => {
      const d = importEvidence(position);
      expect(
        replayKeyboardEvidence(d.proof, d.raw, position, d.attempt).verdict
      ).toBe('PASS');
    }
  );
  it.each([
    [
      'stale attempt',
      (d: ReturnType<typeof importEvidence>) => {
        d.attempt.startTime = new Date(
          d.proof.preparation.timeOrigin + 10000
        ).toISOString();
      },
    ],
    [
      'missing attempt',
      (d: ReturnType<typeof importEvidence>) => {
        d.attempt = undefined;
      },
    ],
    [
      'wrong title',
      (d: ReturnType<typeof importEvidence>) => {
        d.attempt.title = 'different operation';
      },
    ],
    [
      'missing backend',
      (d: ReturnType<typeof importEvidence>) => {
        delete d.proof.backend;
        delete d.proof.rawBackend;
      },
    ],
    [
      'forged backend summary',
      (d: ReturnType<typeof importEvidence>) => {
        d.proof.backend.posts[0].text += 'wrong';
      },
    ],
    [
      'missing raw request',
      (d: ReturnType<typeof importEvidence>) => {
        d.raw.requests = [];
      },
    ],
    [
      'missing actual transport time',
      (d: ReturnType<typeof importEvidence>) => {
        for (const requests of [
          d.proof.requests,
          d.raw.requests,
          d.proof.backend.requests,
        ])
          requests[0].wallStart = 0;
      },
    ],
    [
      'wrong transport payload',
      (d: ReturnType<typeof importEvidence>) => {
        for (const requests of [
          d.proof.requests,
          d.raw.requests,
          d.proof.backend.requests,
        ])
          requests[0].actions[0].json.channel.nest = 'chat/~zod/wrong';
      },
    ],
    [
      'wrong clock origin',
      (d: ReturnType<typeof importEvidence>) => {
        d.proof.preparation.timeOrigin += 1000;
        d.raw.preparation.timeOrigin += 1000;
      },
    ],
    [
      'post capture read was before send',
      (d: ReturnType<typeof importEvidence>) => {
        d.proof.backendRead.started.time = 10;
      },
    ],
    [
      'unknown backend post ID',
      (d: ReturnType<typeof importEvidence>) => {
        delete d.proof.rawBackend.posts['123'].seal.id;
      },
    ],
    [
      'posthoc plan',
      (d: ReturnType<typeof importEvidence>) => {
        d.proof.plan.finalText = 'wrong';
      },
    ],
  ] as const)('rejects %s', (_name, corrupt) => {
    const d = importEvidence();
    corrupt(d);
    expect(
      replayKeyboardEvidence(d.proof, d.raw, d.position, d.attempt).verdict
    ).toBe('INCOMPLETE');
  });
  it('preserves witnessed drift over absent backend confirmation despite declared PASS', () => {
    const d = importEvidence();
    d.proof.trace.samples[40].geometry.offset -= 20;
    d.raw.trace.samples[40].geometry.offset -= 20;
    delete d.proof.backend;
    delete d.proof.rawBackend;
    const result = replayKeyboardEvidence(
      d.proof,
      d.raw,
      d.position,
      d.attempt
    );
    expect(result.verdict).toBe('FAIL');
    expect(
      result.issues.some(
        (i) => i.dimension === 'routing' && i.kind === 'incomplete'
      )
    ).toBe(true);
  });
  it('rejects transient selection failure with eventual correct send despite declared PASS', () => {
    const d = importEvidence();
    d.proof.trace.samples[40].state.start = 0;
    d.raw.trace.samples[40].state.start = 0;
    expect(
      replayKeyboardEvidence(d.proof, d.raw, d.position, d.attempt).verdict
    ).toBe('FAIL');
  });
});

it('permits only the event-bounded native focus bridge and rejects a persistent focus gap', () => {
  const d = keyboardDetectorEvidence();
  const index = d.plan.steps.findIndex((s) => s.key === 'Tab');
  const dispatch = d.trace.dispatches[index];
  const sample = {
    ...structuredClone(d.trace.samples.find((s) => s.time >= dispatch.start)!),
    time: dispatch.start + 3.5,
    state: { ...d.plan.steps[index].before, focus: 'other' as const },
  };
  d.trace.samples.push(sample);
  d.trace.samples.sort((a, b) => a.time - b.time);
  expect(assessScrollKeyboardTrace(d.trace, d.plan, d.backend).verdict).toBe(
    'PASS'
  );
  sample.time = dispatch.start + 4.5;
  expect(assessScrollKeyboardTrace(d.trace, d.plan, d.backend).verdict).toBe(
    'FAIL'
  );
});

it('preserves valid ShiftEnter geometry after a separate earlier capture gap', () => {
  const d = keyboardDetectorEvidence();
  d.trace.samples.splice(35, 11);
  const command = d.trace.dispatches.find((c) => c.key === 'Shift+Enter')!;
  const sample = d.trace.samples.find((s) => s.time >= command.start + 10)!;
  sample.geometry.height -= 11;
  const result = assessScrollKeyboardTrace(d.trace, d.plan, d.backend);
  expect(result.verdict).toBe('FAIL');
  expect(result.issues.some((i) => i.code === 'latest-gap')).toBe(true);
  expect(result.issues.some((i) => i.kind === 'incomplete')).toBe(true);
  for (const fault of ['baseline', 'scope', 'event', 'measurement'] as const) {
    const e = structuredClone(d);
    if (fault === 'baseline') e.trace.samples[0].geometry.offset -= 20;
    if (fault === 'scope')
      e.trace.samples.find((s) => s.time === sample.time)!.scope = '/elsewhere';
    if (fault === 'event') e.trace.events = [];
    if (fault === 'measurement')
      e.trace.samples.find((s) => s.time === sample.time)!.duration = 33;
    expect(assessScrollKeyboardTrace(e.trace, e.plan, e.backend).verdict).toBe(
      'INCOMPLETE'
    );
  }
});
it('requires the calibrated exact undo selection and exact paragraph-space wire encoding', () => {
  const d = keyboardDetectorEvidence();
  const step = d.plan.steps.find((s) => s.key === 'Meta+z')!;
  expect(step.after.start).toBe(24);
  expect(step.after.end).toBe(25);
  expect(d.backend.posts[0].text).toBe(
    'keyboard 1234abcd alpha q \ntail omega '
  );
  for (const extra of ['', '  ']) {
    const e = structuredClone(d);
    e.backend.posts[0].text = e.plan.finalText
      .split('\n')
      .map((line) => line + extra)
      .join('\n');
    expect(assessScrollKeyboardTrace(e.trace, e.plan, e.backend).verdict).toBe(
      'FAIL'
    );
  }
});

import {
  assessPendingSendEvidence,
  type PendingSendEvidence,
} from './scrollKeyboardTrace';
import { assessScrollReadingTrace } from './scrollReadingTrace';

function pendingSendEvidence(): PendingSendEvidence {
  const token = 'abcd1234',
    text = `Pending send ${token} keeps later reading intent.`;
  const scope = '/apps/groups/group/~zod%2Fg/channel/chat%2F~zod%2Fc',
    channel = 'chat/~zod/c';
  const essay = {
    author: '~zod',
    sent: 1234,
    content: [{ inline: [text + ' '] }],
  };
  const actions = [
    {
      id: 42,
      action: 'poke',
      app: 'channels',
      json: { channel: { nest: channel, action: { post: { add: essay } } } },
    },
  ];
  const rect = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  });
  const presentation = (
    left: number,
    top: number,
    width: number,
    height: number
  ) => ({
    connected: true,
    displayed: true,
    opacity: 1,
    rect: rect(left, top, width, height),
    clip: rect(left, top, width, height),
  });
  const fragment = (left: number, width: number) => ({
    presentation: presentation(left, 40, width, 20),
    textAlpha: 1,
    pointerEvents: 'auto',
    hits: [0.1, 0.5, 0.9].map((fraction) => ({
      x: left + width * fraction,
      y: 50,
      stack: [
        { relation: 'owner' as const, tag: 'SPAN' },
        { relation: 'ancestor' as const, tag: 'DIV' },
      ],
    })),
  });
  const readingText =
    'Send reader row 10: An unchanged reading character remains visible here.';
  const seedPosts = Object.fromEntries(
    Array.from({ length: 36 }, (_, i) => [
      String(100 + i),
      {
        seal: { id: String(100 + i), seq: i + 1 },
        essay: {
          author: '~zod',
          sent: 1000 + i,
          content: [
            {
              inline: [
                `Send reader row ${i}: An unchanged reading character remains visible here.`,
              ],
            },
          ],
        },
      },
    ])
  );
  return {
    version: 1,
    title:
      'pending Enter send cannot reclaim latest after deliberate upward scrolling',
    token,
    text,
    scope,
    channel,
    declaredAt: 0,
    timeOrigin: 1_700_000_000_000,
    preparation: {
      ship: 'zod',
      e2eMode: false,
      origin: 'http://localhost:3000',
      browser: 'Chromium control',
      headed: true,
      driver: { project: 'chromium', headless: false, channel: 'chromium' },
      scripts: ['http://localhost:3000/apps/groups/assets/main.js'],
      developmentRuntime: false,
    },
    events: [
      {
        type: 'keydown',
        time: 102,
        observedAt: 103,
        trusted: true,
        scope,
        target: 'input',
        key: 'Enter',
        value: text,
      },
      {
        type: 'wheel',
        time: 310,
        observedAt: 312,
        trusted: true,
        scope,
        target: 'list',
        deltaY: -120,
        value: '',
      },
    ],
    samples: Array.from({ length: 112 }, (_, i) => {
      const time = 10 + i * 50;
      return {
        time,
        duration: 1,
        valid: true,
        scope,
        value: '',
        offset: time < 310 ? 1700 : 1580,
        extent: 2000,
        height: 300,
        sentRows:
          time < 150
            ? []
            : [
                {
                  id: time < 800 ? '1.100' : '1.200',
                  text,
                  deliveryCount: time < 800 ? 1 : 0,
                },
              ],
      };
    }),
    marks: [
      { id: 'enter', time: 100 },
      { id: 'pending', time: 200 },
      { id: 'read', time: 400 },
      { id: 'release', time: 550 },
      { id: 'terminal', time: 900 },
    ],
    request: {
      url: 'http://localhost:3000/~/channel/test',
      method: 'PUT',
      body: JSON.stringify(actions),
      actions,
      heldAt: 140,
      releasedAt: 550,
      continuedAt: 555,
      overridesProvided: false,
    },
    backend: [
      {
        phase: 'held',
        url: `http://localhost:3000/~/scry/channels/v5/${channel}/posts/newest/50/post.json`,
        status: 200,
        startedAt: 220,
        completedAt: 260,
        body: {
          posts: structuredClone(seedPosts),
          total: 36,
          newest: 36,
          older: null,
          newer: null,
        },
      },
      {
        phase: 'terminal',
        url: `http://localhost:3000/~/scry/channels/v5/${channel}/posts/newest/50/post.json`,
        status: 200,
        startedAt: 800,
        completedAt: 850,
        body: {
          posts: {
            ...structuredClone(seedPosts),
            '1.200': { seal: { id: '1200', seq: 37 }, essay },
          },
          total: 37,
          newest: 37,
          older: null,
          newer: null,
        },
      },
    ],
    sse: {
      supported: true,
      errors: [],
      messages: [
        {
          url: 'http://localhost:3000/~/channel/test',
          receivedAt: 750,
          raw: JSON.stringify({ id: 42, response: 'poke', ok: null }),
        },
      ],
    },
    readingContract: {
      scope,
      rowId: 'reader',
      blockSelector: '.body',
      revision: { id: 'reader:unchanged', text: readingText },
      point: { start: 2, end: 3, x: 30, y: 30, tolerancePx: 1 },
      coverage: {
        startTime: 400,
        endTime: 1900,
        maxGapMs: 100,
        maxMeasurementDurationMs: 32,
      },
      terminalTime: 900,
    },
    reading: {
      blockSelector: '.body',
      point: { start: 2, end: 3 },
      errors: [],
      marks: [{ id: 'terminal-ready', time: 900 }],
      samples: Array.from({ length: 104 }, (_, i) => ({
        time: 400 + i * 50,
        scope,
        rowId: 'reader',
        sameRow: true,
        sameBlock: true,
        blockCount: 1,
        text: readingText,
        list: presentation(10, 10, 600, 300),
        row: presentation(10, 30, 600, 220),
        block: presentation(30, 40, 500, 100),
        nodes: [
          {
            text: readingText,
            start: 0,
            end: readingText.length,
            fragments: [fragment(30, 200)],
          },
        ],
        point: {
          start: 2,
          end: 3,
          text: 'n',
          relativeX: 30,
          relativeY: 30,
          fragment: fragment(40, 8),
        },
        measurement: { valid: true, durationMs: 1 },
      })),
    },
    plannedEnd: 5550,
    errors: [],
  };
}

describe('real pending-send proof controls (synthetic evidence only)', () => {
  it('accepts exact held request, actual READ, acknowledgement and one commit with the fixed full tail', () => {
    expect(
      assessPendingSendEvidence(pendingSendEvidence(), assessScrollReadingTrace)
        .verdict
    ).toBe('PASS');
  });
  it.each([
    'early-release',
    'wrong-request',
    'already-committed',
    'wrong-ack',
    'missing-tail',
    'missing-wheel',
    'missing-pending',
  ] as const)('rejects %s instead of trusting a producer pass', (fault) => {
    const p = pendingSendEvidence();
    if (fault === 'early-release') p.request!.continuedAt = 300;
    if (fault === 'wrong-request')
      p.request!.body = p.request!.body.replace('abcd1234', 'dcba1234');
    if (fault === 'already-committed') p.backend[0].body = p.backend[1].body;
    if (fault === 'wrong-ack')
      p.sse.messages[0].raw = JSON.stringify({
        id: 43,
        response: 'poke',
        ok: null,
      });
    if (fault === 'missing-tail') {
      p.samples = p.samples.slice(0, -10);
      p.reading!.samples = p.reading!.samples.slice(0, -10);
    }
    if (fault === 'missing-wheel') p.events.pop();
    if (fault === 'missing-pending')
      p.samples.filter((s) => s.time < 800).forEach((s) => (s.sentRows = []));
    expect(assessPendingSendEvidence(p, assessScrollReadingTrace).verdict).toBe(
      'INCOMPLETE'
    );
  });
  it('rejects duplicate actual backend commit', () => {
    const p = pendingSendEvidence();
    const posts = (p.backend[1].body as { posts: Record<string, unknown> })
      .posts;
    const copy = structuredClone(posts['1.200']) as {
      seal: { id: string; seq: number };
    };
    copy.seal = { id: '1201', seq: 38 };
    posts['1.201'] = copy;
    Object.assign(p.backend[1].body as object, { total: 38, newest: 38 });
    expect(
      assessPendingSendEvidence(p, assessScrollReadingTrace).issues
    ).toContainEqual({
      code: 'send-commit-count-is-not-one',
      kind: 'failure',
      dimension: 'routing',
    });
  });
  it('preserves a late independently measured reading jump after acknowledgement', () => {
    const p = pendingSendEvidence();
    for (const s of p.reading!.samples.filter((s) => s.time >= 1000)) {
      for (const state of [
        s.row,
        s.block,
        ...s.nodes.flatMap((n) => n.fragments.map((f) => f.presentation)),
        s.point!.fragment.presentation,
      ]) {
        state.rect.top += 20;
        state.rect.bottom += 20;
        state.clip.top += 20;
        state.clip.bottom += 20;
      }
      for (const f of [
        ...s.nodes.flatMap((n) => n.fragments),
        s.point!.fragment,
      ])
        f.hits.forEach((hit) => (hit.y += 20));
      s.point!.relativeY += 20;
    }
    const result = assessPendingSendEvidence(p, assessScrollReadingTrace);
    expect(result.verdict).toBe('FAIL');
    expect(
      result.issues.some(
        (i) => i.code === 'reading:reading-point-moved' && i.kind === 'failure'
      )
    ).toBe(true);
    p.sse.supported = false;
    p.sse.messages = [];
    expect(assessPendingSendEvidence(p, assessScrollReadingTrace).verdict).toBe(
      'FAIL'
    );
  });
  it('unsupported passive acknowledgement keeps narrower evidence incomplete', () => {
    const p = pendingSendEvidence();
    p.sse.supported = false;
    p.sse.messages = [];
    expect(
      assessPendingSendEvidence(p, assessScrollReadingTrace).issues
    ).toEqual([
      {
        code: 'matching-real-send-acknowledgement-unavailable',
        kind: 'incomplete',
        dimension: 'routing',
      },
    ]);
  });
});

import {
  pendingSendScenario,
  replayPendingSendEvidence,
} from '../../../scripts/scroll-stability-keyboard-evidence.mjs';
describe('pending-send independent import', () => {
  const attempt = {
    title: pendingSendScenario.title,
    startTime: new Date(1_700_000_000_000).toISOString(),
    duration: 6000,
  };
  it('recomputes a JSON-roundtripped healthy proof', () => {
    const raw = JSON.parse(JSON.stringify(pendingSendEvidence()));
    expect(
      replayPendingSendEvidence(
        { proof: raw, assessment: { verdict: 'FAIL' } },
        raw,
        attempt
      ).verdict
    ).toBe('PASS');
  });
  it('rejects reused or changed raw proof despite a declared pass', () => {
    const raw = pendingSendEvidence();
    expect(
      replayPendingSendEvidence(
        { proof: raw, assessment: { verdict: 'PASS' } },
        { ...raw, token: '1234abcd' },
        attempt
      ).verdict
    ).toBe('INCOMPLETE');
    expect(
      replayPendingSendEvidence({ proof: raw }, raw, {
        ...attempt,
        startTime: new Date(1_800_000_000_000).toISOString(),
      }).verdict
    ).toBe('INCOMPLETE');
  });
});

describe('pending-send proof integrity after independent review', () => {
  it.each(['heldAt', 'continuedAt', 'receivedAt'] as const)(
    'requires finite %s before ordering comparisons',
    (field) => {
      for (const value of [undefined, NaN, Infinity]) {
        const p = pendingSendEvidence();
        const target = (field === 'receivedAt'
          ? p.sse.messages[0]
          : p.request!) as unknown as Record<string, unknown>;
        target[field] = value;
        expect(
          assessPendingSendEvidence(p, assessScrollReadingTrace).verdict
        ).toBe('INCOMPLETE');
      }
    }
  );
  it('requires finite initial viewport numbers', () => {
    const p = pendingSendEvidence();
    p.samples[0].offset = NaN;
    expect(assessPendingSendEvidence(p, assessScrollReadingTrace).verdict).toBe(
      'INCOMPLETE'
    );
  });
  it.each([
    'missing-metadata',
    'wrong-total',
    'remaining-cursor',
    'canonical-duplicate',
    'key-seal-mismatch',
  ] as const)(
    'rejects incomplete or contradictory backend inventory: %s',
    (fault) => {
      const p = pendingSendEvidence();
      const body = p.backend[1].body as {
        posts: Record<string, { seal: { id: string; seq: number } }>;
        total?: number;
        newest: number;
        older?: unknown;
      };
      if (fault === 'missing-metadata') delete body.total;
      if (fault === 'wrong-total') body.total = 38;
      if (fault === 'remaining-cursor') body.older = '100';
      if (fault === 'canonical-duplicate') {
        body.posts['1200'] = structuredClone(body.posts['1.200']);
        body.total = 38;
        body.newest = 38;
      }
      if (fault === 'key-seal-mismatch') body.posts['1.200'].seal.id = '1201';
      expect(
        assessPendingSendEvidence(p, assessScrollReadingTrace).verdict
      ).toBe('INCOMPLETE');
    }
  );
  it('rejects a correct-looking terminal row belonging to another committed identity', () => {
    const p = pendingSendEvidence();
    p.samples
      .filter((s) => s.time >= 900)
      .forEach((s) => {
        s.sentRows[0].id = '1.201';
      });
    expect(
      assessPendingSendEvidence(p, assessScrollReadingTrace).issues
    ).toContainEqual({
      code: 'terminal-delivery-row-identity-mismatch',
      kind: 'failure',
      dimension: 'routing',
    });
  });
  it('compares large grouped UI IDs to seal IDs without floating-point coercion', () => {
    const p = pendingSendEvidence();
    const id = '170141184508149299528096179438858797056',
      grouped = '170.141.184.508.149.299.528.096.179.438.858.797.056';
    const posts = (
      p.backend[1].body as { posts: Record<string, { seal: { id: string } }> }
    ).posts;
    posts[grouped] = posts['1.200'];
    delete posts['1.200'];
    posts[grouped].seal.id = id;
    p.samples
      .filter((s) => s.time >= 800)
      .forEach((s) => {
        s.sentRows[0].id = grouped;
      });
    expect(assessPendingSendEvidence(p, assessScrollReadingTrace).verdict).toBe(
      'PASS'
    );
    p.samples.at(-1)!.sentRows[0].id =
      '170.141.184.508.149.299.528.096.179.438.858.797.057';
    expect(assessPendingSendEvidence(p, assessScrollReadingTrace).verdict).toBe(
      'FAIL'
    );
  });
  it('requires a finite enclosing replay duration', () => {
    const raw = pendingSendEvidence();
    expect(
      replayPendingSendEvidence({ proof: raw }, raw, {
        title: pendingSendScenario.title,
        startTime: new Date(raw.timeOrigin).toISOString(),
        duration: Infinity,
      }).verdict
    ).toBe('INCOMPLETE');
  });
});

import {
  createFailedSendGate,
  FAILED_SEND_RETRY_TITLE,
  pendingSendTargetIsExposed,
} from './scrollKeyboardTrace';
import { failedSendRetryScenario } from '../../../scripts/scroll-stability-keyboard-evidence.mjs';

function failedRetryEvidence(): PendingSendEvidence {
  const p = pendingSendEvidence();
  p.title = FAILED_SEND_RETRY_TITLE;
  p.preparation.headed = false;
  p.preparation.driver.headless = true;
  const retryRequest = structuredClone(p.request!);
  (retryRequest.actions as any[])[0].id = 43;
  retryRequest.body = JSON.stringify(retryRequest.actions);
  retryRequest.heldAt = 885;
  retryRequest.releasedAt = 1205;
  retryRequest.continuedAt = 1210;
  retryRequest.abortedAt = null;
  p.request!.continuedAt = null;
  p.request!.releasedAt = 555;
  p.request!.abortedAt = 560;
  p.retry = {
    version: 1,
    failureCode: 'blockedbyclient',
    failedAt: 600,
    retryAt: 875,
    postId: '1.100',
    request: retryRequest,
    requestCount: 2,
    failedBackend: {
      ...structuredClone(p.backend[0]),
      startedAt: 620,
      completedAt: 670,
    },
  };
  p.events.push({
    type: 'click',
    time: 880,
    observedAt: 881,
    trusted: true,
    scope: p.scope,
    target: 'list',
    postId: '1.100',
    retryLabel: 'Send failed,click to retry',
    clientX: 40,
    clientY: 50,
    value: '',
  });
  p.marks.find((m) => m.id === 'read')!.time = 1050;
  p.marks.find((m) => m.id === 'release')!.time = 1200;
  p.marks.at(-1)!.time = 1500;
  p.events.find((e) => e.type === 'wheel')!.time = 910;
  p.events.find((e) => e.type === 'wheel')!.observedAt = 912;
  p.events.sort((a, b) => a.time - b.time);
  p.plannedEnd = 6200;
  p.backend[1].startedAt = 1400;
  p.backend[1].completedAt = 1450;
  p.sse.messages[0].raw = JSON.stringify({
    id: 43,
    response: 'poke',
    ok: null,
  });
  p.sse.messages[0].receivedAt = 1390;
  p.readingContract!.terminalTime = 1500;
  p.readingContract!.coverage.startTime = 1050;
  p.readingContract!.coverage.endTime = 2500;
  p.reading!.marks[0].time = 1500;
  for (const s of p.reading!.samples) s.time += 650;
  p.samples.push(
    ...Array.from({ length: 13 }, (_, i) => ({
      ...structuredClone(p.samples.at(-1)!),
      time: 5610 + i * 50,
    }))
  );
  p.samples.at(-1)!.time = 6210;
  for (const sample of p.samples) {
    sample.offset = sample.time < 910 ? 1700 : 1580;
    if (!sample.sentRows.length) continue;
    sample.sentRows[0] = {
      id: sample.time < 1400 ? '1.100' : '1.200',
      text: p.text,
      deliveryCount:
        sample.time < 600 || (sample.time >= 885 && sample.time < 1400) ? 1 : 0,
      retryCount: sample.time >= 600 && sample.time < 885 ? 1 : 0,
      targets: {
        message: {
          rect: {
            left: 10,
            top: 10,
            right: 100,
            bottom: 30,
            width: 90,
            height: 20,
          },
          clip: {
            left: 0,
            top: 0,
            right: 200,
            bottom: 100,
            width: 200,
            height: 100,
          },
          visible: true,
          hit: true,
        },
        retry:
          sample.time >= 600 && sample.time < 885
            ? {
                rect: {
                  left: 10,
                  top: 40,
                  right: 100,
                  bottom: 60,
                  width: 90,
                  height: 20,
                },
                clip: {
                  left: 0,
                  top: 0,
                  right: 200,
                  bottom: 100,
                  width: 200,
                  height: 100,
                },
                visible: true,
                hit: true,
              }
            : null,
      },
      contentTexts: [p.text + ' '],
    };
  }
  return p;
}
const assessRetry = (p: PendingSendEvidence) =>
  assessPendingSendEvidence(p, assessScrollReadingTrace);

describe('failed-send retry exact product evidence', () => {
  it('accepts the exact failed provisional row, real Retry and one durable echo under the existing reading limits', () => {
    const result = assessRetry(
      JSON.parse(JSON.stringify(failedRetryEvidence()))
    );
    expect(result.issues).toEqual([]);
    expect(result.verdict).toBe('PASS');
    expect(result.presentedFrames).toBe('INCOMPLETE');
  });
  for (const [name, corrupt] of [
    [
      'second initial request',
      (p: PendingSendEvidence) => {
        p.retry!.requestCount = 3;
      },
    ],
    [
      'untrusted retry',
      (p: PendingSendEvidence) => {
        p.events.find((e) => e.type === 'click')!.trusted = false;
      },
    ],
    [
      'another post retry',
      (p: PendingSendEvidence) => {
        p.events.find((e) => e.type === 'click')!.postId = 'another';
      },
    ],
    [
      'missing retry affordance',
      (p: PendingSendEvidence) => {
        p.samples.find((s) => s.time >= 600)!.sentRows[0].retryCount = 0;
      },
    ],
    [
      'failed row not exposed',
      (p: PendingSendEvidence) => {
        p.samples.find((s) => s.time >= 600)!.sentRows[0].targets!.retry!.hit =
          false;
      },
    ],
    [
      'retry before failure',
      (p: PendingSendEvidence) => {
        p.retry!.retryAt = 500;
      },
    ],
    [
      'changed retry sent identity',
      (p: PendingSendEvidence) => {
        const r = p.retry!.request!;
        (r.actions as any[])[0].json.channel.action.post.add.sent++;
        r.body = JSON.stringify(r.actions);
      },
    ],
    [
      'changed retry content',
      (p: PendingSendEvidence) => {
        const r = p.retry!.request!;
        (r.actions as any[])[0].json.channel.action.post.add.content = [
          { inline: ['wrong'] },
        ];
        r.body = JSON.stringify(r.actions);
      },
    ],
    [
      'same poke identity',
      (p: PendingSendEvidence) => {
        const r = p.retry!.request!;
        (r.actions as any[])[0].id = 42;
        r.body = JSON.stringify(r.actions);
      },
    ],
    [
      'missing failure receipt',
      (p: PendingSendEvidence) => {
        p.request!.abortedAt = null;
      },
    ],
    [
      'failure accidentally forwarded',
      (p: PendingSendEvidence) => {
        p.request!.continuedAt = 555;
      },
    ],
    [
      'false successful initial acknowledgement',
      (p: PendingSendEvidence) => {
        p.sse.messages.push({
          ...p.sse.messages[0],
          raw: JSON.stringify({ id: 42, response: 'poke', ok: null }),
        });
      },
    ],
    [
      'missing success callback',
      (p: PendingSendEvidence) => {
        p.sse.messages = [];
      },
    ],
    [
      'callback failure',
      (p: PendingSendEvidence) => {
        p.errors.push('route callback failed');
      },
    ],
    [
      'unsupported mode',
      (p: PendingSendEvidence) => {
        p.preparation.driver.headless = true;
        p.preparation.headed = true;
      },
    ],
  ] as const)
    it(`does not pass ${name}`, () => {
      const p = failedRetryEvidence();
      corrupt(p);
      expect(assessRetry(p).verdict).not.toBe('PASS');
    });
  it('reports a coherently observed changed failed-row identity as a failure', () => {
    const p = failedRetryEvidence();
    p.samples.find((s) => s.time >= 650)!.sentRows[0].id = 'different';
    expect(assessRetry(p).issues).toContainEqual({
      code: 'failed-provisional-row-identity-or-text-changed',
      kind: 'failure',
      dimension: 'routing',
    });
  });
  it('rejects altered exact message text even when the old text remains a substring', () => {
    const p = failedRetryEvidence();
    p.samples.find((s) => s.time >= 650)!.sentRows[0].contentTexts = [
      p.text + ' changed',
    ];
    expect(assessRetry(p).verdict).toBe('FAIL');
  });
  it('keeps independently qualified reading failure when the Retry callback is unavailable', () => {
    const p = failedRetryEvidence();
    p.sse.messages = [];
    const s = p.reading!.samples[10];
    s.point!.relativeY += 18;
    s.point!.fragment.presentation.rect.top += 18;
    s.point!.fragment.presentation.rect.bottom += 18;
    s.point!.fragment.presentation.clip.top += 18;
    s.point!.fragment.presentation.clip.bottom += 18;
    for (const hit of s.point!.fragment.hits) hit.y += 18;
    expect(assessRetry(p).verdict).toBe('FAIL');
  });
  it('rejects a duplicate complete backend echo', () => {
    const p = failedRetryEvidence();
    const body = p.backend[1].body as any;
    body.posts['1300'] = structuredClone(body.posts['1.200']);
    body.posts['1300'].seal = { id: '1300', seq: 38 };
    body.total = body.newest = 38;
    expect(assessRetry(p).verdict).toBe('FAIL');
  });
  it('replays the exact new title and JSON raw, refusing an old-title or edited attachment', () => {
    const p = failedRetryEvidence();
    const attempt = {
      title: failedSendRetryScenario.title,
      startTime: new Date(p.timeOrigin).toISOString(),
      duration: 7000,
    };
    expect(
      replayPendingSendEvidence({ proof: p }, structuredClone(p), attempt)
        .verdict
    ).toBe('PASS');
    expect(
      replayPendingSendEvidence({ proof: p }, p, {
        ...attempt,
        title: pendingSendScenario.title,
      }).verdict
    ).toBe('INCOMPLETE');
    const altered = structuredClone(p);
    altered.retry!.postId = 'other';
    expect(
      replayPendingSendEvidence({ proof: p }, altered, attempt).verdict
    ).toBe('INCOMPLETE');
  });
});

describe('actual test-owned failure gate callbacks', () => {
  const request = (id = 42) => {
    const r = structuredClone(pendingSendEvidence().request!);
    (r.actions as any[])[0].id = id;
    r.body = JSON.stringify(r.actions);
    return { url: r.url, method: r.method, body: r.body };
  };
  function setup() {
    const p = pendingSendEvidence();
    const gate = createFailedSendGate({
      origin: p.preparation.origin,
      channel: p.channel,
      text: p.text,
    });
    const calls: string[] = [];
    let clock = 10;
    const callbacks = {
      now: async () => ++clock,
      waitForFailure: async () => {},
      waitForRetryRelease: async () => {},
      isCurrent: () => true,
      observed: () => {
        calls.push('observed');
      },
      abort: async () => {
        calls.push('abort');
      },
      forward: async () => {
        calls.push('forward');
      },
    };
    return { gate, calls, callbacks };
  }
  it('blocks only the first exact request and forwards one unchanged retry', async () => {
    const { gate, calls, callbacks } = setup();
    expect(await gate.dispatch(request(), callbacks)).toBe(true);
    expect(await gate.dispatch(request(43), callbacks)).toBe(true);
    expect(calls).toEqual(['observed', 'abort', 'observed', 'forward']);
    expect(gate.requests).toHaveLength(2);
    expect(gate.errors).toEqual([]);
  });
  for (const [name, edit] of [
    [
      'unrelated channel',
      (r: ReturnType<typeof request>) => {
        const a = JSON.parse(r.body);
        a[0].json.channel.nest = 'chat/~zod/other';
        r.body = JSON.stringify(a);
      },
    ],
    [
      'another origin',
      (r: ReturnType<typeof request>) => {
        r.url = 'http://localhost:3002/~/channel/test';
      },
    ],
    [
      'different text',
      (r: ReturnType<typeof request>) => {
        r.body = r.body.replace('Pending send', 'Unrelated');
      },
    ],
    [
      'malformed body',
      (r: ReturnType<typeof request>) => {
        r.body = '{';
      },
    ],
    [
      'unrelated method',
      (r: ReturnType<typeof request>) => {
        r.method = 'GET';
      },
    ],
  ] as const)
    it(`leaves ${name} untouched`, async () => {
      const { gate, calls, callbacks } = setup();
      const r = request();
      edit(r);
      expect(await gate.dispatch(r, callbacks)).toBe(false);
      expect(calls).toEqual([]);
      expect(gate.requests).toEqual([]);
    });
  it('does not forward a concurrent request before the first failure completes', async () => {
    const { gate, calls, callbacks } = setup();
    let release!: () => void;
    const pending = gate.dispatch(request(), {
      ...callbacks,
      waitForFailure: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    await Promise.resolve();
    await Promise.resolve();
    await gate.dispatch(request(43), callbacks);
    release();
    await pending;
    expect(calls).not.toContain('forward');
    expect(gate.errors).toContain('unexpected-or-changed-owned-retry-request');
  });
  for (const stage of [
    'now',
    'observed',
    'waitForFailure',
    'waitForRetryRelease',
    'abort',
    'forward',
  ] as const)
    it(`retains ${stage} callback failure and settles the route`, async () => {
      const { gate, calls, callbacks } = setup();
      if (stage === 'forward' || stage === 'waitForRetryRelease')
        await gate.dispatch(request(), callbacks);
      await gate.dispatch(
        request(
          stage === 'forward' || stage === 'waitForRetryRelease' ? 43 : 42
        ),
        {
          ...callbacks,
          [stage]: () => {
            throw new Error('control callback failure');
          },
        }
      );
      expect(
        gate.errors.some((e) => e.includes('owned-send-route-callback-error'))
      ).toBe(true);
      if (stage !== 'abort') expect(calls).toContain('abort');
      else
        expect(
          gate.errors.some((e) => e.includes('owned-send-route-cleanup-error'))
        ).toBe(true);
    });
  it('blocks an extra duplicate retry instead of sending a second durable post', async () => {
    const { gate, calls, callbacks } = setup();
    await gate.dispatch(request(), callbacks);
    await gate.dispatch(request(43), callbacks);
    await gate.dispatch(request(44), callbacks);
    expect(calls.filter((c) => c === 'forward')).toHaveLength(1);
    expect(gate.errors).toContain('unexpected-or-changed-owned-retry-request');
  });
});

it('retires the held retry when its current page scope is replaced', async () => {
  const p = pendingSendEvidence(),
    gate = createFailedSendGate({
      origin: p.preparation.origin,
      channel: p.channel,
      text: p.text,
    });
  const first = p.request!,
    next = structuredClone(first);
  (next.actions as any[])[0].id = 43;
  next.body = JSON.stringify(next.actions);
  let time = 1,
    forwards = 0,
    aborted = 0;
  const callbacks = {
    now: async () => ++time,
    waitForFailure: async () => {},
    waitForRetryRelease: async () => {},
    isCurrent: () => true,
    observed: () => {},
    abort: async () => {
      aborted++;
    },
    forward: async () => {
      forwards++;
    },
  };
  await gate.dispatch(first, callbacks);
  await gate.dispatch(next, { ...callbacks, isCurrent: () => false });
  expect(forwards).toBe(0);
  expect(aborted).toBe(2);
  expect(gate.errors.some((e) => e.includes('scope-retired'))).toBe(true);
});

it('does not derive failed-state geometry or identity failure from an invalid acquisition', () => {
  const p = failedRetryEvidence();
  const s = p.samples.find((s) => s.time >= 650)!;
  s.valid = false;
  s.height = -100;
  s.sentRows[0].id = 'wrong';
  const result = assessRetry(p);
  expect(result.verdict).toBe('INCOMPLETE');
  expect(result.issues.filter((i) => i.kind === 'failure')).toEqual([]);
});

it('binds the literal rendered Retry label and the encoder body space without normalization', () => {
  const healthy = failedRetryEvidence();
  expect(healthy.events.find((e) => e.type === 'click')!.retryLabel).toBe(
    'Send failed,click to retry'
  );
  expect(
    healthy.samples.find((s) => s.sentRows.length)!.sentRows[0].contentTexts
  ).toEqual([healthy.text + ' ']);
  expect(assessRetry(healthy).verdict).toBe('PASS');
  const spaced = structuredClone(healthy);
  spaced.events.find((e) => e.type === 'click')!.retryLabel =
    'Send failed, click to retry';
  expect(assessRetry(spaced).verdict).toBe('INCOMPLETE');
  const trimmed = structuredClone(healthy);
  trimmed.samples.find((s) => s.time >= 650)!.sentRows[0].contentTexts = [
    trimmed.text,
  ];
  expect(assessRetry(trimmed).verdict).toBe('FAIL');
});

it('requires the actual text and Retry boxes, not extra row wrapper space', () => {
  const p = failedRetryEvidence();
  const row = p.samples.find((s) => s.time >= 650)!.sentRows[0];
  // R1 has a fully visible message and Retry label while padded row space extends past the viewport.
  const wrapper = {
    left: 0,
    top: 0,
    right: 200,
    bottom: 124,
    width: 200,
    height: 124,
  };
  expect(
    pendingSendTargetIsExposed({ ...row.targets!.retry!, rect: wrapper })
  ).toBe(false);
  expect(pendingSendTargetIsExposed(row.targets!.message)).toBe(true);
  expect(pendingSendTargetIsExposed(row.targets!.retry)).toBe(true);
  expect(assessRetry(p).verdict).toBe('PASS');
  row.targets!.retry!.clip.bottom = 55;
  row.targets!.retry!.clip.height = 55;
  expect(assessRetry(p).verdict).toBe('INCOMPLETE');
});
it('rejects a trusted click outside the observed same-post Retry target', () => {
  const p = failedRetryEvidence();
  p.events.find((e) => e.type === 'click')!.clientY = 200;
  expect(assessRetry(p).verdict).toBe('INCOMPLETE');
});

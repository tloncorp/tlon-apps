import { describe, expect, it } from 'vitest';
import { assessScrollChromeTrace } from './scrollChromeTrace';
import {
  assessConversationSemantics,
  conversationMessageExpectations,
  type ConversationSemanticTrace,
  type ConversationSemanticContract,
} from './scrollConversationSemantic';

function evidence(mode: 'thinking' | 'remote' = 'thinking') {
  const scope = '/groups/~zod/group/channel/chat%2F~zod%2Fsample';
  const expectedTexts =
    mode === 'remote'
      ? Array.from({ length: 5 }, (_, i) => `Remote burst ${i}`)
      : ['Response before computing presence cleared'];
  const contract: ConversationSemanticContract = {
    version: 2,
    messageExpectations: conversationMessageExpectations(mode),
    mode,
    scope,
    expectedTexts,
    startTime: 1000,
    terminalTime: 4140,
    endTime: 5140,
  };
  const marks =
    mode === 'thinking'
      ? [
          { id: 'show-1', time: 1120 },
          { id: 'show-ready-1', time: 1220 },
          { id: 'clear-1', time: 1340 },
          { id: 'held-ready', time: 1420 },
          { id: 'hidden-ready-1', time: 3420 },
          { id: 'show-2', time: 3560 },
          { id: 'show-ready-2', time: 3660 },
          {
            id: 'delivered-0',
            time: 3800,
            text: expectedTexts[0],
            postId: 'post-0',
          },
          { id: 'clear-2', time: 3920 },
          { id: 'hidden-ready-2', time: 4020 },
          { id: 'terminal', time: 4140 },
        ]
      : expectedTexts
          .map((text, i) => ({
            id: `delivered-${i}`,
            time: 1200 + i * 400,
            text,
            postId: `post-${i}`,
          }))
          .concat([{ id: 'terminal', time: 4140, text: '', postId: '' }]);
  const raw: ConversationSemanticTrace = {
    scope,
    errors: [],
    marks,
    samples: [],
    chrome: {
      samples: [],
      actions:
        mode === 'thinking'
          ? [{ id: 'presence-lifecycle', scope, time: 1180 }]
          : [],
    },
    presence: [],
  };
  if (mode === 'thinking')
    for (const [i, id] of [
      'show-1',
      'clear-1',
      'show-2',
      'clear-2',
    ].entries()) {
      const active = i % 2 === 0;
      const context = '/channel/chat/~zod/sample';
      const key = { context, ship: '~ten', topic: 'computing' };
      raw.presence.push({
        markId: id,
        active,
        origin: 'http://localhost:3002',
        observerOrigin: 'http://localhost:3000',
        channelId: 'chat/~zod/sample',
        ship: 'ten',
        completedTime: marks.find((m) => m.id === id)!.time + 40,
        request: {
          url: 'http://localhost:3002/~/channel/scroller-example',
          status: 204,
          body: [
            {
              id: 1,
              action: 'poke',
              ship: 'ten',
              app: 'presence',
              mark: 'presence-action-1',
              json: active
                ? {
                    set: {
                      key,
                      display: { text: 'Scroll stability computing' },
                    },
                  }
                : { clear: key },
            },
          ],
        },
        observer: {
          status: 200,
          body: {
            init: {
              [context]: {
                computing: active
                  ? {
                      '~ten': {
                        display: { text: 'Scroll stability computing' },
                      },
                    }
                  : {},
              },
            },
          },
        },
      });
    }
  for (let time = 1000; time <= 5140; time += 20) {
    const posts = expectedTexts.flatMap((text, i) =>
      time >= marks.find((m) => m.id === `delivered-${i}`)!.time
        ? [{ id: `post-${i}`, texts: [`${text} `] }]
        : []
    );
    const measurement = { valid: true, durationMs: 1 };
    raw.samples.push({ time, scope, measurement, posts });
    const label =
      mode === 'thinking'
        ? (time >= 1160 && time < 1360) || (time >= 3600 && time < 3960)
          ? 'Scroll stability computing'
          : time >= 1360 && time < 3380
            ? 'Thinking...'
            : null
        : null;
    raw.chrome.samples.push({
      time,
      scope,
      measurement,
      semanticState: 'list-visible',
      loading: label === 'Scroll stability computing',
      controls: label
        ? [{ id: 'thinking', scope, kind: label, opacity: 1, visible: true }]
        : [],
    });
  }
  return { raw, contract };
}
const assess = (d: ReturnType<typeof evidence>) =>
  assessConversationSemantics(d.raw, d.contract, assessScrollChromeTrace);
describe('actual conversation semantic evidence controls', () => {
  it.each(['thinking', 'remote'] as const)(
    'accepts healthy serialized %s evidence',
    (mode) => {
      const d = evidence(mode);
      expect(assess(JSON.parse(JSON.stringify(d))).verdict).toBe('PASS');
    }
  );
  it.each([
    'immediate-hide',
    'hold-pulse',
    'terminal-revert',
    'wrong-label',
  ] as const)('rejects %s with stable scroll geometry', (fault) => {
    const d = evidence();
    const time =
      fault === 'immediate-hide'
        ? 1360
        : fault === 'terminal-revert'
          ? 4300
          : 2000;
    const frame = d.raw.chrome.samples.find((s) => s.time === time)!;
    if (fault === 'terminal-revert')
      frame.controls = [
        {
          id: 'thinking',
          scope: d.contract.scope,
          kind: 'Thinking...',
          opacity: 1,
          visible: true,
        },
      ];
    else if (fault === 'wrong-label')
      frame.controls[0].kind = 'Old request label';
    else frame.controls = [];
    expect(assess(d).verdict).toBe('FAIL');
  });
  it.each([
    'missing-held-phase',
    'wrong-actor',
    'missing-clear-response',
    'late-tail',
  ] as const)('rejects incomplete %s', (fault) => {
    const d = evidence();
    if (fault === 'missing-held-phase')
      d.raw.marks = d.raw.marks.filter((m) => m.id !== 'held-ready');
    if (fault === 'wrong-actor') d.raw.presence[1].ship = 'nec';
    if (fault === 'missing-clear-response') d.raw.presence.splice(1, 1);
    if (fault === 'late-tail') {
      d.raw.samples.pop();
      d.raw.chrome.samples.pop();
    }
    expect(assess(d).verdict).not.toBe('PASS');
  });
  it.each([
    'lost',
    'changed-text',
    'substituted-id',
    'duplicate',
    'reordered',
  ] as const)('rejects delivered post %s after a later delivery', (fault) => {
    const d = evidence('remote');
    const sample = d.raw.samples.find((s) => s.time === 4000)!;
    if (fault === 'lost') sample.posts.shift();
    if (fault === 'changed-text') sample.posts[0].texts = ['Stale text'];
    if (fault === 'substituted-id') sample.posts[0].id = 'post-wrong';
    if (fault === 'duplicate')
      sample.posts.push({ ...sample.posts[0], id: 'post-duplicate' });
    if (fault === 'reordered') sample.posts.reverse();
    expect(assess(d).verdict).toBe('FAIL');
  });
  it('rejects a delivery mark not backed by observed actual text and identity', () => {
    const d = evidence('remote');
    d.raw.marks[0].postId = 'invented';
    expect(
      assess(d).issues.some((i) => i.code === 'delivery-unwitnessed')
    ).toBe(true);
  });
  it('retains semantic reversion failure alongside a later capture gap', () => {
    const d = evidence('remote');
    d.raw.samples.find((s) => s.time === 4000)!.posts.shift();
    d.raw.samples.splice(
      d.raw.samples.findIndex((s) => s.time === 4500),
      10
    );
    expect(assess(d).verdict).toBe('FAIL');
    expect(assess(d).issues.some((i) => i.kind === 'incomplete')).toBe(true);
  });
});

it('preserves a valid thinking violation beside a later cadence gap, but does not qualify a bad baseline', () => {
  const d = evidence();
  d.raw.chrome.samples.find((s) => s.time === 2000)!.controls = [];
  const gap = d.raw.samples.findIndex((s) => s.time === 4500);
  d.raw.samples.splice(gap, 10);
  d.raw.chrome.samples.splice(gap, 10);
  expect(assess(d).verdict).toBe('FAIL');
  expect(assess(d).issues.some((i) => i.kind === 'incomplete')).toBe(true);
  const bad = evidence();
  bad.raw.chrome.samples[0].scope = 'different-scope';
  bad.raw.chrome.samples.find((s) => s.time === 2000)!.controls = [];
  expect(assess(bad).verdict).toBe('INCOMPLETE');
});

it.each(['remote', 'thinking'] as const)(
  'accepts actual plain-paragraph rendered leaves including the encoder space (%s)',
  (mode) => {
    const d = evidence(mode);
    for (const sample of d.raw.samples)
      for (const post of sample.posts) {
        const input = d.contract.expectedTexts[Number(post.id.split('-')[1])];
        post.texts = [
          `~ten09:22${input} `,
          '~ten09:22',
          '~ten',
          '09:22',
          `${input} `,
        ];
      }
    expect(assess(d).verdict).toBe('PASS');
  }
);

it.each([
  ['missing encoder space', 'Remote burst 0'],
  ['extra encoder space', 'Remote burst 0  '],
  ['changed internal space', 'Remote  burst 0 '],
  ['extra text', 'Remote burst 0 stale '],
] as const)('rejects exact rendered-leaf corruption: %s', (_name, text) => {
  const d = evidence('remote');
  d.raw.samples.find((s) => s.time === 4000)!.posts[0].texts = [text];
  expect(assess(d).verdict).toBe('FAIL');
});
it('cannot redefine expected rendered text from a producer or accept omitted v2 expectations', () => {
  const d = evidence('remote');
  d.contract.messageExpectations![0].renderedLeaf = 'Remote burst 0';
  expect(assess(d).verdict).toBe('INCOMPLETE');
  delete d.contract.messageExpectations;
  expect(assess(d).verdict).toBe('INCOMPLETE');
});
it('labels the exact source-grounded replay of original v1 records without rewriting them', () => {
  const d = evidence('remote');
  d.contract.version = 1;
  delete d.contract.messageExpectations;
  const before = JSON.stringify(d);
  expect(assess(d)).toMatchObject({
    verdict: 'PASS',
    readerRevision: 2,
    textInterpretation: 'legacy-fixed-plain-paragraph-correction',
  });
  expect(JSON.stringify(d)).toBe(before);
});

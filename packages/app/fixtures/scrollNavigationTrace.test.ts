import { describe, expect, it } from 'vitest';
import {
  assessScrollNavigationTrace,
  type NavigationList,
  type ScrollNavigationPlan,
  type ScrollNavigationTrace,
} from './scrollNavigationTrace';

function evidence() {
  const plan: ScrollNavigationPlan = {
    version: 1,
    declaredAt: -1,
    initial: 'channel',
    scopes: {
      channel: {
        route: '/channel/a',
        kind: 'channel',
        rows: { a: 'Original channel text' },
        landing: { kind: 'anchor', rowId: 'a', top: 100, pointTop: 120 },
      },
      thread: {
        route: '/channel/a/thread/t',
        kind: 'thread',
        rows: { t: 'Exact newest reply' },
        landing: { kind: 'bottom', newestId: 't' },
      },
    },
    commands: [
      {
        id: 'open',
        from: 'channel',
        to: 'thread',
        trigger: { kind: 'click', text: '18 replies' },
      },
      {
        id: 'return',
        from: 'thread',
        to: 'channel',
        trigger: { kind: 'popstate' },
      },
    ],
    maxGapMs: 100,
    maxMeasurementMs: 32,
    maxOutgoingMs: 250,
    completionMs: 1000,
    quietTailMs: 1000,
    tolerancePx: 1,
  };
  const list = (thread: boolean, replacement = false): NavigationList => ({
    identity: thread ? 2 : replacement ? 3 : 1,
    kind: thread ? 'thread' : 'channel',
    exposed: true,
    height: 500,
    bottomGap: thread ? 0 : 1000,
    rows: [
      {
        id: thread ? 't' : 'a',
        top: thread ? 450 : 100,
        bottom: thread ? 500 : 160,
        exposed: true,
        body: {
          count: 1,
          text: thread ? 'Exact newest reply' : 'Original channel text',
          exposed: true,
          pointTop: thread ? 460 : 120,
        },
      },
    ],
  });
  const trace: ScrollNavigationTrace = {
    start: 0,
    end: 4500,
    errors: [],
    commands: [
      { id: 'open', start: 240, end: 260 },
      { id: 'return', start: 2500, end: 2520 },
    ],
    events: [
      {
        time: 250,
        observedAt: 250,
        kind: 'click',
        trusted: true,
        texts: ['18 replies'],
        testIds: [],
      },
      {
        time: 2510,
        observedAt: 2510,
        kind: 'popstate',
        trusted: true,
        texts: [],
        testIds: [],
      },
    ],
    samples: Array.from({ length: 226 }, (_, index) => {
      const time = index * 20,
        thread = time >= 300 && time < 2560;
      return {
        time,
        durationMs: 1,
        route: thread ? plan.scopes.thread.route : plan.scopes.channel.route,
        documentVisible: true,
        loadingCount: 0,
        unattributedBodies: 0,
        lists: [list(thread, time >= 2560)],
      };
    }),
  };
  return { trace, plan };
}
type Evidence = ReturnType<typeof evidence>;
const assess = ({ trace, plan }: Evidence) =>
  assessScrollNavigationTrace(trace, plan);
const sample = (input: Evidence, time: number) =>
  input.trace.samples.find((item) => item.time === time)!;
const codes = (input: Evidence) =>
  assess(input).issues.map((issue) => issue.code);

describe('continuous navigation evidence controls', () => {
  it.each([
    ['correct frame', 'a', ['Quoted reply'], 1, true, 'PASS'],
    ['another row', 'other', ['Quoted reply'], 1, true, 'INCOMPLETE'],
    ['another reply', 'a', ['Wrong reply'], 1, true, 'INCOMPLETE'],
    ['duplicate reference', 'a', ['Quoted reply'], 2, true, 'INCOMPLETE'],
    ['synthetic event', 'a', ['Quoted reply'], 1, false, 'INCOMPLETE'],
  ] as const)(
    'binds an actual reference target: %s',
    (_label, rowId, texts, frameCount, trusted, verdict) => {
      const input = evidence();
      input.plan.commands[0].trigger = {
        kind: 'click',
        reference: { rowId: 'a', text: 'Quoted reply' },
      };
      input.trace.events[0].texts = ['Header and author'];
      input.trace.events[0].trusted = trusted;
      input.trace.events[0].reference = {
        rowId,
        texts: [...texts],
        frameCount,
      };
      expect(assess(input).verdict).toBe(verdict);
    }
  );
  it('does not accept a caption click with matching text outside a reference frame', () => {
    const input = evidence();
    input.plan.commands[0].trigger = {
      kind: 'click',
      reference: { rowId: 'a', text: '18 replies' },
    };
    expect(codes(input)).toContain('invalid-delivery');
  });
  it('retains ordered quoted and original text blocks with the original reading character', () => {
    const input = evidence();
    input.plan.scopes.channel.textBlocks = {
      a: ['Exact quote', 'Original channel text'],
    };
    for (const frame of input.trace.samples)
      for (const list of frame.lists) {
        if (list.kind !== 'channel') continue;
        list.rows[0].body.count = 2;
        list.rows[0].body.pointBlockIndex = 1;
        list.rows[0].body.blocks = [
          { text: 'Exact quote', exposed: true },
          { text: 'Original channel text', exposed: true },
        ];
      }
    expect(assess(input).verdict).toBe('PASS');
    sample(input, 3200).lists[0].rows[0].body.blocks![0].text = 'Wrong quote';
    expect(codes(input)).toContain('wrong-or-hidden-text');
  });
  it('rejects extra or missing quote blocks as incomplete acquisition', () => {
    const input = evidence();
    input.plan.scopes.channel.textBlocks = {
      a: ['Quote', 'Original channel text'],
    };
    expect(codes(input)).toContain('text-acquisition-unavailable');
  });
  it('rejects quoted text substituted for the original interior reading block', () => {
    const input = evidence();
    const body = sample(input, 3200).lists[0].rows[0].body;
    body.blocks = [{ text: 'Original channel text', exposed: true }];
    body.pointBlockIndex = 1;
    expect(codes(input)).toContain('wrong-or-hidden-text');
  });
  it('checks first destination reveal before the source URL commits', () => {
    const input = evidence();
    sample(input, 300).route = input.plan.scopes.channel.route;
    expect(assess(input)).toMatchObject({
      verdict: 'PASS',
      firstReveals: { open: 300, return: 2560 },
    });
  });
  it('allows a bounded outgoing view after the destination URL commits', () => {
    const input = evidence();
    sample(input, 280).route = input.plan.scopes.thread.route;
    expect(assess(input).verdict).toBe('PASS');
  });
  it('rejects wrong first destination landing before URL commit', () => {
    const input = evidence();
    sample(input, 300).route = input.plan.scopes.channel.route;
    sample(input, 300).lists[0].bottomGap = 80;
    expect(codes(input)).toContain('wrong-bottom-landing');
    expect(assess(input).firstReveals.open).toBe(300);
  });
  it('rejects outgoing content reappearing after a destination reveal before URL commit', () => {
    const input = evidence();
    sample(input, 300).route = input.plan.scopes.channel.route;
    sample(input, 320).route = input.plan.scopes.channel.route;
    sample(input, 320).lists = structuredClone(sample(input, 0).lists);
    expect(codes(input)).toContain('wrong-list-scope');
  });
  it('rejects destination content with a source URL that converges too late', () => {
    const input = evidence();
    for (const frame of input.trace.samples)
      if (frame.time >= 300 && frame.time <= 520)
        frame.route = input.plan.scopes.channel.route;
    expect(codes(input)).toContain('wrong-route');
  });
  it('rejects an undeclared third route during commit ordering', () => {
    const input = evidence();
    sample(input, 300).route = '/unrelated/thread';
    expect(codes(input)).toContain('wrong-route');
  });
  it('does not count early visible destination as cancellation merely because its URL is old', () => {
    const input = evidence();
    sample(input, 300).route = input.plan.scopes.channel.route;
    input.plan.commands[1].cancels = 'open';
    expect(codes(input)).toContain('cancellation-not-before-reveal');
  });
  it('accepts correct first reveals and a replaced channel container through the full quiet tail', () => {
    expect(assess(evidence())).toMatchObject({
      verdict: 'PASS',
      presentation: 'INCOMPLETE',
      durableReads: 'INCOMPLETE',
      firstReveals: { open: 300, return: 2560 },
    });
  });
  it('permits one explicit bounded destination loading phase before first reveal', () => {
    const input = evidence();
    for (const frame of input.trace.samples.filter(
      (item) => item.time >= 260 && item.time < 300
    )) {
      frame.route = input.plan.scopes.thread.route;
      frame.lists = [];
      frame.loadingCount = 1;
    }
    expect(assess(input).verdict).toBe('PASS');
  });
  it('accepts a genuinely pre-reveal immediate Back and rejects the same sequence after reveal', () => {
    const input = evidence();
    input.plan.commands[1].cancels = 'open';
    input.trace.commands[1] = { id: 'return', start: 280, end: 295 };
    input.trace.events[1].time = input.trace.events[1].observedAt = 285;
    for (const frame of input.trace.samples) {
      if (frame.time === 260 || frame.time === 280) {
        frame.route = input.plan.scopes.thread.route;
        frame.lists = [];
        frame.loadingCount = 1;
      } else if (frame.time >= 300) {
        frame.route = input.plan.scopes.channel.route;
        frame.lists = structuredClone(sample(input, 0).lists);
      }
    }
    expect(assess(input).verdict).toBe('PASS');
    const revealed = evidence();
    revealed.plan.commands[1].cancels = 'open';
    expect(codes(revealed)).toContain('cancellation-not-before-reveal');
    expect(assess(revealed).verdict).toBe('INCOMPLETE');
  });
  it.each([
    [
      'wrong-end flash',
      'wrong-bottom-landing',
      (input: Evidence) => {
        sample(input, 300).lists[0].bottomGap = 220;
      },
    ],
    [
      'eventual-correct early-wrong return',
      'wrong-reading-landing',
      (input: Evidence) => {
        sample(input, 2560).lists[0].rows[0].top = 0;
      },
    ],
    [
      'interior-only reading jump',
      'wrong-reading-landing',
      (input: Evidence) => {
        sample(input, 2600).lists[0].rows[0].body.pointTop = 145;
      },
    ],
    [
      'one-frame list drop',
      'blank-content',
      (input: Evidence) => {
        sample(input, 3200).lists = [];
      },
    ],
    [
      'one-frame row drop',
      'blank-content',
      (input: Evidence) => {
        sample(input, 3200).lists[0].rows = [];
      },
    ],
    [
      'hidden text in stable full row',
      'wrong-or-hidden-text',
      (input: Evidence) => {
        sample(input, 3200).lists[0].rows[0].body.exposed = false;
      },
    ],
    [
      'wrong exact revision',
      'wrong-or-hidden-text',
      (input: Evidence) => {
        sample(input, 3200).lists[0].rows[0].body.text = 'stale';
      },
    ],
    [
      'wrong row owner',
      'wrong-row-scope',
      (input: Evidence) => {
        sample(input, 3200).lists[0].rows[0].id = 'other';
      },
    ],
    [
      'duplicate row',
      'duplicate-row',
      (input: Evidence) => {
        sample(input, 3200).lists[0].rows.push(
          structuredClone(sample(input, 3200).lists[0].rows[0])
        );
      },
    ],
    [
      'wrong list scope behind correct route',
      'wrong-list-scope',
      (input: Evidence) => {
        sample(input, 3200).lists = structuredClone(sample(input, 400).lists);
      },
    ],
    [
      'stale thread callback after return',
      'wrong-route',
      (input: Evidence) => {
        sample(input, 3200).route = input.plan.scopes.thread.route;
      },
    ],
    [
      'outgoing route restored after arrival',
      'wrong-route',
      (input: Evidence) => {
        sample(input, 340).route = input.plan.scopes.channel.route;
      },
    ],
    [
      'two exposed stacked lists',
      'ambiguous-active-list',
      (input: Evidence) => {
        sample(input, 3200).lists.push(
          structuredClone(sample(input, 400).lists[0])
        );
      },
    ],
    [
      'loading reappears after ready',
      'loading-after-reveal',
      (input: Evidence) => {
        sample(input, 3200).lists = [];
        sample(input, 3200).loadingCount = 1;
      },
    ],
    [
      'loading covers ready content',
      'loading-over-content',
      (input: Evidence) => {
        sample(input, 3200).loadingCount = 1;
      },
    ],
    [
      'wrong baseline scope',
      'wrong-baseline-route',
      (input: Evidence) => {
        sample(input, 40).route = '/unrelated';
      },
    ],
  ] as const)(
    'rejects %s even when the final frame is correct',
    (_name, code, mutate) => {
      const input = evidence();
      mutate(input);
      expect(codes(input)).toContain(code);
      expect(assess(input).verdict).toBe('FAIL');
    }
  );
  it.each([
    [
      'sample gap',
      'sample-gap',
      (input: Evidence) => {
        input.trace.samples = input.trace.samples.filter(
          (item) => item.time < 3100 || item.time > 3300
        );
      },
    ],
    [
      'slow measurement',
      'invalid-sample',
      (input: Evidence) => {
        sample(input, 3200).durationMs = 50;
      },
    ],
    [
      'hidden document',
      'document-hidden',
      (input: Evidence) => {
        sample(input, 3200).documentVisible = false;
      },
    ],
    [
      'lost command',
      'command-count',
      (input: Evidence) => {
        input.trace.commands.pop();
      },
    ],
    [
      'missing delivery',
      'delivery-count',
      (input: Evidence) => {
        input.trace.events.pop();
      },
    ],
    [
      'extra delivery',
      'delivery-count',
      (input: Evidence) => {
        input.trace.events.push(structuredClone(input.trace.events[1]));
      },
    ],
    [
      'untrusted delivery',
      'invalid-delivery',
      (input: Evidence) => {
        input.trace.events[0].trusted = false;
      },
    ],
    [
      'wrong click target',
      'invalid-delivery',
      (input: Evidence) => {
        input.trace.events[0].texts = ['other'];
      },
    ],
    [
      'out-of-command delivery',
      'invalid-delivery',
      (input: Evidence) => {
        input.trace.events[0].time = 220;
      },
    ],
    [
      'delayed event observation',
      'invalid-delivery',
      (input: Evidence) => {
        input.trace.events[0].observedAt = 450;
      },
    ],
    [
      'missing quiet tail',
      'missing-quiet-tail',
      (input: Evidence) => {
        input.trace.end = 3000;
        input.trace.samples = input.trace.samples.filter(
          (item) => item.time <= 3000
        );
      },
    ],
    [
      'end coverage loss',
      'capture-boundary-gap',
      (input: Evidence) => {
        input.trace.samples = input.trace.samples.filter(
          (item) => item.time < 4300
        );
      },
    ],
    [
      'declared after capture',
      'invalid-trace',
      (input: Evidence) => {
        input.plan.declaredAt = 20;
      },
    ],
    [
      'missing collector',
      'collector-errors',
      (input: Evidence) => {
        input.trace.errors.push('observer detached');
      },
    ],
    [
      'loosened tolerance',
      'invalid-plan',
      (input: Evidence) => {
        input.plan.tolerancePx = 10;
      },
    ],
  ] as const)('keeps %s incomplete', (_name, code, mutate) => {
    const input = evidence();
    mutate(input);
    expect(codes(input)).toContain(code);
    expect(assess(input).verdict).toBe('INCOMPLETE');
  });
  it('retains a qualified position failure alongside a temporal gap', () => {
    const input = evidence();
    sample(input, 300).lists[0].bottomGap = 50;
    input.trace.samples = input.trace.samples.filter(
      (item) => item.time < 3100 || item.time > 3300
    );
    expect(assess(input).verdict).toBe('FAIL');
    expect(codes(input)).toEqual(
      expect.arrayContaining(['wrong-bottom-landing', 'sample-gap'])
    );
  });
  it('does not use a hidden stacked screen as replacement evidence', () => {
    const input = evidence();
    const hidden = structuredClone(sample(input, 400).lists[0]);
    hidden.exposed = false;
    sample(input, 3200).lists.push(hidden);
    expect(assess(input).verdict).toBe('PASS');
  });
  it('rejects an unlabelled blank first destination instead of treating it as loading', () => {
    const input = evidence();
    sample(input, 300).lists = [];
    expect(codes(input)).toContain('blank-content');
    expect(assess(input).verdict).toBe('FAIL');
  });
  it('keeps never-revealed loading incomplete and independently fails its deadline', () => {
    const input = evidence();
    for (const frame of input.trace.samples.filter(
      (item) => item.time >= 300 && item.time <= 2500
    )) {
      frame.lists = [];
      frame.loadingCount = 1;
    }
    expect(codes(input)).toEqual(
      expect.arrayContaining([
        'destination-reveal-unobserved',
        'loading-deadline',
      ])
    );
    expect(assess(input).verdict).toBe('FAIL');
  });
  it('fails a first reveal after its fixed completion deadline', () => {
    const input = evidence();
    for (const frame of input.trace.samples.filter(
      (item) => item.time >= 300 && item.time < 1300
    )) {
      frame.lists = [];
      frame.loadingCount = 1;
    }
    expect(codes(input)).toContain('first-reveal-deadline');
  });
  it('rejects ambiguous route ownership in the predeclared plan', () => {
    const input = evidence();
    input.plan.scopes.thread.route = input.plan.scopes.channel.route;
    expect(codes(input)).toContain('ambiguous-scope-routes');
  });
  it('fails closed on malformed raw samples without throwing', () => {
    const input = evidence();
    input.trace.samples[16] =
      null as unknown as ScrollNavigationTrace['samples'][number];
    expect(codes(input)).toContain('malformed-sample');
    expect(assess(input).verdict).toBe('INCOMPLETE');
  });
  it('keeps lost text acquisition incomplete instead of manufacturing a blank or position failure', () => {
    const input = evidence();
    sample(input, 3200).lists[0].rows[0].body = {
      count: 0,
      text: null,
      exposed: false,
      pointTop: null,
    };
    expect(codes(input)).toContain('text-acquisition-unavailable');
    expect(assess(input).verdict).toBe('INCOMPLETE');
  });
  it('keeps visible text with an unavailable list owner incomplete', () => {
    const input = evidence();
    sample(input, 3200).lists = [];
    sample(input, 3200).unattributedBodies = 1;
    expect(codes(input)).toContain('content-owner-unavailable');
    expect(assess(input).verdict).toBe('INCOMPLETE');
  });
  it('retains independently measured row drift when text ownership is unavailable', () => {
    const input = evidence();
    const row = sample(input, 3200).lists[0].rows[0];
    row.top += 20;
    row.body = { count: 0, text: null, exposed: false, pointTop: null };
    expect(codes(input)).toEqual(
      expect.arrayContaining([
        'text-acquisition-unavailable',
        'wrong-reading-landing',
      ])
    );
    expect(assess(input).verdict).toBe('FAIL');
  });
});

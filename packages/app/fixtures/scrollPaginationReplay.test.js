import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  paginationPlan,
  paginationTitle,
  paginationAttachment,
  replayPaginationEvidence,
} from '../../../scripts/scroll-stability-pagination-evidence.mjs';
import {
  assessWebEvidence,
  webScenarioRegistry,
} from '../../../scripts/scroll-stability-web-evidence.mjs';
import { seededEvidence } from './scrollSeededSessionTestData';

// Independent native-clock/request/query models; no browser or product claim.
function fixture() {
  const plan = paginationPlan('abcdef12'),
    timeOrigin = 1700000000000;
  const channel = 'chat/~zod/source',
    origin = 'http://localhost:3000';
  const scope = `/apps/groups/group/~zod%2Ffixture/channel/${encodeURIComponent(channel)}`;
  const endpoint = `${origin}/~/scry/channels/v5/${channel}/posts/`;
  const row = (sequence) => ({
    id: String(100000 + sequence),
    sequence,
    text: plan.corpus[sequence - 1],
  });
  const backendPost = (sequence) => ({
    seal: { id: row(sequence).id, seq: sequence },
    essay: { author: '~zod', content: [{ inline: [row(sequence).text] }] },
  });
  const body = (start, end) => ({
    posts: Object.fromEntries(
      Array.from({ length: end - start + 1 }, (_, i) => [
        row(start + i).id,
        backendPost(start + i),
      ])
    ),
  });
  const q = (time, status, fetchStatus, minimum = 91) => ({
    time,
    timeOrigin,
    scope,
    durationMs: 1,
    key: ['channelPosts', channel, null, false, timeOrigin],
    status,
    fetchStatus,
    failureCount: status === 'error' ? 5 : 0,
    pageParams: [{ mode: 'newest' }],
    rows: Array.from({ length: 121 - minimum }, (_, i) => row(120 - i)),
  });
  const requests = [120, 760, 1270, 1780, 2290, 3520].map((start, i) => ({
    url: endpoint + 'range/61/91/outline.json',
    method: 'GET',
    start,
    release: i === 0 ? 250 : i === 5 ? 3650 : start + 1,
    end: i === 0 ? 255 : i === 5 ? 3700 : start + 5,
    outcome: i < 5 ? 'aborted' : 'continued',
    ...(i === 5 ? { status: 200, body: body(61, 91) } : {}),
  }));
  const phase = (start, terminal) => {
    const template = seededEvidence().blocks[0];
    const contract = structuredClone(template.readingContract);
    Object.assign(contract, {
      scope,
      rowId: row(100).id,
      revision: { id: 'unchanged', text: row(100).text },
      terminalTime: terminal,
    });
    contract.coverage = {
      startTime: start,
      endTime: terminal + 1000,
      maxGapMs: 100,
      maxMeasurementDurationMs: 32,
    };
    const sample = structuredClone(template.reading.samples[0]);
    Object.assign(sample, { scope, rowId: row(100).id, text: row(100).text });
    sample.list.rect.height = sample.list.clip.height = 60;
    sample.list.rect.bottom = sample.list.clip.bottom = 70;
    sample.nodes[0].text = row(100).text;
    sample.nodes[0].end = row(100).text.length;
    sample.point.text = row(100).text.slice(2, 3);
    const times = [];
    for (let time = start; time <= terminal + 1000; time += 50)
      times.push(time);
    if (times.at(-1) !== terminal + 1000) times.push(terminal + 1000);
    return {
      contract,
      raw: {
        ...structuredClone(template.reading),
        marks: [{ id: 'terminal-ready', time: terminal }],
        samples: times.map((time) => ({ ...structuredClone(sample), time })),
      },
    };
  };
  const proof = {
    assets: 'Vite development assets',
    plan,
    channel,
    session: {
      origin,
      scope,
      ship: 'zod',
      e2eMode: false,
      timeOrigin,
      time: 20,
      headed: false,
      viewport: { width: 1280, height: 800 },
    },
    freshContext: { storage: 'cookies-and-localStorage-only' },
    backend: {
      url: endpoint + 'newest/150/post.json',
      status: 200,
      startWall: timeOrigin - 100,
      endWall: timeOrigin - 50,
      body: body(1, 120),
    },
    before: q(10, 'success', 'idle'),
    failed: q(2320, 'error', 'idle'),
    retryPending: q(3560, 'error', 'fetching'),
    after: q(3750, 'success', 'idle', 61),
    requests,
    moves: [
      { kind: 'initial', start: 100, end: 150 },
      { kind: 'away', start: 3400, end: 3440, offset: 900, height: 800 },
      { kind: 'retry', start: 3500, end: 3550 },
    ],
    observer: {
      errors: [],
      wheel: [
        { time: 110, observedAt: 111, deltaY: -2400 },
        { time: 3410, observedAt: 3411, deltaY: 1600 },
        { time: 3510, observedAt: 3511, deltaY: -1600 },
      ].map((e) => ({ ...e, trusted: true, sameList: true, scope })),
      frames: Array.from({ length: 245 }, (_, i) => ({
        time: 20 + i * 20,
        duration: 1,
        scope,
        height: 800,
        neighbors: [
          { id: row(99).id, top: 100, height: 100 },
          { id: row(100).id, top: 200, height: 100 },
        ],
      })),
    },
    phases: [phase(200, 2350), phase(3600, 3800)],
    errors: [],
    cleanup: { gatesReleased: true, contextClosed: true },
  };
  return {
    proof,
    attempt: {
      title: paginationTitle,
      startTime: new Date(timeOrigin - 1000).toISOString(),
      duration: 7000,
    },
  };
}
const replay = (f) => replayPaginationEvidence(f.proof, f.attempt);
describe('pagination fixed raw proof', () => {
  it('admits only the retained failure train, real boundary retry and exact prepend', () => {
    const result = replay(fixture());
    expect(result.issues).toEqual([]);
    expect(result.verdict).toBe('PASS');
    expect(result.presentedFrames).toBe('INCOMPLETE');
  });
  it.each([
    'foreign range',
    'missing failure',
    'programmatic retry',
    'missing response',
    'late baseline',
    'acquisition gap',
    'cleanup omitted',
  ])('%s is incomplete', (fault) => {
    const f = fixture(),
      p = f.proof;
    if (fault === 'foreign range')
      p.requests[5].url = p.requests[5].url.replace('/61/91/', '/31/61/');
    if (fault === 'missing failure') p.requests.splice(3, 1);
    if (fault === 'programmatic retry') p.observer.wheel.pop();
    if (fault === 'missing response') delete p.requests[5].body;
    if (fault === 'late baseline')
      p.phases[1].contract.coverage.startTime = 3660;
    if (fault === 'acquisition gap') p.phases[1].raw.samples.splice(2, 4);
    if (fault === 'cleanup omitted') delete p.cleanup;
    expect(replay(f).verdict).toBe('INCOMPLETE');
  });
  it.each([
    'duplicate query row',
    'wrong text',
    'wrong response row',
    'blank valid frame',
    'reading drift',
  ])('%s is a qualified failure', (fault) => {
    const f = fixture(),
      p = f.proof;
    if (fault === 'duplicate query row')
      p.after.rows[1] = structuredClone(p.after.rows[0]);
    if (fault === 'wrong text') p.after.rows[0].text = 'Foreign text';
    if (fault === 'wrong response row')
      p.requests[5].body.posts['100061'].essay.content[0].inline = [
        'Wrong content',
      ];
    if (fault === 'blank valid frame') p.observer.frames[100].neighbors = [];
    if (fault === 'reading drift')
      p.phases[1].raw.samples[3].point.relativeY += 8;
    expect(replay(f).verdict).toBe('FAIL');
  });
  it('does not use a slow frame to certify a blank and preserves an earlier valid failure', () => {
    const f = fixture();
    f.proof.observer.frames[100].duration = 40;
    f.proof.observer.frames[100].neighbors = [];
    expect(replay(f).verdict).toBe('INCOMPLETE');
    f.proof.observer.frames[50].neighbors = [];
    expect(replay(f).verdict).toBe('FAIL');
  });
  it('rejects unavailable neighbor geometry without certifying failure', () => {
    const f = fixture();
    f.proof.observer.frames[100].neighbors[0].height = NaN;
    expect(replay(f).verdict).toBe('INCOMPLETE');
  });
  it('rejects a production declaration without delivered asset proof', () => {
    const f = fixture();
    f.proof.assets = 'Built production assets';
    expect(replay(f).verdict).toBe('INCOMPLETE');
  });
  it('does not qualify geometry outside the enclosing attempt', () => {
    const f = fixture();
    f.proof.observer.frames.push({
      ...structuredClone(f.proof.observer.frames.at(-1)),
      time: 6100,
      neighbors: [],
    });
    expect(replay(f).verdict).toBe('INCOMPLETE');
    f.proof.observer.frames[50].neighbors = [];
    expect(replay(f).verdict).toBe('FAIL');
  });
  it('requires the full declared tail inside the actual attempt', () => {
    const f = fixture();
    f.attempt.duration = 5500;
    expect(replay(f).verdict).toBe('INCOMPLETE');
  });
  it('rejects a post-attempt raw point without manufacturing a drift failure', () => {
    const f = fixture();
    const sample = structuredClone(f.proof.phases[1].raw.samples.at(-1));
    sample.time = 6100;
    sample.point.relativeY += 8;
    f.proof.phases[1].raw.samples.push(sample);
    expect(replay(f).verdict).toBe('INCOMPLETE');
  });
  it('forces the exact registered proof even if its contract flag is forged', () => {
    const f = fixture(),
      contract = webScenarioRegistry.find(
        (r) => r.scenario === 'web-pagination-retry'
      );
    const record = {
      scenario: contract.scenario,
      title: paginationTitle,
      contract,
      reportedStatus: 'passed',
      expectedStatus: 'passed',
      browserTraces: [],
      attemptStartTime: f.attempt.startTime,
      attemptWallEndTime: Date.parse(f.attempt.startTime) + f.attempt.duration,
      paginationProofs: [{ name: paginationAttachment, value: f.proof }],
    };
    expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
    record.contract = { ...contract, requirePaginationProof: false };
    record.paginationProofs = [];
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
});

async function actualGate() {
  const ts = await import('typescript');
  const source = readFileSync(
    resolve(
      import.meta.dirname,
      '../../../apps/tlon-web/e2e/helpers/scrollerPaginationScenario.ts'
    ),
    'utf8'
  );
  const ast = ts.createSourceFile(
    'helper.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const node = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'holdPaginationRetry'
  );
  const js = ts.transpileModule(node.getText(ast), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  let clock = 0;
  new Function('exports', 'now', js)(exports, async () => ++clock);
  let handler;
  const calls = [],
    requests = [],
    url = 'http://localhost:3000/exact-range';
  const page = {
    route: async (_, fn) => {
      handler = fn;
    },
    unroute: async () => {
      calls.push('unroute');
    },
    waitForTimeout: () => new Promise(() => {}),
  };
  const gate = await exports.holdPaginationRetry(page, url, requests);
  const dispatch = (target = url) =>
    handler({
      request: () => ({
        url: () => target,
        method: () => 'GET',
        response: async () => ({
          finished: async () => null,
          status: () => 200,
          json: async () => ({ original: true }),
        }),
      }),
      abort: async (code) => calls.push(`abort:${code}`),
      continue: async () => calls.push(`continue:${target}`),
    });
  return { gate, dispatch, calls, requests };
}
describe('actual original request gate', () => {
  it('holds first/sixth, aborts exactly five and continues the unchanged sixth body', async () => {
    const o = await actualGate();
    const first = o.dispatch();
    await Promise.resolve();
    expect(o.calls).toEqual([]);
    o.gate.releaseFailure();
    await first;
    for (let i = 1; i < 5; i++) await o.dispatch();
    const sixth = o.dispatch();
    await Promise.resolve();
    expect(o.calls).toHaveLength(5);
    o.gate.releaseSuccess();
    await sixth;
    expect(o.calls.filter((c) => c === 'abort:failed')).toHaveLength(5);
    expect(o.requests[5].body).toEqual({ original: true });
    await o.gate.cleanup();
  });
  it('continues foreign requests without counting or failing them', async () => {
    const o = await actualGate();
    await o.dispatch('http://localhost:3000/foreign');
    expect(o.requests).toEqual([]);
    expect(o.calls).toEqual(['continue:http://localhost:3000/foreign']);
    await o.gate.cleanup();
  });
  it('cleanup releases an original held request without injecting a failure', async () => {
    const o = await actualGate();
    const pending = o.dispatch();
    await Promise.resolve();
    await o.gate.cleanup();
    await pending;
    expect(o.requests[0].outcome).toBe('cleanup');
    expect(o.calls.some((c) => c.startsWith('abort:'))).toBe(false);
  });
});

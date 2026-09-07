import { describe, expect, it } from 'vitest';
import {
  navigationScenarioRegistry,
  replayWebNavigation,
} from '../../../scripts/scroll-stability-navigation-replay.mjs';
import { evidence as pendingEvidence } from './scrollNavigationPendingTestData';

function record() {
  const channelRows = Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [`c${i}`, `Channel ${i} `])
  );
  const threadRows = {
    c0: channelRows.c0,
    ...Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [`t${i}`, `Reply ${i} `])
    ),
  };
  const baseline = { rowId: 'c0', top: 100, pointTop: 120, bottomGap: 1000 };
  const plan = {
    version: 1,
    declaredAt: 1000,
    initial: 'channel',
    scopes: {
      channel: {
        route: '/channel/a',
        kind: 'channel',
        rows: channelRows,
        landing: { kind: 'anchor', rowId: 'c0', top: 100, pointTop: 120 },
      },
      thread: {
        route: '/channel/a/thread/t',
        kind: 'thread',
        rows: threadRows,
        landing: { kind: 'bottom', newestId: 't17' },
      },
    },
    commands: [
      {
        id: 'open-thread',
        from: 'channel',
        to: 'thread',
        trigger: { kind: 'click', text: '18 replies' },
      },
      {
        id: 'return-channel',
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
  const raw = {
    start: 1020,
    end: 5520,
    errors: [],
    commands: [
      { id: 'open-thread', start: 1260, end: 1280 },
      { id: 'return-channel', start: 3520, end: 3540 },
    ],
    events: [
      {
        time: 1270,
        observedAt: 1270,
        kind: 'click',
        trusted: true,
        texts: ['18 replies'],
        testIds: [],
      },
      {
        time: 3530,
        observedAt: 3530,
        kind: 'popstate',
        trusted: true,
        texts: [],
        testIds: [],
      },
    ],
    samples: Array.from({ length: 226 }, (_, i) => {
      const time = 1020 + i * 20,
        thread = time >= 1320 && time < 3580;
      return {
        time,
        durationMs: 1,
        documentVisible: true,
        route: plan.scopes[thread ? 'thread' : 'channel'].route,
        loadingCount: 0,
        unattributedBodies: 0,
        lists: [
          {
            identity: thread ? 2 : 1,
            kind: thread ? 'thread' : 'channel',
            exposed: true,
            height: 500,
            bottomGap: thread ? 0 : 1000,
            rows: [
              {
                id: thread ? 't17' : 'c0',
                top: thread ? 450 : 100,
                bottom: thread ? 500 : 160,
                exposed: true,
                body: {
                  count: 1,
                  exposed: true,
                  text: thread ? threadRows.t17 : channelRows.c0,
                  pointTop: thread ? 460 : 120,
                },
              },
            ],
          },
        ],
      };
    }),
  };
  const preparation = {
    origin: 'http://localhost:3000',
    route: '/channel/a',
    channelRoute: '/channel/a',
    threadRoute: '/channel/a/thread/t',
    ship: 'zod',
    normalFlags: true,
    developmentAssets: true,
    headed: true,
    browser: '136.0',
    viewport: { width: 1280, height: 800 },
    declaredAt: 1000,
    baseline,
    channelRows,
    threadRows,
    frameTimes: Array.from({ length: 60 }, (_, i) => i * 16),
  };
  return {
    scenario: navigationScenarioRegistry[0].scenario,
    contract: structuredClone(navigationScenarioRegistry[0]),
    attemptStartTime: '2026-09-07T00:00:00Z',
    attemptDurationMs: 10000,
    navigationProofs: [
      { name: 'navigation-preparation', value: preparation },
      { name: 'navigation-plan', value: plan },
      { name: 'navigation-raw', value: raw },
    ],
  };
}
const value = (input, name) =>
  input.navigationProofs.find((item) => item.name === name).value;

function pendingRecord(kind) {
  const { trace: raw, plan, proof } = pendingEvidence(kind);
  const registry = navigationScenarioRegistry.find(
    (entry) => entry.navigationKind === kind
  );
  const epoch = Date.parse('2026-09-07T00:00:00Z');
  const anchor = '100.099';
  const channelRows = {
    [anchor]: 'Reader text',
    ...Object.fromEntries(
      Array.from({ length: 23 }, (_, i) => [
        `300.${String(i).padStart(3, '0')}`,
        `Other text ${i}`,
      ])
    ),
  };
  plan.scopes.channel.rows = channelRows;
  plan.scopes.channel.landing.rowId = anchor;
  plan.declaredAt += 1020;
  raw.start += 1020;
  raw.end += 1020;
  raw.samples.forEach((frame) => {
    frame.time += 1020;
    frame.lists.forEach((list) =>
      list.rows.forEach((row) => {
        if (row.id !== 'reader') return;
        row.id = anchor;
        if (kind === 'missing-parent') {
          row.body.count = 2;
          row.body.pointBlockIndex = 1;
          row.body.blocks = [
            { text: 'Reply 7', exposed: true },
            { text: 'Reader text', exposed: true },
          ];
        }
      })
    );
  });
  raw.events.forEach((event) => {
    event.time += 1020;
    event.observedAt += 1020;
  });
  raw.commands.forEach((command) => {
    command.start += 1020;
    command.end += 1020;
  });
  const triggerText = kind === 'missing-parent' ? 'Reply 7' : '18 replies';
  plan.commands[0].trigger =
    kind === 'missing-parent'
      ? { kind: 'click', reference: { rowId: anchor, text: triggerText } }
      : { kind: 'click', text: triggerText };
  raw.events[0].texts =
    kind === 'missing-parent' ? ['Chat author Reply 7'] : [triggerText];
  if (kind === 'missing-parent')
    raw.events[0].reference = {
      rowId: anchor,
      frameCount: 1,
      texts: [triggerText],
    };
  if (kind === 'missing-parent')
    plan.scopes.channel.textBlocks = { [anchor]: ['Reply 7', 'Reader text'] };
  proof.before.time += 1020;
  proof.local.time += 1020;
  proof.backend.requestedAt += epoch;
  proof.backend.completedAt += epoch;
  proof.freshContext.createdAt += epoch;
  proof.requests.forEach((request) => {
    request.interceptedTime += 1020;
    request.releasedTime += 1020;
    request.completedTime += 1020;
    request.interceptedAt += epoch;
    request.releasedAt += epoch;
    request.completedAt += epoch;
  });
  const readerBackend = {
    method: 'GET',
    status: 200,
    completedAt: epoch + 1100,
    body: {
      posts: Object.fromEntries(
        Object.entries(channelRows).map(([id, text]) => [
          id,
          {
            seal: { id: id.replaceAll('.', '') },
            essay: {
              content: [
                ...(id === anchor && kind === 'missing-parent'
                  ? [
                      {
                        block: {
                          cite: {
                            chan: {
                              nest: proof.sourceChannel,
                              where: `/msg/${proof.parentId}/${proof.referenceReplyId}`,
                            },
                          },
                        },
                      },
                    ]
                  : []),
                { inline: [text] },
              ],
            },
          },
        ])
      ),
    },
  };
  return {
    scenario: registry.scenario,
    contract: structuredClone(registry),
    attemptStartTime: '2026-09-07T00:00:00Z',
    attemptDurationMs: 10000,
    navigationProofs: [
      {
        name: 'navigation-preparation',
        value: {
          origin: 'http://localhost:3000',
          route: plan.scopes.channel.route,
          channelRoute: plan.scopes.channel.route,
          threadRoute: plan.scopes.thread.route,
          ship: 'zod',
          normalFlags: true,
          developmentAssets: true,
          headed: true,
          browser: '136.0',
          viewport: { width: 1280, height: 800 },
          declaredAt: plan.declaredAt,
          baseline: { rowId: anchor, top: 100, pointTop: 120, bottomGap: 1000 },
          channelRows,
          threadRows: plan.scopes.thread.rows,
          readerBackend,
          frameTimes: Array.from({ length: 60 }, (_, i) => i * 16),
        },
      },
      { name: 'navigation-plan', value: plan },
      { name: 'navigation-raw', value: raw },
      { name: 'navigation-pending', value: proof },
    ],
  };
}

describe('navigation importer boundary controls', () => {
  it.each(['reply-sync', 'missing-parent'])(
    'replays the complete %s transport and DOM dimensions',
    (kind) => {
      expect(replayWebNavigation(pendingRecord(kind))).toEqual([]);
    }
  );
  it.each([
    [
      'missing held-request proof',
      (input) => {
        input.navigationProofs.pop();
      },
    ],
    [
      'wrong pending scenario',
      (input) => {
        value(input, 'navigation-pending').kind = 'reply-sync';
      },
    ],
    [
      'duplicate held-request proof',
      (input) => {
        input.navigationProofs.push(input.navigationProofs.at(-1));
      },
    ],
    [
      'wrong committed citation',
      (input) => {
        value(input, 'navigation-preparation').readerBackend.body.posts[
          '100.099'
        ].essay.content[0].block.cite.chan.where = '/msg/other';
      },
    ],
    [
      'late replayed response',
      (input) => {
        value(input, 'navigation-pending').requests[0].completedAt += 999999;
      },
    ],
  ])('rejects %s in the independent pending importer', (_name, mutate) => {
    const input = pendingRecord('missing-parent');
    mutate(input);
    expect(replayWebNavigation(input).length).toBeGreaterThan(0);
  });
  it('retains the actual blank failure even with a valid pending original GET', () => {
    const input = pendingRecord('missing-parent');
    value(input, 'navigation-raw').samples[16].loadingCount = 0;
    expect(replayWebNavigation(input)).toContainEqual({
      message: 'Navigation: blank-content at sample 16',
      kind: 'failure',
    });
  });
  it('replays complete raw evidence without reading a producer assessment', () => {
    const input = record();
    input.navigationProofs.push({
      name: 'navigation-assessment',
      value: { verdict: 'FAIL' },
    });
    expect(replayWebNavigation(input)).toEqual([]);
  });
  it.each([
    [
      'missing raw',
      (r) => {
        r.navigationProofs = r.navigationProofs.filter(
          (p) => p.name !== 'navigation-raw'
        );
      },
    ],
    [
      'duplicate raw',
      (r) => {
        r.navigationProofs.push(r.navigationProofs[2]);
      },
    ],
    [
      'corrupt raw',
      (r) => {
        r.navigationProofs[2].error = 'invalid JSON';
      },
    ],
    [
      'weakened registry',
      (r) => {
        r.contract.scope = 'anything';
      },
    ],
    [
      'test flags',
      (r) => {
        value(r, 'navigation-preparation').normalFlags = false;
      },
    ],
    [
      'wrong corpus',
      (r) => {
        value(r, 'navigation-preparation').channelRows = { wrong: 'text' };
      },
    ],
    [
      'missing enclosing attempt',
      (r) => {
        delete r.attemptStartTime;
      },
    ],
    [
      'short enclosing attempt',
      (r) => {
        r.attemptDurationMs = 1;
      },
    ],
    [
      'dropped command',
      (r) => {
        value(r, 'navigation-plan').commands.pop();
      },
    ],
    [
      'wrong destination',
      (r) => {
        value(r, 'navigation-raw').samples[100].route = '/other';
      },
    ],
    [
      'wrong first landing',
      (r) => {
        value(r, 'navigation-raw').samples[15].lists[0].bottomGap = 60;
      },
    ],
  ])('rejects %s despite an attached PASS', (_name, mutate) => {
    const input = record();
    mutate(input);
    input.navigationProofs.push({
      name: 'navigation-assessment',
      value: { verdict: 'PASS' },
    });
    expect(replayWebNavigation(input).length).toBeGreaterThan(0);
  });
  it('keeps a missed cancellation incomplete', () => {
    const input = record();
    input.scenario = navigationScenarioRegistry[1].scenario;
    input.contract = structuredClone(navigationScenarioRegistry[1]);
    value(input, 'navigation-plan').commands[1].cancels = 'open-thread';
    expect(replayWebNavigation(input)).toContainEqual({
      message: 'Navigation: cancellation-not-before-reveal',
      kind: 'incomplete',
    });
  });
});

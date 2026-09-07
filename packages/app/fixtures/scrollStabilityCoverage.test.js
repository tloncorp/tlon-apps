import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assessScrollTrace } from './scrollStabilityTrace';
import { adaptNativeScrollGeometry } from './scrollNativeGeometry';
import { assessNativeEvidence } from '../../../scripts/scroll-stability-native-evidence.mjs';
import { rowMutationContractFingerprint } from './scrollStabilityMutation';

import {
  classifyEvidence,
  coverageReportExitCode,
  createCoverageReport,
  parseScenarioIds,
  qualifyEvidence,
  scenarioRegistry,
} from '../../../scripts/scroll-stability-report.mjs';
import {
  assessWebEvidence,
  readPlaywrightReport,
  webScenarioRegistry,
} from '../../../scripts/scroll-stability-web-evidence.mjs';

const input = {
  matrixMarkdown: '| ENT-01 | Entry |\n| THR-01 | Threads |',
  historyMarkdown: '| REG-001 · ENT | Old failure |',
  registry: [
    {
      scenario: 'entry-latest',
      matrix: ['ENT-01'],
      history: ['REG-001'],
      scope: 'One loaded entry variant',
    },
  ],
};
const passedTrace = () => {
  const samples = Array.from({ length: 57 }, (_, index) => ({
    time: index * 50,
    scroll: 900,
    contentLength: 1000,
    viewportHeight: 100,
    viewportTop: 10,
    viewportBottom: 110,
    keyboardHeight: 0,
    nearEnd: true,
    rows: [{ key: 'scroll-fixture-119', y: 70, height: 40 }],
    scrollBounds: { min: 0, max: 900 },
    measurement: { valid: true, durationMs: 1 },
  }));
  return {
    scenario: 'entry-latest',
    fixtureVersion: 2,
    platform: 'ios',
    assertion: 'bottom',
    assertionSchemaVersion: 1,
    followingOffsetThroughout: false,
    emptyEndThroughout: false,
    baselinePreconditions: {
      requireHistory: false,
      requireInitialEnd: false,
      requireReadingAnchor: false,
      excludedAnchorKeys: [],
      allowEmptyEnd: false,
    },
    baseline: samples[0],
    samples,
    events: [
      { time: 0, name: 'reset', values: { mode: 'latest' } },
      { time: 1, name: 'list-attached' },
      { time: 10, name: 'row-commit', values: { key: 'scroll-fixture-119' } },
      { time: 50, name: 'entry-state', values: { ready: true, count: 90 } },
    ],
    committedDataKeys: Array.from(
      { length: 90 },
      (_, index) => `scroll-fixture-${index + 30}`
    ),
    expectations: {
      action: {
        name: 'entry-latest',
        startedAt: 0,
        completedAt: 100,
        observed: true,
      },
      coverage: { startTime: 0, endTime: 2800 },
      requireMeasurementMetadata: true,
      bottom: { startTime: 200, tailKey: 'scroll-fixture-119' },
    },
    result: {
      verdict: 'PASS',
      passed: true,
      evidenceLevel: 'sampled-geometry',
      nativeFrames: 'INCOMPLETE',
      issues: [],
      metrics: {
        samples: samples.length,
        maxSampleGapMs: 50,
        maxAnchorDriftPt: 0,
        maxBottomDistancePt: 0,
        maxLandingErrorPt: 0,
        blankSamples: 0,
      },
    },
  };
};

const defaultWebCase = webScenarioRegistry.find(
  (item) => item.scenario === 'web-channel-send-history'
);

const strictNativeMutation = () => {
  const trace = passedTrace();
  const scope = 'channel-A/view-1';
  const before = { content: 'before', reactions: '[]', replies: '0' };
  const after = { ...before, content: 'after' };
  trace.scenario = 'history-grow';
  trace.assertion = 'hold';
  trace.mutationScope = scope;
  trace.expectations.action = {
    name: trace.scenario,
    startedAt: 200,
    completedAt: 220,
    observed: true,
  };
  delete trace.expectations.bottom;
  trace.expectations.anchor = { key: 'scroll-fixture-119', baselineY: 70 };
  trace.baselinePreconditions = {
    requireHistory: true,
    requireInitialEnd: false,
    requireReadingAnchor: true,
    readingAnchorKey: 'scroll-fixture-119',
    excludedAnchorKeys: ['target'],
    allowEmptyEnd: false,
  };
  trace.samples.forEach((sample) => {
    sample.scroll = 100;
    sample.nearEnd = false;
    sample.rows.push({
      key: 'target',
      y: 20,
      height: sample.time < 250 ? 30 : 45,
    });
  });
  const contract = {
    version: 1,
    scope,
    key: 'target',
    kind: 'grow',
    declaredAt: 100,
    baseline: {
      requestId: 'initial',
      revision: 'r0',
      state: { presence: 'present', signature: before },
    },
    coverage: {
      startTime: 0,
      endTime: 2800,
      maxGapMs: 125,
      maxMeasurementDurationMs: 32,
    },
    deferredUntil: 1800,
    phases: [
      {
        id: 'grown',
        requestId: 'grow-1',
        revision: 'r1',
        state: { presence: 'present', signature: after },
        requestWindow: { startTime: 200, endTime: 220 },
        observationWindow: { startTime: 300, endTime: 2800 },
        effect: 'resize',
      },
    ],
  };
  const baselineOwnership = {
    scope,
    key: 'target',
    requestId: 'initial',
    revision: 'r0',
    commitId: 'baseline-commit',
  };
  const changedOwnership = {
    scope,
    key: 'target',
    requestId: 'grow-1',
    revision: 'r1',
    commitId: 'grown-commit',
  };
  trace.events = [
    {
      time: -10,
      name: 'row-commit',
      values: { ...baselineOwnership, ...before },
    },
    {
      time: 100,
      name: 'row-mutation-plan',
      values: { contract: rowMutationContractFingerprint(contract) },
    },
    {
      time: 210,
      name: 'row-mutation-request',
      values: { ...changedOwnership, kind: 'grow', phaseId: 'grown' },
    },
    {
      time: 250,
      name: 'row-commit',
      values: { ...changedOwnership, ...after },
    },
    {
      time: 270,
      name: 'row-layout',
      values: { ...changedOwnership, height: 45 },
    },
  ];
  trace.committedDataKeys = ['target', 'scroll-fixture-119'];
  trace.mutationEvidence = {
    events: trace.events,
    samples: trace.samples,
    committedKeys: trace.committedDataKeys,
    contract,
    semanticSamples: trace.samples.map((sample) => ({
      time: sample.time,
      scope,
      key: 'target',
      ...(sample.time < 250 ? baselineOwnership : changedOwnership),
      state: {
        presence: 'present',
        signature: structuredClone(sample.time < 250 ? before : after),
      },
      committedKeys: [...trace.committedDataKeys],
      measurement: { valid: true, durationMs: 1 },
    })),
  };
  trace.result = assessScrollTrace(trace.samples, trace.expectations);
  trace.mutationWitness = { observed: true, verdict: 'PASS', reasons: [] };
  return trace;
};
const syncNativeMutation = (trace) => {
  Object.assign(trace.mutationEvidence, {
    events: trace.events,
    samples: trace.samples,
    committedKeys: trace.committedDataKeys,
  });
};
const browserTrace = (name) => ({
  errors: [],
  frames: Array.from({ length: 80 }, (_, index) => ({
    time: index * 16,
    scrollTop: ['send-from-history', 'latest-button'].includes(name)
      ? Math.min(900, 800 + index * 16)
      : 900,
    scrollHeight: 1000,
    clientHeight: 100,
    viewportTop: 10,
    viewportBottom: 110,
    bottomGap: ['send-from-history', 'latest-button'].includes(name)
      ? Math.max(0, 100 - index * 16)
      : 0,
    anchors: { witness: { top: 30, bottom: 70, height: 40 } },
  })),
  marks: [
    { label: `${name}:start`, time: 5 },
    { label: `${name}:terminal-state`, time: 100 },
  ],
});
const browserAttempt = (contract = defaultWebCase, change = {}) => ({
  status: 'passed',
  retry: 0,
  attachments: contract.traceNames.map((name) => ({
    name,
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(browserTrace(name))).toString('base64'),
  })),
  ...change,
});
const browserReport = (
  attempts,
  contract = defaultWebCase,
  suite = contract.suite
) => ({
  stats: { startTime: '2026-09-06T00:00:00Z' },
  suites: [
    {
      title: 'scroller-stability.spec.ts',
      suites: [
        {
          title: suite,
          specs: [
            {
              title: contract.title,
              id: contract.scenario,
              file: 'scroller-stability.spec.ts',
              tests: [
                {
                  projectName: 'chromium',
                  expectedStatus: 'passed',
                  results: attempts,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
const webInput = (contract = defaultWebCase) => ({
  matrixMarkdown: contract.matrix
    .map((id) => `| ${id} | scenario |`)
    .join('\n'),
  historyMarkdown: [...new Set(['REG-001', ...contract.history])]
    .map((id) => `| ${id} · WEB | history |`)
    .join('\n'),
  registry: [contract],
});

const latestControlEvidence = (motion = 'normal') => {
  const registry = webScenarioRegistry.find(
    (item) => item.scenario === `web-latest-control-${motion}`
  );
  const cycles = registry.traceNames.map((name, cycle) => {
    const offset = cycle * 3000;
    const phase = (id, start, end, visibility) => ({
      id,
      startTime: offset + start,
      endTime: offset + end,
      loading: false,
      semanticState: 'list-visible',
      controls: [{ id: 'latest', kind: 'icon', visibility }],
    });
    const geometry = browserTrace('latest-button');
    geometry.frames.forEach((frame) => {
      frame.time += offset + 800;
    });
    geometry.marks = [
      { label: `${name}:start`, time: offset + 805 },
      { label: `${name}:terminal-state`, time: offset + 1050 },
    ];
    const proof = {
      trace: {
        errors: [],
        samples: Array.from({ length: 46 }, (_, index) => {
          const time = index * 50;
          const fade =
            time < 250
              ? 0
              : time < 500
                ? (time - 250) / 250
                : time < 850
                  ? 1
                  : time < 1050
                    ? (1050 - time) / 200
                    : 0;
          const opacity =
            motion === 'reduced' ? Number(time >= 300 && time < 850) : fade;
          return {
            time: offset + time,
            scope: '/channels/chat/~zod/general',
            loading: false,
            semanticState: 'list-visible',
            controls: [
              {
                id: 'latest',
                scope: '/channels/chat/~zod/general',
                kind: 'icon',
                visible: opacity > 0,
                opacity,
              },
            ],
            measurement: { valid: true, durationMs: 1 },
          };
        }),
        actions: [
          {
            id: 'press-latest',
            scope: '/channels/chat/~zod/general',
            time: offset + 825,
          },
        ],
        marks: [
          { id: 'reveal-request', time: offset + 250 },
          { id: 'history-window', time: offset + 500 },
          { id: 'press-request', time: offset + 800 },
          {
            id: 'hide-eligibility',
            time: offset + 850,
            pointerEvents: 'none',
            sameControl: true,
            scope: '/channels/chat/~zod/general',
          },
          { id: 'landed-window', time: offset + 1050 },
          { id: 'terminal-ready', time: offset + 1050 },
        ],
      },
      contract: {
        scope: '/channels/chat/~zod/general',
        coverage: {
          startTime: offset,
          endTime: offset + 2050,
          maxGapMs: 100,
          maxMeasurementDurationMs: 32,
        },
        action: {
          id: 'press-latest',
          startTime: offset + 800,
          endTime: offset + 1050,
        },
        phases: [
          phase('at-end', 0, 250, 'hidden'),
          phase('in-history', 500, 800, 'visible'),
          phase('landed', 1050, 2050, 'hidden'),
        ],
        transitions: [
          {
            from: 'at-end',
            to: 'in-history',
            startTime: offset + 250,
            endTime: offset + 500,
            opacity: motion === 'reduced' ? 'instant' : 'monotonic',
          },
          {
            from: 'in-history',
            to: 'landed',
            startTime: offset + 800,
            endTime: offset + 1050,
            opacity: motion === 'reduced' ? 'instant' : 'monotonic',
          },
        ],
      },
    };
    return { name, geometry, proof };
  });
  return { registry, cycles };
};
const latestControlAttempt = ({ registry, cycles }) =>
  browserAttempt(registry, {
    attachments: cycles.flatMap(({ name, geometry, proof }) =>
      [
        [name, geometry],
        [`${name}-chrome-proof`, proof],
      ]
        .filter(([, value]) => value !== undefined)
        .map(([attachmentName, value]) => ({
          name: attachmentName,
          contentType: 'application/json',
          body: Buffer.from(JSON.stringify(value)).toString('base64'),
        }))
    ),
  });
const assessLatestControl = (
  evidence,
  attempt = latestControlAttempt(evidence)
) =>
  assessWebEvidence(
    readPlaywrightReport(
      browserReport([attempt], evidence.registry),
      '/tmp/latest-control.json'
    )[0]
  );

describe('latest-control raw evidence replay (reporter controls, not browser proof)', () => {
  it.each(['normal', 'reduced'])(
    'requires both complete %s-motion cycles and keeps the scope partial',
    (motion) => {
      const evidence = latestControlEvidence(motion);
      expect(evidence.registry.matrix).toEqual([
        'CTL-02',
        'CTL-04',
        'CTL-06',
        'CTL-14',
      ]);
      expect(evidence.registry.traceNames).toEqual(
        [0, 1].map((cycle) => `latest-control-${motion}-${cycle}`)
      );
      expect(assessLatestControl(evidence)).toEqual({
        status: 'recorded-sampled-pass',
        issues: [],
      });
      const report = createCoverageReport({
        ...webInput(evidence.registry),
        evidence: [
          {
            source: '/tmp/latest-control.json',
            value: browserReport(
              [latestControlAttempt(evidence)],
              evidence.registry
            ),
          },
        ],
      });
      expect(report.counts.recordedSampledPasses).toBe(1);
      expect(report.fullMatrixVerified).toBe(false);
      expect(report.nativePresentation).toBe('INCOMPLETE');
    }
  );

  it.each([
    [
      'missing second chrome proof',
      (value) => {
        delete value.cycles[1].proof;
      },
    ],
    [
      'missing second geometry',
      (value) => {
        delete value.cycles[1].geometry;
      },
    ],
    [
      'missing contract',
      (value) => {
        delete value.cycles[0].proof.contract;
      },
    ],
    [
      'summary instead of raw samples',
      (value) => {
        value.cycles[0].proof.trace = { passed: true };
      },
    ],
    [
      'null sample',
      (value) => {
        value.cycles[0].proof.trace.samples[5] = null;
      },
    ],
    [
      'null control',
      (value) => {
        value.cycles[0].proof.trace.samples[5].controls = [null];
      },
    ],
    [
      'null phase',
      (value) => {
        value.cycles[0].proof.contract.phases[1] = null;
      },
    ],
    [
      'null transition',
      (value) => {
        value.cycles[0].proof.contract.transitions[0] = null;
      },
    ],
    [
      'null action',
      (value) => {
        value.cycles[0].proof.trace.actions[0] = null;
      },
    ],
    [
      'null marker',
      (value) => {
        value.cycles[0].proof.trace.marks[0] = null;
      },
    ],
    [
      'capture error',
      (value) => {
        value.cycles[0].proof.trace.errors.push('detached');
      },
    ],
    [
      'weakened gap limit',
      (value) => {
        value.cycles[0].proof.contract.coverage.maxGapMs = 101;
      },
    ],
    [
      'weakened acquisition limit',
      (value) => {
        value.cycles[0].proof.contract.coverage.maxMeasurementDurationMs = 33;
      },
    ],
    [
      'extra declared phase',
      (value) => {
        value.cycles[0].proof.contract.phases.push(
          value.cycles[0].proof.contract.phases[0]
        );
      },
    ],
    [
      'missing phase',
      (value) => {
        value.cycles[0].proof.contract.phases.splice(1, 1);
      },
    ],
    [
      'renamed phase',
      (value) => {
        value.cycles[0].proof.contract.phases[1].id = 'anything';
      },
    ],
    [
      'hidden history contract',
      (value) => {
        value.cycles[0].proof.contract.phases[1].controls[0].visibility =
          'hidden';
      },
    ],
    [
      'absent latest contract',
      (value) => {
        value.cycles[0].proof.contract.phases[0].controls[0].visibility =
          'absent';
      },
    ],
    [
      'weakened opacity',
      (value) => {
        value.cycles[0].proof.contract.phases[1].controls[0].opacity = 0.2;
      },
    ],
    [
      'wrong control inventory',
      (value) => {
        value.cycles[0].proof.contract.phases[1].controls[0].id = 'other';
      },
    ],
    [
      'spinner contract',
      (value) => {
        value.cycles[0].proof.contract.phases[1].controls[0].kind = 'loading';
      },
    ],
    [
      'loading contract',
      (value) => {
        value.cycles[0].proof.contract.phases[1].loading = true;
      },
    ],
    [
      'hidden-list contract',
      (value) => {
        value.cycles[0].proof.contract.phases[1].semanticState = 'list-hidden';
      },
    ],
    [
      'instant instead of monotonic contract',
      (value) => {
        value.cycles[0].proof.contract.transitions[0].opacity = 'instant';
      },
    ],
    [
      'overlong transition',
      (value) => {
        value.cycles[0].proof.contract.transitions[0].endTime = 1251;
      },
    ],
    [
      'short landed tail',
      (value) => {
        value.cycles[0].proof.contract.phases[2].startTime = 1300;
      },
    ],
    [
      'missing actual click',
      (value) => {
        value.cycles[0].proof.trace.actions = [];
      },
    ],
    [
      'duplicate actual click',
      (value) => {
        value.cycles[0].proof.trace.actions.push(
          value.cycles[0].proof.trace.actions[0]
        );
      },
    ],
    [
      'different action contract',
      (value) => {
        value.cycles[0].proof.contract.action.id = 'pretend';
      },
    ],
    [
      'missing phase marker',
      (value) => {
        value.cycles[0].proof.trace.marks.pop();
      },
    ],
    [
      'missing observed hide eligibility',
      (value) => {
        value.cycles[0].proof.trace.marks.splice(3, 1);
      },
    ],
    [
      'still-interactive hide gate',
      (value) => {
        value.cycles[0].proof.trace.marks[3].pointerEvents = 'auto';
      },
    ],
    [
      'missing pointer-events observation',
      (value) => {
        delete value.cycles[0].proof.trace.marks[3].pointerEvents;
      },
    ],
    [
      'hide eligibility from a replacement control',
      (value) => {
        value.cycles[0].proof.trace.marks[3].sameControl = false;
      },
    ],
    [
      'hide eligibility from another conversation',
      (value) => {
        value.cycles[0].proof.trace.marks[3].scope = '/other';
      },
    ],
    [
      'hide eligibility before press request',
      (value) => {
        value.cycles[0].proof.trace.marks[3].time = 799;
      },
    ],
    [
      'hide eligibility before the delivered click',
      (value) => {
        value.cycles[0].proof.trace.marks[3].time = 824;
      },
    ],
    [
      'hide eligibility after the hidden deadline',
      (value) => {
        value.cycles[0].proof.trace.marks[3].time = 1051;
      },
    ],
    [
      'normal hidden deadline only 199ms after eligibility',
      (value) => {
        value.cycles[0].proof.trace.marks[3].time = 851;
      },
    ],
    [
      'capture stops before the planned terminal tail',
      (value) => {
        value.cycles[0].proof.trace.samples =
          value.cycles[0].proof.trace.samples.filter(
            (sample) => sample.time <= 2000
          );
      },
    ],
    [
      'tail based on last observed sample instead of terminal readiness',
      (value) => {
        value.cycles[0].proof.contract.coverage.endTime = 2250;
        value.cycles[0].proof.contract.phases[2].endTime = 2250;
      },
    ],
    [
      'terminal readiness before the hidden phase',
      (value) => {
        value.cycles[0].proof.trace.marks[5].time = 1000;
      },
    ],
    [
      'null geometry marker',
      (value) => {
        value.cycles[0].geometry.marks[0] = null;
      },
    ],
    [
      'schedule not tied to raw marker',
      (value) => {
        value.cycles[0].proof.trace.marks[1].time += 1;
      },
    ],
    [
      'scope replaced between cycles',
      (value) => {
        const { trace, contract } = value.cycles[1].proof;
        contract.scope = '/other';
        trace.samples.forEach((sample) => {
          sample.scope = '/other';
          sample.controls.forEach((control) => {
            control.scope = '/other';
          });
        });
        trace.actions[0].scope = '/other';
      },
    ],
    [
      'same capture reused for two cycles',
      (value) => {
        value.cycles[1].proof = structuredClone(value.cycles[0].proof);
      },
    ],
    [
      'click outside geometry capture',
      (value) => {
        value.cycles[0].geometry.marks[0].time = 850;
      },
    ],
    [
      'sparse chrome samples',
      (value) => {
        value.cycles[0].proof.trace.samples.splice(15, 2);
      },
    ],
    [
      'duplicate sample timestamp',
      (value) => {
        value.cycles[0].proof.trace.samples[15].time =
          value.cycles[0].proof.trace.samples[14].time;
      },
    ],
    [
      'slow acquisition',
      (value) => {
        value.cycles[0].proof.trace.samples[15].measurement.durationMs = 33;
      },
    ],
    [
      'invalid acquisition',
      (value) => {
        value.cycles[0].proof.trace.samples[15].measurement.valid = false;
      },
    ],
  ])('rejects %s despite a passing producer flag', (_name, corrupt) => {
    const evidence = latestControlEvidence();
    corrupt(evidence);
    const result = assessLatestControl(evidence);
    expect(result.status).toBe('incomplete');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it.each([
    [
      'visible flash at latest',
      (cycle) => {
        cycle.proof.trace.samples[3].controls[0].visible = true;
        cycle.proof.trace.samples[3].controls[0].opacity = 1;
      },
    ],
    [
      'hidden flash in history',
      (cycle) => {
        cycle.proof.trace.samples[12].controls[0].visible = false;
        cycle.proof.trace.samples[12].controls[0].opacity = 0;
      },
    ],
    [
      'opacity reversal while appearing',
      (cycle) => {
        cycle.proof.trace.samples[8].controls[0].opacity = 0.1;
      },
    ],
    [
      'duplicate controls',
      (cycle) => {
        cycle.proof.trace.samples[12].controls.push({
          ...cycle.proof.trace.samples[12].controls[0],
        });
      },
    ],
    [
      'wrong icon identity',
      (cycle) => {
        cycle.proof.trace.samples[12].controls[0].kind = 'loading';
      },
    ],
    [
      'unexpected loading state',
      (cycle) => {
        cycle.proof.trace.samples[12].loading = true;
      },
    ],
    [
      'hidden list',
      (cycle) => {
        cycle.proof.trace.samples[12].semanticState = 'list-hidden';
      },
    ],
    [
      'wrong sampled scope',
      (cycle) => {
        cycle.proof.trace.samples[12].scope = '/other';
      },
    ],
    [
      'late visible flash after landing',
      (cycle) => {
        cycle.proof.trace.samples[40].controls[0].visible = true;
        cycle.proof.trace.samples[40].controls[0].opacity = 1;
      },
    ],
    [
      'wrong bottom landing',
      (cycle) => {
        cycle.geometry.frames[70].scrollTop -= 5;
        cycle.geometry.frames[70].bottomGap += 5;
      },
    ],
    [
      'movement never exercised',
      (cycle) => {
        cycle.geometry.frames.forEach((frame) => {
          frame.scrollTop = 900;
          frame.bottomGap = 0;
        });
      },
    ],
    [
      'reversed landing movement',
      (cycle) => {
        cycle.geometry.frames[5].scrollTop = 810;
        cycle.geometry.frames[5].bottomGap = 90;
      },
    ],
  ])(
    'replays %s from the second cycle even when Playwright says passed',
    (_name, corrupt) => {
      const evidence = latestControlEvidence();
      corrupt(evidence.cycles[1]);
      const result = assessLatestControl(evidence);
      expect(result.status).toBe('fail');
      expect(result.issues.length).toBeGreaterThan(0);
    }
  );

  it('rejects duplicate or corrupt raw chrome attachments', () => {
    for (const corrupt of [
      (attempt) => {
        attempt.attachments.push({ ...attempt.attachments[1] });
      },
      (attempt) => {
        attempt.attachments[1].body = 'not-json';
      },
    ]) {
      const evidence = latestControlEvidence();
      const attempt = latestControlAttempt(evidence);
      corrupt(attempt);
      expect(assessLatestControl(evidence, attempt).status).toBe('incomplete');
    }
  });

  it('refuses an animated reduced-motion contract or an observed fractional fade', () => {
    const weakened = latestControlEvidence('reduced');
    weakened.cycles[0].proof.contract.transitions[0].opacity = 'monotonic';
    expect(assessLatestControl(weakened).status).toBe('incomplete');

    const animated = latestControlEvidence('reduced');
    animated.cycles[0].proof.trace.samples[6].controls[0].opacity = 0.5;
    const result = assessLatestControl(animated);
    expect(result.status).toBe('fail');
    expect(
      result.issues.some((issue) =>
        issue.includes('unpermitted-transition-state')
      )
    ).toBe(true);
  });

  it('does not require a normal-motion fade interval for the instant reduced-motion path', () => {
    const evidence = latestControlEvidence('reduced');
    evidence.cycles[0].proof.trace.marks[3].time = 1049;
    expect(assessLatestControl(evidence)).toEqual({
      status: 'recorded-sampled-pass',
      issues: [],
    });
    // The normal baseline needs the full interval even though the same
    // producer-declared hidden deadline has already been reached.
    const normal = latestControlEvidence('normal');
    normal.cycles[0].proof.trace.marks[3].time = 1049;
    expect(assessLatestControl(normal).status).toBe('incomplete');
  });
});

const imageContentEvidence = () => {
  const registry = webScenarioRegistry.find(
    (item) => item.scenario === 'web-image-content-end'
  );
  const name = registry.traceNames[0];
  const scope = '/apps/groups/group/test/channel/chat/~zod/general';
  const path = '/scroller-loading/12345678-1234-1234-1234-123456789abc.png';
  const src = `http://localhost:3000${path}`;
  const caption = 'Delayed image with unchanged props';
  const rowId = 'image-post';
  const attemptStart = Date.parse('2026-09-06T00:00:00Z');
  const box = (top, height) => ({
    left: 0,
    right: 600,
    top,
    bottom: top + height,
    width: 600,
    height,
  });
  const presentation = (top, height) => ({
    connected: true,
    displayed: true,
    opacity: 1,
    rect: box(top, height),
    clip: box(
      Math.max(100, top),
      Math.max(0, Math.min(500, top + height) - Math.max(100, top))
    ),
  });
  const essay = {
    content: [
      { inline: [caption] },
      { block: { image: { src: path, alt: caption, width: 0, height: 0 } } },
    ],
    author: '~zod',
    kind: '/chat',
    sent: attemptStart + 10,
    meta: null,
    blob: null,
  };
  const contract = {
    scope,
    rowId,
    src,
    caption,
    releaseTime: 250,
    terminalTime: 500,
    coverage: {
      startTime: 0,
      endTime: 1500,
      maxGapMs: 100,
      maxMeasurementDurationMs: 32,
    },
  };
  const trace = {
    errors: [],
    marks: [
      { id: 'response-release', time: 250 },
      { id: 'terminal-ready', time: 500 },
    ],
    events: ['image-load', 'image-decoded'].map((id, index) => ({
      id,
      time: 300 + index * 20,
      scope,
      src,
      currentSrc: src,
      originalTarget: true,
      trusted: true,
    })),
    samples: Array.from({ length: 37 }, (_, index) => {
      const ready = index >= 7;
      return {
        time: index * 50,
        scope,
        rowId,
        sameRow: true,
        list: presentation(100, 400),
        row: presentation(ready ? 150 : 50, ready ? 350 : 450),
        imageFrame: presentation(ready ? 200 : 100, ready ? 300 : 400),
        caption: {
          count: 1,
          text: caption,
          presentation: presentation(ready ? 150 : 50, 20),
        },
        images: [
          {
            src,
            currentSrc: ready ? src : '',
            complete: ready,
            naturalWidth: ready ? 2 : 0,
            naturalHeight: ready ? 1 : 0,
            sameElement: true,
            presentation: presentation(ready ? 200 : 100, ready ? 300 : 400),
            frontmost: true,
          },
        ],
        fallbackPresent: false,
        measurement: { valid: true, durationMs: 1 },
      };
    }),
  };
  const geometry = {
    errors: [],
    marks: [
      { label: `${name}:start`, time: 10 },
      { label: `${name}:response-release`, time: 248 },
      { label: `${name}:image-decoded`, time: 400 },
      { label: `${name}:terminal-state`, time: 510 },
    ],
    frames: trace.samples.map((sample, index) => ({
      time: sample.time + 5,
      scrollTop: index < 7 ? 1600 : 1500,
      scrollHeight: index < 7 ? 2000 : 1900,
      clientHeight: 400,
      viewportTop: 100,
      viewportBottom: 500,
      bottomGap: 0,
      anchors: {
        [rowId]: {
          top: sample.row.rect.top - 100,
          bottom: sample.row.rect.bottom - 100,
          height: sample.row.rect.height,
        },
      },
    })),
  };
  const loading = {
    src: path,
    scope,
    origin: 'http://localhost:3000',
    imagePostId: rowId,
    beforeDecode: { complete: false, width: 0, height: 0 },
    afterDecode: { complete: true, width: 2, height: 1 },
    requests: [
      {
        requestedAt: attemptStart + 20,
        releasedAt: attemptStart + 520,
        fulfilledAt: attemptStart + 530,
      },
    ],
    clockDomains: {
      route: 'Date.now milliseconds',
      content: 'performance.now milliseconds',
    },
    beforeEssay: essay,
    afterEssay: structuredClone(essay),
    beforeImage: { height: 400 },
    afterImage: { height: 300 },
    beforeRow: { height: 450 },
    afterRow: { height: 350 },
    sameMountedRow: true,
    available: { width: 600, height: 400 },
  };
  return { registry, name, geometry, loading, proof: { trace, contract } };
};
const imageContentAttempt = ({ registry, name, geometry, loading, proof }) =>
  browserAttempt(registry, {
    startTime: '2026-09-06T00:00:00Z',
    duration: 3000,
    attachments: [
      [name, geometry],
      [`${name}-loading-proof`, loading],
      [`${name}-content-proof`, proof],
    ]
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => ({
        name,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(value)).toString('base64'),
      })),
  });
const assessImageContent = (
  evidence,
  attempt = imageContentAttempt(evidence)
) =>
  assessWebEvidence(
    readPlaywrightReport(
      browserReport([attempt], evidence.registry),
      '/tmp/image-content.json'
    )[0]
  );

describe('image-content raw evidence replay (reporter controls, not product proof)', () => {
  it('registers only the real latest-at-rest partial slice and requires all three raw proofs', () => {
    const evidence = imageContentEvidence();
    expect(
      webScenarioRegistry.filter(
        (item) => item.scenario === evidence.registry.scenario
      )
    ).toHaveLength(1);
    expect(
      scenarioRegistry.filter((item) => !item.scenario.startsWith('web-'))
    ).toHaveLength(56);
    expect(scenarioRegistry).toHaveLength(56 + webScenarioRegistry.length);
    expect(evidence.registry.matrix).toEqual(['FLK-07', 'FLK-12', 'STA-01']);
    expect(evidence.registry.requireContentProof).toBe(true);
    expect(evidence.registry.requireImageLoadingProof).toBe(true);
    expect(assessImageContent(evidence)).toEqual({
      status: 'recorded-sampled-pass',
      issues: [],
    });
  });

  it.each([
    [
      'missing content proof',
      (e) => {
        e.proof = undefined;
      },
    ],
    [
      'missing loading proof',
      (e) => {
        e.loading = undefined;
      },
    ],
    [
      'missing raw samples',
      (e) => {
        e.proof.trace.samples = null;
      },
    ],
    [
      'null raw sample',
      (e) => {
        e.proof.trace.samples[5] = null;
      },
    ],
    [
      'invalid sample acquisition',
      (e) => {
        e.proof.trace.samples[5].measurement.valid = false;
      },
    ],
    [
      'weakened capture gap',
      (e) => {
        e.proof.contract.coverage.maxGapMs = 101;
      },
    ],
    [
      'weakened acquisition duration',
      (e) => {
        e.proof.contract.coverage.maxMeasurementDurationMs = 33;
      },
    ],
    [
      'missing real load event',
      (e) => {
        e.proof.trace.events.shift();
      },
    ],
    [
      'untrusted synthetic load',
      (e) => {
        e.proof.trace.events[0].trusted = false;
      },
    ],
    [
      'shortened terminal deadline',
      (e) => {
        e.proof.contract.coverage.endTime = 1400;
      },
    ],
    [
      'last-sample terminal deadline',
      (e) => {
        e.proof.trace.samples = e.proof.trace.samples.slice(0, 29);
        e.proof.contract.coverage.endTime = 1400;
      },
    ],
    [
      'early end with unchanged planned deadline',
      (e) => {
        e.proof.trace.samples = e.proof.trace.samples.slice(0, 29);
      },
    ],
    [
      'swapped loading conversation',
      (e) => {
        e.loading.scope += '-other';
      },
    ],
    [
      'swapped loading origin',
      (e) => {
        e.loading.origin = 'http://localhost:3002';
      },
    ],
    [
      'swapped loading image',
      (e) => {
        e.loading.src = '/scroller-loading/different.png';
      },
    ],
    [
      'different backend caption',
      (e) => {
        e.loading.beforeEssay.content[0].inline = ['Other'];
        e.loading.afterEssay = structuredClone(e.loading.beforeEssay);
      },
    ],
    [
      'different backend image props',
      (e) => {
        e.loading.beforeEssay.content[1].block.image.width = 600;
        e.loading.afterEssay = structuredClone(e.loading.beforeEssay);
      },
    ],
    [
      'backend mutation during load',
      (e) => {
        e.loading.afterEssay.content[0].inline = ['Edited'];
      },
    ],
    [
      'replaced row',
      (e) => {
        e.loading.sameMountedRow = false;
      },
    ],
    [
      'insufficient fit precondition',
      (e) => {
        e.loading.available.width = 599;
      },
    ],
    [
      'unclear route clock',
      (e) => {
        e.loading.clockDomains.route = 'performance.now milliseconds';
      },
    ],
    [
      'unfulfilled held request',
      (e) => {
        delete e.loading.requests[0].fulfilledAt;
      },
    ],
    [
      'malformed route record',
      (e) => {
        e.loading.requests[0] = null;
      },
    ],
    [
      'reused earlier route requests',
      (e) => {
        for (const key of ['requestedAt', 'releasedAt', 'fulfilledAt'])
          e.loading.requests[0][key] -= 10000;
      },
    ],
    [
      'fulfillment after attempt end',
      (e) => {
        e.loading.requests[0].fulfilledAt += 10000;
      },
    ],
    [
      'loading metadata with no real image resize',
      (e) => {
        e.loading.afterImage.height = e.loading.beforeImage.height;
      },
    ],
    [
      'content proof from another geometry capture',
      (e) => {
        e.geometry.frames.forEach((f) => {
          f.time += 5000;
        });
        e.geometry.marks.forEach((m) => {
          m.time += 5000;
        });
      },
    ],
    [
      'geometry decode before observed real decode',
      (e) => {
        e.geometry.marks[2].time = 310;
      },
    ],
    [
      'geometry terminal before content ready',
      (e) => {
        e.geometry.marks[3].time = 490;
      },
    ],
    [
      'geometry truncated before independent deadline',
      (e) => {
        e.geometry.frames = e.geometry.frames.slice(0, 30);
      },
    ],
    [
      'different geometry row identity',
      (e) => {
        e.geometry.frames.forEach((f) => {
          f.anchors.other = f.anchors['image-post'];
          delete f.anchors['image-post'];
        });
      },
    ],
    [
      'different geometry row location',
      (e) => {
        e.geometry.frames.forEach((f) => {
          f.anchors['image-post'].top += 10;
          f.anchors['image-post'].bottom += 10;
        });
      },
    ],
    [
      'different geometry viewport',
      (e) => {
        e.geometry.frames.forEach((f) => {
          f.viewportTop += 10;
          f.viewportBottom += 10;
        });
      },
    ],
  ])('cannot pass %s', (_name, corrupt) => {
    const evidence = imageContentEvidence();
    corrupt(evidence);
    expect(assessImageContent(evidence).status).toBe('incomplete');
  });

  it.each([
    [
      'one-sample hidden decoded image',
      (e) => {
        e.proof.trace.samples[20].images[0].presentation.opacity = 0;
      },
    ],
    [
      'duplicate decoded image',
      (e) => {
        e.proof.trace.samples[20].images.push(
          structuredClone(e.proof.trace.samples[20].images[0])
        );
      },
    ],
    [
      'ready content reverts',
      (e) => {
        Object.assign(e.proof.trace.samples[20].images[0], {
          complete: false,
          naturalWidth: 0,
          naturalHeight: 0,
        });
      },
    ],
    [
      'stale source returns',
      (e) => {
        e.proof.trace.samples[20].images[0].currentSrc += '?old';
      },
    ],
    [
      'decoded image is clipped',
      (e) => {
        e.proof.trace.samples[20].images[0].presentation.clip.height -= 5;
        e.proof.trace.samples[20].images[0].presentation.clip.bottom -= 5;
      },
    ],
    [
      'bottom moves during actual decode',
      (e) => {
        e.geometry.frames[7].scrollTop -= 12;
        e.geometry.frames[7].bottomGap = 12;
      },
    ],
  ])(
    'replays a measured failure for %s despite producer PASS',
    (_name, corrupt) => {
      const evidence = imageContentEvidence();
      corrupt(evidence);
      expect(assessImageContent(evidence).status).toBe('fail');
    }
  );

  it('rejects duplicate/corrupt attachments and absent attempt timing without trusting producer status', () => {
    const evidence = imageContentEvidence();
    for (const change of [
      (attempt) => {
        attempt.attachments.push(attempt.attachments.at(-1));
      },
      (attempt) => {
        attempt.attachments.at(-1).body = Buffer.from('{').toString('base64');
      },
      (attempt) => {
        delete attempt.startTime;
      },
      (attempt) => {
        delete attempt.duration;
      },
      (attempt) => {
        attempt.startTime = '2026-09-06T00:01:00Z';
      },
    ]) {
      const attempt = imageContentAttempt(evidence);
      change(attempt);
      expect(assessImageContent(evidence, attempt).status).toBe('incomplete');
    }
  });
});

describe('Playwright evidence accounting', () => {
  it('replays actual viewport growth and restoration without requiring composer-style shrink', () => {
    const contract = webScenarioRegistry.find(
      (item) => item.scenario === 'web-viewport-resize'
    );
    const trace = browserTrace('viewport-resize');
    for (const frame of trace.frames.slice(15, 30)) {
      frame.clientHeight = 150;
      frame.viewportBottom = 160;
      frame.scrollTop = 850;
    }
    const report = createCoverageReport({
      ...webInput(contract),
      evidence: [
        {
          source: '/tmp/viewport-grow.json',
          value: browserReport(
            [
              browserAttempt(contract, {
                attachments: [
                  {
                    name: 'viewport-resize',
                    contentType: 'application/json',
                    body: Buffer.from(JSON.stringify(trace)).toString('base64'),
                  },
                ],
              }),
            ],
            contract
          ),
        },
      ],
    });
    expect(report.scenarios[0].status).toBe('recorded-sampled-pass');
  });

  it('requires causal image evidence in addition to an otherwise passing geometry trace', () => {
    const contract = webScenarioRegistry.find(
      (item) => item.scenario === 'web-image-load-end'
    );
    const name = contract.traceNames[0];
    const makeEvidence = () => {
      const trace = browserTrace(name);
      trace.marks = [
        { label: `${name}:start`, time: 5 },
        { label: `${name}:response-release`, time: 208 },
        { label: `${name}:image-decoded`, time: 240 },
        { label: `${name}:terminal-state`, time: 250 },
      ];
      for (const frame of trace.frames.slice(15)) {
        frame.anchors.witness.height += 32;
        frame.anchors.witness.bottom += 32;
      }
      const proof = {
        src: '/scroller-loading/unique.png',
        imagePostId: 'witness',
        beforeDecode: { complete: false, width: 0, height: 0 },
        afterDecode: { complete: true, width: 2, height: 1 },
        requests: [{ requestedAt: 1000, releasedAt: 1500 }],
        beforeEssay: { content: 'unchanged image post' },
        afterEssay: { content: 'unchanged image post' },
        beforeImage: { height: 32 },
        afterImage: { height: 64 },
        beforeRow: { height: 40 },
        afterRow: { height: 72 },
        sameMountedRow: true,
      };
      return { trace, proof };
    };
    for (const corrupt of [
      () => {},
      (value) => {
        value.proof = undefined;
      },
      (value) => {
        value.proof.requests = [];
      },
      (value) => {
        delete value.proof.imagePostId;
      },
      (value) => {
        value.proof.imagePostId = 'unmeasured-post';
      },
      (value) => {
        value.proof.beforeDecode.width = 2;
      },
      (value) => {
        value.proof.afterDecode.width = 0;
      },
      (value) => {
        delete value.proof.requests[0].releasedAt;
      },
      (value) => {
        value.proof.afterEssay.content = 'replaced';
      },
      (value) => {
        value.proof.sameMountedRow = false;
      },
      (value) => {
        value.proof.afterRow.height = 40;
      },
      (value) => {
        value.trace.frames.forEach((frame) => {
          frame.anchors.witness.height = 40;
        });
      },
      (value) => {
        value.trace.marks[1].time = 10;
      },
      (value) => {
        value.trace.marks[2].time = 100;
      },
    ]) {
      const value = makeEvidence();
      const baseline = JSON.stringify(value);
      corrupt(value);
      const attachments = [
        [name, value.trace],
        [`${name}-loading-proof`, value.proof],
      ]
        .filter(([, body]) => body !== undefined)
        .map(([attachmentName, body]) => ({
          name: attachmentName,
          contentType: 'application/json',
          body: Buffer.from(JSON.stringify(body)).toString('base64'),
        }));
      const report = createCoverageReport({
        ...webInput(contract),
        evidence: [
          {
            source: '/tmp/image.json',
            value: browserReport(
              [browserAttempt(contract, { attachments })],
              contract
            ),
          },
        ],
      });
      expect(report.scenarios[0].status).toBe(
        JSON.stringify(value) === baseline
          ? 'recorded-sampled-pass'
          : 'incomplete'
      );
    }
  });

  it('reads nested product results and base64 raw trace bodies', () => {
    const result = createCoverageReport({
      ...webInput(),
      evidence: [
        { source: '/tmp/web.json', value: browserReport([browserAttempt()]) },
      ],
    });
    expect(result.counts.executedSlices).toBe(1);
    expect(result.counts.recordedSampledPasses).toBe(1);
    expect(result.scenarios[0].runs[0].platform).toBe('web:chromium');
    expect(result.fullMatrixVerified).toBe(false);
    expect(result.nativePresentation).toBe('INCOMPLETE');
  });

  it('rechecks raw web positions despite a stale passing Playwright assertion', () => {
    for (const corrupt of [
      (trace) => {
        trace.frames[70].scrollTop -= 5;
        trace.frames[70].bottomGap += 5;
      },
      (trace) => {
        trace.frames.forEach((frame) => {
          frame.scrollTop = 900;
          frame.bottomGap = 0;
        });
      },
      (trace) => {
        trace.frames[10].scrollTop = 800;
        trace.frames[10].bottomGap = 100;
      },
    ]) {
      const trace = browserTrace('send-from-history');
      corrupt(trace);
      const result = createCoverageReport({
        ...webInput(),
        evidence: [
          {
            source: '/tmp/stale-pass.json',
            value: browserReport([
              browserAttempt(undefined, {
                attachments: [
                  {
                    name: 'send-from-history',
                    contentType: 'application/json',
                    body: Buffer.from(JSON.stringify(trace)).toString('base64'),
                  },
                ],
              }),
            ]),
          },
        ],
      });
      expect(result.scenarios[0].status).toBe('fail');
    }
    const contract = webScenarioRegistry.find(
      (item) => item.scenario === 'web-hover-menu'
    );
    const trace = browserTrace('hover-menu');
    trace.frames[20].anchors.witness.top += 4;
    trace.frames[20].anchors.witness.bottom += 4;
    const result = createCoverageReport({
      ...webInput(contract),
      evidence: [
        {
          source: '/tmp/drift.json',
          value: browserReport(
            [
              browserAttempt(contract, {
                attachments: [
                  {
                    name: 'hover-menu',
                    contentType: 'application/json',
                    body: Buffer.from(JSON.stringify(trace)).toString('base64'),
                  },
                ],
              }),
            ],
            contract
          ),
        },
      ],
    });
    expect(result.scenarios[0].status).toBe('fail');
  });

  it('never treats detector calibration results as product coverage', () => {
    const result = createCoverageReport({
      ...webInput(),
      evidence: [
        {
          source: '/tmp/detector.json',
          value: browserReport(
            [browserAttempt()],
            undefined,
            'Scroller detector self-tests'
          ),
        },
      ],
    });
    expect(result.counts.executedSlices).toBe(0);
    expect(result.counts.recordedSampledPasses).toBe(0);
    expect(result.excludedEvidence[0].reason).toBe('detector-self-test');
    expect(result.unregisteredEvidence).toEqual([]);
  });

  it.each([
    ['scroller-stability.spec.ts', 'Scroller detector self-tests'],
    [
      'scroller-reading-detectors.spec.ts',
      'Reading/content collector calibration',
    ],
    ['scroller-input-detectors.spec.ts', 'scroller-input-detectors.spec.ts'],
  ])(
    'separates current and legacy %s calibrations from product coverage',
    (file, suite) => {
      for (const annotated of [false, true]) {
        for (const status of ['passed', 'failed', 'timedOut', 'interrupted']) {
          const value = browserReport(
            [browserAttempt(undefined, { status })],
            undefined,
            suite
          );
          const spec = value.suites[0].suites[0].specs[0];
          spec.title = 'independent calibration case';
          spec.file = `e2e/${file}`;
          if (annotated)
            spec.tests[0].annotations = [
              {
                type: 'evidence-kind',
                description: 'scroller-detector-calibration',
              },
            ];
          const [record] = readPlaywrightReport(value, '/tmp/calibration.json');
          expect(record.excluded).toBe('detector-self-test');
          expect(record.evidenceKind).toBe('scroller-detector-calibration');
          expect(record.evidenceKindSource).toBe(
            annotated
              ? 'annotation'
              : file === 'scroller-stability.spec.ts'
                ? 'legacy-suite'
                : 'legacy-file'
          );
          const report = createCoverageReport({
            ...webInput(),
            evidence: [{ source: '/tmp/calibration.json', value }],
          });
          expect(report.counts.executedSlices).toBe(0);
          expect(report.counts.recordedSampledPasses).toBe(0);
          expect(report.counts.failingSlices).toBe(0);
          expect(report.counts.failingDetectorAttempts).toBe(
            status === 'passed' ? 0 : 1
          );
          expect(report.unregisteredEvidence).toEqual([]);
          if (status !== 'passed')
            expect(coverageReportExitCode(report)).toBe(1);
        }
      }
    }
  );

  it('reads attempt-level calibration annotations when a mixed-file suite is renamed', () => {
    const value = browserReport(
      [
        browserAttempt(undefined, {
          annotations: [
            {
              type: 'evidence-kind',
              description: 'scroller-detector-calibration',
            },
          ],
        }),
      ],
      undefined,
      'renamed calibration suite'
    );
    value.suites[0].suites[0].specs[0].title = 'new calibration';
    const [record] = readPlaywrightReport(value, '/tmp/renamed.json');
    expect(record.excluded).toBe('detector-self-test');
    expect(record.evidenceKindSource).toBe('annotation');
  });

  it('cannot hide registered product failures with a calibration annotation', () => {
    const value = browserReport([
      browserAttempt(undefined, { status: 'failed' }),
    ]);
    value.suites[0].suites[0].specs[0].tests[0].annotations = [
      { type: 'evidence-kind', description: 'scroller-detector-calibration' },
    ];
    const [record] = readPlaywrightReport(value, '/tmp/product.json');
    expect(record.excluded).toBeNull();
    const report = createCoverageReport({
      ...webInput(),
      evidence: [{ source: '/tmp/product.json', value }],
    });
    expect(report.counts.executedSlices).toBe(1);
    expect(report.counts.failingSlices).toBe(1);
    expect(report.counts.failingDetectorAttempts).toBe(0);
  });

  it('does not silently exclude an unrelated test with a detector-like name or annotation', () => {
    const value = browserReport(
      [browserAttempt()],
      undefined,
      'Reading/content collector calibration'
    );
    const spec = value.suites[0].suites[0].specs[0];
    spec.file = 'scroller-new-product.spec.ts';
    spec.tests[0].annotations = [
      { type: 'evidence-kind', description: 'scroller-detector-calibration' },
    ];
    const [record] = readPlaywrightReport(value, '/tmp/unknown.json');
    expect(record.excluded).toBeNull();
    const report = createCoverageReport({
      ...webInput(),
      evidence: [{ source: '/tmp/unknown.json', value }],
    });
    expect(report.unregisteredEvidence).toHaveLength(1);
  });

  it('retains failed authentication and detector attempts outside product coverage', () => {
    for (const [suite, project, count] of [
      ['authentication', 'setup', 'failingSetupAttempts'],
      ['Scroller detector self-tests', 'chromium', 'failingDetectorAttempts'],
    ]) {
      const value = browserReport(
        [browserAttempt(undefined, { status: 'timedOut' }), browserAttempt()],
        undefined,
        suite
      );
      value.suites[0].suites[0].specs[0].tests[0].projectName = project;
      const report = createCoverageReport({
        ...webInput(),
        evidence: [{ source: '/tmp/setup.json', value }],
      });
      expect(report.counts[count]).toBe(1);
      expect(report.counts.failingSlices).toBe(0);
      expect(report.counts.executedSlices).toBe(0);
      expect(report.counts.recordedSampledPasses).toBe(0);
      expect(coverageReportExitCode(report)).toBe(1);
    }
  });

  it('fails the report for runner errors without inventing product execution', () => {
    const report = createCoverageReport({
      ...webInput(),
      evidence: [
        {
          source: '/tmp/runner.json',
          value: { suites: [], errors: [{ message: 'Runner interrupted' }] },
        },
      ],
    });
    expect(report.counts.runnerErrors).toBe(1);
    expect(report.counts.executedSlices).toBe(0);
    expect(report.counts.failingSlices).toBe(0);
    expect(coverageReportExitCode(report)).toBe(1);
  });

  it('requires raw attachments, not only a passing result or summary', () => {
    for (const attachments of [
      [],
      [
        {
          name: 'send-from-history-summary',
          contentType: 'application/json',
          body: Buffer.from('{}').toString('base64'),
        },
      ],
      [
        {
          name: 'send-from-history',
          contentType: 'application/json',
          body: 'not-json',
        },
      ],
    ]) {
      const [record] = readPlaywrightReport(
        browserReport([browserAttempt(undefined, { attachments })]),
        '/tmp/web.json'
      );
      expect(assessWebEvidence(record).status).toBe('incomplete');
    }
  });

  it('rejects sparse capture, missing terminal state and truncated quiet tail', () => {
    for (const corrupt of [
      (trace) => {
        trace.frames[30].time += 400;
      },
      (trace) => {
        trace.marks = [];
      },
      (trace) => {
        trace.frames = trace.frames.slice(0, 20);
      },
      (trace) => {
        trace.frames[5].clientHeight = null;
      },
    ]) {
      const attempt = browserAttempt();
      const trace = browserTrace('send-from-history');
      corrupt(trace);
      attempt.attachments[0].body = Buffer.from(JSON.stringify(trace)).toString(
        'base64'
      );
      expect(
        assessWebEvidence(
          readPlaywrightReport(browserReport([attempt]), '/tmp/web.json')[0]
        ).status
      ).toBe('incomplete');
    }
  });

  it('requires both captures for eventual thread restoration', () => {
    const contract = webScenarioRegistry.find(
      (item) => item.scenario === 'web-thread-return'
    );
    const attempt = browserAttempt(contract);
    expect(
      assessWebEvidence(
        readPlaywrightReport(
          browserReport([attempt], contract),
          '/tmp/web.json'
        )[0]
      ).status
    ).toBe('recorded-sampled-pass');
    attempt.attachments.pop();
    expect(
      assessWebEvidence(
        readPlaywrightReport(
          browserReport([attempt], contract),
          '/tmp/web.json'
        )[0]
      ).status
    ).toBe('incomplete');
  });

  it('keeps a failed product attempt when its retry succeeds', () => {
    const result = createCoverageReport({
      ...webInput(),
      evidence: [
        {
          source: '/tmp/web.json',
          value: browserReport([
            browserAttempt(undefined, { status: 'failed' }),
            browserAttempt(undefined, { retry: 1 }),
          ]),
        },
      ],
    });
    expect(result.scenarios[0].status).toBe('fail');
    expect(result.scenarios[0].runs).toHaveLength(2);
    expect(result.counts.recordedSampledPasses).toBe(0);
  });

  it('keeps skipped cases unrun and unmatched product cases visible', () => {
    const result = createCoverageReport({
      ...webInput(),
      evidence: [
        {
          source: '/tmp/web.json',
          value: browserReport([
            browserAttempt(undefined, { status: 'skipped', attachments: [] }),
          ]),
        },
      ],
    });
    expect(result.counts.executedSlices).toBe(0);
    expect(result.scenarios[0].status).toBe('not-run');
    const unknown = browserReport([browserAttempt()]);
    unknown.suites[0].suites[0].specs[0].title =
      'new unregistered product case';
    expect(
      createCoverageReport({
        ...webInput(),
        evidence: [{ source: '/tmp/web.json', value: unknown }],
      }).unregisteredEvidence
    ).toHaveLength(1);
  });

  it('requires the registered source file as well as matching product titles', () => {
    const report = browserReport([browserAttempt()]);
    report.suites[0].suites[0].specs[0].file =
      'unrelated-synthetic-fixture.spec.ts';
    const result = createCoverageReport({
      ...webInput(),
      evidence: [{ source: '/tmp/web.json', value: report }],
    });
    expect(result.counts.recordedSampledPasses).toBe(0);
    expect(result.unregisteredEvidence).toHaveLength(1);
  });
});

describe('scroller coverage accounting (reporter controls, not device proof)', () => {
  it('qualifies the entire gesture capture before treating an early residual as a product failure', () => {
    const trace = passedTrace();
    trace.scenario = 'gesture';
    trace.assertion = 'gesture';
    trace.samples = Array.from({ length: 91 }, (_, index) => ({
      ...structuredClone(trace.baseline),
      time: index * 50,
      scroll: index ? 105 : 100,
      contentLength: index >= 45 ? 1020 : 1000,
    }));
    trace.baseline = trace.samples[0];
    trace.expectations.action.name = trace.scenario;
    trace.expectations.coverage.endTime = 4500;
    delete trace.expectations.bottom;
    trace.baselinePreconditions = {
      requireHistory: true,
      requireInitialEnd: false,
      requireReadingAnchor: true,
      readingAnchorKey: 'scroll-fixture-119',
      excludedAnchorKeys: [],
      allowEmptyEnd: false,
    };
    trace.events = [
      { time: 1, name: 'drag-begin' },
      { time: 100, name: 'drag-end' },
    ];
    trace.result = assessScrollTrace(trace.samples, trace.expectations);
    trace.result.verdict = 'FAIL';
    trace.result.passed = false;
    trace.result.issues = [
      { kind: 'failure', code: 'gesture-displacement', sampleIndex: 1 },
      { kind: 'incomplete', code: 'gesture-layout-changed', sampleIndex: 45 },
    ];
    expect(classifyEvidence(trace)).toBe('fail');
    expect(qualifyEvidence(trace).status).toBe('incomplete');
    trace.samples.forEach((sample) => {
      sample.contentLength = 1000;
    });
    expect(qualifyEvidence(trace).status).toBe('fail');
  });

  it('retains raw failures separately from missing action and unverified READ scope', () => {
    const trace = passedTrace();
    trace.result.verdict = 'FAIL';
    trace.result.passed = false;
    trace.expectations.action.observed = false;
    const report = createCoverageReport({
      ...input,
      evidence: [{ source: 'unobserved.json', value: trace }],
    });
    expect(report.scenarios[0].runs[0]).toMatchObject({
      reportedVerdict: 'FAIL',
      status: 'fail',
      qualifiedStatus: 'incomplete',
    });
    expect(report.counts.failingSlices).toBe(1);
    expect(report.counts.qualifiedFailingSlices).toBe(0);
    expect(report.counts.qualifiedIncompleteSlices).toBe(1);
    expect(
      qualifyEvidence({
        ...passedTrace(),
        scenario: 'near-grow',
        positioningCoverage: 'programmatic-near-end-no-user-drag',
      }).status
    ).toBe('incomplete');
  });

  it('qualifies reproduced raw geometry failure but never promotes an unreproduced FAIL', () => {
    const trace = passedTrace();
    trace.result.verdict = 'FAIL';
    trace.result.passed = false;
    expect(classifyEvidence(trace)).toBe('fail');
    expect(qualifyEvidence(trace).status).toBe('incomplete');
    trace.samples[6].scroll -= 5;
    expect(qualifyEvidence(trace).status).toBe('fail');
    const report = createCoverageReport({
      ...input,
      evidence: [{ source: 'geometry.json', value: trace }],
    });
    expect(report.counts.failingSlices).toBe(1);
    expect(report.counts.qualifiedFailingSlices).toBe(1);
  });

  it('keeps legacy first-effect mutations incomplete even when the former detector would pass', () => {
    const make = () => {
      const trace = passedTrace();
      trace.scenario = 'near-grow';
      trace.assertion = 'hold';
      trace.expectations.action.name = trace.scenario;
      delete trace.expectations.bottom;
      trace.expectations.anchor = { key: 'scroll-fixture-119', baselineY: 70 };
      trace.baselinePreconditions = {
        requireHistory: false,
        requireInitialEnd: false,
        requireReadingAnchor: true,
        readingAnchorKey: 'scroll-fixture-119',
        excludedAnchorKeys: ['target'],
        allowEmptyEnd: false,
      };
      trace.samples.forEach((sample) =>
        sample.rows.push({
          key: 'target',
          y: 20,
          height: sample.time < 50 ? 30 : 45,
        })
      );
      trace.committedDataKeys = ['target', 'scroll-fixture-119'];
      trace.events = [
        {
          time: 0,
          name: 'row-mutation-request',
          values: {
            key: 'target',
            kind: 'grow',
            'previous-content': 'before',
            'expected-content': 'after',
            'previous-reactions': '[]',
            'expected-reactions': '[]',
            'previous-replies': '0',
            'expected-replies': '0',
          },
        },
        {
          time: 50,
          name: 'row-commit',
          values: {
            key: 'target',
            content: 'after',
            reactions: '[]',
            replies: '0',
          },
        },
        { time: 50, name: 'row-layout', values: { key: 'target', height: 45 } },
      ];
      trace.result = assessScrollTrace(trace.samples, trace.expectations);
      return trace;
    };
    for (const corrupt of [
      () => {},
      (trace) => {
        trace.events = trace.events.filter(
          (event) => event.name !== 'row-commit'
        );
      },
      (trace) => {
        trace.samples.forEach((sample) => {
          sample.rows[1].height = 30;
        });
      },
      (trace) => {
        trace.events[1].values.content = 'before';
      },
      (trace) => {
        trace.events[0].values.kind = 'reply';
      },
    ]) {
      const trace = make();
      corrupt(trace);
      trace.mutationWitness = { observed: true, reasons: [] };
      trace.mutationEvidence = JSON.parse(
        JSON.stringify({
          events: trace.events,
          samples: trace.samples,
          committedKeys: trace.committedDataKeys,
        })
      );
      expect(classifyEvidence(trace)).toBe('incomplete');
    }
  });

  it('replays a strict single-phase mutation with a real pre-baseline commit and a post-baseline plan', () => {
    const trace = strictNativeMutation();
    expect(classifyEvidence(trace)).toBe('recorded-sampled-pass');
    expect(qualifyEvidence(trace)).toEqual({
      status: 'recorded-sampled-pass',
      issues: [],
      geometryEvidenceLevel: 'legacy-mixed-source-diagnostic',
    });
    trace.mutationEvidence.contract.declaredAt = -20;
    trace.events[1].time = -20;
    trace.events[1].values.contract = rowMutationContractFingerprint(
      trace.mutationEvidence.contract
    );
    trace.events.sort((a, b) => a.time - b.time);
    expect(qualifyEvidence(trace).status).toBe('recorded-sampled-pass');
  });

  it.each([
    [
      'missing mutation scope',
      (trace) => {
        delete trace.mutationScope;
      },
    ],
    [
      'foreign mutation scope',
      (trace) => {
        trace.mutationScope = 'channel-B/view-1';
      },
    ],
    [
      'a first-effect proof without a semantic plan',
      (trace) => {
        delete trace.mutationEvidence.contract;
      },
    ],
    [
      'a baseline-only semantic proof',
      (trace) => {
        trace.mutationEvidence.semanticSamples =
          trace.mutationEvidence.semanticSamples.slice(0, 1);
      },
    ],
    [
      'a posthoc expected revision',
      (trace) => {
        trace.mutationEvidence.contract.phases[0].revision = 'any-revision';
      },
    ],
    [
      'an earlier unrelated action',
      (trace) => {
        trace.events.unshift({
          time: -30,
          name: 'scroll-request',
          values: { target: 'latest' },
        });
      },
    ],
    [
      'an earlier unknown render',
      (trace) => {
        trace.events.unshift({
          time: -30,
          name: 'row-commit',
          values: { key: 'other', commitId: 'other' },
        });
      },
    ],
    [
      'an earlier unrelated layout',
      (trace) => {
        trace.events.unshift({
          time: -30,
          name: 'row-layout',
          values: { key: 'target', height: 30 },
        });
      },
    ],
    [
      'a callback after the captured interval',
      (trace) => {
        trace.events.push({
          time: 2801,
          name: 'row-layout',
          values: { key: 'target', height: 30 },
        });
      },
    ],
    [
      'a request after declared action completion',
      (trace) => {
        trace.expectations.action.completedAt = 205;
      },
    ],
    [
      'a request before declared action start',
      (trace) => {
        trace.expectations.action.startedAt = 215;
      },
    ],
    [
      'stable semantics declared before action completion',
      (trace) => {
        trace.expectations.action.completedAt = 301;
      },
    ],
    [
      'a semantic tail detached from geometry coverage',
      (trace) => {
        trace.mutationEvidence.contract.coverage.endTime = 2750;
        trace.mutationEvidence.contract.phases[0].observationWindow.endTime = 2750;
        trace.mutationEvidence.contract.deferredUntil = 1700;
        trace.events[1].values.contract = rowMutationContractFingerprint(
          trace.mutationEvidence.contract
        );
      },
    ],
    [
      'a declared commit without required resize',
      (trace) => {
        trace.mutationEvidence.contract.phases[0].effect = 'commit';
        trace.events[1].values.contract = rowMutationContractFingerprint(
          trace.mutationEvidence.contract
        );
      },
    ],
    [
      'missing actual phase layout',
      (trace) => {
        trace.events = trace.events.filter(
          (event) => event.name !== 'row-layout'
        );
      },
    ],
    [
      'a semantic sample referencing an old commit',
      (trace) => {
        trace.mutationEvidence.semanticSamples[30].commitId = 'baseline-commit';
      },
    ],
    [
      'an invalid semantic acquisition',
      (trace) => {
        trace.mutationEvidence.semanticSamples[30].measurement.valid = false;
      },
    ],
  ])('does not qualify %s despite producer PASS', (_name, corrupt) => {
    const trace = strictNativeMutation();
    corrupt(trace);
    syncNativeMutation(trace);
    expect(classifyEvidence(trace)).toBe('incomplete');
    expect(qualifyEvidence(trace).status).toBe('incomplete');
  });

  it('retains a strict stale terminal semantic failure despite producer PASS', () => {
    const trace = strictNativeMutation();
    const stale = { ...trace.events[0].values, commitId: 'stale-terminal' };
    trace.events.push({ time: 1500, name: 'row-commit', values: stale });
    for (const sample of trace.mutationEvidence.semanticSamples)
      if (sample.time >= 1500) {
        sample.requestId = stale.requestId;
        sample.revision = stale.revision;
        sample.commitId = stale.commitId;
        sample.state.signature = {
          content: stale.content,
          reactions: stale.reactions,
          replies: stale.replies,
        };
      }
    expect(trace.result.verdict).toBe('PASS');
    expect(classifyEvidence(trace)).toBe('fail');
    expect(qualifyEvidence(trace)).toMatchObject({
      status: 'fail',
      issues: ['stale-skipped-or-undeclared-semantic-revision'],
    });
    const report = createCoverageReport({
      ...input,
      registry: [{ ...input.registry[0], scenario: 'history-grow' }],
      evidence: [{ source: 'stale-semantic.json', value: trace }],
    });
    expect(report.scenarios[0].runs[0]).toMatchObject({
      reportedVerdict: 'PASS',
      status: 'fail',
      qualifiedStatus: 'fail',
    });
  });

  it('detects transient stale terminal commits between samples rather than trusting the latest render only', () => {
    const trace = strictNativeMutation();
    trace.events.push({
      time: 1510,
      name: 'row-commit',
      values: { ...trace.events[0].values, commitId: 'stale' },
    });
    trace.events.push({
      time: 1511,
      name: 'row-commit',
      values: { ...trace.events[3].values, commitId: 'restored' },
    });
    for (const sample of trace.mutationEvidence.semanticSamples)
      if (sample.time >= 1511) sample.commitId = 'restored';
    expect(qualifyEvidence(trace).status).toBe('fail');
  });

  it('keeps a stale-content observation incomplete when its geometry capture is invalid', () => {
    const trace = strictNativeMutation();
    trace.events.push({
      time: 1510,
      name: 'row-commit',
      values: { ...trace.events[0].values, commitId: 'stale' },
    });
    trace.samples[40].measurement.valid = false;
    expect(qualifyEvidence(trace).status).toBe('incomplete');
  });

  it('preserves raw geometry failures while refusing to upgrade legacy semantic evidence', () => {
    const trace = strictNativeMutation();
    trace.samples[30].rows[0].y += 5;
    trace.result = assessScrollTrace(trace.samples, trace.expectations);
    expect(trace.result.verdict).toBe('FAIL');
    expect(qualifyEvidence(trace).status).toBe('fail');
    delete trace.mutationEvidence.contract;
    expect(classifyEvidence(trace)).toBe('fail');
    expect(qualifyEvidence(trace).status).toBe('incomplete');
  });

  it('requires real matched keyboard events and measured change despite a passing contract', () => {
    const make = () => {
      const trace = passedTrace();
      trace.scenario = 'keyboard-end';
      trace.samples = Array.from({ length: 91 }, (_, index) => ({
        ...structuredClone(trace.baseline),
        time: index * 50,
        keyboardHeight: index ? 300 : 0,
      }));
      trace.baseline = trace.samples[0];
      trace.expectations.action.name = trace.scenario;
      trace.expectations.coverage.endTime = 4500;
      trace.expectations.bottom.startTime = 4200;
      trace.baselinePreconditions.requireInitialEnd = true;
      trace.baselinePreconditions.initialTailKey = 'scroll-fixture-119';
      trace.events = [
        { time: 1, name: 'keyboardWillShow' },
        { time: 50, name: 'keyboardDidShow' },
      ];
      trace.result = assessScrollTrace(trace.samples, trace.expectations);
      return trace;
    };
    expect(classifyEvidence(make())).toBe('recorded-sampled-pass');
    for (const corrupt of [
      (trace) => {
        trace.events.shift();
      },
      (trace) => {
        trace.events[1].name = 'keyboardDidHide';
      },
      (trace) => {
        trace.samples.forEach((sample) => {
          sample.keyboardHeight = 0;
        });
      },
    ]) {
      const trace = make();
      corrupt(trace);
      expect(classifyEvidence(trace)).toBe('incomplete');
    }
  });

  it('rejects a shortened otherwise passing self-declared capture contract', () => {
    const trace = passedTrace();
    trace.samples = trace.samples.slice(0, 3);
    trace.expectations.coverage.endTime = 100;
    delete trace.expectations.bottom.startTime;
    trace.result = assessScrollTrace(trace.samples, trace.expectations);
    expect(trace.result.verdict).toBe('PASS');
    expect(trace.result.metrics.samples).toBe(3);
    expect(classifyEvidence(trace)).toBe('incomplete');
  });

  it('replays raw native geometry instead of trusting a stale PASS flag', () => {
    const corruptions = [
      (trace) => {
        delete trace.expectations;
      },
      (trace) => {
        delete trace.assertionSchemaVersion;
      },
      (trace) => {
        delete trace.followingOffsetThroughout;
      },
      (trace) => {
        trace.result.metrics.maxSampleGapMs = 0;
      },
      (trace) => {
        trace.samples = [0, 50, 100].map((time) => ({
          time,
          measurement: { valid: true },
        }));
        trace.result.metrics.samples = 3;
      },
      (trace) => {
        delete trace.samples[2].scroll;
      },
      (trace) => {
        trace.samples[2].measurement.durationMs = 33;
      },
      (trace) => {
        trace.samples[2].time = 49;
      },
      (trace) => {
        trace.expectations.coverage.endTime = 3000;
      },
      (trace) => {
        trace.events = [];
      },
      (trace) => {
        trace.committedDataKeys = [];
      },
      (trace) => {
        trace.samples = trace.samples.slice(0, 3);
        trace.expectations.coverage.endTime = 100;
        trace.expectations.action.completedAt = 0;
        trace.expectations.bottom.startTime = 0;
        trace.result.metrics.samples = 3;
      },
      (trace) => {
        trace.expectations.action.observed = false;
      },
      (trace) => {
        trace.expectations.bottom.tolerancePt = 20;
      },
      (trace) => {
        trace.expectations.coverage.maxGapMs = 1000;
      },
      (trace) => {
        trace.expectations.coverage.maxMeasurementDurationMs = 1000;
      },
      (trace) => {
        delete trace.expectations.bottom;
      },
      (trace) => {
        trace.samples[6].rows = [];
      },
      (trace) => {
        trace.samples[6].scroll = 895;
      },
      (trace) => {
        trace.samples[6].rows[0].y = 90;
      },
      (trace) => {
        trace.samples[6].scrollBounds.max = 1000;
      },
    ];
    for (const corrupt of corruptions) {
      const trace = passedTrace();
      corrupt(trace);
      expect(classifyEvidence(trace)).not.toBe('recorded-sampled-pass');
    }
    const drift = passedTrace();
    drift.scenario = 'test-hold';
    drift.expectations.action.name = drift.scenario;
    drift.assertion = 'hold';
    delete drift.expectations.bottom;
    drift.expectations.anchor = { key: 'scroll-fixture-119', baselineY: 70 };
    drift.baselinePreconditions.requireReadingAnchor = true;
    drift.baselinePreconditions.readingAnchorKey = 'scroll-fixture-119';
    drift.samples[4].rows[0].y -= 4;
    expect(classifyEvidence(drift)).toBe('fail');
    const wrongTarget = passedTrace();
    wrongTarget.scenario = 'test-target';
    wrongTarget.expectations.action.name = wrongTarget.scenario;
    wrongTarget.assertion = 'target';
    delete wrongTarget.expectations.bottom;
    wrongTarget.expectations.landing = {
      key: 'scroll-fixture-119',
      alignment: 'center',
      settleStartTime: 200,
    };
    wrongTarget.samples[6].scroll = 800;
    expect(classifyEvidence(wrongTarget)).toBe('fail');
  });

  it('keeps a catalog entry distinct from execution and lists untouched families', () => {
    const report = createCoverageReport(input);
    expect(report.counts.executedSlices).toBe(0);
    expect(report.counts.recordedSampledPasses).toBe(0);
    expect(report.scenarios[0].status).toBe('not-run');
    expect(report.families[1]).toMatchObject({
      family: 'THR',
      mappedSlices: 0,
      unmappedIds: ['THR-01'],
      fullAcceptanceVerified: false,
    });
  });

  it('never promotes one successful variant to a complete matrix/history row or native presentation proof', () => {
    const report = createCoverageReport({
      ...input,
      evidence: [{ source: 'trace.json', value: passedTrace() }],
    });
    expect(report.counts.recordedSampledPasses).toBe(1);
    expect(report.matrix[0].recordedSampledPasses).toEqual(['entry-latest']);
    expect(report.matrix[0].fullAcceptanceVerified).toBe(false);
    expect(report.history[0].fullAcceptanceVerified).toBe(false);
    expect(report.fullMatrixVerified).toBe(false);
    expect(report.nativePresentation).toBe('INCOMPLETE');
  });

  it('does not accept a suite summary counter in place of the actual trace', () => {
    const report = createCoverageReport({
      ...input,
      evidence: [
        {
          source: 'suite.json',
          value: {
            fixtureVersion: 2,
            platform: 'ios',
            results: [{ ...passedTrace(), verdict: 'PASS', samples: 3 }],
          },
        },
      ],
    });
    expect(report.scenarios[0].status).toBe('incomplete');
    expect(report.counts.recordedSampledPasses).toBe(0);
  });

  it('keeps manual observation separate from asserted geometry', () => {
    expect(classifyEvidence({ ...passedTrace(), assertion: 'observe' })).toBe(
      'observed'
    );
    expect(classifyEvidence({ ...passedTrace(), fixtureVersion: 1 })).toBe(
      'incomplete'
    );
    expect(classifyEvidence({ ...passedTrace(), result: null })).toBe(
      'incomplete'
    );
  });

  it('joins a collected suite summary to its exact run detail without masking failures', () => {
    const detail = { ...passedTrace(), runId: 'run-a' };
    const summary = {
      runId: 'run-a',
      fixtureVersion: 2,
      platform: 'ios',
      results: [
        {
          scenario: detail.scenario,
          verdict: 'PASS',
          result: detail.result,
          samples: 3,
        },
      ],
    };
    const report = createCoverageReport({
      ...input,
      evidence: [
        { source: 'suite.json', value: summary },
        { source: 'trace.json', value: detail },
      ],
    });
    expect(report.scenarios[0].status).toBe('recorded-sampled-pass');
    expect(report.scenarios[0].runs[0].supersededSummary).toBe(true);
    summary.results[0].verdict = 'FAIL';
    expect(
      createCoverageReport({
        ...input,
        evidence: [
          { source: 'suite.json', value: summary },
          { source: 'trace.json', value: detail },
        ],
      }).scenarios[0].status
    ).toBe('fail');
  });

  it('does not use a different run to fill missing summary evidence', () => {
    const report = createCoverageReport({
      ...input,
      evidence: [
        {
          source: 'suite.json',
          value: {
            runId: 'run-a',
            fixtureVersion: 2,
            platform: 'ios',
            results: [
              { scenario: 'entry-latest', verdict: 'PASS', samples: 3 },
            ],
          },
        },
        { source: 'trace.json', value: { ...passedTrace(), runId: 'run-b' } },
      ],
    });
    expect(report.scenarios[0].status).toBe('incomplete');
  });

  it('rejects inconsistent verdicts, missing measurements and out-of-order samples', () => {
    const trace = passedTrace();
    trace.result.issues.push({ kind: 'failure' });
    expect(classifyEvidence(trace)).toBe('fail');
    expect(classifyEvidence({ ...passedTrace(), samples: [] })).toBe(
      'incomplete'
    );
    expect(
      classifyEvidence({
        ...passedTrace(),
        samples: passedTrace().samples.toReversed(),
      })
    ).toBe('incomplete');
    expect(
      classifyEvidence({
        ...passedTrace(),
        samples: [0, 50, 100].map((time) => ({ time })),
      })
    ).toBe('incomplete');
  });

  it('keeps an unestablished history baseline incomplete despite diagnostic residuals', () => {
    const trace = passedTrace();
    trace.result.verdict = 'INCOMPLETE';
    trace.result.passed = false;
    trace.result.issues = [
      { kind: 'failure', code: 'anchor-drift' },
      { kind: 'incomplete', code: 'history-precondition-not-established' },
    ];
    const report = createCoverageReport({
      ...input,
      evidence: [{ source: 'unestablished-history.json', value: trace }],
    });
    expect(report.scenarios[0].status).toBe('incomplete');
    expect(report.counts.failingSlices).toBe(0);
    expect(report.counts.incompleteSlices).toBe(1);
    expect(report.counts.recordedSampledPasses).toBe(0);
    expect(coverageReportExitCode(report)).toBe(1);
    // A genuine recorded FAIL still wins even if it includes that diagnostic.
    expect(classifyEvidence({ ...trace, verdict: 'FAIL' })).toBe('fail');
    expect(
      classifyEvidence({
        ...trace,
        result: { ...trace.result, verdict: 'FAIL' },
      })
    ).toBe('fail');
  });

  it('never accepts incomplete results or an arbitrary incomplete label as a pass', () => {
    expect(classifyEvidence({ ...passedTrace(), verdict: 'INCOMPLETE' })).toBe(
      'incomplete'
    );
    const trace = passedTrace();
    trace.result.verdict = 'INCOMPLETE';
    trace.result.passed = false;
    trace.result.issues = [{ kind: 'failure', code: 'anchor-drift' }];
    expect(classifyEvidence(trace)).toBe('fail');
    trace.result.issues.push({ kind: 'incomplete', code: 'action-error' });
    expect(classifyEvidence(trace)).toBe('fail');
  });

  it('retains a failure when a later rerun passes', () => {
    const failed = passedTrace();
    failed.result.verdict = 'FAIL';
    const report = createCoverageReport({
      ...input,
      evidence: [
        { source: 'failed.json', value: failed },
        { source: 'passed.json', value: passedTrace() },
      ],
    });
    expect(report.scenarios[0].status).toBe('fail');
    expect(report.scenarios[0].runs).toHaveLength(2);
    expect(report.counts.recordedSampledPasses).toBe(0);
  });

  it('retains unregistered results for audit rather than counting them as coverage', () => {
    const report = createCoverageReport({
      ...input,
      evidence: [
        {
          source: 'new.json',
          value: { ...passedTrace(), scenario: 'new-action' },
        },
      ],
    });
    expect(report.unregisteredEvidence).toHaveLength(1);
    expect(report.counts.executedSlices).toBe(0);
  });

  it('detects missing, duplicated and mistyped scenario definitions', () => {
    expect(() => parseScenarioIds('| ENT-01 | x |\n| ENT-01 | y |')).toThrow(
      'Duplicate'
    );
    expect(() =>
      createCoverageReport({ ...input, matrixMarkdown: '' })
    ).toThrow('must each define');
    expect(() =>
      createCoverageReport({
        ...input,
        registry: [{ ...input.registry[0], matrix: ['ENT-99'] }],
      })
    ).toThrow('unknown matrix ID');
    expect(() =>
      createCoverageReport({
        ...input,
        registry: [{ ...input.registry[0], history: ['REG-999'] }],
      })
    ).toThrow('unknown history ID');
  });

  it('accounts for every currently documented row, including stateful content and accessibility', () => {
    const root = new URL('../../../', import.meta.url);
    const matrixMarkdown = readFileSync(
      fileURLToPath(new URL('docs/tlon-apps/scroller-test-matrix.md', root)),
      'utf8'
    );
    const historyMarkdown = readFileSync(
      fileURLToPath(
        new URL('docs/tlon-apps/scroller-regression-history.md', root)
      ),
      'utf8'
    );
    const report = createCoverageReport({ matrixMarkdown, historyMarkdown });
    expect(report.counts.documentedHistoryRows).toBeGreaterThanOrEqual(86);
    expect(report.matrix).toHaveLength(parseScenarioIds(matrixMarkdown).length);
    expect(report.families.map((family) => family.family)).toEqual(
      expect.arrayContaining(['A11Y', 'STA', 'THR', 'UNR', 'RAC'])
    );
    expect(report.counts.executedSlices).toBe(0);
  });
});

// These are importer controls, not measurements of a native product view.
const withCoherentNativeAcquisition = () => {
  const trace = passedTrace();
  trace.nativeGeometrySchemaVersion = 1;
  const view = (identity, y, height, descendantOfScroll) => ({
    identity,
    windowIdentity: 'native-window',
    frame: { x: 0, y, width: 400, height },
    clipFrame: { x: 0, y, width: 400, height },
    attached: true,
    effectiveAlpha: 1,
    hidden: false,
    translationOnly: true,
    descendantOfScroll,
  });
  trace.samples = trace.samples.map((sample, index) => {
    const request = {
      requestId: `capture-${index}`,
      rootId: 'fixture-root-1',
      scrollViewId: 'conversation-native',
      composerId: 'composer-native',
      rows: sample.rows.map((row) => ({ key: row.key, id: `row-${row.key}` })),
    };
    const capture = {
      version: 1,
      requestId: request.requestId,
      rootId: request.rootId,
      scrollViewId: request.scrollViewId,
      composerId: request.composerId,
      rowIds: request.rows.map((row) => row.id),
      clock: 'CACurrentMediaTime milliseconds',
      coordinateSpace: 'window-model-points',
      startedAt: 100000 + sample.time - 1,
      finishedAt: 100000 + sample.time,
      status: 'ok',
      issues: [],
      visitedViews: 100,
      root: view('root', 0, 800, false),
      composer: view('composer', sample.viewportBottom, 60, false),
      scroll: {
        view: view('scroll', sample.viewportTop, sample.viewportHeight, true),
        hostIdentity: 'scroll-host',
        offset: { x: 0, y: sample.scroll },
        contentSize: { width: 400, height: sample.contentLength },
        bounds: {
          x: 0,
          y: sample.scroll,
          width: 400,
          height: sample.viewportHeight,
        },
        contentInset: { top: 0, right: 0, bottom: 0, left: 0 },
        adjustedContentInset: { top: 0, right: 0, bottom: 0, left: 0 },
        zoomScale: 1,
        tracking: false,
        dragging: false,
        decelerating: false,
      },
      rows: sample.rows.map((row) => ({
        id: `row-${row.key}`,
        matches: 1,
        view: view(`native-row-${row.key}`, row.y, row.height, true),
      })),
    };
    return adaptNativeScrollGeometry(capture, request, {
      requestedAt: sample.time - 1,
      receivedAt: sample.time,
      requiredKeys: [],
      populated: true,
    }).snapshot;
  });
  trace.baseline = trace.samples[0];
  trace.result = assessScrollTrace(trace.samples, trace.expectations);
  return trace;
};

describe('native main-thread acquisition import', () => {
  it('independently replays a healthy versioned native acquisition', () => {
    const trace = withCoherentNativeAcquisition();
    expect(trace.result.verdict).toBe('PASS');
    expect(assessNativeEvidence(trace)).toMatchObject({
      status: 'recorded-sampled-pass',
      geometryEvidenceLevel: 'ios-main-thread-model',
    });
  });
  it('replays the actual serialized JSON round trip with a zero native top inset', () => {
    const trace = withCoherentNativeAcquisition();
    expect(Object.is(trace.samples[0].scrollBounds.min, -0)).toBe(true);
    const serialized = JSON.parse(JSON.stringify(trace));
    expect(Object.is(serialized.samples[0].scrollBounds.min, -0)).toBe(false);
    expect(assessNativeEvidence(serialized).status).toBe(
      'recorded-sampled-pass'
    );
  });
  it('preserves nonzero native inset bounds across serialized replay', () => {
    const trace = withCoherentNativeAcquisition();
    for (const sample of trace.samples) {
      const e = sample.acquisition.nativeGeometry;
      e.capture.scroll.contentInset.top = 25;
      e.capture.scroll.adjustedContentInset.top = 25;
      Object.assign(
        sample,
        adaptNativeScrollGeometry(e.capture, e.request, e.bracket).snapshot
      );
    }
    const serialized = JSON.parse(JSON.stringify(trace));
    expect(serialized.samples[0].scrollBounds.min).toBe(-25);
    expect(assessNativeEvidence(serialized).status).toBe(
      'recorded-sampled-pass'
    );
    serialized.samples[2].scrollBounds.min = -25.000000001;
    expect(assessNativeEvidence(serialized).status).toBe('incomplete');
  });
  it('does not hide a coherent position violation after JSON serialization', () => {
    const trace = withCoherentNativeAcquisition();
    const sample = trace.samples.at(-1);
    const e = sample.acquisition.nativeGeometry;
    e.capture.scroll.offset.y -= 15;
    e.capture.scroll.bounds.y -= 15;
    e.capture.rows[0].view.frame.y += 15;
    e.capture.rows[0].view.clipFrame.y += 15;
    e.capture.rows[0].view.clipFrame.height -= 15;
    Object.assign(
      sample,
      adaptNativeScrollGeometry(e.capture, e.request, e.bracket).snapshot
    );
    expect(assessNativeEvidence(JSON.parse(JSON.stringify(trace))).status).toBe(
      'fail'
    );
  });
  it('keeps old sampled snapshots explicitly labeled as mixed-source diagnostics', () => {
    expect(assessNativeEvidence(passedTrace())).toMatchObject({
      status: 'recorded-sampled-pass',
      geometryEvidenceLevel: 'legacy-mixed-source-diagnostic',
    });
  });
  const faults = [
    [
      'missing acquisition',
      (trace) => {
        delete trace.samples[2].acquisition.nativeGeometry;
      },
    ],
    [
      'deleted new schema',
      (trace) => {
        delete trace.nativeGeometrySchemaVersion;
      },
    ],
    [
      'unknown new schema',
      (trace) => {
        trace.nativeGeometrySchemaVersion = 2;
      },
    ],
    [
      'mismatched offset',
      (trace) => {
        trace.samples[2].scroll -= 5;
      },
    ],
    [
      'mismatched row position',
      (trace) => {
        trace.samples[2].rows[0].y += 5;
      },
    ],
    [
      'invented extent',
      (trace) => {
        trace.samples[2].contentLength += 5;
      },
    ],
    [
      'invented legal bound',
      (trace) => {
        trace.samples[2].scrollBounds.max += 5;
      },
    ],
    [
      'invented count',
      (trace) => {
        trace.samples[2].acquisition.measuredRowCount = 999;
      },
    ],
    [
      'unavailable capture with forged valid bit',
      (trace) => {
        trace.samples[2].acquisition.nativeGeometry.capture.status =
          'unavailable';
      },
    ],
    [
      'scope mismatch',
      (trace) => {
        trace.samples[2].acquisition.nativeGeometry.capture.rootId =
          'foreign-root';
      },
    ],
    [
      'stale native operation',
      (trace) => {
        const e = trace.samples[2].acquisition.nativeGeometry;
        e.capture.startedAt = 999;
        e.capture.finishedAt = 1000;
      },
    ],
    [
      'reused native request',
      (trace) => {
        const e = trace.samples[2].acquisition.nativeGeometry;
        e.request.requestId = 'capture-1';
        e.capture.requestId = 'capture-1';
      },
    ],
    [
      'overlapping JS bridge intervals',
      (trace) => {
        trace.samples[2].acquisition.nativeGeometry.bracket.requestedAt = 49;
      },
    ],
    [
      'erased acquisition duration',
      (trace) => {
        trace.samples[2].measurement.durationMs = 0;
      },
    ],
    [
      'wrong coordinate model',
      (trace) => {
        trace.samples[2].acquisition.nativeGeometry.capture.coordinateSpace =
          'presentation';
      },
    ],
    [
      'erased ownership disagreement',
      (trace) => {
        trace.samples[2].acquisition.nativeGeometry.issues = [
          'native-js-ownership-changed',
        ];
      },
    ],
  ];
  it.each(faults)(
    'rejects %s even with a declared producer PASS',
    (_name, mutate) => {
      const trace = withCoherentNativeAcquisition();
      expect(assessNativeEvidence(trace).status).toBe('recorded-sampled-pass');
      mutate(trace);
      expect(assessNativeEvidence(trace).status).toBe('incomplete');
    }
  );
  it('retains a genuine native end-position violation after coherent raw acquisition replay', () => {
    const trace = withCoherentNativeAcquisition();
    const sample = trace.samples.at(-1);
    const e = sample.acquisition.nativeGeometry;
    e.capture.scroll.offset.y -= 15;
    e.capture.scroll.bounds.y -= 15;
    e.capture.rows[0].view.frame.y += 15;
    e.capture.rows[0].view.clipFrame.y += 15;
    e.capture.rows[0].view.clipFrame.height -= 15;
    Object.assign(
      sample,
      adaptNativeScrollGeometry(e.capture, e.request, e.bracket).snapshot
    );
    expect(trace.result.verdict).toBe('PASS');
    expect(assessNativeEvidence(trace).status).toBe('fail');
  });
});

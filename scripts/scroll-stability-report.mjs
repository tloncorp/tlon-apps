#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessNativeEvidence } from './scroll-stability-native-evidence.mjs';
import {
  assessWebEvidence,
  readPlaywrightReport,
  webScenarioRegistry,
} from './scroll-stability-web-evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = 'packages/app/fixtures/ScrollStability.fixture.tsx';
const entry = (scenario, matrix, history, scope) => ({
  scenario,
  matrix,
  history,
  scope,
  source: fixture,
  evidenceLevel: 'sampled-geometry',
});

// These are implemented fixture actions, each only a slice of the linked rows.
// Related history is a replay lead, never a claim that the whole bug is covered.
export const nativeScenarioRegistry = [
  entry('entry-latest', ['ENT-01'], [], 'Mixed-height channel latest entry'),
  entry('entry-selected', ['ENT-03'], ['REG-026'], 'Loaded selected row entry'),
  entry(
    'entry-delayed',
    ['ENT-04'],
    ['REG-015'],
    'Delayed first data at latest'
  ),
  entry('entry-empty', ['ENT-01'], [], 'Empty-entry observation only'),
  entry(
    'empty-first-post',
    ['ENT-08'],
    ['REG-015'],
    'Thinking removal and first post'
  ),
  entry(
    'thinking-empty-show-hide',
    ['THK-01'],
    [],
    'Forced-label production ThinkingState show/hide in an empty list; no computing presence or grace-period coverage'
  ),
  ...['end', 'history'].flatMap((position) => [
    entry(
      `thinking-show-hide-${position}`,
      [position === 'end' ? 'THK-02' : 'THK-03'],
      [],
      `Forced-label production ThinkingState 52/0 layout lifecycle at ${position}; no computing presence or grace-period coverage`
    ),
    ...['message-first', 'same-frame', 'hide-first'].map((order) =>
      entry(
        `thinking-handoff-${order}-${position}`,
        ['THK-04', position === 'end' ? 'THK-02' : 'THK-03'],
        [],
        `Forced-label ThinkingState and synthetic message ${order} handoff at ${position}; no network/bot process coverage`
      )
    ),
    entry(
      `thinking-label-${position}`,
      ['THK-05'],
      [],
      `Production ThinkingState forced label commits retain fixed footer geometry at ${position}; no glyph clipping/accessibility proof`
    ),
    entry(
      `armed-thinking-keyboard-${position}`,
      ['THK-07', 'RAC-25'],
      [],
      `Armed forced-label ThinkingState race at ${position}; device runner must supply real keyboard/composer resize with temporal overlap`
    ),
  ]),
  entry(
    'armed-thinking-gesture',
    ['THK-06', 'RAC-26'],
    [],
    'Armed forced-label ThinkingState layout inside a real drag; sampled row/native-offset consistency, not finger-trajectory or requested-direction proof'
  ),
  entry(
    'armed-image-load-gesture',
    ['STA-01'],
    [],
    'One real gated ImageBlock load released and resized inside an actual drag interval; sampled row/native-offset consistency, no finger-trajectory, multi-row, momentum, failure or retry proof'
  ),
  ...['end', 'history'].flatMap((position) => [
    entry(
      `armed-image-load-keyboard-${position}`,
      ['STA-01', 'KEY-01', 'RAC-05'],
      [],
      `One gated ImageBlock load overlaps a matched real keyboard transition at ${position}; pairwise-only, no combined composer/keyboard/image ordering coverage`
    ),
    entry(
      `armed-image-load-composer-${position}`,
      ['STA-01', 'CMP-01', 'RAC-05'],
      [],
      `One gated ImageBlock load overlaps real composer input-to-height-layout at ${position}; sampled pairwise overlap only, no native animation-frame or three-way ordering proof`
    ),
  ]),
  entry(
    'prepend-history',
    ['DAT-03'],
    [],
    'One synthetic older-page insertion at rest'
  ),
  ...['end', 'history'].flatMap((position) => [
    entry(
      `append-${position}`,
      ['DAT-01'],
      [],
      `Single synthetic append at ${position}`
    ),
    entry(
      `burst-${position}`,
      ['DAT-02'],
      [],
      `Ten staggered synthetic appends at ${position}`
    ),
    entry(
      `stateful-image-load-${position}`,
      ['STA-01', 'CNT-06'],
      ['REG-063'],
      `One gated image onLoad size change at ${position}, with stable post props; no multi-row or momentum coverage`
    ),
    entry(
      `keyboard-${position}`,
      ['KEY-01'],
      ['REG-002'],
      `Armed capture at ${position}; device runner must focus/dismiss the real keyboard`
    ),
    entry(
      `composer-${position}`,
      ['CMP-01'],
      ['REG-001', 'REG-004'],
      `Armed capture at ${position}; device runner must actually type/delete and change measured input height`
    ),
  ]),
  ...['near', 'history'].flatMap((position) => [
    ...['grow', 'shrink'].map((mutation) =>
      entry(
        `${position}-${mutation}`,
        ['DAT-07'],
        [],
        `Prop-driven visible non-anchor row ${mutation} at ${position}; measured relation to the reading witness is recorded`
      )
    ),
    entry(
      `${position}-media`,
      ['DAT-07', 'CNT-06'],
      ['REG-063'],
      `Prop-driven visible non-anchor image replacement at ${position}; measured witness relation is recorded, not an onLoad lifecycle replay`
    ),
    entry(
      `${position}-reference`,
      ['DAT-07', 'CNT-11'],
      [],
      `Prop-driven visible non-anchor reference replacement at ${position}; measured witness relation is recorded`
    ),
    entry(
      `${position}-remove`,
      ['DAT-08'],
      [],
      `Remove a visible non-anchor row at ${position}; measured witness relation is recorded`
    ),
    entry(
      `${position}-reaction`,
      ['DAT-12'],
      [],
      `Synthetic visible non-anchor reaction update at ${position}; measured witness relation is recorded`
    ),
    entry(
      `${position}-reply`,
      ['DAT-12'],
      [],
      `Synthetic visible non-anchor reply-count update at ${position}; measured witness relation is recorded`
    ),
    entry(
      `${position}-cache`,
      ['DAT-14'],
      [],
      `Fixture visible non-anchor row cache update at ${position}; measured witness relation is recorded`
    ),
  ]),
  entry(
    'dismiss-history',
    ['KEY-01'],
    [],
    'Dismiss command; must actually begin with an open keyboard'
  ),
  entry(
    'armed-growth',
    ['GES-03'],
    ['REG-003'],
    'Manual gesture with scheduled mutation; observation only'
  ),
  entry(
    'gesture',
    ['GES-01'],
    [],
    'Real history drag with sampled row/native-offset displacement consistency; no finger-trajectory or requested-direction proof'
  ),
  entry('keyboard', ['KEY-01'], [], 'Manual keyboard observation only'),
  entry(
    'media-return',
    ['ATT-07'],
    [],
    'Manual external-media return observation only'
  ),
];

export const scenarioRegistry = [
  ...nativeScenarioRegistry,
  ...webScenarioRegistry,
];

export function parseScenarioIds(markdown) {
  const ids = [
    ...markdown.matchAll(/^\|\s*([A-Z][A-Z0-9]*-\d{2,3})(?=\s*(?:\||·))/gm),
  ].map((match) => match[1]);
  if (new Set(ids).size !== ids.length)
    throw new Error('Duplicate documented scenario ID');
  return ids;
}

function flattenEvidence(
  value,
  source,
  inherited = {},
  registry = scenarioRegistry
) {
  if (Array.isArray(value))
    return value.flatMap((item) =>
      flattenEvidence(item, source, inherited, registry)
    );
  if (!value || typeof value !== 'object')
    throw new Error(`${source}: expected a trace or suite object`);
  if (Array.isArray(value.suites))
    return readPlaywrightReport(value, source, registry);
  if (Array.isArray(value.results)) {
    const metadata = {
      platform: value.platform,
      fixtureVersion: value.fixtureVersion,
      runId: value.runId,
    };
    return value.results.flatMap((item) =>
      flattenEvidence(item, source, metadata, registry)
    );
  }
  if (typeof value.scenario !== 'string')
    throw new Error(`${source}: missing scenario name`);
  return [{ ...inherited, ...value, source }];
}

export function classifyEvidence(trace) {
  if (trace.kind === 'playwright') return assessWebEvidence(trace).status;
  const result = trace.result;
  if (trace.verdict === 'FAIL' || result?.verdict === 'FAIL') return 'fail';
  // An explicit failed precondition disqualifies the scenario, while the
  // producer may retain geometry residuals as diagnostics. Raw FAIL still wins.
  if (
    result?.verdict === 'INCOMPLETE' &&
    result?.passed === false &&
    Array.isArray(result?.issues) &&
    result.issues.some(
      (issue) =>
        issue.kind === 'incomplete' &&
        [
          'history-precondition-not-established',
          'initial-end-precondition-not-established',
          'reading-anchor-precondition-not-established',
          'baseline-measurement-invalid',
          'mutation-not-witnessed',
        ].includes(issue.code)
    )
  )
    return 'incomplete';
  if (
    Array.isArray(result?.issues) &&
    result.issues.some((issue) => issue.kind === 'failure')
  )
    return 'fail';
  if (trace.verdict === 'INCOMPLETE' || result?.verdict === 'INCOMPLETE')
    return 'incomplete';
  if (trace.assertion === 'observe' || trace.verdict === 'OBSERVED')
    return 'observed';
  if (
    trace.fixtureVersion !== 2 ||
    !['ios', 'android'].includes(trace.platform) ||
    !Array.isArray(trace.samples) ||
    trace.samples.length < 3 ||
    !['hold', 'bottom', 'target', 'gesture'].includes(trace.assertion) ||
    result?.verdict !== 'PASS' ||
    result?.passed !== true ||
    result?.evidenceLevel !== 'sampled-geometry' ||
    !Array.isArray(result?.issues) ||
    result.issues.length !== 0 ||
    result?.metrics?.samples !== trace.samples.length ||
    trace.samples.some(
      (sample, index) =>
        sample.measurement?.valid !== true ||
        !Number.isFinite(sample.time) ||
        (index > 0 && sample.time <= trace.samples[index - 1].time)
    )
  )
    return 'incomplete';
  return assessNativeEvidence(trace).status;
}

/** Keep raw failures while separating whether the named product scope ran. */
export function qualifyEvidence(trace) {
  if (trace.kind === 'playwright') return assessWebEvidence(trace);
  if (trace.assertion === 'observe')
    return {
      status: 'observed',
      issues: ['Manual observation is not asserted product geometry'],
    };
  if (
    trace.fixtureVersion !== 2 ||
    !['ios', 'android'].includes(trace.platform)
  )
    return {
      status: 'incomplete',
      issues: ['Unsupported native fixture identity'],
    };
  if (
    trace.scenario?.startsWith('near-') ||
    trace.positioningCoverage === 'programmatic-near-end-no-user-drag'
  )
    return {
      status: 'incomplete',
      issues: [
        'Programmatic near-end setup does not establish deliberate user READ inside the follow threshold; raw geometry is retained separately',
      ],
    };
  const replay = assessNativeEvidence(trace);
  if (replay.status !== 'recorded-sampled-pass') return replay;
  if (classifyEvidence(trace) === 'recorded-sampled-pass') return replay;
  return {
    status: 'incomplete',
    issues: [
      'The recorded non-pass is not reproduced by the serialized raw contract; its original verdict remains retained',
    ],
  };
}

export function createCoverageReport({
  matrixMarkdown,
  historyMarkdown,
  evidence = [],
  registry = scenarioRegistry,
}) {
  const matrixIds = parseScenarioIds(matrixMarkdown);
  const historyIds = parseScenarioIds(historyMarkdown);
  if (!matrixIds.length || !historyIds.length)
    throw new Error('Matrix and history must each define scenario rows');
  const names = registry.map((item) => item.scenario);
  if (new Set(names).size !== names.length)
    throw new Error('Duplicate executable scenario name');
  for (const item of registry) {
    for (const id of item.matrix)
      if (!matrixIds.includes(id))
        throw new Error(`${item.scenario}: unknown matrix ID ${id}`);
    for (const id of item.history)
      if (!historyIds.includes(id))
        throw new Error(`${item.scenario}: unknown history ID ${id}`);
  }
  const imported = evidence.flatMap(({ value, source }) =>
    flattenEvidence(value, source, {}, registry)
  );
  const traces = imported.filter((trace) => !trace.excluded);
  const excludedFailures = imported.filter(
    (trace) =>
      trace.excluded &&
      !['passed', 'skipped', 'not-run'].includes(trace.reportedStatus)
  );
  const scenarios = registry.map((item) => {
    const matching = traces.filter((trace) => trace.scenario === item.scenario);
    const runs = matching.map((trace) => ({
      source: trace.source,
      platform: trace.platform ?? null,
      runId: trace.runId ?? null,
      reportedVerdict:
        trace.kind === 'playwright'
          ? trace.reportedStatus
          : (trace.verdict ?? trace.result?.verdict ?? null),
      executed: trace.executed !== false,
      evidenceIssues:
        trace.kind === 'playwright'
          ? assessWebEvidence(trace).issues
          : trace.result?.verdict === 'PASS'
            ? assessNativeEvidence(trace).issues
            : (trace.result?.issues ?? []).map((issue) => issue.code),
      status: classifyEvidence(trace),
      qualifiedStatus: qualifyEvidence(trace).status,
      qualificationIssues: qualifyEvidence(trace).issues,
      // The collector copies summaries and detailed per-case traces. Matching
      // details supply missing samples; they never erase a recorded failure.
      supersededSummary:
        !Array.isArray(trace.samples) &&
        !!trace.runId &&
        classifyEvidence(trace) !== 'fail' &&
        matching.some(
          (detail) =>
            Array.isArray(detail.samples) &&
            detail.runId === trace.runId &&
            detail.platform === trace.platform
        ),
    }));
    // Retain failures across reruns; later success never silently erases them.
    const status =
      ['fail', 'incomplete', 'observed', 'recorded-sampled-pass'].find(
        (candidate) =>
          runs.some((run) => !run.supersededSummary && run.status === candidate)
      ) ?? 'not-run';
    const qualifiedStatus =
      ['fail', 'incomplete', 'observed', 'recorded-sampled-pass'].find(
        (candidate) =>
          runs.some(
            (run) => !run.supersededSummary && run.qualifiedStatus === candidate
          )
      ) ?? 'not-run';
    return { ...item, status, qualifiedStatus, runs };
  });
  const summarizeIds = (ids, key) =>
    ids.map((id) => {
      const related = scenarios.filter((scenario) =>
        scenario[key].includes(id)
      );
      return {
        id,
        mappedScenarios: related.map((scenario) => scenario.scenario),
        recordedSampledPasses: related
          .filter((scenario) => scenario.status === 'recorded-sampled-pass')
          .map((scenario) => scenario.scenario),
        unrunScenarios: related
          .filter((scenario) => scenario.status === 'not-run')
          .map((scenario) => scenario.scenario),
        // A matrix row includes many conditions, platforms, phases and content types.
        fullAcceptanceVerified: false,
      };
    });
  const matrix = summarizeIds(matrixIds, 'matrix');
  const history = summarizeIds(historyIds, 'history');
  const families = [
    ...new Set(matrixIds.map((id) => id.replace(/-\d+$/, ''))),
  ].map((family) => {
    const rows = matrix.filter((row) => row.id.startsWith(`${family}-`));
    return {
      family,
      documented: rows.length,
      mappedSlices: rows.filter((row) => row.mappedScenarios.length > 0).length,
      unmappedIds: rows
        .filter((row) => row.mappedScenarios.length === 0)
        .map((row) => row.id),
      fullAcceptanceVerified: false,
    };
  });
  return {
    schemaVersion: 1,
    scope:
      'Replayed geometry contracts from imported native fixture and browser DOM samples; executedSlices counts attempts, not qualified actions. UI/backend setup, host/build provenance, complete matrix variants and presentation are not independently verified by this report.',
    fullMatrixVerified: false,
    nativePresentation: 'INCOMPLETE',
    counts: {
      documentedMatrixRows: matrix.length,
      documentedHistoryRows: history.length,
      registeredExecutableSlices: scenarios.length,
      executedSlices: scenarios.filter((scenario) =>
        scenario.runs.some((run) => run.executed)
      ).length,
      recordedSampledPasses: scenarios.filter(
        (scenario) => scenario.status === 'recorded-sampled-pass'
      ).length,
      failingSlices: scenarios.filter((scenario) => scenario.status === 'fail')
        .length,
      incompleteSlices: scenarios.filter(
        (scenario) => scenario.status === 'incomplete'
      ).length,
      qualifiedRecordedSampledPasses: scenarios.filter(
        (scenario) => scenario.qualifiedStatus === 'recorded-sampled-pass'
      ).length,
      qualifiedFailingSlices: scenarios.filter(
        (scenario) => scenario.qualifiedStatus === 'fail'
      ).length,
      qualifiedIncompleteSlices: scenarios.filter(
        (scenario) => scenario.qualifiedStatus === 'incomplete'
      ).length,
      qualifiedObservedSlices: scenarios.filter(
        (scenario) => scenario.qualifiedStatus === 'observed'
      ).length,
      unrunSlices: scenarios.filter((scenario) => scenario.status === 'not-run')
        .length,
      failingSetupAttempts: excludedFailures.filter(
        (trace) => trace.excluded === 'authentication-setup'
      ).length,
      failingDetectorAttempts: excludedFailures.filter(
        (trace) => trace.excluded === 'detector-self-test'
      ).length,
      runnerErrors: excludedFailures.filter(
        (trace) => trace.excluded === 'runner-error'
      ).length,
    },
    families,
    matrix,
    history,
    scenarios,
    excludedEvidence: imported
      .filter((trace) => trace.excluded)
      .map((trace) => ({
        source: trace.source,
        title: trace.title,
        reason: trace.excluded,
        reportedStatus: trace.reportedStatus,
      })),
    unregisteredEvidence: traces
      .filter((trace) => !names.includes(trace.scenario))
      .map((trace) => ({
        scenario: trace.scenario,
        source: trace.source,
        status: classifyEvidence(trace),
      })),
  };
}

export function coverageReportExitCode(report) {
  return report.counts.failingSlices ||
    report.counts.incompleteSlices ||
    report.counts.failingSetupAttempts ||
    report.counts.failingDetectorAttempts ||
    report.counts.runnerErrors ||
    report.unregisteredEvidence.length
    ? 1
    : 0;
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    process.stdout.write(
      'Usage: node scripts/scroll-stability-report.mjs [native-trace.json native-suite.json playwright-report.json ...]\nPrints JSON with every documented matrix/history row, executable slice, unrun case and unmapped family. Native suite summaries and browser result statuses alone cannot prove sampled passes. Detector self-tests and authentication setup are excluded from product coverage; their failures and runner errors remain separately visible and fail the report exit. Exit 1 also means failed/incomplete/unregistered supplied product evidence; no input is an inventory report, not a test pass.\n'
    );
    return 0;
  }
  if (args.some((arg) => arg.startsWith('-')))
    throw new Error('Unknown option; use --help');
  const report = createCoverageReport({
    matrixMarkdown: readFileSync(
      resolve(root, 'docs/tlon-apps/scroller-test-matrix.md'),
      'utf8'
    ),
    historyMarkdown: readFileSync(
      resolve(root, 'docs/tlon-apps/scroller-regression-history.md'),
      'utf8'
    ),
    evidence: args.map((file) => ({
      source: resolve(file),
      value: JSON.parse(readFileSync(resolve(file), 'utf8')),
    })),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return coverageReportExitCode(report);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

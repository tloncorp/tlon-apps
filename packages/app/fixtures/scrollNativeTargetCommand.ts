import type {
  ScrollSnapshot,
  ScrollTraceExpectations,
} from './scrollStabilityTrace';

export const nativeCenterCommand = {
  scenario: 'command-center',
  key: 'scroll-fixture-111',
  viewPosition: 0.5,
  animated: false,
  durationMs: 2800,
  landingDeadlineMs: 1800,
  latestIssueMs: 250,
} as const;

export type NativeCenterCommandContract = {
  version: 1;
  scope: string;
  startedAt: number;
};

export type CommandEvidence = {
  nativeCenterCommandContract?: NativeCenterCommandContract;
  nativeSampledRulerContract?: { version: string; scope: string };
  expectations: ScrollTraceExpectations | null;
  events: {
    name: string;
    time: number;
    values?: Record<string, number | string | boolean>;
  }[];
  originalDataKeys: string[];
  committedDataKeys?: string[];
  samples: ScrollSnapshot[];
};

/** Bind the target oracle to the one public request, never to a guessed row. */
export function nativeCenterCommandEvidenceIssues(
  evidence: CommandEvidence
): string[] {
  return nativeTargetCommandEvidenceIssues(evidence, nativeCenterCommand);
}

/** Shared fixed-command checks; the legacy center contract keeps its defaults. */
export function nativeTargetCommandEvidenceIssues(
  evidence: CommandEvidence,
  spec: {
    scenario: string;
    key: string;
    viewPosition: number;
    animated: boolean;
    durationMs: number;
    landingDeadlineMs: number;
    latestIssueMs: number;
  },
  contract = evidence.nativeCenterCommandContract,
  requestName = 'center-command-request'
): string[] {
  const { action, coverage, landing } = evidence.expectations ?? {};
  if (
    !contract ||
    contract.version !== 1 ||
    !contract.scope ||
    !Number.isFinite(contract.startedAt) ||
    evidence.nativeSampledRulerContract?.version !==
      'indexed-cell-and-surfaces-v2' ||
    evidence.nativeSampledRulerContract.scope !== contract.scope ||
    action?.name !== spec.scenario ||
    action.startedAt !== contract.startedAt ||
    coverage?.endTime !== contract.startedAt + spec.durationMs ||
    landing?.key !== spec.key ||
    landing.alignment !== 'center' ||
    (landing.offsetPt ?? 0) !== 0 ||
    landing.settleStartTime !== contract.startedAt + spec.landingDeadlineMs
  )
    return ['center-command-contract'];

  const requests = evidence.events.filter(
    (event) => event.name === requestName
  );
  const request = requests[0];
  if (
    requests.length !== 1 ||
    !request ||
    !Number.isFinite(request.time) ||
    request.time < contract.startedAt ||
    request.time > contract.startedAt + spec.latestIssueMs ||
    request.values?.scope !== contract.scope ||
    request.values?.key !== spec.key ||
    request.values?.viewPosition !== spec.viewPosition ||
    request.values?.animated !== spec.animated ||
    request.values?.source !== 'PostList.scrollToPost'
  )
    return ['center-command-request'];

  const expectedKeys = Array.from(
    { length: 90 },
    (_, index) => `scroll-fixture-${index + 30}`
  );
  const sameKeys = (keys: unknown) =>
    JSON.stringify(keys) === JSON.stringify(expectedKeys);
  if (
    !sameKeys(evidence.originalDataKeys) ||
    !sameKeys(evidence.committedDataKeys) ||
    evidence.samples.some((sample) => {
      // Raw membership can disqualify this unchanged-data case. It never
      // substitutes for the independently replayed native geometry bracket.
      const observed = sample.acquisition?.jsCoherence;
      return (
        !observed ||
        observed.before.scope !== contract.scope ||
        observed.after.scope !== contract.scope ||
        !sameKeys(observed.before.keys) ||
        !sameKeys(observed.after.keys)
      );
    })
  )
    return ['center-command-data'];
  return [];
}

export const nativeOffscreenCommand = {
  scenario: 'command-offscreen',
  key: 'scroll-fixture-40',
  viewPosition: 0.5,
  animated: false,
  durationMs: 2800,
  landingDeadlineMs: 1800,
  latestIssueMs: 250,
} as const;

export type NativeOffscreenCommandContract = NativeCenterCommandContract;
type Evidence = CommandEvidence & {
  baseline: ScrollSnapshot;
  nativeOffscreenCommandContract?: NativeOffscreenCommandContract;
};

/** Absence means currently unmounted, not absent data or unknown cached size. */
export function nativeOffscreenCommandEvidenceIssues(
  evidence: Evidence
): string[] {
  if (!evidence.nativeOffscreenCommandContract)
    return ['offscreen-command-contract'];
  const issues = nativeTargetCommandEvidenceIssues(
    evidence,
    nativeOffscreenCommand,
    evidence.nativeOffscreenCommandContract,
    'offscreen-command-request'
  );
  if (issues.length)
    return issues.map((issue) =>
      issue.replace('center-command', 'offscreen-command')
    );
  if (
    evidence.events.some(
      (event) =>
        event.name === 'center-command-request' || event.name === 'positioned'
    )
  )
    return ['offscreen-command-extra-positioning'];
  const geometry = evidence.baseline.acquisition?.nativeGeometry;
  const keys = geometry?.request.rows.map((row) => row.key);
  const target = nativeOffscreenCommand.key;
  if (
    !keys?.length ||
    new Set(keys).size !== keys.length ||
    keys.includes(target) ||
    evidence.baseline.rows.some((row) => row.key === target) ||
    evidence.baseline.acquisition?.registeredRowCount !== keys.length ||
    evidence.baseline.acquisition?.selectedRowCount !== keys.length
  )
    return ['offscreen-command-baseline-mounted'];
  const request = evidence.events.find(
    (event) => event.name === 'offscreen-command-request'
  )!;
  let mounted: unknown;
  try {
    mounted = JSON.parse(String(request.values?.mountedKeys));
  } catch {
    return ['offscreen-command-request-mounted'];
  }
  if (
    !Array.isArray(mounted) ||
    !mounted.length ||
    mounted.some(
      (key) =>
        typeof key !== 'string' || !evidence.originalDataKeys.includes(key)
    ) ||
    new Set(mounted).size !== mounted.length ||
    mounted.includes(target)
  )
    return ['offscreen-command-request-mounted'];
  // Raw native indexed cells enumerate the actual mounted outer hosts. Reject
  // omission of a mounted target even when the producer's JS registry omits it.
  const capture = geometry?.capture as
    | { ruler?: { cells?: { view?: { semanticValue?: string } }[] } }
    | undefined;
  if (!Array.isArray(capture?.ruler?.cells) || !capture.ruler.cells.length)
    return ['offscreen-command-baseline-native'];
  try {
    const cellKeys = capture.ruler.cells.map(
      (cell) => JSON.parse(cell.view?.semanticValue ?? '').key
    );
    if (cellKeys.includes(target))
      return ['offscreen-command-baseline-mounted'];
    if (
      cellKeys.some(
        (key) =>
          typeof key !== 'string' || !evidence.originalDataKeys.includes(key)
      )
    )
      return ['offscreen-command-baseline-native'];
  } catch {
    return ['offscreen-command-baseline-native'];
  }
  return [];
}

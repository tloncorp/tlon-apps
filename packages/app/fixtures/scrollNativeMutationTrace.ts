import type {
  NativeRecording,
  NativeRecordingContract,
  assessNativeRecording,
} from './scrollNativeRecording';
import type {
  adaptBufferedNativeScrollGeometry,
  adaptNativeEntryRuler,
} from './scrollNativeGeometry';
import type { RowMutationState } from './scrollStabilityMutation';

/** Declared before the recorder starts. Independent of the historical JS bracket. */
export type NativeMutationContract = {
  version: 1;
  recordingId: string;
  requestId: string;
  requestMarker: string;
  declaredAt: number;
  scope: string;
  key: string;
  kind: string;
  baseline: RowMutationState;
  expected: RowMutationState;
  anchorKey: string;
  readyDeadlineMs: 400;
  quietTailMs: 1000;
  minimumDurationMs: 1800;
};
type NativeBoundAnchorContract = Pick<
  NativeMutationContract,
  'version' | 'recordingId' | 'scope' | 'anchorKey'
>;
type Dependencies = {
  assessRecording: typeof assessNativeRecording;
  adaptGeometry: typeof adaptBufferedNativeScrollGeometry;
  evaluateRuler: typeof adaptNativeEntryRuler;
  recordingAssessment?: Pick<
    ReturnType<typeof assessNativeRecording>,
    'verdict' | 'issues'
  >;
};
const object = (x: unknown): x is Record<string, any> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);
const text = (x: unknown): x is string =>
  typeof x === 'string' && x.length > 0 && x.length <= 4096;
const stable = (x: any): any =>
  Array.isArray(x)
    ? x.map(stable)
    : object(x)
      ? Object.fromEntries(
          Object.entries(x)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, stable(v)])
        )
      : x;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const signature = (x: any) =>
  object(x) &&
  typeof x.content === 'string' &&
  typeof x.reactions === 'string' &&
  (typeof x.replies === 'string' || (finite(x.replies) && x.replies >= 0));
const state = (x: any) =>
  object(x) &&
  (x.presence === 'absent' ||
    (x.presence === 'present' && signature(x.signature)));
const parse = (x: any) => {
  try {
    return JSON.parse(x);
  } catch {
    return undefined;
  }
};

/** Every raw frame is checked. INCOMPLETE never becomes PASS via a later frame. */
export function assessNativeMutationTrace(
  raw: unknown,
  recordingContract: NativeRecordingContract,
  contract: NativeMutationContract,
  deps: Dependencies
) {
  return assessNativeBoundTrace(raw, recordingContract, contract, deps, true);
}

/** The same bound-anchor authority checks, without fabricated mutation semantics. */
export function assessNativeAnchorTrace(
  raw: unknown,
  recordingContract: NativeRecordingContract,
  contract: NativeBoundAnchorContract,
  deps: Dependencies
) {
  const result = assessNativeBoundTrace(
    raw,
    recordingContract,
    contract,
    deps,
    false
  );
  return { ...result.anchorContinuity, productActions: 'UNASSESSED' as const };
}

function assessNativeBoundTrace(
  raw: unknown,
  recordingContract: NativeRecordingContract,
  contract: NativeBoundAnchorContract,
  deps: Dependencies,
  mutationMode: boolean
) {
  const mutation = mutationMode
    ? (contract as NativeMutationContract)
    : undefined;
  type Issue = { code: string; kind: 'failure' | 'incomplete'; frame?: number };
  const sharedIssues: Issue[] = [],
    mutationIssues: Issue[] = [],
    anchorIssues: Issue[] = [];
  const append = (
    list: Issue[],
    code: string,
    frame?: number,
    kind: Issue['kind'] = 'incomplete'
  ) => list.push({ code, kind, frame });
  const add = (
    code: string,
    frame?: number,
    kind: Issue['kind'] = 'incomplete'
  ) => append(sharedIssues, code, frame, kind);
  const addMutation = (
    code: string,
    frame?: number,
    kind: Issue['kind'] = 'incomplete'
  ) => append(mutationIssues, code, frame, kind);
  const addAnchor = (
    code: string,
    frame?: number,
    kind: Issue['kind'] = 'incomplete'
  ) => append(anchorIssues, code, frame, kind);
  const hasIncomplete = (list: Issue[]) =>
    list.some((i) => i.kind === 'incomplete');
  const verdict = (list: Issue[]) =>
    list.some((i) => i.kind === 'failure')
      ? 'FAIL'
      : list.length
        ? 'INCOMPLETE'
        : 'PASS';
  let maxAnchorDriftPt = 0,
    qualifiedAnchorFrames = 0,
    expectedAt: number | null = null,
    baselineTime: number | null = null;
  const finish = () => {
    const issues = [...sharedIssues, ...mutationIssues, ...anchorIssues];
    return {
      version: 1,
      // An independently qualified anchor failure is reported separately when
      // the target cannot establish mutation semantics. Coverage-only gaps keep
      // the existing observed-failure precedence.
      verdict: mutationIssues.some((i) => i.kind === 'failure')
        ? 'FAIL'
        : hasIncomplete(mutationIssues)
          ? 'INCOMPLETE'
          : verdict(issues),
      issues,
      evidenceLevel: 'native-committed-mutation-v1',
      nativePresentation: 'INCOMPLETE',
      metrics: { maxAnchorDriftPt, expectedAt, baselineTime },
      anchorContinuity: {
        verdict: verdict([...sharedIssues, ...anchorIssues]),
        issues: [...sharedIssues, ...anchorIssues],
        evidenceLevel: 'native-bound-anchor-continuity-v1',
        nativePresentation: 'INCOMPLETE',
        metrics: { maxAnchorDriftPt, qualifiedFrames: qualifiedAnchorFrames },
      },
    };
  };
  if (
    !object(contract) ||
    contract.version !== 1 ||
    ![contract.recordingId, contract.scope, contract.anchorKey].every(text) ||
    !object(recordingContract) ||
    contract.recordingId !== recordingContract.recordingId ||
    contract.scope !== recordingContract.scope ||
    recordingContract.itinerary ||
    recordingContract.visibility !== 'require-visible' ||
    !recordingContract.requiredKeys?.includes(contract.anchorKey) ||
    (mutationMode &&
      (!object(mutation) ||
        ![
          mutation.requestId,
          mutation.requestMarker,
          mutation.key,
          mutation.kind,
        ].every(text) ||
        !finite(mutation.declaredAt) ||
        mutation.declaredAt < 0 ||
        mutation.requestMarker !== `${mutation.requestId}:native-request` ||
        mutation.readyDeadlineMs !== 400 ||
        mutation.quietTailMs !== 1000 ||
        mutation.minimumDurationMs !== 1800 ||
        !state(mutation.baseline) ||
        mutation.baseline.presence !== 'present' ||
        !state(mutation.expected) ||
        equal(mutation.baseline, mutation.expected) ||
        mutation.key === contract.anchorKey))
  ) {
    add(
      mutationMode
        ? 'invalid-native-mutation-contract'
        : 'invalid-native-anchor-contract'
    );
    return finish();
  }
  let acquisition: Pick<
    ReturnType<typeof assessNativeRecording>,
    'verdict' | 'issues'
  >;
  try {
    acquisition =
      deps.recordingAssessment ??
      deps.assessRecording(raw, recordingContract, deps.adaptGeometry);
  } catch {
    add('native-mutation-acquisition-threw');
    return finish();
  }
  const recording = raw as NativeRecording;
  let qualifiedFrameLimit = recording.frames.length;
  if (acquisition.verdict !== 'COMPLETE') {
    acquisition.issues.forEach((i) => add(`acquisition:${i.code}`, i.frame));
    const coverageOnly = new Set([
      'native-recording-coverage-gap',
      'missing-native-recording-tail',
      'invalid-native-recording-lifetime',
    ]);
    const coherentClock =
      finite(recording.startedAt) &&
      recording.startedAt >= 0 &&
      finite(recording.stoppedAt) &&
      recording.stoppedAt >= recording.startedAt &&
      recording.stoppedAt - recording.startedAt <=
        recordingContract.request.durationMs + 125 &&
      ['requested', 'deadline'].includes(recording.stopReason) &&
      recording.frames.every(
        (f, i, frames) =>
          finite(f.geometry.startedAt) &&
          finite(f.geometry.finishedAt) &&
          f.geometry.startedAt >= recording.startedAt &&
          f.geometry.finishedAt <= recording.stoppedAt &&
          (!i || f.geometry.startedAt >= frames[i - 1].geometry.finishedAt) &&
          (!i || f.geometry.finishedAt > frames[i - 1].geometry.finishedAt)
      );
    if (
      !coherentClock ||
      acquisition.issues.some((i) => !coverageOnly.has(i.code))
    )
      return finish();
    qualifiedFrameLimit = Math.min(
      qualifiedFrameLimit,
      ...acquisition.issues
        .filter((i) => i.code === 'native-recording-coverage-gap')
        .map((i) => i.frame ?? 0)
    );
    if (qualifiedFrameLimit === 0) return finish();
  }
  if (mutation && recording.stoppedAt - recording.startedAt < 1800)
    add('native-mutation-window-short');
  const actions = recording.markers.filter((m) => m.name === 'action-start');
  const requests = mutation
    ? recording.markers.filter((m) => m.name === mutation.requestMarker)
    : actions;
  if (
    requests.length !== 1 ||
    actions.length !== 1 ||
    recording.markers.length !== (mutation ? 2 : 1) ||
    actions[0].time > requests[0].time ||
    (!mutation && recording.frames[0].geometry.finishedAt > actions[0].time)
  ) {
    add(
      mutation
        ? 'native-mutation-marker-mismatch'
        : 'native-anchor-action-marker'
    );
    return finish();
  }
  const request = requests[0].time,
    deadline = request + 400,
    tail = request + 1400;
  if (
    recording.frames.some(
      (f) => f.geometry.startedAt < request && request < f.geometry.finishedAt
    )
  ) {
    add(
      mutation
        ? 'native-mutation-marker-intersects-capture'
        : 'native-anchor-marker-intersects-capture'
    );
    if (!mutation) return finish();
  }
  if (
    mutation &&
    (recording.stoppedAt < tail ||
      recording.frames.at(-1)!.geometry.finishedAt < tail)
  )
    add('native-mutation-tail-short');
  let owner: unknown, nativeScope: unknown, baselineAnchor: number | undefined;
  let baselineRevision: string | undefined, anchorRevision: string | undefined;
  const criticalOwners = new Map<string, unknown>();
  const lifetimePointers = new Map<string, string>();
  const revisions = new Map<string, string>();
  const disappeared = new Set<string>();
  let priorMembers: Map<string, string> | undefined;
  let priorDataRevision: string | undefined;
  const generations = new Map<string, unknown>();
  let observedBaseline = false,
    expectedSeen = false;
  let lastQualifiedSemanticTime = -Infinity;
  const structuralIssueStart = sharedIssues.length;
  let anchorShape: unknown, stationarySurfaces: unknown;
  for (const [index, frame] of recording.frames
    .slice(0, qualifiedFrameLimit)
    .entries()) {
    // A corrupt authority frame retires further product evaluation; it cannot
    // manufacture deadline absence or revive a later owner's observations.
    if (hasIncomplete(sharedIssues.slice(structuralIssueStart))) break;
    const g = frame.geometry as any;
    if (g.scroll.tracking || g.scroll.dragging || g.scroll.decelerating)
      add('native-mutation-not-stationary', index);
    if (!mutation) {
      const currentSurfaces = [
        g.root.frame,
        g.scroll.view.frame,
        g.scroll.view.clipFrame,
        g.composer.frame,
        g.composer.clipFrame,
        g.scroll.bounds.width,
        g.scroll.bounds.height,
        g.scroll.contentInset,
        g.scroll.adjustedContentInset,
      ];
      stationarySurfaces ??= currentSurfaces;
      if (!equal(stationarySurfaces, currentSurfaces))
        add('native-anchor-viewport-changed', index);
    }
    let ruled: ReturnType<typeof adaptNativeEntryRuler>;
    try {
      ruled = deps.evaluateRuler(
        g,
        contract.scope,
        'indexed-cell-and-surfaces-v2'
      );
    } catch {
      add('native-mutation-ruler-threw', index);
      continue;
    }
    ruled.issues.forEach((code) => add(code, index));
    const identity = [
      g.root?.identity,
      g.root?.lifetimeIdentity,
      g.root?.windowIdentity,
      g.scroll?.view?.identity,
      g.scroll?.view?.lifetimeIdentity,
      g.scroll?.view?.windowIdentity,
      g.scroll?.hostIdentity,
      g.composer?.identity,
      g.composer?.lifetimeIdentity,
    ];
    if (!identity.every(text))
      add('native-mutation-owner-identity-missing', index);
    owner ??= identity;
    if (!equal(owner, identity)) add('native-mutation-owner-replaced', index);
    const seenPointers = new Set<string>(),
      seenLifetimes = new Set<string>();
    const measuredViews = [
      g.root,
      g.scroll?.view,
      g.composer,
      ...g.rows.map((r: any) => r.view),
      ...g.ruler.cells.map((r: any) => r.view),
    ];
    for (const view of measuredViews) {
      if (
        !text(view?.identity) ||
        !text(view?.lifetimeIdentity) ||
        seenPointers.has(view.identity) ||
        seenLifetimes.has(view.lifetimeIdentity) ||
        (lifetimePointers.has(view.lifetimeIdentity) &&
          lifetimePointers.get(view.lifetimeIdentity) !== view.identity)
      )
        add('native-measured-lifetime-alias', index);
      else {
        seenPointers.add(view.identity);
        seenLifetimes.add(view.lifetimeIdentity);
        lifetimePointers.set(view.lifetimeIdentity, view.identity);
      }
    }
    const m = g.nativeReading?.committedMembership,
      b = g.nativeReading?.rowBindings;
    if (
      !object(m) ||
      m.version !== 1 ||
      m.status !== 'ok' ||
      ![m.scopeIdentity, m.scope, m.visit, m.dataRevision].every(text) ||
      !Array.isArray(m.rows) ||
      m.rows.length > 100000 ||
      !m.rows.every((r: any) => object(r) && text(r.key) && text(r.revision)) ||
      new Set(m.rows.map((r: any) => r.key)).size !== m.rows.length
    ) {
      add('native-membership-unavailable', index);
      continue;
    }
    const scope = [m.scopeIdentity, m.scope, m.visit];
    nativeScope ??= scope;
    if (!equal(nativeScope, scope))
      add('native-membership-owner-changed', index);
    const members = new Map<string, string>(
      m.rows.map((r: any) => [r.key, r.revision])
    );
    if (
      generations.has(m.dataRevision) &&
      !equal(generations.get(m.dataRevision), m.rows)
    )
      add('native-membership-generation-reused', index);
    generations.set(m.dataRevision, m.rows);
    if (
      priorMembers &&
      !equal([...priorMembers], [...members]) &&
      priorDataRevision === m.dataRevision
    )
      add('native-membership-change-without-revision', index);
    for (const [key, revision] of members) {
      const addKeyIssue =
        key === contract.anchorKey
          ? addAnchor
          : key === mutation?.key
            ? addMutation
            : add;
      if (priorMembers?.has(key) && priorMembers.get(key) !== revision)
        addKeyIssue('native-membership-incarnation-replaced', index);
      if (
        disappeared.has(key) &&
        (key === mutation?.key || key === contract.anchorKey)
      )
        addKeyIssue('native-critical-row-reinserted', index);
      if (
        revisions.has(key) &&
        revisions.get(key) !== revision &&
        (key === mutation?.key || key === contract.anchorKey)
      )
        addKeyIssue('native-critical-incarnation-changed', index);
      revisions.set(key, revision);
    }
    if (priorMembers)
      for (const key of priorMembers.keys())
        if (!members.has(key)) disappeared.add(key);
    priorMembers = members;
    priorDataRevision = m.dataRevision;
    if (
      !object(b) ||
      b.version !== 1 ||
      b.status !== 'ok' ||
      !equal(
        [b.scopeIdentity, b.scope, b.visit, b.dataRevision],
        [m.scopeIdentity, m.scope, m.visit, m.dataRevision]
      ) ||
      !Array.isArray(b.rows) ||
      b.rows.length !== g.rows.length ||
      new Set(b.rows.map((r: any) => r.rowId)).size !== b.rows.length
    ) {
      add('native-row-bindings-unavailable', index);
      continue;
    }
    // A duplicated registration/host claim is shared authority corruption,
    // even when the later duplicate belongs to an unavailable target witness.
    const registrationIds = b.rows
      .filter((r: any) => r.status === 'ok')
      .map((r: any) => r.registrationIdentity)
      .filter(text);
    const hostIds = b.rows
      .filter((r: any) => r.status === 'ok')
      .map((r: any) => r.hostIdentity)
      .filter(text);
    if (
      new Set(registrationIds).size !== registrationIds.length ||
      new Set(hostIds).size !== hostIds.length
    )
      add('native-row-binding-identity-alias', index);
    const seenRegistrations = new Set<string>(),
      seenHosts = new Set<string>();
    for (const row of g.rows) {
      const key = row.id.slice('scroll-row-'.length),
        cell = g.ruler.cells.find((c: any) => c.id === `scroll-cell-${key}`),
        binding = b.rows.find((r: any) => r.rowId === row.id);
      if (
        !object(binding) ||
        binding.status !== 'ok' ||
        binding.key !== key ||
        binding.cellId !== cell?.id ||
        binding.fixtureScope !== contract.scope ||
        binding.revision !== members.get(key) ||
        ![
          binding.revision,
          binding.rowViewIdentity,
          binding.cellViewIdentity,
          binding.registrationIdentity,
          binding.hostIdentity,
        ].every(text) ||
        binding.rowViewIdentity !== row.view?.lifetimeIdentity ||
        binding.cellViewIdentity !== cell?.view?.lifetimeIdentity ||
        seenRegistrations.has(binding.registrationIdentity) ||
        seenHosts.has(binding.hostIdentity)
      ) {
        (key === contract.anchorKey
          ? addAnchor
          : key === mutation?.key
            ? addMutation
            : add)('native-row-incarnation-unbound', index);
        continue;
      }
      seenRegistrations.add(binding.registrationIdentity);
      seenHosts.add(binding.hostIdentity);
      if (key === mutation?.key || key === contract.anchorKey) {
        const physical = [
          binding.registrationIdentity,
          binding.hostIdentity,
          binding.rowViewIdentity,
          binding.cellViewIdentity,
        ];
        if (
          criticalOwners.has(key) &&
          !equal(criticalOwners.get(key), physical)
        )
          (key === contract.anchorKey ? addAnchor : addMutation)(
            'native-critical-physical-row-replaced',
            index
          );
        criticalOwners.set(key, physical);
      }
    }
    // Shared acquisition and owner authority must hold before either product
    // result reads geometry. Target retirement does not retire the other row.
    if (hasIncomplete(sharedIssues.slice(structuralIssueStart))) continue;
    if (!hasIncomplete(anchorIssues)) {
      const anchor = g.rows.find(
        (r: any) => r.id === `scroll-row-${contract.anchorKey}`
      )?.view;
      const anchorCell = ruled.cells.get(contract.anchorKey);
      if (!anchor || !members.has(contract.anchorKey) || !anchorCell) {
        addAnchor('native-anchor-unavailable', index);
      } else {
        anchorRevision ??= members.get(contract.anchorKey);
        if (anchorRevision !== members.get(contract.anchorKey))
          addAnchor('native-anchor-incarnation-changed', index);
        const meta = parse(anchor.semanticValue);
        const shape = [
          meta?.signature,
          anchor.frame.width,
          anchor.frame.height,
          anchorCell.frame.width,
          anchorCell.frame.height,
        ];
        if (!signature(meta?.signature))
          addAnchor('native-anchor-signature-invalid', index);
        anchorShape ??= shape;
        if (!equal(anchorShape, shape))
          addAnchor('native-anchor-content-or-dimensions-changed', index);
        if (!hasIncomplete(anchorIssues)) {
          const clip = anchor.clipFrame,
            scrollClip = g.scroll.view.clipFrame;
          const visible =
            !anchor.hidden &&
            anchor.effectiveAlpha > 0 &&
            clip.width > 0 &&
            clip.height > 0 &&
            clip.y < ruled.viewportBottom &&
            clip.y + clip.height > ruled.viewportTop &&
            clip.x < scrollClip.x + scrollClip.width &&
            clip.x + clip.width > scrollClip.x;
          if (!visible)
            addAnchor('native-anchor-not-visible', index, 'failure');
          // Preserve partial-width surface obstruction checks from the same walk.
          if (
            ruled.surfaces.some(
              (surface) =>
                surface.clipFrame.x < clip.x + clip.width &&
                surface.clipFrame.x + surface.clipFrame.width > clip.x &&
                surface.clipFrame.y < clip.y + clip.height &&
                surface.clipFrame.y + surface.clipFrame.height > clip.y
            )
          )
            addAnchor('native-anchor-obscured', index, 'failure');
          // The fixture declares the default window reference. This uses the
          // first native frame, never the earlier mixed-clock JS baseline.
          const y = anchor.frame.y;
          if (index === 0) baselineAnchor = y;
          if (finite(baselineAnchor)) {
            const drift = Math.abs(y - baselineAnchor);
            maxAnchorDriftPt = Math.max(maxAnchorDriftPt, drift);
            if (drift > 1) addAnchor('native-anchor-drift', index, 'failure');
            qualifiedAnchorFrames++;
          }
        }
      }
    }
    if (!mutation) continue;
    // Once target identity or semantics become unavailable, no later frame can
    // re-establish the old mutation witness or synthesize deadline absence.
    if (hasIncomplete(mutationIssues)) continue;
    const row = g.rows.find((r: any) => r.id === `scroll-row-${mutation.key}`),
      cell = g.ruler.cells.find(
        (c: any) => c.id === `scroll-cell-${mutation.key}`
      );
    let current: RowMutationState | undefined;
    if (members.has(mutation.key)) {
      if (!row || !cell) addMutation('native-mutation-member-unmounted', index);
      else {
        const meta = parse(row.view.semanticValue);
        if (signature(meta?.signature))
          current = { presence: 'present', signature: meta.signature };
        else addMutation('native-mutation-signature-invalid', index);
      }
    } else if (row || cell)
      addMutation('native-mutation-stale-row-after-removal', index);
    else current = { presence: 'absent' };
    if (hasIncomplete(mutationIssues)) continue;
    lastQualifiedSemanticTime = g.finishedAt;
    if (g.finishedAt <= request) {
      if (!equal(current, mutation.baseline))
        addMutation('native-mutation-baseline-mismatch', index);
      else {
        observedBaseline = true;
        baselineTime = g.finishedAt;
        baselineRevision = members.get(mutation.key);
      }
    } else {
      if (!observedBaseline)
        addMutation('native-mutation-baseline-unwitnessed', index);
      if (
        current?.presence === 'present' &&
        baselineRevision !== members.get(mutation.key)
      )
        addMutation('native-mutation-replaced-incarnation', index);
      if (equal(current, mutation.expected)) {
        expectedAt ??= g.finishedAt;
        expectedSeen = true;
      } else if (expectedSeen)
        addMutation('native-mutation-reverted', index, 'failure');
      else if (!equal(current, mutation.baseline))
        addMutation('native-mutation-unexpected-state', index, 'failure');
      if (g.finishedAt >= deadline && !equal(current, mutation.expected))
        addMutation('native-mutation-not-ready', index, 'failure');
    }
  }
  if (mutation && !observedBaseline)
    addMutation('native-mutation-baseline-unwitnessed');
  const observedThroughDeadline = lastQualifiedSemanticTime >= deadline;
  if (
    mutation &&
    observedThroughDeadline &&
    (expectedAt === null || expectedAt > deadline)
  )
    addMutation('native-mutation-ready-deadline', undefined, 'failure');
  return finish();
}

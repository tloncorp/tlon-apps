import type {
  assessNativeRecording,
  NativeRecording,
  NativeRecordingContract,
  NativeRowRevision,
} from './scrollNativeRecording';
import type { assessClampedScrollLanding } from './scrollStabilityTrace';

export type NativeEntryContract = {
  version: 1;
  recordingId: string;
  requestId: string;
  mode: 'latest' | 'selected' | 'delayed';
  destinationScope: string;
  expectedPosts: { key: string; signature: NativeRowRevision['signature'] }[];
  resetMarker: string;
  dataMarker: string;
  readyDeadlineMs: 2800;
  quietTailMs: 1000;
};
type RecordingEvaluator = (
  raw: unknown,
  contract: NativeRecordingContract
) => ReturnType<typeof assessNativeRecording>;
type Issue = { code: string; kind: 'incomplete' | 'failure'; frame?: number };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const sameSignature = (a: unknown, b: NativeRowRevision['signature']) =>
  object(a) &&
  a.content === b.content &&
  a.reactions === b.reactions &&
  a.replies === b.replies;

/** Independently fixed v2 entry corpus; not copied from observed rows. */
export function expectedNativeEntryPosts(): NativeEntryContract['expectedPosts'] {
  const description =
    'A deliberately mixed-height conversation. Keep this message in the same place while the content around it changes. ';
  return Array.from({ length: 90 }, (_, offset) => {
    const index = offset + 30;
    const content =
      index % 13 === 0
        ? [
            {
              block: {
                code: {
                  code: `// Message ${index}\n${'const value = await readMessage();\n'.repeat(5)}`,
                  lang: 'typescript',
                },
              },
            },
          ]
        : [
            {
              inline: [
                `Message ${index}. ${description.repeat(index % 9 === 0 ? 8 : 1)}`,
              ],
            },
          ];
    return {
      key: `scroll-fixture-${index}`,
      signature: {
        content: JSON.stringify(JSON.stringify(content)),
        reactions: '[]',
        replies: 0,
      },
    };
  });
}

/** Row-model entry proof only. Neither native presentation nor pixel readiness is inferred. */
export function assessNativeEntryTrace(
  raw: unknown,
  recordingContract: NativeRecordingContract,
  contract: NativeEntryContract,
  evaluateRecording: RecordingEvaluator,
  evaluateLanding: typeof assessClampedScrollLanding
) {
  const issues: Issue[] = [];
  const add = (
    code: string,
    kind: Issue['kind'] = 'incomplete',
    frame?: number
  ) => issues.push({ code, kind, ...(frame === undefined ? {} : { frame }) });
  let acquisition: 'COMPLETE' | 'INCOMPLETE' = 'INCOMPLETE';
  let firstContentFrame: number | null = null;
  let maxLandingErrorPt = 0;
  let deadline: number | null = null;
  let tailEnd: number | null = null;
  let checkedContentFrames = 0;
  let checkedTailFrames = 0;
  const finish = () => ({
    verdict: issues.some((issue) => issue.kind === 'failure')
      ? ('FAIL' as const)
      : issues.length
        ? ('INCOMPLETE' as const)
        : ('PASS' as const),
    acquisition,
    issues,
    evidenceLevel: 'native-buffered-entry-row-model' as const,
    nativePresentation: 'INCOMPLETE' as const,
    inputToUsableLandingLatency: 'INCOMPLETE' as const,
    metrics: {
      firstContentFrame,
      maxLandingErrorPt,
      checkedContentFrames,
      checkedTailFrames,
      deadline,
      tailEnd,
    },
  });
  const expected = expectedNativeEntryPosts();
  const itinerary = recordingContract?.itinerary;
  if (
    !object(contract) ||
    contract.version !== 1 ||
    !['latest', 'selected', 'delayed'].includes(contract.mode) ||
    contract.recordingId !== recordingContract?.recordingId ||
    contract.requestId !== `${contract.recordingId}:entry` ||
    contract.resetMarker !== `${contract.requestId}:reset` ||
    contract.dataMarker !== `${contract.requestId}:data` ||
    contract.resetMarker.length > 128 ||
    contract.dataMarker.length > 128 ||
    contract.readyDeadlineMs !== 2800 ||
    contract.quietTailMs !== 1000 ||
    !itinerary ||
    contract.destinationScope !== itinerary.owners[1]?.scope ||
    recordingContract.visibility !== 'observe-entry-concealment' ||
    !Array.isArray(recordingContract.requiredKeys) ||
    recordingContract.requiredKeys.length !== 0 ||
    !Array.isArray(contract.expectedPosts) ||
    contract.expectedPosts.length !== 90 ||
    expected.some(
      (post, index) =>
        contract.expectedPosts[index]?.key !== post.key ||
        !sameSignature(contract.expectedPosts[index]?.signature, post.signature)
    )
  ) {
    add('invalid-native-entry-contract');
    return finish();
  }
  let measured: ReturnType<typeof assessNativeRecording>;
  try {
    measured = evaluateRecording(raw, recordingContract);
  } catch {
    add('native-entry-acquisition-unavailable');
    return finish();
  }
  acquisition = measured.verdict;
  const recording = raw as NativeRecording;
  let qualifiedFrameLimit = recording.frames?.length ?? 0;
  if (acquisition !== 'COMPLETE') {
    measured.issues.forEach((issue) =>
      add(`acquisition:${issue.code}`, 'incomplete', issue.frame)
    );
    const coverageOnly = new Set([
      'native-recording-coverage-gap',
      'missing-native-recording-tail',
      'invalid-native-recording-lifetime',
    ]);
    const coherentClock =
      Number.isFinite(recording.startedAt) &&
      recording.startedAt >= 0 &&
      Number.isFinite(recording.stoppedAt) &&
      recording.stoppedAt >= recording.startedAt &&
      recording.stoppedAt - recording.startedAt <=
        recordingContract.request.durationMs + 125 &&
      ['requested', 'deadline'].includes(recording.stopReason) &&
      recording.frames.every(
        (frame, index, frames) =>
          Number.isFinite(frame.geometry.startedAt) &&
          Number.isFinite(frame.geometry.finishedAt) &&
          frame.geometry.startedAt >= recording.startedAt &&
          frame.geometry.finishedAt <= recording.stoppedAt &&
          (!index ||
            frame.geometry.startedAt >=
              frames[index - 1].geometry.finishedAt) &&
          (!index ||
            frame.geometry.finishedAt > frames[index - 1].geometry.finishedAt)
      );
    if (
      !coherentClock ||
      measured.issues.some((issue) => !coverageOnly.has(issue.code))
    )
      return finish();
    // A later gap cannot erase an already observed wrong first landing. Only
    // the continuously acquired prefix can supply such independent failures.
    qualifiedFrameLimit = Math.min(
      qualifiedFrameLimit,
      ...measured.issues
        .filter((issue) => issue.code === 'native-recording-coverage-gap')
        .map((issue) => issue.frame ?? 0)
    );
    if (qualifiedFrameLimit === 0) return finish();
  }
  const qualifiedOwners = measured.ownerSamples.filter(
    (owner) => owner.frame < qualifiedFrameLimit
  );
  const reset = recording.markers.filter(
    (marker) => marker.name === contract.resetMarker
  );
  const data = recording.markers.filter(
    (marker) => marker.name === contract.dataMarker
  );
  const start = recording.markers.filter(
    (marker) => marker.name === 'action-start'
  );
  if (
    reset.length !== 1 ||
    data.length !== 1 ||
    start.length !== 1 ||
    recording.markers.length !== 3 ||
    start[0].time > reset[0].time ||
    reset[0].time > data[0].time
  ) {
    add('native-entry-actions-unwitnessed');
    return finish();
  }
  if (
    recording.markers.some((marker) =>
      recording.frames.some(
        (frame) =>
          frame.geometry.startedAt < marker.time &&
          marker.time < frame.geometry.finishedAt
      )
    )
  ) {
    add('native-entry-action-intersects-acquisition');
    return finish();
  }
  deadline = reset[0].time + contract.readyDeadlineMs;
  tailEnd = deadline + contract.quietTailMs;
  const firstDestination = qualifiedOwners.find((owner) => owner.index === 1);
  if (
    !firstDestination ||
    recording.frames[firstDestination.frame].geometry.startedAt <
      reset[0].time ||
    data[0].time > deadline ||
    !qualifiedOwners.some(
      (owner) => owner.index === 0 && owner.time <= reset[0].time
    )
  ) {
    add('native-entry-action-owner-order');
    return finish();
  }
  const expectedKeys = expected.map((post) => post.key);
  const revisionMatches = (keys: readonly string[]) =>
    keys.length === expectedKeys.length &&
    keys.every((key, i) => key === expectedKeys[i]);
  const nativeData = qualifiedOwners.find(
    (owner) =>
      owner.index === 1 &&
      owner.time >= data[0].time &&
      revisionMatches(
        measured.semanticSamples[owner.sampleIndex]?.requestedKeys ?? []
      )
  );
  if (!nativeData) {
    add('native-entry-data-update-unwitnessed');
    return finish();
  }
  // The native root proves the committed fixture input revision, not LegendList
  // internal membership. Actual exposed row metadata is checked independently.
  if (
    contract.mode === 'delayed' &&
    !qualifiedOwners.some(
      (owner) =>
        owner.index === 1 &&
        owner.time >= reset[0].time &&
        owner.time < data[0].time &&
        measured.semanticSamples[owner.sampleIndex]?.requestedKeys.length ===
          0 &&
        measured.semanticSamples[owner.sampleIndex]?.rows.length === 0
    )
  ) {
    add('native-entry-pending-phase-unwitnessed');
    return finish();
  }
  if (
    qualifiedOwners.some(
      (owner) =>
        owner.index === 1 &&
        owner.time < data[0].time &&
        measured.semanticSamples[owner.sampleIndex]?.rows.length
    )
  ) {
    add('native-entry-content-precedes-data-action');
    return finish();
  }
  firstContentFrame =
    measured.firstContentDestinationFrame !== null &&
    measured.firstContentDestinationFrame < qualifiedFrameLimit
      ? measured.firstContentDestinationFrame
      : null;
  const firstContent = qualifiedOwners.find(
    (owner) => owner.frame === firstContentFrame
  );
  const observedThroughDeadline =
    (qualifiedOwners.at(-1)?.time ?? 0) >= deadline;
  if (
    (!firstContent || firstContent.time > deadline) &&
    observedThroughDeadline
  )
    add('native-entry-missed-reveal-deadline', 'failure', firstContent?.frame);
  else if (!firstContent && !observedThroughDeadline)
    add('native-entry-reveal-deadline-unobserved');
  if (
    recording.stoppedAt < tailEnd ||
    recording.frames.at(-1)!.geometry.finishedAt < tailEnd - 125
  )
    add('native-entry-terminal-tail-missing');
  const targetKey =
    contract.mode === 'selected' ? 'scroll-fixture-65' : 'scroll-fixture-119';
  const expectedByKey = new Map(
    expected.map((post) => [post.key, post.signature])
  );
  for (const owner of qualifiedOwners) {
    if (owner.index !== 1) continue;
    const frame = recording.frames[owner.frame];
    const sample = measured.samples[owner.sampleIndex];
    const semantics = measured.semanticSamples[owner.sampleIndex];
    const viewport = frame.geometry.scroll!.view;
    const visibleRows = (frame.geometry.rows ?? []).filter((row) => {
      const view = row.view;
      return (
        owner.viewportVisible &&
        view &&
        view.attached &&
        !view.hidden &&
        view.effectiveAlpha > 0 &&
        view.clipFrame.width > 0 &&
        view.clipFrame.height > 0 &&
        view.clipFrame.y < sample.viewportBottom &&
        view.clipFrame.y + view.clipFrame.height > sample.viewportTop &&
        view.clipFrame.x < viewport.clipFrame.x + viewport.clipFrame.width &&
        view.clipFrame.x + view.clipFrame.width > viewport.clipFrame.x
      );
    });
    const active =
      firstContentFrame !== null && owner.frame >= firstContentFrame;
    if (active) {
      checkedContentFrames++;
      if (!owner.viewportVisible || visibleRows.length === 0)
        add(
          'native-entry-content-concealed-after-reveal',
          'failure',
          owner.frame
        );
      if (!revisionMatches(semantics.requestedKeys))
        add('native-entry-data-reverted', 'failure', owner.frame);
      const visibleKeys = visibleRows
        .slice()
        .sort((a, b) => a.view!.frame.y - b.view!.frame.y)
        .map((row) => row.id.slice(recordingContract.request.rowPrefix.length));
      if (
        visibleKeys.some(
          (key, index) =>
            !expectedByKey.has(key) ||
            (index > 0 &&
              expectedKeys.indexOf(key) <=
                expectedKeys.indexOf(visibleKeys[index - 1]))
        )
      )
        add('native-entry-visible-order', 'failure', owner.frame);
      for (const row of visibleRows) {
        const key = row.id.slice(recordingContract.request.rowPrefix.length);
        const revision = semantics.rows.find((item) => item.key === key);
        const signature = expectedByKey.get(key);
        if (
          !revision ||
          revision.scope !== contract.destinationScope ||
          !signature ||
          !sameSignature(revision.signature, signature)
        )
          add('native-entry-stale-visible-post', 'failure', owner.frame);
      }
      const target = sample.rows.find((row) => row.key === targetKey);
      const targetExposed = visibleRows.some(
        (row) => row.id === `${recordingContract.request.rowPrefix}${targetKey}`
      );
      if (!target || !targetExposed)
        add('native-entry-target-not-exposed', 'failure', owner.frame);
      else {
        const landing = evaluateLanding(
          sample,
          target,
          contract.mode === 'selected' ? 'center' : 'bottom'
        );
        if (!landing)
          add('native-entry-landing-unmeasured', 'incomplete', owner.frame);
        else {
          maxLandingErrorPt = Math.max(maxLandingErrorPt, landing.errorPt);
          if (landing.errorPt > 1 || !landing.exposed)
            add('native-entry-wrong-landing', 'failure', owner.frame);
        }
      }
      if (contract.mode !== 'selected') {
        const distance = Math.abs(sample.scroll - sample.scrollBounds!.max);
        maxLandingErrorPt = Math.max(maxLandingErrorPt, distance);
        if (distance > 1)
          add('native-entry-not-at-legal-end', 'failure', owner.frame);
      }
    }
    if (owner.time >= deadline && owner.time <= tailEnd) {
      checkedTailFrames++;
      if (!active)
        add('native-entry-terminal-content-absent', 'failure', owner.frame);
    }
  }
  if (checkedTailFrames < 6)
    add('native-entry-terminal-tail-insufficient-samples');
  return finish();
}

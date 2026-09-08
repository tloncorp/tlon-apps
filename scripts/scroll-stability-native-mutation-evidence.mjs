import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assessNativeMutationTrace,
  assessNativeAnchorTrace,
} from '../packages/app/fixtures/scrollNativeMutationTrace.ts';
import { replayNativeRecording } from './scroll-stability-native-recording-evidence.mjs';
import { assessNativeRecording } from '../packages/app/fixtures/scrollNativeRecording.ts';
import {
  adaptBufferedNativeScrollGeometry,
  adaptNativeEntryRuler,
} from '../packages/app/fixtures/scrollNativeGeometry.ts';
import { rowMutationContractFingerprint } from '../packages/app/fixtures/scrollStabilityMutation.ts';
const stable = (x) =>
  Array.isArray(x)
    ? x.map(stable)
    : x && typeof x === 'object'
      ? Object.fromEntries(
          Object.entries(x)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, stable(v)])
        )
      : x;
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
/** Ordinary HOLD uses the existing predeclared required key, not mutation semantics. */
export function assessNativeHoldEvidence(trace) {
  const incomplete = (code) => ({
    version: 1,
    verdict: 'INCOMPLETE',
    issues: [{ code, kind: 'incomplete' }],
    evidenceLevel: 'native-bound-anchor-continuity-v1',
    productActions: 'UNASSESSED',
    nativePresentation: 'INCOMPLETE',
    metrics: { maxAnchorDriftPt: 0, qualifiedFrames: 0 },
  });
  try {
    if (
      !/^(?:(?:append|burst)-history|prepend-history|stateful-image-load-history|thinking-(?:show-hide|label|handoff-(?:message-first|same-frame|hide-first))-history)$/.test(
        trace?.scenario ?? ''
      )
    )
      return {
        ...incomplete('native-hold-scenario-unassessed'),
        verdict: 'UNASSESSED',
      };
    const r = trace.nativeRecordingContract,
      a = trace.expectations?.anchor,
      ruler = trace.nativeSampledRulerContract,
      transfer = trace.nativeRecordingTransfer;
    const text = (v) => typeof v === 'string' && v.length > 0;
    if (
      trace.assertion !== 'hold' ||
      trace.nativeGeometrySchemaVersion !== 1 ||
      !a ||
      !text(a.key) ||
      (a.reference !== undefined && a.reference !== 'window') ||
      (a.tolerancePt !== undefined && a.tolerancePt !== 1) ||
      trace.nativeMutationContract !== undefined ||
      trace.nativeEntryContract !== undefined ||
      trace.nativeMutationMarkerTransfer !== undefined ||
      trace.mutationEvidence !== undefined ||
      !r ||
      !equal(r.requiredKeys, [a.key]) ||
      !r.populated ||
      r.visibility !== 'require-visible' ||
      r.itinerary ||
      !ruler ||
      ruler.version !== 'indexed-cell-and-surfaces-v2' ||
      !text(ruler.scope) ||
      ruler.scope !== r.scope ||
      ['rootId', 'scrollViewId', 'composerId'].some(
        (key) => !text(ruler[key]) || ruler[key] !== r.request?.[key]
      )
    )
      return incomplete('native-hold-policy-mismatch');
    const duration = /^(thinking-|stateful-image-load-)/.test(trace.scenario)
      ? 2400
      : 1800;
    const starts = Array.isArray(trace.events)
      ? trace.events.filter((e) => e?.name === 'scenario-start')
      : [];
    if (
      starts.length !== 1 ||
      !finite(starts[0].time) ||
      starts[0].values?.scenario !== trace.scenario ||
      starts[0].values?.assertion !== 'hold' ||
      !transfer ||
      transfer.clock !== 'performance.now milliseconds' ||
      ![
        transfer.startAcknowledgedAt,
        transfer.earliestStopAt,
        transfer.requestedAt,
        transfer.receivedAt,
      ].every(finite) ||
      transfer.startAcknowledgedAt < 0 ||
      transfer.startAcknowledgedAt > starts[0].time ||
      starts[0].time > transfer.requestedAt ||
      transfer.earliestStopAt < transfer.startAcknowledgedAt + duration ||
      transfer.requestedAt < transfer.earliestStopAt ||
      transfer.receivedAt < transfer.requestedAt
    )
      return incomplete('native-hold-transfer-order');
    // The public acquisition reader already evaluates every raw frame. Reuse its
    // verdict/issues inside the shared bound-anchor pass rather than repeating it.
    const acquisition = replayNativeRecording(trace);
    return assessNativeAnchorTrace(
      trace.nativeRecording,
      r,
      {
        version: 1,
        recordingId: r.recordingId,
        scope: r.scope,
        anchorKey: a.key,
      },
      {
        assessRecording: assessNativeRecording,
        adaptGeometry: adaptBufferedNativeScrollGeometry,
        evaluateRuler: adaptNativeEntryRuler,
        recordingAssessment: acquisition,
      }
    );
  } catch {
    return incomplete('native-hold-malformed-evidence');
  }
}

/** Separate native-authority verdict. Never uses producer verdicts or JS geometry samples. */
export function assessNativeMutationEvidence(trace) {
  const incomplete = (code) => ({
    version: 1,
    verdict: 'INCOMPLETE',
    issues: [{ code, kind: 'incomplete' }],
    evidenceLevel: 'native-committed-mutation-v1',
    nativePresentation: 'INCOMPLETE',
    anchorContinuity: {
      verdict: 'INCOMPLETE',
      issues: [{ code, kind: 'incomplete' }],
      evidenceLevel: 'native-bound-anchor-continuity-v1',
      nativePresentation: 'INCOMPLETE',
      metrics: { maxAnchorDriftPt: 0, qualifiedFrames: 0 },
    },
  });
  try {
    const scenario =
      /^(near|history)-(grow|shrink|reference|media|remove|reaction|reply|cache)$/.exec(
        trace?.scenario ?? ''
      );
    const c = trace?.nativeMutationContract,
      p = trace?.mutationEvidence?.contract,
      r = trace?.nativeRecordingContract,
      t = trace?.nativeMutationMarkerTransfer,
      transfer = trace?.nativeRecordingTransfer;
    if (
      trace?.fixtureVersion !== 2 ||
      trace?.platform !== 'ios' ||
      trace?.productCoverage !== 'local-component-fixture' ||
      !scenario ||
      !c ||
      !p ||
      p.version !== 1 ||
      !Array.isArray(p.phases) ||
      p.phases.length !== 1 ||
      !r ||
      r.recordingId !== c.recordingId ||
      !r.recordingId.startsWith(`${trace.runId}:${trace.scenario}:`) ||
      c.kind !== scenario[2] ||
      c.scope !== trace.mutationScope ||
      p.scope !== c.scope ||
      p.key !== c.key ||
      p.kind !== c.kind ||
      p.phases[0].requestId !== c.requestId ||
      !equal(p.baseline?.state, c.baseline) ||
      !equal(p.phases[0].state, c.expected) ||
      trace.expectations?.anchor?.key !== c.anchorKey ||
      (trace.expectations.anchor.reference !== undefined &&
        trace.expectations.anchor.reference !== 'window') ||
      (trace.expectations.anchor.tolerancePt !== undefined &&
        trace.expectations.anchor.tolerancePt !== 1) ||
      r.scope !== c.scope ||
      r.request?.durationMs !== 3300 ||
      r.request?.maximumFrames !== 900 ||
      r.minimumDurationMs !== 1675 ||
      r.populated !== true ||
      !equal(r.requiredKeys, [c.anchorKey])
    )
      return incomplete('native-mutation-plan-link-mismatch');
    if (!Array.isArray(trace.events))
      return incomplete('native-mutation-events-missing');
    const plans = trace.events.filter((e) => e.name === 'native-mutation-plan'),
      oldPlans = trace.events.filter((e) => e.name === 'row-mutation-plan'),
      requests = trace.events.filter((e) => e.name === 'row-mutation-request'),
      starts = trace.events.filter((e) => e.name === 'scenario-start');
    if (
      plans.length !== 1 ||
      plans[0].time !== c.declaredAt ||
      plans[0].values?.contract !== JSON.stringify(c) ||
      oldPlans.length !== 1 ||
      oldPlans[0].time !== p.declaredAt ||
      oldPlans[0].values?.contract !== rowMutationContractFingerprint(p) ||
      requests.length !== 1 ||
      starts.length !== 1 ||
      starts[0].values?.scenario !== trace.scenario ||
      !equal(requests[0].values, {
        key: c.key,
        kind: c.kind,
        scope: c.scope,
        phaseId: p.phases[0].id,
        requestId: c.requestId,
        revision: p.phases[0].revision,
      })
    )
      return incomplete('native-mutation-event-link-mismatch');
    const phase = p.phases[0];
    if (
      !phase.requestWindow ||
      ![
        phase.requestWindow.startTime,
        phase.requestWindow.endTime,
        starts[0].time,
      ].every(finite) ||
      phase.requestWindow.startTime > phase.requestWindow.endTime ||
      ![
        phase.id,
        phase.revision,
        p.baseline?.requestId,
        p.baseline?.revision,
      ].every((x) => typeof x === 'string' && x.length > 0) ||
      p.baseline.requestId !== `${c.requestId}:baseline` ||
      phase.effect !==
        (c.kind === 'remove'
          ? 'remove'
          : c.kind === 'reference'
            ? 'commit'
            : 'resize')
    )
      return incomplete('native-mutation-phase-shape');
    const q = requests[0].time;
    if (
      !finite(c.declaredAt) ||
      !finite(p.declaredAt) ||
      !finite(q) ||
      !transfer ||
      transfer.clock !== 'performance.now milliseconds' ||
      ![
        transfer.startAcknowledgedAt,
        transfer.earliestStopAt,
        transfer.requestedAt,
        transfer.receivedAt,
      ].every(finite) ||
      p.declaredAt > c.declaredAt ||
      c.declaredAt > transfer.startAcknowledgedAt ||
      transfer.startAcknowledgedAt > starts[0].time ||
      starts[0].time > q ||
      c.declaredAt >= q ||
      q < p.phases[0].requestWindow?.startTime ||
      q > p.phases[0].requestWindow?.endTime ||
      !t ||
      t.name !== c.requestMarker ||
      t.clock !== 'performance.now milliseconds' ||
      ![t.requestedAt, t.receivedAt].every(finite) ||
      t.requestedAt < transfer.startAcknowledgedAt ||
      t.receivedAt < t.requestedAt ||
      t.receivedAt > q ||
      transfer.earliestStopAt < t.receivedAt + 1400 ||
      transfer.earliestStopAt < transfer.startAcknowledgedAt + 1800 ||
      transfer.requestedAt < transfer.earliestStopAt ||
      transfer.receivedAt < transfer.requestedAt
    )
      return incomplete('native-mutation-transfer-order');
    try {
      return assessNativeMutationTrace(trace.nativeRecording, r, c, {
        assessRecording: assessNativeRecording,
        adaptGeometry: adaptBufferedNativeScrollGeometry,
        evaluateRuler: adaptNativeEntryRuler,
      });
    } catch {
      return incomplete('native-mutation-reader-exception');
    }
  } catch {
    return incomplete('native-mutation-malformed-input');
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error(
      'Usage: node scripts/scroll-stability-native-mutation-evidence.mjs trace.json [...]'
    );
    process.exitCode = 1;
  } else {
    const records = paths.map((source) => {
      const raw = readFileSync(source);
      return {
        source,
        sha256: createHash('sha256').update(raw).digest('hex'),
        ...assessNativeMutationEvidence(JSON.parse(raw)),
      };
    });
    console.log(JSON.stringify(records, null, 2));
    if (records.some((r) => r.verdict !== 'PASS')) process.exitCode = 1;
  }
}

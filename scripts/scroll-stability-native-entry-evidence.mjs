import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessNativeEntryTrace } from '../packages/app/fixtures/scrollNativeEntryTrace.ts';
import { assessNativeRecording } from '../packages/app/fixtures/scrollNativeRecording.ts';
import { adaptBufferedNativeScrollGeometry } from '../packages/app/fixtures/scrollNativeGeometry.ts';
import { assessClampedScrollLanding } from '../packages/app/fixtures/scrollStabilityTrace.ts';
import { replayNativeRecording } from './scroll-stability-native-recording-evidence.mjs';

/** Independent bounded entry product proof; ordinary cases remain unassessed. */
export function replayNativeEntry(trace) {
  const incomplete = (code, acquisition = 'INCOMPLETE') => ({
    verdict: 'INCOMPLETE',
    acquisition,
    issues: [{ code, kind: 'incomplete' }],
    evidenceLevel: 'native-buffered-entry-row-model',
    nativePresentation: 'INCOMPLETE',
    inputToUsableLandingLatency: 'INCOMPLETE',
  });
  const contract = trace?.nativeEntryContract;
  if (
    !contract ||
    !['entry-latest', 'entry-selected', 'entry-delayed'].includes(
      trace.scenario
    ) ||
    trace.scenario !== `entry-${contract.mode}`
  )
    return incomplete('missing-scoped-native-entry-contract');
  const acquisition = replayNativeRecording(trace);
  if (
    acquisition.verdict !== 'COMPLETE' &&
    acquisition.issues.some(
      (issue) =>
        ![
          'native-recording-coverage-gap',
          'missing-native-recording-tail',
          'invalid-native-recording-lifetime',
        ].includes(issue.code)
    )
  )
    return {
      ...incomplete('native-entry-acquisition-incomplete'),
      issues: acquisition.issues.map((issue) => ({
        ...issue,
        kind: 'incomplete',
      })),
    };
  const transfers = trace.nativeEntryMarkerTransfers;
  const transfer = trace.nativeRecordingTransfer;
  if (
    !Array.isArray(transfers) ||
    transfers.length !== 2 ||
    !transfer ||
    transfer.clock !== 'performance.now milliseconds' ||
    ![
      'startAcknowledgedAt',
      'earliestStopAt',
      'requestedAt',
      'receivedAt',
    ].every((key) => Number.isFinite(transfer[key])) ||
    transfer.receivedAt < transfer.requestedAt ||
    transfer.requestedAt < transfer.earliestStopAt ||
    transfers.some(
      (item, index) =>
        !item ||
        item.name !==
          (index === 0 ? contract.resetMarker : contract.dataMarker) ||
        item.clock !== 'performance.now milliseconds' ||
        !Number.isFinite(item.requestedAt) ||
        !Number.isFinite(item.receivedAt) ||
        item.receivedAt < item.requestedAt ||
        item.requestedAt < transfer.startAcknowledgedAt ||
        item.receivedAt > transfer.requestedAt ||
        (index > 0 && item.requestedAt < transfers[index - 1].receivedAt)
    ) ||
    transfer.earliestStopAt < transfers[0].receivedAt + 3800
  )
    return incomplete(
      'native-entry-marker-transfer-unqualified',
      acquisition.verdict
    );
  const events = trace.events;
  if (
    !Array.isArray(events) ||
    events.some(
      (event, i) =>
        !event ||
        !Number.isFinite(event.time) ||
        event.time > transfer.receivedAt ||
        (i && event.time < events[i - 1].time)
    )
  )
    return incomplete(
      'native-entry-js-action-timeline-unqualified',
      acquisition.verdict
    );
  const reset = events.filter((event) => event.name === 'reset');
  const channel = contract.destinationScope.slice(
    0,
    contract.destinationScope.lastIndexOf('::')
  );
  const attach = events.find(
    (event) =>
      event.name === 'list-attached' &&
      event.values?.channelId === channel &&
      reset[0] &&
      event.time >= reset[0].time
  );
  if (
    reset.length !== 1 ||
    reset[0].values?.mode !== contract.mode ||
    reset[0].time < transfers[0].receivedAt ||
    (contract.mode !== 'delayed' && reset[0].time < transfers[1].receivedAt) ||
    !attach
  )
    return incomplete(
      'native-entry-actual-reset-unwitnessed',
      acquisition.verdict
    );
  // Marker and JS action proof qualify identity/chronology in their own clocks.
  // All first-reveal, deadline, and terminal checks below use native time only.
  return assessNativeEntryTrace(
    trace.nativeRecording,
    trace.nativeRecordingContract,
    contract,
    (raw, request) =>
      assessNativeRecording(raw, request, adaptBufferedNativeScrollGeometry),
    assessClampedScrollLanding
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    process.stderr.write(
      'Usage: node scripts/scroll-stability-native-entry-evidence.mjs trace.json [...]\n'
    );
    process.exitCode = 1;
  } else {
    const records = paths.map((source) => {
      const bytes = readFileSync(source);
      return {
        source,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        ...replayNativeEntry(JSON.parse(bytes)),
      };
    });
    process.stdout.write(JSON.stringify(records, null, 2) + '\n');
    if (records.some((record) => record.verdict !== 'PASS'))
      process.exitCode = 1;
  }
}

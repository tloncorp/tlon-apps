import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessNativeRecording } from '../packages/app/fixtures/scrollNativeRecording.ts';
import { adaptBufferedNativeScrollGeometry } from '../packages/app/fixtures/scrollNativeGeometry.ts';

/** Independent acquisition replay. It cannot grant product-scenario coverage. */
export function replayNativeRecording(trace) {
  const contract = trace?.nativeRecordingContract;
  const incomplete = (code) => ({
    verdict: 'INCOMPLETE',
    issues: [{ code }],
    evidenceLevel: 'native-buffer-acquisition-only',
    productVerdict: 'UNASSESSED',
    nativePresentation: 'INCOMPLETE',
  });
  if (
    trace?.fixtureVersion !== 2 ||
    trace.platform !== 'ios' ||
    trace.productCoverage !== 'local-component-fixture' ||
    typeof trace.runId !== 'string' ||
    typeof trace.scenario !== 'string' ||
    !Array.isArray(trace.originalDataKeys) ||
    !contract ||
    !contract.recordingId?.startsWith(`${trace.runId}:${trace.scenario}:`) ||
    contract.populated !== trace.originalDataKeys.length > 0 ||
    contract.visibility !==
      (trace.scenario.startsWith('entry-')
        ? 'observe-entry-concealment'
        : 'require-visible') ||
    contract.request?.maximumFrames !== 900
  )
    return incomplete('missing-scoped-native-recording');
  const entry = ['entry-latest', 'entry-selected', 'entry-delayed'].includes(
    trace.scenario
  );
  if (trace.scenario.startsWith('entry-') && !entry)
    return incomplete('unknown-native-entry-scenario');
  if (entry) {
    // Entry permission is exact: one stable physical root, this scope and its
    // next fixture generation. It is never inferred from observed owner changes.
    const itinerary = contract.itinerary;
    const scope = /^(.*)::(0|[1-9]\d*)$/.exec(contract.scope ?? '');
    if (
      !itinerary ||
      !scope ||
      !scope[1] ||
      !Number.isSafeInteger(Number(scope[2])) ||
      itinerary.version !== 1 ||
      !Array.isArray(itinerary.owners) ||
      itinerary.owners.length !== 2 ||
      contract.request.rootId !== 'scroll-stability-native-root' ||
      contract.request.composerId !== 'scroll-stability-composer' ||
      !contract.request.scrollViewId.startsWith(
        'tlon-conversation-scroll-edge-content-'
      ) ||
      itinerary.owners[0]?.rootId !== contract.request.rootId ||
      itinerary.owners[0]?.scope !== contract.scope ||
      itinerary.owners[0]?.scrollViewId !== contract.request.scrollViewId ||
      itinerary.owners[1]?.rootId !== contract.request.rootId ||
      itinerary.owners[1]?.scope !== `${scope[1]}::${Number(scope[2]) + 1}` ||
      itinerary.owners[1]?.scrollViewPrefix !==
        'tlon-conversation-scroll-edge-content-' ||
      !Array.isArray(contract.requiredKeys) ||
      contract.requiredKeys.length !== 0
    )
      return incomplete('missing-or-changed-native-entry-itinerary');
  } else if (
    contract.itinerary !== undefined ||
    trace.nativeRecording?.itinerary !== undefined
  ) {
    return incomplete('unexpected-native-scenario-itinerary');
  }
  const duration = trace.scenario.startsWith('entry-')
    ? 2800
    : trace.scenario === 'thinking-empty-show-hide'
      ? 2200
      : /^(thinking-(?:show-hide|label|handoff)|stateful-image-load-)/.test(
            trace.scenario
          )
        ? 2400
        : /^(armed-|keyboard(?:-|$)|composer-|gesture$|media-return$)/.test(
              trace.scenario
            )
          ? 4500
          : /^(empty-first-post$|prepend-history$|(?:append|burst)-(?:end|history)$|(?:near|history)-(?:grow|shrink|reference|media|remove|reaction|reply|cache)$|dismiss-history$)/.test(
                trace.scenario
              )
            ? 1800
            : null;
  if (
    duration === null ||
    contract.request.durationMs !== duration + 1500 ||
    contract.minimumDurationMs !== duration - 125
  )
    return incomplete('native-recording-duration-contract-changed');
  const result = assessNativeRecording(
    trace.nativeRecording,
    contract,
    adaptBufferedNativeScrollGeometry
  );
  return {
    verdict: result.verdict,
    issues: result.issues,
    evidenceLevel: 'native-buffer-acquisition-only',
    productVerdict: 'UNASSESSED',
    nativePresentation: 'INCOMPLETE',
    metrics: {
      samples: result.samples.length,
      maxOperationMs: Math.max(
        0,
        ...result.samples.map((sample) => sample.measurement.durationMs)
      ),
      concealedSamples: result.exposureSamples.filter(
        (sample) => !sample.viewportVisible
      ).length,
      semanticSamples: result.semanticSamples.length,
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    process.stderr.write(
      'Usage: node scripts/scroll-stability-native-recording-evidence.mjs trace.json [...]\nAcquisition qualification only; product geometry, actions and presentation remain separately required.\n'
    );
    process.exitCode = 1;
  } else {
    const records = paths.map((source) => {
      const bytes = readFileSync(source);
      return {
        source,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        ...replayNativeRecording(JSON.parse(bytes)),
      };
    });
    process.stdout.write(JSON.stringify(records, null, 2) + '\n');
    if (records.some((record) => record.verdict !== 'COMPLETE'))
      process.exitCode = 1;
  }
}

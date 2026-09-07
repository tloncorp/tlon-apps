import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Audited against this exact build's macOS CALayer presentation path. See the
// contract before extending this allowlist: feedback is predicted display time.
export const supportedChromiumPresentationBuild = Object.freeze({
  product: 'Chrome/136.0.7103.25',
  revision: '@97d495678dc307bfe6d6475901104e262ec7a487',
});
export const presentationTraceCategories = Object.freeze([
  'benchmark',
  'blink.user_timing',
  'cc',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
]);
const states = new Set([
  'STATE_PRESENTED_ALL',
  'STATE_PRESENTED_PARTIAL',
  'STATE_DROPPED',
  'STATE_NO_UPDATE_DESIRED',
]);
const safeId = (value) => Number.isSafeInteger(value) && value > 0;
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0;
const category = (event, name) =>
  typeof event?.cat === 'string' && event.cat.split(',').includes(name);
const frameOf = (response) => response?.frameTree?.frame;
const eventReference = (event, index) => ({
  index,
  name: event.name,
  phase: event.ph,
  pid: event.pid,
  tid: event.tid,
  timestampUs: event.ts,
  localTrackId: event.id2?.local ?? null,
});

/** Read raw CDP JSON. This cannot return a physical presentation PASS. */
export function assessChromiumPresentationEvidence(
  trace,
  receipt,
  options = {}
) {
  const issues = [];
  const issue = (code, detail, kind = 'incomplete') =>
    issues.push({ code, kind, detail });
  const records = [];
  const feedbackEstimates = [];
  const markers = options.markers ??
    receipt?.markers ?? {
      start: 'scroller-presentation-start',
      end: 'scroller-presentation-end',
      tail: 'scroller-presentation-tail',
    };
  let attributable = true;
  const rejectAttribution = (code, detail) => {
    attributable = false;
    issue(code, detail);
  };
  const events = Array.isArray(trace?.traceEvents) ? trace.traceEvents : [];
  if (!events.length)
    rejectAttribution('missing-raw-events', 'No traceEvents array.');
  const version = receipt?.version;
  if (
    version?.product !== supportedChromiumPresentationBuild.product ||
    version?.revision !== supportedChromiumPresentationBuild.revision ||
    typeof version?.userAgent !== 'string' ||
    !version.userAgent.includes('Macintosh')
  ) {
    rejectAttribution(
      'unsupported-source',
      'Only the source-audited Chromium macOS build is supported.'
    );
  }
  const command = receipt?.command?.arguments;
  if (
    !Array.isArray(command) ||
    !command.length ||
    command.some((arg) => /^--headless(?:=|$)/.test(arg))
  ) {
    rejectAttribution(
      'unsupported-browser-mode',
      'An original headed browser command line is required.'
    );
  }
  if (receipt?.complete?.dataLossOccurred !== false) {
    issue(
      'trace-not-complete',
      'CDP must report tracingComplete with dataLossOccurred false.'
    );
  }
  if (receipt?.captureErrors?.length) {
    issue(
      'capture-error',
      'The recorder preserved errors while finalizing raw evidence.'
    );
  }
  const target = receipt?.target?.targetInfo;
  const frame = frameOf(receipt?.frame);
  if (
    !target?.targetId ||
    target.type !== 'page' ||
    target.targetId !== frame?.id ||
    !frame?.loaderId ||
    target.url !== frame.url
  ) {
    rejectAttribution(
      'invalid-target',
      'The captured top-level page target and frame must agree.'
    );
  }
  const finalFrame = frameOf(receipt?.finalFrame);
  if (
    finalFrame &&
    (finalFrame.id !== frame?.id || finalFrame.loaderId !== frame?.loaderId)
  ) {
    rejectAttribution(
      'navigation-changed',
      'The page changed navigation during capture.'
    );
  }
  const getMark = (name, required) => {
    const matches = events.flatMap((event, index) =>
      event?.name === name && category(event, 'blink.user_timing')
        ? [{ event, index }]
        : []
    );
    if (matches.length !== 1) {
      if (required)
        rejectAttribution(
          'invalid-action-mark',
          `${name}: expected exactly one raw mark.`
        );
      else
        issue(
          'invalid-observation-tail',
          `${name}: expected exactly one raw mark.`
        );
      return null;
    }
    const entry = matches[0];
    if (
      entry.event.ph !== 'I' ||
      !timestamp(entry.event.ts) ||
      !safeId(entry.event.pid) ||
      !safeId(entry.event.tid)
    ) {
      if (required)
        rejectAttribution(
          'invalid-action-mark',
          `${name}: invalid source mark.`
        );
      else issue('invalid-observation-tail', `${name}: invalid source mark.`);
      return null;
    }
    return entry;
  };
  if (
    !markers ||
    new Set([markers.start, markers.end, markers.tail]).size !== 3 ||
    Object.values(markers).some(
      (value) => typeof value !== 'string' || !value.length
    )
  ) {
    rejectAttribution(
      'invalid-marker-names',
      'Three distinct named action marks are required.'
    );
  }
  const start = getMark(markers?.start, true);
  const end = getMark(markers?.end, true);
  const tail = getMark(markers?.tail, false);
  const pid = start?.event.pid;
  const tid = start?.event.tid;
  const sameScope = (entry) =>
    entry?.event.pid === pid &&
    entry?.event.tid === tid &&
    entry?.event.args?.data?.navigationId === frame?.loaderId;
  if (
    !start ||
    !end ||
    !sameScope(start) ||
    !sameScope(end) ||
    end.event.ts <= start.event.ts
  ) {
    rejectAttribution(
      'invalid-action-scope',
      'Start/end must be ordered in the captured navigation and renderer thread.'
    );
  }
  if (
    tail &&
    (!sameScope(tail) || !end || tail.event.ts - end.event.ts < 1_000_000)
  ) {
    issue(
      'invalid-observation-tail',
      'A same-scope tail of at least 1,000 ms is required.'
    );
  }
  const validTail =
    tail && sameScope(tail) && end && tail.event.ts - end.event.ts >= 1_000_000;
  const windowStartUs = start?.event.ts;
  const windowEndUs = validTail ? tail.event.ts : end?.event.ts;
  const hasMetadata = (name, value, eventTid) =>
    events.some(
      (event) =>
        event?.ph === 'M' &&
        event.name === name &&
        event.pid === pid &&
        (eventTid === undefined || event.tid === eventTid) &&
        event.args?.name === value
    );
  if (
    !hasMetadata('process_name', 'Renderer') ||
    !hasMetadata('thread_name', 'CrRendererMain', tid)
  ) {
    rejectAttribution(
      'missing-renderer-metadata',
      'Raw renderer process and main-thread metadata are required.'
    );
  }
  const bindings = events
    .filter(
      (event) =>
        event?.name === 'SetLayerTreeId' &&
        event.pid === pid &&
        event.tid === tid &&
        category(event, 'disabled-by-default-devtools.timeline') &&
        event.args?.data?.frame === frame?.id &&
        timestamp(event.ts) &&
        event.ts <= windowEndUs
    )
    .sort((a, b) => a.ts - b.ts);
  const initialBinding = bindings
    .filter((event) => event.ts <= windowStartUs)
    .at(-1);
  const layerTreeId = initialBinding?.args?.data?.layerTreeId;
  if (
    !safeId(layerTreeId) ||
    bindings.some(
      (event) =>
        event.ts >= windowStartUs && event.args.data.layerTreeId !== layerTreeId
    )
  ) {
    rejectAttribution(
      'invalid-layer-binding',
      'A stable page-to-layer-tree binding must precede the action.'
    );
  }
  // Layer IDs are renderer-local; a conflicting page binding is ambiguous.
  if (
    events.some(
      (event) =>
        event?.name === 'SetLayerTreeId' &&
        event.pid === pid &&
        event.ts >= windowStartUs &&
        event.ts <= windowEndUs &&
        event.args?.data?.layerTreeId === layerTreeId &&
        event.args?.data?.frame !== frame?.id
    )
  ) {
    rejectAttribution(
      'ambiguous-layer-binding',
      'The requested layer tree was also attributed to another page.'
    );
  }

  if (attributable) {
    const tracks = new Map();
    events.forEach((event, index) => {
      if (
        event?.name !== 'PipelineReporter' ||
        event.pid !== pid ||
        !category(event, 'cc')
      )
        return;
      const key = event.id2?.local;
      if (typeof key !== 'string' || !/^0x[0-9a-f]+$/i.test(key)) {
        if (event.ts >= windowStartUs && event.ts <= windowEndUs)
          issue(
            'invalid-track-id',
            'PipelineReporter requires its exact local hexadecimal string ID.'
          );
        return;
      }
      const entries = tracks.get(key) ?? [];
      entries.push({ event, index });
      tracks.set(key, entries);
    });
    for (const entries of tracks.values()) {
      const begins = entries.filter(({ event }) => event.ph === 'b');
      const ends = entries.filter(({ event }) => event.ph === 'e');
      if (
        !begins.length &&
        ends.some(
          ({ event }) => event.ts >= windowStartUs && event.ts <= windowEndUs
        )
      ) {
        issue(
          'unpaired-pipeline-record',
          'A renderer PipelineReporter end has no begin and cannot be assigned a layer.'
        );
      }
      const relevantBegins = begins.filter(
        ({ event }) =>
          event.args?.chrome_frame_reporter?.layer_tree_host_id ===
            layerTreeId &&
          event.ts <= windowEndUs &&
          (ends.some(({ event: finish }) => finish.ts >= windowStartUs) ||
            event.ts >= windowStartUs)
      );
      if (!relevantBegins.length) continue;
      if (begins.length !== 1 || ends.length !== 1 || entries.length !== 2) {
        issue(
          'unpaired-pipeline-record',
          'A relevant PipelineReporter track needs one begin and one end.'
        );
        continue;
      }
      const begin = begins[0];
      const finish = ends[0];
      const data = begin.event.args.chrome_frame_reporter;
      const valid =
        timestamp(begin.event.ts) &&
        timestamp(finish.event.ts) &&
        finish.event.ts >= begin.event.ts &&
        safeId(data.frame_source) &&
        safeId(data.frame_sequence) &&
        states.has(data.state) &&
        [
          'affects_smoothness',
          'has_missing_content',
          'checkerboarded_needs_raster',
          'checkerboarded_needs_record',
          'has_high_latency',
        ].every((key) => typeof data[key] === 'boolean') &&
        (!data.affects_smoothness ||
          ['STATE_DROPPED', 'STATE_PRESENTED_PARTIAL'].includes(data.state));
      if (!valid) {
        issue(
          'invalid-pipeline-record',
          `Invalid timing, safe identifier, state or flags at event ${begin.index}.`
        );
        continue;
      }
      const record = {
        source: 'chromium-pipeline-reporter',
        begin: eventReference(begin.event, begin.index),
        end: eventReference(finish.event, finish.index),
        frameSource: data.frame_source,
        frameSequence: data.frame_sequence,
        layerTreeId,
        state: data.state,
        affectsSmoothness: data.affects_smoothness,
        missingContent:
          data.has_missing_content ||
          data.checkerboarded_needs_raster ||
          data.checkerboarded_needs_record,
        highLatencyOver75Ms: data.has_high_latency,
        frameType: data.frame_type ?? null,
        // Keep all original fields for inspection. Int64 surface/display IDs may
        // already be rounded by JSON.parse and are NEVER correlation keys.
        rawReporter: data,
      };
      records.push(record);
      if (record.affectsSmoothness)
        issue(
          'renderer-smoothness-failure',
          `Chromium reports ${record.state} affecting smoothness at event ${begin.index}.`,
          'failure'
        );
      if (
        record.missingContent &&
        ['STATE_PRESENTED_ALL', 'STATE_PRESENTED_PARTIAL'].includes(
          record.state
        )
      )
        issue(
          'renderer-missing-content',
          `Chromium reports missing content in a presented frame at event ${begin.index}.`,
          'failure'
        );
      if (finish.event.ts > windowEndUs)
        issue(
          'frame-extends-observation',
          `Event ${begin.index} terminates after the observation boundary.`
        );
    }
    if (!records.length)
      issue(
        'missing-pipeline-evidence',
        'No valid PipelineReporter record could be attributed to this action.'
      );
    events.forEach((event, index) => {
      if (
        event?.name !== 'AnimationFrame::Presentation' ||
        event.pid !== pid ||
        !category(event, 'devtools.timeline') ||
        event.ts < windowStartUs ||
        event.ts > windowEndUs
      )
        return;
      const id = event.args?.begin_frame_id;
      if (
        event.ph !== 'n' ||
        !timestamp(event.ts) ||
        !safeId(id?.source_id) ||
        !safeId(id?.sequence_number) ||
        typeof event.args?.id !== 'string'
      ) {
        issue(
          'unattributed-feedback',
          `Invalid/zero begin-frame identity at feedback event ${index}.`
        );
        return;
      }
      const matchingRecords = records.filter(
        (record) =>
          record.frameSource === id.source_id &&
          record.frameSequence === id.sequence_number
      );
      if (!matchingRecords.length) {
        issue(
          'unattributed-feedback',
          `No scoped pipeline record matches feedback event ${index}.`
        );
        return;
      }
      feedbackEstimates.push({
        source: 'chromium-macos-estimated-presentation-feedback',
        event: eventReference(event, index),
        animationTraceId: event.args.id,
        frameSource: id.source_id,
        frameSequence: id.sequence_number,
        pipelineBeginEventIndexes: matchingRecords.map(
          (record) => record.begin.index
        ),
        physicalPresentationProven: false,
      });
    });
  }
  const failed = issues.some((entry) => entry.kind === 'failure');
  const incomplete = issues.some((entry) => entry.kind === 'incomplete');
  return {
    verdict: failed ? 'FAIL' : 'INCOMPLETE',
    passed: false,
    presentationVerdict: 'INCOMPLETE',
    presentationLimitation:
      'The audited macOS Chromium backend predicts feedback.timestamp from display-link timing. This trace lacks independently observed physical presentation and per-frame deadlines.',
    pipelineVerdict: failed
      ? 'FAIL'
      : incomplete
        ? 'INCOMPLETE'
        : 'NO_FAILURE_OBSERVED',
    evidenceLevel: 'chromium-renderer-pipeline',
    attribution: attributable
      ? {
          targetId: target.targetId,
          navigationId: frame.loaderId,
          rendererPid: pid,
          mainThreadId: tid,
          layerTreeId,
        }
      : null,
    window: {
      startUs: windowStartUs ?? null,
      actionEndUs: end?.event.ts ?? null,
      observationEndUs: windowEndUs ?? null,
      unit: 'trace-monotonic-microseconds',
    },
    counts: {
      records: records.length,
      affectsSmoothness: records.filter((record) => record.affectsSmoothness)
        .length,
      dropped: records.filter((record) => record.state === 'STATE_DROPPED')
        .length,
      partial: records.filter(
        (record) => record.state === 'STATE_PRESENTED_PARTIAL'
      ).length,
      highLatencyOver75Ms: records.filter(
        (record) => record.highLatencyOver75Ms
      ).length,
      feedbackEstimates: feedbackEstimates.length,
    },
    issues,
    records,
    feedbackEstimates,
  };
}

/** Record the existing, caller-owned Playwright page; never launches a browser.
 * Mark start/end around the actual product interaction, then mark observation
 * end after >=1s. stop() flushes the trace and returns original evidence.
 */
export async function startChromiumPresentationCapture(
  page,
  { prefix = 'scroller-presentation' } = {}
) {
  const browser = page.context().browser();
  if (!browser) throw new Error('A Chromium Playwright browser is required.');
  const browserSession = await browser.newBrowserCDPSession();
  let pageSession;
  try {
    pageSession = await page.context().newCDPSession(page);
  } catch (error) {
    await browserSession.detach();
    throw error;
  }
  const events = [];
  const markers = {
    start: `${prefix}-start`,
    end: `${prefix}-end`,
    tail: `${prefix}-tail`,
  };
  const receipt = {
    selected: [...presentationTraceCategories],
    markers,
  };
  browserSession.on('Tracing.dataCollected', ({ value }) =>
    events.push(...value)
  );
  const completed = new Promise((resolve) =>
    browserSession.once('Tracing.tracingComplete', resolve)
  );
  try {
    receipt.version = await browserSession.send('Browser.getVersion');
    receipt.command = await browserSession.send(
      'Browser.getBrowserCommandLine'
    );
    receipt.target = await pageSession.send('Target.getTargetInfo');
    receipt.frame = await pageSession.send('Page.getFrameTree');
    await browserSession.send('Tracing.start', {
      transferMode: 'ReportEvents',
      traceConfig: {
        recordMode: 'recordUntilFull',
        includedCategories: receipt.selected,
        excludedCategories: ['*'],
      },
    });
  } catch (error) {
    await Promise.allSettled([pageSession.detach(), browserSession.detach()]);
    throw error;
  }
  const bounded = async (promise) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error('CDP capture finalization timed out after 5s.')),
            5000
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  let phase = 0;
  let stopped = false;
  const mark = async (expected, name) => {
    if (stopped || phase !== expected)
      throw new Error(
        'Presentation capture marks must run once in start/end/tail order.'
      );
    await page.evaluate((markName) => performance.mark(markName), name);
    phase++;
  };
  return {
    markActionStart: () => mark(0, markers.start),
    markActionEnd: () => mark(1, markers.end),
    markObservationEnd: () => mark(2, markers.tail),
    async stop() {
      if (stopped) throw new Error('Presentation capture was already stopped.');
      stopped = true;
      receipt.captureErrors = [];
      try {
        receipt.finalFrame = await bounded(
          pageSession.send('Page.getFrameTree')
        );
      } catch (error) {
        receipt.captureErrors.push(String(error));
      } finally {
        try {
          await bounded(browserSession.send('Tracing.end'));
          receipt.complete = await bounded(completed);
        } catch (error) {
          receipt.captureErrors.push(String(error));
        } finally {
          await bounded(
            Promise.allSettled([pageSession.detach(), browserSession.detach()])
          ).catch((error) => receipt.captureErrors.push(String(error)));
        }
      }
      const trace = { traceEvents: events };
      return {
        trace,
        receipt,
        assessment: assessChromiumPresentationEvidence(trace, receipt),
      };
    },
  };
}

// Import only: this CLI never connects to, opens or navigates a browser.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [tracePath, receiptPath, outputPath] = process.argv.slice(2);
  if (!tracePath || !receiptPath || !outputPath)
    throw new Error(
      'Usage: node scripts/scroll-stability-presentation-evidence.mjs TRACE.json RECEIPT.json OUTPUT.json'
    );
  const [trace, receipt] = await Promise.all(
    [tracePath, receiptPath].map(async (path) =>
      JSON.parse(await readFile(path, 'utf8'))
    )
  );
  const result = assessChromiumPresentationEvidence(trace, receipt);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({ verdict: result.verdict, pipelineVerdict: result.pipelineVerdict, presentationVerdict: result.presentationVerdict, counts: result.counts })}\n`
  );
}

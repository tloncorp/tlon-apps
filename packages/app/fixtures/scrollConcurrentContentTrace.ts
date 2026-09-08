import type {
  assessScrollReadingTrace,
  ScrollReadingContract,
  ScrollReadingTrace,
} from './scrollReadingTrace';
import type {
  ScrollContentTrace,
  ContentPresentation,
} from './scrollContentTrace';
import type { ScrollChromeTrace } from './scrollChromeTrace';

export type ConcurrentContentProof = {
  version: 1;
  position: 'latest' | 'history';
  chromeEligibility: {
    thresholdViewportRatio: 1;
    baselineBottomGap: number;
    baselineViewportHeight: number;
    visibility: 'hidden' | 'visible';
    mode: 'at-end' | 'hidden-near-bottom' | 'visible-away';
  };
  order: [string, string];
  preparation: {
    scope: string;
    origin: string;
    ship: string;
    e2eMode: boolean;
    warmupMs: number;
    browser: string;
    channel: string;
    headed: boolean;
    assets: string;
    assetProof?: unknown;
  };
  reading: { trace: ScrollReadingTrace; contract: ScrollReadingContract };
  media: Array<{
    id: string;
    src: string;
    width: number;
    height: number;
    sha256: string;
    bytes: number;
    png: string;
    releaseTime: number;
    readyTime: number;
    trace: ScrollContentTrace;
  }>;
  requests: Array<{
    id: string;
    url: string;
    method: string;
    requestedAt: number;
    requestedTime: number;
    releasedAt?: number;
    releasedTime?: number;
    fulfilledAt?: number;
    fulfilledTime?: number;
    status?: number;
    sha256?: string;
    bytes?: number;
  }>;
  before: {
    seal: { id: string };
    essay: unknown;
    read: { requestedTime?: number; completedTime?: number };
  };
  after: {
    seal: { id: string };
    essay: unknown;
    read: { requestedTime?: number; completedTime?: number };
  };
  chrome: ScrollChromeTrace & { errors: string[] };
  geometry: {
    errors: string[];
    frames: Array<{
      time: number;
      bottomGap: number;
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
      viewportTop: number;
      viewportBottom: number;
      anchors: Record<string, { top: number; bottom: number; height: number }>;
    }>;
  };
};

/** Independent sampled-DOM qualification; never a native/presentation verdict. */
export function assessConcurrentContentEvidence(
  proof: ConcurrentContentProof,
  assessReading: typeof assessScrollReadingTrace
) {
  const issues: Array<{
    code: string;
    kind: 'failure' | 'incomplete';
    stream?: string;
    sampleIndex?: number;
  }> = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete' = 'incomplete',
    stream?: string,
    sampleIndex?: number
  ) => issues.push({ code, kind, stream, sampleIndex });
  const result = () => {
    const verdict = issues.some((issue) => issue.kind === 'failure')
      ? 'FAIL'
      : issues.length
        ? 'INCOMPLETE'
        : 'PASS';
    return {
      verdict,
      issues,
      evidenceLevel: 'sampled-dom-overlapping-image-loads',
      headedBehavior:
        proof?.preparation?.headed === true ? verdict : 'INCOMPLETE',
      presentedFrames: 'INCOMPLETE',
      fullQualification: verdict === 'FAIL' ? 'FAIL' : 'INCOMPLETE',
    };
  };
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, canonical(child)])
          )
        : value;
  const equal = (a: unknown, b: unknown) =>
    JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const finite = Number.isFinite;
  const id = (value: unknown) =>
    typeof value === 'string' ? value.replace(/\./g, '') : '';
  try {
    const c = proof.reading.contract;
    const { startTime, endTime, maxGapMs, maxMeasurementDurationMs } =
      c.coverage;
    const scope = c.scope;
    const expected = [
      { id: 'portrait', width: 720, height: 1080 },
      { id: 'landscape', width: 1280, height: 640 },
    ];
    if (
      proof.version !== 1 ||
      !['latest', 'history'].includes(proof.position) ||
      !equal([...proof.order].sort(), ['landscape', 'portrait']) ||
      !equal(
        proof.media.map((m) => ({
          id: m.id,
          width: m.width,
          height: m.height,
        })),
        expected
      ) ||
      maxGapMs !== 100 ||
      maxMeasurementDurationMs !== 32 ||
      c.point.tolerancePx !== 1 ||
      endTime !== c.terminalTime + 1000 ||
      proof.preparation.scope !== scope ||
      proof.preparation.origin !== 'http://localhost:3000' ||
      proof.preparation.ship !== 'zod' ||
      proof.preparation.e2eMode !== false ||
      proof.preparation.warmupMs < 2000 ||
      typeof proof.preparation.headed !== 'boolean' ||
      proof.preparation.channel !== 'chromium' ||
      !proof.preparation.browser ||
      !['Vite development assets', 'Built production assets'].includes(
        proof.preparation.assets
      ) ||
      (proof.preparation.assets === 'Built production assets' &&
        !proof.preparation.assetProof)
    )
      add('invalid-concurrent-contract');
    if (
      ![startTime, endTime, c.terminalTime].every(finite) ||
      startTime >= c.terminalTime
    )
      add('invalid-concurrent-clock');
    if (
      !id(c.rowId) ||
      id(proof.before.seal.id) !== id(c.rowId) ||
      id(proof.after.seal.id) !== id(c.rowId) ||
      !equal(proof.before.essay, proof.after.essay)
    )
      add('changed-containing-post', 'failure');
    const story = (proof.before.essay as any)?.content;
    if (
      !Array.isArray(story) ||
      story.length !== 3 ||
      !equal(story[2], { inline: [c.revision.text] }) ||
      proof.media.some(
        (m, index) =>
          !equal(story[index]?.block?.image, {
            src: m.src,
            alt: `${m.id} coordinate grid ${m.width} by ${m.height}`,
            width: 0,
            height: 0,
          })
      )
    )
      add('missing-exact-backend-content');
    if (
      !finite(proof.before.read.completedTime) ||
      proof.before.read.completedTime! > startTime ||
      !finite(proof.after.read.requestedTime) ||
      proof.after.read.requestedTime! < endTime
    )
      add('missing-backend-read-chronology');
    const reading = assessReading(proof.reading.trace, c);
    for (const issue of reading.issues)
      add(issue.code, issue.kind, 'reading', issue.sampleIndex);
    function timing(
      samples: Array<{
        time: number;
        measurement?: { valid: boolean; durationMs: number };
      }>,
      stream: string,
      measured = true
    ) {
      if (!Array.isArray(samples) || samples.length < 6) {
        add('missing-stream', 'incomplete', stream);
        return false;
      }
      if (samples[0].time > startTime || samples.at(-1)!.time < endTime)
        add('truncated-stream', 'incomplete', stream);
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        if (
          !finite(sample.time) ||
          (index > 0 &&
            (sample.time <= samples[index - 1].time ||
              sample.time - samples[index - 1].time > 100))
        )
          add('invalid-stream-spacing', 'incomplete', stream, index);
        if (
          measured &&
          (!sample.measurement?.valid ||
            !finite(sample.measurement.durationMs) ||
            sample.measurement.durationMs < 0 ||
            sample.measurement.durationMs > 32)
        )
          add('invalid-stream-acquisition', 'incomplete', stream, index);
      }
      return true;
    }
    function presentation(p: ContentPresentation) {
      const box = (r: ContentPresentation['rect']) =>
        r &&
        [r.left, r.top, r.right, r.bottom, r.width, r.height].every(finite) &&
        r.width >= 0 &&
        r.height >= 0 &&
        Math.abs(r.right - r.left - r.width) < 0.01 &&
        Math.abs(r.bottom - r.top - r.height) < 0.01;
      return (
        p &&
        typeof p.connected === 'boolean' &&
        typeof p.displayed === 'boolean' &&
        finite(p.opacity) &&
        p.opacity >= 0 &&
        p.opacity <= 1 &&
        box(p.rect) &&
        box(p.clip) &&
        (!(p.clip.width > 0 && p.clip.height > 0) ||
          (p.clip.left >= p.rect.left - 0.01 &&
            p.clip.top >= p.rect.top - 0.01 &&
            p.clip.right <= p.rect.right + 0.01 &&
            p.clip.bottom <= p.rect.bottom + 0.01))
      );
    }
    const first = proof.media.find((m) => m.id === proof.order[0])!;
    const second = proof.media.find((m) => m.id === proof.order[1])!;
    if (
      !first ||
      !second ||
      first.releaseTime - startTime < 250 ||
      second.releaseTime - first.readyTime < 250 ||
      second.readyTime > c.terminalTime
    )
      add('missing-declared-overlap-order');
    if (
      proof.requests.length !== 2 ||
      new Set(proof.requests.map((r) => r.id)).size !== 2
    )
      add('missing-independent-requests');
    for (const media of proof.media) {
      const stream = media.id;
      const source = new URL(media.src, proof.preparation.origin).href;
      if (
        !new RegExp(`^/scroller-concurrent/[0-9a-f-]+/${media.id}\\.png$`).test(
          media.src
        ) ||
        !/^[0-9a-f]{64}$/.test(media.sha256) ||
        media.bytes < 1000 ||
        typeof media.png !== 'string'
      )
        add('invalid-media-identity', 'incomplete', stream);
      const request = proof.requests.find((r) => r.id === media.id);
      if (
        !request ||
        request.url !== source ||
        request.method !== 'GET' ||
        request.status !== 200 ||
        request.sha256 !== media.sha256 ||
        request.bytes !== media.bytes ||
        ![
          request.requestedAt,
          request.releasedAt,
          request.fulfilledAt,
          request.requestedTime,
          request.releasedTime,
          request.fulfilledTime,
          media.releaseTime,
          media.readyTime,
        ].every(finite) ||
        request.requestedTime > startTime ||
        request.releasedTime! < media.releaseTime ||
        request.fulfilledTime! < request.releasedTime! ||
        request.requestedAt > request.releasedAt! ||
        request.releasedAt! > request.fulfilledAt! ||
        request.fulfilledTime! > media.readyTime
      )
        add('invalid-asset-transport', 'incomplete', stream);
      const trace = media.trace;
      if (!Array.isArray(trace.errors) || trace.errors.length)
        add('image-capture-error', 'incomplete', stream);
      if (!timing(trace.samples, stream)) continue;
      const load = trace.events.filter((e) => e.id === 'image-load');
      const decoded = trace.events.filter((e) => e.id === 'image-decoded');
      if (trace.events.some((e) => e.id === 'image-error'))
        add('image-load-error', 'failure', stream);
      if (
        load.length !== 1 ||
        decoded.length !== 1 ||
        trace.events.length !== 2 ||
        trace.events.some(
          (e) =>
            !e.originalTarget ||
            !e.trusted ||
            e.scope !== scope ||
            e.src !== source ||
            e.currentSrc !== source ||
            !finite(e.time)
        ) ||
        load[0]?.time < media.releaseTime ||
        decoded[0]?.time < load[0]?.time ||
        decoded[0]?.time > media.readyTime
      )
        add('missing-trusted-image-lifecycle', 'incomplete', stream);
      let sawReady = false;
      const baselineInventory = trace.samples[0].images
        .map((i) => i.src)
        .sort();
      if (
        proof.media.some(
          (other) =>
            baselineInventory.filter(
              (src) => src === new URL(other.src, proof.preparation.origin).href
            ).length !== 1
        )
      )
        add('missing-complete-media-inventory', 'incomplete', stream);
      let pending = 0,
        ready = 0;
      for (let index = 0; index < trace.samples.length; index++) {
        const sample = trace.samples[index];
        if (
          sample.scope !== scope ||
          id(sample.rowId) !== id(c.rowId) ||
          !sample.sameRow
        )
          add('image-row-replaced', 'failure', stream, index);
        if (
          !presentation(sample.list) ||
          !presentation(sample.row) ||
          !presentation(sample.imageFrame)
        ) {
          add('invalid-image-presentation', 'incomplete', stream, index);
          continue;
        }
        if (
          !sample.list.connected ||
          !sample.list.displayed ||
          sample.list.opacity < 0.99 ||
          sample.fallbackPresent
        )
          add('hidden-list-or-image-fallback', 'failure', stream, index);
        if (!equal(sample.images.map((i) => i.src).sort(), baselineInventory))
          add('image-inventory-changed', 'failure', stream, index);
        const images = sample.images.filter((i) => i.src === source);
        if (images.length !== 1) {
          add('missing-or-duplicate-image', 'failure', stream, index);
          continue;
        }
        const image = images[0];
        if (
          !presentation(image.presentation) ||
          typeof image.complete !== 'boolean' ||
          !finite(image.naturalWidth) ||
          !finite(image.naturalHeight) ||
          typeof image.frontmost !== 'boolean'
        ) {
          add('invalid-image-sample', 'incomplete', stream, index);
          continue;
        }
        if (
          !image.sameElement ||
          (image.currentSrc !== '' && image.currentSrc !== source)
        )
          add('stale-or-replaced-image', 'failure', stream, index);
        const isReady =
          image.complete &&
          image.naturalWidth === media.width &&
          image.naturalHeight === media.height &&
          image.currentSrc === source;
        if (image.complete && !isReady)
          add('incorrect-complete-image', 'failure', stream, index);
        if (sample.time < media.releaseTime) {
          pending++;
          if (
            image.complete ||
            image.naturalWidth !== 0 ||
            image.naturalHeight !== 0
          )
            add('image-ready-before-release', 'failure', stream, index);
        }
        if (sawReady && !isReady)
          add('image-ready-reverted', 'failure', stream, index);
        sawReady ||= isReady;
        if (sample.time >= media.readyTime) {
          ready++;
          if (!isReady) add('wrong-decoded-image', 'failure', stream, index);
        }
        const p = image.presentation;
        if (!p.connected || !sample.imageFrame.connected)
          add('detached-image', 'failure', stream, index);
        if (
          isReady &&
          p.clip.width > 0 &&
          p.clip.height > 0 &&
          (!p.displayed || p.opacity < 0.99 || !image.frontmost)
        )
          add('hidden-or-covered-image', 'failure', stream, index);
      }
      if (pending < 3 || ready < 6)
        add('missing-image-phase', 'incomplete', stream);
      if (media.id === 'landscape') {
        const before = trace.samples.find((s) => s.time >= startTime)!;
        const after = trace.samples.find((s) => s.time >= media.readyTime)!;
        if (
          !before ||
          !after ||
          Math.abs(
            before.imageFrame.rect.height - after.imageFrame.rect.height
          ) <= 16
        )
          add('missing-real-landscape-resize', 'incomplete', stream);
      }
    }
    const eligibility = proof.chromeEligibility;
    const baseline = proof.geometry.frames[0];
    const expectedVisibility =
      baseline.bottomGap / baseline.clientHeight > 1 ? 'visible' : 'hidden';
    const expectedMode =
      proof.position === 'latest'
        ? 'at-end'
        : expectedVisibility === 'hidden'
          ? 'hidden-near-bottom'
          : 'visible-away';
    if (
      eligibility.thresholdViewportRatio !== 1 ||
      eligibility.visibility !== expectedVisibility ||
      eligibility.mode !== expectedMode ||
      Math.abs(eligibility.baselineBottomGap - baseline.bottomGap) > 1 ||
      Math.abs(eligibility.baselineViewportHeight - baseline.clientHeight) > 1
    )
      add('invalid-chrome-eligibility');
    if (
      proof.geometry.frames.some(
        (frame) =>
          (frame.bottomGap / frame.clientHeight > 1 ? 'visible' : 'hidden') !==
          expectedVisibility
      )
    )
      add('chrome-eligibility-changed');
    if (proof.chrome.errors.length || proof.chrome.actions.length)
      add('unexpected-chrome-action-or-error', 'incomplete', 'chrome');
    if (timing(proof.chrome.samples, 'chrome'))
      for (const [index, s] of proof.chrome.samples.entries()) {
        if (
          s.scope !== scope ||
          s.loading ||
          s.semanticState !== 'list-visible' ||
          s.controls.length !== 1
        )
          add('wrong-latest-control', 'failure', 'chrome', index);
        const control = s.controls[0];
        const visible = proof.chromeEligibility.visibility === 'visible';
        if (
          !control ||
          control.id !== 'latest' ||
          control.scope !== scope ||
          control.kind !== 'icon' ||
          control.visible !== visible ||
          !finite(control.opacity) ||
          Math.abs(control.opacity - (visible ? 1 : 0)) > 0.01
        )
          add('latest-control-flicker', 'failure', 'chrome', index);
      }
    // Streams share performance.now, but are separate DOM acquisitions. Require
    // an agreeing nearby row/viewport witness, without pretending one presented
    // frame or choosing an end state to excuse a transient reading violation.
    for (const [stream, samples] of [
      ...proof.media.map((media) => [media.id, media.trace.samples] as const),
      ['reading', proof.reading.trace.samples] as const,
    ])
      for (const [index, sample] of samples.entries()) {
        const agrees = proof.geometry.frames.some((frame) => {
          const row = frame.anchors[c.rowId];
          return (
            Math.abs(frame.time - sample.time) <= 100 &&
            row &&
            Math.abs(frame.viewportTop - sample.list.rect.top) <= 1 &&
            Math.abs(frame.clientHeight - sample.list.rect.height) <= 1 &&
            Math.abs(row.height - sample.row.rect.height) <= 1 &&
            Math.abs(row.top + frame.viewportTop - sample.row.rect.top) <= 1
          );
        });
        if (!agrees) add('unlinked-row-geometry', 'incomplete', stream, index);
      }
    if (proof.geometry.errors.length)
      add('geometry-capture-error', 'incomplete', 'geometry');
    if (timing(proof.geometry.frames, 'geometry', false))
      for (const [index, f] of proof.geometry.frames.entries()) {
        const row = f.anchors[c.rowId];
        if (
          ![
            f.scrollTop,
            f.scrollHeight,
            f.clientHeight,
            f.viewportTop,
            f.viewportBottom,
            f.bottomGap,
          ].every(finite) ||
          f.clientHeight <= 0 ||
          Math.abs(f.viewportBottom - f.viewportTop - f.clientHeight) > 1 ||
          Math.abs(
            f.scrollHeight - f.clientHeight - f.scrollTop - f.bottomGap
          ) > 1 ||
          !row ||
          ![row.top, row.bottom, row.height].every(finite) ||
          Math.abs(row.bottom - row.top - row.height) > 1
        )
          add('invalid-list-geometry', 'incomplete', 'geometry', index);
        if (proof.position === 'latest' && Math.abs(f.bottomGap) > 1)
          add('latest-bottom-moved', 'failure', 'geometry', index);
      }
    if (
      proof.position === 'history' &&
      proof.geometry.frames[0]?.bottomGap <= 300
    )
      add('missing-read-precondition');
  } catch {
    add('malformed-concurrent-proof');
  }
  return result();
}

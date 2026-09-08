import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { assessNativeRecording } from '../packages/app/fixtures/scrollNativeRecording.ts';
import { chooseReadingAnchor } from '../packages/app/fixtures/scrollStabilityTrace.ts';
import {
  adaptBufferedNativeScrollGeometry,
  adaptNativeScrollGeometry,
  adaptNativeEntryRuler,
} from '../packages/app/fixtures/scrollNativeGeometry.ts';

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
  const duration =
    trace.scenario.startsWith('entry-') ||
    trace.scenario === 'command-center' ||
    trace.scenario === 'command-offscreen'
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

/** Fixed stationary FOLLOW policy; native model geometry, not action or paint proof. */
export function replayNativeBottomContinuity(trace) {
  const issues = [];
  const add = (code, frame, kind = 'incomplete') =>
    issues.push({ code, kind, ...(frame === undefined ? {} : { frame }) });
  let observedFrames = 0;
  let maxEndDistancePt = 0;
  const result = (verdict) => ({
    version: 1,
    verdict:
      verdict ??
      (issues.some((i) => i.kind === 'failure')
        ? 'FAIL'
        : issues.length
          ? 'INCOMPLETE'
          : 'PASS'),
    issues,
    evidenceLevel: 'native-buffered-bottom-continuity-v1',
    productActions: 'UNASSESSED',
    nativePresentation: 'INCOMPLETE',
    metrics: { observedFrames, maxEndDistancePt },
  });
  const stationary =
    /^(?:(?:append|burst)-end|stateful-image-load-end|thinking-empty-show-hide|thinking-(?:show-hide|label|handoff-(?:message-first|same-frame|hide-first))-end)$/;
  if (!stationary.test(trace?.scenario ?? '')) return result('UNASSESSED');
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const text = (v) => typeof v === 'string' && v.length > 0;
  const same = isDeepStrictEqual;
  try {
    const contract = trace.nativeRecordingContract;
    const empty = trace.scenario === 'thinking-empty-show-hide';
    if (
      trace.assertion !== 'bottom' ||
      !trace.expectations ||
      (empty
        ? trace.emptyEndThroughout !== true
        : !trace.expectations.bottom) ||
      (trace.expectations.bottom?.tolerancePt ?? 1) !== 1 ||
      contract?.visibility !== 'require-visible' ||
      contract.itinerary
    ) {
      add('native-bottom-policy-mismatch');
      return result();
    }
    const replay = replayNativeRecording(trace);
    const recording = trace.nativeRecording;
    // The public acquisition reader binds the exact scenario and lifetime.
    // Derive samples independently from raw native geometry, never producer aggregates.
    const acquisition = assessNativeRecording(
      recording,
      contract,
      adaptBufferedNativeScrollGeometry
    );
    const frameIssue = (issue) =>
      Number.isInteger(issue.frame) &&
      issue.frame >= 0 &&
      issue.frame < recording.frames.length;
    const limit = Math.min(
      recording.frames.length,
      ...acquisition.issues.filter(frameIssue).map((issue) => issue.frame)
    );
    if (replay.verdict !== 'COMPLETE') {
      for (const issue of replay.issues)
        add(`acquisition:${issue.code}`, issue.frame);
      const coverageOnly = new Set([
        'native-recording-coverage-gap',
        'missing-native-recording-tail',
        'invalid-native-recording-lifetime',
      ]);
      if (
        !replay.issues.length ||
        replay.issues.some((i) => !coverageOnly.has(i.code) && !frameIssue(i))
      )
        return result();
      // Only an already qualified prefix can retain a directly observed failure.
      // Missing later observations cannot create a deadline or landing failure.
      if (
        !finite(recording?.startedAt) ||
        !finite(recording?.stoppedAt) ||
        recording.startedAt < 0 ||
        recording.stoppedAt < recording.startedAt ||
        recording.stoppedAt - recording.startedAt >
          contract.request.durationMs + 125 ||
        !['requested', 'deadline'].includes(recording.stopReason) ||
        !recording.frames
          .slice(0, limit)
          .every(
            (f, i, frames) =>
              finite(f.geometry?.startedAt) &&
              finite(f.geometry?.finishedAt) &&
              f.geometry.startedAt >= recording.startedAt &&
              f.geometry.finishedAt <= recording.stoppedAt &&
              (!i || f.geometry.startedAt >= frames[i - 1].geometry.finishedAt)
          )
      )
        return result();
    }
    if (
      acquisition.samples.length < limit ||
      acquisition.semanticSamples.length < limit ||
      (replay.verdict === 'COMPLETE' &&
        (acquisition.samples.length !== recording.frames.length ||
          acquisition.semanticSamples.length !== recording.frames.length))
    ) {
      add('native-bottom-frame-cardinality');
      return result();
    }
    const actions = recording.markers.filter(
      (marker) => marker.name === 'action-start'
    );
    if (
      actions.length !== 1 ||
      recording.markers.length !== 1 ||
      recording.frames[0].geometry.finishedAt > actions[0].time
    ) {
      add('native-bottom-action-marker');
      return result();
    }
    let owner, scope, surfaces;
    for (let i = 0; i < limit; i++) {
      const g = recording.frames[i].geometry;
      const sample = acquisition.samples[i];
      if (sample.time !== g.finishedAt) {
        add('native-bottom-frame-correspondence', i);
        break;
      }
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
      const membership = g.nativeReading?.committedMembership;
      const currentScope = [
        membership?.scopeIdentity,
        membership?.scope,
        membership?.visit,
      ];
      if (
        !identity.every(text) ||
        !currentScope.every(text) ||
        membership.version !== 1 ||
        membership.status !== 'ok' ||
        membership.scope !== /^(.*)::(?:0|[1-9]\d*)$/.exec(contract.scope)?.[1]
      ) {
        add('native-bottom-owner-unavailable', i);
        break;
      }
      owner ??= identity;
      scope ??= currentScope;
      if (!same(identity, owner) || !same(currentScope, scope)) {
        add('native-bottom-owner-replaced', i);
        break;
      }
      const scroll = g.scroll;
      if (scroll.tracking || scroll.dragging || scroll.decelerating) {
        add('native-bottom-gesture', i);
        break;
      }
      // These scenarios declare a stationary viewport. Keyboard, resize and
      // composer motion need their own input/geometry contract.
      const currentSurfaces = [
        g.root.frame,
        scroll.view.frame,
        scroll.view.clipFrame,
        g.composer.frame,
        g.composer.clipFrame,
        scroll.bounds.width,
        scroll.bounds.height,
        scroll.contentInset,
        scroll.adjustedContentInset,
      ];
      surfaces ??= currentSurfaces;
      if (!same(surfaces, currentSurfaces)) {
        add('native-bottom-viewport-changed', i);
        break;
      }
      const distance = Math.abs(sample.scrollBounds.max - sample.scroll);
      if (!i && distance > 1) {
        add('native-bottom-baseline-not-at-end', i);
        break;
      }
      observedFrames++;
      maxEndDistancePt = Math.max(maxEndDistancePt, distance);
      if (distance > 1) add('native-bottom-gap', i, 'failure');
    }
    if (!observedFrames && !issues.length)
      add('native-bottom-no-qualified-frames');
    return result();
  } catch {
    add('native-bottom-malformed-evidence');
    return result();
  }
}

/** Two fixed post-gesture tails. No whole-gesture residual or presentation claim. */
export function replayNativePostGestureTail(trace) {
  const selected = /^armed-post-gesture-thinking-(end|away)$/.exec(
    trace?.scenario ?? ''
  );
  const issues = [];
  const add = (code, frame, kind = 'incomplete') =>
    issues.push({ code, kind, ...(frame === undefined ? {} : { frame }) });
  let qualifiedFrames = 0,
    maxErrorPt = 0;
  const finish = (verdict) => ({
    version: 1,
    verdict:
      verdict ??
      (issues.some((i) => i.kind === 'failure')
        ? 'FAIL'
        : issues.length
          ? 'INCOMPLETE'
          : 'PASS'),
    issues,
    evidenceLevel: 'native-buffered-post-gesture-tail-v1',
    nativePresentation: 'INCOMPLETE',
    gestureCoverage:
      'actual drag and observed stationary completion, not finger trajectory',
    thinkingCoverage: 'forced-label layout only',
    metrics: { qualifiedFrames, maxErrorPt },
  });
  if (!selected) return finish('UNASSESSED');
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const text = (v) => typeof v === 'string' && v.length > 0;
  const same = isDeepStrictEqual;
  try {
    const probe = trace.nativePostGestureProbe,
      c = probe?.contract,
      contract = trace.nativeRecordingContract;
    const recording = trace.nativeRecording,
      transfers = probe?.markerTransfers,
      events = trace.events;
    if (
      trace.fixtureVersion !== 2 ||
      trace.platform !== 'ios' ||
      trace.productCoverage !== 'local-component-fixture' ||
      trace.assertion !== 'observe' ||
      trace.expectations !== null ||
      trace.result !== null ||
      !c ||
      c.version !== 1 ||
      c.outcome !== selected[1] ||
      c.recordingId !== contract?.recordingId ||
      c.scope !== contract.scope ||
      c.probeId !== `${c.recordingId}:post-gesture` ||
      c.quietTailMs !== 1000 ||
      c.tolerancePt !== 1 ||
      !finite(c.declaredAt) ||
      !finite(probe.armedAt) ||
      !Array.isArray(events) ||
      !Array.isArray(transfers) ||
      transfers.length !== 2 ||
      events.some(
        (e, i) =>
          !finite(e.time) || !text(e.name) || (i && e.time < events[i - 1].time)
      )
    ) {
      add('native-post-gesture-contract');
      return finish();
    }
    const plans = events.filter((e) => e.name === 'native-post-gesture-plan');
    const arms = events.filter((e) => e.name === 'native-post-gesture-armed');
    const starts = events.filter((e) => e.name === 'scenario-start');
    if (
      plans.length !== 1 ||
      plans[0].time !== c.declaredAt ||
      plans[0].values?.contract !== JSON.stringify(c) ||
      arms.length !== 1 ||
      arms[0].time !== probe.armedAt ||
      arms[0].values?.probeId !== c.probeId ||
      starts.length !== 1 ||
      starts[0].values?.scenario !== trace.scenario ||
      starts[0].values?.assertion !== 'observe' ||
      !finite(trace.nativeRecordingTransfer?.startAcknowledgedAt) ||
      c.declaredAt > trace.nativeRecordingTransfer.startAcknowledgedAt ||
      trace.nativeRecordingTransfer.startAcknowledgedAt > starts[0].time ||
      starts[0].time > probe.armedAt
    ) {
      add('native-post-gesture-declaration');
      return finish();
    }
    const interaction = events.filter(
      (e) =>
        e.time >= probe.armedAt && /^(drag|momentum)-(begin|end)$/.test(e.name)
    );
    const expectedNames = interaction.some((e) => e.name === 'momentum-begin')
      ? ['drag-begin', 'drag-end', 'momentum-begin', 'momentum-end']
      : ['drag-begin', 'drag-end'];
    if (
      !same(
        interaction.map((e) => e.name),
        expectedNames
      ) ||
      !same(probe.completion, interaction.at(-1))
    ) {
      add('native-post-gesture-completion');
      return finish();
    }
    const baseline = probe.baseline,
      native = baseline?.acquisition?.nativeGeometry;
    if (
      native?.source !== 'ios-main-thread-model-v1' ||
      !native.bracket ||
      native.bracket.requestedAt < probe.completion.time ||
      baseline.measurement?.valid !== true ||
      !finite(baseline.measurement.durationMs) ||
      baseline.measurement.durationMs > 32 ||
      baseline.acquisition?.jsCoherence?.coherent !== true ||
      native.issues.length
    ) {
      add('native-post-gesture-baseline-bracket');
      return finish();
    }
    const decoded = adaptNativeScrollGeometry(
      native.capture,
      native.request,
      native.bracket
    );
    const base = native.capture;
    if (
      decoded.issues.length ||
      !same(decoded.snapshot.rows, baseline.rows) ||
      decoded.snapshot.scroll !== baseline.scroll ||
      decoded.snapshot.scrollBounds?.min !== baseline.scrollBounds?.min ||
      decoded.snapshot.scrollBounds?.max !== baseline.scrollBounds?.max ||
      !same(native.request, {
        requestId: base.requestId,
        rootId: contract.request.rootId,
        scrollViewId: contract.request.scrollViewId,
        composerId: contract.request.composerId,
        rows: native.request.rows,
      }) ||
      base.scroll.tracking ||
      base.scroll.dragging ||
      base.scroll.decelerating
    ) {
      add('native-post-gesture-baseline-unqualified');
      return finish();
    }
    for (let i = 0; i < 2; i++) {
      const transfer = transfers[i];
      if (
        transfer.name !== `${c.probeId}:${i ? 'hidden' : 'start'}` ||
        transfer.clock !== 'performance.now milliseconds' ||
        !finite(transfer.requestedAt) ||
        !finite(transfer.receivedAt) ||
        transfer.receivedAt < transfer.requestedAt ||
        transfer.requestedAt <
          (i ? transfers[0].receivedAt : native.bracket.receivedAt)
      ) {
        add('native-post-gesture-marker-transfer');
        return finish();
      }
    }
    const markerNames = [
      'action-start',
      `${c.probeId}:start`,
      `${c.probeId}:hidden`,
    ];
    if (
      !Array.isArray(recording?.markers) ||
      !same(
        recording.markers.map((m) => m.name),
        markerNames
      )
    ) {
      add('native-post-gesture-markers');
      return finish();
    }
    const [actionMarker, showMarker, hideMarker] = recording.markers;
    if (
      !(
        recording.frames[0].geometry.finishedAt <= actionMarker.time &&
        actionMarker.time < base.startedAt &&
        base.finishedAt <= showMarker.time &&
        showMarker.time < hideMarker.time
      )
    ) {
      add('native-post-gesture-native-order');
      return finish();
    }
    const requests = events.filter((e) => e.name === 'thinking-request');
    if (
      requests.length !== 2 ||
      requests[0].values?.visible !== true ||
      requests[0].values?.label !== 'Thinking...' ||
      requests[1].values?.visible !== false ||
      requests.some((e) => e.values?.layoutChange !== true) ||
      requests[0].time < transfers[0].receivedAt ||
      requests[1].time < requests[0].time ||
      requests[1].time > transfers[1].requestedAt
    ) {
      add('native-post-gesture-thinking-order');
      return finish();
    }
    for (let i = 0; i < 2; i++) {
      const request = requests[i],
        end = i ? transfers[1].requestedAt : requests[1].time;
      if (
        !events.some(
          (e) =>
            e.name === 'thinking-commit' &&
            e.time >= request.time &&
            e.time <= end &&
            e.values?.visible === request.values.visible &&
            (i || e.values?.label === 'Thinking...')
        ) ||
        !events.some(
          (e) =>
            e.name === 'thinking-layout' &&
            e.time >= request.time &&
            e.time <= end &&
            e.values?.height === (i ? 0 : 52)
        )
      ) {
        add('native-post-gesture-thinking-layout');
        return finish();
      }
    }
    if (
      events.some(
        (e) =>
          e.time >= probe.completion.time &&
          /^(reset|position|local-send|media-open|reference-open|keyboard|composer-input|center-command-request|offscreen-command-request)/.test(
            e.name
          )
      )
    ) {
      add('native-post-gesture-new-intent');
      return finish();
    }
    const replay = replayNativeRecording(trace);
    let limit = recording.frames.length;
    if (replay.verdict !== 'COMPLETE') {
      replay.issues.forEach((i) => add(i.code, i.frame));
      // Only ordinary coverage failures permit retaining independently observed
      // earlier geometry; ownership/data/clock corruption cannot qualify a prefix.
      const coverage = new Set([
        'native-recording-coverage-gap',
        'missing-native-recording-tail',
        'invalid-native-recording-lifetime',
      ]);
      const framed = (i) =>
        Number.isInteger(i.frame) &&
        i.frame >= 0 &&
        i.frame < recording.frames.length;
      if (
        !replay.issues.length ||
        replay.issues.some((i) => !coverage.has(i.code) && !framed(i)) ||
        !finite(recording.startedAt) ||
        !finite(recording.stoppedAt) ||
        recording.startedAt < 0 ||
        recording.stoppedAt < recording.startedAt ||
        recording.stoppedAt - recording.startedAt >
          contract.request.durationMs + 125 ||
        !['requested', 'deadline'].includes(recording.stopReason)
      )
        return finish();
      for (const issue of replay.issues)
        if (Number.isInteger(issue.frame)) limit = Math.min(limit, issue.frame);
    }
    const acquired = assessNativeRecording(
      recording,
      contract,
      adaptBufferedNativeScrollGeometry
    );
    if (acquired.samples.length < limit) {
      add('native-post-gesture-frame-cardinality');
      return finish();
    }
    if (recording.stoppedAt - hideMarker.time < 1000)
      add('native-post-gesture-short-tail');
    const owner = (g) => [
      g.root.identity,
      g.root.lifetimeIdentity,
      g.root.windowIdentity,
      g.scroll.view.identity,
      g.scroll.view.lifetimeIdentity,
      g.scroll.view.windowIdentity,
      g.scroll.hostIdentity,
      g.composer.identity,
      g.composer.lifetimeIdentity,
    ];
    const surfaces = (g) => [
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
    const authority = (g) => {
      const ruled = adaptNativeEntryRuler(
        g,
        c.scope,
        'indexed-cell-and-surfaces-v2'
      );
      if (ruled.issues.length) throw Error('ruler');
      const m = g.nativeReading?.committedMembership,
        b = g.nativeReading?.rowBindings;
      if (
        m?.version !== 1 ||
        m.status !== 'ok' ||
        ![m.scopeIdentity, m.scope, m.visit, m.dataRevision].every(text) ||
        !Array.isArray(m.rows) ||
        m.rows.some((r) => !text(r.key) || !text(r.revision)) ||
        new Set(m.rows.map((r) => r.key)).size !== m.rows.length ||
        b?.version !== 1 ||
        b.status !== 'ok' ||
        !same(
          [b.scopeIdentity, b.scope, b.visit, b.dataRevision],
          [m.scopeIdentity, m.scope, m.visit, m.dataRevision]
        ) ||
        !Array.isArray(b.rows) ||
        b.rows.length !== g.rows.length ||
        new Set(b.rows.map((r) => r.rowId)).size !== b.rows.length
      )
        throw Error('membership');
      const views = [
        g.root,
        g.scroll.view,
        g.composer,
        ...g.rows.map((r) => r.view),
        ...g.ruler.cells.map((r) => r.view),
      ];
      if (
        views.some((v) => !text(v?.identity) || !text(v?.lifetimeIdentity)) ||
        new Set(views.map((v) => v.identity)).size !== views.length ||
        new Set(views.map((v) => v.lifetimeIdentity)).size !== views.length
      )
        throw Error('lifetime');
      const registrations = new Set(),
        hosts = new Set();
      for (const row of g.rows) {
        const key = row.id.slice('scroll-row-'.length),
          binding = b.rows.find((r) => r.rowId === row.id),
          cell = ruled.cells.get(key);
        if (
          binding?.status !== 'ok' ||
          binding.key !== key ||
          binding.fixtureScope !== c.scope ||
          binding.cellId !== `scroll-cell-${key}` ||
          binding.revision !== m.rows.find((r) => r.key === key)?.revision ||
          binding.rowViewIdentity !== row.view.lifetimeIdentity ||
          binding.cellViewIdentity !== cell?.lifetimeIdentity ||
          !text(binding.registrationIdentity) ||
          !text(binding.hostIdentity) ||
          registrations.has(binding.registrationIdentity) ||
          hosts.has(binding.hostIdentity)
        )
          throw Error('binding');
        registrations.add(binding.registrationIdentity);
        hosts.add(binding.hostIdentity);
      }
      return { ruled, m, b, views };
    };
    let baselineAuthority;
    try {
      baselineAuthority = authority(base);
    } catch {
      add('native-post-gesture-baseline-authority');
      return finish();
    }
    if (
      !owner(base).every(text) ||
      !Number.isSafeInteger(base.nativeReading?.generation)
    ) {
      add('native-post-gesture-native-owner');
      return finish();
    }
    const baseDistance =
      decoded.snapshot.scrollBounds.max - decoded.snapshot.scroll;
    if (
      selected[1] === 'end' ? Math.abs(baseDistance) > 1 : baseDistance <= 1
    ) {
      add('native-post-gesture-wrong-endpoint');
      return finish();
    }
    const anchorKey = probe.anchorKey;
    const anchor = (g) => {
      const row = g.rows.find((r) => r.id === `scroll-row-${anchorKey}`)?.view;
      const cell = g.ruler.cells.find(
        (r) => r.id === `scroll-cell-${anchorKey}`
      )?.view;
      const binding = g.nativeReading.rowBindings.rows.find(
        (r) => r.key === anchorKey
      );
      if (!row || !cell || !binding) throw Error('anchor');
      const meta = JSON.parse(row.semanticValue);
      if (
        typeof meta.signature?.content !== 'string' ||
        typeof meta.signature?.reactions !== 'string' ||
        !(
          typeof meta.signature?.replies === 'string' ||
          finite(meta.signature?.replies)
        )
      )
        throw Error('signature');
      return {
        row,
        shape: [
          meta.signature,
          row.frame.width,
          row.frame.height,
          cell.frame.width,
          cell.frame.height,
          binding,
        ],
      };
    };
    let baselineAnchor;
    if (selected[1] === 'away') {
      try {
        baselineAnchor = anchor(base);
      } catch {
        add('native-post-gesture-baseline-anchor');
        return finish();
      }
      if (chooseReadingAnchor(decoded.snapshot)?.key !== anchorKey) {
        add('native-post-gesture-baseline-anchor-not-central');
        return finish();
      }
    } else if (anchorKey !== undefined) {
      add('native-post-gesture-unexpected-anchor');
      return finish();
    }
    const lifetimePointers = new Map(
      baselineAuthority.views.map((v) => [v.lifetimeIdentity, v.identity])
    );
    const moving = recording.frames
      .slice(0, limit)
      .map((f) => f.geometry)
      .filter(
        (g) =>
          g.startedAt >= actionMarker.time &&
          g.finishedAt < base.startedAt &&
          g.scroll.dragging
      );
    if (
      moving.length < 2 ||
      !moving.some(
        (g) => Math.abs(g.scroll.offset.y - moving[0].scroll.offset.y) > 1
      )
    ) {
      add('native-post-gesture-native-drag-not-witnessed');
      return finish();
    }
    let shown = false,
      hidden = false;
    for (let i = 0; i < limit; i++) {
      const g = recording.frames[i].geometry,
        sample = acquired.samples[i];
      if (sample.time !== g.finishedAt || !same(owner(g), owner(base))) {
        add('native-post-gesture-owner-replaced', i);
        break;
      }
      if (i === 0 && Math.abs(sample.scrollBounds.max - sample.scroll) > 1) {
        add('native-post-gesture-initial-not-end', i);
        break;
      }
      if (g.finishedAt <= base.startedAt) {
        continue;
      }
      if (g.startedAt < base.finishedAt) {
        add('native-post-gesture-overlapping-baseline', i);
        break;
      }
      let a;
      try {
        a = authority(g);
      } catch {
        add('native-post-gesture-authority-unavailable', i);
        break;
      }
      if (
        !same(a.m, baselineAuthority.m) ||
        !same(surfaces(g), surfaces(base)) ||
        g.nativeReading.generation !== base.nativeReading.generation ||
        g.scroll.tracking ||
        g.scroll.dragging ||
        g.scroll.decelerating
      ) {
        add('native-post-gesture-tail-owner-or-motion', i);
        break;
      }
      let corrupt = false;
      for (const v of a.views) {
        if (
          lifetimePointers.has(v.lifetimeIdentity) &&
          lifetimePointers.get(v.lifetimeIdentity) !== v.identity
        )
          corrupt = true;
        else lifetimePointers.set(v.lifetimeIdentity, v.identity);
      }
      if (corrupt) {
        add('native-post-gesture-lifetime-reused', i);
        break;
      }
      const extent =
        g.scroll.contentSize.height - base.scroll.contentSize.height;
      if (Math.abs(extent) > 1 && Math.abs(extent - 52) > 1) {
        add('native-post-gesture-unexplained-extent', i);
        break;
      }
      if (
        g.finishedAt >= showMarker.time &&
        g.finishedAt <= hideMarker.time &&
        Math.abs(extent - 52) <= 1
      )
        shown = true;
      if (g.startedAt >= hideMarker.time && Math.abs(extent) <= 1)
        hidden = true;
      if (g.startedAt >= hideMarker.time && Math.abs(extent) > 1) {
        add('native-post-gesture-footer-not-hidden', i);
        break;
      }
      let error;
      if (selected[1] === 'end')
        error = Math.abs(sample.scrollBounds.max - sample.scroll);
      else {
        let current;
        try {
          current = anchor(g);
        } catch {
          add('native-post-gesture-anchor-unavailable', i);
          break;
        }
        if (!same(current.shape, baselineAnchor.shape)) {
          add('native-post-gesture-anchor-replaced', i);
          break;
        }
        if (
          current.row.hidden ||
          current.row.effectiveAlpha <= 0 ||
          current.row.clipFrame.width <= 0 ||
          current.row.clipFrame.height <= 0 ||
          a.ruled.surfaces.some(
            (v) =>
              v.clipFrame.x <
                current.row.clipFrame.x + current.row.clipFrame.width &&
              v.clipFrame.x + v.clipFrame.width > current.row.clipFrame.x &&
              v.clipFrame.y <
                current.row.clipFrame.y + current.row.clipFrame.height &&
              v.clipFrame.y + v.clipFrame.height > current.row.clipFrame.y
          ) ||
          current.row.clipFrame.y >= a.ruled.viewportBottom ||
          current.row.clipFrame.y + current.row.clipFrame.height <=
            a.ruled.viewportTop
        ) {
          add('native-post-gesture-anchor-not-exposed', i);
          break;
        }
        error = Math.abs(current.row.frame.y - baselineAnchor.row.frame.y);
      }
      qualifiedFrames++;
      maxErrorPt = Math.max(maxErrorPt, error);
      if (error > 1)
        add(
          selected[1] === 'end'
            ? 'native-post-gesture-end-gap'
            : 'native-post-gesture-anchor-drift',
          i,
          'failure'
        );
    }
    if (!shown || !hidden) add('native-post-gesture-show-hide-not-witnessed');
    if (!qualifiedFrames) add('native-post-gesture-no-qualified-tail');
    return finish();
  } catch {
    add('native-post-gesture-malformed');
    return finish();
  }
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

import { assessProductionAssets } from './scroll-stability-web-assets.mjs';
import { readAttemptClock } from '../apps/tlon-web/e2e/helpers/scrollerAttemptClockReporter.cjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assessScrollChromeTrace } from '../packages/app/fixtures/scrollChromeTrace.ts';
import { assessScrollContentTrace } from '../packages/app/fixtures/scrollContentTrace.ts';
import { assessScrollReadingTrace } from '../packages/app/fixtures/scrollReadingTrace.ts';
import {
  concurrentScenarioRegistry,
  replayWebConcurrent,
} from './scroll-stability-concurrent-content-evidence.mjs';
import {
  keyboardScenarios,
  replayKeyboardEvidence,
  pendingSendScenario,
  replayPendingSendEvidence,
} from './scroll-stability-keyboard-evidence.mjs';
import {
  navigationScenarioRegistry,
  navigationAttachmentNames,
  replayWebNavigation,
} from './scroll-stability-navigation-replay.mjs';
import {
  referenceScenarioRegistry,
  referenceAttachmentNames,
  replayWebReference,
} from './scroll-stability-reference-evidence.mjs';
import {
  assessScrollInputTrace,
  bindScrollInputDeliveries,
  SCROLL_INPUT_GROWTH_DRAFT,
} from '../packages/app/fixtures/scrollInputTrace.ts';

const web = (
  scenario,
  title,
  matrix,
  history,
  traceNames,
  scope,
  options = {}
) => ({
  scenario: `web-${scenario}`,
  title,
  matrix,
  history,
  traceNames,
  scope,
  source: 'apps/tlon-web/e2e/scroller-stability.spec.ts',
  suite: 'Real conversation geometry',
  evidenceLevel: 'sampled-dom-geometry',
  ...options,
});

export const webScenarioRegistry = [
  ...referenceScenarioRegistry,
  ...concurrentScenarioRegistry,
  ...navigationScenarioRegistry,
  web(
    'pending-send-read',
    pendingSendScenario.title,
    pendingSendScenario.matrix,
    [],
    [],
    'One real Enter send held pending while the user deliberately scrolls upward; release and committed acknowledgement must retain the declared reading point. Normal desktop app flags, observed browser resources and sampled DOM/transport evidence only; no complete build receipt, native caret or presented-frame proof.',
    {
      source: pendingSendScenario.source,
      suite: null,
      requirePendingSendProof: true,
      pendingSendAttachment: pendingSendScenario.attachment,
      pendingSendRawAttachment: pendingSendScenario.rawAttachment,
      evidenceLevel: 'sampled-dom-pending-send-read',
    }
  ),
  ...keyboardScenarios.map((item) =>
    web(
      `keyboard-${item.position}`,
      item.title,
      ['CMP-01', 'CMP-02', 'A11Y-02'],
      [],
      [],
      `Real desktop keyboard editing, selection, undo/redo, focus and Enter routing at ${item.position}; partial command and sampled geometry evidence, native textarea caret and presented frames incomplete`,
      {
        source: item.source,
        suite: null,
        requireKeyboardProof: true,
        keyboardPosition: item.position,
        keyboardAttachment: item.attachment,
      }
    )
  ),
  ...['latest', 'history'].map((position) =>
    web(
      `reading-image-${position}`,
      `rich-text reading point survives actual image decode in the same post (${position})`,
      ['AC-01', 'AC-07', 'AC-09', 'STA-01'],
      [],
      [`production-reading-image-${position}-geometry`],
      `Real desktop ChatMessage with image-before-rich-paragraph, immutable essay and exact interior text point at ${position}; normal application flags with Vite assets; sampled DOM and actual decode only, no painted/native or all-content proof`,
      {
        source: 'apps/tlon-web/e2e/scroller-reading-stability.spec.ts',
        suite: null,
        requireAnchors: true,
        requireReadingProof: true,
        readingLabel: `production-reading-image-${position}`,
      }
    )
  ),
  ...['end', 'near', 'deep'].map((position) =>
    web(
      `composer-exact-${position === 'near' ? 'history' : position === 'deep' ? 'deep-history' : 'end'}`,
      `exact draft growth and clear ${position === 'near' ? 'while reading near the bottom' : position === 'deep' ? 'while reading deep history' : 'at latest'}`,
      ['CMP-01', 'CMP-02', 'AC-11', 'AC-15'],
      [],
      ['composer-exact-geometry'],
      `Real desktop composer fill/grow/clear at ${position === 'near' ? 'deliberate reading within 100px of latest' : position === 'deep' ? 'history at least two viewports from latest' : 'latest'}, with exact trusted input delivery, draft/selection/focus and sampled geometry; native textarea caret and presented frames remain separately incomplete`,
      {
        source: 'apps/tlon-web/e2e/scroller-input-stability.spec.ts',
        suite: 'Real composer input and geometry',
        requireAnchors: position !== 'end',
        inputPosition: position,
        legacyTitles:
          position === 'near'
            ? ['exact draft growth and clear while reading history']
            : [],
        requireInputProof: true,
      }
    )
  ),
  web(
    'image-content-end',
    'delayed image content remains exposed after decoding at latest',
    ['FLK-07', 'FLK-12', 'STA-01'],
    [],
    ['image-content-end'],
    'One real same-props 2:1 image at latest at rest: sampled DOM reservation/content continuity through decode and a one-second ready tail, with retained row, immutable essay and pinned geometry; no other loading paths, native or painted-frame proof',
    {
      requireAnchors: true,
      requireImageLoadingProof: true,
      requireContentProof: true,
    }
  ),
  ...['normal', 'reduced'].map((motion) =>
    web(
      `latest-control-${motion}`,
      `latest control appears and disappears without extra flashes (${motion} motion)`,
      ['CTL-02', 'CTL-04', 'CTL-06', 'CTL-14'],
      [],
      [0, 1].map((cycle) => `latest-control-${motion}-${cycle}`),
      `Two sequential desktop ${motion}-motion cycles of sampled DOM appearance/hide and cached latest landing, including geometry after hide; no pagination, loading, cancellation, paint or native presentation proof`,
      { requireChromeProof: true }
    )
  ),
  ...[
    [
      'end',
      'delayed image decode changes row height while latest stays pinned',
    ],
    [
      'history',
      'delayed image decode above the viewport preserves the reading anchor',
    ],
    [
      'composer',
      'delayed image decode and composer growth preserve the reading anchor',
    ],
    [
      'wheel',
      'delayed image decode during upward wheel scroll preserves user direction',
    ],
  ].map(([mode, title]) =>
    web(
      `image-load-${mode}`,
      title,
      mode === 'composer' ? ['STA-01', 'CMP-01'] : ['STA-01'],
      [],
      [`image-load-${mode}`],
      mode === 'composer'
        ? 'One actual pending image decode with immutable backend content and an expanded composer, followed by clear; no simultaneous input/layout or three-way ordering proof'
        : mode === 'wheel'
          ? 'One actual pending image decode across three upward wheel inputs; no multi-row, momentum or exact event-overlap proof'
          : `One actual pending image decode with immutable backend content at ${mode}; no cache, failure/retry or placeholder-installation coverage`,
      { requireAnchors: true, requireImageLoadingProof: true }
    )
  ),
  ...[false, true].map((browsing) =>
    web(
      `thinking-${browsing ? 'history' : 'end'}`,
      `computing presence show, clear, and reply handoff ${browsing ? 'preserve history' : 'stay pinned to latest'}`,
      [browsing ? 'THK-03' : 'THK-02', 'THK-04'],
      [],
      ['computing-presence'],
      'Local participant computing presence: show/clear hold, then reply-before-clear; no bot process or other handoff orders',
      { requireAnchors: browsing }
    )
  ),
  web(
    'channel-send-history',
    'channel own send from history lands at latest and stays there',
    ['SND-01', 'NAV-02'],
    ['REG-038', 'REG-039'],
    ['send-from-history'],
    'One channel text send from loaded history'
  ),
  web(
    'thread-send-history',
    'thread own send from history lands at latest and stays there',
    ['THR-03', 'SND-01'],
    ['REG-038', 'REG-039'],
    ['send-from-history'],
    'One group-thread text send from loaded history'
  ),
  web(
    'composer-end',
    'composer growth and clear remain pinned to latest',
    ['CMP-01', 'CMP-02'],
    ['REG-056'],
    ['composer-growth-clear'],
    'One six-line fill and clear at latest'
  ),
  web(
    'composer-history',
    'composer growth and clear preserve reading anchor',
    ['CMP-01', 'CMP-02'],
    ['REG-056'],
    ['composer-growth-clear'],
    'One six-line fill and clear while reading history',
    { requireAnchors: true }
  ),
  web(
    'hover-menu',
    'hover and action menu preserve the reading position and content extent',
    ['WEB-01', 'OVR-01'],
    ['REG-055'],
    ['hover-menu'],
    'One row hover/menu lifecycle in history',
    { requireAnchors: true }
  ),
  web(
    'latest-button',
    'latest button lands at the reachable bottom',
    ['NAV-01'],
    ['REG-022'],
    ['latest-button'],
    'Actual latest control with already loaded newest range'
  ),
  web(
    'reference-target',
    'same-channel post reference lands centered on the selected post',
    ['ENT-03', 'NAV-02'],
    ['REG-026'],
    ['reference-target'],
    'One loaded same-channel reference target',
    { requireAnchors: true }
  ),
  web(
    'thread-return',
    'thread navigation eventually restores the same reading post and pixel offset',
    ['THR-01', 'LIF-01'],
    ['REG-020', 'REG-036'],
    ['before-thread', 'after-thread'],
    'Eventual return offset only; no claim about frames while navigation remounts the list',
    { requireAnchors: true, separateReturnCapture: true }
  ),
  web(
    'reaction-resize',
    'reaction insertion and removal preserve a preceding reading anchor',
    ['DAT-07', 'OVR-02'],
    [],
    ['reaction-resize'],
    'One visible reaction insertion/removal with a preceding witness',
    { requireAnchors: true }
  ),
  web(
    'edit-growth-shrink',
    'editing a visible message to grow and shrink preserves history',
    ['DAT-07', 'SND-07'],
    [],
    ['edit-growth-shrink'],
    'One visible message edit to grow and shrink',
    { requireAnchors: true }
  ),
  web(
    'quote-preview',
    'quoted attachment preview keeps the reading anchor while composer resizes',
    ['CMP-04'],
    [],
    ['quote-preview'],
    'One actual reference attachment preview; no image upload coverage',
    { requireAnchors: true }
  ),
  web(
    'viewport-resize',
    'viewport height changes retain the bottom edge',
    ['GEO-02'],
    ['REG-056'],
    ['viewport-resize'],
    'One browser viewport-height round trip at latest'
  ),
  web(
    'remote-burst-end',
    'remote append burst follows latest',
    ['DAT-01', 'DAT-02'],
    ['REG-053'],
    ['remote-burst'],
    'Five staggered real remote sends while at latest'
  ),
  web(
    'remote-burst-history',
    'remote append burst holds history',
    ['DAT-01', 'DAT-02'],
    ['REG-054'],
    ['remote-burst'],
    'Five staggered real remote sends while reading history',
    { requireAnchors: true }
  ),
  web(
    'thread-read-update',
    'incoming reply clears thread unread state without moving the visible thread',
    ['UNR-05', 'THR-03'],
    ['REG-045', 'REG-046'],
    ['thread-read-update'],
    'One active group thread; no DM/multiple-thread/background coverage'
  ),
];

// These checks replay positional contracts from raw DOM samples. Playwright
// still owns UI/backend preconditions; its declared status cannot override a
// contradictory position, missing witness, or unobserved mutation here.
function replayWebGeometry(record) {
  const issues = [];
  const reject = (message, kind = 'failure') => issues.push({ message, kind });
  const scenario = record.scenario;
  const bottomLanding = [
    'web-channel-send-history',
    'web-thread-send-history',
    'web-latest-button',
    'web-latest-control-normal',
    'web-latest-control-reduced',
  ].includes(scenario);
  const bottomPinned = [
    'web-composer-exact-end',
    'web-composer-end',
    'web-viewport-resize',
    'web-remote-burst-end',
    'web-thinking-end',
    'web-thread-read-update',
    'web-image-load-end',
    'web-image-content-end',
    'web-reading-image-latest',
  ].includes(scenario);
  const holds = [
    'web-composer-exact-history',
    'web-composer-exact-deep-history',
    'web-composer-history',
    'web-hover-menu',
    'web-reaction-resize',
    'web-edit-growth-shrink',
    'web-quote-preview',
    'web-remote-burst-history',
    'web-thinking-history',
    'web-thread-return',
    'web-image-load-history',
    'web-image-load-composer',
  ].includes(scenario);
  for (const attachment of record.browserTraces) {
    const { frames } = attachment.value;
    const first = frames[0];
    const last = frames.at(-1);
    const tail = frames.filter((frame) => frame.time >= last.time - 1000);
    const proof = record.loadingProofs?.find(
      (item) => item.name === `${attachment.name}-loading-proof`
    )?.value;
    const ids = Object.keys(first.anchors);
    const anchorId = scenario.startsWith('web-image-load-')
      ? proof?.readerId
      : ids[0];
    const visible = (frame, row) =>
      row && row.bottom > 0 && row.top < frame.clientHeight;
    if (bottomPinned || bottomLanding) {
      if (
        (bottomLanding ? tail : frames).some(
          (frame) => Math.abs(frame.bottomGap) > 1
        )
      )
        reject('Raw bottom position exceeds 1 CSS pixel');
    }
    if (holds) {
      if (!anchorId || !first.anchors[anchorId])
        reject('Missing declared reading witness', 'incomplete');
      else if (
        frames.some(
          (frame) =>
            !visible(frame, frame.anchors[anchorId]) ||
            Math.abs(
              frame.anchors[anchorId].top - first.anchors[anchorId].top
            ) > 1
        )
      )
        reject('Raw reading witness drift or occlusion');
    }
    if (bottomLanding || scenario === 'web-image-load-wheel') {
      const sign = scenario === 'web-image-load-wheel' ? -1 : 1;
      if (
        sign * (last.scrollTop - first.scrollTop) <= 1 ||
        frames.some(
          (frame, index) =>
            index > 0 &&
            sign * (frame.scrollTop - frames[index - 1].scrollTop) < -1
        )
      )
        reject(
          'Raw scroll progress or direction contradicts the requested movement'
        );
    }
    if (scenario === 'web-reference-target') {
      if (!ids[0]) reject('Missing selected target', 'incomplete');
      else
        for (const frame of tail) {
          const row = frame.anchors[ids[0]];
          const desired = Math.max(
            0,
            Math.min(
              frame.scrollHeight - frame.clientHeight,
              row.top + frame.scrollTop - (frame.clientHeight - row.height) / 2
            )
          );
          if (!visible(frame, row) || Math.abs(frame.scrollTop - desired) > 1)
            reject('Raw selected-target landing exceeds 1 CSS pixel');
        }
    }
    if (
      [
        'web-composer-exact-end',
        'web-composer-exact-history',
        'web-composer-exact-deep-history',
        'web-composer-end',
        'web-composer-history',
        'web-viewport-resize',
        'web-image-load-composer',
        'web-quote-preview',
      ].includes(scenario)
    ) {
      if (
        (scenario === 'web-viewport-resize'
          ? Math.max(...frames.map((frame) => frame.clientHeight)) <=
            first.clientHeight
          : Math.min(...frames.map((frame) => frame.clientHeight)) >=
            first.clientHeight) ||
        (scenario !== 'web-quote-preview' &&
          last.clientHeight !== first.clientHeight)
      )
        reject(
          'Required viewport resize/restore was not captured',
          'incomplete'
        );
    }
    if (
      scenario === 'web-hover-menu' &&
      frames.some((frame) => frame.scrollHeight !== first.scrollHeight)
    )
      reject('Hover/menu changed the content extent');
    if (['web-reaction-resize', 'web-edit-growth-shrink'].includes(scenario)) {
      const changedId = ids[1];
      const heights = frames.map((frame) => frame.anchors[changedId]?.height);
      if (
        !changedId ||
        !heights.every(Number.isFinite) ||
        Math.max(...heights) <= heights[0] ||
        heights.at(-1) >= Math.max(...heights) ||
        Math.max(...frames.map((frame) => frame.scrollHeight)) <=
          first.scrollHeight
      )
        reject(
          'Required target row grow/shrink was not captured',
          'incomplete'
        );
      else if (
        scenario === 'web-reaction-resize' &&
        (Math.abs(heights.at(-1) - heights[0]) > 1 ||
          Math.abs(last.scrollHeight - first.scrollHeight) > 1)
      )
        reject('Reaction removal did not restore row/content extent');
    }
    if (
      ['web-thinking-end', 'web-thinking-history'].includes(scenario) &&
      Math.max(...frames.map((frame) => frame.scrollHeight)) <
        first.scrollHeight + 52
    )
      reject('Required computing footer extent was not captured', 'incomplete');
    if (scenario === 'web-image-load-wheel') {
      const wheel = proof?.wheel;
      if (
        !wheel ||
        !Number.isFinite(wheel.initialTop) ||
        !Number.isFinite(wheel.wheelDelta) ||
        wheel.wheelDelta <= 20 ||
        wheel.wheelCount !== 3 ||
        Math.abs(wheel.initialTop - first.scrollTop) > 1
      )
        reject('Missing real wheel displacement contract', 'incomplete');
      else {
        const expectedTop = Math.max(
          0,
          Math.min(
            wheel.initialTop - wheel.wheelCount * wheel.wheelDelta,
            last.scrollHeight - last.clientHeight
          )
        );
        if (last.bottomGap <= 1 || Math.abs(last.scrollTop - expectedTop) > 1)
          reject('Raw wheel landing lost the requested displacement');
      }
    }
  }
  if (scenario === 'web-thread-return') {
    const before = record.browserTraces
      .find((item) => item.name === 'before-thread')
      ?.value.frames.at(-1);
    const after = record.browserTraces.find(
      (item) => item.name === 'after-thread'
    )?.value.frames[0];
    const id = Object.keys(before?.anchors ?? {})[0];
    if (!id || !after?.anchors[id])
      reject('Restoration lacks the same row identity', 'incomplete');
    else if (Math.abs(before.anchors[id].top - after.anchors[id].top) > 1)
      reject('Restored row differs from the pre-navigation pixel offset');
  }
  return issues;
}

// The producer supplies observed timing, not permission to weaken the scenario.
// Validate the fixed registered schedule before replaying the shared state oracle.
function replayWebChrome(record) {
  const issues = [];
  const reject = (name, message, kind = 'incomplete') =>
    issues.push({ message: `${name}: ${message}`, kind });
  const object = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const expectedPhases = [
    ['at-end', 'hidden'],
    ['in-history', 'visible'],
    ['landed', 'hidden'],
  ];
  const expectedMarks = [
    'reveal-request',
    'history-window',
    'press-request',
    'hide-eligibility',
    'landed-window',
    'terminal-ready',
  ];
  let previousContract;
  for (const name of record.contract.traceNames) {
    const attachments = (record.chromeProofs ?? []).filter(
      (item) => item.name === `${name}-chrome-proof`
    );
    const proof = attachments[0]?.value;
    const trace = proof?.trace;
    const contract = proof?.contract;
    if (
      attachments.length !== 1 ||
      attachments[0]?.error ||
      !object(trace) ||
      !object(contract) ||
      !Array.isArray(trace.samples) ||
      !trace.samples.length ||
      !Array.isArray(trace.actions) ||
      !Array.isArray(trace.errors) ||
      trace.errors.length !== 0 ||
      !Array.isArray(trace.marks) ||
      trace.samples.some(
        (sample) =>
          !object(sample) ||
          !object(sample.measurement) ||
          !Array.isArray(sample.controls) ||
          sample.controls.some((control) => !object(control))
      ) ||
      trace.actions.some((event) => !object(event)) ||
      trace.marks.some((mark) => !object(mark))
    ) {
      reject(name, 'Missing or invalid raw chrome proof');
      continue;
    }
    const { coverage, phases, transitions, action } = contract;
    if (
      typeof contract.scope !== 'string' ||
      !contract.scope ||
      !object(coverage) ||
      !Number.isFinite(coverage.startTime) ||
      !Number.isFinite(coverage.endTime) ||
      coverage.endTime <= coverage.startTime ||
      !Number.isFinite(coverage.maxGapMs ?? 100) ||
      (coverage.maxGapMs ?? 100) <= 0 ||
      (coverage.maxGapMs ?? 100) > 100 ||
      !Number.isFinite(coverage.maxMeasurementDurationMs ?? 32) ||
      (coverage.maxMeasurementDurationMs ?? 32) < 0 ||
      (coverage.maxMeasurementDurationMs ?? 32) > 32 ||
      trace.samples[0].time !== coverage.startTime ||
      trace.samples.at(-1).time < coverage.endTime ||
      !Array.isArray(phases) ||
      phases.length !== 3 ||
      phases.some(
        (phase, index) =>
          !object(phase) ||
          phase.id !== expectedPhases[index][0] ||
          !Number.isFinite(phase.startTime) ||
          !Number.isFinite(phase.endTime) ||
          phase.endTime <= phase.startTime ||
          phase.loading !== false ||
          phase.semanticState !== 'list-visible' ||
          !Array.isArray(phase.controls) ||
          phase.controls.length !== 1 ||
          !object(phase.controls[0]) ||
          phase.controls[0].id !== 'latest' ||
          phase.controls[0].kind !== 'icon' ||
          phase.controls[0].visibility !== expectedPhases[index][1] ||
          (phase.controls[0].opacity ?? (index === 1 ? 1 : 0)) !==
            (index === 1 ? 1 : 0)
      ) ||
      phases.at(-1).endTime - phases.at(-1).startTime < 1000 ||
      !Array.isArray(transitions) ||
      transitions.length !== 2 ||
      transitions.some(
        (transition) =>
          !object(transition) ||
          !Number.isFinite(transition.startTime) ||
          !Number.isFinite(transition.endTime) ||
          transition.endTime < transition.startTime ||
          transition.endTime - transition.startTime > 1000 ||
          transition.opacity !==
            (record.scenario === 'web-latest-control-reduced'
              ? 'instant'
              : 'monotonic')
      ) ||
      !object(action) ||
      action.id !== 'press-latest' ||
      action.startTime !== phases[1].endTime ||
      action.endTime !== phases[2].startTime
    ) {
      reject(
        name,
        'Missing fixed latest-control schedule or weakened capture limits'
      );
      continue;
    }
    if (
      trace.marks.length !== 6 ||
      trace.marks.some(
        (mark, index) =>
          mark.id !== expectedMarks[index] ||
          !Number.isFinite(mark.time) ||
          (index < 5 &&
            index !== 3 &&
            mark.time !==
              [
                phases[0].endTime,
                phases[1].startTime,
                phases[1].endTime,
                undefined,
                phases[2].startTime,
              ][index])
      ) ||
      trace.marks[5].time < phases[2].startTime ||
      coverage.endTime !== trace.marks[5].time + 1000 ||
      trace.actions.length !== 1 ||
      trace.actions[0].id !== 'press-latest'
    ) {
      reject(name, 'Missing phase markers or exactly one actual latest press');
      continue;
    }
    const eligibility = trace.marks[3];
    if (
      eligibility.pointerEvents !== 'none' ||
      eligibility.sameControl !== true ||
      eligibility.scope !== contract.scope ||
      eligibility.time < action.startTime ||
      eligibility.time < trace.actions[0].time ||
      eligibility.time > phases[2].startTime ||
      (record.scenario === 'web-latest-control-normal' &&
        phases[2].startTime - eligibility.time < 200)
    ) {
      reject(
        name,
        'Missing retained-control hide eligibility or premature normal fade deadline'
      );
      continue;
    }
    if (
      previousContract &&
      (contract.scope !== previousContract.scope ||
        coverage.startTime <= previousContract.coverage.endTime)
    )
      reject(
        name,
        'The two cycles must be sequential in the same conversation scope'
      );
    previousContract = contract;
    const geometry = record.browserTraces.find(
      (item) => item.name === name
    )?.value;
    const geometryMarks = Array.isArray(geometry?.marks) ? geometry.marks : [];
    const start = geometryMarks.find((mark) => mark?.label === `${name}:start`);
    const terminal = geometryMarks.find(
      (mark) => mark?.label === `${name}:terminal-state`
    );
    if (
      !Number.isFinite(start?.time) ||
      !Number.isFinite(terminal?.time) ||
      start.time < action.startTime ||
      start.time > trace.actions[0].time ||
      terminal.time < trace.marks[5].time ||
      terminal.time < trace.actions[0].time ||
      terminal.time > coverage.endTime
    )
      reject(
        name,
        'The actual latest press and hide must belong to this geometry capture'
      );
    // Bad JSON shapes are rejected above. Keep a fail-closed boundary around
    // the shared oracle so malformed attachments cannot crash the report CLI.
    try {
      const result = assessScrollChromeTrace(trace, contract);
      for (const issue of result.issues)
        reject(name, `Chrome ${issue.code}: ${issue.message}`, issue.kind);
    } catch {
      reject(name, 'Raw chrome proof could not be replayed');
    }
  }
  return issues;
}

// The content attachment extends the same actual image/row experiment. It
// cannot qualify a different row, route request, conversation, or geometry run.
function replayWebContent(record) {
  const issues = [];
  const reject = (name, message, kind = 'incomplete') =>
    issues.push({ message: `${name}: ${message}`, kind });
  const object = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  for (const name of record.contract.traceNames) {
    const attachments = (record.contentProofs ?? []).filter(
      (item) => item.name === `${name}-content-proof`
    );
    const { trace, contract } = attachments[0]?.value ?? {};
    const loading = record.loadingProofs?.find(
      (item) => item.name === `${name}-loading-proof`
    )?.value;
    const geometry = record.browserTraces.find(
      (item) => item.name === name
    )?.value;
    if (
      attachments.length !== 1 ||
      attachments[0].error ||
      !object(trace) ||
      !object(contract) ||
      !object(loading) ||
      !object(geometry) ||
      !Array.isArray(trace.samples) ||
      !trace.samples.length ||
      !Array.isArray(trace.events) ||
      !Array.isArray(trace.marks) ||
      !Array.isArray(geometry.frames) ||
      !geometry.frames.length ||
      !Array.isArray(geometry.marks)
    ) {
      reject(name, 'Missing or invalid raw content/loading/geometry proof');
      continue;
    }
    // First replay the content detector; even correctly crosslinked evidence
    // must reject a one-sample disappearance, duplicate, or terminal reversion.
    let contentResult;
    try {
      contentResult = assessScrollContentTrace(trace, contract);
      for (const issue of contentResult.issues)
        reject(name, `Content ${issue.code}`, issue.kind);
    } catch {
      reject(name, 'Raw content proof could not be replayed');
      continue;
    }
    if (contentResult.issues.some((issue) => issue.kind === 'incomplete'))
      continue;
    const coverage = contract.coverage;
    let source;
    try {
      source = new URL(contract.src);
    } catch {
      /* rejected below */
    }
    let channel;
    try {
      channel = decodeURIComponent(
        contract.scope.split('/channel/')[1] ?? ''
      ).replace(/\/$/, '');
    } catch {
      /* rejected below */
    }
    const essay = loading.beforeEssay;
    if (
      !source ||
      source.origin !== 'http://localhost:3000' ||
      source.search ||
      source.hash ||
      source.username ||
      source.password ||
      !/^\/scroller-loading\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.png$/.test(
        source.pathname
      ) ||
      loading.origin !== source.origin ||
      loading.scope !== contract.scope ||
      loading.src !== source.pathname ||
      loading.imagePostId !== contract.rowId ||
      !/^chat\/~[^/]+\/[^/]+$/.test(channel ?? '') ||
      !object(essay) ||
      essay.author !== '~zod' ||
      essay.kind !== '/chat' ||
      !Number.isFinite(essay.sent) ||
      essay.meta !== null ||
      essay.blob !== null ||
      !isDeepStrictEqual(essay.content, [
        { inline: [contract.caption] },
        {
          block: {
            image: {
              src: loading.src,
              alt: contract.caption,
              width: 0,
              height: 0,
            },
          },
        },
      ]) ||
      !isDeepStrictEqual(essay, loading.afterEssay) ||
      !object(loading.available) ||
      !Number.isFinite(loading.available.width) ||
      !Number.isFinite(loading.available.height) ||
      loading.available.width < 600 ||
      loading.available.height < 300 ||
      loading.clockDomains?.route !== 'Date.now milliseconds' ||
      loading.clockDomains?.content !== 'performance.now milliseconds'
    )
      reject(
        name,
        'Content identity, original unknown-size essay, or fit precondition does not match the loading experiment'
      );

    // Route timestamps use wall time, while both DOM recorders use performance
    // time. Compare each only within its own clock domain. A copied proof from
    // an earlier attempt cannot establish this attempt's network lifecycle.
    const attemptStart = Date.parse(record.attemptStartTime);
    const attemptEnd =
      record.attemptWallEndTime ?? attemptStart + record.attemptDurationMs;
    if (
      !Number.isFinite(attemptStart) ||
      !Number.isFinite(record.attemptDurationMs) ||
      record.attemptDurationMs <= 0 ||
      !Array.isArray(loading.requests) ||
      !loading.requests.length ||
      loading.requests.some(
        (request) =>
          !object(request) ||
          ![request.requestedAt, request.releasedAt, request.fulfilledAt].every(
            Number.isFinite
          ) ||
          request.requestedAt < attemptStart ||
          request.requestedAt < essay?.sent ||
          request.releasedAt < request.requestedAt ||
          request.fulfilledAt < request.releasedAt ||
          request.fulfilledAt > attemptEnd
      )
    )
      reject(
        name,
        'Image route request/release/fulfillment is missing or belongs to another attempt'
      );

    const expectedMarks = [
      'start',
      'response-release',
      'image-decoded',
      'terminal-state',
    ];
    const marks = expectedMarks.map((suffix) =>
      geometry.marks.filter((mark) => mark?.label === `${name}:${suffix}`)
    );
    const times = marks.map((matches) => matches[0]?.time);
    const decoded = trace.events.find((event) => event?.id === 'image-decoded');
    const first = geometry.frames[0];
    const last = geometry.frames.at(-1);
    if (
      geometry.marks.length !== 4 ||
      marks.some((matches) => matches.length !== 1) ||
      !times.every(Number.isFinite) ||
      trace.samples[0].time > first?.time ||
      first?.time - trace.samples[0].time > 100 ||
      first?.time > times[0] ||
      times[0] > times[1] ||
      times[1] > contract.releaseTime ||
      contract.releaseTime - times[1] > 100 ||
      contract.releaseTime >= decoded?.time ||
      decoded?.time > times[2] ||
      times[2] > contract.terminalTime ||
      contract.terminalTime > times[3] ||
      times[3] > coverage.endTime ||
      coverage.endTime !== contract.terminalTime + 1000 ||
      last?.time < times[3] + 1000 ||
      last?.time < coverage.endTime
    )
      reject(
        name,
        'Content release/decode and the independent one-second deadline do not belong to this geometry capture'
      );

    const near = (left, right) =>
      Number.isFinite(left) &&
      Number.isFinite(right) &&
      Math.abs(left - right) <= 1;
    const samples = trace.samples;
    if (
      !near(samples[0]?.row?.rect?.height, loading.beforeRow?.height) ||
      !near(samples.at(-1)?.row?.rect?.height, loading.afterRow?.height) ||
      !near(
        samples[0]?.images?.[0]?.presentation?.rect?.height,
        loading.beforeImage?.height
      ) ||
      !near(
        samples.at(-1)?.images?.[0]?.presentation?.rect?.height,
        loading.afterImage?.height
      ) ||
      geometry.frames.some(
        (frame) =>
          !frame?.anchors ||
          Object.keys(frame.anchors).length !== 1 ||
          !frame.anchors[contract.rowId] ||
          frame.clientHeight < 300 ||
          !near(frame.clientHeight, loading.available?.height)
      ) ||
      samples.some(
        (sample) =>
          sample.time >= first?.time &&
          sample.time <= last?.time &&
          !geometry.frames.some(
            (frame) =>
              Math.abs(frame.time - sample.time) <= coverage.maxGapMs &&
              near(frame.viewportTop, sample.list?.clip?.top) &&
              near(frame.viewportBottom, sample.list?.clip?.bottom) &&
              near(
                frame.anchors?.[contract.rowId]?.height,
                sample.row?.rect?.height
              ) &&
              near(
                frame.anchors?.[contract.rowId]?.top + frame.viewportTop,
                sample.row?.rect?.top
              )
          )
      )
    )
      reject(
        name,
        'Content samples do not match the identified loading row and paired viewport geometry'
      );
  }
  return issues;
}

export function replayWebReading(record) {
  try {
    return replayWebReadingUnchecked(record);
  } catch {
    return [
      { message: 'Reading: malformed raw reading proof', kind: 'incomplete' },
    ];
  }
}

function replayWebReadingUnchecked(record) {
  const issues = [];
  const reject = (message, kind = 'incomplete') =>
    issues.push({ message: `Reading: ${message}`, kind });
  const name = record.contract?.readingLabel;
  const object = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const get = (suffix) => {
    const matches = (record.readingProofs ?? []).filter(
      (item) => item.name === `${name}-${suffix}`
    );
    return matches.length === 1 && !matches[0].error
      ? matches[0].value
      : undefined;
  };
  const proof = get('reading-proof');
  const loading = get('loading-proof');
  const image = get('image-events');
  const preparation = get('preparation');
  if (preparation?.assets === 'Built production assets')
    issues.push(
      ...assessProductionAssets(get('asset-proof'), {
        origin: preparation.origin,
        scope: preparation.scope,
        attemptStartTime: record.attemptStartTime,
        attemptDurationMs: record.attemptDurationMs,
        attemptWallEndTime: record.attemptWallEndTime,
        attemptClockError: record.attemptClockError,
        performanceEndTime: proof?.contract?.coverage?.endTime,
      })
    );
  const geometry = record.browserTraces?.find(
    (item) => item.name === `${name}-geometry`
  )?.value;
  if (
    ![proof, loading, image, preparation, geometry].every(object) ||
    !object(proof.trace) ||
    !object(proof.contract) ||
    !Array.isArray(proof.trace.samples) ||
    !proof.trace.samples.length ||
    !Array.isArray(image.samples) ||
    !image.samples.length ||
    !Array.isArray(image.events) ||
    !Array.isArray(image.marks) ||
    !Array.isArray(geometry.frames) ||
    !geometry.frames.length ||
    !Array.isArray(geometry.marks)
  ) {
    reject(
      'Missing complete raw reading/loading/preparation/geometry attachments'
    );
    return issues;
  }
  const { trace, contract } = proof;
  let replay;
  try {
    replay = assessScrollReadingTrace(trace, contract);
    replay.issues.forEach((issue) => reject(issue.code, issue.kind));
  } catch {
    reject('Raw reading oracle could not be replayed');
    return issues;
  }
  if (replay.issues.some((issue) => issue.kind === 'incomplete')) return issues;
  const text = contract.revision?.text;
  const match =
    typeof text === 'string' &&
    /^(Reader [0-9a-f]{8}: plain words, )reading point stable\(\) and unchanged trailing text\.$/.exec(
      text
    );
  const inlines = match && [
    match[1],
    { bold: ['reading'] },
    ' ',
    { italics: ['point'] },
    ' ',
    { 'inline-code': 'stable()' },
    ' and unchanged trailing text.',
  ];
  const essay = loading.beforeEssay;
  let source;
  let channel;
  try {
    source = new URL(loading.src, loading.origin);
    channel = decodeURIComponent(
      contract.scope.split('/channel/')[1] ?? ''
    ).replace(/\/$/, '');
  } catch {
    /* rejected below */
  }
  const styles = preparation.semantic?.descendants;
  if (
    !match ||
    !source ||
    source.origin !== 'http://localhost:3000' ||
    source.search ||
    source.hash ||
    source.username ||
    source.password ||
    !/^\/scroller-loading\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.png$/.test(
      source.pathname
    ) ||
    loading.src !== source.pathname ||
    loading.origin !== source.origin ||
    loading.scope !== contract.scope ||
    loading.imagePostId !== contract.rowId ||
    !/^chat\/~zod\/[^/]+$/.test(channel ?? '') ||
    contract.revision.id !== `committed-post-${contract.rowId}` ||
    contract.point.start !== text.indexOf('reading') ||
    contract.point.end !== text.indexOf('reading') + 1 ||
    !object(essay) ||
    essay.author !== '~zod' ||
    essay.kind !== '/chat' ||
    !Number.isFinite(essay.sent) ||
    essay.meta !== null ||
    essay.blob !== null ||
    !isDeepStrictEqual(essay.content, [
      {
        block: { image: { src: loading.src, alt: text, width: 0, height: 0 } },
      },
      { inline: inlines },
    ]) ||
    !isDeepStrictEqual(essay, loading.afterEssay) ||
    preparation.expectedText !== text ||
    !isDeepStrictEqual(preparation.inlines, inlines) ||
    preparation.scope !== contract.scope ||
    preparation.origin !== source.origin ||
    preparation.ship !== 'zod' ||
    preparation.e2eMode !== false ||
    !(
      (preparation.assets === 'Vite development assets' &&
        preparation.developmentAssets === true) ||
      (preparation.assets === 'Built production assets' &&
        preparation.developmentAssets === false)
    ) ||
    preparation.headed !== true ||
    preparation.channel !== 'chromium' ||
    typeof preparation.browser !== 'string' ||
    !preparation.browser ||
    preparation.semantic?.text !== text ||
    preparation.semantic?.selector !== contract.blockSelector ||
    !Array.isArray(styles) ||
    !styles.some(
      (node) => node?.text === 'reading' && Number(node.fontWeight) >= 600
    ) ||
    !styles.some(
      (node) => node?.text === 'point' && node.fontStyle === 'italic'
    ) ||
    !styles.some(
      (node) =>
        node?.text === 'stable()' && /mono|courier/i.test(node.fontFamily)
    ) ||
    loading.clockDomains?.route !== 'Date.now milliseconds' ||
    loading.clockDomains?.samplesAndEvents !== 'performance.now milliseconds'
  )
    reject(
      'Registered rich paragraph, unknown-size image essay, selected character or real-application scope does not match'
    );

  const attemptStart = Date.parse(record.attemptStartTime);
  const attemptEnd =
    record.attemptWallEndTime ?? attemptStart + record.attemptDurationMs;
  if (
    !Number.isFinite(attemptStart) ||
    !Number.isFinite(record.attemptDurationMs) ||
    record.attemptDurationMs <= 0 ||
    !Array.isArray(loading.requests) ||
    !loading.requests.length ||
    loading.requests.some(
      (request) =>
        !object(request) ||
        ![request.requestedAt, request.releasedAt, request.fulfilledAt].every(
          Number.isFinite
        ) ||
        request.requestedAt < attemptStart ||
        request.requestedAt < essay?.sent ||
        request.releasedAt < request.requestedAt ||
        request.fulfilledAt < request.releasedAt ||
        request.fulfilledAt > attemptEnd
    )
  )
    reject(
      'Actual request/release/fulfillment is missing or belongs to another attempt'
    );

  const loadEvents = image.events.filter((event) => event?.id === 'image-load');
  const decodeEvents = image.events.filter(
    (event) => event?.id === 'image-decoded'
  );
  const releaseMarks = image.marks.filter(
    (mark) => mark?.id === 'response-release'
  );
  const releaseGeometry = geometry.marks.filter(
    (mark) => mark?.label === `${name}:response-release`
  );
  const decodeGeometry = geometry.marks.filter(
    (mark) => mark?.label === `${name}:image-decoded`
  );
  const first = trace.samples[0];
  const last = trace.samples.at(-1);
  const geometryFirst = geometry.frames[0];
  const geometryLast = geometry.frames.at(-1);
  const release = loading.releaseTime;
  const terminal = loading.terminalTime;
  if (
    !isDeepStrictEqual(image.events, loading.events) ||
    loadEvents.length !== 1 ||
    decodeEvents.length !== 1 ||
    image.events.length !== 2 ||
    image.events.some(
      (event) =>
        !object(event) ||
        !Number.isFinite(event.time) ||
        event.scope !== contract.scope ||
        event.src !== source?.href ||
        event.currentSrc !== source?.href ||
        event.trusted !== true ||
        event.originalTarget !== true
    ) ||
    !isDeepStrictEqual(loading.beforeDecode, {
      complete: false,
      width: 0,
      height: 0,
    }) ||
    !isDeepStrictEqual(loading.afterDecode, {
      complete: true,
      width: 2,
      height: 1,
    }) ||
    image.marks.length !== 1 ||
    releaseMarks.length !== 1 ||
    releaseMarks[0]?.time !== release ||
    geometry.marks.length !== 2 ||
    releaseGeometry.length !== 1 ||
    decodeGeometry.length !== 1 ||
    ![
      release,
      terminal,
      releaseGeometry[0]?.time,
      decodeGeometry[0]?.time,
    ].every(Number.isFinite) ||
    terminal !== contract.terminalTime ||
    contract.coverage.endTime !== terminal + 1000 ||
    first.time < geometryFirst.time ||
    first.time - geometryFirst.time > 100 ||
    geometryLast.time < contract.coverage.endTime ||
    release - first.time < 250 ||
    releaseGeometry[0]?.time > release ||
    release - releaseGeometry[0]?.time > 100 ||
    release > loadEvents[0]?.time ||
    loadEvents[0]?.time > decodeEvents[0]?.time ||
    decodeEvents[0]?.time > decodeGeometry[0]?.time ||
    decodeGeometry[0]?.time > terminal ||
    terminal - release > 10_000
  )
    reject(
      'Real load/decode causality or independent quiet-tail coverage does not match this capture'
    );

  const near = (a, b) =>
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1;
  // A first-in-group ChatMessage also renders an avatar. Identify the actual
  // controlled image by its unique request URL, retaining the full inventory.
  const targetImages = (sample) =>
    Array.isArray(sample?.images)
      ? sample.images.filter((item) => item?.src === source?.href)
      : [];
  const surroundingImages = (sample) =>
    Array.isArray(sample?.images)
      ? sample.images
          .filter((item) => item?.src !== source?.href)
          .map((item) => ({ src: item?.src, currentSrc: item?.currentSrc }))
      : [];
  const firstImage = targetImages(image.samples[0])[0];
  const lastImage = targetImages(image.samples.at(-1))[0];
  const surrounding = surroundingImages(image.samples[0]);
  const validImageSamples =
    Array.isArray(image.errors) &&
    image.errors.length === 0 &&
    image.samples.length >= 6 &&
    image.samples.every((sample, index) => {
      const previous = image.samples[index - 1];
      const target = targetImages(sample)[0];
      return (
        object(sample) &&
        Number.isFinite(sample.time) &&
        (!previous ||
          (sample.time > previous.time &&
            sample.time - previous.time <= 100)) &&
        sample.measurement?.valid === true &&
        Number.isFinite(sample.measurement.durationMs) &&
        sample.measurement.durationMs >= 0 &&
        sample.measurement.durationMs <= 32 &&
        typeof sample.fallbackPresent === 'boolean' &&
        Array.isArray(sample.images) &&
        sample.images.every(
          (item) =>
            object(item) &&
            typeof item.src === 'string' &&
            typeof item.currentSrc === 'string'
        ) &&
        targetImages(sample).length === 1 &&
        typeof target.complete === 'boolean' &&
        Number.isFinite(target.naturalWidth) &&
        Number.isFinite(target.naturalHeight) &&
        Number.isFinite(target.presentation?.rect?.height)
      );
    });
  if (!validImageSamples) {
    reject(
      'Image lifecycle capture has missing, malformed or delayed observations'
    );
  } else {
    let observedReady = false;
    for (const sample of image.samples) {
      const target = targetImages(sample)[0];
      const pending =
        target.complete === false &&
        target.naturalWidth === 0 &&
        target.naturalHeight === 0;
      const ready =
        target.complete === true &&
        target.naturalWidth === 2 &&
        target.naturalHeight === 1;
      if (
        sample.fallbackPresent ||
        (target.currentSrc !== source?.href &&
          !(pending && target.currentSrc === '')) ||
        (!pending && !ready) ||
        (observedReady && !ready)
      )
        reject(
          'Current image reverted, changed source or entered fallback',
          'failure'
        );
      if (
        (sample.time < release &&
          (!pending ||
            !near(
              target.presentation.rect.height,
              loading.beforeImage?.height
            ))) ||
        (sample.time >= decodeEvents[0]?.time && !ready)
      )
        reject(
          'Image readiness contradicts the observed release/decode lifecycle'
        );
      observedReady ||= ready;
    }
    const changed = trace.samples.filter(
      (sample) => !near(sample.row.rect.height, loading.beforeRow?.height)
    );
    if (
      !changed.length ||
      changed.some(
        (sample) =>
          sample.time + sample.measurement.durationMs < loadEvents[0]?.time
      ) ||
      !changed.some((sample) => sample.time <= terminal) ||
      trace.samples.some(
        (sample) =>
          sample.time < release &&
          !near(sample.row.rect.height, loading.beforeRow?.height)
      )
    )
      reject('Row reflow was not observed after the actual image load');
  }
  if (
    image.samples[0]?.time < first.time ||
    image.samples[0]?.time >= release ||
    image.samples.at(-1)?.time < contract.coverage.endTime ||
    firstImage?.complete !== false ||
    firstImage?.naturalWidth !== 0 ||
    firstImage?.naturalHeight !== 0 ||
    lastImage?.complete !== true ||
    lastImage?.naturalWidth !== 2 ||
    lastImage?.naturalHeight !== 1 ||
    image.samples.some(
      (sample) =>
        sample?.scope !== contract.scope ||
        sample.rowId !== contract.rowId ||
        sample.sameRow !== true ||
        !Array.isArray(sample.images) ||
        targetImages(sample).length !== 1 ||
        targetImages(sample)[0]?.sameElement !== true ||
        !isDeepStrictEqual(surroundingImages(sample), surrounding)
    ) ||
    !near(first.row.rect.height, loading.beforeRow?.height) ||
    !near(last.row.rect.height, loading.afterRow?.height) ||
    !near(
      firstImage?.presentation?.rect?.height,
      loading.beforeImage?.height
    ) ||
    !near(lastImage?.presentation?.rect?.height, loading.afterImage?.height) ||
    Math.abs(loading.afterRow?.height - loading.beforeRow?.height) <= 16 ||
    Math.abs(loading.afterImage?.height - loading.beforeImage?.height) <= 16 ||
    Math.max(...trace.samples.map((sample) => sample.row.rect.height)) -
      Math.min(...trace.samples.map((sample) => sample.row.rect.height)) <=
      16 ||
    geometry.frames.some(
      (frame) =>
        !frame?.anchors ||
        Object.keys(frame.anchors).length !== 1 ||
        !frame.anchors[contract.rowId]
    ) ||
    trace.samples.some(
      (sample) =>
        !geometry.frames.some(
          (frame) =>
            Math.abs(frame.time - sample.time) <= contract.coverage.maxGapMs &&
            near(frame.viewportTop, sample.list.rect.top) &&
            near(frame.viewportBottom, sample.list.rect.bottom) &&
            near(
              frame.anchors?.[contract.rowId]?.height,
              sample.row.rect.height
            ) &&
            near(
              frame.anchors?.[contract.rowId]?.top + frame.viewportTop,
              sample.row.rect.top
            )
        )
    )
  )
    reject(
      'Retained image, actual row resize, text point and paired list geometry are not crosslinked'
    );
  if (
    record.scenario === 'web-reading-image-history' &&
    geometryFirst.bottomGap <= 100
  )
    reject('History preparation does not establish reading away from latest');
  return issues;
}

function readJsonAttachment(attempt, name, source) {
  const attachments = (attempt.attachments ?? []).filter(
    (attachment) =>
      attachment.name === name && attachment.contentType === 'application/json'
  );
  if (attachments.length !== 1)
    return { name, error: 'Expected exactly one raw evidence attachment' };
  try {
    const attachment = attachments[0];
    const json =
      typeof attachment.body === 'string'
        ? Buffer.from(attachment.body, 'base64').toString('utf8')
        : readFileSync(resolve(dirname(source), attachment.path), 'utf8');
    return { name, value: JSON.parse(json) };
  } catch {
    return { name, error: 'Raw attachment is unavailable or not valid JSON' };
  }
}

/** Installed Playwright JSON schema: suites/specs/tests/results/attachments. */
export function readPlaywrightReport(
  report,
  source,
  registry = webScenarioRegistry
) {
  const records = [];
  function walk(suite, parents = []) {
    const titles = [...parents, suite.title];
    for (const spec of suite.specs ?? []) {
      const file = String(spec.file ?? suite.file ?? '').replaceAll('\\', '/');
      const contract = registry.find(
        (item) =>
          (item.title === spec.title ||
            item.legacyTitles?.includes(spec.title)) &&
          (!item.suite || titles.includes(item.suite)) &&
          file &&
          (item.source === file ||
            item.source?.endsWith(`/${file}`) ||
            file.endsWith(`/${item.source}`))
      );
      for (const test of spec.tests ?? []) {
        for (const attempt of test.results?.length
          ? test.results
          : [{ status: 'not-run' }]) {
          // Keep calibration evidence outside product coverage. Dedicated files
          // also identify historical reports that predate static annotations.
          const declaredDetector = [test.annotations, attempt.annotations].some(
            (annotations) =>
              Array.isArray(annotations) &&
              annotations.some(
                (annotation) =>
                  annotation?.type === 'evidence-kind' &&
                  annotation.description === 'scroller-detector-calibration'
              )
          );
          const dedicatedDetector =
            /(?:^|\/)scroller-(?:(?:reading|input)-detectors|keyboard-controls)\.spec\.ts$/.test(
              file
            );
          const legacyDetector = titles.includes(
            'Scroller detector self-tests'
          );
          const annotatedDetector =
            declaredDetector &&
            (dedicatedDetector ||
              (!contract &&
                /(?:^|\/)scroller-stability\.spec\.ts$/.test(file)));
          const detector =
            legacyDetector || dedicatedDetector || annotatedDetector;
          const excluded = detector
            ? 'detector-self-test'
            : test.projectName === 'setup' || /auth\.setup\.[jt]s$/.test(file)
              ? 'authentication-setup'
              : null;
          const browserTraces = [];
          const loadingProofs = [];
          const chromeProofs = [];
          const contentProofs = [];
          const inputProofs = [];
          const readingProofs = [];
          const referenceProofs = [];
          const concurrentProofs = [];
          const keyboardProofs = [];
          const pendingSendProofs = [];
          const navigationProofs = [];
          if (contract && !excluded) {
            if (contract.requirePendingSendProof)
              for (const name of [
                contract.pendingSendAttachment,
                contract.pendingSendRawAttachment,
              ])
                pendingSendProofs.push(
                  readJsonAttachment(attempt, name, source)
                );
            if (contract.requireConcurrentContentProof)
              concurrentProofs.push(
                readJsonAttachment(
                  attempt,
                  contract.concurrentAttachment,
                  source
                )
              );
            if (contract.requireKeyboardProof)
              for (const name of [
                contract.keyboardAttachment,
                `keyboard-${contract.keyboardPosition}-raw`,
              ])
                keyboardProofs.push(readJsonAttachment(attempt, name, source));
            if (contract.requireNavigationProof)
              for (const name of navigationAttachmentNames(contract))
                navigationProofs.push(
                  readJsonAttachment(attempt, name, source)
                );
            if (contract.requireReferenceProof)
              for (const name of referenceAttachmentNames(
                contract.referencePosition
              ))
                referenceProofs.push(readJsonAttachment(attempt, name, source));
            if (contract.requireReadingProof) {
              for (const suffix of [
                'reading-proof',
                'loading-proof',
                'image-events',
                'preparation',
                'asset-proof',
              ])
                readingProofs.push(
                  readJsonAttachment(
                    attempt,
                    `${contract.readingLabel}-${suffix}`,
                    source
                  )
                );
            }
            if (contract.requireInputProof)
              inputProofs.push(
                readJsonAttachment(
                  attempt,
                  'composer-exact-input-proof',
                  source
                )
              );
            for (const name of contract.traceNames) {
              browserTraces.push(readJsonAttachment(attempt, name, source));
              if (contract.requireImageLoadingProof)
                loadingProofs.push(
                  readJsonAttachment(attempt, `${name}-loading-proof`, source)
                );
              if (contract.requireChromeProof)
                chromeProofs.push(
                  readJsonAttachment(attempt, `${name}-chrome-proof`, source)
                );
              if (contract.requireContentProof)
                contentProofs.push(
                  readJsonAttachment(attempt, `${name}-content-proof`, source)
                );
            }
          }
          records.push({
            kind: 'playwright',
            source,
            scenario: contract?.scenario ?? `unregistered-web:${spec.title}`,
            title: spec.title,
            platform: `web:${test.projectName || test.projectId || 'unknown'}`,
            runId: `${report.stats?.startTime ?? source}:${spec.id ?? spec.title}:${attempt.retry ?? 0}`,
            reportedStatus: attempt.status,
            expectedStatus: test.expectedStatus,
            attemptStartTime: attempt.startTime,
            attemptDurationMs: attempt.duration,
            ...readAttemptClock(attempt, spec.id),
            executed: !['skipped', 'not-run'].includes(attempt.status),
            excluded,
            evidenceKind: detector
              ? 'scroller-detector-calibration'
              : undefined,
            evidenceKindSource: detector
              ? declaredDetector
                ? 'annotation'
                : legacyDetector
                  ? 'legacy-suite'
                  : 'legacy-file'
              : undefined,
            contract,
            browserTraces,
            loadingProofs,
            chromeProofs,
            contentProofs,
            inputProofs,
            readingProofs,
            referenceProofs,
            concurrentProofs,
            keyboardProofs,
            pendingSendProofs,
            navigationProofs,
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, titles);
  }
  for (const suite of report.suites) walk(suite);
  for (const [index] of (report.errors ?? []).entries()) {
    records.push({
      kind: 'playwright',
      source,
      title: `Playwright runner error ${index + 1}`,
      reportedStatus: 'failed',
      excluded: 'runner-error',
    });
  }
  return records;
}

export function replayWebInput(record) {
  const incomplete = (message) => [{ message, kind: 'incomplete' }];
  const attachments = record.inputProofs;
  if (
    !Array.isArray(attachments) ||
    attachments.length !== 1 ||
    attachments[0].error
  )
    return incomplete('Missing exact composer input proof');
  const proof = attachments[0].value;
  const contract = proof?.contract;
  const raw = proof?.raw;
  const frames = record.browserTraces?.[0]?.value?.frames;
  const expectedActions = [SCROLL_INPUT_GROWTH_DRAFT, ''].map(
    (payload, index) => ({
      id: `input-${index + 1}`,
      kind: 'input',
      scopeKey: raw?.originalScope,
      inputId: 'MessageInput',
      payload,
    })
  );
  if (
    !contract ||
    !raw ||
    !Array.isArray(frames) ||
    !frames.length ||
    typeof raw.originalScope !== 'string' ||
    !raw.originalScope.includes('/channel/') ||
    raw.inputId !== 'MessageInput' ||
    raw.declaredAt !== contract.declaredAt ||
    !isDeepStrictEqual(contract.actions, expectedActions) ||
    !isDeepStrictEqual(raw.commandPlan, expectedActions) ||
    !Array.isArray(raw.actions) ||
    raw.actions.some((action) => action.trusted !== true) ||
    !Array.isArray(contract.phases) ||
    contract.phases.length !== 3 ||
    contract.phases.some(
      (phase, index) =>
        !isDeepStrictEqual(phase.expected, {
          scopeKey: raw.originalScope,
          inputId: 'MessageInput',
          draft: index === 1 ? SCROLL_INPUT_GROWTH_DRAFT : '',
          selection: {
            start: index === 1 ? SCROLL_INPUT_GROWTH_DRAFT.length : 0,
            end: index === 1 ? SCROLL_INPUT_GROWTH_DRAFT.length : 0,
          },
          composing: false,
          focused: true,
          caretVisible: true,
          sendVisible: true,
          sendHitTestable: index === 1,
        }) || phase.triggerActionId !== (index ? `input-${index}` : undefined)
    ) ||
    contract.phases[1].end - contract.phases[1].start < 300 ||
    frames[0].time > contract.start ||
    frames.at(-1).time < contract.end
  )
    return incomplete(
      'Composer proof differs from the registered payload, scope, phases or geometry interval'
    );
  try {
    const binding = bindScrollInputDeliveries({
      declaredAt: raw.declaredAt,
      expected: expectedActions,
      dispatches: raw.dispatches,
      events: raw.actions,
    });
    const replay = assessScrollInputTrace({
      contract,
      samples: raw.samples,
      actions: binding.actions,
    });
    return [...binding.issues, ...replay.issues].map((issue) => ({
      message: issue.code,
      kind: issue.kind,
    }));
  } catch {
    return incomplete('Malformed raw composer input proof');
  }
}

function replayWebKeyboard(record) {
  const registered = webScenarioRegistry.find(
    (item) => item.scenario === record?.scenario && item.requireKeyboardProof
  );
  if (!registered || !isDeepStrictEqual(record.contract, registered))
    return [
      {
        kind: 'incomplete',
        message: 'Keyboard: missing exact registered contract',
      },
    ];
  const get = (name) => {
    const matches = (record.keyboardProofs ?? []).filter(
      (item) => item.name === name
    );
    return matches.length === 1 && !matches[0].error
      ? matches[0].value
      : undefined;
  };
  const replay = replayKeyboardEvidence(
    get(registered.keyboardAttachment),
    get(`keyboard-${registered.keyboardPosition}-raw`),
    registered.keyboardPosition,
    {
      title: record.title,
      startTime: record.attemptStartTime,
      duration: record.attemptDurationMs,
    }
  );
  return replay.issues.map((issue) => ({
    kind: issue.kind,
    message: `Keyboard: ${issue.dimension}:${issue.code}`,
  }));
}

function replayWebPendingSend(record) {
  const registered = webScenarioRegistry.find(
    (item) => item.scenario === record?.scenario && item.requirePendingSendProof
  );
  if (!registered || !isDeepStrictEqual(record.contract, registered))
    return [
      {
        kind: 'incomplete',
        message: 'Pending send: missing exact registered contract',
      },
    ];
  const get = (name) => {
    const matches = (record.pendingSendProofs ?? []).filter(
      (item) => item.name === name
    );
    return matches.length === 1 && !matches[0].error
      ? matches[0].value
      : undefined;
  };
  const replay = replayPendingSendEvidence(
    get(registered.pendingSendAttachment),
    get(registered.pendingSendRawAttachment),
    {
      title: record.title,
      startTime: record.attemptStartTime,
      duration: record.attemptDurationMs,
    }
  );
  return replay.issues.map((issue) => ({
    kind: issue.kind,
    message: `Pending send: ${issue.dimension}:${issue.code}`,
  }));
}

export function assessWebEvidence(record) {
  if (record.executed === false) return { status: 'not-run', issues: [] };
  const issues = [];
  if (
    !record.contract ||
    record.browserTraces.length !== record.contract.traceNames.length
  )
    issues.push('Missing registered trace contract');
  for (const attachment of record.browserTraces) {
    const trace = attachment.value;
    if (
      attachment.error ||
      !trace ||
      !Array.isArray(trace.frames) ||
      trace.frames.length < 6 ||
      !Array.isArray(trace.errors) ||
      trace.errors.length ||
      !Array.isArray(trace.marks) ||
      trace.marks.some(
        (mark) =>
          !mark || typeof mark.label !== 'string' || !Number.isFinite(mark.time)
      )
    ) {
      issues.push(`${attachment.name}: missing or invalid raw trace`);
      continue;
    }
    const anchors = Object.keys(trace.frames[0]?.anchors ?? {});
    const initial = trace.frames[0];
    const position = record.contract?.inputPosition;
    if (
      position &&
      (!Number.isFinite(initial?.bottomGap) ||
        !Number.isFinite(initial?.clientHeight) ||
        initial.clientHeight <= 0 ||
        (position === 'end' && Math.abs(initial.bottomGap) > 1) ||
        (position === 'near' &&
          (initial.bottomGap <= 1 || initial.bottomGap > 100)) ||
        (position === 'deep' && initial.bottomGap < 2 * initial.clientHeight))
    )
      issues.push(
        `${attachment.name}: missing required ${position} reading position`
      );
    if (record.contract.requireAnchors && anchors.length === 0)
      issues.push(`${attachment.name}: missing witness identity`);
    for (const [index, frame] of trace.frames.entries()) {
      const previous = trace.frames[index - 1];
      if (
        !frame ||
        ![
          'time',
          'scrollTop',
          'scrollHeight',
          'clientHeight',
          'viewportTop',
          'viewportBottom',
          'bottomGap',
        ].every((key) => Number.isFinite(frame[key])) ||
        frame.clientHeight <= 0 ||
        frame.scrollHeight <= frame.clientHeight ||
        frame.viewportBottom <= frame.viewportTop ||
        !frame.anchors ||
        typeof frame.anchors !== 'object' ||
        Array.isArray(frame.anchors) ||
        Math.abs(
          frame.viewportBottom - frame.viewportTop - frame.clientHeight
        ) > 1 ||
        Math.abs(
          frame.bottomGap -
            (frame.scrollHeight - frame.clientHeight - frame.scrollTop)
        ) > 1 ||
        (previous &&
          (frame.time <= previous.time || frame.time - previous.time > 100))
      ) {
        issues.push(
          `${attachment.name}: invalid geometry or temporal coverage`
        );
        break;
      }
      for (const id of anchors) {
        const anchor = frame.anchors?.[id];
        if (
          !anchor ||
          !['top', 'bottom', 'height'].every((key) =>
            Number.isFinite(anchor[key])
          ) ||
          anchor.height <= 0 ||
          Math.abs(anchor.bottom - anchor.top - anchor.height) > 1
        ) {
          issues.push(
            `${attachment.name}: missing or invalid witness geometry`
          );
          break;
        }
      }
    }
    const first = trace.frames[0]?.time;
    const last = trace.frames.at(-1)?.time;
    if (record.contract.separateReturnCapture) {
      const duration = attachment.name === 'before-thread' ? 200 : 1000;
      if (last - first < duration)
        issues.push(`${attachment.name}: incomplete observation interval`);
    } else if (
      !record.contract.requireReadingProof &&
      !record.contract.requireReferenceProof
    ) {
      const starts = trace.marks.filter(
        (mark) => mark.label === `${attachment.name}:start`
      );
      const terminals = trace.marks.filter(
        (mark) => mark.label === `${attachment.name}:terminal-state`
      );
      if (
        starts.length !== 1 ||
        terminals.length !== 1 ||
        !Number.isFinite(starts[0]?.time) ||
        !Number.isFinite(terminals[0]?.time) ||
        starts[0].time < first ||
        terminals[0].time < starts[0].time ||
        last - terminals[0].time < 1000
      )
        issues.push(
          `${attachment.name}: missing action or terminal quiet-tail coverage`
        );
      if (record.contract.requireImageLoadingProof) {
        const release = trace.marks.filter(
          (mark) => mark.label === `${attachment.name}:response-release`
        );
        const decoded = trace.marks.filter(
          (mark) => mark.label === `${attachment.name}:image-decoded`
        );
        if (
          release.length !== 1 ||
          decoded.length !== 1 ||
          !Number.isFinite(release[0]?.time) ||
          !Number.isFinite(decoded[0]?.time) ||
          release[0].time - starts[0]?.time < 200 ||
          decoded[0].time < release[0].time ||
          decoded[0].time > terminals[0]?.time
        )
          issues.push(
            `${attachment.name}: missing pending/release/decode causal markers`
          );
        const proof = record.loadingProofs?.find(
          (item) => item.name === `${attachment.name}-loading-proof`
        )?.value;
        const changedHeight = (before, after) =>
          Number.isFinite(before?.height) &&
          Number.isFinite(after?.height) &&
          before.height > 0 &&
          after.height > 0 &&
          Math.abs(after.height - before.height) > 16;
        const heights = trace.frames.map(
          (frame) => frame.anchors?.[proof?.imagePostId]?.height
        );
        const capturedResize =
          heights.every(Number.isFinite) &&
          Math.max(...heights) - Math.min(...heights) > 16;
        if (
          !proof ||
          typeof proof.src !== 'string' ||
          !proof.src ||
          typeof proof.imagePostId !== 'string' ||
          !anchors.includes(proof.imagePostId) ||
          proof.beforeDecode?.complete !== false ||
          proof.beforeDecode?.width !== 0 ||
          proof.beforeDecode?.height !== 0 ||
          proof.afterDecode?.complete !== true ||
          proof.afterDecode?.width !== 2 ||
          proof.afterDecode?.height !== 1 ||
          !Array.isArray(proof.requests) ||
          proof.requests.length === 0 ||
          proof.requests.some(
            (request) =>
              !Number.isFinite(request?.requestedAt) ||
              !Number.isFinite(request?.releasedAt) ||
              request.releasedAt < request.requestedAt
          ) ||
          proof.beforeEssay == null ||
          !isDeepStrictEqual(proof.beforeEssay, proof.afterEssay) ||
          proof.sameMountedRow !== true ||
          !changedHeight(proof.beforeImage, proof.afterImage) ||
          !changedHeight(proof.beforeRow, proof.afterRow) ||
          Math.abs(heights[0] - proof.beforeRow?.height) > 1 ||
          Math.abs(heights.at(-1) - proof.afterRow?.height) > 1 ||
          !capturedResize
        )
          issues.push(
            `${attachment.name}: missing or invalid same-row image loading proof`
          );
      }
    }
  }
  const replayIssues = [
    ...(record.attemptClockError
      ? [{ kind: 'incomplete', message: record.attemptClockError }]
      : []),
    ...(issues.length ? [] : replayWebGeometry(record)),
    ...(record.contract?.requireChromeProof ? replayWebChrome(record) : []),
    ...(record.contract?.requireContentProof ? replayWebContent(record) : []),
    ...(record.contract?.requireReadingProof ? replayWebReading(record) : []),
    ...(record.contract?.requireInputProof ? replayWebInput(record) : []),
    ...(record.contract?.requireReferenceProof
      ? replayWebReference(record)
      : []),
    ...(record.contract?.requireConcurrentContentProof
      ? replayWebConcurrent(record)
      : []),
    ...(record.contract?.requireKeyboardProof ? replayWebKeyboard(record) : []),
    ...(record.contract?.requirePendingSendProof
      ? replayWebPendingSend(record)
      : []),
    ...(record.contract?.requireNavigationProof
      ? replayWebNavigation(record)
      : []),
  ];
  // Independently witnessed failures survive gaps in other proof dimensions.
  // Missing caret geometry, for example, cannot hide a qualified scroll jump.
  // A producer assertion alone still cannot turn invalid evidence into a failure.
  return {
    status: replayIssues.some((issue) => issue.kind === 'failure')
      ? 'fail'
      : issues.length ||
          replayIssues.some((issue) => issue.kind === 'incomplete')
        ? 'incomplete'
        : replayIssues.length === 0 &&
            record.reportedStatus === 'passed' &&
            record.expectedStatus === 'passed'
          ? 'recorded-sampled-pass'
          : 'fail',
    issues: [...issues, ...replayIssues.map((issue) => issue.message)],
  };
}

import { assessScrollReadingTrace } from '../packages/app/fixtures/scrollReadingTrace.ts';
import { isDeepStrictEqual } from 'node:util';
import {
  assessScrollKeyboardTrace,
  assessPendingSendEvidence,
  FAILED_SEND_RETRY_TITLE,
  createKeyboardPlan,
} from '../packages/app/fixtures/scrollKeyboardTrace.ts';

export const keyboardScenarios = ['latest', 'history'].map((position) => ({
  position,
  title: `real keyboard edits, selection, undo and Enter routing (${position})`,
  source: 'apps/tlon-web/e2e/scroller-keyboard-stability.spec.ts',
  attachment: `keyboard-${position}-proof`,
}));
const textOf = (essay) => {
  if (!Array.isArray(essay?.content)) return null;
  const verses = [];
  for (const verse of essay.content) {
    if (!Array.isArray(verse?.inline)) return null;
    let text = '';
    for (const inline of verse.inline) {
      if (typeof inline === 'string') text += inline;
      else if (
        inline &&
        typeof inline === 'object' &&
        Object.keys(inline).length === 1 &&
        inline.break === null
      )
        text += '\n';
      else return null;
    }
    verses.push(text);
  }
  return verses.join('\n').replace(/\n$/, '');
};

/** Standalone replay; attempt comes from the enclosing Playwright result,
 * not from the producer proof. Existing fill contracts remain separate. */
export function replayKeyboardEvidence(proof, raw, position, attempt) {
  const incomplete = (code) => ({
    verdict: 'INCOMPLETE',
    issues: [{ code, kind: 'incomplete', dimension: 'input' }],
    caretGeometry: 'INCOMPLETE',
    presentedFrames: 'INCOMPLETE',
  });
  try {
    const p = proof.preparation;
    const registered = keyboardScenarios.find((r) => r.position === position);
    const attemptStart = Date.parse(attempt?.startTime);
    if (
      !registered ||
      attempt?.title !== registered.title ||
      !Number.isFinite(attemptStart) ||
      !(attempt.duration > 0) ||
      !p ||
      p.origin !== 'http://localhost:3000' ||
      p.ship !== 'zod' ||
      p.e2eMode !== false ||
      p.headed !== true ||
      p.assets !== 'Vite development assets' ||
      typeof p.browser !== 'string' ||
      typeof p.platform !== 'string' ||
      !Number.isFinite(p.timeOrigin) ||
      !Number.isFinite(p.capturedAt) ||
      !Number.isFinite(p.wallTime) ||
      Math.abs(p.wallTime - p.timeOrigin - p.capturedAt) > 100 ||
      p.wallTime < attemptStart - 100 ||
      proof.trace.samples.at(-1).time - proof.trace.samples[0].time >
        attempt.duration ||
      !Array.isArray(proof.transportErrors) ||
      !isDeepStrictEqual(raw?.transportErrors, proof.transportErrors) ||
      !isDeepStrictEqual(raw?.trace, proof.trace) ||
      !isDeepStrictEqual(raw?.preparation, p) ||
      !isDeepStrictEqual(raw?.wheel, proof.wheel) ||
      !isDeepStrictEqual(raw?.requests, proof.requests)
    )
      return incomplete('Missing exact raw keyboard/provenance association');
    const plan = createKeyboardPlan(
      p.scope,
      proof.plan.token,
      p.platform.startsWith('Mac') ? 'Meta' : 'Control',
      position,
      proof.plan.anchorId
    );
    if (
      !isDeepStrictEqual(plan, proof.plan) ||
      p.capturedAt > proof.trace.declaredAt
    )
      return incomplete('Keyboard command plan was weakened or changed');
    const backend = proof.backend;
    const channel = decodeURIComponent(p.scope.split('/channel/')[1] ?? '');
    if (
      !/^chat\/~zod\/[^/]+$/.test(channel) ||
      !Array.isArray(proof.wheel) ||
      (position === 'history' &&
        !proof.wheel.some(
          (e) =>
            e.trusted === true &&
            e.deltaY < 0 &&
            Number.isFinite(e.time) &&
            e.time < proof.trace.declaredAt
        ))
    )
      return incomplete('Missing actual READ or current-channel preparation');
    const backendIssues = [];
    const missing = (code) =>
      backendIssues.push({ code, kind: 'incomplete', dimension: 'routing' });
    if (proof.transportErrors.length) missing('Incomplete request capture');
    if (!backend || !proof.rawBackend?.posts)
      missing('Missing raw backend response');
    else {
      const read = proof.backendRead;
      if (
        read?.url !==
          `${p.origin}/~/scry/channels/v5/${channel}/posts/newest/50/post.json` ||
        read?.status !== 200 ||
        !Number.isFinite(read?.started?.time) ||
        !Number.isFinite(read?.completed?.time) ||
        read.started.time < proof.trace.plannedEnd ||
        read.completed.time < read.started.time ||
        [read.started, read.completed].some(
          (r) =>
            !Number.isFinite(r.wall) ||
            Math.abs(r.wall - p.timeOrigin - r.time) > 100
        )
      )
        missing('Missing actual post-capture backend read');
      const actual = Object.values(proof.rawBackend.posts)
        .filter((post) => textOf(post?.essay)?.includes(plan.token))
        .map((post) => ({
          id: post.seal?.id == null ? null : String(post.seal.id),
          author: post.essay?.author,
          text: textOf(post.essay),
          essay: post.essay,
        }));
      if (
        !isDeepStrictEqual(actual, backend.posts) ||
        backend.channel !== channel ||
        !isDeepStrictEqual(backend.requests, proof.requests)
      )
        missing('Backend summary does not match raw essays or requests');
    }
    if (!Array.isArray(proof.requests))
      missing('Missing actual send request capture');
    else
      for (const r of proof.requests) {
        const adds = Array.isArray(r.actions)
          ? r.actions.filter(
              (a) =>
                a?.action === 'poke' &&
                a.app === 'channels' &&
                a.mark === 'channel-action-2' &&
                a.json?.channel?.action?.post?.add
            )
          : [];
        const a = adds[0];
        const essay = a?.json?.channel?.action?.post?.add;
        if (
          r.method !== 'PUT' ||
          !r.url?.startsWith(`${p.origin}/~/channel/`) ||
          !Number.isFinite(r.wallStart) ||
          r.wallStart <= 0 ||
          r.time !== r.wallStart - p.timeOrigin ||
          adds.length !== 1 ||
          a.json.channel.nest !== r.channel ||
          essay?.author !== r.author ||
          textOf(essay) !== r.text
        )
          missing('Actual send request does not match routing summary');
      }
    const assessment = assessScrollKeyboardTrace(
      proof.trace,
      plan,
      backendIssues.length ? undefined : backend
    );
    const issues = [...assessment.issues, ...backendIssues];
    return {
      ...assessment,
      issues,
      verdict: issues.some((i) => i.kind === 'failure')
        ? 'FAIL'
        : issues.length
          ? 'INCOMPLETE'
          : 'PASS',
    };
  } catch {
    return incomplete('Malformed keyboard proof');
  }
}

export const pendingSendScenario = {
  scenario: 'web-pending-send-read',
  title:
    'pending Enter send cannot reclaim latest after deliberate upward scrolling',
  source: 'apps/tlon-web/e2e/scroller-keyboard-stability.spec.ts',
  attachment: 'pending-send-read-proof',
  rawAttachment: 'pending-send-read-raw',
  matrix: ['SND-04', 'RAC-08', 'AC-12'],
};

export const failedSendRetryScenario = {
  scenario: 'web-failed-send-retry',
  title: FAILED_SEND_RETRY_TITLE,
  source: pendingSendScenario.source,
  attachment: 'failed-send-retry-proof',
  rawAttachment: 'failed-send-retry-raw',
  matrix: ['SND-05', 'SND-08', 'AC-09', 'AC-12', 'AC-20'],
};

/** Exact raw association plus the bounded real-send contract. Assets are observed
 * browser resources, not a freshly qualified build receipt. */
export function replayPendingSendEvidence(attachment, raw, attempt) {
  const invalid = (code) => ({
    verdict: 'INCOMPLETE',
    issues: [{ code, kind: 'incomplete', dimension: 'routing' }],
    caretGeometry: 'INCOMPLETE',
    presentedFrames: 'INCOMPLETE',
  });
  try {
    const proof = attachment?.proof;
    const start = Date.parse(attempt?.startTime);
    if (
      !proof ||
      !isDeepStrictEqual(proof, raw) ||
      ![pendingSendScenario.title, failedSendRetryScenario.title].includes(
        attempt?.title
      ) ||
      proof.title !== attempt.title ||
      !Number.isFinite(start) ||
      !Number.isFinite(attempt?.duration) ||
      !(attempt?.duration > 0) ||
      proof.timeOrigin + proof.declaredAt < start - 100 ||
      proof.timeOrigin + proof.samples.at(-1).time >
        start + attempt.duration + 100
    )
      return invalid('missing-exact-pending-send-raw-attempt-association');
    return assessPendingSendEvidence(proof, assessScrollReadingTrace);
  } catch {
    return invalid('malformed-pending-send-replay');
  }
}

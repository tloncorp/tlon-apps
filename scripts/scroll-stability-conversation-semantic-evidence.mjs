import { assessConversationSemantics } from '../packages/app/fixtures/scrollConversationSemantic.ts';
import { assessScrollChromeTrace } from '../packages/app/fixtures/scrollChromeTrace.ts';
export function replayConversationSemantics(proof, geometry, scenario) {
  const incomplete = (code) => ({
    verdict: 'INCOMPLETE',
    issues: [{ code, kind: 'incomplete' }],
  });
  const mode = ['web-thinking-end', 'web-thinking-history'].includes(scenario)
    ? 'thinking'
    : ['web-remote-burst-end', 'web-remote-burst-history'].includes(scenario)
      ? 'remote'
      : undefined;
  if (
    !mode ||
    !proof?.trace ||
    !proof.contract ||
    proof.contract.mode !== mode ||
    !geometry?.frames?.length ||
    !Array.isArray(geometry.marks)
  )
    return incomplete('missing-scoped-conversation-semantic-proof');
  const setupIssue = conversationFollowSetupIssue(proof, geometry, scenario);
  if (setupIssue) return incomplete(setupIssue);
  const label = mode === 'thinking' ? 'computing-presence' : 'remote-burst';
  const start = geometry.marks.filter((m) => m.label === `${label}:start`);
  const terminal = geometry.marks.filter(
    (m) => m.label === `${label}:terminal-state`
  );
  const c = proof.contract;
  if (
    start.length !== 1 ||
    terminal.length !== 1 ||
    !Number.isFinite(start[0].time) ||
    !Number.isFinite(terminal[0].time) ||
    start[0].time < c.startTime ||
    terminal[0].time < c.terminalTime ||
    terminal[0].time > c.endTime ||
    geometry.frames.at(-1).time < c.endTime
  )
    return incomplete('semantic-geometry-window-mismatch');
  try {
    return assessConversationSemantics(proof.trace, c, assessScrollChromeTrace);
  } catch {
    return incomplete('malformed-conversation-semantic-proof');
  }
}

// FOLLOW assertions cannot use a READ baseline, even if a later frame happens
// to reach the end. v2 additionally retains the actual setup mouse activation.
export function conversationFollowSetupIssue(proof, geometry, scenario) {
  if (!['web-remote-burst-end', 'web-thinking-end'].includes(scenario))
    return undefined;
  const first = geometry?.frames?.[0];
  if (
    !first ||
    ![
      first.time,
      first.scrollHeight,
      first.clientHeight,
      first.scrollTop,
      first.bottomGap,
    ].every(Number.isFinite) ||
    first.clientHeight <= 0 ||
    Math.abs(first.bottomGap) > 1 ||
    Math.abs(
      first.bottomGap -
        (first.scrollHeight - first.clientHeight - first.scrollTop)
    ) > 1e-6
  )
    return 'conversation-follow-baseline-not-at-end';
  if (proof?.contract?.version !== 2) return undefined;
  const p = proof.trace?.followSetup;
  const c = proof.contract;
  const event = p?.actions?.[0];
  if (
    !p ||
    !Array.isArray(p.actions) ||
    p.actions.length !== 1 ||
    !event ||
    ![
      p.requestedAt,
      p.completedAt,
      p.bottomGap,
      p.targetClipPixels,
      event.eventTime,
      event.capturedAt,
      c.startTime,
    ].every(Number.isFinite) ||
    p.scope !== c.scope ||
    event.scope !== c.scope ||
    !p.postId ||
    proof.trace?.samples?.[0]?.posts?.at(-1)?.id !== p.postId ||
    p.requestedAt >= p.completedAt ||
    p.completedAt > c.startTime ||
    event.eventTime < p.requestedAt ||
    event.capturedAt < event.eventTime ||
    event.capturedAt - event.eventTime > 100 ||
    event.capturedAt > p.completedAt ||
    event.isTrusted !== true ||
    event.sameControl !== true ||
    event.button !== 0 ||
    event.detail !== 1 ||
    Math.abs(p.bottomGap) > 1 ||
    p.targetClipPixels < 0 ||
    p.targetClipPixels > 1
  )
    return 'conversation-fresh-follow-setup-unwitnessed';
  return undefined;
}

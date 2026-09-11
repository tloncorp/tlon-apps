export const statuses = ['passed', 'failed', 'blocked'];

export function localRecordingPath(recording) {
  // The CLI materializes artifact handles to strings; MCP may retain handles.
  const file =
    typeof recording.video === 'string'
      ? recording.video
      : recording.video?.hostPath;
  if (
    typeof file !== 'string' ||
    !file.startsWith('/') ||
    !file.endsWith('.mp4')
  )
    throw new Error('Argent did not return a local video path');
  return file;
}

export function verifyContext(env, harnessSha) {
  const pr = JSON.parse(env.QA_PR_JSON || 'null');
  if (!/^[a-f0-9]{40}$/.test(env.QA_BUILD_SHA || ''))
    throw new Error('A full EAS build commit is required');
  if (!/^[a-f0-9-]{36}$/.test(env.QA_BUILD_ID || ''))
    throw new Error('An explicit EAS build ID is required');
  if (!/^io\.tlon\.groups(?:\.preview)?$/.test(env.QA_APP_ID || ''))
    throw new Error('Unexpected application ID');
  if (!/^~[a-z]+(?:-[a-z]+)*$/.test(env.QA_TEST_SHIP || ''))
    throw new Error('An isolated test ship is required');
  if (env.QA_MODE === 'pull_request') {
    if (
      !pr?.head?.sha ||
      (env.QA_FULL_PR_RUN !== 'true' &&
        (pr.head.sha !== env.QA_BUILD_SHA || harnessSha !== env.QA_BUILD_SHA))
    )
      throw new Error(
        'PR head, EAS build commit, and checked-out source do not match'
      );
    if (pr.head.repo.full_name !== pr.base.repo.full_name)
      throw new Error('Fork PRs are not eligible for credentialed QA');
    if (pr.draft) throw new Error('QA requires a non-draft PR');
    const assessment = JSON.parse(env.QA_ASSESSMENT_JSON || 'null');
    if (
      assessment?.decision !== 'test' ||
      assessment.headSha !== pr.head.sha ||
      assessment.baseSha !== pr.base.sha ||
      !assessment.scenarios?.length
    )
      throw new Error(
        'PR testing requires an assessment for these exact commits'
      );
  } else if (env.QA_MODE !== 'workflow_dispatch') {
    throw new Error('Unsupported QA trigger');
  }
  return {
    mode:
      env.QA_MODE === 'pull_request'
        ? 'PR verification'
        : 'Harness validation only',
    buildId: env.QA_BUILD_ID,
    buildSha: env.QA_BUILD_SHA,
    harnessSha,
    appId: env.QA_APP_ID,
    testShip: env.QA_TEST_SHIP,
    pr,
    sourceOverlay: env.QA_FULL_PR_RUN === 'true',
    assessment:
      env.QA_MODE === 'pull_request'
        ? JSON.parse(env.QA_ASSESSMENT_JSON)
        : undefined,
  };
}

export function verifyReport(report, evidence) {
  if (
    !statuses.includes(report.status) ||
    typeof report.summary !== 'string' ||
    !Array.isArray(report.checks) ||
    !report.checks.length
  )
    throw new Error(
      'Report must include a status, summary, and explicit checks'
    );
  for (const check of report.checks) {
    if (
      !statuses.includes(check.status) ||
      !check.expected ||
      !check.observed ||
      !Array.isArray(check.evidence) ||
      check.evidence.some((id) => !evidence.has(id))
    )
      throw new Error(
        'Each check needs expected/observed behavior and valid evidence IDs'
      );
    if (check.status !== 'blocked' && !check.evidence.length)
      throw new Error('Passed and failed checks require captured evidence');
  }
  const derived = report.checks.some((check) => check.status === 'failed')
    ? 'failed'
    : report.checks.some((check) => check.status === 'blocked')
      ? 'blocked'
      : 'passed';
  if (report.status === 'passed' && derived !== 'passed')
    throw new Error('Incomplete or failed checks cannot produce a pass');
  if (
    report.status === 'passed' &&
    ![...evidence.values()].some((item) => item.screenshot)
  )
    throw new Error('Passing requires a captured screenshot');
  return report;
}

export function redact(text, secrets) {
  let value = String(text);
  for (const secret of secrets.filter(Boolean))
    value = value.split(secret).join('[redacted]');
  return value;
}

export function verifyVideo(probe, elapsedSeconds) {
  const stream = probe.streams?.find((item) => item.codec_type === 'video');
  const durationSeconds = Number(probe.format?.duration);
  if (
    stream?.codec_name !== 'h264' ||
    !(stream.width > 0 && stream.height > 0) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds < elapsedSeconds - Math.max(3, elapsedSeconds * 0.1)
  )
    throw new Error(
      'Video is missing, unplayable, or does not cover the test session'
    );
  return { durationSeconds, width: stream.width, height: stream.height };
}

export function renderReport(context, report, usage) {
  const clean = (value) =>
    String(value).replace(/@/g, '@\u200b').slice(0, 3000);
  return [
    `**${context.mode}: ${report.status}**`,
    '',
    clean(report.summary),
    '',
    `App commit: \`${context.buildSha}\` · Build: \`${context.buildId}\``,
    ...(context.sourceOverlay
      ? [
          `Requested PR source: \`${context.pr.head.sha}\`. The build commit adds QA tooling only; product source is verified identical.`,
        ]
      : []),
    `Harness commit: \`${context.harnessSha}\` · Device: ${context.device || 'not started'}`,
    ...(context.backend
      ? [
          `Backend commit: \`${context.backend.source}\` · Peer receipt: ${context.backend.replyVerified === true ? 'verified on ~ten' : 'not verified'}`,
        ]
      : []),
    context.otaDisabled
      ? 'Test-only configuration: OTA updates disabled in the installed copy.'
      : 'App preparation did not complete.',
    ...(context.smoke ? ['', `Scripted smoke: ${clean(context.smoke)}`] : []),
    ...(context.bootstrapRecovery
      ? ['', `Bootstrap limitation: ${clean(context.bootstrapRecovery)}`]
      : []),
    '',
    context.video?.status === 'ready'
      ? `Video: test-session.mp4 (${context.video.durationSeconds.toFixed(1)} seconds), attached as ios-agent-qa-video. Recording starts after login and account verification.`
      : `Video unavailable: ${clean(context.video?.error || 'Testing did not reach the recording stage')}.`,
    '',
    ...(report.checks || []).map(
      (check) =>
        `- **${check.status}** — ${clean(check.expected)}\n  Observed: ${clean(check.observed)} (evidence: ${check.evidence.join(', ') || 'none'})`
    ),
    '',
    `Agent usage: ${usage.calls} completed turns, ${usage.tokens} tokens. ${Number.isFinite(usage.cost) ? `$${usage.cost.toFixed(4)} reported cost.` : 'Dollar cost is not reported by Codex; API and runner billing are separate.'}`,
    'Screenshots, action evidence, and the structured report are in the ios-agent-qa artifact.',
    '',
  ].join('\n');
}

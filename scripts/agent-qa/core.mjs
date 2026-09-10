export const statuses = ['passed', 'failed', 'blocked'];

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
      pr.head.sha !== env.QA_BUILD_SHA ||
      harnessSha !== pr.head.sha
    )
      throw new Error(
        'PR head, EAS build commit, and checked-out source do not match'
      );
    if (pr.head.repo.full_name !== pr.base.repo.full_name)
      throw new Error('Fork PRs are not eligible for credentialed QA');
    if (!pr.labels?.some((label) => label.name === 'qa') || pr.draft)
      throw new Error('QA requires a non-draft PR with the qa label');
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
  };
}

export function commandFor(action) {
  const target = (value) => {
    if (
      typeof value !== 'string' ||
      value.length > 300 ||
      !/^(?:@e\d+|(?:id|label|text|role)=.+)$/.test(value)
    )
      throw new Error('Use a ref or selector from the current snapshot');
    return value;
  };
  switch (action.kind) {
    case 'snapshot':
      return ['snapshot', '-i'];
    case 'press':
      return ['press', target(action.target)];
    case 'fill':
      if (typeof action.text !== 'string' || action.text.length > 500)
        throw new Error('Text must be at most 500 characters');
      return ['fill', target(action.target), action.text];
    case 'scroll':
      if (!['up', 'down', 'left', 'right'].includes(action.direction))
        throw new Error('Invalid scroll direction');
      return ['scroll', action.direction];
    case 'back':
      return ['back'];
    default:
      throw new Error('Unsupported device action');
  }
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

export function renderReport(context, report, usage) {
  const clean = (value) =>
    String(value).replace(/@/g, '@\u200b').slice(0, 3000);
  return [
    `**${context.mode}: ${report.status}**`,
    '',
    clean(report.summary),
    '',
    `App commit: \`${context.buildSha}\` · Build: \`${context.buildId}\``,
    `Harness commit: \`${context.harnessSha}\` · Device: ${context.device || 'not started'}`,
    context.otaDisabled
      ? 'Test-only configuration: OTA updates disabled in the installed copy.'
      : 'App preparation did not complete.',
    ...(context.bootstrapRecovery
      ? ['', `Bootstrap limitation: ${clean(context.bootstrapRecovery)}`]
      : []),
    '',
    ...(report.checks || []).map(
      (check) =>
        `- **${check.status}** — ${clean(check.expected)}\n  Observed: ${clean(check.observed)} (evidence: ${check.evidence.join(', ') || 'none'})`
    ),
    '',
    `Agent usage: ${usage.calls} requests, ${usage.tokens} tokens, $${usage.cost.toFixed(4)} reported cost.`,
    'Screenshots, action evidence, and the structured report are in the ios-agent-qa artifact.',
    '',
  ].join('\n');
}

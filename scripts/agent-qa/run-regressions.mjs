import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { regressionCatalog, verifySetupPlan } from './fixtures.mjs';
const plan = verifySetupPlan(JSON.parse(process.env.QA_ASSESSMENT_JSON));
const results = [];
for (const id of new Set(
  plan.scenarios
    .filter((s) => s.method === 'regression')
    .map((s) => s.regression)
)) {
  const recipe = regressionCatalog[id];
  const output = path.join(process.env.PROOF_OUTPUT, `${id}.json`);
  const args = [
    'exec',
    'vitest',
    'run',
    path.relative(recipe.cwd, recipe.file),
    '--reporter=json',
    `--outputFile=${output}`,
  ];
  if (recipe.filter) args.push('-t', recipe.filter);
  const run = spawnSync('pnpm', args, {
    cwd: recipe.cwd,
    encoding: 'utf8',
    timeout: 240000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: '--conditions=tlon-source' },
  });
  writeFileSync(
    path.join(process.env.PROOF_OUTPUT, `${id}.log`),
    (run.stdout || '') + (run.stderr || '')
  );
  let report;
  try {
    report = JSON.parse(readFileSync(output, 'utf8'));
  } catch {}
  const assertions =
    report?.testResults?.flatMap((suite) => suite.assertionResults || []) || [];
  const passedTests = assertions.filter(
    (test) => test.status === 'passed'
  ).length;
  const failedTests = assertions.filter(
    (test) => test.status === 'failed'
  ).length;
  const passed =
    run.status === 0 && passedTests > 0 && report?.numFailedTests === 0;
  results.push({
    id,
    status: passed ? 'passed' : failedTests > 0 ? 'failed' : 'blocked',
    passedTests,
    source: process.env.QA_SOURCE_SHA,
    log: `${id}.log`,
    summary: passed
      ? `${passedTests} real regression tests passed`
      : failedTests > 0
        ? `${failedTests} regression tests failed; see backend job artifacts`
        : 'Regression process failed or produced no passing tests; see backend job artifacts',
  });
  console.log(`${id}: ${results.at(-1).summary}`);
}
writeFileSync(
  path.join(process.env.PROOF_OUTPUT, 'regression-results.json'),
  JSON.stringify(results)
);

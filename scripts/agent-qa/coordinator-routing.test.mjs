import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL('../../.github/workflows/mobile-pr-agent-qa.yml', import.meta.url),
  'utf8'
);
const fallback = workflow.split('  coordinator_failure:\n')[1];
const dependencies = fallback.match(/needs: \[([^\]]+)\]/)[1].split(', ');
const expression = fallback.match(/if: \$\{\{ (.*) \}\}/)[1];
// Evaluate the actual workflow expression against completed job outcomes.
const shouldPublish = new Function('needs', 'always', `return ${expression}`);

test('review waits and enclosing job cover one retry without another worker', () => {
  const source = readFileSync(
    new URL('./cloud-pr.mjs', import.meta.url),
    'utf8'
  );
  const finish = source
    .split("process.argv[2] === 'finish'")[1]
    .split("process.argv[2] === 'run'")[0];
  const waits = [
    ...finish.matchAll(/wait\(env.QA_EAS_RUN_ID, (\d+), false/g),
  ].map((m) => Number(m[1]));
  assert.equal(waits.length, 1);
  assert.ok(waits.every((minutes) => minutes >= 2 * 25 + 20));
  const job = workflow.split('  finish:\n')[1].split('  assessment_report:')[0];
  const limit = Number(job.match(/timeout-minutes: (\d+)/)[1]);
  assert.ok(limit >= waits[0] + 5);
});

test('every coordinator branch publishes failures before EAS dispatch', () => {
  assert.deepEqual(dependencies.sort(), [
    'assess',
    'assessment_report',
    'prepare_build',
    'test',
  ]);
  for (const failed of dependencies) {
    for (const result of ['failure', 'cancelled']) {
      const needs = Object.fromEntries(
        dependencies.map((name) => [
          name,
          { result: name === failed ? result : 'skipped', outputs: {} },
        ])
      );
      assert.equal(
        shouldPublish(needs, () => true),
        true,
        `${failed}: ${result}`
      );
      for (const dispatched of ['test', 'assessment_report']) {
        needs[dispatched].outputs.eas_run_id = 'already-dispatched';
        assert.equal(
          shouldPublish(needs, () => true),
          dispatched === 'assessment_report'
        );
        delete needs[dispatched].outputs.eas_run_id;
      }
    }
  }
  for (const result of ['success', 'skipped']) {
    const needs = Object.fromEntries(
      dependencies.map((name) => [name, { result, outputs: {} }])
    );
    assert.equal(
      shouldPublish(needs, () => true),
      false
    );
  }
});

test('a blocked assessment with a published report needs no fallback', () => {
  const needs = Object.fromEntries(
    dependencies.map((name) => [name, { result: 'skipped', outputs: {} }])
  );
  needs.assessment_report = {
    result: 'failure',
    outputs: { eas_run_id: 'dispatched', report_published: 'true' },
  };
  assert.equal(
    shouldPublish(needs, () => true),
    false
  );
  needs.assessment_report.outputs.report_published = 'false';
  assert.equal(
    shouldPublish(needs, () => true),
    true
  );
});

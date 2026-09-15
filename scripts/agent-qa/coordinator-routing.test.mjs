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

test('review waits and enclosing job cover both attempts and recovery', () => {
  const source = readFileSync(
    new URL('./cloud-pr.mjs', import.meta.url),
    'utf8'
  );
  const finish = source
    .split("process.argv[2] === 'finish'")[1]
    .split("process.argv[2] === 'run'")[0];
  const waits = [...finish.matchAll(/wait\(id, (\d+), false/g)].map((m) =>
    Number(m[1])
  );
  assert.equal(waits.length, 2);
  assert.ok(waits.every((minutes) => minutes >= 2 * 25 + 20));
  const job = workflow.split('  finish:\n')[1].split('  without_fixtures:')[0];
  const limit = Number(job.match(/timeout-minutes: (\d+)/)[1]);
  assert.ok(limit >= waits.reduce((a, b) => a + b, 0) + 15);
});

test('every coordinator branch publishes failures before EAS dispatch', () => {
  assert.deepEqual(dependencies.sort(), [
    'assess',
    'prepare_build',
    'test',
    'without_fixtures',
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
      for (const dispatched of ['test', 'without_fixtures']) {
        needs[dispatched].outputs.eas_run_id = 'already-dispatched';
        assert.equal(
          shouldPublish(needs, () => true),
          false
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

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

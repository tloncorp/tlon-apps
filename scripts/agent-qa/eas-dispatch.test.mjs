import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { inspect } from 'node:util';
import { dispatchWorkflow } from './eas-dispatch.mjs';

test('failed dispatch diagnostics cannot reveal signed recovery artifact inputs', () => {
  const secret =
    'https://wf-artifacts.eascdn.net/recording?signature=private-test';
  const inputs = {
    review_evidence_json: { artifact: { downloadUrl: secret } },
  };
  assert.throws(
    () =>
      dispatchWorkflow(
        (args) =>
          execFileSync(
            process.execPath,
            ['-e', 'process.exit(1)', '--', ...args],
            { stdio: 'pipe' }
          ),
        inputs,
        'trusted-ref'
      ),
    (error) => {
      assert.match(error.message, /request inputs omitted/);
      assert.ok(!inspect(error, { depth: 5 }).includes(secret));
      assert.equal(error.cause, undefined);
      return true;
    }
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('fixture children receive required settings but no inherited credentials, including nested shells', () => {
  const script = fileURLToPath(new URL('./fixture-env.sh', import.meta.url));
  const supplied = {
    ...process.env,
    NGROK_AUTHTOKEN: 'secret-ngrok',
    QA_TUNNEL_TOKEN: 'secret-tunnel',
    EXPO_TOKEN: 'secret-expo',
    GH_TOKEN: 'secret-github',
    FUTURE_API_KEY: 'secret-future',
    PROOF_OUTPUT: '/tmp/output with spaces',
    QA_FIXTURE_PLAN: '{"fixtures":["chat-v1"]}',
    MAESTRO_RUN_TAG: 'fixture-test',
    SKIP_TESTS: 'true',
    NODE_OPTIONS: '--conditions=tlon-source',
  };
  const result = JSON.parse(
    execFileSync(
      'bash',
      [
        script,
        'bash',
        script,
        process.execPath,
        '-e',
        'console.log(JSON.stringify(process.env))',
      ],
      { env: supplied, encoding: 'utf8' }
    )
  );
  for (const key of [
    'NGROK_AUTHTOKEN',
    'QA_TUNNEL_TOKEN',
    'EXPO_TOKEN',
    'GH_TOKEN',
    'FUTURE_API_KEY',
  ])
    assert.equal(result[key], undefined, key);
  for (const key of [
    'PROOF_OUTPUT',
    'QA_FIXTURE_PLAN',
    'MAESTRO_RUN_TAG',
    'SKIP_TESTS',
    'NODE_OPTIONS',
  ])
    assert.equal(result[key], supplied[key], key);
});

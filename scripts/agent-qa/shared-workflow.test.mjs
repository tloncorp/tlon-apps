import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { qaResult } from '../../.agents/skills/tlon-workflow/qa-result.mjs';

const comment = (run, kind = 'report') => ({
  id: 42,
  user: { login: 'publisher' },
  created_at: '2026-01-01',
  updated_at: '2026-01-02',
  html_url: 'https://github.com/tloncorp/tlon-apps/pull/1#issuecomment-42',
  body:
    '<!-- ios-agent-qa:pr-1 -->\n<!-- ios-agent-qa-state:' +
    Buffer.from(
      JSON.stringify({
        current: {
          head: 'a'.repeat(40),
          kind,
          url: `https://expo.dev/accounts/tlon/projects/groups/workflows/${run}`,
        },
      })
    ).toString('base64') +
    ' -->',
});
test('watcher surfaces a new run in an edited comment once, without treating it as a human review', () => {
  const first = comment('11111111-1111-1111-1111-111111111111');
  const second = comment('22222222-2222-2222-2222-222222222222');
  assert.equal(qaResult(first).kind, 'qa-result');
  assert.equal(
    qaResult(first).id,
    qaResult({ ...first, updated_at: '2026-01-03' }).id
  );
  assert.notEqual(qaResult(first).id, qaResult(second).id);
  assert.notEqual(
    qaResult(first).id,
    qaResult(comment('11111111-1111-1111-1111-111111111111', 'blocked')).id
  );
  const skipped = comment('11111111-1111-1111-1111-111111111111', 'blocked');
  skipped.body +=
    '\n**PR assessment: no user-facing changes — simulator skipped**';
  assert.equal(qaResult(skipped).status, 'skipped');
  assert.equal(qaResult({ body: 'Normal review' }), undefined);
  assert.equal(
    qaResult({ body: '<!-- ios-agent-qa:pr-1 --> broken state' }),
    null
  );
});

test('shared login supports runtime credentials and the existing prefilled path without exposing credentials', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tlon-login-test-'));
  const script = new URL(
    '../../.agents/skills/tlon-workflow/mobile-login.mjs',
    import.meta.url
  );
  const url = 'http://127.0.0.1:1234',
    code = 'synthetic-test-code';
  writeFileSync(
    path.join(dir, 'agent-device'),
    `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2), p = process.env.LOGIN_TEST_LOG;
fs.appendFileSync(p, JSON.stringify(args)+'\\n');
if (process.env.LOGIN_TEST_FAIL && args[0] === 'fill') { console.error(args.join(' ')); process.exit(1); }
if (process.env.LOGIN_TEST_SYSTEM_SHEET && args[0] === 'wait' && args[2] === 'Usage Statistics' && !fs.existsSync(p+'.dismissed')) { console.error('regular iOS snapshot presentation requires a valid viewport: com.apple.SafariViewService'); process.exit(1); }
if (args[0] === 'alert' && args[1] === 'dismiss') fs.writeFileSync(p+'.dismissed','yes');
if (args[0] === 'press' && args[1] === 'text="Next"') fs.writeFileSync(p+'.home','yes');
if (args[0] === 'find') process.exit(args[1] === 'text="Home"' && fs.existsSync(p+'.home') ? 0 : 1);
`,
    { mode: 0o755 }
  );
  try {
    for (const runtime of [false, true]) {
      const log = path.join(dir, runtime ? 'runtime.log' : 'prefill.log');
      const env = {
        PATH: `${dir}:${process.env.PATH}`,
        HOME: dir,
        LOGIN_TEST_LOG: log,
        ...(runtime
          ? {
              TLON_LOGIN_URL: url,
              TLON_LOGIN_CODE: code,
              LOGIN_TEST_SYSTEM_SHEET: 'yes',
            }
          : {}),
      };
      const output = execFileSync(
        process.execPath,
        [
          script.pathname,
          '--platform',
          'ios',
          '--udid',
          'test-udid',
          '--session',
          'test',
        ],
        { env, encoding: 'utf8' }
      );
      assert.match(output, /signed in/);
      assert.ok(!output.includes(code));
      const commands = readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map(JSON.parse);
      const fills = commands.filter((args) => args[0] === 'fill');
      assert.equal(fills.length, runtime ? 2 : 0);
      if (runtime) {
        const wait = commands.findIndex(
          (args) => args[0] === 'wait' && args[2] === 'Usage Statistics'
        );
        assert.deepEqual(commands[wait + 1].slice(0, 2), ['alert', 'dismiss']);
        assert.deepEqual(commands[wait + 2], commands[wait]);
        assert.deepEqual(
          fills.map((args) => args[2]),
          [url, code]
        );
        assert.ok(fills.every((args) => args.includes('--no-record')));
        const failure = spawnSync(
          process.execPath,
          [
            script.pathname,
            '--platform',
            'ios',
            '--udid',
            'test-udid',
            '--session',
            'failure',
          ],
          {
            env: {
              ...env,
              LOGIN_TEST_LOG: path.join(dir, 'failure.log'),
              LOGIN_TEST_FAIL: 'yes',
            },
            encoding: 'utf8',
          }
        );
        assert.equal(failure.status, 1);
        assert.ok(
          !failure.stderr.includes(url) && !failure.stderr.includes(code)
        );
        assert.match(failure.stderr, /redacted/);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

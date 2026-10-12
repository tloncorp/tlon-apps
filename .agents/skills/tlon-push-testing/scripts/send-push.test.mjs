import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildPayload, validatePayload } from './send-push.mjs';

const script = fileURLToPath(new URL('./send-push.mjs', import.meta.url));
const cli = (...args) =>
  spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('preview needs no simulator and produces valid APNs JSON', () => {
  const result = cli('--scenario', 'dm-post', '--channel-id', '~zod');
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.channelId, '~zod');
  assert.equal(payload.aps['thread-id'], '~zod');
  assert.equal(payload.aps['mutable-content'], undefined);
  assert.equal(payload.uid, undefined);
});

test('missing IDs and placeholders fail before sending', () => {
  for (const args of [
    ['--scenario', 'dm-post'],
    ['--scenario', 'dm-post', '--channel-id', '<CONVERSATION_ID>'],
    ['--scenario', 'dm-reply', '--channel-id', '~zod'],
    ['--scenario', 'note-create', '--channel-id', 'notes/~zod/journal'],
    ['--scenario', 'group-kick', '--group-id', '~zod/test'],
    ['--scenario', 'native-notify'],
    ['--scenario', 'dismiss'],
  ])
    assert.notEqual(cli(...args).status, 0, args.join(' '));
});

test('live injection requires an explicit simulator and bundle', () => {
  for (const args of [
    [],
    ['--simulator', 'booted', '--bundle-id', 'io.tlon.groups'],
    ['--simulator', '00000000-0000-0000-0000-000000000001'],
  ])
    assert.notEqual(cli('--scenario', 'message', '--send', ...args).status, 0);
});

test('invalid post IDs, counts and oversized UTF-8 alerts are rejected', () => {
  assert.throws(
    () =>
      buildPayload({
        scenario: 'dm-reply',
        'channel-id': '~zod',
        'parent-id': '12345',
      }),
    /wire post ID/
  );
  assert.throws(
    () => buildPayload({ scenario: 'message', badge: '-1' }),
    /nonnegative/
  );
  assert.throws(
    () => validatePayload({ aps: { alert: '🎉'.repeat(1100) } }),
    /4096/
  );
  assert.throws(() => validatePayload({ aps: [] }), /aps object/);
});

test('dismissal has no alert and preserves native ordering fields', () => {
  const payload = buildPayload({
    scenario: 'dismiss',
    uid: '0v2',
    'notification-id': '123',
    'dismiss-source': '~zod',
    'notify-count': '0',
  });
  assert.deepEqual(payload.aps, { 'content-available': 1 });
  assert.equal(payload.notifyCount, '0');
  assert.equal(payload.id, '123');
  assert.equal(payload.dismissSource, '~zod');
});

test('ambiguous or irrelevant inputs cannot silently change the test', () => {
  for (const args of [
    ['--scenario', 'message', '--scenario', 'dm-post', '--channel-id', '~zod'],
    ['--scenario', 'dm-post', '--channel-id', '~zod', '--channel-id', '~nec'],
    [
      '--scenario',
      'message',
      '--bundle-id',
      'io.tlon.groups',
      '--bundle-id',
      'io.tlon.groups.preview',
    ],
    [
      '--scenario',
      'dm-post',
      '--channel-id',
      '~zod',
      '--parent-id',
      '~zod/123',
    ],
    ['--scenario', 'contact', '--contact-id', 'A display name'],
  ])
    assert.notEqual(cli(...args).status, 0, args.join(' '));
  const directory = mkdtempSync(join(tmpdir(), 'tlon-push-target-'));
  try {
    const file = join(directory, 'preview.apns');
    const built = cli(
      '--scenario',
      'dm-post',
      '--channel-id',
      '~zod',
      '--bundle-id',
      'io.tlon.groups.preview',
      '--out',
      file
    );
    assert.equal(built.status, 0, built.stderr);
    assert.equal(
      JSON.parse(readFileSync(file, 'utf8'))['Simulator Target Bundle'],
      'io.tlon.groups.preview'
    );
    assert.notEqual(
      cli('--payload-file', file, '--channel-id', '~nec').status,
      0
    );
    assert.notEqual(
      cli('--payload-file', file, '--bundle-id', 'io.tlon.groups').status,
      0
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('device preflight checks state, installation and bundle before one stdin push', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tlon-push-preflight-'));
  const simulator = '00000000-0000-0000-0000-000000000001';
  const log = join(directory, 'calls.jsonl');
  try {
    writeFileSync(
      join(directory, 'xcrun'),
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_PUSH_LOG, JSON.stringify(args) + '\\n');
if (args[1] === 'list') console.log(JSON.stringify({devices:{ios:[{udid:'${simulator}',name:'Test phone',state:process.env.TEST_PUSH_STATE}]}}));
else if (args[1] === 'get_app_container') process.exit(process.env.TEST_PUSH_INSTALLED === 'yes' ? 0 : 1);
else if (args[1] === 'push') fs.writeFileSync(process.env.TEST_PUSH_BODY, fs.readFileSync(0));
else process.exit(1);
`,
      { mode: 0o755 }
    );
    const run = (state, installed = 'yes', more = []) => {
      writeFileSync(log, '');
      return spawnSync(
        process.execPath,
        [
          script,
          '--scenario',
          'message',
          '--send',
          '--simulator',
          simulator,
          '--bundle-id',
          'io.tlon.groups.preview',
          ...more,
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            TEST_PUSH_LOG: log,
            TEST_PUSH_BODY: join(directory, 'body.json'),
            TEST_PUSH_STATE: state,
            TEST_PUSH_INSTALLED: installed,
          },
        }
      );
    };
    assert.notEqual(run('Shutdown').status, 0);
    assert.equal(readFileSync(log, 'utf8').includes('"push"'), false);
    assert.notEqual(run('Booted', 'no').status, 0);
    assert.equal(readFileSync(log, 'utf8').includes('"push"'), false);
    const result = run('Booted');
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(calls.at(-1), [
      'simctl',
      'push',
      simulator,
      'io.tlon.groups.preview',
      '-',
    ]);
    assert.equal(calls.filter((args) => args[1] === 'push').length, 1);
    assert.equal(
      JSON.parse(readFileSync(join(directory, 'body.json'), 'utf8')).action,
      'message'
    );
    const raw = join(directory, 'conflict.json');
    writeFileSync(
      raw,
      JSON.stringify({
        aps: { alert: 'Test' },
        'Simulator Target Bundle': 'io.tlon.groups',
      })
    );
    const conflict = cli(
      '--payload-file',
      raw,
      '--send',
      '--simulator',
      simulator,
      '--bundle-id',
      'io.tlon.groups.preview'
    );
    assert.notEqual(conflict.status, 0);
    assert.match(conflict.stderr, /conflicts/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

#!/usr/bin/env node
// Signs the app in on a simulator or emulator, so a reproduction starts on
// Home instead of on the onboarding screens.
//
//   node <worktree>/.agents/skills/tlon-workflow/mobile-login.mjs \
//     --platform ios --udid <udid> --session ios-1234-1435
//
// Opens the agent-device session and leaves it open for the rest of the run.
// Local builds can prefill DEFAULT_SHIP_LOGIN_URL / DEFAULT_SHIP_LOGIN_ACCESS_CODE.
// Hosted QA supplies TLON_LOGIN_URL / TLON_LOGIN_CODE at runtime instead.
// These are read only by the login process, never by the testing agent.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

function usage(message) {
  console.error(`mobile-login: ${message}
usage: node <worktree>/.agents/skills/tlon-workflow/mobile-login.mjs --platform <ios|android> --session <name> [options]
  --platform <p>   ios or android
  --session <name> the agent-device session to open, e.g. ios-1234-1435
  --udid <udid>    the simulator, for ios (from stim status)
  --serial <s>     the emulator, for android (from stim status)
  --app <id>       app id (default io.tlon.groups)`);
  process.exit(2);
}

let values;
try {
  ({ values } = parseArgs({
    options: {
      platform: { type: 'string' },
      session: { type: 'string' },
      udid: { type: 'string' },
      serial: { type: 'string' },
      app: { type: 'string' },
    },
  }));
} catch (err) {
  usage(err.message.replace(/^Error: /, ''));
}

const loginUrl = process.env.TLON_LOGIN_URL;
const loginCode = process.env.TLON_LOGIN_CODE;
if (Boolean(loginUrl) !== Boolean(loginCode))
  usage('Set both TLON_LOGIN_URL and TLON_LOGIN_CODE');
const redact = (text) =>
  [loginUrl, loginCode]
    .filter(Boolean)
    .reduce((s, v) => s.replaceAll(v, '[redacted]'), text);

const platform = values.platform;
const session = values.session;
const app = values.app ?? 'io.tlon.groups';
if (platform !== 'ios' && platform !== 'android') {
  usage('--platform takes ios or android');
}
if (!session) usage('--session is required');
const device = platform === 'ios' ? values.udid : values.serial;
if (!device) {
  usage(
    `--${platform === 'ios' ? 'udid' : 'serial'} is required; stim status prints it`
  );
}

function device_(
  args,
  { allowFailure = false, retryPasswordSheet = true } = {}
) {
  const r = spawnSync('agent-device', args, { encoding: 'utf8' });
  if (r.error) usage(`agent-device did not run (${r.error.message})`);
  const out = redact(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  if (
    r.status !== 0 &&
    retryPasswordSheet &&
    platform === 'ios' &&
    args[0] === 'wait' &&
    args[2] === 'Usage Statistics' &&
    /Save Password\?|com\.apple\.SafariViewService|system web sign-in sheet/.test(
      out
    )
  ) {
    // Save Password can arrive after Connect's immediate check. Its native
    // accessibility tree has no reliable viewport in agent-device's regular
    // projection; raw selectors can still target the actual Not Now button.
    console.log(`${session}: dismissing the iOS password sheet`);
    device_([
      'press',
      'role="button" text="Not Now"',
      ...S,
      '--raw',
      '--settle',
    ]);
    return device_(args, { allowFailure, retryPasswordSheet: false });
  }
  if (r.status !== 0 && !allowFailure) {
    console.error(
      `mobile-login: ${redact(args.slice(0, 3).join(' '))} failed\n${out.trim()}`
    );
    process.exit(1);
  }
  return { ok: r.status === 0, out };
}

const S = ['--session', session, '--no-record'];
const onScreen = (text) =>
  device_(['find', `text="${text}"`, ...S], { allowFailure: true }).ok;

device_([
  'open',
  app,
  '--platform',
  platform,
  platform === 'ios' ? '--udid' : '--serial',
  device,
  '--foreground',
  ...S,
]);

// Already signed in: onboarding is gone and Home is up.
if (onScreen('Home')) {
  console.log(`${session}: already signed in`);
  process.exit(0);
}

// Each screen takes a moment, and --settle only waits for the current one, so
// every press waits for the next screen's text first.
const steps = [
  ['Have an account? Log in', 'Or configure self hosted'],
  ['Or configure self hosted', 'Ship URL'],
  ['Connect', 'Usage Statistics'],
  ['Next', null],
];
for (const [press, next] of steps) {
  console.log(`${session}: login step ${press}`);
  if (press === 'Connect' && loginUrl) {
    device_(['fill', 'id="textInput shipUrl"', loginUrl, ...S, '--settle']);
    device_(['fill', 'id="textInput accessCode"', loginCode, ...S, '--settle']);
  }
  device_(['press', `text="${press}"`, ...S, '--settle']);
  if (press === 'Connect') {
    // Password-manager prompts and skipped analytics vary by build/account.
    if (onScreen('Save Password?'))
      device_([
        'press',
        'role="button" text="Not Now"',
        ...S,
        '--raw',
        '--settle',
      ]);
    if (onScreen('Home')) break;
  }
  if (next) device_(['wait', 'text', next, ...S]);
}

// The notifications prompt can arrive after the press returns, and on Android
// after `alert dismiss` would already have run.
device_(['wait', '3000', ...S], { allowFailure: true });
device_(['alert', 'dismiss', ...S], { allowFailure: true });
// The "Stay in the loop" sheet comes later, over Home.
if (onScreen('Not now')) device_(['press', 'text="Not now"', ...S, '--settle']);

// A fresh disposable ship can still be completing its first sync after the
// prompts are gone. Wait for the destination instead of assuming three seconds.
device_(['wait', 'text', 'Home', '60000', ...S]);
console.log(`${session}: signed in`);

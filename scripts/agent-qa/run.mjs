import { mkdirSync, readFileSync, cpSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  root,
  out,
  json,
  save,
  commandAsync,
  model,
  verifySource,
} from './common.mjs';
import { connectShip } from './ship-proxy.mjs';
const pr = JSON.parse(process.env.QA_PR_JSON);
const session = 'hosted-pr-qa';
let ship, udid, stopRecording;
async function record(udid) {
  const child = spawn(
    'xcrun',
    ['simctl', 'io', udid, 'recordVideo', '--codec=h264', recording],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  const closed = new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }));
    child.once('close', (code) => resolve({ code }));
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGINT');
      reject(new Error('Recorder did not start'));
    }, 30000);
    child.stderr.on('data', (chunk) => {
      appendFileSync(path.join(out, 'recording.log'), chunk);
      if (String(chunk).includes('Recording started')) {
        clearTimeout(timer);
        resolve();
      }
    });
    closed.then(() => {
      clearTimeout(timer);
      reject(new Error('Recorder stopped before capture'));
    });
  });
  return async () => {
    child.kill('SIGINT');
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    const result = await closed;
    clearTimeout(timer);
    if (result.error || result.code !== 0)
      throw new Error('Recorder could not finalize the video');
  };
}
const device = async (args) =>
  await commandAsync('agent-device', [...args, '--session', session]);
const recording = path.join(out, 'session.mp4');
const result = {
  buildId: process.env.QA_BUILD_ID,
  buildSha: process.env.QA_BUILD_SHA,
  status: 'incomplete',
  summary: 'Simulator setup did not finish',
  pr,
  runUrl: process.env.QA_WORKFLOW_URL,
};
mkdirSync(out, { recursive: true });
try {
  await commandAsync('git', [
    'fetch',
    '--no-tags',
    '--depth=1',
    'origin',
    pr.head.sha,
    process.env.QA_BUILD_SHA,
  ]);
  verifySource(pr.head.sha);
  verifySource(pr.head.sha, process.env.QA_BUILD_SHA);
  ship = await connectShip();
  const inventory = JSON.parse(
    await commandAsync('xcrun', ['simctl', 'list', '--json'])
  );
  const runtime = inventory.runtimes
    .filter((r) => r.isAvailable && r.identifier.includes('.iOS-'))
    .at(-1);
  const type =
    inventory.devicetypes.find((d) => d.name === 'iPhone 17 Pro') ||
    inventory.devicetypes.find((d) => d.name.startsWith('iPhone'));
  if (!runtime || !type) throw new Error('No iOS simulator available');
  udid = await commandAsync('xcrun', [
    'simctl',
    'create',
    'tlon-pr-qa',
    type.identifier,
    runtime.identifier,
  ]);
  const app = path.join(process.env.TMPDIR || '/tmp', 'qa.app');
  cpSync(process.argv[2], app, { recursive: true });
  if (
    (await commandAsync('/usr/libexec/PlistBuddy', [
      '-c',
      'Print :CFBundleIdentifier',
      path.join(app, 'Info.plist'),
    ])) !== 'io.tlon.groups'
  )
    throw new Error('Wrong simulator app');
  // Keep the selected build's JS; an OTA update must not replace the PR.
  await commandAsync('python3', [
    '-c',
    'import plistlib,sys,pathlib; p=pathlib.Path(sys.argv[1]); d=plistlib.loads(p.read_bytes()) if p.exists() else {}; d["EXUpdatesEnabled"]=False; p.write_bytes(plistlib.dumps(d))',
    path.join(app, 'Expo.plist'),
  ]);
  await commandAsync('codesign', ['--force', '--deep', '--sign', '-', app]);
  await device(['boot', '--platform', 'ios', '--udid', udid]);
  await commandAsync('xcrun', ['simctl', 'install', udid, app]);
  await commandAsync(
    'agent-device',
    [
      'prepare',
      'ios-runner',
      '--session',
      session,
      '--platform',
      'ios',
      '--udid',
      udid,
      '--timeout',
      '180000',
    ],
    { timeout: 240000 }
  );
  await commandAsync(
    process.execPath,
    [
      path.join(root, '.agents/skills/tlon-workflow/mobile-login.mjs'),
      '--platform',
      'ios',
      '--udid',
      udid,
      '--session',
      session,
      '--app',
      'io.tlon.groups',
    ],
    {
      timeout: 240000,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        TLON_LOGIN_URL: 'http://127.0.0.1:49378',
        TLON_LOGIN_CODE: json(
          path.join(root, 'apps/tlon-web/e2e/shipManifest.json')
        )['~zod'].code,
      },
    }
  );
  stopRecording = await record(udid);
  try {
    const guidance = readFileSync(
      path.join(root, '.agents/skills/tlon-workflow/references/pr-reviewer.md'),
      'utf8'
    );
    const navigation = readFileSync(
      path.join(
        root,
        '.agents/skills/tlon-workflow/references/driving-the-app.md'
      ),
      'utf8'
    );
    await model(
      'operator',
      `${guidance}\n${navigation}\nExplore this implemented PR on iOS. Use only session ${session}, UDID ${udid}, app io.tlon.groups. Login and full-session recording are already running; do not stop recording, open another app/session, or change credentials. You may background/reopen this app. Create ordinary test data through the UI on disposable ~zod. Peer chat: ${JSON.stringify(ship.ready.group)}.
PR: ${JSON.stringify(pr)}\nStarting context: ${process.env.QA_ASSESSMENT_JSON}
Inspect the whole screen, follow suspicious behavior, and report what you actually exercised, observed, and could not reach. Use screenshots around triggers/outcomes. Do not fix code or infer a regression. Finish within nine minutes; write concise notes for an independent reviewer.`,
      {
        device: {
          AGENT_DEVICE_SESSION: session,
          AGENT_DEVICE_PLATFORM: 'ios',
          AGENT_DEVICE_UDID: udid,
        },
        minutes: 9,
      }
    );
  } catch (error) {
    save(path.join(out, 'operator-interruption.txt'), error.message);
  }
  await stopRecording();
  stopRecording = null;
  const duration = Number(
    await commandAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      recording,
    ])
  );
  if (!(duration > 0)) throw new Error('Recording is empty');
  result.status = 'recorded';
  result.duration = duration;
  result.summary = 'Awaiting independent recording review';
} catch (error) {
  result.summary = error.message;
} finally {
  if (stopRecording) {
    try {
      await stopRecording();
    } catch {}
  }
  if (udid) {
    try {
      await device(['close']);
      await commandAsync('xcrun', ['simctl', 'shutdown', udid]);
    } catch {}
  }
  ship?.close();
  save(path.join(out, 'result.json'), result);
}

import { billingSummary } from './billing.mjs';
import { runCodex, verifyCodexAuth, interruptedResult } from './codex.mjs';
import { verifySourceOverlay } from './assess.mjs';
import { connectShips } from './ship-proxy.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  redact,
  renderReport,
  verifyContext,
  verifyReport,
  verifyVideo,
  appendInfrastructureFailure,
  accountForRecordingCap,
} from './core.mjs';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const artifacts = path.join(root, 'artifacts/agent-qa');
const env = {
  ...process.env,
  QA_TEST_SHIP: process.env.QA_TEST_SHIP || process.env.MAESTRO_TEST_SHIP,
};
const secrets = [env.OPENROUTER_API_KEY, env.QA_TUNNEL_TOKEN, env.GH_QA_TOKEN];
const clean = (text) => redact(text, secrets);
const usage = { calls: 0, tokens: 0, cost: null };
const evidence = new Map();
let context = {
  mode: 'Setup',
  buildSha: env.QA_BUILD_SHA,
  buildId: env.QA_BUILD_ID,
};
let report;
let ships;
let shipCode;
let udid;
let recordingStarted;
let recordingAttempted = false;
let recordingTimer;
let recordingStop;
let finalization;
const agentAbort = new AbortController();
let rawVideo;
const videoDirectory = path.join(root, 'artifacts/agent-qa-video');

// Device subprocesses receive no model, backend, build, or GitHub credentials.
const deviceEnv = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'DEVELOPER_DIR', 'LANG']
    .filter((key) => env[key])
    .map((key) => [key, env[key]])
);
deviceEnv.CI = '1';
deviceEnv.AGENT_DEVICE_SESSION = 'hosted-pr-qa';
deviceEnv.AGENT_DEVICE_PLATFORM = 'ios';
deviceEnv.AGENT_DEVICE_STATE_DIR = path.join(
  env.TMPDIR || '/tmp',
  'qa-agent-device'
);

async function run(command, args, options = {}) {
  try {
    const result = await exec(command, args, {
      cwd: root,
      env: deviceEnv,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
      ...options,
    });
    return result.stdout;
  } catch (error) {
    const operation = path.basename(command);
    await writeFile(
      path.join(artifacts, `${operation}-error.txt`),
      clean(`${error.stdout || ''}\n${error.stderr || ''}`).slice(-16000),
      { flag: 'wx' }
    ).catch((writeError) => {
      // Cleanup may fail after setup does; retain the original cause.
      if (writeError.code !== 'EEXIST') throw writeError;
    });
    throw new Error(
      `${operation} failed (${error.code || error.signal || 'timeout'})`
    );
  }
}

function device(args, timeout = 60_000) {
  return run(
    'agent-device',
    [...args, '--session', deviceEnv.AGENT_DEVICE_SESSION],
    { timeout }
  );
}

async function startRecording() {
  // Bootstrap has already completed: never capture credential entry.
  context.video = { status: 'recording' };
  recordingAttempted = true;
  rawVideo = path.join(env.TMPDIR || '/tmp', 'qa-test-session.mp4');
  // Capture the whole simulator. We normalize the video below, so skip the
  // device tool's extra Swift touch-overlay export (slow on a cold CI host).
  await device([
    'record',
    'start',
    rawVideo,
    '--scope',
    'device',
    '--quality',
    'high',
    '--hide-touches',
  ]);
  recordingStarted = Date.now();
  console.log('Recording the authenticated agent test session.');
  // Independent cap also stops capture if the agent loop gets stuck.
  recordingTimer = setTimeout(() => {
    void stopRecording(true);
  }, 10 * 60_000);
}

function stopRecording(capped = false) {
  if (!recordingAttempted) return Promise.resolve();
  return (recordingStop ??= (async () => {
    clearTimeout(recordingTimer);
    const elapsedSeconds = recordingStarted
      ? (Date.now() - recordingStarted) / 1000
      : 0;
    try {
      await device(['record', 'stop'], 120_000);
      await mkdir(videoDirectory, { recursive: true });
      const file = path.join(videoDirectory, 'test-session.mp4');
      // Decode the entire recording and produce browser-compatible, seekable H.264.
      await run(
        'ffmpeg',
        [
          '-v',
          'error',
          '-xerror',
          '-y',
          '-i',
          rawVideo,
          '-vf',
          'scale=-2:1280',
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '24',
          '-pix_fmt',
          'yuv420p',
          '-an',
          '-movflags',
          '+faststart',
          file,
        ],
        { timeout: 180_000 }
      );
      const probe = JSON.parse(
        await run('ffprobe', [
          '-v',
          'error',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          file,
        ])
      );
      context.video = {
        status: 'ready',
        file: 'test-session.mp4',
        startedAt: recordingStarted,
        ...verifyVideo(probe, elapsedSeconds),
        capped,
      };
      console.log(
        `Test video finalized: ${context.video.durationSeconds.toFixed(1)} seconds.`
      );
    } catch (error) {
      context.video = {
        ...context.video,
        status: 'unavailable',
        error: clean(error.message),
      };
    }
  })());
}

async function capture(args = [], screenshot = false) {
  const id = `e${evidence.size + 1}`;
  const filename = `${id}.${screenshot ? 'png' : 'txt'}`;
  if (screenshot) {
    await device([
      'screenshot',
      path.join(artifacts, filename),
      '--pixel-density',
      '2',
    ]);
    const bytes = await readFile(path.join(artifacts, filename));
    if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
      throw new Error('agent-device did not produce a PNG screenshot');
  } else {
    await writeFile(
      path.join(artifacts, filename),
      clean(await device(['snapshot']))
    );
  }
  evidence.set(id, {
    file: filename,
    screenshot,
    command: screenshot ? 'screenshot' : 'snapshot',
    at: new Date().toISOString(),
  });
  return id;
}

async function hashBundle(directory) {
  const hash = createHash('sha256');
  async function visit(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) {
        hash.update(path.relative(directory, full));
        hash.update(await readFile(full));
      }
    }
  }
  await visit(directory);
  return hash.digest('hex');
}

async function prepare() {
  const harnessSha = (await run('git', ['rev-parse', 'HEAD'])).trim();
  context = verifyContext(env, harnessSha);
  if (context.sourceOverlay) {
    verifySourceOverlay(context.pr.head.sha);
    // Reused builds must independently contain the same PR product source.
    verifySourceOverlay(context.pr.head.sha, context.buildSha);
    if (
      env.QA_EXPECTED_BUILD_ID &&
      context.buildId !== env.QA_EXPECTED_BUILD_ID
    )
      throw new Error('EAS resolved a different build than requested');
  }
  if (!env.QA_SHIP_URL || !env.OPENROUTER_API_KEY)
    throw new Error(
      'Hosted QA needs OPENROUTER_API_KEY and a disposable backend URL'
    );
  // Check authentication before paying for simulator/driver setup.
  await verifyCodexAuth(env.OPENROUTER_API_KEY);
  context.agent = {
    runtime: 'Codex CLI 0.145.0',
    model: 'openai/gpt-5.6-sol',
    provider: 'OpenRouter Responses API',
    reasoning: 'high',
    deviceTools: 'agent-device 0.21.5',
  };
  if (env.QA_SHIP_URL) {
    if (context.testShip !== '~zod')
      throw new Error('Disposable backend requires ~zod');
    if (env.QA_MODE === 'pull_request')
      verifySourceOverlay(context.pr.head.sha, env.QA_BACKEND_SHA);
    ships = await connectShips(env);
    context.backend = ships.ready;
    const manifest = JSON.parse(
      await readFile(
        path.join(root, 'apps/tlon-web/e2e/shipManifest.json'),
        'utf8'
      )
    );
    shipCode = manifest['~zod'].code;
    secrets.push(shipCode);
  }
  let diff = '';
  if (context.pr) {
    const base = context.pr.base.sha;
    if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Missing PR base commit');
    await run('git', [
      'fetch',
      '--no-tags',
      '--deepen=256',
      'origin',
      base,
      harnessSha,
    ]);
    diff = await run('git', [
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--unified=3',
      `${base}...${context.pr.head.sha}`,
    ]);
    if (!diff.trim()) throw new Error('No product diff to explore');
    if (diff.length > 240_000)
      throw new Error(
        'Mobile diff exceeds the agent context budget; split or narrow this PR'
      );
  }
  const original = path.resolve(process.argv[2] || env.QA_APP_PATH || '');
  console.log(`Preparing EAS artifact: ${original}`);
  if (!original.endsWith('.app'))
    throw new Error('Expected an extracted iOS Simulator .app artifact');
  const bundleId = (
    await run('/usr/libexec/PlistBuddy', [
      '-c',
      'Print :CFBundleIdentifier',
      path.join(original, 'Info.plist'),
    ])
  ).trim();
  if (bundleId !== context.appId)
    throw new Error(
      'Downloaded application ID does not match the EAS build record'
    );
  context.originalBundleSha256 = await hashBundle(original);
  const appCopy = path.join(env.TMPDIR || '/tmp', 'tlon-agent-qa.app');
  await cp(original, appCopy, { recursive: true });
  // Prevent an OTA download from replacing the PR's embedded JS during testing.
  // This test-only plist change is recorded with before/after bundle hashes.
  await run('python3', [
    '-c',
    'import plistlib,sys,pathlib; p=pathlib.Path(sys.argv[1]); d=plistlib.loads(p.read_bytes()) if p.exists() else {}; d["EXUpdatesEnabled"]=False; p.write_bytes(plistlib.dumps(d))',
    path.join(appCopy, 'Expo.plist'),
  ]);
  await run('codesign', ['--force', '--deep', '--sign', '-', appCopy]);
  context.installedBundleSha256 = await hashBundle(appCopy);
  context.otaDisabled = true;
  console.log(
    'Verified application ID and recorded original/installed bundle hashes.'
  );

  const inventory = JSON.parse(
    await run('xcrun', ['simctl', 'list', '--json'])
  );
  const runtime = inventory.runtimes
    .filter((item) => item.isAvailable && item.identifier.includes('.iOS-'))
    .sort((a, b) =>
      b.version.localeCompare(a.version, undefined, { numeric: true })
    )[0];
  const type =
    inventory.devicetypes
      .filter((item) => item.name.startsWith('iPhone'))
      .find((item) => item.name === 'iPhone 17 Pro') ||
    inventory.devicetypes.find((item) => item.name.startsWith('iPhone'));
  if (!runtime || !type)
    throw new Error('Hosted runner has no available iOS runtime/device');
  udid = (
    await run('xcrun', [
      'simctl',
      'create',
      'tlon-pr-qa',
      type.identifier,
      runtime.identifier,
    ])
  ).trim();
  context.device = `${type.name}, iOS ${runtime.version}, ${udid}`;
  console.log(`Selected simulator: ${context.device}`);
  // Existing-build qualification is not a native compilation. The downloaded
  // artifact and the explicit simulator remain owned by this CI wrapper.
  deviceEnv.AGENT_DEVICE_UDID = udid;
  console.log('Booting the selected simulator.');
  await device(['boot', '--platform', 'ios', '--udid', udid], 180_000);
  console.log('Simulator booted; installing the verified app.');
  await run('xcrun', ['simctl', 'install', udid, appCopy], {
    timeout: 180_000,
  });
  console.log('Preparing the agent-device XCTest helper for this CI host.');
  await device(
    [
      'prepare',
      'ios-runner',
      '--platform',
      'ios',
      '--udid',
      udid,
      '--timeout',
      '180000',
    ],
    240_000
  );

  if (!ships || !shipCode)
    throw new Error('Hosted QA requires disposable ship credentials');
  console.log('App installed; starting shared login.');
  await run(
    process.execPath,
    [
      path.join(root, '.agents/skills/tlon-workflow/mobile-login.mjs'),
      '--platform',
      'ios',
      '--udid',
      udid,
      '--session',
      deviceEnv.AGENT_DEVICE_SESSION,
      '--app',
      context.appId,
    ],
    {
      timeout: 240_000,
      env: {
        ...deviceEnv,
        TLON_LOGIN_URL: ships.url,
        TLON_LOGIN_CODE: shipCode,
      },
    }
  );
  context.smoke =
    'Signed in through tlon-workflow/mobile-login.mjs to the isolated backend.';
  console.log(context.smoke);
  await capture();
  await capture([], true);
  return diff;
}

async function agent(diff) {
  evidence.set('codex-trace', {
    file: 'codex-events.jsonl',
    screenshot: false,
    command: 'codex exec',
  });
  let result = await runCodex({
    env,
    deviceEnv,
    artifacts,
    context,
    udid,
    diff,
    clean,
    usage,
    signal: agentAbort.signal,
  }).catch((error) => {
    if (!context.assessment || agentAbort.signal.aborted) throw error;
    context.operatorInterruption = clean(error.message);
    console.log(
      `Operator interrupted; reviewing saved evidence: ${context.operatorInterruption}`
    );
    return interruptedResult(context.assessment, context.operatorInterruption);
  });
  await writeFile(
    path.join(artifacts, 'agent-result.json'),
    clean(JSON.stringify(result))
  );
  // Preserve completed results if the app crashes during the final captures.
  report = result;
  context.evidenceReview = 'pending';
  await capture();
  await capture([], true);
  await stopRecording();
  const counts = { passed: 0, failed: 0, blocked: 0 };
  for (const check of result.checks) counts[check.status]++;
  result.summary = `${counts.passed} checks passed; ${counts.failed} failed; ${counts.blocked} not fully verified. ${result.discoveries?.length || 0} unexpected findings. See individual observations below.`;
  report = verifyReport(result, evidence);
}

await mkdir(artifacts, { recursive: true });
const watchdog = setTimeout(() => {
  void terminate('Harness reached its 35-minute limit');
}, 35 * 60_000);
process.once('SIGTERM', () => void terminate('Workflow was terminated'));
process.once('SIGINT', () => void terminate('Workflow was interrupted'));

async function terminate(reason) {
  report = appendInfrastructureFailure(report, reason);
  try {
    await finalize();
  } finally {
    process.exit(1);
  }
}
try {
  const diff = await prepare();
  await startRecording();
  await agent(diff);
  if (ships && (report.status === 'passed' || context.assessment)) {
    context.backend = await ships.verify();
    await writeFile(
      path.join(artifacts, 'peer-result.json'),
      JSON.stringify(context.backend, null, 2)
    );
  }
} catch (error) {
  report = appendInfrastructureFailure(report, clean(error.message));
} finally {
  await finalize();
}

function finalize() {
  return (finalization ??= (async () => {
    clearTimeout(watchdog);
    agentAbort.abort();
    await stopRecording();
    report = accountForRecordingCap(report, context.video);
    if (recordingAttempted && context.video?.status !== 'ready') {
      if (report.status === 'passed') report.status = 'blocked';
      if (context.evidenceReview === 'pending') {
        for (const check of report.checks) {
          if (check.status === 'passed') {
            check.status = 'blocked';
            check.observed +=
              ' Independent evidence review did not run because the recording is unavailable.';
          }
        }
        report.summary =
          'Testing finished, but the recording is unavailable and independent review has not completed.';
      }
      report.checks.push({
        status: 'blocked',
        expected: 'Attach a playable recording of the complete agent test',
        observed: context.video?.error || 'Test recording is unavailable',
        evidence: [],
      });
    }
    context.billing = billingSummary(artifacts);
    await writeFile(
      path.join(artifacts, 'report.json'),
      clean(
        JSON.stringify(
          { context, report, usage, evidence: Object.fromEntries(evidence) },
          null,
          2
        )
      )
    );
    await writeFile(
      path.join(artifacts, 'report.md'),
      clean(renderReport(context, report, usage))
    );
    console.log(`${context.mode}: ${report.status}. ${clean(report.summary)}`);
    if (udid) {
      await device(['close']).catch(() => {});
      await run('xcrun', ['simctl', 'shutdown', udid]).catch(() => {});
    }
    if (ships) {
      ships.close();
    }
  })());
}

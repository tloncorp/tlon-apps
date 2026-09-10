import { runCodex, verifyCodexAuth } from './codex.mjs';
import { verifyCoverage } from './assess.mjs';
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
  localRecordingPath,
} from './core.mjs';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const artifacts = path.join(root, 'artifacts/agent-qa');
const env = {
  ...process.env,
  QA_TEST_SHIP: process.env.QA_TEST_SHIP || process.env.MAESTRO_TEST_SHIP,
};
const secrets = [
  env.MAESTRO_EMAIL,
  env.MAESTRO_PASSWORD,
  env.OPENROUTER_API_KEY,
  env.QA_TUNNEL_TOKEN,
];
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
deviceEnv.MAESTRO_CLI_NO_ANALYTICS = '1';
deviceEnv.ARGENT_SIMULATOR_NO_WINDOW = '1';
deviceEnv.ARGENT_SCREENSHOT_SCALE = '0.75';

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
      clean(`${error.stdout || ''}\n${error.stderr || ''}`).slice(-16000)
    );
    throw new Error(
      `${operation} failed (${error.code || error.signal || 'timeout'})`
    );
  }
}

function argent(tool, args = {}, timeout = 60_000) {
  return run(
    'argent',
    ['run', tool, '--args', JSON.stringify({ udid, ...args }), '--json'],
    { timeout }
  );
}

async function startRecording() {
  // Bootstrap has already completed: never capture credential entry.
  context.video = { status: 'recording' };
  recordingAttempted = true;
  await argent('screen-recording-start', {
    timeLimitSeconds: 600,
    trimStatic: false,
    showTouches: true,
  });
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
      const recording = JSON.parse(
        await argent('screen-recording-stop', {}, 120_000)
      );
      rawVideo = localRecordingPath(recording);
      await writeFile(
        path.join(artifacts, 'recording.json'),
        clean(JSON.stringify(recording, null, 2))
      );
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
        ...verifyVideo(probe, elapsedSeconds),
        capped,
        warning: recording.warning,
      };
      if (capped)
        throw new Error(
          'Recording reached its 10-minute cap before testing finished'
        );
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
    await run('argent', [
      'run',
      'screenshot',
      '--udid',
      udid,
      '--scale',
      '0.75',
      '--out',
      path.join(artifacts, filename),
    ]);
    const bytes = await readFile(path.join(artifacts, filename));
    if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
      throw new Error('Argent did not produce a PNG screenshot');
  } else {
    await writeFile(
      path.join(artifacts, filename),
      clean(await argent('describe'))
    );
  }
  evidence.set(id, {
    file: filename,
    screenshot,
    command: screenshot ? 'screenshot' : 'describe',
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
  if (
    (!env.QA_SHIP_URL && (!env.MAESTRO_EMAIL || !env.MAESTRO_PASSWORD)) ||
    !env.OPENROUTER_API_KEY
  )
    throw new Error(
      'EAS preview needs OPENROUTER_API_KEY; shared-ship mode also needs MAESTRO_EMAIL and MAESTRO_PASSWORD'
    );
  // Check authentication before paying for simulator/driver setup.
  await verifyCodexAuth(env.OPENROUTER_API_KEY);
  context.agent = {
    runtime: 'Codex CLI 0.145.0',
    model: 'openai/gpt-5.6-sol',
    provider: 'OpenRouter Responses API',
    reasoning: 'medium',
    deviceTools: 'Argent 0.23.0',
  };
  if (env.QA_SHIP_URL) {
    if (env.QA_MODE !== 'workflow_dispatch' || context.testShip !== '~zod')
      throw new Error(
        'Remote ship proof currently requires manual harness validation as ~zod'
      );
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
      `${base}...${harnessSha}`,
    ]);
    if (!diff.trim())
      throw new Error(
        'No mobile behavior diff: manual harness validation is available instead'
      );
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
  await argent('boot-device', { headless: true }, 180_000);
  await run('xcrun', ['simctl', 'install', udid, appCopy], {
    timeout: 180_000,
  });

  const shipPattern =
    '^' +
    (ships ? 'zod' : context.testShip).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '$';
  await run(
    env.QA_MAESTRO_BIN || 'maestro',
    [
      'test',
      '--udid',
      udid,
      '--format',
      'junit',
      '--output',
      path.join(env.TMPDIR || '/tmp', 'qa-login.xml'),
      '--debug-output',
      path.join(env.TMPDIR || '/tmp', 'qa-login-debug'),
      path.join(here, ships ? 'ship-smoke.yaml' : 'smoke.yaml'),
    ],
    {
      timeout: 240_000,
      env: {
        ...deviceEnv,
        MAESTRO_APP_ID: context.appId,
        MAESTRO_TEST_SHIP_PATTERN: shipPattern,
        MAESTRO_LOGIN_URL: ships?.url || '',
        MAESTRO_LOGIN_CODE: shipCode || '',
        MAESTRO_EMAIL: env.MAESTRO_EMAIL,
        MAESTRO_PASSWORD: env.MAESTRO_PASSWORD,
      },
    }
  ).catch(async (error) => {
    let bootstrapFailure;
    const loginXml = path.join(env.TMPDIR || '/tmp', 'qa-login.xml');
    await readFile(loginXml, 'utf8')
      .then((text) =>
        writeFile(path.join(artifacts, 'bootstrap.xml'), clean(text))
      )
      .catch(() => {});
    async function collectCommands(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true }).catch(
        () => []
      )) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await collectCommands(full);
        else if (
          entry.name.startsWith('commands-') &&
          entry.name.endsWith('.json')
        ) {
          const commandText = clean(await readFile(full, 'utf8'));
          await writeFile(path.join(artifacts, entry.name), commandText);
          const failed = JSON.parse(commandText).find(
            (item) => item.metadata?.status === 'FAILED'
          )?.metadata?.error;
          if (failed?.message) {
            bootstrapFailure = (
              JSON.stringify(failed.hierarchyRoot) || ''
            ).includes('Something went wrong')
              ? 'The app displayed "Something went wrong" during login bootstrap'
              : `Login bootstrap: ${failed.message}`;
          }
        }
      }
    }
    await collectCommands(path.join(env.TMPDIR || '/tmp', 'qa-login-debug'));
    const hierarchy = await run(
      env.QA_MAESTRO_BIN || 'maestro',
      ['--udid', udid, 'hierarchy', '--no-reinstall-driver'],
      { timeout: 60_000 }
    ).catch(() => 'Could not inspect the bootstrap screen');
    await writeFile(
      path.join(artifacts, 'bootstrap-screen.txt'),
      clean(hierarchy)
    );
    const appErrors = await run('xcrun', [
      'simctl',
      'spawn',
      udid,
      'log',
      'show',
      '--last',
      '6m',
      '--style',
      'compact',
      '--predicate',
      '(process == "Tlon" OR process == "Landscape") AND subsystem != "com.apple.dt.xctest" AND (eventMessage CONTAINS[c] "error" OR eventMessage CONTAINS[c] "exception")',
    ]).catch(() => 'Could not collect app errors');
    await writeFile(
      path.join(artifacts, 'bootstrap-app-errors.txt'),
      clean(appErrors).slice(-32000)
    );
    if (
      context.mode === 'Harness validation only' &&
      bootstrapFailure?.includes('The app displayed')
    ) {
      context.bootstrapRecovery = `${bootstrapFailure}. Manual harness validation retried once by relaunching; this does not qualify fresh login.`;
      console.log(context.bootstrapRecovery);
      await run(
        env.QA_MAESTRO_BIN || 'maestro',
        ['test', '--udid', udid, path.join(here, 'recover-smoke.yaml')],
        {
          timeout: 180_000,
          env: {
            ...deviceEnv,
            MAESTRO_APP_ID: context.appId,
            MAESTRO_TEST_SHIP_PATTERN: shipPattern,
          },
        }
      );
    } else throw bootstrapFailure ? new Error(bootstrapFailure) : error;
  });
  context.smoke = context.bootstrapRecovery
    ? 'Passed after one app relaunch: Home, Contacts, and exact test-ship identity. Fresh login failed.'
    : 'Passed: fresh login, Home, Contacts, and exact test-ship identity';
  console.log(context.smoke);
  await argent('launch-app', { bundleId: context.appId }, 120_000);
  await capture();
  await capture([], true);
  return diff;
}

async function agent(diff) {
  evidence.set('codex-trace', {
    file: 'argent-trace.jsonl',
    screenshot: false,
    command: 'codex exec',
  });
  const result = await runCodex({
    env,
    deviceEnv,
    artifacts,
    context,
    udid,
    diff,
    clean,
    usage,
    signal: agentAbort.signal,
  });
  await capture();
  await capture([], true);
  report = verifyCoverage(verifyReport(result, evidence), context.assessment);
}

await mkdir(artifacts, { recursive: true });
const watchdog = setTimeout(() => {
  void terminate('Harness reached its 25-minute limit');
}, 25 * 60_000);
process.once('SIGTERM', () => void terminate('Workflow was terminated'));
process.once('SIGINT', () => void terminate('Workflow was interrupted'));

async function terminate(reason) {
  report = {
    status: 'blocked',
    summary: reason,
    checks: [
      {
        status: 'blocked',
        expected: 'Complete the requested testing',
        observed: reason,
        evidence: [],
      },
    ],
  };
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
  if (ships && report.status === 'passed') {
    context.backend = await ships.verify();
    await writeFile(
      path.join(artifacts, 'peer-result.json'),
      JSON.stringify(context.backend, null, 2)
    );
  }
} catch (error) {
  report = {
    status: 'blocked',
    summary: clean(error.message),
    checks: [
      {
        status: 'blocked',
        expected: 'Complete setup and verify the requested app behavior',
        observed: clean(error.message),
        evidence: [],
      },
    ],
  };
} finally {
  await finalize();
}

function finalize() {
  return (finalization ??= (async () => {
    clearTimeout(watchdog);
    agentAbort.abort();
    await stopRecording();
    if (recordingAttempted && context.video?.status !== 'ready') {
      if (report.status === 'passed') report.status = 'blocked';
      report.checks.push({
        status: 'blocked',
        expected: 'Attach a playable recording of the complete agent test',
        observed: context.video?.error || 'Test recording is unavailable',
        evidence: [],
      });
    }
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
      await argent('stop-all-simulator-servers', {
        udid: undefined,
        devices: [udid],
      }).catch(() => {});
      await run('xcrun', ['simctl', 'shutdown', udid]).catch(() => {});
    }
    if (ships) {
      ships.close();
    }
  })());
}

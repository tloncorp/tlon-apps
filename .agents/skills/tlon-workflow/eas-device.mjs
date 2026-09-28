#!/usr/bin/env node
// Runs agent-device against this worktree's EAS Simulator session: the one
// `stim ios --remote eas` or `stim android --remote eas` created and connected.
//
//   node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs keepalive
//   node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs snapshot -i
//   node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs press 'text="Next"' --settle
//
// Stim leaves agent-device's active remote connection pointing at the session
// (daemon URL, tenant, lease) but does not persist the session token, which
// every call needs. This looks the token up with `eas simulator:get`, caches it
// beside Stim's connection profile, and runs agent-device with it in the
// environment, so the token never appears on a command line. It also adds the
// connection's --session when the arguments name none.
//
// A remote lease lapses after about a minute without a command, and the next
// command then takes a new lease that the session refuses for good. Every call,
// and `keepalive` on its own, makes sure a detached process is pinging the
// device for as long as Stim records the session.
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..', '..', 'apps', 'tlon-mobile');
const STIM_HOME = process.env.STIM_HOME || join(homedir(), '.stim');
const AGENT_DEVICE_STATE =
  process.env.AGENT_DEVICE_STATE_DIR || join(homedir(), '.agent-device');
const PROFILE_FILE = 'agent-device.remote.json';
const TOKEN_FILE = 'agent-device.remote.token.json';
const KEEPALIVE_FILE = 'agent-device.remote.keepalive.json';
const KEEPALIVE_LOG = 'agent-device.remote.keepalive.log';
const KEEPALIVE_LOOP = '--keepalive-loop';
const KEEPALIVE_MS = 15_000;
const KEEPALIVE_MAX_FAILURES = 4;

function fail(message) {
  console.error(`eas-device: ${message}`);
  process.exit(2);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// Stim keeps one directory per workspace and records the app root in it.
function workspaceDir(appRoot) {
  const root = realpathSync(appRoot);
  const base = join(STIM_HOME, 'workspaces');
  const dirs = existsSync(base) ? readdirSync(base) : [];
  const dir = dirs
    .map((name) => join(base, name))
    .find(
      (path) => readJson(join(path, 'workspace.json'))?.projectRoot === root
    );
  if (!dir) fail(`Stim has no workspace for ${root}; run stim start there`);
  return dir;
}

function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

// One pinger per session: a newer one replaces an older one, and it stops
// once Stim no longer records the session it was started for.
function ensureKeepalive(dir, sessionId, appRoot) {
  const path = join(dir, KEEPALIVE_FILE);
  const current = readJson(path);
  if (current?.sessionId === sessionId && running(current.pid)) return;
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), KEEPALIVE_LOOP, appRoot, sessionId],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
  writeFileSync(path, `${JSON.stringify({ pid: child.pid, sessionId })}\n`);
}

async function keepalive(appRoot, sessionId) {
  const dir = workspaceDir(appRoot);
  let failures = 0;
  for (;;) {
    await new Promise((done) => setTimeout(done, KEEPALIVE_MS));
    if (readJson(join(dir, KEEPALIVE_FILE))?.pid !== process.pid) return;
    // Exits here once `stim stop` clears the session.
    const device = easDevice(appRoot, { keepalive: false });
    if (device.sessionId !== sessionId) return;
    const r = spawnSync(
      'agent-device',
      ['appstate', '--session', device.session],
      {
        env: device.env,
        encoding: 'utf8',
        timeout: 60_000,
      }
    );
    if (r.status === 0) {
      failures = 0;
      continue;
    }
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n')[0];
    appendFileSync(
      join(dir, KEEPALIVE_LOG),
      `${new Date().toISOString()} ${sessionId} appstate failed: ${out}\n`
    );
    if (++failures >= KEEPALIVE_MAX_FAILURES) return;
  }
}

// Returns the agent-device session and environment for this worktree's
// EAS Simulator session, and keeps its lease alive unless told not to.
export function easDevice(appRoot = APP, { keepalive = true } = {}) {
  const dir = workspaceDir(appRoot);
  const sessionId = readJson(join(dir, 'state.json'))?.remoteDevice?.sessionId;
  if (!sessionId)
    fail(
      'this worktree has no EAS Simulator session; run stim ios --remote eas (or stim android --remote eas) from apps/tlon-mobile'
    );
  const profilePath = join(dir, PROFILE_FILE);
  const profile = readJson(profilePath);
  if (!profile?.session) fail(`no connection profile at ${profilePath}`);

  // agent-device routes a call by the connection saved under the session
  // name, not by this profile. Stim names each worktree's session after it,
  // so that connection should come from this profile; refuse rather than
  // drive a device this worktree did not connect.
  const connection = readJson(
    join(AGENT_DEVICE_STATE, 'remote-connections', `${profile.session}.json`)
  );
  if (connection?.remoteConfigPath !== profilePath)
    fail(
      `agent-device's "${profile.session}" connection comes from ${connection?.remoteConfigPath ?? 'nowhere'}, not this worktree's ${profilePath}; run stim ios --remote eas (or stim android --remote eas) from apps/tlon-mobile to reconnect`
    );

  const tokenPath = join(dir, TOKEN_FILE);
  let token = readJson(tokenPath);
  if (token?.sessionId !== sessionId) {
    const r = spawnSync(
      'eas',
      ['simulator:get', '--id', sessionId, '--json', '--non-interactive'],
      { cwd: appRoot, encoding: 'utf8' }
    );
    if (r.error) fail(`eas did not run (${r.error.message})`);
    const session = (() => {
      try {
        return JSON.parse(r.stdout);
      } catch {
        return null;
      }
    })();
    const value = session?.remoteConfig?.agentDeviceRemoteSessionToken;
    if (r.status !== 0 || !value)
      fail(
        `eas simulator:get --id ${sessionId} returned no agent-device token (status ${session?.status ?? 'unknown'})\n${(r.stderr ?? '').trim()}`
      );
    token = { sessionId, token: value };
    writeFileSync(tokenPath, `${JSON.stringify(token)}\n`, { mode: 0o600 });
  }
  if (keepalive) ensureKeepalive(dir, sessionId, appRoot);
  return {
    session: profile.session,
    sessionId,
    env: { ...process.env, AGENT_DEVICE_DAEMON_AUTH_TOKEN: token.token },
  };
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args[0] === KEEPALIVE_LOOP) {
    await keepalive(args[1], args[2]);
    process.exit(0);
  }
  if (args.length === 0)
    fail(
      'usage: node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs <keepalive | agent-device command> [args]'
    );
  const { session, env } = easDevice();
  if (args[0] === 'keepalive') {
    console.log(`${session}: keepalive running`);
    process.exit(0);
  }
  const withSession = args.includes('--session')
    ? args
    : [...args, '--session', session];
  const r = spawnSync('agent-device', withSession, { stdio: 'inherit', env });
  if (r.error) fail(`agent-device did not run (${r.error.message})`);
  process.exit(r.status ?? 1);
}

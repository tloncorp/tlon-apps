#!/usr/bin/env node
// Runs agent-device against this worktree's EAS Simulator session: the one
// `stim ios --remote eas` or `stim android --remote eas` created and connected.
//
//   node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs snapshot -i
//   node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs press 'text="Next"' --settle
//
// Stim leaves agent-device's active remote connection pointing at the session
// (daemon URL, tenant, lease) but does not persist the session token, which
// every call needs. This looks the token up with `eas simulator:get`, caches it
// beside Stim's connection profile, and runs agent-device with it in the
// environment, so the token never appears on a command line. It also adds the
// connection's --session when the arguments name none.
import { spawnSync } from 'node:child_process';
import {
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

// Returns the agent-device session and environment for this worktree's
// EAS Simulator session.
export function easDevice(appRoot = APP) {
  const dir = workspaceDir(appRoot);
  const sessionId = readJson(join(dir, 'state.json'))?.remoteDevice?.sessionId;
  if (!sessionId)
    fail(
      'this worktree has no EAS Simulator session; run stim ios --remote eas (or stim android --remote eas) from apps/tlon-mobile'
    );
  const profilePath = join(dir, PROFILE_FILE);
  const profile = readJson(profilePath);
  if (!profile?.session) fail(`no connection profile at ${profilePath}`);

  // Every worktree's remote session gets the same name from Stim, and
  // agent-device keeps one active connection per name. Refuse rather than
  // drive another worktree's device.
  const connection = readJson(
    join(AGENT_DEVICE_STATE, 'remote-connections', `${profile.session}.json`)
  );
  if (connection?.remoteConfigPath !== profilePath)
    fail(
      `agent-device's "${profile.session}" connection belongs to ${connection?.remoteConfigPath ?? 'nothing'}, not this worktree; another worktree connected an EAS session after this one`
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
  if (args.length === 0)
    fail(
      'usage: node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs <agent-device command> [args]'
    );
  const { session, env } = easDevice();
  const withSession = args.includes('--session')
    ? args
    : [...args, '--session', session];
  const r = spawnSync('agent-device', withSession, { stdio: 'inherit', env });
  if (r.error) fail(`agent-device did not run (${r.error.message})`);
  process.exit(r.status ?? 1);
}

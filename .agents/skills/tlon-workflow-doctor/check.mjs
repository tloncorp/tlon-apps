#!/usr/bin/env node
// Checks what the tlon-workflow skill depends on. --fix installs what it can.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIX = process.argv.includes('--fix');
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP = join(REPO, 'apps', 'tlon-mobile');
const SKILL_DIRS = [
  join(homedir(), '.agents', 'skills'),
  join(REPO, '.agents', 'skills'),
];

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function which(cmd) {
  const r = run('sh', ['-c', `command -v ${cmd}`]);
  return r.ok ? r.stdout.trim() : null;
}

function version(cmd, args = ['--version']) {
  return (
    run(cmd, args).stdout.match(/(\d+)\.(\d+)\.(\d+)(-[\w.]+)?/)?.[0] ?? null
  );
}

function atLeast(v, min) {
  if (!v) return false;
  const a = v.split('-')[0].split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return !v.includes('-');
}

function hasSkill(name) {
  return SKILL_DIRS.some((d) => existsSync(join(d, name, 'SKILL.md')));
}

const checks = [
  {
    name: 'gh',
    test() {
      if (!which('gh'))
        return { fix: 'gh is not installed', how: 'brew install gh' };
      const v = version('gh');
      if (!atLeast(v, '2.99.0'))
        return {
          fix: `gh ${v} predates --attach (needs 2.99.0)`,
          how: 'brew upgrade gh',
        };
      if (!run('gh', ['auth', 'status']).ok)
        return { fix: 'gh is not authenticated', how: 'gh auth login' };
      return { ok: `gh ${v}, authenticated` };
    },
  },
  {
    name: 'stim',
    test() {
      const path = which('stim');
      const how = 'npm uninstall -g stim-cli; npm install -g stim';
      if (!path)
        return {
          fix: 'stim is not installed',
          how,
          cmd: ['npm', ['install', '-g', 'stim']],
        };
      const real = realpathSync(path);
      const v = version('stim');
      if (real.includes('/stim-cli/')) {
        return {
          fix: `stim resolves to the old stim-cli package (${v}) at ${real}`,
          how,
          cmd: ['sh', ['-c', 'npm uninstall -g stim-cli; npm install -g stim']],
        };
      }
      if (!atLeast(v, '1.0.0'))
        return {
          fix: `stim ${v} is older than 1.0.0`,
          how: 'npm install -g stim@latest',
          cmd: ['npm', ['install', '-g', 'stim@latest']],
        };
      return { ok: `stim ${v} at ${path}` };
    },
  },
  {
    name: 'stim skill',
    test() {
      if (hasSkill('stim')) return { ok: 'installed' };
      return {
        fix: 'the stim skill is not installed',
        how: 'npx skills add appandflow/stim -g -y',
        cmd: ['npx', ['--yes', 'skills', 'add', 'appandflow/stim', '-g', '-y']],
      };
    },
  },
  {
    name: 'agent-device',
    test() {
      const path = which('agent-device');
      if (!path)
        return {
          fix: 'agent-device is not installed',
          how: 'npm install -g agent-device',
          cmd: ['npm', ['install', '-g', 'agent-device']],
        };
      const v = version('agent-device');
      if (!v)
        return {
          fix: `agent-device at ${path} does not report a version, so it cannot run`,
          how: 'npm install -g agent-device',
          cmd: ['npm', ['install', '-g', 'agent-device']],
        };
      return { ok: `agent-device ${v}` };
    },
  },
  {
    name: 'agent-device skill',
    test() {
      if (hasSkill('agent-device')) return { ok: 'installed' };
      return {
        fix: 'the agent-device skill is not installed',
        how: 'npx skills add callstack/agent-device -g -y',
        cmd: [
          'npx',
          ['--yes', 'skills', 'add', 'callstack/agent-device', '-g', '-y'],
        ],
      };
    },
  },
  {
    name: 'node',
    test() {
      const want = readFileSync(join(REPO, '.nvmrc'), 'utf8')
        .trim()
        .replace(/^v/, '');
      const have = process.versions.node;
      if (want.split('.')[0] !== have.split('.')[0])
        return { note: `node ${have}; .nvmrc says ${want}` };
      return { ok: `node ${have}` };
    },
  },
  {
    name: 'stim config',
    test() {
      const config = join(homedir(), '.stim', 'config.json');
      if (!existsSync(config))
        return { ok: 'no machine config, so nothing to go stale' };
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(config, 'utf-8'));
      } catch {
        return {
          fix: `${config} is not valid JSON`,
          how: `repair it, or move it aside: mv "${config}" "${config}.broken"`,
        };
      }
      // A setting naming a path that no longer exists fails the command that
      // reads it, and the refusal names the missing path rather than the key
      // that holds it. Doctor does not check these. `projects` is skipped: an
      // entry for a deleted checkout is normal there, and `stim gc` owns it.
      const dead = [];
      const walk = (node, path) => {
        if (typeof node === 'string') {
          const value = node.startsWith('~/')
            ? join(homedir(), node.slice(2))
            : node;
          if (value.startsWith('/') && !existsSync(value))
            dead.push(`${path} -> ${node}`);
        } else if (node && typeof node === 'object') {
          for (const [k, v] of Object.entries(node))
            walk(v, path ? `${path}.${k}` : k);
        }
      };
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'projects') continue;
        walk(value, key);
      }
      if (dead.length)
        return {
          fix: `${config} names ${dead.length} path that no longer exists:\n      ${dead.join('\n      ')}`,
          how: `remove or repoint the key in ${config}`,
        };
      return { ok: 'every path it names exists' };
    },
  },
  {
    name: 'ship login',
    test() {
      const env = join(APP, '.env.local');
      const text = existsSync(env) ? readFileSync(env, 'utf8') : '';
      const missing = [
        'DEFAULT_SHIP_LOGIN_URL',
        'DEFAULT_SHIP_LOGIN_ACCESS_CODE',
      ].filter((k) => {
        const line = text.match(new RegExp(`^${k}=(.*)$`, 'm'));
        return !line || line[1].trim().replace(/^["']|["']$/g, '') === '';
      });
      if (missing.length)
        return {
          note: `${missing.join(', ')} not set in apps/tlon-mobile/.env.local; sign-in will need a person`,
        };
      return { ok: 'dev ship login configured' };
    },
  },
  {
    name: 'stim doctor',
    test() {
      if (!which('stim')) return { note: 'skipped; stim is not installed' };
      const r = run('stim', ['doctor', '--json'], { cwd: APP });
      let findings;
      try {
        findings = JSON.parse(r.stdout).findings ?? [];
      } catch {
        return {
          fix: 'stim doctor did not return JSON',
          how: `cd apps/tlon-mobile && stim doctor`,
        };
      }
      const costly = findings.filter((f) => f.level === 'cost');
      if (costly.length === 0)
        return {
          ok: `no finding costs time (${findings.length} note${findings.length === 1 ? '' : 's'})`,
        };
      // Never run `stim doctor --fix` from here. It writes the agent's own
      // permission file and can delete generated Android .cxx directories, so
      // it is a decision for whoever is running this, not a repair to apply.
      return {
        fix: costly
          .map((f) => `${f.title}${f.fix ? ` -> ${f.fix}` : ''}`)
          .join('\n      '),
        how: 'cd apps/tlon-mobile && stim doctor, then apply the fix each finding names',
        cmd: null,
      };
    },
  },
];

function report(results) {
  for (const { name, r } of results) {
    const tag = r.ok ? 'ok  ' : r.note ? 'note' : 'fix ';
    const text = r.ok ?? r.note ?? r.fix;
    console.log(`${tag}  ${name.padEnd(19)} ${text}`);
    if (r.fix && r.how) console.log(`${' '.repeat(26)}-> ${r.how}`);
  }
}

let results = checks.map((c) => ({ name: c.name, r: c.test(), c }));

if (FIX) {
  const fixable = results.filter(({ r }) => r.fix && r.cmd);
  for (const { name, r } of fixable) {
    const [cmd, args = [], opts = {}] = r.cmd;
    console.error(`fixing ${name}: ${r.how}`);
    const out = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
    if (out.status !== 0) console.error(`${name}: exited ${out.status}`);
  }
  if (fixable.length) console.error('');
  results = checks.map((c) => ({ name: c.name, r: c.test(), c }));
}

report(results);
process.exitCode = results.some(({ r }) => r.fix) ? 1 : 0;

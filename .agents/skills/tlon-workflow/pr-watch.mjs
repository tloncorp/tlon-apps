#!/usr/bin/env node
// Waits for review activity on a pull request from the Codex reviewer or from
// someone with write access, prints each item as one JSON line, and exits.
// Prints a "closed" line and exits once the pull request is merged or closed.
// Your own comments never count.
//
//   node pr-watch.mjs [<number>] [--interval <seconds>] [--once]
//
// Run it from anywhere inside the repository. State (what was already
// reported) lives under the worktree's .git directory.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const BOT = 'chatgpt-codex-connector[bot]';
const CODEX_STATUS_MARKER = '<!-- codex-pull-request-review-summary -->';
const WRITE = new Set(['admin', 'maintain', 'write']);
// gh paginates a busy pull request into more than the 1 MiB spawnSync default.
const MAX_BUFFER = 64 * 1024 * 1024;

function usage(message) {
  process.stderr.write(
    `pr-watch: ${message}\nusage: pr-watch.mjs [<number>] [--interval <seconds>] [--once]\n`
  );
  process.exit(2);
}

function parseArgs(argv) {
  let once = false;
  let interval = 60;
  let number = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--once') {
      once = true;
    } else if (arg === '--interval') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value < 5)
        usage('--interval takes a number of seconds, at least 5');
      interval = value;
    } else if (/^\d+$/.test(arg)) {
      if (number !== null)
        usage(`two pull request numbers given: ${number} and ${arg}`);
      number = arg;
    } else {
      usage(`unknown argument ${arg}`);
    }
  }
  return { once, interval: interval * 1000, number };
}

// Never put captured output in the message: on a public repository it is
// attacker-controlled text, and this error is printed.
function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (r.error) throw new Error(`${cmd} ${args[0]}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]}: exited ${r.status}`);
  return r.stdout.trim();
}

function api(path) {
  return JSON.parse(sh('gh', ['api', '--paginate', '--slurp', path])).flat();
}

const { once, interval, number: requested } = parseArgs(process.argv.slice(2));
const repo = sh('gh', [
  'repo',
  'view',
  '--json',
  'nameWithOwner',
  '--jq',
  '.nameWithOwner',
]);
const me = sh('gh', ['api', 'user', '--jq', '.login']);
const number =
  requested ?? sh('gh', ['pr', 'view', '--json', 'number', '--jq', '.number']);
const stateFile = join(
  sh('git', ['rev-parse', '--git-dir']),
  'tlon-pr-watch',
  `${number}.json`
);

function loadSeen() {
  if (!existsSync(stateFile)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(stateFile, 'utf8')).seen);
  } catch {
    // A truncated write must not wedge the watcher forever; re-reporting a
    // handful of items is the cheaper failure.
    process.stderr.write(
      `pr-watch: ${stateFile} is unreadable, starting fresh\n`
    );
    return new Set();
  }
}

const seen = loadSeen();

function save() {
  mkdirSync(dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ seen: [...seen] }));
  try {
    renameSync(tmp, stateFile);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

// author_association says how someone relates to the repository, not what they
// may do to it: MEMBER is any organization member and CONTRIBUTOR is anyone
// whose pull request once merged. On a public repository only an actual
// permission check separates a reviewer from a passer-by.
// A yes is cached for the run. A no is cached only for the current poll: gh
// exits 1 for a 404 (not a collaborator) and for a network failure alike, and
// caching the latter for the run would silence a reviewer.
const writers = new Set();
let denied = new Set();
function hasWriteAccess(login) {
  if (writers.has(login)) return true;
  if (denied.has(login)) return false;
  let allowed = false;
  try {
    allowed = WRITE.has(
      sh('gh', [
        'api',
        `repos/${repo}/collaborators/${login}/permission`,
        '--jq',
        '.permission',
      ])
    );
  } catch {
    // 403 (the token cannot read collaborators) or 404 (not a collaborator).
    // Both mean "not established", and the safe answer is no.
    allowed = false;
  }
  if (allowed) writers.add(login);
  else denied.add(login);
  return allowed;
}

function qualifies(user) {
  const login = user?.login;
  if (!login || login === me) return false;
  if (login === BOT) return true;
  return hasWriteAccess(login);
}

function collect() {
  denied = new Set();
  const pulls = `repos/${repo}/pulls/${number}`;
  const items = [];
  for (const c of api(`repos/${repo}/issues/${number}/comments?per_page=100`)) {
    if (!qualifies(c.user)) continue;
    // Codex posts a status comment the moment a PR goes ready and edits it in
    // place when the review completes, so it is reported once, on completion.
    const status = c.body?.includes(CODEX_STATUS_MARKER);
    if (status && !c.body.includes('"status":"completed"')) continue;
    items.push({
      kind: 'comment',
      id: status ? `c${c.id}:completed` : `c${c.id}`,
      at: c.created_at,
      author: c.user.login,
      url: c.html_url,
      body: c.body,
    });
  }
  for (const c of api(`${pulls}/comments?per_page=100`)) {
    if (!qualifies(c.user)) continue;
    items.push({
      kind: 'review_comment',
      id: `rc${c.id}`,
      at: c.created_at,
      author: c.user.login,
      path: c.path,
      line: c.line ?? c.original_line,
      replyTo: c.in_reply_to_id ?? null,
      commentId: c.id,
      url: c.html_url,
      body: c.body,
    });
  }
  for (const r of api(`${pulls}/reviews?per_page=100`)) {
    if (!qualifies(r.user)) continue;
    if (!r.body && r.state === 'COMMENTED') continue;
    // A dismissed approval keeps its id and changes state; key on both so the
    // dismissal is reported.
    items.push({
      kind: 'review',
      id: `r${r.id}:${r.state}`,
      at: r.submitted_at,
      author: r.user.login,
      state: r.state,
      url: r.html_url,
      body: r.body,
    });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (;;) {
  let pr;
  let fresh;
  try {
    pr = JSON.parse(sh('gh', ['api', `repos/${repo}/pulls/${number}`]));
    fresh = collect().filter((i) => !seen.has(i.id));
  } catch (err) {
    process.stderr.write(`pr-watch: ${err.message}\n`);
    // A one-shot run reports the failure rather than turning into a daemon.
    if (once) process.exit(1);
    await sleep(interval);
    continue;
  }
  for (const item of fresh) {
    console.log(JSON.stringify(item));
    seen.add(item.id);
  }
  if (fresh.length) save();
  if (pr.state === 'closed') {
    console.log(
      JSON.stringify({ kind: 'closed', merged: pr.merged, url: pr.html_url })
    );
    break;
  }
  if (fresh.length || once) break;
  await sleep(interval);
}

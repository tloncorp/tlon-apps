#!/usr/bin/env node
// Waits for review activity on a pull request from the Codex reviewer or from
// someone with write access, prints each item as one JSON line, and exits.
// Prints a "closed" line and exits once the pull request is merged or closed.
// The agent's own replies never count. They are recognised by the marker the
// skill has the agent put in every reply, not by login: the agent and the
// human reviewing it usually share one GitHub account.
//
//   node pr-watch.mjs [<number>] [--interval <seconds>] [--timeout <seconds>] [--settle <seconds>] [--once]
//
// A round arrives in pieces: CI fails or passes, Codex posts its comments,
// then its status a minute later. After the first new item the run keeps
// polling every 20s and exits once --settle seconds (default 150) pass with
// nothing new, or once Codex's status for the head commit is in and its checks
// have resolved, so one run is one round. Checks can take twenty minutes; the
// run keeps polling for them at the normal interval after the status.
//
// CI is part of the round: a "ci" line with status failure names the failed
// checks; status success arrives once per head commit when every check is done.
//
// --timeout (default 1800) ends a blocking run with a "timeout" line once the
// pull request has been inactive that long: GitHub's updated_at moves on any
// commit, comment, or review, by anyone, so the budget restarts on activity.
//
// Run it from anywhere inside the repository. State (what was already
// reported) lives under the worktree's .git directory.
import { spawnSync } from 'node:child_process';
import { parseArgs as parseArgv } from 'node:util';
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
const AGENT_MARKER = '<!-- tlon-workflow:agent -->';
const CODEX_STATUS_MARKER = '<!-- codex-pull-request-review-summary -->';
const WRITE = new Set(['admin', 'maintain', 'write']);
// gh paginates a busy pull request into more than the 1 MiB spawnSync default.
const MAX_BUFFER = 64 * 1024 * 1024;

function usage(message) {
  process.stderr.write(
    `pr-watch: ${message}\nusage: pr-watch.mjs [<number>] [--interval <seconds>] [--timeout <seconds>] [--settle <seconds>] [--once]\n`
  );
  process.exit(2);
}

function seconds(name, raw, fallback, min) {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min)
    usage(`--${name} takes a number of seconds${min > 0 ? `, at least ${min}` : ''}`);
  return value;
}

function parseArgs(argv) {
  let parsed;
  try {
    parsed = parseArgv({
      args: argv,
      allowPositionals: true,
      options: {
        once: { type: 'boolean' },
        interval: { type: 'string' },
        settle: { type: 'string' },
        timeout: { type: 'string' },
      },
    });
  } catch (err) {
    const unknown = /^Unknown option '([^']+)'/.exec(err.message);
    usage(unknown ? `unknown argument ${unknown[1]}` : err.message);
  }
  const { values, positionals } = parsed;
  const bad = positionals.find((arg) => !/^\d+$/.test(arg));
  if (bad) usage(`unknown argument ${bad}`);
  if (positionals.length > 1)
    usage(`two pull request numbers given: ${positionals[0]} and ${positionals[1]}`);
  return {
    once: values.once ?? false,
    interval: seconds('interval', values.interval, 60, 5) * 1000,
    timeout: seconds('timeout', values.timeout, 1800, 1) * 1000,
    settle: seconds('settle', values.settle, 150, 0) * 1000,
    number: positionals[0] ?? null,
  };
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

// The head commit's checks, folded to one line: a failure names the failed
// checks, a success is reported once per commit, and a pending run is nothing
// yet. Skipped and neutral runs do not count either way.
// Anything completed that is not a pass. GitHub also reports `stale` when a
// run is superseded, which is not a pass either.
const PASSED = new Set(['success', 'neutral', 'skipped']);
function checks(sha) {
  const pages = JSON.parse(
    sh('gh', [
      'api',
      '--paginate',
      '--slurp',
      `repos/${repo}/commits/${sha}/check-runs?per_page=100`,
    ])
  );
  const runs = pages.flatMap((p) => p.check_runs ?? []);
  // Checks moving is activity too: a twenty-minute job must not look like
  // an idle pull request to the inactivity budget.
  ciActivity = runs
    .flatMap((r) => [r.started_at, r.completed_at])
    .filter(Boolean)
    .map((t) => Date.parse(t))
    .reduce((a, b) => Math.max(a, b), 0);
  const failed = runs.filter(
    (r) => r.status === 'completed' && !PASSED.has(r.conclusion)
  );
  const pending = runs.filter((r) => r.status !== 'completed');
  // The key names the failed checks, so a second check failing after the
  // first was reported is a new item, not a repeat.
  if (failed.length)
    return {
      kind: 'ci',
      id: `ci:${sha}:failure:${failed
        .map((r) => r.name)
        .sort()
        .join('|')}`,
      at: failed[0].completed_at,
      sha,
      status: 'failure',
      failed: failed.map((r) => ({ name: r.name, url: r.html_url })),
    };
  if (pending.length || runs.length === 0) return null;
  return {
    kind: 'ci',
    id: `ci:${sha}:success`,
    at: runs
      .map((r) => r.completed_at)
      .sort()
      .at(-1),
    sha,
    status: 'success',
  };
}

const {
  once,
  interval,
  timeout,
  settle,
  number: requested,
} = parseArgs(process.argv.slice(2));
// The last activity GitHub reported, so a run whose polls start failing still
// ends on the same budget instead of retrying forever.
let lastSeen = Date.now();
// Set when the first new item of this run arrives; the run then collects the
// rest of the round rather than exiting on the first piece.
let settling = null;
let statusSeen = false;
let ciActivity = 0;
const repo = sh('gh', [
  'repo',
  'view',
  '--json',
  'nameWithOwner',
  '--jq',
  '.nameWithOwner',
]);
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

function qualifies(user, body) {
  const login = user?.login;
  if (!login) return false;
  if (body?.includes(AGENT_MARKER)) return false;
  if (login === BOT) return true;
  return hasWriteAccess(login);
}

function collect() {
  denied = new Set();
  const pulls = `repos/${repo}/pulls/${number}`;
  const items = [];
  // Issue comments first, review comments after: Codex posts its findings and
  // then marks its status completed, so counting from a snapshot taken before
  // the status was read could miss findings posted in between.
  const issueComments = api(
    `repos/${repo}/issues/${number}/comments?per_page=100`
  );
  const reviewComments = api(`${pulls}/comments?per_page=100`);
  for (const c of issueComments) {
    if (!qualifies(c.user, c.body)) continue;
    // Codex posts a status comment the moment a PR goes ready and edits it in
    // place when the review completes. It is reported once, on completion, as
    // a codex-status line with the number of inline findings on the reviewed
    // commit, so a clean round is one line rather than three queries.
    if (c.body?.includes(CODEX_STATUS_MARKER)) {
      if (!c.body.includes('"status":"completed"')) continue;
      const headSha = c.body.match(/"headSha":"([0-9a-f]+)"/)?.[1] ?? null;
      const findings = reviewComments.filter(
        (rc) =>
          rc.user?.login === BOT &&
          !rc.in_reply_to_id &&
          (headSha
            ? rc.original_commit_id === headSha
            : rc.created_at >= c.created_at)
      ).length;
      items.push({
        kind: 'codex-status',
        id: `c${c.id}:${headSha ?? 'completed'}:${findings}`,
        at: c.updated_at ?? c.created_at,
        author: c.user.login,
        headSha,
        findings,
        url: c.html_url,
      });
      continue;
    }
    items.push({
      kind: 'comment',
      id: `c${c.id}`,
      at: c.created_at,
      author: c.user.login,
      url: c.html_url,
      body: c.body,
    });
  }
  for (const c of reviewComments) {
    if (!qualifies(c.user, c.body)) continue;
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
    if (!qualifies(r.user, r.body)) continue;
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
  let ci;
  try {
    pr = JSON.parse(sh('gh', ['api', `repos/${repo}/pulls/${number}`]));
    ci = checks(pr.head.sha);
    fresh = [...collect(), ...(ci ? [ci] : [])]
      .sort((a, b) => a.at.localeCompare(b.at))
      .filter((i) => !seen.has(i.id));
  } catch (err) {
    process.stderr.write(`pr-watch: ${err.message}\n`);
    // A one-shot run reports the failure rather than turning into a daemon.
    if (once) process.exit(1);
    if (Date.now() - lastSeen >= timeout) {
      console.log(
        JSON.stringify({
          kind: 'timeout',
          seconds: timeout / 1000,
          unreachable: true,
        })
      );
      break;
    }
    await sleep(interval);
    continue;
  }
  lastSeen = Math.max(Date.parse(pr.updated_at), ciActivity);
  for (const item of fresh) {
    console.log(JSON.stringify(item));
    seen.add(item.id);
    if (item.kind === 'codex-status' && item.headSha === pr.head.sha)
      statusSeen = true;
  }
  if (fresh.length) {
    save();
    settling = Date.now();
  }
  if (pr.state === 'closed') {
    console.log(
      JSON.stringify({ kind: 'closed', merged: pr.merged, url: pr.html_url })
    );
    break;
  }
  if (once) break;
  if (settling !== null) {
    const ciResolved = ci !== null && ci !== undefined;
    if (statusSeen && ciResolved) break;
    if (!statusSeen && Date.now() - settling >= settle) break;
    // Status in, checks still running: wait for them at the normal interval.
    await sleep(statusSeen ? interval : Math.min(interval, 20000));
    continue;
  }
  if (Date.now() - lastSeen >= timeout) {
    console.log(
      JSON.stringify({
        kind: 'timeout',
        seconds: timeout / 1000,
        lastActivity: new Date(lastSeen).toISOString(),
        checksPending: ci === null,
      })
    );
    break;
  }
  await sleep(interval);
}

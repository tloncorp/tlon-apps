#!/usr/bin/env node
// Waits for review activity on a pull request from the Codex reviewer or a
// repository owner, member, or collaborator; prints each item as one JSON line
// and exits. Prints a "closed" line and exits once the pull request is merged
// or closed. Your own comments never count.
//
//   node pr-watch.mjs [<number>] [--interval <seconds>] [--once]
//
// State (what was already reported) lives under this worktree's .git directory.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BOT = 'chatgpt-codex-connector[bot]';
const MEMBER = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

const argv = process.argv.slice(2);
const once = argv.includes('--once');
const intervalIndex = argv.indexOf('--interval');
const interval =
  (intervalIndex === -1 ? 60 : Number(argv[intervalIndex + 1])) * 1000;

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0)
    throw new Error(
      `${cmd} ${args.join(' ')}: ${(r.stderr || r.stdout).trim()}`
    );
  return r.stdout.trim();
}

function api(path) {
  return JSON.parse(sh('gh', ['api', '--paginate', '--slurp', path])).flat();
}

const number =
  argv.find((a) => /^\d+$/.test(a)) ??
  sh('gh', ['pr', 'view', '--json', 'number', '--jq', '.number']);
const repo = sh('gh', [
  'repo',
  'view',
  '--json',
  'nameWithOwner',
  '--jq',
  '.nameWithOwner',
]);
const me = sh('gh', ['api', 'user', '--jq', '.login']);
const stateFile = join(
  sh('git', ['rev-parse', '--git-dir']),
  'tlon-pr-watch',
  `${number}.json`
);
const seen = new Set(
  existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')).seen : []
);

function qualifies(user, association) {
  const login = user?.login;
  if (!login || login === me) return false;
  return login === BOT || MEMBER.has(association);
}

function collect() {
  const pulls = `repos/${repo}/pulls/${number}`;
  const items = [];
  for (const c of api(`repos/${repo}/issues/${number}/comments?per_page=100`)) {
    if (!qualifies(c.user, c.author_association)) continue;
    items.push({
      kind: 'comment',
      id: `c${c.id}`,
      at: c.created_at,
      author: c.user.login,
      url: c.html_url,
      body: c.body,
    });
  }
  for (const c of api(`${pulls}/comments?per_page=100`)) {
    if (!qualifies(c.user, c.author_association)) continue;
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
    if (!qualifies(r.user, r.author_association)) continue;
    if (!r.body && r.state === 'COMMENTED') continue;
    items.push({
      kind: 'review',
      id: `r${r.id}`,
      at: r.submitted_at,
      author: r.user.login,
      state: r.state,
      url: r.html_url,
      body: r.body,
    });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

function save() {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ seen: [...seen] }));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (;;) {
  let pr;
  let fresh = [];
  try {
    pr = JSON.parse(sh('gh', ['api', `repos/${repo}/pulls/${number}`]));
    fresh = collect().filter((i) => !seen.has(i.id));
  } catch (err) {
    console.error(
      `poll failed, retrying in ${interval / 1000}s: ${err.message}`
    );
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

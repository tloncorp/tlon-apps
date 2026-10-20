import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BOT,
  CODEX_SUMMARY,
  REPO,
  SUMMARY,
  GitHub,
  collect,
  fingerprint,
  gate,
  isDiffLine,
  parseUrl,
  prepareSource,
  publish,
  trigger,
  validateReport,
} from './triage.mjs';

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const OTHER = 'c'.repeat(40);
const url = `https://github.com/${REPO}/pull/6794`;
const rootComment = {
  id: 10,
  user: { login: BOT },
  body: 'A bounded defect',
  html_url: `${url}#discussion_r10`,
  original_commit_id: HEAD,
};
const fixture = () => ({
  pr: {
    number: 6794,
    title: 'Example',
    body: 'Details',
    state: 'open',
    draft: false,
    head: { sha: HEAD, repo: { full_name: REPO } },
    base: { sha: BASE },
    changed_files: 1,
    labels: [],
  },
  files: [
    {
      filename: 'src/example.ts',
      status: 'modified',
      patch: '@@ -10,3 +10,3 @@\n context\n-old\n+new\n context',
    },
  ],
  conversation: [
    {
      id: 20,
      user: { login: BOT },
      html_url: `${url}#issuecomment-20`,
      body: `${CODEX_SUMMARY}\n{"headSha":"${HEAD}","status":"completed"}`,
    },
  ],
  comments: [structuredClone(rootComment)],
  reviews: [
    {
      id: 30,
      user: { login: BOT },
      body: 'Finding in the review body',
      html_url: `${url}#pullrequestreview-30`,
      commit_id: HEAD,
    },
  ],
  checks: [
    {
      id: 40,
      name: 'Tests',
      head_sha: HEAD,
      status: 'completed',
      conclusion: 'success',
    },
  ],
  statuses: [],
});
const report = (outcome = 'agent-work-needed') => ({
  headSha: HEAD,
  outcome,
  summary: 'A bounded defect remains.',
  complexity: { level: 'high', reason: 'Several lifecycle interactions.' },
  sensitivity: { level: 'medium', reason: 'Recoverable user-visible state.' },
  evidence: outcome === 'agent-eligible' ? 'sufficient' : 'partial',
  checks: ['CI passed; source shows a missing branch.'],
  gaps: [],
  agentWork:
    outcome === 'agent-work-needed' ? ['Correct the bounded defect.'] : [],
  findings: [
    {
      url: rootComment.html_url,
      verdict: outcome === 'agent-eligible' ? 'already-fixed' : 'confirmed',
      currentStatus: 'Verified at head.',
      evidence: 'Exact source inspection.',
    },
    {
      url: `${url}#pullrequestreview-30`,
      verdict: 'refuted',
      currentStatus: 'Unreachable on this platform.',
      evidence: 'Caller platform guard.',
    },
  ],
  humanDecisions:
    outcome === 'human-required'
      ? [
          {
            question: 'May this operation use owner authority?',
            reason: 'Delegation expands access.',
            evidence: 'The caller now uses owner identity.',
            path: 'src/example.ts',
            line: 11,
            side: 'RIGHT',
          },
        ]
      : [],
});
const expected = (context) => ({
  head: context.pr.head.sha,
  base: context.pr.base.sha,
  baseline: BASE,
  fingerprint: fingerprint(context),
});
const event = (name = 'pull_request_target') => ({
  repository: { full_name: REPO },
  sender: { login: 'writer' },
  action: 'synchronize',
  pull_request: { number: 6794 },
  ...(name === 'issue_comment'
    ? {
        sender: { login: BOT },
        issue: { number: 6794, pull_request: {} },
        comment: fixture().conversation[0],
      }
    : {}),
});

class FakeGitHub {
  constructor(context = fixture()) {
    this.context = context;
    this.writes = [];
    this.labels = new Set();
    this.permission = 'write';
    this.beforeRequest = () => {};
  }
  async pages(endpoint) {
    if (endpoint.includes('/issues/6794/comments'))
      return structuredClone(this.context.conversation);
    if (endpoint.includes('/pulls/6794/comments'))
      return structuredClone(this.context.comments);
    if (endpoint.endsWith('/files')) return structuredClone(this.context.files);
    if (endpoint.endsWith('/reviews'))
      return structuredClone(this.context.reviews);
    if (endpoint.includes('/check-runs'))
      return structuredClone(this.context.checks);
    if (endpoint.endsWith('/statuses'))
      return structuredClone(this.context.statuses);
    throw new Error(`Unexpected pages: ${endpoint}`);
  }
  async request(endpoint, method = 'GET', body) {
    this.beforeRequest(endpoint, method, body);
    if (method === 'GET') {
      if (endpoint.endsWith('/pulls/6794'))
        return structuredClone(this.context.pr);
      if (endpoint.endsWith('/permission'))
        return { permission: this.permission };
      if (endpoint.includes('/labels/')) {
        const label = decodeURIComponent(endpoint.split('/labels/')[1]);
        if (this.labels.has(label)) return { name: label };
        throw Object.assign(new Error('Not found'), { status: 404 });
      }
      throw new Error(`Unexpected GET: ${endpoint}`);
    }
    this.writes.push({ endpoint, method, body });
    if (endpoint.includes('/issues/6794/labels/')) {
      const label = decodeURIComponent(endpoint.split('/labels/')[1]);
      this.context.pr.labels = this.context.pr.labels.filter(
        (l) => l.name !== label
      );
    } else if (endpoint.endsWith('/issues/6794/labels')) {
      for (const label of body.labels)
        this.context.pr.labels.push({ name: label });
    } else if (endpoint.endsWith('/labels')) {
      this.labels.add(body.name);
    } else if (endpoint.includes('/pulls/comments/')) {
      this.context.comments.find(
        (c) => c.id === Number(endpoint.split('/').at(-1))
      ).body = body.body;
    } else if (endpoint.includes('/issues/comments/')) {
      this.context.conversation.find(
        (c) => c.id === Number(endpoint.split('/').at(-1))
      ).body = body.body;
    } else if (endpoint.endsWith('/issues/6794/comments')) {
      this.context.conversation.push({
        id: 100,
        user: { login: 'github-actions[bot]' },
        ...body,
      });
    } else if (endpoint.endsWith('/reviews')) {
      this.context.reviews.push({
        id: 200,
        user: { login: 'github-actions[bot]' },
        body: body.body,
      });
      this.context.comments.push(
        ...body.comments.map((c, i) => ({
          id: 300 + i,
          user: { login: 'github-actions[bot]' },
          ...c,
        }))
      );
    } else throw new Error(`Unexpected write: ${endpoint}`);
    return {};
  }
}

test('URLs validate host, repository and integer; local URL fragments are accepted', () => {
  assert.equal(parseUrl(`${url}/#discussion_r10`), 6794);
  for (const input of [
    'https://github.com/other/repo/pull/1',
    `${url}.diff`,
    'https://github.com/tloncorp/tlon-apps/pull/0',
    'https://github.com/tloncorp/tlon-apps/pull/9007199254740993',
    'https://evil.example/tloncorp/tlon-apps/pull/1',
    'https://user@github.com/tloncorp/tlon-apps/pull/1',
  ])
    assert.throws(() => parseUrl(input));
});

test('only real Codex status events trigger counter-review; edits count', () => {
  const e = event('issue_comment');
  e.action = 'edited';
  assert.deepEqual(trigger('issue_comment', e), {
    number: 6794,
    analyze: true,
    reviewedHead: HEAD,
  });
  e.comment.body = `${CODEX_SUMMARY} {"headSha": "${HEAD}", "status": "in_progress"}`;
  assert.equal(trigger('issue_comment', e).analyze, false);
  e.comment.user.login = 'contributor';
  assert.equal(trigger('issue_comment', e), null);
  e.comment.user.login = BOT;
  e.sender.login = 'contributor';
  assert.equal(trigger('issue_comment', e), null);
  assert.equal(
    trigger('issue_comment', {
      ...event('issue_comment'),
      comment: {
        user: { login: 'github-actions[bot]' },
        body: SUMMARY,
      },
    }),
    null
  );
  assert.throws(() =>
    trigger('workflow_dispatch', {
      ...event(),
      inputs: { pr_url: `${url}#fragment` },
    })
  );
});

test('gate clears stale agent labels, preserves human and unrelated labels', async () => {
  const api = new FakeGitHub();
  api.context.pr.labels = [
    'review:agent-eligible',
    'review:agent-work-needed',
    'review:human-required',
    'bug',
  ].map((name) => ({ name }));
  assert.equal((await gate(api, 'pull_request_target', event())).head, HEAD);
  assert.deepEqual(
    api.context.pr.labels.map((l) => l.name),
    ['review:human-required', 'bug']
  );
  assert.ok(api.context.conversation.some((c) => c.body.startsWith(SUMMARY)));
});

test('forks, non-writers, and outdated bot events never publish or spend inference', async () => {
  for (const mutate of [
    (api) => {
      api.context.pr.head.repo.full_name = 'other/fork';
    },
    (api) => {
      api.permission = 'read';
    },
  ]) {
    const api = new FakeGitHub();
    mutate(api);
    assert.equal(await gate(api, 'pull_request_target', event()), null);
    assert.equal(api.writes.length, 0);
  }
  const api = new FakeGitHub();
  api.context.pr.head.sha = OTHER;
  assert.equal(await gate(api, 'issue_comment', event('issue_comment')), null);
  assert.equal(api.writes.length, 0);
});

test('drafts, closure and review start invalidate routing but do not analyze', async () => {
  for (const state of ['draft', 'closed', 'running']) {
    const api = new FakeGitHub();
    const e = event(state === 'running' ? 'issue_comment' : undefined);
    if (state === 'draft') api.context.pr.draft = true;
    if (state === 'closed') api.context.pr.state = 'closed';
    if (state === 'running')
      e.comment.body = `${CODEX_SUMMARY} {"headSha":"${HEAD}","status":"in_progress"}`;
    assert.equal(
      await gate(
        api,
        state === 'running' ? 'issue_comment' : 'pull_request_target',
        e
      ),
      null
    );
    assert.ok(api.writes.some((w) => w.method === 'DELETE'));
  }
});

test('snapshot includes review bodies and replies but excludes our own output/jobs', async () => {
  const api = new FakeGitHub();
  api.context.comments.push({
    ...rootComment,
    id: 11,
    in_reply_to_id: 10,
    body: 'Fixed?',
  });
  api.context.conversation.push({
    id: 99,
    user: { login: 'github-actions[bot]' },
    body: SUMMARY,
  });
  api.context.checks.push({
    name: 'PR triage assessment',
    status: 'in_progress',
  });
  const snapshot = await collect(api, 6794);
  assert.equal(snapshot.reviews[0].body, 'Finding in the review body');
  assert.equal(snapshot.comments[1].body, 'Fixed?');
  assert.equal(snapshot.conversation.length, 1);
  assert.equal(snapshot.checks.length, 1);
  api.context.pr.changed_files = 2;
  await assert.rejects(collect(api, 6794), /Incomplete PR file list/);
});

test('GitHub pagination collects all pages and fails on a truncated check collection', async () => {
  const api = new GitHub('test-token-not-used');
  const called = [];
  api.request = async (endpoint) => {
    called.push(endpoint);
    return endpoint.endsWith('page=1')
      ? Array.from({ length: 100 }, (_, id) => ({ id }))
      : [{ id: 100 }];
  };
  assert.equal(
    (await api.pages('repos/tloncorp/tlon-apps/pulls/1/comments')).length,
    101
  );
  assert.equal(called.length, 2);
  api.request = async () => ({ total_count: 200, check_runs: [{ id: 1 }] });
  await assert.rejects(
    api.pages('repos/tloncorp/tlon-apps/commits/x/check-runs', 'check_runs'),
    /incomplete/
  );
});

test('ordinary confirmed defect routes to agent work with no human inline comment', async () => {
  const api = new FakeGitHub();
  await publish(api, 6794, expected(api.context), report());
  assert.deepEqual(api.context.pr.labels, [
    { name: 'review:agent-work-needed' },
  ]);
  assert.equal(
    api.writes.filter((w) => w.endpoint.endsWith('/reviews')).length,
    0
  );
  const summary = api.context.conversation.find((c) =>
    c.body.startsWith(SUMMARY)
  );
  assert.match(summary.body, /pullrequestreview-30/);
  assert.match(summary.body, /confirmed/);
});

test('human inline comments use current anchors, deduplicate, preserve other comments', async () => {
  const api = new FakeGitHub();
  const r = report('human-required');
  r.humanDecisions.push({
    ...r.humanDecisions[0],
    path: 'not-in-diff.ts',
    line: 300,
  });
  const exp = expected(api.context);
  await publish(api, 6794, exp, r);
  r.humanDecisions[0].question =
    'Please confirm owner delegation for recovery.';
  await publish(api, 6794, exp, r);
  assert.equal(
    api.writes.filter((w) => w.endpoint.endsWith('/reviews')).length,
    1
  );
  assert.equal(
    api.context.conversation.filter((c) => c.body.startsWith(SUMMARY)).length,
    1
  );
  assert.equal(
    api.context.comments.find((c) => c.id === 10).body,
    'A bounded defect'
  );
  assert.equal(api.context.comments.length, 2);
  assert.match(api.context.comments[1].body, /owner delegation for recovery/);
  assert.ok(
    api.context.pr.labels.some((l) => l.name === 'review:human-required')
  );
});

test('sticky human requirement blocks an eligible label but allows bounded agent work', async () => {
  for (const outcome of ['agent-eligible', 'agent-work-needed']) {
    const api = new FakeGitHub();
    api.context.pr.labels = [{ name: 'review:human-required' }];
    await publish(api, 6794, expected(api.context), report(outcome));
    assert.ok(
      api.context.pr.labels.some((l) => l.name === 'review:human-required')
    );
    assert.ok(
      !api.context.pr.labels.some((l) => l.name === 'review:agent-eligible')
    );
    assert.equal(
      api.context.pr.labels.some((l) => l.name === 'review:agent-work-needed'),
      outcome === 'agent-work-needed'
    );
  }
});

test('incomplete never sets an agent label; valid eligible assessment does', async () => {
  for (const outcome of ['incomplete', 'agent-eligible']) {
    const api = new FakeGitHub();
    await publish(api, 6794, expected(api.context), report(outcome));
    assert.deepEqual(
      api.context.pr.labels.map((l) => l.name),
      outcome === 'agent-eligible' ? ['review:agent-eligible'] : []
    );
  }
});

test('malformed, contradictory or incomplete reports fail before any write', async () => {
  for (const mutate of [
    (r) => {
      r.extraCommand = 'anything';
    },
    (r) => {
      r.outcome = 'merge';
    },
    (r) => {
      r.headSha = OTHER;
    },
    (r) => {
      r.agentWork = [];
    },
    (r) => {
      r.findings = [];
    },
    (r) => {
      r.findings[0].url = 'https://evil.example';
    },
    (r) => {
      r.outcome = 'agent-eligible';
    },
    (r) => {
      r.outcome = 'human-required';
    },
  ]) {
    const api = new FakeGitHub();
    const r = report();
    mutate(r);
    await assert.rejects(publish(api, 6794, expected(api.context), r));
    assert.equal(api.writes.length, 0);
  }
  const r = report('agent-eligible');
  r.gaps = ['Unverified native path'];
  assert.throws(() => validateReport(r, fixture()), /Eligibility/);
});

test('push, base movement, new review body or check changes discard a stale report', async () => {
  for (const mutate of [
    (c) => {
      c.pr.head.sha = OTHER;
    },
    (c) => {
      c.pr.base.sha = OTHER;
    },
    (c) => {
      c.reviews[0].body = 'New finding';
    },
    (c) => {
      c.comments.push({ ...rootComment, id: 55, body: 'New finding' });
    },
    (c) => {
      c.checks[0].conclusion = 'failure';
    },
  ]) {
    const api = new FakeGitHub();
    const exp = expected(api.context);
    mutate(api.context);
    await assert.rejects(publish(api, 6794, exp, report()), /Evidence changed/);
    assert.equal(api.writes.length, 0);
  }
});

test('a push during label publication removes the stale agent label', async () => {
  const api = new FakeGitHub();
  const exp = expected(api.context);
  api.beforeRequest = (endpoint, method) => {
    if (method === 'POST' && endpoint.endsWith('/issues/6794/labels'))
      api.context.pr.head.sha = OTHER;
  };
  await assert.rejects(
    publish(api, 6794, exp, report('agent-eligible')),
    /PR changed/
  );
  assert.deepEqual(api.context.pr.labels, []);
});

test('pending or old Codex summaries cannot support an eligible result', () => {
  for (const body of [
    `${CODEX_SUMMARY} {"headSha":"${HEAD}","status":"in_progress"}`,
    `${CODEX_SUMMARY} {"headSha":"${OTHER}","status":"completed"}`,
  ]) {
    const context = fixture();
    context.conversation[0].body = body;
    assert.throws(
      () => validateReport(report('agent-eligible'), context),
      /Codex review/
    );
  }
});

test('a human requirement added during publication suppresses eligibility', async () => {
  const api = new FakeGitHub();
  const exp = expected(api.context);
  api.beforeRequest = (endpoint, method) => {
    if (method === 'POST' && endpoint.endsWith('/issues/6794/comments'))
      api.context.pr.labels.push({ name: 'review:human-required' });
  };
  await assert.rejects(
    publish(api, 6794, exp, report('agent-eligible')),
    /Human requirement/
  );
  assert.deepEqual(api.context.pr.labels, [{ name: 'review:human-required' }]);
});

test('diff anchors handle deletions, additions, context and missing patches', () => {
  const files = fixture().files;
  for (const side of ['LEFT', 'RIGHT']) {
    assert.equal(
      isDiffLine(files, { path: files[0].filename, line: 11, side }),
      true
    );
    assert.equal(
      isDiffLine(files, { path: files[0].filename, line: 200, side }),
      false
    );
  }
  assert.equal(
    isDiffLine([{ ...files[0], patch: undefined }], {
      path: files[0].filename,
      line: 11,
      side: 'RIGHT',
    }),
    false
  );
  assert.equal(
    isDiffLine([{ ...files[0], patch: files[0].patch + '\n' }], {
      path: files[0].filename,
      line: 13,
      side: 'RIGHT',
    }),
    false
  );
});

test('source preparation uses pinned Git objects and preserves trusted checkout', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'pr-triage-test-'));
  const previous = process.cwd();
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init', '-q');
    git('config', 'user.email', 'triage@example.invalid');
    git('config', 'user.name', 'Triage test');
    writeFileSync(path.join(directory, 'file.txt'), 'base\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    writeFileSync(path.join(directory, 'file.txt'), 'head\n');
    git('commit', '-qam', 'head');
    const head = git('rev-parse', 'HEAD');
    git('checkout', '--detach', base);
    process.chdir(directory);
    const c = fixture();
    c.pr.head.sha = head;
    c.pr.base.sha = base;
    c.comments = [];
    c.reviews = [];
    const out = path.join(directory, 'collected');
    assert.equal(prepareSource(c, out), base);
    assert.equal(git('rev-parse', 'HEAD'), base);
    assert.equal(
      readFileSync(path.join(directory, 'file.txt'), 'utf8'),
      'base\n'
    );
    assert.match(readFileSync(path.join(out, 'pr.diff'), 'utf8'), /\+head/);
    assert.match(
      readFileSync(path.join(out, 'prompt.txt'), 'utf8'),
      /Use \$tlon-pr-triage/
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(out, 'snapshot.json'))).baseline,
      base
    );
  } finally {
    process.chdir(previous);
    rmSync(directory, { recursive: true, force: true });
  }
});

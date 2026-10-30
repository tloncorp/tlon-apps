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
  reconcile,
  reconciliationTargets,
  render,
  renderDetails,
  trigger,
  validateReport,
} from './triage.mjs';

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const OTHER = 'c'.repeat(40);
const url = `https://github.com/${REPO}/pull/6794`;
const codexState = (head = HEAD, status = 'completed') =>
  `${CODEX_SUMMARY}\n<!-- codex-review-state:v1 ${JSON.stringify({
    code_review: { commit_sha: head, status },
    security_review: { commit_sha: OTHER, status: 'completed' },
  })} -->\n<!-- codex-security-review:v1 ${JSON.stringify({ headSha: OTHER, status: 'completed' })} -->`;
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
    base: { sha: BASE, ref: 'develop' },
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
      body: codexState(),
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
  comment: {
    impact: 'Preview controls and their progress lifecycle.',
    validation: 'CI passed; the second-preview scenario still needs coverage.',
    nextSteps:
      outcome === 'agent-eligible'
        ? []
        : ['Correct the progress reset and add a regression check.'],
  },
  complexity: { level: 'high', reason: 'Several lifecycle interactions.' },
  sensitivity: { level: 'medium', reason: 'Recoverable user-visible state.' },
  evidence: outcome === 'agent-eligible' ? 'sufficient' : 'partial',
  checks: ['CI passed; source shows a missing branch.'],
  gaps: [],
  agentWork:
    outcome === 'agent-work-needed' ? ['Correct the bounded defect.'] : [],
  impactMap: [
    {
      behavior: 'Update the preview lifecycle.',
      changedPaths: ['src/example.ts'],
      trace: 'Preview action -> src/example.ts:11 -> rendered progress.',
      consumers: ['Preview component'],
      boundaries: ['Native preview lifecycle'],
      validation: 'Source trace at head and collected CI results.',
      gaps: [],
    },
  ],
  requirements: {
    status: 'assessed',
    sources: [`${url} (PR description, author intent)`],
    summary: 'The documented preview contract was checked.',
    items: [
      {
        requirement: 'Preserve the preview controls.',
        source: `${url} (PR description, author intent)`,
        status: 'met',
        evidence: 'Controls remain reachable in src/example.ts:10-12.',
        nextStep: 'None needed.',
      },
    ],
  },
  reviewCoverage: [
    { url: rootComment.html_url, findingCount: 1, reason: 'Inline defect.' },
    {
      url: `${url}#pullrequestreview-30`,
      findingCount: 1,
      reason: 'One body claim.',
    },
    {
      url: `${url}#issuecomment-20`,
      findingCount: 0,
      reason: 'Completion marker only.',
    },
  ],
  findings: [
    {
      url: rootComment.html_url,
      claim: 'Preview can retain old progress.',
      reviewedRevision: HEAD,
      trigger: 'Open a second preview in the same session.',
      trace:
        'The preview caller reaches the progress branch at src/example.ts:11.',
      validationMethod: 'source-inspection',
      verdict: outcome === 'agent-eligible' ? 'already-fixed' : 'confirmed',
      currentStatus: 'Verified at head.',
      evidence: ['Exact source inspection.'],
      counterevidence: [],
      proofGaps: [],
      nextStep:
        outcome === 'agent-eligible'
          ? 'None needed.'
          : 'Correct the progress reset.',
      fixAssessment:
        'The proposed reset preserves the established lifecycle contract.',
      handling: {
        owner:
          outcome === 'agent-eligible'
            ? 'none'
            : outcome === 'human-required'
              ? 'human'
              : 'agent',
        summary:
          'The progress branch retains state across previews; reset it and add a regression test.',
        humanQuestion:
          outcome === 'human-required'
            ? 'May this operation use owner authority?'
            : '',
      },
    },
    {
      url: `${url}#pullrequestreview-30`,
      claim: 'Native previews can reach the web-only branch.',
      reviewedRevision: HEAD,
      trigger: 'Open the preview on native.',
      trace: 'The caller platform guard at src/example.ts:10 excludes native.',
      validationMethod: 'source-inspection',
      verdict: 'refuted',
      currentStatus: 'Unreachable on this platform.',
      evidence: ['Caller platform guard.'],
      counterevidence: ['Native returns before the web-only branch.'],
      proofGaps: [],
      nextStep: 'None needed.',
      fixAssessment: 'The suggested extra guard is unnecessary on this path.',
      handling: {
        owner: 'none',
        summary:
          'The caller returns on native before reaching this branch; no change is needed.',
        humanQuestion: '',
      },
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
  suggestions: [],
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
    this.role = 'write';
    this.nextId = 1000;
    this.observedRun = {
      id: 50,
      path: '.github/workflows/pr-triage-review-activity.yml',
      event: 'pull_request_review_comment',
      actor: { login: BOT },
      triggering_actor: { login: BOT },
      head_repository: { full_name: REPO },
      pull_requests: [{ number: 6794 }],
    };
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
        return { permission: this.permission, role_name: this.role };
      if (endpoint.endsWith('/actions/runs/50'))
        return structuredClone(this.observedRun);
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
    } else if (endpoint.endsWith('/replies')) {
      const reviewId = this.nextId++;
      this.context.reviews.push({
        id: reviewId,
        user: { login: 'github-actions[bot]' },
        state: 'COMMENTED',
        body: '',
        commit_id: this.context.pr.head.sha,
      });
      this.context.comments.push({
        id: this.nextId++,
        pull_request_review_id: reviewId,
        in_reply_to_id: Number(endpoint.split('/').at(-2)),
        user: { login: 'github-actions[bot]' },
        ...body,
      });
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
        id: this.nextId++,
        user: { login: 'github-actions[bot]' },
        ...body,
      });
    } else if (endpoint.endsWith('/reviews')) {
      this.context.reviews.push({
        id: this.nextId++,
        user: { login: 'github-actions[bot]' },
        body: body.body,
      });
      this.context.comments.push(
        ...body.comments.map((c, i) => ({
          id: this.nextId++,
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

test('only authenticated Codex discussion events trigger counter-review; edits count', () => {
  const e = event('issue_comment');
  e.action = 'edited';
  assert.deepEqual(trigger('issue_comment', e), {
    number: 6794,
    analyze: true,
    reviewedHead: HEAD,
    codexActivity: true,
  });
  e.comment.body = codexState(HEAD, 'in_progress');
  assert.equal(trigger('issue_comment', e).codexActivity, true);
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

test('human-label changes withdraw routing without analysis or label event loops', async () => {
  for (const action of ['labeled', 'unlabeled']) {
    const api = new FakeGitHub();
    api.context.pr.labels = [
      'review:agent-eligible',
      ...(action === 'labeled' ? ['review:human-required'] : []),
      'bug',
    ].map((name) => ({ name }));
    const e = { ...event(), action, label: { name: 'review:human-required' } };
    assert.equal(await gate(api, 'pull_request_target', e), null);
    assert.deepEqual(
      api.context.pr.labels.map((l) => l.name),
      [...(action === 'labeled' ? ['review:human-required'] : []), 'bug']
    );
    assert.match(api.context.conversation.at(-1).body, /requirement changed/);
    const count = api.writes.length;
    for (const name of [
      'review:agent-eligible',
      'review:agent-work-needed',
      'bug',
    ]) {
      e.label.name = name;
      assert.equal(await gate(api, 'pull_request_target', e), null);
    }
    assert.equal(api.writes.length, count);
  }
});

test('reconciliation targets only routed same-repository PRs on the affected base', async () => {
  const prs = Array.from({ length: 4 }, (_, i) => ({
    ...fixture().pr,
    number: i + 1,
    labels: [{ name: 'review:agent-eligible' }],
  }));
  prs[1].base = { sha: BASE, ref: 'release' };
  prs[2].labels = [{ name: 'review:human-required' }];
  prs[3].head = { sha: HEAD, repo: { full_name: 'other/fork' } };
  const api = { pages: async () => prs };
  const e = { repository: { full_name: REPO }, ref: 'refs/heads/develop' };
  assert.deepEqual(await reconciliationTargets(api, 'push', e), [1]);
  assert.deepEqual(await reconciliationTargets(api, 'schedule', e), [1, 2]);
  assert.deepEqual(
    await reconciliationTargets(api, 'workflow_dispatch', e),
    [1, 2]
  );
  assert.deepEqual(await reconciliationTargets(api, 'issue_comment', e), []);
  assert.deepEqual(
    await reconciliationTargets(api, 'push', { ...e, ref: 'refs/tags/v1' }),
    []
  );
  assert.deepEqual(
    await reconciliationTargets(api, 'schedule', {
      repository: { full_name: 'other/repo' },
    }),
    []
  );
});

test('base advancement withdraws an already-published label even when the head stays fixed', async () => {
  const api = new FakeGitHub();
  await publish(api, 6794, expected(api.context), report('agent-eligible'));
  const count = api.writes.length;
  assert.equal(await reconcile(api, 6794), false);
  assert.equal(api.writes.length, count);
  api.context.pr.base.sha = OTHER;
  assert.equal(await reconcile(api, 6794), true);
  assert.equal(api.context.pr.head.sha, HEAD);
  assert.deepEqual(api.context.pr.labels, []);
  assert.match(
    api.context.conversation.find((c) => c.body.startsWith(SUMMARY)).body,
    /incomplete/
  );
  const after = api.writes.length;
  assert.equal(await reconcile(api, 6794), false);
  assert.equal(api.writes.length, after);
});

test('reconciliation rechecks publication state and preserves fresh routing and human requirements', async () => {
  const api = new FakeGitHub();
  // Discovery happened before a new assessment completed on the new base.
  api.context.pr.base.sha = OTHER;
  await publish(api, 6794, expected(api.context), report('agent-eligible'));
  assert.equal(await reconcile(api, 6794), false);
  api.context.pr.labels.push(
    { name: 'review:human-required' },
    { name: 'bug' }
  );
  assert.equal(await reconcile(api, 6794), true);
  assert.deepEqual(api.context.pr.labels, [
    { name: 'review:human-required' },
    { name: 'bug' },
  ]);
});

test('routing without a trusted revision record is withdrawn conservatively', async () => {
  for (const login of ['contributor', 'github-actions[bot]']) {
    const api = new FakeGitHub();
    api.context.pr.labels = [
      { name: 'review:agent-work-needed' },
      { name: 'review:human-required' },
    ];
    api.context.conversation.push({
      id: 100,
      user: { login },
      body:
        login === 'contributor'
          ? render(report('agent-work-needed'), expected(api.context), true)
          : `${SUMMARY}\n<!-- tlon-pr-triage-revision:v1 malformed -->`,
    });
    assert.equal(await reconcile(api, 6794), true);
    assert.deepEqual(api.context.pr.labels, [
      { name: 'review:human-required' },
    ]);
  }
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
    if (state === 'running') {
      e.comment.body = codexState(HEAD, 'in_progress');
      api.context.conversation[0].body = e.comment.body;
    }
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

test('tooling check failures remain visible and invalidate the evidence fingerprint', async () => {
  const api = new FakeGitHub();
  api.context.checks.push({
    id: 41,
    name: 'PR triage tooling tests',
    head_sha: HEAD,
    status: 'completed',
    conclusion: 'success',
  });
  for (const name of [
    'PR triage gate',
    'PR triage assessment',
    'PR triage publication',
    'PR triage review activity',
  ])
    api.context.checks.push({ name, status: 'in_progress' });
  const before = await collect(api, 6794);
  assert.deepEqual(
    before.checks.map((c) => c.name),
    ['Tests', 'PR triage tooling tests']
  );
  api.context.checks.find((c) => c.id === 41).conclusion = 'failure';
  const after = await collect(api, 6794);
  assert.equal(after.checks.find((c) => c.id === 41).conclusion, 'failure');
  assert.notEqual(fingerprint(before), fingerprint(after));
  await assert.rejects(
    publish(api, 6794, expected(before), report('agent-eligible')),
    /Evidence changed/
  );
  assert.equal(api.writes.length, 0);
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
  assert.match(summary.body, /confirmed/);
  assert.ok(summary.body.includes(report().comment.nextSteps[0]));
  const details = renderDetails(report(), expected(api.context), false);
  assert.match(details, /pullrequestreview-30/);
  assert.match(details, /Update the preview lifecycle/);
  assert.match(details, /Preserve the preview controls/);
  assert.match(details, /Native returns before the web-only branch/);
  assert.match(details, /Completion marker only/);
  assert.match(details, /suggested extra guard is unnecessary/);
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
  r.findings[0].handling.humanQuestion = r.humanDecisions[0].question;
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
  assert.equal(api.context.comments.length, 3);
  assert.match(
    api.context.comments.find((c) =>
      c.body.startsWith('<!-- tlon-pr-triage-decision:')
    ).body,
    /owner delegation for recovery/
  );
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

test('counter-review requires method, proof and explicit counterevidence before publication', async () => {
  for (const mutate of [
    (r) => {
      delete r.findings[0].trigger;
    },
    (r) => {
      r.findings[0].evidence = [];
    },
    (r) => {
      r.findings[0].validationMethod = 'none';
    },
    (r) => {
      r.findings[0].validationMethod = 'local-reproduction';
    },
    (r) => {
      r.findings[1].counterevidence = [];
    },
    (r) => {
      r.findings[0].reviewedRevision = 'latest';
    },
    (r) => {
      r.findings[0].verdict = 'inconclusive';
    },
  ]) {
    const api = new FakeGitHub();
    const r = report();
    mutate(r);
    await assert.rejects(publish(api, 6794, expected(api.context), r));
    assert.equal(api.writes.length, 0);
  }
  const r = report('incomplete');
  Object.assign(r.findings[0], {
    reviewedRevision: 'unknown',
    verdict: 'inconclusive',
    validationMethod: 'none',
    evidence: [],
    proofGaps: ['The reviewed revision is unavailable.'],
    nextStep: 'Recover the reviewed source revision.',
  });
  const context = fixture();
  delete context.comments[0].original_commit_id;
  assert.doesNotThrow(() => validateReport(r, context));
});

test('coverage preserves multiple claims in a body and explains status-only messages', async () => {
  const api = new FakeGitHub();
  api.context.reviews[0].body = 'Two distinct findings in the review body';
  const r = report();
  r.findings.push({
    ...r.findings[1],
    claim: 'A separate callback is unguarded.',
  });
  r.reviewCoverage[1].findingCount = 2;
  r.reviewCoverage[1].reason = 'Two independently assessed claims.';
  await publish(api, 6794, expected(api.context), r);
  const summary = api.context.conversation.find((c) =>
    c.body.startsWith(SUMMARY)
  );
  assert.match(summary.body, /2 refuted/);
  const details = renderDetails(r, expected(api.context), false);
  assert.match(details, /Two independently assessed claims/);
  assert.match(details, /A separate callback is unguarded/);

  for (const mutate of [
    (r) => {
      r.reviewCoverage.splice(1, 1);
    },
    (r) => {
      r.reviewCoverage[1].findingCount = 2;
    },
    (r) => {
      r.reviewCoverage[1].url = `${url}#nonexistent`;
    },
    (r) => {
      r.reviewCoverage.push(r.reviewCoverage[0]);
    },
    (r) => {
      r.findings.push(r.findings[1]);
      r.reviewCoverage[1].findingCount = 2;
    },
  ]) {
    const api = new FakeGitHub();
    const r = report();
    mutate(r);
    await assert.rejects(publish(api, 6794, expected(api.context), r));
    assert.equal(api.writes.length, 0);
  }
});

test('impact map accounts for changed files and permits explicit incomplete coverage', () => {
  const context = fixture();
  context.files.push({ filename: 'src/other.ts', status: 'modified' });
  const r = report('incomplete');
  assert.throws(() => validateReport(r, context), /Impact map omits/);
  r.gaps = ['src/other.ts could not be inspected.'];
  assert.doesNotThrow(() => validateReport(r, context));
  r.gaps = [];
  r.impactMap[0].changedPaths.push('src/other.ts');
  assert.doesNotThrow(() => validateReport(r, context));
  r.impactMap[0].changedPaths.push('src/not-in-diff.ts');
  assert.throws(() => validateReport(r, context), /outside the change/);
});

test('nested proof gaps and unresolved requirements cannot silently become eligible', async () => {
  for (const mutate of [
    (r) => {
      r.impactMap[0].gaps = ['Unverified native consumer.'];
    },
    (r) => {
      r.findings[0].proofGaps = ['The correction was not verified.'];
    },
    (r) => {
      r.requirements.status = 'unavailable';
    },
    (r) => {
      r.requirements.items[0].status = 'unmet';
    },
    (r) => {
      r.requirements.items[0].status = 'unclear';
    },
  ]) {
    const api = new FakeGitHub();
    const r = report('agent-eligible');
    mutate(r);
    await assert.rejects(
      publish(api, 6794, expected(api.context), r),
      /Eligibility/
    );
    assert.equal(api.writes.length, 0);
  }
});

test('no bot findings does not bypass impact or requirements assessment', async () => {
  const api = new FakeGitHub();
  api.context.comments = [];
  api.context.reviews = [];
  const r = report('agent-eligible');
  r.findings = [];
  r.reviewCoverage = r.reviewCoverage.filter((item) => item.findingCount === 0);
  r.impactMap = [];
  await assert.rejects(
    publish(api, 6794, expected(api.context), r),
    /Impact map omits/
  );
  r.impactMap = report().impactMap;
  r.requirements.items[0].status = 'unmet';
  r.requirements.items[0].nextStep = 'Restore the documented control behavior.';
  await assert.rejects(
    publish(api, 6794, expected(api.context), r),
    /Eligibility/
  );
  assert.equal(api.writes.length, 0);
  r.outcome = 'agent-work-needed';
  r.agentWork = ['Restore the documented control behavior.'];
  r.comment.nextSteps = ['Restore the documented control behavior.'];
  await publish(api, 6794, expected(api.context), r);
  assert.deepEqual(api.context.pr.labels, [
    { name: 'review:agent-work-needed' },
  ]);
});

test('large ledgers stay complete in the report without expanding the PR comment', () => {
  const r = report();
  const short = render(r, expected(fixture()), false);
  r.findings[0].trace = 'Detailed source trace. '.repeat(400);
  r.findings[0].evidence.push('Additional evidence. '.repeat(400));
  r.impactMap[0].trace = 'Expanded caller map. '.repeat(400);
  assert.equal(render(r, expected(fixture()), false), short);
  assert.ok(short.length < 2500);
  assert.ok(
    renderDetails(r, expected(fixture()), false).includes(r.findings[0].trace)
  );
  assert.doesNotMatch(short, /runs\/undefined|runs\/null/);
});

test('hosted publication retains the full report and links it from the concise comment', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'triage-summary-'));
  const previousSummary = process.env.GITHUB_STEP_SUMMARY;
  const previousRun = process.env.GITHUB_RUN_ID;
  process.env.GITHUB_STEP_SUMMARY = path.join(directory, 'report.md');
  process.env.GITHUB_RUN_ID = '1234';
  try {
    const api = new FakeGitHub();
    const r = report();
    await publish(api, 6794, expected(api.context), r);
    const details = readFileSync(process.env.GITHUB_STEP_SUMMARY, 'utf8');
    assert.ok(details.includes(r.findings[0].trace));
    assert.ok(details.includes(r.findings[1].counterevidence[0]));
    const summary = api.context.conversation.find((c) =>
      c.body.startsWith(SUMMARY)
    ).body;
    assert.ok(summary.includes(`https://github.com/${REPO}/actions/runs/1234`));
    assert.ok(!summary.includes(r.findings[0].trace));
  } finally {
    if (previousSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = previousSummary;
    if (previousRun === undefined) delete process.env.GITHUB_RUN_ID;
    else process.env.GITHUB_RUN_ID = previousRun;
    rmSync(directory, { recursive: true, force: true });
  }
});

const suggestion = () => ({
  findingUrl: rootComment.html_url,
  claim: report().findings[0].claim,
  path: 'src/example.ts',
  startLine: 10,
  line: 11,
  original: 'context\nnew',
  replacement: 'context\nreset("@owner");',
  reason: 'Reset progress when opening a second preview.',
  validation: 'Source inspected; run the regression check before merging.',
});

test('suggestions publish exact code with multi-line anchors, deduplicate and stay out of evidence', async () => {
  const api = new FakeGitHub();
  const r = report();
  r.suggestions = [suggestion()];
  const exp = expected(api.context);
  await publish(api, 6794, exp, r);
  await publish(api, 6794, exp, r);
  const reviews = api.writes.filter((w) => w.endpoint.endsWith('/reviews'));
  assert.equal(reviews.length, 1);
  const [comment] = reviews[0].body.comments;
  assert.equal(comment.start_line, 10);
  assert.equal(comment.start_side, 'RIGHT');
  assert.equal(comment.line, 11);
  assert.equal(comment.side, 'RIGHT');
  assert.ok(
    comment.body.includes(
      '```suggestion\n' + r.suggestions[0].replacement + '\n```'
    )
  );
  assert.equal(reviews[0].body.event, 'COMMENT');
  assert.equal(reviews[0].body.commit_id, HEAD);
  assert.equal(fingerprint(await collect(api, 6794)), exp.fingerprint);
  r.suggestions[0].reason = 'Reset progress before loading the second preview.';
  await publish(api, 6794, exp, r);
  assert.equal(api.context.comments.length, 3);
  assert.ok(
    api.context.comments
      .find((c) => c.body.startsWith('<!-- tlon-pr-triage-suggestion:'))
      .body.includes(r.suggestions[0].reason)
  );
});

test('single-line suggestions omit multi-line fields and support deletions', async () => {
  const api = new FakeGitHub();
  const r = report();
  r.suggestions = [
    { ...suggestion(), startLine: 11, original: 'new', replacement: '' },
  ];
  await publish(api, 6794, expected(api.context), r);
  const comment = api.writes.find((w) => w.endpoint.endsWith('/reviews')).body
    .comments[0];
  assert.equal(comment.start_line, undefined);
  assert.equal(comment.start_side, undefined);
  assert.ok(comment.body.includes('```suggestion\n\n```'));
});

test('unproven, stale, overlapping or inapplicable suggestions fail before writes', async () => {
  for (const mutate of [
    (r) => {
      r.findings[0].verdict = 'refuted';
      r.findings[0].counterevidence = ['Guard'];
    },
    (r) => {
      r.findings[0].reviewedRevision = OTHER;
    },
    (r) => {
      r.suggestions[0].claim = 'Untracked claim';
    },
    (r) => {
      r.suggestions[0].original = 'Outdated text';
    },
    (r) => {
      r.suggestions[0].path = 'not-in-diff.ts';
    },
    (r) => {
      r.suggestions[0].line = 50;
    },
    (r) => {
      r.suggestions[0].startLine = 12;
    },
    (r) => {
      r.suggestions[0].replacement = '```\noutside fence';
    },
    (r) => {
      r.suggestions[0].replacement = r.suggestions[0].original;
    },
    (r) => {
      r.suggestions.push(suggestion());
    },
    (r) => {
      r.outcome = 'incomplete';
    },
    (r) => {
      r.outcome = 'human-required';
      r.humanDecisions = report('human-required').humanDecisions;
    },
  ]) {
    const api = new FakeGitHub();
    const r = report();
    r.suggestions = [suggestion()];
    mutate(r);
    await assert.rejects(publish(api, 6794, expected(api.context), r));
    assert.equal(api.writes.length, 0);
  }
  const context = fixture();
  context.files[0].patch = '@@ -10 +10 @@\n context\n@@ -11 +11 @@\n-old\n+new';
  const r = report();
  r.suggestions = [suggestion()];
  assert.throws(() => validateReport(r, context), /exact current diff text/);
});

test('requirements distinguish bounded mismatches, human choices, and no source found', async () => {
  for (const outcome of [
    'agent-work-needed',
    'human-required',
    'agent-eligible',
  ]) {
    const api = new FakeGitHub();
    const r = report(outcome);
    if (outcome === 'agent-eligible') {
      r.requirements = {
        status: 'not-found',
        sources: [],
        items: [],
        summary:
          'No requirement source found; the mechanical change preserves behavior.',
      };
    } else {
      r.requirements.items[0].status =
        outcome === 'human-required' ? 'unclear' : 'unmet';
      r.requirements.items[0].nextStep =
        outcome === 'human-required'
          ? 'Confirm the intended owner authority.'
          : 'Restore the documented control behavior.';
    }
    await publish(api, 6794, expected(api.context), r);
    assert.deepEqual(api.context.pr.labels, [{ name: `review:${outcome}` }]);
  }
  for (const mutate of [
    (r) => {
      r.requirements.items[0].source = 'An invented specification';
    },
    (r) => {
      r.requirements.sources = [];
    },
    (r) => {
      r.requirements.items = [];
    },
    (r) => {
      r.requirements.status = 'not-found';
    },
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => validateReport(r, fixture()), /[Rr]equirement/);
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

test('missing, malformed, pending or old code reviews cannot support eligibility', () => {
  for (const body of [
    null,
    codexState(HEAD, 'in_progress'),
    codexState(OTHER),
    `${CODEX_SUMMARY}\n<!-- codex-security-review:v1 {"headSha":"${HEAD}","status":"completed"} -->`,
    `${CODEX_SUMMARY}\n<!-- codex-review-state:v1 {broken} -->`,
    `${CODEX_SUMMARY}\n<!-- codex-review-state:v1 null -->`,
    codexState() + '\n' + codexState(),
  ]) {
    const context = fixture();
    if (body === null) context.conversation = [];
    else context.conversation[0].body = body;
    assert.throws(
      () => validateReport(report('agent-eligible'), context),
      /Codex review/
    );
  }
});

test('code-review completion is independent of a missing or stale security block', () => {
  for (const body of [
    codexState(),
    codexState().split('\n<!-- codex-security-review:v1')[0],
  ]) {
    const context = fixture();
    context.conversation[0].body = body;
    validateReport(report('agent-eligible'), context);
    const e = event('issue_comment');
    e.comment.body = body;
    assert.deepEqual(trigger('issue_comment', e), {
      number: 6794,
      analyze: true,
      reviewedHead: HEAD,
      codexActivity: true,
    });
  }
});

test('completed security review cannot mask a pending code review in publication', async () => {
  const api = new FakeGitHub();
  api.context.conversation[0].body = codexState(HEAD, 'in_progress').replaceAll(
    OTHER,
    HEAD
  );
  await assert.rejects(
    publish(api, 6794, expected(api.context), report('agent-eligible')),
    /Codex review/
  );
  assert.equal(api.writes.length, 0);
});

test('a stale human publication retains human requirements until a maintainer clears them', async () => {
  for (const existing of [false, true]) {
    const api = new FakeGitHub();
    if (existing) api.context.pr.labels.push({ name: 'review:human-required' });
    const exp = expected(api.context);
    api.beforeRequest = (endpoint, method) => {
      if (method === 'POST' && endpoint.endsWith('/issues/6794/labels'))
        api.context.pr.head.sha = OTHER;
    };
    await assert.rejects(
      publish(api, 6794, exp, report('human-required')),
      /PR changed/
    );
    assert.ok(
      api.context.pr.labels.some((l) => l.name === 'review:human-required')
    );
    assert.ok(
      !api.writes.some(
        (w) =>
          w.method === 'DELETE' &&
          w.endpoint.endsWith('review%3Ahuman-required')
      )
    );
  }
});

test('a human requirement added during publication suppresses eligibility', async () => {
  const api = new FakeGitHub();
  const exp = expected(api.context);
  api.beforeRequest = (endpoint, method) => {
    if (
      method === 'POST' &&
      endpoint.endsWith('/issues/6794/comments') &&
      !api.context.pr.labels.some((l) => l.name === 'review:human-required')
    )
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

const observerEvent = (api) => ({
  repository: { full_name: REPO },
  action: 'completed',
  workflow_run: structuredClone(api.observedRun),
});

test('review observer requires authenticated run metadata and fresh completed review', async () => {
  for (const eventName of [
    'pull_request_review',
    'pull_request_review_comment',
  ]) {
    const api = new FakeGitHub();
    api.observedRun.event = eventName;
    assert.deepEqual(await gate(api, 'workflow_run', observerEvent(api)), {
      number: 6794,
      head: HEAD,
    });
  }
  for (const status of ['in_progress', 'failed', 'missing', 'old']) {
    const api = new FakeGitHub();
    api.context.conversation[0].body =
      status === 'missing'
        ? 'Review queued'
        : codexState(
            status === 'old' ? OTHER : HEAD,
            status === 'old' ? 'completed' : status
          );
    assert.equal(await gate(api, 'workflow_run', observerEvent(api)), null);
    assert.ok(api.writes.some((w) => w.method === 'DELETE'));
  }
});

test('untrusted observer events and mismatched API runs cannot start paid analysis', async () => {
  for (const mutate of [
    (run) => {
      run.actor.login = 'contributor';
    },
    (run) => {
      run.triggering_actor.login = 'contributor';
    },
    (run) => {
      run.path = '.github/workflows/untrusted.yml';
    },
    (run) => {
      run.event = 'workflow_dispatch';
    },
    (run) => {
      run.head_repository.full_name = 'other/fork';
    },
    (run) => {
      run.pull_requests = [];
    },
    (run) => {
      run.pull_requests.push({ number: 7000 });
    },
  ]) {
    const api = new FakeGitHub();
    const e = observerEvent(api);
    mutate(e.workflow_run);
    assert.equal(await gate(api, 'workflow_run', e), null);
    assert.equal(api.writes.length, 0);
  }
  const api = new FakeGitHub();
  const e = observerEvent(api);
  api.observedRun.pull_requests[0].number = 7000;
  assert.equal(await gate(api, 'workflow_run', e), null);
  assert.equal(api.writes.length, 0);
});

test('ordinary Codex conversation findings trigger analysis only after completion', async () => {
  const api = new FakeGitHub();
  const e = event('issue_comment');
  e.comment = {
    user: { login: BOT },
    body: 'A new defect discovered in follow-up.',
  };
  assert.deepEqual(await gate(api, 'issue_comment', e), {
    number: 6794,
    head: HEAD,
  });
  api.context.conversation[0].body = codexState(HEAD, 'in_progress');
  assert.equal(await gate(api, 'issue_comment', e), null);
});

test('repeated completion signals skip identical published evidence, edits rerun', async () => {
  const api = new FakeGitHub();
  await publish(api, 6794, expected(api.context), report());
  api.writes = [];
  assert.equal(await gate(api, 'workflow_run', observerEvent(api)), null);
  assert.equal(await gate(api, 'issue_comment', event('issue_comment')), null);
  assert.equal(api.writes.length, 0);
  api.context.comments[0].body += ' Additional triggering scenario.';
  assert.deepEqual(await gate(api, 'workflow_run', observerEvent(api)), {
    number: 6794,
    head: HEAD,
  });
  assert.ok(api.writes.some((w) => w.method === 'DELETE'));
});

test('triage-role close and reopen events invalidate without allowing paid analysis', async () => {
  for (const action of ['closed', 'reopened', 'edited', 'ready_for_review']) {
    const api = new FakeGitHub();
    api.permission = 'read';
    api.role = 'triage';
    api.context.pr.labels = [
      { name: 'review:agent-eligible' },
      { name: 'review:human-required' },
    ];
    const e = { ...event(), action };
    assert.equal(await gate(api, 'pull_request_target', e), null);
    assert.deepEqual(api.context.pr.labels, [
      { name: 'review:human-required' },
    ]);
  }
  const api = new FakeGitHub();
  api.permission = 'read';
  api.role = 'triage';
  assert.equal(
    await gate(api, 'workflow_dispatch', {
      ...event(),
      inputs: { pr_url: url },
    }),
    null
  );
  assert.equal(api.writes.length, 0);
});

test('finding handling cannot hide work or invent a human decision', async () => {
  for (const mutate of [
    (r) => {
      delete r.findings[0].handling;
    },
    (r) => {
      r.findings[0].handling.owner = 'none';
    },
    (r) => {
      r.findings[1].handling.owner = 'agent';
    },
    (r) => {
      r.findings[0].handling.owner = 'human';
    },
    (r) => {
      r.findings[0].handling.humanQuestion = 'Unrecorded choice';
    },
    (r) => {
      r.findings[0].handling.summary = '';
    },
    (r) => {
      r.findings[0].handling.owner = 'undetermined';
      r.suggestions = [suggestion()];
    },
  ]) {
    const api = new FakeGitHub();
    const r = report();
    mutate(r);
    await assert.rejects(publish(api, 6794, expected(api.context), r));
    assert.equal(api.writes.length, 0);
  }
  const r = report('human-required');
  r.findings[0].handling.humanQuestion = 'A different question';
  assert.throws(() => validateReport(r, fixture()), /matching human decision/);
});

test('source metadata controls reviewed revision and prevents current-head suggestion spoofing', async () => {
  const api = new FakeGitHub();
  api.context.comments[0].original_commit_id = OTHER;
  api.context.comments[0].commit_id = HEAD;
  const r = report();
  r.suggestions = [suggestion()];
  await assert.rejects(
    publish(api, 6794, expected(api.context), r),
    /revision does not match/
  );
  assert.equal(api.writes.length, 0);
  r.findings[0].reviewedRevision = OTHER;
  assert.throws(
    () => validateReport(r, api.context),
    /current-head agent task/
  );
  r.suggestions = [];
  validateReport(r, api.context);
  r.findings[1].reviewedRevision = OTHER;
  assert.throws(
    () => validateReport(r, api.context),
    /revision does not match/
  );
});

test('counter-review replies update per root across heads and keep original comments intact', async () => {
  const api = new FakeGitHub();
  const r = report();
  await publish(api, 6794, expected(api.context), r);
  const reply = api.context.comments.find((c) => c.in_reply_to_id === 10);
  assert.match(reply.body, /confirmed.*Agent work/);
  assert.ok(reply.body.includes(r.findings[0].handling.summary));
  assert.ok(reply.body.length < 1000);
  const writes = api.writes.filter((w) =>
    w.endpoint.endsWith('/replies')
  ).length;
  await publish(api, 6794, expected(await collect(api, 6794)), r);
  assert.equal(
    api.writes.filter((w) => w.endpoint.endsWith('/replies')).length,
    writes
  );
  api.context.pr.head.sha = OTHER;
  api.context.conversation[0].body = codexState(OTHER);
  r.headSha = OTHER;
  r.findings[0].verdict = 'already-fixed';
  r.findings[0].handling = {
    owner: 'none',
    summary:
      'The new reset handles the second preview; no further change is needed.',
    humanQuestion: '',
  };
  await publish(api, 6794, expected(await collect(api, 6794)), r);
  assert.equal(api.context.comments.length, 2);
  assert.match(reply.body, /already-fixed.*No action/);
  assert.ok(reply.body.includes(OTHER));
  assert.equal(api.context.comments[0].body, rootComment.body);
});

test('multiple inline claims share one reply; body and conversation claims share one digest', async () => {
  const api = new FakeGitHub();
  const r = report();
  r.findings.push({
    ...structuredClone(r.findings[0]),
    claim: 'A second condition in this same thread.',
  });
  r.reviewCoverage[0].findingCount++;
  api.context.conversation.push({
    id: 21,
    user: { login: BOT },
    html_url: `${url}#issuecomment-21`,
    body: 'A follow-up claim.',
  });
  r.findings.push({
    ...structuredClone(r.findings[1]),
    url: `${url}#issuecomment-21`,
    reviewedRevision: 'unknown',
  });
  r.reviewCoverage.push({
    url: `${url}#issuecomment-21`,
    findingCount: 1,
    reason: 'A follow-up claim.',
  });
  const exp = expected(api.context);
  await publish(api, 6794, exp, r);
  await publish(api, 6794, exp, r);
  assert.equal(
    api.context.comments.filter((c) => c.in_reply_to_id === 10).length,
    1
  );
  const digest = api.context.conversation.filter((c) =>
    c.body.startsWith('<!-- tlon-pr-triage-counter:v1:digest')
  );
  assert.equal(digest.length, 1);
  assert.match(digest[0].body, /pullrequestreview-30/);
  assert.match(digest[0].body, /issuecomment-21/);
  assert.equal(fingerprint(await collect(api, 6794)), exp.fingerprint);
});

test('externally replied-to triage roots retain context without fingerprinting our output', async () => {
  const api = new FakeGitHub();
  const exp = expected(api.context);
  await publish(api, 6794, exp, report('human-required'));
  const root = api.context.comments.find((c) =>
    c.body.startsWith('<!-- tlon-pr-triage-decision:')
  );
  assert.equal(
    (await collect(api, 6794)).comments.some((c) => c.id === root.id),
    false
  );
  api.context.comments.push({
    id: 2000,
    in_reply_to_id: root.id,
    user: { login: 'maintainer' },
    body: 'Yes, as described.',
  });
  const before = await collect(api, 6794);
  assert.ok(before.comments.some((c) => c.id === root.id));
  assert.notEqual(fingerprint(before), exp.fingerprint);
  root.body += '\nUpdated evidence.';
  assert.equal(fingerprint(await collect(api, 6794)), fingerprint(before));
  api.context.comments.at(-1).body = 'No; keep the existing authority.';
  assert.notEqual(fingerprint(await collect(api, 6794)), fingerprint(before));
});

test('same-head evidence changes during reply or summary writes prevent routing', async () => {
  for (const target of ['reply', 'summary']) {
    for (const change of ['check', 'review']) {
      const api = new FakeGitHub();
      const exp = expected(api.context);
      api.beforeRequest = (endpoint, method, body) => {
        if (
          method !== 'POST' ||
          !(target === 'reply'
            ? endpoint.endsWith('/replies')
            : body?.body?.startsWith(SUMMARY))
        )
          return;
        if (change === 'check') api.context.checks[0].conclusion = 'failure';
        else api.context.reviews[0].body += ' New material evidence.';
      };
      await assert.rejects(
        publish(api, 6794, exp, report('agent-eligible')),
        /Evidence changed while publishing/
      );
      assert.equal(api.context.pr.labels.length, 0);
      assert.ok(
        !api.writes.some(
          (w) =>
            w.endpoint.endsWith('/issues/6794/labels') && w.method === 'POST'
        )
      );
    }
  }
});

test('reply-generated blank reviews are excluded without hiding unrelated automation reviews', async () => {
  const api = new FakeGitHub();
  const exp = expected(api.context);
  await publish(api, 6794, exp, report());
  assert.ok(
    api.context.reviews.some(
      (r) =>
        r.user.login === 'github-actions[bot]' &&
        r.body === '' &&
        r.state === 'COMMENTED'
    )
  );
  assert.equal(fingerprint(await collect(api, 6794)), exp.fingerprint);
  api.context.reviews.push({
    id: 9000,
    user: { login: 'github-actions[bot]' },
    body: '',
    state: 'COMMENTED',
    commit_id: HEAD,
  });
  api.context.comments.push({
    id: 9001,
    user: { login: 'github-actions[bot]' },
    body: 'A different automation finding.',
    pull_request_review_id: 9000,
  });
  const context = await collect(api, 6794);
  assert.ok(context.reviews.some((r) => r.id === 9000));
  assert.notEqual(fingerprint(context), exp.fingerprint);
});

test('duplicate Codex signals still invalidate routing on closed or draft PRs', async () => {
  for (const state of ['closed', 'draft']) {
    const api = new FakeGitHub();
    await publish(api, 6794, expected(api.context), report('agent-eligible'));
    if (state === 'closed') api.context.pr.state = 'closed';
    else api.context.pr.draft = true;
    assert.equal(await gate(api, 'workflow_run', observerEvent(api)), null);
    assert.equal(api.context.pr.labels.length, 0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  planComment,
  renderComment,
  publishComment,
  markerFor,
  repo,
} from './comment.mjs';
const oldUrl =
  'https://expo.dev/accounts/tlon/projects/groups/workflows/01a092e3-63cb-71e7-96bb-3f5090512e96';
const url =
  'https://expo.dev/accounts/tlon/projects/groups/workflows/01a092ed-0373-7c5d-be46-32dac446b2c5';
const head = 'a'.repeat(40);
const blocked = { url: oldUrl, head, key: 'old', kind: 'blocked' };
const complete = { url, head, key: 'new', kind: 'report' };
const make = (id, body, user = 1) => ({
  id,
  body,
  user: { id: user },
  created_at: '2026-09-11T23:58:42Z',
});
const plan = (comments, attempt = complete, currentHead = head) =>
  planComment({ comments, viewerId: 1, pr: 6516, head: currentHead, attempt });
const existing = () => make(1, renderComment(plan([], blocked), 'Blocked'));

test('successful retry replaces the blocked comment, retaining earlier run evidence', () => {
  const p = plan([existing()]);
  assert.equal(p.canonical.id, 1);
  const body = renderComment(p, 'Completed');
  assert.ok(body.includes(markerFor(6516)));
  assert.ok(body.includes('<summary>Earlier QA attempts</summary>'));
  assert.ok(body.includes(oldUrl));
  assert.ok(body.includes('Completed'));
  assert.equal(plan([make(1, body)]).unchanged, true);
  const retried = renderComment(plan([make(1, body)]), body);
  assert.equal(
    retried.split('<summary>Earlier QA attempts</summary>').length,
    2
  );
});
test('older completions and same-run fallback cannot replace a completed report', () => {
  const current = make(1, renderComment(plan([]), 'Completed'));
  assert.ok(plan([current], { ...blocked, kind: 'report' }).stale);
  assert.ok(plan([current], { ...complete, kind: 'blocked' }).stale);
  assert.ok(
    plan([current], { ...complete, head: 'b'.repeat(40), key: 'historical' })
      .stale
  );
});
test('legacy duplicates consolidate without touching human comments or other publishers', () => {
  const comments = [
    make(
      1,
      `## iOS agent QA\nBlocked\n${oldUrl} · Requested commit \`${head}\``
    ),
    make(
      2,
      `<!-- ios-agent-qa-presentation:${url.split('/').at(-1)}:${head} -->\nCompleted\n${url}`
    ),
    make(3, 'A later human comment'),
    make(4, `${markerFor(6516)}\nOther publisher`, 99),
  ];
  const p = plan(comments);
  assert.equal(p.canonical.id, 2);
  assert.deepEqual(
    p.duplicates.map((c) => c.id),
    [1]
  );
  assert.equal(p.state.history[0].url, oldUrl);
});

function harness(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'qa-comment-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, 'finding-1.mp4'), 'fake-test-bytes');
  const store = {
    comments: [existing(), make(99, 'Human comment')],
    mutations: [],
    uploads: 0,
    failUpload: false,
    failRender: false,
  };
  const asset =
    'https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789abc';
  const gh = (args) => {
    const method = args.includes('--method')
      ? args[args.indexOf('--method') + 1]
      : 'GET';
    const endpoint = args.find(
      (a) => a.startsWith('repos/') || a.startsWith('https://uploads.')
    );
    if (args.includes('user')) return JSON.stringify({ id: 1 });
    if (endpoint?.endsWith('/pulls/6516'))
      return JSON.stringify({
        head: { sha: head, repo: { full_name: repo } },
        base: { repo: { full_name: repo, id: 123 } },
      });
    if (endpoint?.includes('?per_page='))
      return JSON.stringify([store.comments]);
    if (endpoint?.startsWith('https://uploads.')) {
      assert.ok(endpoint.includes('repository_id=123'));
      assert.equal(method, 'POST');
      store.uploads++;
      if (store.failUpload) throw new Error('Upload failed');
      return JSON.stringify({ url: asset });
    }
    if (method === 'PATCH' || method === 'POST') {
      store.mutations.push({ method, endpoint });
      const payload = JSON.parse(
        readFileSync(args[args.indexOf('--input') + 1])
      );
      const id = method === 'PATCH' ? Number(endpoint.split('/').at(-1)) : 10;
      const c = make(id, payload.body);
      store.comments = store.comments.filter((x) => x.id !== id).concat(c);
      return JSON.stringify(c);
    }
    if (method === 'DELETE') {
      store.mutations.push({ method, endpoint });
      store.comments = store.comments.filter(
        (c) => c.id !== Number(endpoint.split('/').at(-1))
      );
      return '';
    }
    const c = store.comments.find(
      (c) => c.id === Number(endpoint.split('/').at(-1))
    );
    if (!c) throw new Error(`Unexpected request ${args.join(' ')}`);
    return JSON.stringify({
      ...c,
      html_url: `https://github.com/${repo}/pull/6516#issuecomment-${c.id}`,
      body_html:
        !store.failRender && c.body.includes(asset)
          ? '<video></video>'
          : '<p>No player</p>',
    });
  };
  return { store, gh, directory, asset };
}
test('publisher uploads then updates exact QA comment ID, verifies player and retries without reupload', (t) => {
  const h = harness(t);
  const args = {
    ...h,
    pr: 6516,
    body: 'Finding\n\n![clip](./finding-1.mp4)',
    attempt: complete,
    attachments: ['finding-1.mp4'],
  };
  const result = publishComment(args);
  assert.equal(result.id, 1);
  assert.equal(result.players, 1);
  assert.ok(result.body.includes(h.asset));
  assert.ok(!result.body.includes('./finding-1.mp4'));
  assert.equal(h.store.comments.find((c) => c.id === 99).body, 'Human comment');
  assert.deepEqual(h.store.mutations, [
    { method: 'PATCH', endpoint: `repos/${repo}/issues/comments/1` },
  ]);
  publishComment(args);
  assert.equal(h.store.uploads, 1);
  assert.equal(h.store.comments.length, 2);
});
test('upload failure preserves prior report and comments', (t) => {
  const h = harness(t);
  h.store.failUpload = true;
  assert.throws(
    () =>
      publishComment({
        ...h,
        pr: 6516,
        body: 'New',
        attempt: complete,
        attachments: ['finding-1.mp4'],
      }),
    /Upload failed/
  );
  assert.equal(h.store.mutations.length, 0);
});
test('failed rendering does not delete earlier evidence comments', (t) => {
  const h = harness(t);
  h.store.failRender = true;
  h.store.comments.push(
    make(
      2,
      `## iOS agent QA\nBlocked\n${oldUrl} · Requested commit \`${head}\``
    )
  );
  assert.throws(
    () =>
      publishComment({
        ...h,
        pr: 6516,
        body: 'New',
        attempt: complete,
        attachments: ['finding-1.mp4'],
      }),
    /did not embed/
  );
  assert.ok(h.store.comments.some((c) => c.id === 2));
  assert.ok(!h.store.mutations.some((m) => m.method === 'DELETE'));
});

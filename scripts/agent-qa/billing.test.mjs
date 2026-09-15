import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { billingProxy, billingSummary } from './billing.mjs';

test('per-request cost survives a later interrupted stream without logging content or credentials', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-billing-'));
  let calls = 0;
  const upstream = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer provider-secret');
    for await (const _ of req) {
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(
      'data: {"type":"response.created","response":{"id":"resp-1"}}\n\n'
    );
    if (++calls === 1) {
      res.write(
        'data: {"type":"response.output_text.delta","delta":"private output"}\n\n'
      );
      res.end(
        'data: {"type":"response.completed","response":{"id":"resp-1","usage":{"input_tokens":100,"output_tokens":10,"cost":0.125}}}\n\n'
      );
    }
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const proxy = await billingProxy({
    key: 'provider-secret',
    file: path.join(dir, 'operator-billing.jsonl'),
    upstream: `http://127.0.0.1:${upstream.address().port}`,
  });
  try {
    const first = await fetch(proxy.url + '/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${proxy.token}` },
      // The screenshot history from the live reviewer exceeded the old 16 MiB
      // proxy ceiling. It must reach the provider and retain usage accounting.
      body: JSON.stringify({
        input: 'private prompt',
        image: 'x'.repeat(17 * 1024 * 1024),
      }),
    });
    assert.match(await first.text(), /private output/);
    const abort = new AbortController();
    const second = await fetch(proxy.url + '/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${proxy.token}` },
      body: '{}',
      signal: abort.signal,
    });
    assert.equal(second.status, 200);
    abort.abort();
    await new Promise((r) => setTimeout(r, 30));
    const summary = billingSummary(dir);
    assert.equal(summary.reportedCost, 0.125);
    assert.equal(summary.requests, 2);
    assert.equal(summary.unpricedRequests, 1);
    assert.equal(summary.complete, false);
    assert.doesNotMatch(
      readFileSync(path.join(dir, 'operator-billing.jsonl'), 'utf8'),
      /provider-secret|private prompt|private output/
    );
    const denied = await fetch(proxy.url + '/responses', {
      method: 'POST',
      body: '{}',
    });
    assert.equal(denied.status, 403);
  } finally {
    await proxy.close();
    upstream.closeAllConnections();
    await new Promise((r) => upstream.close(r));
    rmSync(dir, { recursive: true, force: true });
  }
});

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Capture only provider billing metadata. Prompts, outputs and credentials are never logged.
export async function billingProxy({
  key,
  file,
  upstream = 'https://openrouter.ai/api/v1',
}) {
  mkdirSync(path.dirname(file), { recursive: true });
  const token = randomUUID(),
    active = new Set();
  const log = (event) =>
    appendFileSync(
      file,
      JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n'
    );
  const server = createServer(async (req, res) => {
    if (
      req.method !== 'POST' ||
      req.url !== '/responses' ||
      req.headers.authorization !== `Bearer ${token}`
    ) {
      res.writeHead(403).end();
      return;
    }
    const request = randomUUID(),
      controller = new AbortController();
    active.add(controller);
    let settled = false,
      responseId;
    log({ request, state: 'started' });
    const finish = (state, usage) => {
      if (settled) return;
      settled = true;
      log({
        request,
        responseId,
        state,
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? null,
        cost: typeof usage?.cost === 'number' ? usage.cost : null,
      });
    };
    const inspect = (data) => {
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        return;
      }
      const response = event.response || event;
      responseId ||= response.id;
      if (
        event.type === 'response.completed' ||
        (response.object === 'response' && response.status === 'completed')
      )
        finish('completed', response.usage);
    };
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) throw new Error('request size limit');
        chunks.push(chunk);
      }
      const response = await fetch(`${upstream}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: Buffer.concat(chunks),
        signal: controller.signal,
      });
      const type = response.headers.get('content-type') || 'application/json';
      res.writeHead(response.status, { 'Content-Type': type });
      let pending = '';
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        res.write(chunk);
        pending += decoder.decode(chunk, { stream: true });
        if (type.includes('text/event-stream')) {
          let end;
          while ((end = pending.indexOf('\n')) >= 0) {
            const line = pending.slice(0, end).trim();
            pending = pending.slice(end + 1);
            if (line.startsWith('data: ')) inspect(line.slice(6));
          }
        }
        if (pending.length > 16 * 1024 * 1024) pending = '';
      }
      if (!type.includes('text/event-stream')) inspect(pending);
      finish(response.ok ? 'usage_unavailable' : 'provider_error');
      res.end();
    } catch {
      finish('interrupted');
      if (!res.headersSent) res.writeHead(502);
      res.end();
    } finally {
      active.delete(controller);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    token,
    async close() {
      for (const controller of active) controller.abort();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export function billingSummary(directory) {
  const requests = new Map();
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('-billing.jsonl'))
        for (const line of readFileSync(file, 'utf8')
          .split('\n')
          .filter(Boolean)) {
          const event = JSON.parse(line);
          requests.set(event.request, event);
        }
    }
  }
  visit(directory);
  const rows = [...requests.values()],
    priced = rows.filter((r) => Number.isFinite(r.cost));
  return {
    requests: rows.length,
    pricedRequests: priced.length,
    unpricedRequests: rows.length - priced.length,
    reportedCost: priced.reduce((sum, r) => sum + r.cost, 0),
    complete: rows.length > 0 && priced.length === rows.length,
    inputTokens: rows.reduce((sum, r) => sum + (r.inputTokens || 0), 0),
    outputTokens: rows.reduce((sum, r) => sum + (r.outputTokens || 0), 0),
  };
}

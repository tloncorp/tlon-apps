#!/usr/bin/env node
import http from 'node:http';

// Gate a real image request so the row's own onLoad changes its layout while
// parent props stay constant. Bind loopback only; use a fresh token per case.
const port = Number(process.argv[2] ?? 8337);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAABgCAYAAAB8InCYAAAAT0lEQVR4nO3OIQEAAAgDMJKQjsQUghg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBBIBx4SsOWWV1EWYQAAAABJRU5ErkJggg==', 'base64');
const gates = new Map();
const server = http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const match = /^\/(image|status|release)\/([a-zA-Z0-9_-]+?)(?:\.png)?$/.exec(url.pathname);
  if (!match) { response.writeHead(404).end(); return; }
  const [, action, token] = match;
  if (!gates.has(token)) {
    if (gates.size >= 256) { response.writeHead(429).end('Use a fresh server for the next run'); return; }
    gates.set(token, { requested: false, released: false, pending: new Set() });
  }
  const gate = gates.get(token);
  const complete = target => {
    if (!target.destroyed) target.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length }).end(png);
  };
  if (action === 'image' && request.method === 'GET') {
    gate.requested = true;
    if (gate.released) { complete(response); return; }
    gate.pending.add(response);
    const timeout = setTimeout(() => {
      gate.pending.delete(response);
      if (!response.destroyed) response.writeHead(504).end('Image gate was not released');
    }, 15000);
    response.on('close', () => { clearTimeout(timeout); gate.pending.delete(response); });
    return;
  }
  if (action === 'release' && request.method === 'POST') {
    gate.released = true;
    for (const pending of gate.pending) complete(pending);
    gate.pending.clear();
  } else if (action !== 'status' || request.method !== 'GET') {
    response.writeHead(405).end(); return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ requested: gate.requested, released: gate.released }));
});
server.listen(port, '127.0.0.1', () => console.log(`Scroller image gate listening on http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const gate of gates.values()) for (const pending of gate.pending) pending.destroy();
  server.close(() => process.exit(0));
});

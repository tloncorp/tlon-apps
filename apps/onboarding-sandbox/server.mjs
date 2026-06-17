// Onboarding sandbox control server (Phase 2, step 1 — zero-dep skeleton).
//
// Thin HTTP/SSE layer over the orchestrator (scripts/onboarding-sandbox/run.sh).
// It spawns whitelisted orchestrator subcommands and streams their output to the
// browser as the activity feed; it embeds NO Urbit/stack logic. Built-in modules
// only (no deps / no install). Binds to localhost.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const RUN = join(REPO_ROOT, 'scripts', 'onboarding-sandbox', 'run.sh');
const PORT = Number(process.env.ONBOARDING_WEB_PORT || 4400);

// Only these orchestrator subcommands may ever be spawned.
const STREAM_CMDS = new Set(['start', 'reset', 'down', 'status', 'logs']);

const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
};

const runCapture = (args) =>
  new Promise((resolve) => {
    const p = spawn(RUN, args, { cwd: REPO_ROOT });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out));
    p.on('error', (e) => resolve(JSON.stringify({ up: false, error: String(e) })));
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const html = await readFile(join(HERE, 'public', 'index.html'));
      return send(res, 200, 'text/html; charset=utf-8', html);
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      const out = await runCapture(['status', '--json']);
      return send(res, 200, 'application/json', out.trim() || '{"up":false}');
    }

    if (req.method === 'GET' && url.pathname === '/api/stream') {
      const cmd = url.searchParams.get('cmd') || '';
      if (!STREAM_CMDS.has(cmd)) return send(res, 400, 'text/plain', `unknown cmd: ${cmd}`);
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const emit = (event, data) => res.write(`event: ${event}\ndata: ${data}\n\n`);
      emit('line', `$ onboarding ${cmd}`);
      const p = spawn(RUN, [cmd], { cwd: REPO_ROOT });
      const pipe = (stream) => {
        let buf = '';
        stream.on('data', (d) => {
          buf += d;
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            emit('line', buf.slice(0, i));
            buf = buf.slice(i + 1);
          }
        });
        stream.on('end', () => buf && emit('line', buf));
      };
      pipe(p.stdout);
      pipe(p.stderr);
      p.on('close', (code) => {
        emit('done', String(code ?? -1));
        res.end();
      });
      p.on('error', (e) => {
        emit('line', `spawn error: ${e}`);
        emit('done', '-1');
        res.end();
      });
      req.on('close', () => p.kill());
      return;
    }

    send(res, 404, 'text/plain', 'not found');
  } catch (e) {
    send(res, 500, 'text/plain', String(e));
  }
});

server.listen(PORT, '127.0.0.1', () =>
  console.log(`onboarding sandbox control server: http://127.0.0.1:${PORT}`)
);

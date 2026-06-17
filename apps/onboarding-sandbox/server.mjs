// Onboarding sandbox control server (Phase 2).
//
// Thin HTTP/SSE layer over the orchestrator (scripts/onboarding-sandbox/run.sh)
// plus prompt-file CRUD on the gitignored sandbox copies. Embeds NO Urbit/stack
// logic. Built-in modules only (no deps / no install). Binds to localhost.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const RUN = join(REPO_ROOT, 'scripts', 'onboarding-sandbox', 'run.sh');
const SBX = join(REPO_ROOT, 'scripts', 'onboarding-sandbox');
const SANDBOX_DIR = join(SBX, '.sandbox-prompts');
const SANDBOX_INTRO = join(SBX, '.sandbox-intro.md');
const TLONBOT_DIR = process.env.TLONBOT_DIR || join(REPO_ROOT, '..', 'tlonbot');
const SRC_PROMPTS = join(TLONBOT_DIR, 'prompts');
const SRC_INTRO = join(TLONBOT_DIR, 'tests', 'dev', 'onboarding-intro.md');
const PORT = Number(process.env.ONBOARDING_WEB_PORT || 4400);

const STREAM_CMDS = new Set(['start', 'reset', 'down', 'status', 'logs']);
// Selectable models for v1 — scoped to the configured provider (OpenRouter);
// cross-provider needs per-provider keys (first-run setup). Override via env.
const MODELS = (process.env.ONBOARDING_MODELS ||
  'openrouter/minimax/minimax-m2.5,openrouter/minimax/minimax-m2.7,openrouter/openai/gpt-4o-mini,openrouter/anthropic/claude-3.5-sonnet')
  .split(',').map((s) => s.trim()).filter(Boolean);

const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
};
const json = (res, code, obj) => send(res, code, 'application/json', JSON.stringify(obj));
const readOr = async (p) => {
  try { return await readFile(p, 'utf8'); } catch { return ''; }
};
const readBody = (req) =>
  new Promise((resolve) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => resolve(b)); });

// Map an item name to its sandbox + source paths. `intro` is the welcome DM;
// otherwise a prompt .md file (validated — no path traversal).
function itemPaths(name) {
  if (name === 'intro') return { sandbox: SANDBOX_INTRO, source: SRC_INTRO, kind: 'intro' };
  if (/^[A-Za-z0-9_.-]+\.md$/.test(name) && !name.includes('..'))
    return { sandbox: join(SANDBOX_DIR, name), source: join(SRC_PROMPTS, name), kind: 'prompt' };
  return null;
}

// Path an item would have in the tlonbot repo (so exported patches apply there).
const tlonRel = (name) => (name === 'intro' ? 'tests/dev/onboarding-intro.md' : 'prompts/' + name);

// Unified diff (source -> sandbox) for one item, labelled with tlonbot paths.
function unifiedDiff(name) {
  const it = itemPaths(name);
  const rel = tlonRel(name);
  const r = spawnSync('diff', ['-u', '-L', 'a/' + rel, '-L', 'b/' + rel, it.source, it.sandbox], { encoding: 'utf8' });
  return r.stdout || ''; // diff exits 1 when files differ — expected, not an error
}

// List editable items (prompts + intro) with modified flags; ensures the sandbox
// copies exist first (idempotent).
async function listItems() {
  await runCapture(['init']);
  const items = [];
  let files = [];
  try { files = (await readdir(SANDBOX_DIR)).filter((f) => f.endsWith('.md')).sort(); } catch {}
  for (const f of files) {
    const [sb, src] = [await readOr(join(SANDBOX_DIR, f)), await readOr(join(SRC_PROMPTS, f))];
    items.push({ name: f, kind: 'prompt', modified: sb !== src });
  }
  const [iSb, iSrc] = [await readOr(SANDBOX_INTRO), await readOr(SRC_INTRO)];
  items.push({ name: 'intro', kind: 'intro', label: 'Intro DM', modified: iSb !== iSrc });
  return items;
}

const runCapture = (args) =>
  new Promise((resolve) => {
    const p = spawn(RUN, args, { cwd: REPO_ROOT });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out));
    p.on('error', () => resolve(''));
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  try {
    if (req.method === 'GET' && pathname === '/') {
      return send(res, 200, 'text/html; charset=utf-8', await readFile(join(HERE, 'public', 'index.html')));
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      const out = await runCapture(['status', '--json']);
      return send(res, 200, 'application/json', out.trim() || '{"up":false}');
    }

    if (req.method === 'GET' && pathname === '/api/models') {
      return json(res, 200, { models: MODELS });
    }

    if (req.method === 'GET' && pathname === '/api/stream') {
      const cmd = url.searchParams.get('cmd') || '';
      let args;
      if (cmd === 'set-model') {
        const model = url.searchParams.get('model') || '';
        if (!MODELS.includes(model)) return send(res, 400, 'text/plain', `unknown model: ${model}`);
        args = ['set-model', model];
      } else if (STREAM_CMDS.has(cmd)) {
        args = [cmd];
      } else {
        return send(res, 400, 'text/plain', `unknown cmd: ${cmd}`);
      }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const emit = (event, data) => res.write(`event: ${event}\ndata: ${data}\n\n`);
      emit('line', `$ onboarding ${args.join(' ')}`);
      const p = spawn(RUN, args, { cwd: REPO_ROOT });
      const pipe = (s) => {
        let buf = '';
        s.on('data', (d) => {
          buf += d;
          let i;
          while ((i = buf.indexOf('\n')) >= 0) { emit('line', buf.slice(0, i)); buf = buf.slice(i + 1); }
        });
        s.on('end', () => buf && emit('line', buf));
      };
      pipe(p.stdout); pipe(p.stderr);
      p.on('close', (code) => { emit('done', String(code ?? -1)); res.end(); });
      p.on('error', (e) => { emit('line', `spawn error: ${e}`); emit('done', '-1'); res.end(); });
      req.on('close', () => p.kill());
      return;
    }

    // --- prompt CRUD (sandbox copies) ---
    if (req.method === 'GET' && pathname === '/api/prompts') {
      return json(res, 200, { items: await listItems() });
    }

    if (req.method === 'GET' && pathname === '/api/export') {
      const mods = (await listItems()).filter((i) => i.modified);
      let patch = '';
      for (const i of mods) {
        let d = unifiedDiff(i.name);
        if (d && !d.endsWith('\n')) d += '\n';
        patch += `diff --git a/${tlonRel(i.name)} b/${tlonRel(i.name)}\n` + d;
      }
      res.writeHead(200, {
        'content-type': 'text/x-patch; charset=utf-8',
        'content-disposition': 'attachment; filename="onboarding-prompts.patch"',
      });
      return res.end(patch || '# no local changes\n');
    }

    const m = pathname.match(/^\/api\/prompts\/([^/]+)(?:\/(reset|diff))?$/);
    if (m) {
      const rawName = decodeURIComponent(m[1]);
      const it = itemPaths(rawName);
      if (!it) return json(res, 400, { error: 'bad item name' });
      const action = m[2];
      if (action === 'reset' && req.method === 'POST') {       // reset to source
        await copyFile(it.source, it.sandbox);
        return json(res, 200, { ok: true });
      }
      if (action === 'diff' && req.method === 'GET') {         // unified diff
        return send(res, 200, 'text/plain; charset=utf-8', unifiedDiff(rawName));
      }
      if (!action && req.method === 'GET') {
        const content = await readOr(it.sandbox);
        const source = await readOr(it.source);
        return json(res, 200, { name: rawName, kind: it.kind, content, source, modified: content !== source });
      }
      if (!action && req.method === 'PUT') {                    // save edit
        await writeFile(it.sandbox, await readBody(req));
        return json(res, 200, { ok: true });
      }
    }

    send(res, 404, 'text/plain', 'not found');
  } catch (e) {
    send(res, 500, 'text/plain', String(e));
  }
});

server.listen(PORT, '127.0.0.1', () =>
  console.log(`onboarding sandbox control server: http://127.0.0.1:${PORT}`)
);

// Onboarding sandbox control server (Phase 2).
//
// Thin HTTP/SSE layer over the orchestrator (scripts/onboarding-sandbox/run.sh)
// plus prompt-file CRUD on the gitignored sandbox copies. Embeds NO Urbit/stack
// logic. Built-in modules only (no deps / no install). Binds to localhost.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
// Per-run CSRF token: injected into the served page and required on /api/*, so a
// drive-by page in the browser can't trigger sandbox commands on this localhost
// port. Paired with a Host check below to also defend DNS rebinding.
const TOKEN = randomBytes(24).toString('hex');

const STREAM_CMDS = new Set(['start', 'reset', 'down', 'status', 'logs']);
// Offline fallback list — used only if the OpenRouter models API can't be
// reached. The live list comes from openRouterModels(). Override via env.
const MODELS = (
  process.env.ONBOARDING_MODELS ||
  'openrouter/minimax/minimax-m2.5,openrouter/minimax/minimax-m2.7,openrouter/openai/gpt-4o-mini,openrouter/anthropic/claude-3.5-sonnet'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Live list of every OpenRouter model (public endpoint, no auth), cached 1h.
// Returns `openrouter/<id>` ids matching the bot's MODEL format; null on failure.
let _modelsCache = null,
  _modelsCacheAt = 0;
async function openRouterModels() {
  if (_modelsCache && Date.now() - _modelsCacheAt < 3600000)
    return _modelsCache;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      const j = await r.json();
      const list = (j.data || [])
        .map((m) => 'openrouter/' + m.id)
        .filter((s) => s !== 'openrouter/')
        .sort();
      if (list.length) {
        _modelsCache = list;
        _modelsCacheAt = Date.now();
      }
    }
  } catch {}
  return _modelsCache;
}

const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
};
const json = (res, code, obj) =>
  send(res, code, 'application/json', JSON.stringify(obj));
const readOr = async (p) => {
  try {
    return await readFile(p, 'utf8');
  } catch {
    return '';
  }
};

// first-run preflight helpers
const ENV_FILE = join(TLONBOT_DIR, 'tests', '.env');
const dockerOk = () => {
  try {
    return (
      spawnSync('docker', ['info'], { timeout: 5000, stdio: 'ignore' })
        .status === 0
    );
  } catch {
    return false;
  }
};
const keyPresent = async () =>
  /^OPENROUTER_API_KEY=.+/m.test(await readOr(ENV_FILE));
const readBody = (req) =>
  new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => resolve(b));
  });

// Map an item name to its sandbox + source paths. `intro` is the welcome DM;
// otherwise a prompt .md file (validated — no path traversal).
function itemPaths(name) {
  if (name === 'intro')
    return { sandbox: SANDBOX_INTRO, source: SRC_INTRO, kind: 'intro' };
  if (/^[A-Za-z0-9_.-]+\.md$/.test(name) && !name.includes('..'))
    return {
      sandbox: join(SANDBOX_DIR, name),
      source: join(SRC_PROMPTS, name),
      kind: 'prompt',
    };
  return null;
}

// Path an item would have in the tlonbot repo (so exported patches apply there).
const tlonRel = (name) =>
  name === 'intro' ? 'tests/dev/onboarding-intro.md' : 'prompts/' + name;

// Unified diff (source -> sandbox) for one item, labelled with tlonbot paths.
function unifiedDiff(name) {
  const it = itemPaths(name);
  const rel = tlonRel(name);
  const r = spawnSync(
    'diff',
    ['-u', '-L', 'a/' + rel, '-L', 'b/' + rel, it.source, it.sandbox],
    { encoding: 'utf8' }
  );
  return r.stdout || ''; // diff exits 1 when files differ — expected, not an error
}

// List editable items (prompts + intro) with modified flags; ensures the sandbox
// copies exist first (idempotent).
async function listItems() {
  await runCapture(['init']);
  const items = [];
  let files = [];
  try {
    files = (await readdir(SANDBOX_DIR))
      .filter((f) => f.endsWith('.md'))
      .sort();
  } catch {}
  for (const f of files) {
    const [sb, src] = [
      await readOr(join(SANDBOX_DIR, f)),
      await readOr(join(SRC_PROMPTS, f)),
    ];
    items.push({ name: f, kind: 'prompt', modified: sb !== src });
  }
  const [iSb, iSrc] = [await readOr(SANDBOX_INTRO), await readOr(SRC_INTRO)];
  items.push({
    name: 'intro',
    kind: 'intro',
    label: 'Intro DM',
    modified: iSb !== iSrc,
  });
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

// Like runCapture, but feeds `input` on stdin and closes it — for secrets (the
// provider key) so they never land in the child's argv (visible via ps/proc).
const runWithStdin = (args, input) =>
  new Promise((resolve) => {
    const p = spawn(RUN, args, { cwd: REPO_ROOT });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out));
    p.on('error', () => resolve(''));
    p.stdin.write(input);
    p.stdin.end();
  });

// --- owner cache-busting proxy ---------------------------------------------
// The web client caches the conversation in IndexedDB keyed by ORIGIN (incl.
// port), and a backend nuke doesn't purge it. So after each start/reset we
// expose ~ten's Eyre on a FRESH localhost port: a new origin = empty client
// cache = clean sync from the (already-cleared) backend. This is a transparent
// TCP forward to the port the stack already publishes — no Urbit logic here.
let proxyServer = null;
let proxyPort = null;

// Parse the canonical owner Eyre target (host/port) from `status --json`.
async function ownerTarget() {
  try {
    const o = JSON.parse(
      (await runCapture(['status', '--json'])).trim() || '{}'
    );
    if (!o.up || !o.owner?.url) return null;
    const u = new URL(o.owner.url);
    return {
      host: u.hostname === 'localhost' ? '127.0.0.1' : u.hostname,
      port: Number(u.port),
    };
  } catch {
    return null;
  }
}

function closeProxy() {
  if (proxyServer) {
    try {
      proxyServer.close();
    } catch {}
    proxyServer = null;
  }
  proxyPort = null;
}

// Start a fresh proxy on an OS-assigned port forwarding to the owner ship.
async function rotateProxy() {
  const target = await ownerTarget();
  if (!target) {
    closeProxy();
    return;
  }
  const next = net.createServer((client) => {
    const upstream = net.connect(target.port, target.host);
    client.pipe(upstream);
    upstream.pipe(client);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
  });
  await new Promise((resolve, reject) => {
    next.once('error', reject);
    next.listen(0, '127.0.0.1', resolve);
  });
  const old = proxyServer;
  proxyServer = next;
  proxyPort = next.address().port;
  if (old) {
    try {
      old.close();
    } catch {}
  } // stops new conns; existing tabs drain
}

async function ensureProxy() {
  if (!proxyServer) await rotateProxy();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  try {
    // DNS-rebinding guard on EVERY request, including GET / — otherwise a
    // rebound foreign domain could read the token from the page and replay it
    // straight to localhost. Only real localhost Hosts are allowed.
    const host = (req.headers.host || '').split(':')[0];
    if (host !== 'localhost' && host !== '127.0.0.1')
      return send(res, 403, 'text/plain', 'forbidden');
    // CSRF guard: /api/* additionally requires the per-run token.
    if (pathname.startsWith('/api/')) {
      const t = url.searchParams.get('token') || req.headers['x-sandbox-token'];
      if (t !== TOKEN) return send(res, 403, 'text/plain', 'forbidden');
    }

    if (req.method === 'GET' && pathname === '/') {
      const html = await readFile(join(HERE, 'public', 'index.html'), 'utf8');
      return send(
        res,
        200,
        'text/html; charset=utf-8',
        html.replace(
          '</head>',
          `<script>window.__TOKEN__=${JSON.stringify(TOKEN)}</script></head>`
        )
      );
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      const out = await runCapture(['status', '--json']);
      let txt = out.trim() || '{"up":false}';
      try {
        const o = JSON.parse(txt);
        if (o.up) {
          await ensureProxy(); // first status after the stack is up
          if (o.owner?.url && proxyPort) {
            const u = new URL(o.owner.url);
            u.hostname = 'localhost';
            u.port = String(proxyPort);
            o.owner.url = u.toString();
            txt = JSON.stringify(o);
          }
        } else {
          closeProxy(); // stack down → drop the proxy
        }
      } catch {}
      return send(res, 200, 'application/json', txt);
    }

    if (req.method === 'GET' && pathname === '/api/models') {
      const list = await openRouterModels();
      return json(res, 200, { models: list && list.length ? list : MODELS });
    }

    if (req.method === 'GET' && pathname === '/api/preflight') {
      return json(res, 200, { docker: dockerOk(), key: await keyPresent() });
    }

    if (req.method === 'POST' && pathname === '/api/provider-key') {
      let key = '';
      try {
        key = (JSON.parse(await readBody(req)).key || '').trim();
      } catch {}
      if (!key) return json(res, 400, { ok: false, error: 'no key provided' });
      let valid = false,
        detail = '';
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch('https://openrouter.ai/api/v1/key', {
          headers: { authorization: 'Bearer ' + key },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        valid = r.ok;
        if (!valid) detail = 'provider returned HTTP ' + r.status;
      } catch (e) {
        detail = String(e.message || e);
      }
      if (!valid)
        return json(res, 400, {
          ok: false,
          error: 'key rejected (' + detail + ')',
        });
      await runWithStdin(['set-key'], key);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/stream') {
      const cmd = url.searchParams.get('cmd') || '';
      let args;
      if (cmd === 'set-model') {
        const model = url.searchParams.get('model') || '';
        if (!/^openrouter\/[A-Za-z0-9/_.:-]+$/.test(model))
          return send(res, 400, 'text/plain', `invalid model: ${model}`);
        args = ['set-model', model];
      } else if (STREAM_CMDS.has(cmd)) {
        args = [cmd];
      } else {
        return send(res, 400, 'text/plain', `unknown cmd: ${cmd}`);
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const emit = (event, data) =>
        res.write(`event: ${event}\ndata: ${data}\n\n`);
      emit('line', `$ onboarding ${args.join(' ')}`);
      const p = spawn(RUN, args, { cwd: REPO_ROOT });
      const pipe = (s) => {
        let buf = '';
        s.on('data', (d) => {
          buf += d;
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            emit('line', buf.slice(0, i));
            buf = buf.slice(i + 1);
          }
        });
        s.on('end', () => buf && emit('line', buf));
      };
      pipe(p.stdout);
      pipe(p.stderr);
      p.on('close', async (code) => {
        // give the tester a fresh-origin (clean-cache) owner link after each
        // start/reset; tear the proxy down on stop
        if (code === 0 && (cmd === 'start' || cmd === 'reset')) {
          try {
            await rotateProxy();
          } catch {}
        } else if (cmd === 'down') {
          closeProxy();
        }
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
        'content-disposition':
          'attachment; filename="onboarding-prompts.patch"',
      });
      return res.end(patch || '# no local changes\n');
    }

    if (req.method === 'POST' && pathname === '/api/reset-prompts') {
      for (const it of await listItems()) {
        const p = itemPaths(it.name);
        try {
          await copyFile(p.source, p.sandbox);
        } catch {}
      }
      return json(res, 200, { ok: true });
    }

    const m = pathname.match(/^\/api\/prompts\/([^/]+)(?:\/(reset|diff))?$/);
    if (m) {
      const rawName = decodeURIComponent(m[1]);
      const it = itemPaths(rawName);
      if (!it) return json(res, 400, { error: 'bad item name' });
      const action = m[2];
      if (action === 'reset' && req.method === 'POST') {
        // reset to source
        await copyFile(it.source, it.sandbox);
        return json(res, 200, { ok: true });
      }
      if (action === 'diff' && req.method === 'GET') {
        // unified diff
        return send(
          res,
          200,
          'text/plain; charset=utf-8',
          unifiedDiff(rawName)
        );
      }
      if (!action && req.method === 'GET') {
        const content = await readOr(it.sandbox);
        const source = await readOr(it.source);
        return json(res, 200, {
          name: rawName,
          kind: it.kind,
          content,
          source,
          modified: content !== source,
        });
      }
      if (!action && req.method === 'PUT') {
        // save edit
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

// src/connect.ts
import { randomBytes } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

export interface ConnectSubmission { shipUrl: string; kind: 'key' | 'code'; secret: string }
export interface ConnectPage {
  url: string;
  /** The one accepted form post; rejects when the link expires first. */
  submission: Promise<ConnectSubmission>;
  /** Answers the held post with the outcome and shuts the server down; resolves once the answer is sent. */
  finish(ok: boolean, message: string): Promise<void>;
}

export const SIGNUP_URL = 'https://tlon.network/signup?source=agent';
export const DEFAULT_CONNECT_TIMEOUT_MS = 10 * 60_000;
export const describeMs = (ms: number) => (ms >= 60_000 ? `${ms / 60_000} minutes` : `${ms / 1000} seconds`);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Connect tlon-memory</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem}
label{display:block;margin:1rem 0 .25rem}input[type=url],input[type=password]{width:100%;padding:.4rem;font:inherit}button{margin-top:1.25rem;padding:.5rem 1rem;font:inherit}</style>
</head><body>${body}</body></html>`;
const FORM = page(`<h1>Connect tlon-memory to your ship</h1>
<p>This page runs on your computer and talks only to the setup command that printed its link. Your agent never sees what you enter here.</p>
<form method="post">
<label for="ship_url">Ship URL</label><input id="ship_url" name="ship_url" type="url" placeholder="https://sampel-palnet.tlon.network" required>
<label><input type="radio" name="kind" value="code" checked> +code (used once to fetch the Notes API key, then discarded)</label>
<label><input type="radio" name="kind" value="key"> Notes API key</label>
<label for="secret">+code or key</label><input id="secret" name="secret" type="password" autocomplete="off" required>
<button type="submit">Connect</button>
</form>
<p>No Tlon account? <a href="${SIGNUP_URL}" target="_blank" rel="noopener">Sign up</a>, then come back to this page.</p>`);

/**
 * A one-shot page on 127.0.0.1 where the user enters the ship URL and +code or key, so an agent can run setup without
 * seeing either. Only the random token path answers; the first POST consumes it. The Host check stops a DNS-rebinding
 * page from reaching the server under another name.
 */
export async function openConnectPage(timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS): Promise<ConnectPage> {
  const token = randomBytes(16).toString('hex');
  let used = false, held: ServerResponse | undefined;
  let resolve!: (s: ConnectSubmission) => void, reject!: (e: Error) => void;
  const submission = new Promise<ConnectSubmission>((res, rej) => { resolve = res; reject = rej; });
  const send = (res: ServerResponse, status: number, html: string) =>
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).end(html);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.headers.host !== host || req.url !== `/${token}` || (req.method !== 'GET' && req.method !== 'POST')) return send(res, 404, page('<p>Not found.</p>'));
    if (used) return send(res, 410, page('<p>This link has been used. Ask your agent to run setup again for a new one.</p>'));
    if (req.method === 'GET') return send(res, 200, FORM);
    used = true;
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => { body += c; if (body.length > 16_384) req.destroy(); });
    req.on('end', () => {
      clearTimeout(timer); held = res;
      const f = new URLSearchParams(body);
      resolve({ shipUrl: f.get('ship_url') ?? '', kind: f.get('kind') === 'key' ? 'key' : 'code', secret: (f.get('secret') ?? '').trim() });
    });
  });
  const close = () => { server.close(); server.closeAllConnections(); };
  const timer = setTimeout(() => { used = true; close(); reject(new Error(`the connect link expired after ${describeMs(timeoutMs)} without a submission; run setup --connect again`)); }, timeoutMs);
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
  const host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: `http://${host}/${token}`, submission,
    finish(ok, message) {
      const html = page(ok ? `<p>${esc(message)} You can close this tab.</p>` : `<h1>Setup did not finish</h1><p>${esc(message)}</p><p>Ask your agent to run setup again for a new link.</p>`);
      return new Promise((res) => {
        if (!held) { close(); return res(); }
        held.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html, () => { close(); res(); });
      });
    },
  };
}

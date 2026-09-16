#!/usr/bin/env node
// desk-push: commit an assembled desk to a ship through Clay, in one round trip.
//
//   node scripts/desk-push.mjs <assembled-dir> <desk> --pier <pier-path> [--code <+code>] [--install] [--reseed] [--ignore <path>]... [--incidental <path>]... [--wait-scry <eyre-path>] [--timeout <ms>] [--dry-run]
//   node scripts/desk-push.mjs <assembled-dir> <desk> --url http://host:port (--code <+code> | --cookie <urbauth>) [--install] [--dry-run]
//
// Verified end to end on a fresh fake ship (vere 4.6, kelvin 408): bootstrap
// %park 0.1 s, 632-file first commit 2.6 s, --install to kiln %live with all
// agents up; commits to a live desk take ~30 s for the agent reloads.
//
// Asks the ship for every committed file's content hash (-desk-hashes), diffs
// the local tree against it, and sends only changed files plus deletes to
// -desk-push, which issues one Clay %into and reports the new revision. On a
// ship with no such desk (--pier only) it first injects a %park of a minimal
// desk carrying the two threads, then pushes the rest.
//
// Transports: Spider over eyre's public port (application/x-urb-jam, urbauth
// cookie from the ship's +code) for the two thread calls, and the conn socket
// (<pier>/.urb/conn.sock, newt-framed jammed nouns, no auth) for the bootstrap
// %park only. See the notes on each class for why the split exists.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { join, relative, sep } from 'node:path';
import {
  Atom,
  Cell,
  bigintToDataView,
  cue_bytes,
  dejs,
  jam,
} from '@urbit/nockjs';

// --- noun helpers ------------------------------------------------------------

const YES = Atom.zero; // loobean & (true)
const NO = Atom.fromInt(1); // loobean | (false)

const cord = (s) => Atom.fromCord(s);
const cell = (a, b) => new Cell(a, b);

const atomFromBytes = (buf) => {
  if (buf.length === 0) return Atom.zero;
  return new Atom(BigInt('0x' + Buffer.from(buf).reverse().toString('hex')));
};
const bytesFromAtom = (atom) => {
  if (atom.number === 0n) return Buffer.alloc(0);
  let hex = atom.number.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return Buffer.from(hex, 'hex').reverse();
};
const cordToString = (atom) => bytesFromAtom(atom).toString('utf8');
const jamBytes = (noun) => {
  const dv = bigintToDataView(jam(noun).number);
  return Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength);
};
const cueBytes = (buf) =>
  cue_bytes(new DataView(buf.buffer, buf.byteOffset, buf.byteLength));

const listToArray = (noun) => {
  const out = [];
  for (let n = noun; n.isCell(); n = n.tail) out.push(n.head);
  return out;
};
// (map k v) and (set k) are treaps: [n=[k v] l r] / [n=k l r], ~ when empty
const treapEntries = (noun, out = []) => {
  if (!noun.isCell()) return out;
  out.push(noun.head);
  treapEntries(noun.tail.head, out);
  treapEntries(noun.tail.tail, out);
  return out;
};

// disk 'app/groups.hoon' -> clay /app/groups/hoon
const clayPath = (rel) => {
  const parts = rel.split(sep);
  const file = parts.pop();
  const dot = file.lastIndexOf('.');
  if (dot > 0) parts.push(file.slice(0, dot), file.slice(dot + 1));
  else parts.push(file);
  return parts;
};
const pathNoun = (segments) => dejs.list(segments.map(cord));
// 'desk.docket-0' or '/desk/docket-0' -> '/desk/docket-0'
const toClayPath = (rel) =>
  '/' + clayPath(rel.replace(/^\//, '').split('/').join(sep)).join('/');
const pathString = (noun) =>
  '/' + listToArray(noun).map(cordToString).join('/');

// +shax hashes the octs atom, which has no trailing NUL bytes, and returns
// the digest as a little-endian atom, i.e. with its bytes reversed
const shax = (buf) => {
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0) end -= 1;
  return createHash('sha256')
    .update(buf.subarray(0, end))
    .digest()
    .reverse()
    .toString('hex');
};

// [/text/x-hoon [len atom]] -- Clay ignores the mimetype
const mimeNoun = (buf) =>
  cell(
    dejs.list([cord('text'), cord('plain')]),
    cell(Atom.fromInt(buf.length), atomFromBytes(buf))
  );

// $mode: what clay is being asked to change. A file carries its bytes as a
// mime; a removed path carries ~. Unlisted paths are left alone.
const modeNoun = (changed, deleted) =>
  dejs.list([
    ...changed.map((f) =>
      cell(pathNoun(clayPath(f.rel)), cell(Atom.zero, mimeNoun(f.buf)))
    ),
    ...deleted.map((p) => cell(pathNoun(p.slice(1).split('/')), Atom.zero)),
  ]);

// --- tank rendering (good enough to read a compile error) --------------------

const renderTank = (tank) => {
  const tag = cordToString(tank.head);
  if (tag === 'leaf') return cordToString(atomFromBytes(tapeBytes(tank.tail)));
  const kids = tag === 'palm' ? tank.tail.tail : tank.tail.tail;
  return listToArray(kids).map(renderTank).join('\n');
};
const tapeBytes = (tape) =>
  Buffer.from(listToArray(tape).map((c) => Number(c.number)));
const renderTang = (tang) =>
  listToArray(tang).map(renderTank).reverse().join('\n');
// goof = [mote tang]; khan reports a failed thread as [%thread-fail term tang]
const renderGoof = (goof) => {
  const mote = cordToString(goof.head);
  const rest = goof.tail;
  if (rest.isCell() && !rest.head.isCell()) {
    return `${mote} ${cordToString(rest.head)}\n${renderTang(rest.tail)}`;
  }
  return `${mote}\n${renderTang(rest)}`;
};

// Desk names reach the ship inside hoon source, so keep them to what a @tas
// can hold rather than trusting the caller.
function assertDeskName(desk) {
  if (!/^[a-z][a-z0-9-]*$/.test(desk)) {
    throw new Error(`not a usable desk name: ${desk}`);
  }
}

// --- local tree ----------------------------------------------------------------

function walk(root, dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push({ rel: relative(root, full), buf: readFileSync(full) });
  }
  return out;
}

// The smallest desk that can build the two threads: the marks |new-desk
// copies, the strand libraries, and the threads themselves. The threads live
// in ted/desk/ but are still invoked as %desk-push / %desk-hashes: +get-fit
// tries /ted/desk-push/hoon and then /ted/desk/push/hoon.
const BOOTSTRAP_FILES = [
  'sys.kelvin',
  'mar/hoon.hoon',
  'mar/noun.hoon',
  'mar/txt.hoon',
  'mar/mime.hoon',
  'mar/kelvin.hoon',
  'sur/spider.hoon',
  'lib/strand.hoon',
  'lib/strandio.hoon',
  'ted/desk/push.hoon',
  'ted/desk/hashes.hoon',
];

// A %park wants pages ([mark noun]), not bytes. Only two shapes are needed
// for the bootstrap set: hoon files are cords, sys.kelvin is [%zuse @ud].
const pageNoun = (rel, buf) => {
  if (rel === 'sys.kelvin') {
    const m = /\[%(\w+)\s+(\d+)\]/.exec(buf.toString('utf8'));
    if (!m) throw new Error(`cannot parse ${rel}: ${buf}`);
    return cell(cord('kelvin'), cell(cord(m[1]), Atom.fromInt(Number(m[2]))));
  }
  return cell(cord('hoon'), atomFromBytes(buf));
};

// --- conn.sock transport -----------------------------------------------------
//
// Used only for the bootstrap %park. vere's conn.c closes a channel right
// after writing a %fyrd reply (it tests uv_is_readable on the *listening*
// pipe, which is never true), cancelling any write still in flight, so any
// reply larger than one write buffer arrives truncated. Thread calls with
// real payloads therefore go over Spider instead.

class Conn {
  constructor(pier) {
    this.sock = `${pier}/.urb/conn.sock`;
    this.rid = BigInt(Date.now());
  }

  // one request, one response frame with our request id
  send(tag, payload, { timeoutMs }) {
    const rid = new Atom(++this.rid);
    const body = jamBytes(cell(rid, cell(cord(tag), payload)));
    const hdr = Buffer.alloc(5);
    hdr.writeUInt32LE(body.length, 1);
    return new Promise((resolve, reject) => {
      const sock = connect(this.sock);
      let buf = Buffer.alloc(0);
      sock.setTimeout(timeoutMs, () => {
        sock.destroy();
        reject(
          new Error(`no reply from ${this.sock} after ${timeoutMs / 1000}s`)
        );
      });
      sock.on('error', reject);
      sock.on('connect', () => sock.write(Buffer.concat([hdr, body])));
      sock.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 5) {
          const len = buf.readUInt32LE(1);
          if (buf.length < 5 + len) return;
          const frame = cueBytes(buf.subarray(5, 5 + len));
          buf = buf.subarray(5 + len);
          // frames without our rid: conn error reports ([0 %bail ...]) or noise
          if (frame.head.number !== rid.number && frame.head.number !== 0n)
            continue;
          // vere keeps its end open; a half-close would leave node running
          sock.destroy();
          resolve(frame.tail);
        }
      });
    });
  }

  // [%fyrd [desk thread %noun [%noun arg]]] -> %avow (each [%noun result] goof)
  async fyrd(desk, thread, arg, opts) {
    const payload = cell(
      cord(desk),
      cell(cord(thread), cell(cord('noun'), cell(cord('noun'), arg)))
    );
    const res = await this.send('fyrd', payload, opts);
    const tag = cordToString(res.head);
    if (tag === 'bail') throw new ShipError(`%fyrd ${thread} bailed`, res.tail);
    if (tag !== 'avow') throw new Error(`unexpected reply to %fyrd: %${tag}`);
    const each = res.tail;
    if (each.head.number !== 0n) {
      throw new ThreadError(`-${thread} failed`, each.tail);
    }
    return each.tail.tail; // [%noun result] -> result
  }

  // The ship's +code, for logging in to eyre. The generator is dojo syntax
  // rather than hoon, so run its jael scry in a strand through %khan-eval;
  // the reply is a short tape, well under the size at which conn truncates.
  async code() {
    const hoon =
      '=/  m  (strand ,vase)  ' +
      ';<  =bowl  bind:m  get-bowl  ' +
      '(pure:m !>((slag 1 (scow %p .^(@p %j ' +
      '/(scot %p our.bowl)/code/(scot %da now.bowl)/(scot %p our.bowl))))))';
    const payload = cell(
      cord('base'),
      cell(
        cord('khan-eval'),
        cell(cord('noun'), cell(cord('ted-eval'), cord(hoon)))
      )
    );
    const res = await this.send('fyrd', payload, { timeoutMs: 60_000 });
    if (cordToString(res.head) !== 'avow' || res.tail.head.number !== 0n) {
      throw new Error('conn +code did not return a result');
    }
    // [%noun tape] -- a tape is a list of single-character atoms
    const tape = listToArray(res.tail.tail.tail)
      .map((c) => String.fromCharCode(Number(c.number)))
      .join('');
    const m = /[a-z]{6}(-[a-z]{6}){3}/.exec(tape);
    if (!m)
      throw new Error(`conn +code returned something unexpected: ${tape}`);
    return m[0];
  }

  // Mount through hood rather than a raw %mont ovum, so `our` and `now` stay
  // on the ship instead of having to be built as atoms here.
  async mount(desk) {
    assertDeskName(desk);
    const hoon =
      '=/  m  (strand ,vase)  ' +
      ';<  =bowl  bind:m  get-bowl  ' +
      `=/  p=path  [(scot %p our.bowl) %${desk} (scot %da now.bowl) ~]  ` +
      `;<  ~  bind:m  (poke [our.bowl %hood] kiln-mount+!>([p %${desk}]))  ` +
      '(pure:m !>(%ok))';
    const payload = cell(
      cord('base'),
      cell(
        cord('khan-eval'),
        cell(cord('noun'), cell(cord('ted-eval'), cord(hoon)))
      )
    );
    const res = await this.send('fyrd', payload, { timeoutMs: 120_000 });
    if (cordToString(res.head) !== 'avow' || res.tail.head.number !== 0n) {
      throw new Error(`could not mount %${desk} through hood`);
    }
  }

  // [%ovum [%c /sync [%into desk all=& mode]]]. A delta on top of the current
  // head, so it adds the threads to a desk that lacks them without disturbing
  // what is already committed there.
  async into(desk, mode, opts) {
    const card = cell(cord('into'), cell(cord(desk), cell(YES, mode)));
    const ovum = cell(cord('c'), cell(dejs.list([cord('sync')]), card));
    const res = await this.send('ovum', ovum, opts);
    const tag = cordToString(res.head);
    if (tag === 'bail') throw new ShipError('%into bailed', res.tail);
    const news = cordToString(res.tail);
    if (tag !== 'news' || news !== 'done') {
      throw new Error(`%into did not complete: %${tag} %${news}`);
    }
  }

  // [%ovum [%c /sync [%park desk yoki rang]]] -> %news %done | %bail (list goof)
  async park(desk, pages, opts) {
    const yuki = cell(Atom.zero, pages); // [parents=~ files]
    const yoki = cell(YES, yuki); // &+yuki
    const rang = cell(Atom.zero, Atom.zero); // [hut=~ lat=~]
    const card = cell(cord('park'), cell(cord(desk), cell(yoki, rang)));
    const ovum = cell(cord('c'), cell(dejs.list([cord('sync')]), card));
    const res = await this.send('ovum', ovum, opts);
    const tag = cordToString(res.head);
    if (tag === 'bail') throw new ShipError('%park bailed', res.tail);
    const news = cordToString(res.tail);
    if (tag !== 'news' || news !== 'done') {
      throw new Error(`%park did not complete: %${tag} %${news}`);
    }
  }
}

// --- Spider over HTTP ----------------------------------------------------------

// node's fetch abandons a request after 300s without response headers, which
// a desk compile routinely exceeds; this only gives up when the socket idles.
function httpPost(url, { headers = {}, body, timeoutMs, method = 'POST' }) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      );
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () =>
      req.destroy(
        new Error(`no response from ${url} after ${timeoutMs / 1000}s idle`)
      )
    );
    req.on('error', reject);
    req.end(body);
  });
}

class Spider {
  constructor(url, cookie) {
    this.url = url.replace(/\/$/, '');
    this.cookie = cookie;
  }

  // POST /spider/<desk>/noun/<thread>/noun with a jammed body. The thread's
  // result comes back as a jam; a thread that ran and failed is a 500 whose
  // jammed body is [term tang]; anything else (the desk or its marks missing,
  // the commit event crashing) is a 500 with eyre's text trace.
  async fyrd(desk, thread, arg, { timeoutMs }) {
    const res = await httpPost(
      `${this.url}/spider/${desk}/noun/${thread}/noun`,
      {
        headers: {
          'content-type': 'application/x-urb-jam',
          accept: 'application/x-urb-jam',
          ...(this.cookie ? { cookie: this.cookie } : {}),
        },
        body: jamBytes(arg),
        timeoutMs,
      }
    );
    const body = res.body;
    if (res.status === 200) return cueBytes(body);
    if (res.headers['content-type'] === 'application/x-urb-jam') {
      const [term, tang] = (() => {
        const n = cueBytes(body);
        return [n.head, n.tail];
      })();
      throw new ThreadError(`-${thread} failed`, cell(term, tang));
    }
    throw new Error(
      `-${thread}: HTTP ${res.status}\n${body
        .toString('utf8')
        .replace(/<[^>]+>/g, '')
        .trim()}`
    );
  }
}

// The loopback port is served by the lens app (the {source, sink} dojo
// protocol), not by eyre's bindings, so Spider is only reachable on the
// public port with an urbauth cookie. In pier mode the code comes from lens
// and the login happens here; with a URL the caller supplies --code or
// --cookie. conn.sock is used only for the bootstrap %park, and only exists
// in pier mode, so a missing desk cannot be bootstrapped through a URL.
class Ship {
  static async connect({ pier, url, code, cookie }) {
    const ship = new Ship();
    if (pier) {
      const ports = readFileSync(`${pier}/.http.ports`, 'utf8')
        .split('\n')
        .map((l) => l.split(' '));
      const loopback = ports.find((p) => p[2] === 'loopback')?.[0];
      const pub = ports.find((p) => p[2] === 'public')?.[0];
      if (!loopback || !pub)
        throw new Error(
          `${pier}/.http.ports lists no loopback/public ports; is the ship running?`
        );
      url = `http://127.0.0.1:${pub}`;
      ship.conn = new Conn(pier);
      // lens serves the loopback port and answers +code, but on some ships it
      // 500s for everything; the conn socket can run the same generator
      if (!code && !cookie) {
        try {
          code = await lensCode(`http://127.0.0.1:${loopback}`);
        } catch (e) {
          code = await ship.conn.code().catch((connErr) => {
            throw new Error(
              `could not read +code from this ship; pass --code\n` +
                `  lens: ${e.message}\n  conn: ${connErr.message}`
            );
          });
        }
      }
    } else if (!url || !(code || cookie)) {
      throw new Error('--url needs --code or --cookie');
    }
    ship.spider = new Spider(url, cookie ?? (await login(url, code)));
    return ship;
  }

  fyrd(...a) {
    return this.spider.fyrd(...a);
  }

  // Whether an eyre scry answers. A commit to a live desk advances clay in one
  // event but gall reloads the desk's agents over the events after it, so this
  // is how a caller waits for the desk to actually be serving again.
  async scryOk(scryPath) {
    try {
      const res = await httpPost(`${this.spider.url}${scryPath}`, {
        method: 'GET',
        headers: this.spider.cookie ? { cookie: this.spider.cookie } : {},
        timeoutMs: 60_000,
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  // kiln's view of the desk: %live once every agent in desk.bill is running
  async zest(desk) {
    const res = await httpPost(
      `${this.spider.url}/~/scry/hood/kiln/pikes.json`,
      {
        method: 'GET',
        headers: this.spider.cookie ? { cookie: this.spider.cookie } : {},
        timeoutMs: 60_000,
      }
    );
    if (res.status !== 200) throw new Error(`pikes scry: HTTP ${res.status}`);
    return JSON.parse(res.body.toString('utf8'))[desk]?.zest ?? 'absent';
  }

  // Whether clay already holds this desk. Kiln lists every desk it knows,
  // including ones created by %park and never installed, so this is the check
  // that decides between creating a desk and adding to one.
  async exists(desk) {
    return (await this.zest(desk)) !== 'absent';
  }

  requireConn(what) {
    if (!this.conn) {
      throw new Error(
        `${what} needs conn.sock, which only --pier provides; rerun with --pier`
      );
    }
    return this.conn;
  }

  // %park writes a root commit holding only the pages it is given, so running
  // it against a desk that already has content replaces that content — and for
  // a live desk that means a commit with no desk.bill and no agents, which
  // tears every one of them down. Creating a desk is the only safe use, so
  // check that here, next to the operation, rather than trusting the caller.
  async park(desk, pages, opts) {
    if (await this.exists(desk)) {
      throw new Error(
        `refusing to %park over the existing %${desk}: a root commit would ` +
          `replace everything in it. Seed it with %into instead.`
      );
    }
    return this.requireConn('creating a desk').park(desk, pages, opts);
  }

  async seedExisting(desk, mode, opts) {
    const conn = this.requireConn('seeding an existing desk');
    await conn.mount(desk);
    await conn.into(desk, mode, opts);
  }
}

// lens answers a dojo source with the text it printed
async function lensCode(loopbackUrl) {
  const res = await httpPost(loopbackUrl, {
    body: JSON.stringify({ source: { dojo: '+code' }, sink: { stdout: null } }),
    timeoutMs: 30_000,
  });
  if (res.status !== 200) throw new Error(`lens +code: HTTP ${res.status}`);
  const text = res.body
    .toString('utf8')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\\n$/, '')
    .trim();
  if (!/^[a-z]{6}(-[a-z]{6}){3}$/.test(text))
    throw new Error(`lens +code returned something unexpected: ${text}`);
  return text;
}

async function login(url, code) {
  const res = await httpPost(`${url.replace(/\/$/, '')}/~/login`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: code }).toString(),
    timeoutMs: 30_000,
  });
  // eyre sets a urbauth cookie even on a failed login (400, a guest session
  // with a 7-day Max-Age); only the status distinguishes success
  if (res.status !== 200) {
    throw new Error(`login at ${url} rejected the code (HTTP ${res.status})`);
  }
  const cookie = [res.headers['set-cookie']]
    .flat()
    .find((c) => c?.includes('urbauth'));
  if (!cookie)
    throw new Error(`login at ${url} succeeded but set no urbauth cookie`);
  return cookie.split(';')[0];
}

class ShipError extends Error {
  constructor(msg, goofs) {
    super(`${msg}\n${listToArray(goofs).map(renderGoof).join('\n')}`);
  }
}
class ThreadError extends Error {
  constructor(msg, goof) {
    super(`${msg}\n${renderGoof(goof)}`);
  }
}

// --- main ----------------------------------------------------------------------

// How long any one ship-side phase may take: creating or seeding the desk,
// the push itself, and the waits afterwards. --timeout replaces it wholesale,
// because a ship slow enough to need more for one of these needs more for all
// of them; having some phases configurable and others not just moves which one
// fails first.
const PHASE_TIMEOUT_MS = 30 * 60_000;
// Deliberately left out of --timeout and deliberately shorter. This read is
// how a desk with no usable threads is detected, and that detection has to
// stay quick: raising it would make the ordinary first run against a
// pre-thread pier wait out the whole budget before deciding to seed.
const HASH_TIMEOUT_MS = 5 * 60_000;

function positiveMs(raw, fallback, flag) {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} wants a positive whole number of ms, got: ${raw}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const [dir, desk, ...rest] = argv;
  const opt = (name) =>
    rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined;
  if (!dir || !desk || !(opt('--pier') || opt('--url'))) {
    console.error(
      'usage: desk-push.mjs <assembled-dir> <desk> (--pier <path> | --url <http://host:port> (--code <+code> | --cookie <urbauth>)) [--install] [--reseed] [--ignore <path>]... [--incidental <path>]... [--wait-scry <eyre-path>] [--timeout <ms>] [--dry-run]'
    );
    process.exit(2);
  }
  return {
    dir,
    desk,
    pier: opt('--pier'),
    url: opt('--url'),
    cookie: opt('--cookie'),
    code: opt('--code'),
    install: rest.includes('--install'),
    dryRun: rest.includes('--dry-run'),
    // re-seed even if -desk-hashes answers: repairs a desk whose threads no
    // longer build, since the push itself depends on them. Never turns into a
    // %park against a desk that already exists.
    reseed: rest.includes('--reseed') || rest.includes('--bootstrap'),
    // accepted either as it appears on disk (desk.docket-0) or as clay spells
    // it (/desk/docket-0); both normalise to the clay path used for matching
    ignore: rest.flatMap((a, i) =>
      a === '--ignore' ? [toClayPath(rest[i + 1])] : []
    ),
    // paths that must not make a commit happen on their own, but that should
    // ride along with any commit that does. desk/app/groups.hoon and
    // desk/app/logs.hoon both import /commit/txt, putting it in crash traces
    // and telemetry, so a stale stamp names the wrong revision in exactly the
    // reports someone reads when a test fails.
    incidental: rest.flatMap((a, i) =>
      a === '--incidental' ? [toClayPath(rest[i + 1])] : []
    ),
    // an eyre scry path to poll after a commit, e.g.
    // /~/scry/groups/groups/light.json — proves the desk's agents are serving
    // again rather than only that clay advanced
    waitScry: opt('--wait-scry'),
    // how long a slow ship may take for one phase; the readiness poll uses it
    timeout: positiveMs(opt('--timeout'), PHASE_TIMEOUT_MS, '--timeout'),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Right after a %park the %cb dais build for the new desk has been seen to
// return nothing once, which khan reports as %mark-invalid; a retry succeeds.
async function remoteHashesRetrying(ship, desk, attempts = 4) {
  for (let i = 1; ; i += 1) {
    try {
      return await remoteHashes(ship, desk);
    } catch (e) {
      if (i === attempts || e instanceof ThreadError) throw e;
      console.log(
        `  desk-hashes not ready (${e.message.split('\n')[0]}); retrying`
      );
      await sleep(2000 * i);
    }
  }
}

async function remoteHashes(ship, desk) {
  const map = await ship.fyrd(desk, 'desk-hashes', cord(desk), {
    timeoutMs: HASH_TIMEOUT_MS,
  });
  const out = new Map();
  for (const kv of treapEntries(map)) {
    out.set(pathString(kv.head), kv.tail.number.toString(16).padStart(64, '0'));
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ship = await Ship.connect(args);
  const local = walk(args.dir).map((f) => ({
    ...f,
    path: '/' + clayPath(f.rel).join('/'),
  }));

  // --ignore leaves a path exactly as the ship has it: neither pushed when it
  // differs nor deleted when absent locally. The bot harness uses it for
  // commit.txt and desk.docket-0, which the glob bot rewrites several times a
  // day without changing any hoon, so that a frontend-only develop does not
  // force a commit and a full agent reload on every run. It has to apply to
  // the seed as well, or the one write that is supposed to leave these alone
  // would be the write that overwrites them.
  const ignored = (p) => args.ignore.includes(p);
  const incidental = (p) => args.incidental.includes(p);
  // the seed is a full write, so incidental paths belong in it; only the fully
  // ignored ones are held back
  const pushable = local.filter((f) => !ignored(f.path));

  // Whether the desk is already in clay decides how a missing thread is
  // handled, and it has to be decided BEFORE any write: %park makes a root
  // commit holding only what it is given, so parking the seed over a desk
  // that already has content would delete that content.
  const exists = await ship.exists(args.desk);

  // A seed is a real commit against a live desk, so it reloads that desk's
  // agents just as an ordinary push does. Whether to wait for the desk to
  // serve again therefore depends on either write having happened, not only
  // on the last one.
  let seeded = false;
  let remote;
  try {
    if (args.reseed) throw new Error('--reseed requested');
    remote = await remoteHashes(ship, args.desk);
  } catch (e) {
    if (exists) {
      // The desk is there but has no usable threads — the normal state of any
      // ship that has not yet taken a release carrying them, and also what a
      // thread that runs but fails looks like. Seed it with a full %into,
      // which is a delta on top of the current head and so leaves everything
      // already committed in place. Re-reading the hashes afterwards is what
      // makes deletions possible: without a remote file list there is no way
      // to know what the branch removed, and quietly skipping deletions would
      // leave stale marks and libraries on the ship while reporting success.
      // If the thread still fails after seeding, remoteHashesRetrying rethrows
      // rather than pretending the desk converged.
      console.log(
        `%${args.desk} exists but has no usable threads (${e.message.split('\n')[0]}); seeding it`
      );
      if (args.dryRun) {
        console.log(
          `would mount %${args.desk} and %into ${local.length} files to add the threads`
        );
        return;
      }
      const t0 = Date.now();
      await ship.seedExisting(args.desk, modeNoun(pushable, []), {
        timeoutMs: args.timeout,
      });
      seeded = true;
      console.log(
        `seeded %${args.desk} with ${pushable.length} files in ${((Date.now() - t0) / 1000).toFixed(1)}s`
      );
      remote = await remoteHashesRetrying(ship, args.desk);
    } else {
      console.log(
        `no %${args.desk} on the ship (${e.message.split('\n')[0]}); creating it`
      );
      const seed = local.filter((f) => BOOTSTRAP_FILES.includes(f.rel));
      const missing = BOOTSTRAP_FILES.filter(
        (rel) => !seed.some((f) => f.rel === rel)
      );
      if (missing.length)
        throw new Error(
          `bootstrap files missing from ${args.dir}: ${missing.join(', ')}`
        );
      if (args.dryRun) {
        console.log(`would %park ${seed.length} files to create %${args.desk}`);
        return;
      }
      const pages = dejs.map(
        seed.map((f) => ({
          key: pathNoun(clayPath(f.rel)),
          val: cell(YES, pageNoun(f.rel, f.buf)),
        }))
      );
      const t0 = Date.now();
      await ship.park(args.desk, pages, { timeoutMs: args.timeout });
      console.log(
        `parked ${seed.length} bootstrap files into %${args.desk} in ${((Date.now() - t0) / 1000).toFixed(1)}s`
      );
      remote = await remoteHashesRetrying(ship, args.desk);
    }
  }

  const differs = (f) => remote.get(f.path) !== shax(f.buf);
  const changed = local.filter(
    (f) => !ignored(f.path) && !incidental(f.path) && differs(f)
  );
  // included only once something else is already being committed, so the stamp
  // never triggers a rebuild by itself but is never stale after a real one
  const carried = local.filter((f) => incidental(f.path) && differs(f));
  if (process.env.DESK_PUSH_DEBUG) {
    for (const f of changed.slice(0, 4)) {
      console.log(
        `  ${f.path}\n    ship  ${remote.get(f.path) ?? '(absent)'}\n    local ${shax(f.buf)}`
      );
    }
  }
  const localPaths = new Set(local.map((f) => f.path));
  const deleted = [...remote.keys()].filter(
    (p) => !localPaths.has(p) && !ignored(p) && !incidental(p)
  );

  if (changed.length === 0 && deleted.length === 0) {
    console.log(`%${args.desk} unchanged (${remote.size} files)`);
    if (seeded && args.waitScry) {
      await waitScry(ship, args.waitScry, args.timeout);
    }
    return;
  }
  console.log(
    `%${args.desk}: ${changed.length} changed, ${deleted.length} deleted, ` +
      `${local.length - changed.length - carried.length} unchanged` +
      (carried.length ? `, ${carried.length} carried along` : '')
  );
  if (args.dryRun) {
    for (const f of changed) console.log(`  ~ ${f.path}`);
    for (const p of deleted) console.log(`  - ${p}`);
    return;
  }

  const arg = cell(
    cord(args.desk),
    cell(modeNoun([...changed, ...carried], deleted), args.install ? YES : NO)
  );

  // a commit that fails to build crashes the event; that surfaces from fyrd()
  // as a ShipError carrying the trace, so a result here means it landed
  const t0 = Date.now();
  const result = await ship.fyrd(args.desk, 'desk-push', arg, {
    timeoutMs: args.timeout,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const committed = result.head.number === 0n;
  const aeon = result.tail.head.number;
  const hash = result.tail.tail.number.toString(16).slice(0, 10);
  console.log(
    committed
      ? `committed %${args.desk} at revision ${aeon} (${hash}) in ${secs}s`
      : `%${args.desk} still at revision ${aeon} (${hash}): clay found nothing new to commit`
  );
  if (args.install) await waitLive(ship, args.desk, args.timeout);
  if ((committed || seeded) && args.waitScry) {
    await waitScry(ship, args.waitScry, args.timeout);
  }
}

// A commit that reloads agents leaves them unavailable for a while after clay
// is done. Callers that hand the ship straight to a test suite need to wait for
// that, or the suite races the reload.
async function waitScry(ship, scryPath, timeoutMs) {
  const t0 = Date.now();
  for (;;) {
    if (await ship.scryOk(scryPath)) {
      console.log(
        `${scryPath} answered ${((Date.now() - t0) / 1000).toFixed(1)}s after the commit`
      );
      return;
    }
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(
        `${scryPath} did not answer within ${timeoutMs / 1000}s of the commit`
      );
    }
    await sleep(2000);
  }
}

// kiln acknowledges |install before gall has started every agent; poll its
// own view rather than probing one agent's scry
async function waitLive(ship, desk, timeoutMs) {
  const t0 = Date.now();
  for (;;) {
    const zest = await ship.zest(desk);
    if (zest === 'live') {
      console.log(
        `%${desk} is live (${((Date.now() - t0) / 1000).toFixed(1)}s after install)`
      );
      return;
    }
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(
        `%${desk} is ${zest}, not live, ${timeoutMs / 1000}s after install`
      );
    }
    await sleep(2000);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

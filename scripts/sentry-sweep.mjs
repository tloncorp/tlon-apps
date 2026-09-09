#!/usr/bin/env node
// sentry-sweep — zero-inference Sentry digest for the sentry-sweep workflow.
// Read-only against Sentry. Prints a digest to stdout ONLY when there is
// something to report. Two output modes, both off unless configured: when
// POSTHOG_API_KEY is set it sends one PostHog event per digest line (a PostHog
// webhook destination relays them into the Tlon channel with credentials this
// repo never holds); when the TLON_POST_* env vars are set it posts the digest
// into a Tlon channel directly (Eyre poke to %channels on an alert moon, the
// same wire format the web client uses). The state file is updated only after
// every configured output succeeded. No dependencies: global fetch, node:fs,
// node:test (tests). Never prints the token, the PostHog key or the cookie.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULTS = {
  base: 'https://de.sentry.io/api/0',
  org: 'tlon-corporation',
  projects: 'web=4510506111467600,mobile=4510364799467600',
  state: './sentry-sweep-state.json',
  maxLines: 15,
  posthogCaptureUrl: 'https://eu.i.posthog.com/batch/',
  posthogDistinctId: 'sentry-sweep',
};

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_PAGES = 5; // pagination cap per query
const REQUEST_TIMEOUT_MS = 20000;
const TITLE_MAX = 80;

// ---------------------------------------------------------------------------
// Pure helpers (exported so the test can cover them without any network).
// ---------------------------------------------------------------------------

// "web=123,mobile=456" -> [{ label: 'web', id: '123' }, { label: 'mobile', id: '456' }]
export function parseProjects(str) {
  const out = [];
  for (const pair of String(str ?? '').split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue; // ignore malformed entries
    const label = trimmed.slice(0, eq).trim();
    const id = trimmed.slice(eq + 1).trim();
    if (label && id) out.push({ label, id });
  }
  return out;
}

// Sentry search-syntax boundary: UTC, no milliseconds -> YYYY-MM-DDTHH:MM:SS
function formatBoundary(input) {
  const d = input instanceof Date ? input : new Date(input);
  return d.toISOString().slice(0, 19);
}

// Build the two Sentry issue-search queries for a boundary. Sentry uses
// `firstSeen`/`lastSeen` with a `>` comparator; `is:unresolved` vs `is:regressed`
// distinguishes brand-new issues from ones that came back after being resolved.
export function buildQueries(boundaryIso) {
  const b = formatBoundary(boundaryIso);
  return {
    new: `is:unresolved firstSeen:>${b}`,
    regressed: `is:regressed lastSeen:>${b}`,
  };
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

// Merge per-label { new, regressed } buckets into one sorted list.
// `reported` is state.reported ({ id: ISO }); `now` is a Date/ISO.
export function mergeIssues(data, reported = {}, now = new Date()) {
  const nowMs = toDate(now).getTime();
  const byId = new Map();

  const consider = (label, issue, kind) => {
    if (!issue || issue.id == null) return;
    const id = String(issue.id);
    const existing = byId.get(id);
    // An issue in BOTH lists is REGRESSED (regressed wins); never downgrade it.
    if (existing && existing.kind === 'REGRESSED') return;
    byId.set(id, {
      id,
      label,
      kind,
      shortId: issue.shortId ?? '',
      title: issue.title ?? '',
      count: Number(issue.count) || 0, // Sentry returns count as a string
      userCount: Number(issue.userCount) || 0,
      permalink: issue.permalink ?? '',
    });
  };

  // Regressed first so it wins the dedupe-by-id, then new.
  for (const [label, bucket] of Object.entries(data ?? {})) {
    for (const issue of bucket?.regressed ?? [])
      consider(label, issue, 'REGRESSED');
  }
  for (const [label, bucket] of Object.entries(data ?? {})) {
    for (const issue of bucket?.new ?? []) consider(label, issue, 'NEW');
  }

  const items = [];
  for (const item of byId.values()) {
    // Dedupe across runs: skip anything already announced within the last 24h.
    // Older-than-24h entries are allowed through (they may regress again later).
    const ts = reported?.[item.id];
    if (ts && nowMs - Date.parse(ts) < DAY_MS) continue;
    items.push(item);
  }

  const rank = { REGRESSED: 0, NEW: 1 };
  items.sort((a, b) => {
    if (a.kind !== b.kind) return rank[a.kind] - rank[b.kind];
    if (b.userCount !== a.userCount) return b.userCount - a.userCount;
    if (b.count !== a.count) return b.count - a.count;
    return 0;
  });
  return items;
}

// Totals + per-project regressed/new counts. `order` keeps the project labels in
// the configured SENTRY_PROJECTS order rather than first-appearance order.
function computeCounts(items, order = []) {
  const per = {};
  let regressed = 0;
  let fresh = 0;
  for (const it of items) {
    per[it.label] ??= { label: it.label, regressed: 0, new: 0 };
    if (it.kind === 'REGRESSED') {
      per[it.label].regressed++;
      regressed++;
    } else {
      per[it.label].new++;
      fresh++;
    }
  }
  const labels = Object.keys(per).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return { regressed, new: fresh, perProject: labels.map((l) => per[l]) };
}

function truncateTitle(s) {
  const str = String(s ?? '');
  return str.length <= TITLE_MAX ? str : `${str.slice(0, TITLE_MAX - 1)}…`;
}

// Shared digest computation: header text, capped detail items, and the
// "and N more" query links. formatDigest renders it as plain text, buildStory
// renders it as Tlon verses; the two must never drift apart.
function digestParts(items, opts) {
  const {
    now = new Date(),
    maxLines = DEFAULTS.maxLines,
    org = DEFAULTS.org,
    clamped = false,
  } = opts;
  const counts = opts.counts ?? computeCounts(items);

  const when = toDate(now).toISOString().slice(0, 16).replace('T', ' ');
  const perProject = counts.perProject
    .map((p) => `${p.label} ${p.regressed}/${p.new}`)
    .join(', ');
  let header = `Sentry sweep ${when} UTC: ${counts.regressed} regressed, ${counts.new} new`;
  if (perProject) header += ` (${perProject})`;
  if (clamped) header += ' (catching up: window clamped to 24h)';

  const shown = items.slice(0, maxLines);
  const remaining = items.length - shown.length;
  const regressedUrl = `https://${org}.sentry.io/issues/?query=${encodeURIComponent('is:regressed')}`;
  const newUrl = `https://${org}.sentry.io/issues/?query=${encodeURIComponent('is:unresolved is:new')}`;
  return { header, shown, remaining, regressedUrl, newUrl, org };
}

function issueHref(it, org) {
  return it.permalink || `https://${org}.sentry.io/issues/${it.id}/`;
}

// A digest detail line without the short id and the link — the PostHog
// destination renders the link itself from `permalink`/`shortId`. Must stay in
// step with formatDigest's detail lines.
function issueText(it) {
  return (
    `${it.kind} ${it.label} "${truncateTitle(it.title)}" ` +
    `${it.count} events / ${it.userCount} users`
  );
}

// Render the plain-text digest. Returns '' when there is nothing to report.
export function formatDigest(items, opts = {}) {
  if (!items || items.length === 0) return '';
  const { header, shown, remaining, regressedUrl, newUrl, org } = digestParts(
    items,
    opts
  );

  const lines = [header];
  for (const it of shown) {
    lines.push(
      `${it.kind} ${it.label} ${it.shortId} "${truncateTitle(it.title)}" ` +
        `${it.count} events / ${it.userCount} users ${issueHref(it, org)}`
    );
  }
  if (remaining > 0) {
    lines.push(`… and ${remaining} more: ${regressedUrl}  ${newUrl}`);
  }
  return lines.join('\n');
}

// Render the digest as a Tlon story: one { inline: [...] } verse per digest
// line (each verse renders as its own line; no `break` inlines needed). Issue
// links become `link` inlines (content = shortId) instead of raw URLs.
// See packages/api/src/urbit/content.ts for the inline union.
export function buildStory(items, opts = {}) {
  if (!items || items.length === 0) return [];
  const { header, shown, remaining, regressedUrl, newUrl, org } = digestParts(
    items,
    opts
  );

  const story = [{ inline: [header] }];
  for (const it of shown) {
    story.push({
      inline: [
        `${it.kind} ${it.label} `,
        { link: { href: issueHref(it, org), content: it.shortId } },
        ` "${truncateTitle(it.title)}" ${it.count} events / ${it.userCount} users`,
      ],
    });
  }
  if (remaining > 0) {
    story.push({
      inline: [
        `… and ${remaining} more: `,
        { link: { href: regressedUrl, content: 'regressed' } },
        '  ',
        { link: { href: newUrl, content: 'new' } },
      ],
    });
  }
  return story;
}

// The Eyre channel-PUT envelope carrying one chat post, mirroring
// packages/api postsApi.sendPost + Urbit.poke: a one-element array with a
// `channel-action-2` poke of %channels. `ship` is bare (no sig); the essay
// `author` carries the sig.
export function buildPokeBody({ ship, nest, story, sent }) {
  const bare = String(ship ?? '').replace(/^~/, '');
  return [
    {
      id: 1,
      action: 'poke',
      ship: bare,
      app: 'channels',
      mark: 'channel-action-2',
      json: {
        channel: {
          nest,
          action: {
            post: {
              add: {
                content: story,
                sent,
                author: `~${bare}`,
                kind: '/chat',
                meta: null,
                blob: null,
              },
            },
          },
        },
      },
    },
  ];
}

// One PostHog event per printed digest line (same SWEEP_MAX_LINES cap), plus a
// `MORE` event when the cap left issues unprinted. Pure and key-free: the
// caller adds `api_key`, so neither the tests nor --print-post ever see it. A
// PostHog webhook destination turns each event into one Tlon chat post.
export function buildPosthogBatch(items, opts = {}) {
  const {
    now = new Date(),
    maxLines = DEFAULTS.maxLines,
    org = DEFAULTS.org,
    distinctId = DEFAULTS.posthogDistinctId,
  } = opts;
  if (!items || items.length === 0) return { api_key: undefined, batch: [] };

  const { shown, remaining, regressedUrl } = digestParts(items, {
    now,
    maxLines,
    org,
  });
  const isoNow = toDate(now).toISOString();
  const event = (properties) => ({
    event: 'Sentry Issue Alert',
    distinct_id: distinctId,
    timestamp: isoNow,
    properties: {
      $lib: 'sentry-sweep',
      $process_person_profile: false, // no person profile: this is a bot feed
      ...properties,
      sweepRunAt: isoNow,
    },
  });

  const batch = shown.map((it) =>
    event({
      kind: it.kind,
      project: it.label,
      shortId: it.shortId,
      title: truncateTitle(it.title),
      count: it.count,
      userCount: it.userCount,
      permalink: issueHref(it, org),
      text: issueText(it),
    })
  );
  if (remaining > 0) {
    batch.push(
      event({
        kind: 'MORE',
        project: '',
        shortId: 'more',
        title: '',
        count: 0,
        userCount: 0,
        permalink: regressedUrl, // the digest's is:regressed search
        text: `… and ${remaining} more regressed/new issues`,
      })
    );
  }
  return { api_key: undefined, batch };
}

// Next state: lastRun = now, record every printed id, prune entries older than 7 days.
export function nextState(state, printedIds, now = new Date()) {
  const nowDate = toDate(now);
  const nowIso = nowDate.toISOString();
  const nowMs = nowDate.getTime();
  const reported = {};
  for (const [id, ts] of Object.entries(state?.reported ?? {})) {
    const t = Date.parse(ts);
    if (!Number.isNaN(t) && nowMs - t <= WEEK_MS) reported[id] = ts; // keep < 7d
  }
  for (const id of printedIds ?? []) reported[String(id)] = nowIso;
  return { lastRun: nowIso, reported };
}

// ---------------------------------------------------------------------------
// Network (all of it lives here).
// ---------------------------------------------------------------------------

// Pull the rel="next"; results="true" URL out of a Sentry Link header.
function parseLinkNext(header) {
  if (!header) return null;
  for (const part of header.split(/,\s*(?=<)/)) {
    const url = part.match(/<([^>]+)>/);
    if (!url) continue;
    if (/rel="?next"?/i.test(part) && /results="?true"?/i.test(part))
      return url[1];
  }
  return null;
}

async function fetchPage(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      /* ignore body read errors */
    }
    // Status + first 120 chars of the body. The token is in a header, never the
    // URL or body, so it cannot leak here.
    throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`.trim());
  }
  const data = await res.json();
  return {
    issues: Array.isArray(data) ? data : [],
    next: parseLinkNext(res.headers.get('link')),
  };
}

async function fetchQuery({ base, org, token, projectId, query }) {
  const url = new URL(`${base}/organizations/${org}/issues/`);
  url.searchParams.set('project', projectId);
  url.searchParams.set('statsPeriod', '24h');
  url.searchParams.set('limit', '100');
  url.searchParams.set('sort', 'date');
  url.searchParams.set('query', query);

  const all = [];
  let next = url.toString();
  for (let page = 0; page < MAX_PAGES && next; page++) {
    const res = await fetchPage(next, token);
    all.push(...res.issues);
    next = res.next;
  }
  return all;
}

// Returns { "<label>": { new: [...issues], regressed: [...issues] } }.
export async function fetchIssues({ base, org, token, projects, queries }) {
  const out = {};
  for (const { label, id } of projects) {
    const [fresh, regressed] = await Promise.all([
      fetchQuery({ base, org, token, projectId: id, query: queries.new }),
      fetchQuery({ base, org, token, projectId: id, query: queries.regressed }),
    ]);
    out[label] = { new: fresh, regressed };
  }
  return out;
}

// Send one PostHog batch (`{ api_key, batch: [...] }`) to the capture URL; any
// 2xx is success. The project token lives only in the request body — thrown
// messages carry status/reason (or the fetch error), never the key.
async function postPosthogBatch({ url, apiKey, batch }) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, batch }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`posthog ${err?.message ?? String(err)}`);
  }
  if (!res.ok) {
    throw new Error(`posthog HTTP ${res.status} ${res.statusText}`.trim());
  }
}

// Post the story into the target channel through Eyre on the alert moon:
// PUT the poke to a fresh channel URL, then best-effort PUT a `delete` to
// close the channel again. Eyre answers the poke PUT with 204; any 2xx is
// success. The cookie lives only in a request header — thrown messages carry
// status/reason (or the fetch error), never the cookie.
async function postStory({ url, ship, cookie, nest, story, sent }) {
  const channelUrl = `${String(url).replace(/\/+$/, '')}/~/channel/${sent}-sentry-sweep`;
  const headers = {
    'Content-Type': 'application/json',
    Cookie: `urbauth-~${String(ship).replace(/^~/, '')}=${cookie}`,
  };

  let res;
  try {
    res = await fetch(channelUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(buildPokeBody({ ship, nest, story, sent })),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`post ${err?.message ?? String(err)}`);
  }
  if (!res.ok) {
    throw new Error(`post HTTP ${res.status} ${res.statusText}`.trim());
  }

  try {
    await fetch(channelUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify([{ id: 2, action: 'delete' }]),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    /* best effort: a leaked Eyre channel is harmless */
  }
}

// ---------------------------------------------------------------------------
// State file (atomic temp-file + rename).
// ---------------------------------------------------------------------------

function loadState(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      return {
        lastRun: parsed.lastRun ?? null,
        reported:
          parsed.reported && typeof parsed.reported === 'object'
            ? parsed.reported
            : {},
      };
    }
  } catch {
    /* missing or corrupt -> start fresh */
  }
  return { lastRun: null, reported: {} };
}

function saveState(path, state) {
  const abs = resolve(path);
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, abs); // atomic on POSIX
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { dryRun: false, since: null, fixture: null, printPost: false };
  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--print-post') flags.printPost = true;
    else if (arg.startsWith('--since='))
      flags.since = arg.slice('--since='.length);
    else if (arg.startsWith('--fixture='))
      flags.fixture = arg.slice('--fixture='.length);
  }
  return flags;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const flags = parseArgs(argv);
  const base = env.SENTRY_BASE || DEFAULTS.base;
  const org = env.SENTRY_ORG || DEFAULTS.org;
  const statePath = env.SWEEP_STATE || DEFAULTS.state;
  const maxLines = Number(env.SWEEP_MAX_LINES || DEFAULTS.maxLines);
  const token = env.SENTRY_TOKEN || '';
  const projects = parseProjects(env.SENTRY_PROJECTS || DEFAULTS.projects);
  // PostHog mode engages on the project token alone (a public capture key,
  // still never printed). A PostHog webhook destination relays the events into
  // the Tlon channel — see docs/sentry-sweep.md.
  const posthog = {
    apiKey: env.POSTHOG_API_KEY || '',
    url: env.POSTHOG_CAPTURE_URL || DEFAULTS.posthogCaptureUrl,
    distinctId: env.POSTHOG_DISTINCT_ID || DEFAULTS.posthogDistinctId,
  };
  const posthogEnabled = Boolean(posthog.apiKey);
  // Direct-Tlon mode engages only when ALL four are set (the cookie is a secret
  // and is never printed). Without them the script keeps its stdout-only behavior.
  const post = {
    url: (env.TLON_POST_URL || '').replace(/\/+$/, ''),
    ship: env.TLON_POST_SHIP || '',
    cookie: env.TLON_POST_COOKIE || '',
    nest: env.TLON_POST_NEST || '',
  };
  const postEnabled = Boolean(
    post.url && post.ship && post.cookie && post.nest
  );
  const now = new Date();
  const state = loadState(statePath);

  // Boundary = last-run time, optionally overridden by --since.
  let boundary;
  if (flags.since) {
    boundary = new Date(flags.since);
    if (Number.isNaN(boundary.getTime())) {
      process.stderr.write('sentry-sweep failed: invalid --since value\n');
      return 1;
    }
  } else if (state.lastRun) {
    boundary = new Date(state.lastRun);
    if (Number.isNaN(boundary.getTime()))
      boundary = new Date(now.getTime() - 30 * MINUTE_MS);
  } else {
    boundary = new Date(now.getTime() - 30 * MINUTE_MS); // missing state -> last 30 min
  }

  // 24h clamp: Sentry statsPeriod is fixed at 24h, and a bot that was down for
  // days should not try to sweep an unbounded window. Note the clamp in the header.
  let clamped = false;
  const floor = new Date(now.getTime() - DAY_MS);
  if (boundary.getTime() < floor.getTime()) {
    boundary = floor;
    clamped = true;
  }

  let data;
  try {
    if (flags.fixture) {
      data = JSON.parse(readFileSync(flags.fixture, 'utf8')); // no network
    } else {
      if (!token) throw new Error('SENTRY_TOKEN is required');
      data = await fetchIssues({
        base,
        org,
        token,
        projects,
        queries: buildQueries(boundary),
      });
    }
  } catch (err) {
    process.stderr.write(
      `sentry-sweep failed: ${err?.message ?? String(err)}\n`
    );
    return 1; // do NOT update state on failure
  }

  const items = mergeIssues(data, state.reported, now);

  if (items.length === 0) {
    if (!flags.dryRun) saveState(statePath, nextState(state, [], now));
    return 0; // nothing to report -> print nothing
  }

  const counts = computeCounts(
    items,
    projects.map((p) => p.label)
  );
  const digestOpts = { now, maxLines, org, counts, clamped };
  const posthogOpts = { now, maxLines, org, distinctId: posthog.distinctId };
  process.stdout.write(`${formatDigest(items, digestOpts)}\n`);

  if (flags.dryRun) {
    // --print-post: eyeball the exact JSON a real run would send, for whichever
    // output modes are configured. The PostHog batch is printed without its
    // api_key; the poke body carries ship/nest only — no URL, no cookie.
    if (flags.printPost) {
      if (!posthogEnabled && (!post.ship || !post.nest)) {
        process.stderr.write(
          'sentry-sweep failed: --print-post requires POSTHOG_API_KEY, or TLON_POST_SHIP and TLON_POST_NEST\n'
        );
        return 1;
      }
      if (posthogEnabled) {
        const payload = buildPosthogBatch(items, posthogOpts);
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      }
      if (post.ship && post.nest) {
        const body = buildPokeBody({
          ship: post.ship,
          nest: post.nest,
          story: buildStory(items, digestOpts),
          sent: Date.now(),
        });
        process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
      }
    }
    return 0; // dry-run never posts and never writes state
  }

  // PostHog first, then the direct Tlon post; either failure aborts the run
  // before the state is saved, so the next run re-reports this window.
  if (posthogEnabled) {
    try {
      const { batch } = buildPosthogBatch(items, posthogOpts);
      await postPosthogBatch({
        url: posthog.url,
        apiKey: posthog.apiKey,
        batch,
      });
    } catch (err) {
      process.stderr.write(
        `sentry-sweep failed: ${err?.message ?? String(err)}\n`
      );
      return 1; // state NOT updated -> the next run re-reports this window
    }
  }

  if (postEnabled) {
    try {
      await postStory({
        ...post,
        story: buildStory(items, digestOpts),
        sent: Date.now(),
      });
    } catch (err) {
      process.stderr.write(
        `sentry-sweep failed: ${err?.message ?? String(err)}\n`
      );
      return 1; // state NOT updated -> the next run re-reports this window
    }
  }

  // Mark every issue in the digest as reported (the header/“and N more” line
  // announce the capped ones too), so the next run does not repeat them.
  saveState(
    statePath,
    nextState(
      state,
      items.map((it) => it.id),
      now
    )
  );
  return 0;
}

// Run only when executed directly (not when imported by the test).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(
        `sentry-sweep failed: ${err?.message ?? String(err)}\n`
      );
      process.exitCode = 1;
    }
  );
}

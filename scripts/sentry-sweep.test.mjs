// Fixture-driven tests, no network. Run: node --test sentry-sweep.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseProjects,
  buildQueries,
  mergeIssues,
  formatDigest,
  nextState,
  buildStory,
  buildPokeBody,
  buildPosthogBatch,
} from './sentry-sweep.mjs';

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  'sentry-sweep.mjs'
);

// CLI tests must never deliver anything for real: strip every delivery and
// Sentry credential from the inherited environment, then apply per-test values.
const DELIVERY_ENV_KEYS = [
  'SENTRY_TOKEN',
  'POSTHOG_API_KEY',
  'POSTHOG_CAPTURE_URL',
  'POSTHOG_DISTINCT_ID',
  'TLON_POST_URL',
  'TLON_POST_SHIP',
  'TLON_POST_COOKIE',
  'TLON_POST_NEST',
];
function childEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of DELIVERY_ENV_KEYS) delete env[key];
  return { ...env, ...overrides };
}

const NOW = new Date('2026-09-09T16:30:00Z');
const iso = (msAgo) => new Date(NOW.getTime() - msAgo).toISOString();
const H = 60 * 60 * 1000;
const D = 24 * H;

// (7) buildQueries: exact search strings, boundary without milliseconds.
test('buildQueries formats both queries without milliseconds', () => {
  const q = buildQueries('2026-09-09T15:00:00.000Z');
  assert.equal(q.new, 'is:unresolved firstSeen:>2026-09-09T15:00:00');
  assert.equal(q.regressed, 'is:regressed lastSeen:>2026-09-09T15:00:00');
});

test('parseProjects parses label=id pairs', () => {
  assert.deepEqual(parseProjects('web=123,mobile=456'), [
    { label: 'web', id: '123' },
    { label: 'mobile', id: '456' },
  ]);
});

// (1) an issue in both lists is reported once, as REGRESSED.
test('mergeIssues reports an issue in both lists once as REGRESSED', () => {
  const issue = {
    id: '1',
    shortId: 'X-1',
    title: 'Boom',
    count: '5',
    userCount: 2,
  };
  const items = mergeIssues(
    { web: { new: [issue], regressed: [{ ...issue }] } },
    {},
    NOW
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'REGRESSED');
  assert.equal(items[0].count, 5); // string count coerced to number
});

// (2) reported within 24h is skipped; older than 24h is not.
test('mergeIssues dedupes against reported within 24h only', () => {
  const data = {
    web: {
      new: [
        { id: 'recent', title: 'r', count: 1, userCount: 1 },
        { id: 'old', title: 'o', count: 1, userCount: 1 },
      ],
      regressed: [],
    },
  };
  const reported = { recent: iso(1 * H), old: iso(25 * H) };
  const items = mergeIssues(data, reported, NOW);
  assert.deepEqual(
    items.map((i) => i.id),
    ['old']
  );
});

// (3) sorting: regressed before new, then userCount desc, then count desc.
test('mergeIssues sorts regressed-first then users desc then count desc', () => {
  const data = {
    web: {
      new: [
        { id: 'n1', title: 'n1', count: 10, userCount: 5 },
        { id: 'n2', title: 'n2', count: 99, userCount: 1 },
      ],
      regressed: [
        { id: 'r1', title: 'r1', count: 3, userCount: 2 },
        { id: 'r2', title: 'r2', count: 50, userCount: 7 },
      ],
    },
  };
  const items = mergeIssues(data, {}, NOW);
  assert.deepEqual(
    items.map((i) => i.id),
    ['r2', 'r1', 'n1', 'n2']
  );
});

// (4) cap at maxLines emits the "and N more" line with the correct N.
test('formatDigest caps detail lines and reports the remaining count', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    label: 'web',
    kind: i < 2 ? 'REGRESSED' : 'NEW',
    shortId: `S-${i}`,
    title: `t${i}`,
    count: i,
    userCount: i,
    permalink: `https://tlon-corporation.sentry.io/issues/${i}/`,
  }));
  const lines = formatDigest(items, {
    now: NOW,
    maxLines: 2,
    org: 'tlon-corporation',
  }).split('\n');
  assert.equal(lines.length, 4); // header + 2 detail + "and more"
  assert.match(
    lines[0],
    /^Sentry sweep 2026-09-09 16:30 UTC: 2 regressed, 3 new \(web 2\/3\)$/
  );
  assert.match(lines[3], /^… and 3 more: /);
  assert.match(lines[3], /is%3Aregressed/);
  assert.match(lines[3], /is%3Aunresolved%20is%3Anew/);
});

// (5) empty input -> empty string.
test('formatDigest returns empty string for no items', () => {
  assert.equal(formatDigest([], { now: NOW, org: 'tlon-corporation' }), '');
});

// (6) nextState prunes >7d entries and records printed ids.
test('nextState prunes entries older than 7 days and records printed ids', () => {
  const state = {
    lastRun: iso(1 * H),
    reported: { keep: iso(3 * D), drop: iso(8 * D) },
  };
  const next = nextState(state, ['p1', 'p2'], NOW);
  assert.equal(next.lastRun, NOW.toISOString());
  assert.equal(next.reported.p1, NOW.toISOString());
  assert.equal(next.reported.p2, NOW.toISOString());
  assert.equal(next.reported.keep, iso(3 * D));
  assert.equal(next.reported.drop, undefined);
});

// Integration: --fixture + --dry-run prints a digest and writes no state.
test('CLI --fixture --dry-run prints a digest without writing state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-'));
  const fixture = join(dir, 'fx.json');
  const statePath = join(dir, 'state.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      web: {
        new: [
          {
            id: '999',
            shortId: 'JS-1',
            title: 'Boom',
            count: '3',
            userCount: 2,
          },
        ],
        regressed: [],
      },
    })
  );
  const since = new Date(Date.now() - H).toISOString();
  const out = execFileSync(
    'node',
    [SCRIPT, `--fixture=${fixture}`, '--dry-run', `--since=${since}`],
    { env: childEnv({ SWEEP_STATE: statePath }), encoding: 'utf8' }
  );
  assert.match(out, /^Sentry sweep /);
  assert.match(
    out,
    /NEW web JS-1 "Boom" 3 events \/ 2 users https:\/\/tlon-corporation\.sentry\.io\/issues\/999\//
  );
  assert.equal(existsSync(statePath), false); // dry-run must not write
});

// Integration: a real run records state and the next run dedupes to empty stdout.
test('CLI --fixture writes state, then dedupes to empty stdout on the next run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-'));
  const fixture = join(dir, 'fx.json');
  const statePath = join(dir, 'state.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      web: {
        new: [
          {
            id: '777',
            shortId: 'JS-2',
            title: 'Once',
            count: '1',
            userCount: 1,
          },
        ],
        regressed: [],
      },
    })
  );
  const env = childEnv({ SWEEP_STATE: statePath });
  const since = new Date(Date.now() - H).toISOString();
  const run = () =>
    execFileSync('node', [SCRIPT, `--fixture=${fixture}`, `--since=${since}`], {
      env,
      encoding: 'utf8',
    });

  assert.match(run(), /NEW web JS-2/);
  const st = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.ok(st.reported['777']);
  assert.equal(run(), ''); // already announced within 24h -> nothing to report
});

// ---------------------------------------------------------------------------
// Post mode: buildStory/buildPokeBody pin the poke JSON without any network.
// ---------------------------------------------------------------------------

const POST_ITEMS = [
  {
    id: '100',
    label: 'web',
    kind: 'REGRESSED',
    shortId: 'JS-100',
    title: 'Cannot read property',
    count: 5,
    userCount: 2,
    permalink: 'https://tlon-corporation.sentry.io/issues/100/',
  },
  {
    id: '200',
    label: 'mobile',
    kind: 'NEW',
    shortId: 'APP-200',
    title: 'Crash on launch',
    count: 9,
    userCount: 4,
    permalink: 'https://tlon-corporation.sentry.io/issues/200/',
  },
];

// (a) one verse per digest line, header first, link inline = shortId/permalink.
test('buildStory yields a header verse then one linked verse per item', () => {
  const story = buildStory(POST_ITEMS, { now: NOW, org: 'tlon-corporation' });
  assert.equal(story.length, 3); // header + 2 issue verses
  assert.deepEqual(story[0], {
    inline: [
      'Sentry sweep 2026-09-09 16:30 UTC: 1 regressed, 1 new (web 1/0, mobile 0/1)',
    ],
  });
  assert.deepEqual(story[1].inline, [
    'REGRESSED web ',
    {
      link: {
        href: 'https://tlon-corporation.sentry.io/issues/100/',
        content: 'JS-100',
      },
    },
    ' "Cannot read property" 5 events / 2 users',
  ]);
  assert.deepEqual(story[2].inline, [
    'NEW mobile ',
    {
      link: {
        href: 'https://tlon-corporation.sentry.io/issues/200/',
        content: 'APP-200',
      },
    },
    ' "Crash on launch" 9 events / 4 users',
  ]);
});

// (b) the poke envelope matches the Eyre/%channels wire format exactly.
test('buildPokeBody produces the exact channel-action-2 envelope', () => {
  const story = [{ inline: ['hi'] }];
  const body = buildPokeBody({
    ship: 'sampel-palnet',
    nest: 'chat/~litseb-sarfel/v1nnn22o',
    story,
    sent: 1757435400000,
  });
  assert.deepEqual(body, [
    {
      id: 1,
      action: 'poke',
      ship: 'sampel-palnet',
      app: 'channels',
      mark: 'channel-action-2',
      json: {
        channel: {
          nest: 'chat/~litseb-sarfel/v1nnn22o',
          action: {
            post: {
              add: {
                content: story,
                sent: 1757435400000,
                author: '~sampel-palnet',
                kind: '/chat',
                meta: null,
                blob: null,
              },
            },
          },
        },
      },
    },
  ]);
  // A sigged ship is normalized: bare in `ship`, sigged in `author`.
  const sigged = buildPokeBody({
    ship: '~sampel-palnet',
    nest: 'n',
    story,
    sent: 1,
  });
  assert.equal(sigged[0].ship, 'sampel-palnet');
  assert.equal(sigged[0].json.channel.action.post.add.author, '~sampel-palnet');
});

// (c) the "and N more" verse carries the regressed + new query links.
test('buildStory "and N more" verse carries two links', () => {
  const items = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    label: 'web',
    kind: 'NEW',
    shortId: `S-${i}`,
    title: `t${i}`,
    count: 1,
    userCount: 1,
    permalink: `https://tlon-corporation.sentry.io/issues/${i}/`,
  }));
  const story = buildStory(items, {
    now: NOW,
    maxLines: 2,
    org: 'tlon-corporation',
  });
  assert.equal(story.length, 4); // header + 2 shown + "and more"
  const last = story[3].inline;
  assert.equal(last[0], '… and 2 more: ');
  const links = last.filter((i) => typeof i === 'object' && i.link);
  assert.equal(links.length, 2);
  assert.equal(links[0].link.content, 'regressed');
  assert.match(links[0].link.href, /is%3Aregressed/);
  assert.equal(links[1].link.content, 'new');
  assert.match(links[1].link.href, /is%3Aunresolved%20is%3Anew/);
});

const POST_ENV = {
  TLON_POST_URL: 'https://example.invalid',
  TLON_POST_SHIP: 'sampel-palnet',
  TLON_POST_COOKIE: 'dummy-cookie-sentinel',
  TLON_POST_NEST: 'chat/~sampel-palnet/test',
};

// (d) --dry-run --print-post prints the poke JSON and writes no state.
test('CLI --dry-run --print-post prints the poke body without writing state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-'));
  const fixture = join(dir, 'fx.json');
  const statePath = join(dir, 'state.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      web: {
        new: [
          {
            id: '999',
            shortId: 'JS-1',
            title: 'Boom',
            count: '3',
            userCount: 2,
            permalink: 'https://tlon-corporation.sentry.io/issues/999/',
          },
        ],
        regressed: [],
      },
    })
  );
  const since = new Date(Date.now() - H).toISOString();
  const out = execFileSync(
    'node',
    [
      SCRIPT,
      `--fixture=${fixture}`,
      '--dry-run',
      '--print-post',
      `--since=${since}`,
    ],
    {
      env: childEnv({ SWEEP_STATE: statePath, ...POST_ENV }),
      encoding: 'utf8',
    }
  );
  assert.match(out, /^Sentry sweep /m); // digest still prints, first
  const body = JSON.parse(out.slice(out.indexOf('\n[') + 1));
  assert.equal(body.length, 1);
  assert.equal(body[0].id, 1);
  assert.equal(body[0].action, 'poke');
  assert.equal(body[0].ship, 'sampel-palnet');
  assert.equal(body[0].app, 'channels');
  assert.equal(body[0].mark, 'channel-action-2');
  assert.equal(body[0].json.channel.nest, 'chat/~sampel-palnet/test');
  const add = body[0].json.channel.action.post.add;
  assert.equal(add.author, '~sampel-palnet');
  assert.equal(add.kind, '/chat');
  assert.deepEqual(add.meta, null);
  assert.deepEqual(add.blob, null);
  assert.equal(typeof add.sent, 'number');
  assert.equal(add.content[1].inline[1].link.content, 'JS-1');
  assert.equal(
    add.content[1].inline[1].link.href,
    'https://tlon-corporation.sentry.io/issues/999/'
  );
  assert.equal(existsSync(statePath), false); // dry-run must not write
  assert.equal(out.includes('dummy-cookie-sentinel'), false);
});

// (e) a failed post exits 1, leaves the state file untouched (so the next run
// re-reports), and never leaks the cookie. 127.0.0.1:9 refuses the connection.
test('CLI post failure exits 1 and leaves the state file unchanged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-'));
  const fixture = join(dir, 'fx.json');
  const statePath = join(dir, 'state.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      web: {
        new: [
          {
            id: '555',
            shortId: 'JS-5',
            title: 'Post fail',
            count: '1',
            userCount: 1,
          },
        ],
        regressed: [],
      },
    })
  );
  const before = `${JSON.stringify({ lastRun: iso(1 * H), reported: {} }, null, 2)}\n`;
  writeFileSync(statePath, before);
  const since = new Date(Date.now() - H).toISOString();
  let err = null;
  try {
    execFileSync('node', [SCRIPT, `--fixture=${fixture}`, `--since=${since}`], {
      env: childEnv({
        SWEEP_STATE: statePath,
        ...POST_ENV,
        TLON_POST_URL: 'http://127.0.0.1:9',
        TLON_POST_COOKIE: 'sentinel-cookie-value',
      }),
      encoding: 'utf8',
    });
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected a non-zero exit');
  assert.equal(err.status, 1);
  assert.match(err.stderr, /^sentry-sweep failed: post /m);
  assert.equal(err.stderr.includes('sentinel-cookie-value'), false);
  assert.equal(err.stdout.includes('sentinel-cookie-value'), false);
  assert.equal(readFileSync(statePath, 'utf8'), before); // untouched
});

// ---------------------------------------------------------------------------
// PostHog mode: buildPosthogBatch pins the event JSON without any network.
// ---------------------------------------------------------------------------

// The exact property set a destination may rely on, in emission order.
const POSTHOG_PROPS = [
  '$lib',
  '$process_person_profile',
  'kind',
  'project',
  'shortId',
  'title',
  'count',
  'userCount',
  'permalink',
  'text',
  'sweepRunAt',
];
const BATCH_OPTS = { now: NOW, maxLines: 15, org: 'tlon-corporation' };

// (a) one event per printed line, exact properties, `text` without the short id.
test('buildPosthogBatch yields one event per item with the exact properties', () => {
  const built = buildPosthogBatch(POST_ITEMS, {
    ...BATCH_OPTS,
    distinctId: 'sentry-sweep',
  });
  assert.equal(built.api_key, undefined); // the caller adds the key
  assert.equal('api_key' in JSON.parse(JSON.stringify(built)), false);
  assert.equal(built.batch.length, 2); // under the cap -> no MORE event
  assert.deepEqual(built.batch[0], {
    event: 'Sentry Issue Alert',
    distinct_id: 'sentry-sweep',
    timestamp: NOW.toISOString(),
    properties: {
      $lib: 'sentry-sweep',
      $process_person_profile: false,
      kind: 'REGRESSED',
      project: 'web',
      shortId: 'JS-100',
      title: 'Cannot read property',
      count: 5,
      userCount: 2,
      permalink: 'https://tlon-corporation.sentry.io/issues/100/',
      text: 'REGRESSED web "Cannot read property" 5 events / 2 users',
      sweepRunAt: NOW.toISOString(),
    },
  });
  assert.deepEqual(Object.keys(built.batch[1].properties), POSTHOG_PROPS);
  assert.equal(built.batch[1].properties.kind, 'NEW');
  assert.equal(built.batch[1].properties.project, 'mobile');
  assert.equal(built.batch[1].properties.text.includes('APP-200'), false);
});

// (a2) titles truncate exactly as they do in the digest.
test('buildPosthogBatch truncates long titles like the digest', () => {
  const long = 'x'.repeat(100);
  const props = buildPosthogBatch([{ ...POST_ITEMS[0], title: long }], {
    ...BATCH_OPTS,
    distinctId: 'sentry-sweep',
  }).batch[0].properties;
  assert.equal(props.title, `${'x'.repeat(79)}…`);
  assert.equal(
    props.text,
    `REGRESSED web "${'x'.repeat(79)}…" 5 events / 2 users`
  );
});

// (a3) the MORE event appears only when the cap left issues unprinted.
test('buildPosthogBatch appends a MORE event only when items exceed maxLines', () => {
  const items = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    label: 'web',
    kind: i < 2 ? 'REGRESSED' : 'NEW',
    shortId: `S-${i}`,
    title: `t${i}`,
    count: i,
    userCount: i,
    permalink: `https://tlon-corporation.sentry.io/issues/${i}/`,
  }));
  const capped = buildPosthogBatch(items, {
    now: NOW,
    maxLines: 2,
    org: 'tlon-corporation',
    distinctId: 'sentry-sweep',
  });
  assert.equal(capped.batch.length, 3); // 2 printed lines + MORE
  const more = capped.batch[2].properties;
  assert.deepEqual(Object.keys(more), POSTHOG_PROPS);
  assert.equal(more.kind, 'MORE');
  assert.equal(more.shortId, 'more');
  assert.equal(more.text, '… and 2 more regressed/new issues');
  assert.equal(
    more.permalink,
    'https://tlon-corporation.sentry.io/issues/?query=is%3Aregressed'
  );
  assert.equal(more.count, 0);
  assert.equal(more.userCount, 0);
  assert.equal(capped.batch[2].timestamp, NOW.toISOString());
  // Exactly at the cap -> no MORE event.
  const exact = buildPosthogBatch(items, {
    now: NOW,
    maxLines: 4,
    org: 'tlon-corporation',
    distinctId: 'sentry-sweep',
  });
  assert.equal(exact.batch.length, 4);
  assert.equal(
    exact.batch.some((e) => e.properties.kind === 'MORE'),
    false
  );
});

const POSTHOG_ENV = { POSTHOG_API_KEY: 'dummy-posthog-key-sentinel' };

// (b) --dry-run --print-post prints the batch JSON, key omitted, no state.
test('CLI --dry-run --print-post prints the PostHog batch without the key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-'));
  const fixture = join(dir, 'fx.json');
  const statePath = join(dir, 'state.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      web: {
        new: [
          {
            id: '999',
            shortId: 'JS-1',
            title: 'Boom',
            count: '3',
            userCount: 2,
            permalink: 'https://tlon-corporation.sentry.io/issues/999/',
          },
        ],
        regressed: [],
      },
    })
  );
  const since = new Date(Date.now() - H).toISOString();
  const out = execFileSync(
    'node',
    [
      SCRIPT,
      `--fixture=${fixture}`,
      '--dry-run',
      '--print-post',
      `--since=${since}`,
    ],
    {
      env: childEnv({ SWEEP_STATE: statePath, ...POSTHOG_ENV }),
      encoding: 'utf8',
    }
  );
  assert.match(out, /^Sentry sweep /m); // digest still prints, first
  const payload = JSON.parse(out.slice(out.indexOf('\n{') + 1));
  assert.equal('api_key' in payload, false);
  assert.equal(out.includes('api_key'), false);
  assert.equal(out.includes('dummy-posthog-key-sentinel'), false);
  assert.equal(payload.batch.length, 1);
  const event = payload.batch[0];
  assert.equal(event.event, 'Sentry Issue Alert');
  assert.equal(event.distinct_id, 'sentry-sweep');
  assert.equal(typeof event.timestamp, 'string');
  assert.deepEqual(Object.keys(event.properties), POSTHOG_PROPS);
  assert.equal(event.properties.$process_person_profile, false);
  assert.equal(event.properties.kind, 'NEW');
  assert.equal(event.properties.shortId, 'JS-1');
  assert.equal(event.properties.text, 'NEW web "Boom" 3 events / 2 users');
  assert.equal(
    event.properties.permalink,
    'https://tlon-corporation.sentry.io/issues/999/'
  );
  assert.equal(existsSync(statePath), false); // dry-run must not write
});

// (c) a failed PostHog post exits 1, leaves the state file untouched (so the
// next run re-reports), and never leaks the key. 127.0.0.1:9 refuses the
// connection.
test('CLI PostHog failure exits 1 and leaves the state file unchanged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-'));
  const fixture = join(dir, 'fx.json');
  const statePath = join(dir, 'state.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      web: {
        new: [
          {
            id: '555',
            shortId: 'JS-5',
            title: 'Post fail',
            count: '1',
            userCount: 1,
          },
        ],
        regressed: [],
      },
    })
  );
  const before = `${JSON.stringify({ lastRun: iso(1 * H), reported: {} }, null, 2)}\n`;
  writeFileSync(statePath, before);
  const since = new Date(Date.now() - H).toISOString();
  let err = null;
  try {
    execFileSync('node', [SCRIPT, `--fixture=${fixture}`, `--since=${since}`], {
      env: childEnv({
        SWEEP_STATE: statePath,
        POSTHOG_API_KEY: 'sentinel-posthog-key',
        POSTHOG_CAPTURE_URL: 'http://127.0.0.1:9/batch/',
      }),
      encoding: 'utf8',
    });
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected a non-zero exit');
  assert.equal(err.status, 1);
  assert.match(err.stderr, /^sentry-sweep failed: posthog /m);
  assert.equal(err.stderr.includes('sentinel-posthog-key'), false);
  assert.equal(err.stdout.includes('sentinel-posthog-key'), false);
  assert.equal(readFileSync(statePath, 'utf8'), before); // untouched
});

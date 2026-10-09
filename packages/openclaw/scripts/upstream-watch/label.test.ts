import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Bullet } from './changelog.ts';
import {
  AREAS,
  DECISIONS_ENDPOINT,
  JEV_MODEL,
  KINDS,
  addressesKey,
} from './jev.ts';
import type { Manifest } from './digest.ts';
import {
  PROFILE_PLACEHOLDERS,
  buildPluginProfile,
  labelBullets,
} from './label.ts';

const bullet = (text: string): Bullet => ({
  release: '2026.9.8',
  section: 'Fixes',
  text,
  prs: [1],
});

const distribution = <T extends string>(options: readonly T[], choice: T) =>
  Object.fromEntries(options.map((o) => [o, o === choice ? 1 : 0]));

const answer = (area: string, kind: string, affects = 0.8) => ({
  answers: {
    area: { choice: area, probabilities: distribution(AREAS, area as never) },
    kind: { choice: kind, probabilities: distribution(KINDS, kind as never) },
    affects: { noul: affects },
  },
  usage: { cost: 0.0001 },
});

interface RequestBody {
  model: string;
  state: { bullet: string } & Record<string, unknown>;
  questions: Record<string, unknown>;
}

type Handler = (body: RequestBody) => Response | Promise<Response>;

function stubFetch(handler: Handler) {
  const calls: RequestBody[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    expect(url).toBe(DECISIONS_ENDPOINT);
    const body = JSON.parse(init.body as string) as RequestBody;
    calls.push(body);
    return handler(body);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

const noSleep = async () => undefined;

const options = {
  apiKey: 'test-key',
  profile: { what: 'test' },
  workarounds: [{ id: 'fallback-patch', note: 'a patch' }],
  sleep: noSleep,
};

describe('labelBullets', () => {
  it('labels with the pinned model and asks workarounds only for our bullets', async () => {
    const { impl, calls } = stubFetch((body) => {
      if (body.questions.area) {
        return json(
          body.state.bullet === 'ours'
            ? answer('gateway_runtime', 'fix')
            : answer('client_ui', 'fix', 0.1)
        );
      }
      return json({
        answers: { [addressesKey('fallback-patch')]: { noul: 0.9 } },
      });
    });
    const { rows, cost } = await labelBullets(
      [bullet('ours'), bullet('not ours')],
      { ...options, fetchImpl: impl }
    );

    expect(calls[0].model).toBe(JEV_MODEL);
    expect(calls[0].state).toMatchObject({
      release: '2026.9.8',
      section: 'Fixes',
      bullet: 'ours',
      plugin_profile: { what: 'test' },
    });
    expect(Object.keys(calls[0].questions)).toEqual([
      'area',
      'affects',
      'kind',
    ]);
    expect(calls).toHaveLength(3);
    expect(calls[2].state.bullet).toBe('ours');
    expect(rows[0]).toMatchObject({
      labeled: true,
      area: 'gateway_runtime',
      kind: 'fix',
      kind_p: 1,
      affects: 0.8,
      addresses: { 'fallback-patch': 0.9 },
      prs: [1],
    });
    expect(rows[1].addresses).toBeUndefined();
    expect(cost).toBeCloseTo(0.0002);
  });

  it('turns every failure into an unlabeled row instead of rejecting', async () => {
    const malformed = answer('gateway_runtime', 'fix');
    malformed.answers.kind.probabilities.fix = 0.5;
    const { impl, calls } = stubFetch(async (body) => {
      switch (body.state.bullet) {
        case 'non-200':
          return json({ error: 'nope' }, 502);
        case 'malformed':
          return json(malformed);
        case 'unknown-choice':
          return json(answer('somewhere_else', 'fix'));
        case 'not-json':
          return new Response('<html>', { status: 200 });
        case 'too-big':
          // a valid decision, so only the size guard can reject it
          return json({
            ...answer('gateway_runtime', 'fix'),
            padding: 'x'.repeat(20 * 1024),
          });
        case 'throws':
          throw new Error('network down');
        default:
          // never answers; the deadline wins
          return new Promise<Response>(() => undefined);
      }
    });
    const { rows } = await labelBullets(
      [
        'non-200',
        'malformed',
        'unknown-choice',
        'not-json',
        'too-big',
        'throws',
        'hangs',
      ].map(bullet),
      { ...options, fetchImpl: impl, timeoutMs: 50 }
    );
    expect(rows.map((r) => [r.bullet, r.labeled, r.reason])).toEqual([
      ['non-200', false, 'http-502'],
      ['malformed', false, 'invalid-answer'],
      ['unknown-choice', false, 'invalid-answer'],
      ['not-json', false, 'invalid-response'],
      ['too-big', false, 'invalid-response'],
      ['throws', false, 'error'],
      ['hangs', false, 'timeout'],
    ]);
    // only the 5xx and the network error are retried
    const attempts = (name: string) =>
      calls.filter((c) => c.state.bullet === name).length;
    expect(
      [
        'non-200',
        'malformed',
        'unknown-choice',
        'not-json',
        'too-big',
        'throws',
        'hangs',
      ].map(attempts)
    ).toEqual([3, 1, 1, 1, 1, 3, 1]);
  });

  it('times out a response whose body stalls after the headers', async () => {
    const { impl } = stubFetch(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"answers":'));
              // never closes
            },
          }),
          { status: 200 }
        )
    );
    const started = Date.now();
    const { rows } = await labelBullets([bullet('stalls')], {
      ...options,
      fetchImpl: impl,
      timeoutMs: 100,
    });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(rows[0]).toMatchObject({ labeled: false, reason: 'timeout' });
  });

  it('never has more than 8 requests in flight, retries included', async () => {
    let active = 0;
    let peak = 0;
    const failedOnce = new Set<string>();
    const { impl, calls } = stubFetch(async (body) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      // every third bullet's label request fails once first
      const key = body.state.bullet;
      if (
        body.questions.area &&
        Number(key.slice(1)) % 3 === 0 &&
        !failedOnce.has(key)
      ) {
        failedOnce.add(key);
        return json({}, 503);
      }
      return body.questions.area
        ? json(answer('gateway_runtime', 'fix'))
        : json({
            answers: { [addressesKey('fallback-patch')]: { noul: 0.1 } },
          });
    });
    const bullets = Array.from({ length: 30 }, (_, i) => bullet(`b${i}`));
    // the backoff waits really, holding its slot meanwhile
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms / 100));
    const { rows } = await labelBullets(bullets, {
      ...options,
      fetchImpl: impl,
      sleep,
    });
    expect(rows.every((r) => r.labeled)).toBe(true);
    // both passes ran, so the bound held across 60 requests and 10 retries
    expect(calls).toHaveLength(70);
    expect(peak).toBe(8);
  });

  it('retries a 429 and labels on the next answer', async () => {
    let n = 0;
    const waits: number[] = [];
    const { impl, calls } = stubFetch(() =>
      n++ === 0
        ? new Response('{}', { status: 429 })
        : json(answer('memory', 'fix'))
    );
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      workarounds: [],
      fetchImpl: impl,
      sleep: async (ms) => void waits.push(ms),
    });
    expect(rows[0]).toMatchObject({ labeled: true, area: 'memory' });
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([500]);
  });

  it('gives up after three 503s with the last reason', async () => {
    const waits: number[] = [];
    const { impl, calls } = stubFetch(() => json({}, 503));
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      workarounds: [],
      fetchImpl: impl,
      sleep: async (ms) => void waits.push(ms),
    });
    expect(rows[0]).toMatchObject({ labeled: false, reason: 'http-503' });
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([500, 1500]);
  });

  it('does not retry a 400', async () => {
    const { impl, calls } = stubFetch(() => json({}, 400));
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      workarounds: [],
      fetchImpl: impl,
    });
    expect(rows[0]).toMatchObject({ labeled: false, reason: 'http-400' });
    expect(calls).toHaveLength(1);
  });

  it('retries a network error and labels on the next answer', async () => {
    let n = 0;
    const { impl, calls } = stubFetch(() => {
      if (n++ === 0) {
        throw new TypeError('fetch failed');
      }
      return json(answer('memory', 'fix'));
    });
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      workarounds: [],
      fetchImpl: impl,
    });
    expect(rows[0]).toMatchObject({ labeled: true, area: 'memory' });
    expect(calls).toHaveLength(2);
  });

  it('waits a small retry-after and gives up on a long one', async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => void waits.push(ms);
    const limited = (seconds: string) => () =>
      new Response('{}', { status: 429, headers: { 'retry-after': seconds } });
    const short = stubFetch(limited('2'));
    await labelBullets([bullet('x')], {
      ...options,
      workarounds: [],
      fetchImpl: short.impl,
      sleep,
    });
    expect(short.calls).toHaveLength(3);
    expect(waits).toEqual([2000, 2000]);
    const long = stubFetch(limited('60'));
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      workarounds: [],
      fetchImpl: long.impl,
      sleep,
    });
    expect(long.calls).toHaveLength(1);
    expect(rows[0]).toMatchObject({ labeled: false, reason: 'http-429' });
  });

  it('stops retrying when the budget would be exceeded', async () => {
    const { impl, calls } = stubFetch(() => json({}, 503));
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      workarounds: [],
      fetchImpl: impl,
      budgetMs: 1000,
    });
    // 500 ms fits; 500 + 1500 does not
    expect(calls).toHaveLength(2);
    expect(rows[0]).toMatchObject({ labeled: false, reason: 'http-503' });
  });

  it('keeps the label when the workaround pass fails', async () => {
    const { impl } = stubFetch((body) =>
      body.questions.area ? json(answer('memory', 'fix')) : json({}, 500)
    );
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      fetchImpl: impl,
    });
    expect(rows[0]).toMatchObject({
      labeled: true,
      area: 'memory',
      addresses_error: 'http-500',
    });
  });

  it('marks everything unlabeled without a key, making no requests', async () => {
    const { impl, calls } = stubFetch(() => json({}));
    const { rows } = await labelBullets([bullet('x')], {
      ...options,
      apiKey: undefined,
      fetchImpl: impl,
    });
    expect(calls).toHaveLength(0);
    expect(rows[0]).toMatchObject({ labeled: false, reason: 'no-api-key' });
  });
});

describe('buildPluginProfile', () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, '../../upstream-watch.json'),
      'utf8'
    )
  ) as Manifest;

  const digest = (
    prodPins: Record<string, string>,
    nextRange: string | undefined
  ): Parameters<typeof buildPluginProfile>[1] => ({
    prev: '2026.9.4',
    next: '2026.9.8',
    subpaths: [
      { subpath: 'plugin-sdk/core', class: 'present-both' },
      { subpath: 'plugin-sdk/channel-outbound', class: 'added-in-next' },
      { subpath: 'plugin-sdk/gone', class: 'absent-in-both' },
    ],
    drift: { prodPins },
    signals: {
      sdkSubpathRemoved: { fired: false, evidence: [] },
      engineChanged: { fired: false, evidence: [], next: nextRange },
      stateSchemaBumped: { fired: false, evidence: [] },
    },
  });

  it('fills the manifest placeholders from the digest', () => {
    const profile = buildPluginProfile(
      manifest.profile,
      digest(
        { default: '2026.7.1', internal: '2026.7.1', memorypool: '' },
        '>=24.16.0 <25'
      ),
      '24.16.0'
    );
    expect(profile.what).toBe(manifest.profile.what);
    expect((profile.plugin_uses as string[])[0]).toBe(
      'openclaw/plugin-sdk subpaths imported by the plugin: core, channel-outbound, gone'
    );
    const deployment = profile.deployment as string[];
    expect(deployment).toContain(
      'production bots run OpenClaw 2026.7.1; this digest compares 2026.9.4 → 2026.9.8'
    );
    expect(deployment).toContain(
      "the plugin's CI runs on Node 24.16.0; OpenClaw 2026.9.8 requires Node >=24.16.0 <25"
    );
    expect(JSON.stringify(profile)).not.toContain('<filled at label time');
  });

  it('names bundles when prod pins differ, and a missing engines range', () => {
    const profile = buildPluginProfile(
      manifest.profile,
      digest(
        { default: '2026.7.1', internal: '2026.9.4', memorypool: '2026.7.1' },
        undefined
      ),
      '24.16.0'
    );
    const deployment = profile.deployment as string[];
    expect(deployment).toContain(
      'production bots run OpenClaw 2026.7.1 (default, memorypool), 2026.9.4 (internal); this digest compares 2026.9.4 → 2026.9.8'
    );
    expect(deployment).toContain(
      "the plugin's CI runs on Node 24.16.0; OpenClaw 2026.9.8 declares no engines.node range"
    );
  });

  it('fails loudly when a placeholder is missing from the manifest', () => {
    const edited = {
      ...manifest.profile,
      deployment: (manifest.profile.deployment as string[]).filter(
        (line) => line !== PROFILE_PLACEHOLDERS.node
      ),
    };
    expect(() =>
      buildPluginProfile(edited, digest({ default: '2026.7.1' }, '>=24'), '24')
    ).toThrow(PROFILE_PLACEHOLDERS.node);
  });
});

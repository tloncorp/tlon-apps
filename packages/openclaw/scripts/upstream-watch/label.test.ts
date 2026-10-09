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

const options = {
  apiKey: 'test-key',
  profile: { what: 'test' },
  workarounds: [{ id: 'fallback-patch', note: 'a patch' }],
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
    const { impl } = stubFetch(async (body) => {
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

  it('never has more than 8 requests in flight', async () => {
    let active = 0;
    let peak = 0;
    const { impl, calls } = stubFetch(async (body) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return body.questions.area
        ? json(answer('gateway_runtime', 'fix'))
        : json({
            answers: { [addressesKey('fallback-patch')]: { noul: 0.1 } },
          });
    });
    const bullets = Array.from({ length: 30 }, (_, i) => bullet(`b${i}`));
    const { rows } = await labelBullets(bullets, {
      ...options,
      fetchImpl: impl,
    });
    expect(rows.every((r) => r.labeled)).toBe(true);
    // both passes ran, so the bound held across 60 requests
    expect(calls).toHaveLength(60);
    expect(peak).toBe(8);
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

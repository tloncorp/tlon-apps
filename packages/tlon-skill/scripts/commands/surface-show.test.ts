import { createHash } from 'crypto';

import { describe, expect, it } from 'bun:test';

import {
  type FakeShipOptions,
  createTestSurfaceDeps,
} from '../surface-test-doubles';
import { run } from './surface';
import { classifyAssetRef } from './surface-show';

/**
 * `surface show` — the read-back path a reviser stands on.
 *
 * Every control here names its fulcrum, because each of these is a guard
 * against a specific way the command could look right and be useless:
 *
 * - the RAW-spec control's fulcrum is the single expression `JSON.parse(
 *   read.raw)` in `runSurfaceShow`. Swapping it for `read.spec` — the
 *   "cleanup" D67 and D72 each record somebody actually making — is a
 *   one-token change that keeps every field a reader would eyeball and
 *   silently drops the undeclared ones. The fixture carries two such keys,
 *   one at spec level and one inside an action, so the assertion moves when
 *   that expression does.
 * - the hash control's fulcrum is `deps.sha256Hex(fetched.bytes) !==
 *   input.sha256`. Its two arms differ only in what STORAGE holds: the spec,
 *   the channel and the pinned hash are identical in both, and the served
 *   bytes are overwritten between them. The double keeps the bucket in a map
 *   that is not derived from the spec, so "storage serves something else" is
 *   expressible at all.
 * - the absence controls' fulcrum is the pair of literals `recipePresent`
 *   and `fetched` in the report. Both are computed, not constant, and each
 *   test asserts the true and the false arm — a field pinned to one value
 *   passes half of each pair and fails the other.
 */

const GROUP = '~zod/dashboards';
const CHANNEL = 'chat/~zod/dash-0001';
const SURFACE_ID = 'srf-potluck';
const ASSET = 'https://storage.example/app.js';

const BUNDLE_SOURCE =
  'const render = (state) => text(state.title);\nconst handlers = {};\n';

function sha256(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf-8')).digest('hex');
}

/**
 * A spec carrying two keys `SurfaceSpecSchema` does not declare.
 *
 * This is the fixture the D72 control turns on. `z.object` strips whatever it
 * does not declare, and what it does not declare is where publish-gate
 * opt-outs live — `duplicatesTolerated` was one such key until it was
 * declared, and declaring it fixed that field and not the class. A reviser
 * handed the stripped view republishes a spec missing the markers its own
 * gate demands, and the republish fails a gate the original passed.
 *
 * `gateWaiver` sits at spec level and `hostClockWaiver` inside an action, so
 * a regression that stripped only the top level would still be caught.
 */
function spec(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    surfaceId: SURFACE_ID,
    specRevision: 3,
    title: 'Potluck',
    bundle: {
      assetRef: ASSET,
      sha256: sha256(BUNDLE_SOURCE),
      size: Buffer.byteLength(BUNDLE_SOURCE, 'utf-8'),
      shellVersion: 1,
    },
    initialState: { bringing: {} },
    actions: {
      'bring-salad': {
        ops: [{ op: 'set', path: '/bringing/$actor', value: 'salad' }],
        hostClockWaiver: true,
      },
    },
    recipe: 'A potluck signup sheet; each member claims one dish.',
    gateWaiver: 'session-6a',
    ...overrides,
  };
}

function setup(
  options: FakeShipOptions & {
    spec?: Record<string, unknown> | null;
    serve?: string | null;
  } = {}
) {
  const harness = createTestSurfaceDeps(options);
  harness.ship.addGroup(GROUP);
  harness.ship.addChannel(GROUP, CHANNEL);
  if (options.spec !== null) {
    harness.ship.setChannelSpec(CHANNEL, options.spec ?? spec());
  }
  if (options.serve !== null) {
    harness.ship.serveAsset(ASSET, options.serve ?? BUNDLE_SOURCE);
  }
  return harness;
}

describe('surface show — the definition', () => {
  it('returns the definition raw, keys the schema strips included', async () => {
    const harness = setup();
    expect(await run(['show', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();

    expect(result.ok).toBe(true);
    expect(result.specSource).toBe('raw-description-cell');

    const returned = result.spec as Record<string, unknown>;
    // THE CONTROL. `SurfaceSpecSchema.parse` drops both of these; the raw
    // cell keeps them. Reporting `read.spec` here passes every other
    // assertion in this file and fails exactly this one.
    expect(returned.gateWaiver).toBe('session-6a');
    expect(
      (returned.actions as Record<string, Record<string, unknown>>)[
        'bring-salad'
      ].hostClockWaiver
    ).toBe(true);

    // And the whole document is the cell, byte for byte — not a rebuild of it.
    expect(result.specText).toBe(harness.ship.channelSpecText(CHANNEL));
    expect(JSON.parse(result.specText as string)).toEqual(returned);
  });

  it('proves the fixture is one the schema actually strips', async () => {
    // The negative half of the control above, asserted rather than assumed:
    // if the schema ever declared these keys the assertion would still pass
    // over a validated view, and the control would have quietly stopped
    // discriminating. This is the arm that fails if that happens.
    const harness = setup();
    const validated = harness.deps.readSpecText(
      harness.ship.channelSpecText(CHANNEL)
    );
    expect(validated.status).toBe('valid');
    const stripped = (validated as { spec: Record<string, unknown> }).spec;
    expect(stripped.gateWaiver).toBeUndefined();
    expect(
      (stripped.actions as Record<string, Record<string, unknown>>)[
        'bring-salad'
      ].hostClockWaiver
    ).toBeUndefined();
  });

  it('returns the recipe, and says so when there is none', async () => {
    const withRecipe = setup();
    expect(await run(['show', CHANNEL, '--json'], withRecipe.deps)).toBe(0);
    const present = withRecipe.json();
    expect(present.recipePresent).toBe(true);
    expect(present.recipe).toBe(
      'A potluck signup sheet; each member claims one dish.'
    );

    const { recipe: _dropped, ...withoutRecipe } = spec();
    const older = setup({ spec: withoutRecipe });
    expect(await run(['show', CHANNEL, '--json'], older.deps)).toBe(0);
    const absent = older.json();
    // D99: an older definition that carries no recipe reports that it
    // carries none. It does not report an empty one, and it does not omit
    // the field so a reader has to guess whether the command looked.
    expect(absent.recipePresent).toBe(false);
    expect(absent.recipe).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(absent, 'recipe')).toBe(true);

    expect(await run(['show', CHANNEL], older.deps)).toBe(0);
    expect(older.out()).toContain(
      'recipe:   none — this definition was published without one'
    );
  });

  it('refuses a channel that carries no definition', async () => {
    const harness = setup({ spec: null });
    expect(await run(['show', CHANNEL, '--json'], harness.deps)).toBe(1);
    expect(harness.json().code).toBe('spec-absent');
  });
});

describe('surface show — the bundle', () => {
  it('does not fetch unless asked, and says it did not', async () => {
    const harness = setup();
    expect(await run(['show', CHANNEL, '--json'], harness.deps)).toBe(0);
    const bundle = harness.json().bundle as Record<string, unknown>;
    expect(bundle.assetRef).toBe(ASSET);
    expect(bundle.sha256).toBe(sha256(BUNDLE_SOURCE));
    // The absence control: a document that reported the pointer and stopped
    // there, with no `fetched: false`, reads as though the bytes were had.
    expect(bundle.fetched).toBe(false);
    expect(bundle.verified).toBe(false);
    expect(bundle.path).toBeNull();
    expect(harness.ship.files.size).toBe(0);

    expect(await run(['show', CHANNEL], harness.deps)).toBe(0);
    expect(harness.out()).toContain(
      'not fetched — pass --bundle-out <path> to fetch and verify'
    );
  });

  it('fetches, verifies and writes the bundle when asked', async () => {
    const harness = setup();
    expect(
      await run(
        ['show', CHANNEL, '--bundle-out', 'app.js', '--json'],
        harness.deps
      )
    ).toBe(0);
    const bundle = harness.json().bundle as Record<string, unknown>;
    expect(bundle.fetched).toBe(true);
    expect(bundle.verified).toBe(true);
    expect(bundle.path).toBe('app.js');
    expect(bundle.bytes).toBe(Buffer.byteLength(BUNDLE_SOURCE, 'utf-8'));
    expect(harness.ship.files.get('app.js')).toBe(BUNDLE_SOURCE);
  });

  it('refuses bytes that do not match the pinned hash, and writes nothing', async () => {
    const harness = setup();
    // The two arms differ ONLY here: same spec, same pinned sha256, same
    // channel — storage now holds something else, exactly as a second PUT to
    // the same key would leave it.
    const tampered = `${BUNDLE_SOURCE}\nfetch('https://evil.example');\n`;
    harness.ship.tamperAsset(ASSET, tampered);
    expect(sha256(tampered)).not.toBe(sha256(BUNDLE_SOURCE));

    expect(
      await run(
        ['show', CHANNEL, '--bundle-out', 'app.js', '--json'],
        harness.deps
      )
    ).toBe(1);
    const failure = harness.json();
    expect(failure.ok).toBe(false);
    expect(failure.code).toBe('bundle-unavailable');
    const details = failure.details as Record<string, unknown>;
    // The specific refusal, not merely "an error": a repair loop branches on
    // `hash-mismatch` (nothing to retry) versus `fetch-failed` (retry once).
    expect(details.reason).toBe('hash-mismatch');
    expect(details.expectedSha256).toBe(sha256(BUNDLE_SOURCE));
    expect(details.observedSha256).toBe(sha256(tampered));
    expect(details.errorClass).toBe('environment');
    expect(failure.message).toContain('Nothing was written');
    expect(harness.ship.files.has('app.js')).toBe(false);
  });

  it('reports storage that has nothing rather than inventing a bundle', async () => {
    const harness = setup({ serve: null });
    expect(
      await run(
        ['show', CHANNEL, '--bundle-out', 'app.js', '--json'],
        harness.deps
      )
    ).toBe(1);
    const failure = harness.json();
    expect(failure.code).toBe('bundle-unavailable');
    expect((failure.details as Record<string, unknown>).reason).toBe(
      'fetch-failed'
    );
    expect(harness.ship.files.has('app.js')).toBe(false);
  });

  it('refuses an over-cap body before it can be written', async () => {
    // The fulcrum is `fetched.bytes.byteLength > deps.caps.bundleSize` in
    // `fetchVerifiedBundle` — the caller's own measurement. The double serves
    // the over-cap body with `ok: true` precisely so this is the check under
    // test: a hostile bucket does not refuse itself, and neither does the
    // double.
    const oversize = 'x'.repeat(bundleCap() + 1);
    const harness = setup({
      spec: spec({
        bundle: {
          assetRef: ASSET,
          sha256: sha256(oversize),
          // `size` is capped by the schema, so the spec can only ever CLAIM a
          // legal size; the lie is what storage serves. The hash even MATCHES
          // here, so nothing but the size check can refuse these bytes.
          size: 1024,
          shellVersion: 1,
        },
      }),
      serve: oversize,
    });
    expect(
      await run(
        ['show', CHANNEL, '--bundle-out', 'app.js', '--json'],
        harness.deps
      )
    ).toBe(1);
    const details = harness.json().details as Record<string, unknown>;
    expect(details.reason).toBe('oversize');
    expect(details.bytes).toBe(bundleCap() + 1);
    expect(details.cap).toBe(bundleCap());
    expect(harness.ship.files.has('app.js')).toBe(false);
  });

  it('does not turn a hostile assetRef into a request', async () => {
    const harness = setup({
      spec: spec({
        bundle: {
          assetRef: 'file:///etc/passwd',
          sha256: sha256(BUNDLE_SOURCE),
          size: 1024,
          shellVersion: 1,
        },
      }),
    });
    expect(
      await run(
        ['show', CHANNEL, '--bundle-out', 'app.js', '--json'],
        harness.deps
      )
    ).toBe(1);
    const failure = harness.json();
    expect(failure.code).toBe('bundle-unavailable');
    expect((failure.details as Record<string, unknown>).reason).toBe(
      'unsupported-scheme'
    );
    // The definition is still usable; only the bytes are not.
    expect(failure.message).toContain('The definition is still readable');
  });
});

/** The cap the command hands the transport, read from the same place it does. */
function bundleCap(): number {
  return createTestSurfaceDeps({}).deps.caps.bundleSize;
}

describe('assetRef classification', () => {
  it('admits https anywhere and http only on loopback', () => {
    expect(classifyAssetRef('https://storage.example/a.js').ok).toBe(true);
    expect(classifyAssetRef('http://127.0.0.1:4323/a.js').ok).toBe(true);
    expect(classifyAssetRef('http://localhost:4323/a.js').ok).toBe(true);
    // The dev-storage rule, on the way back out. `TLON_SURFACE_DEV_STORAGE`
    // refuses a non-loopback store on the way in; if this half were laxer the
    // two would disagree about what "dev storage" means.
    expect(classifyAssetRef('http://storage.example/a.js').ok).toBe(false);
    expect(classifyAssetRef('file:///etc/passwd').ok).toBe(false);
    expect(classifyAssetRef('surface://pending/abc').ok).toBe(false);
    expect(classifyAssetRef('not a url').ok).toBe(false);
  });
});

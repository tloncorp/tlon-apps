// The REAL schema, through a subpath: `bunfig.toml` preloads a process-wide
// mock of the `@tloncorp/api` root that does not carry the surface exports, and
// the point of the fourth-bite block below is that the stripping is done by the
// schema production uses, not by a stand-in that would strip whatever the test
// wanted it to.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';
import { describe, expect, it } from 'bun:test';

import { canonicalJson } from '../surface-canonical-json';
import { COMPLIANT_FIXTURE } from '../surface-lint-fixtures';
import {
  POPULATED_CITED_CHECK,
  REACHABILITY_CITED_CHECK,
  RUBRIC_CELL_IDS,
  RUBRIC_CHECKS,
  UNCONDITIONAL_RUBRIC_CHECKS,
  applicableRubricChecks,
  populatedCitation,
  reachabilityCitation,
  surfaceCanonicalHash,
} from '../surface-rubric-artifact';
import {
  type FakeShipOptions,
  createTestSurfaceDeps,
} from '../surface-test-doubles';
import type { SurfaceWriteScope } from '../surface-write-scope';
import {
  buildForkProvenance,
  deriveForkSpec,
  pendingAssetRef,
} from './surface-fork';
import { run } from './surface';

const { SurfaceSpecSchema } = surfaceSchemasModule as Pick<
  typeof import('@tloncorp/api'),
  'SurfaceSpecSchema'
>;

const SOURCE_GROUP = '~ten/originals';
const SOURCE_CHANNEL = 'chat/~ten/dash-source';
const SOURCE_ASSET = 'https://source.example/bundles/original.js';
const DEST_GROUP = '~zod/dashboards';
const DEST_CHANNEL = 'chat/~zod/dash-0001';

const STAGE_BUNDLE = '/work/fork/app.js';
const STAGE_SPEC = '/work/fork/spec.json';
const RUBRIC_PATH = '/work/fork/rubric.json';
const BRIEF_PATH = '/work/fork/brief.json';

const FORK_ID = 'dash-forkid01';

/**
 * The source definition, carrying every shape a copy can lose.
 *
 * Three of its fields exist purely to be dropped by something:
 *
 * - `actions.bring-salad.duplicatesTolerated` — a gate opt-out. Declared in
 *   the schema today, so it survives a validated round trip; kept because it
 *   is the marker D67 and D72 are about and because a schema change that
 *   undeclared it must fail here.
 * - `memberInteraction` — the other gate opt-out, in its CURRENT shape
 *   (`{ mode, because }`, not a bare 'none'). Declared, and load-bearing for
 *   a second reason: it makes rubric check 8 apply to the fork, so the sheet
 *   the copy demands is not the sheet the source was scored with.
 * - `x-fourth-bite` — an UNDECLARED key. This is the one the schema really
 *   strips, and therefore the one that tells a raw derivation from a
 *   validated one. Nothing else in the fixture can.
 */
function sourceSpec(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const base = { ...(COMPLIANT_FIXTURE.spec as Record<string, unknown>) };
  const actions = { ...(base.actions as Record<string, unknown>) };
  actions['bring-salad'] = {
    ...(actions['bring-salad'] as Record<string, unknown>),
    duplicatesTolerated: true,
  };
  return {
    ...base,
    surfaceId: 'srf-potluck',
    specRevision: 4,
    title: 'Potluck',
    actions,
    memberInteraction: {
      mode: 'none',
      because: 'the bot posts the rollover every morning',
    },
    recipe: {
      request: 'a potluck signup for the ~ten crew',
      notes: 'the source author wrote this for their group, not for ours',
    },
    'x-fourth-bite': {
      why: 'the schema does not declare this key, so it is the one that tells raw from validated',
    },
    ...overrides,
  };
}

function bundleHash(harness: ReturnType<typeof createTestSurfaceDeps>): string {
  return harness.deps.sha256Hex(
    new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource)
  );
}

/** A COMPLETE scoring sheet, for whichever checks the spec makes applicable. */
function completedRubric(input: {
  surfaceId: string;
  bundleSha256: string;
  specSha256: string;
  /** the starting point a plain preview run would have opened on */
  initialState?: unknown;
  /** the state a `--state` run substituted, when standing in for one */
  stateOverride?: unknown;
  checks?: readonly { id: string; number: number; title: string }[];
}) {
  const cells: Record<string, string> = {};
  for (const id of RUBRIC_CELL_IDS) {
    cells[id] = `looked at ${id}; nothing cut off, copy reads as this group's`;
  }
  const checks: Record<string, unknown> = {};
  const overridden = input.stateOverride !== undefined;
  for (const check of input.checks ?? RUBRIC_CHECKS) {
    checks[check.id] = {
      verdict: 'pass',
      cell: RUBRIC_CELL_IDS[0],
      note: `check ${check.number} scored here: ${check.title}`,
      // Check 7 carries preview's reachability line as well as the note, and
      // the validator requires it there. Built through `reachabilityCitation`
      // rather than hand-written, so this fixture cannot satisfy a marker rule
      // the real template writer would fail.
      ...(check.id === REACHABILITY_CITED_CHECK
        ? {
            reachability: reachabilityCitation({
              closed: true,
              nodeCount: 4,
              truncatedBy: [],
              shortfalls: [],
              findings: [],
            }),
          }
        : {}),
      // Check 5 carries preview's `populated` line on the same terms, from the
      // same helper, with the state source this sheet actually claims.
      ...(check.id === POPULATED_CITED_CHECK
        ? {
            populated: populatedCitation(
              {
                unchanged: false,
                invokes: [{ actionId: 'claim' }, { actionId: 'release' }],
                hostOps: [],
                restoredAfterDestructive: false,
              },
              {
                actors: ['~zod', '~ten', '~palfun-foslup'],
                stateSource: overridden ? 'override' : 'spec-initial-state',
              }
            ),
          }
        : {}),
    };
  }
  return {
    version: 1,
    surfaceId: input.surfaceId,
    bundleSha256: input.bundleSha256,
    specSha256: input.specSha256,
    stateSource: overridden ? 'override' : 'spec-initial-state',
    stateSha256: surfaceCanonicalHash(
      overridden ? input.stateOverride : input.initialState
    ),
    cells,
    checks,
  };
}

/**
 * The definition the landing pass will derive, computed here the way the
 * staging pass computes it — which is what `surface preview` renders and what
 * the sheet is therefore scored under.
 *
 * `deriveForkSpec` is a pure function of the source's raw cell, the fork's id,
 * the fetched bundle's length and the provenance claim, so "the staged spec"
 * and "the spec fork lands" are the same document whenever nothing moved
 * between the two runs. Calling the real derivation rather than hand-writing
 * the expected object is what keeps this fixture honest: a change to what a
 * fork carries moves both ends at once.
 */
function forkSpecHash(
  sourceRaw: Record<string, unknown>,
  overrides: {
    surfaceId?: string;
    channel?: string | null;
    /** length of the bytes the fork will host, when not the fixture's */
    size?: number;
  } = {}
): string {
  const bytes = new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource);
  const sourceBundle = sourceRaw.bundle as Record<string, unknown> | undefined;
  const sha256 = String(sourceBundle?.sha256 ?? '');
  return surfaceCanonicalHash(
    deriveForkSpec({
      sourceRaw,
      surfaceId: overrides.surfaceId ?? FORK_ID,
      assetRef: pendingAssetRef(sha256),
      size: overrides.size ?? bytes.byteLength,
      provenance: buildForkProvenance({
        surfaceId: String(sourceRaw.surfaceId),
        specRevision: Number(sourceRaw.specRevision),
        sha256,
        channel: overrides.channel ?? null,
        mode: 'copy',
      }),
    })
  );
}

interface SetupOptions extends FakeShipOptions {
  /** the source's definition, or null to leave the source an ordinary channel */
  spec?: Record<string, unknown> | null;
  /** what storage serves at the source's assetRef; null to serve nothing */
  served?: string | null;
  /** the id the rubric is scored for; defaults to the fork id used below */
  rubricSurfaceId?: string;
  /** the hash the rubric is scored for; defaults to the served bundle's */
  rubricSha256?: string;
  /** the spec hash the rubric is scored for; defaults to the fork's own */
  rubricSpecSha256?: string;
  /** the state a `--state` preview run substituted before the sheet was filled in */
  rubricStateOverride?: unknown;
  rubricChecks?: readonly { id: string; number: number; title: string }[];
}

function setup(options: SetupOptions = {}) {
  const harness = createTestSurfaceDeps(options);
  harness.ship.addGroup(SOURCE_GROUP);
  harness.ship.addChannel(SOURCE_GROUP, SOURCE_CHANNEL);
  harness.ship.addGroup(DEST_GROUP);
  harness.ship.addChannel(DEST_GROUP, DEST_CHANNEL);

  const sha256 = bundleHash(harness);
  const spec =
    options.spec === undefined
      ? sourceSpec({
          bundle: {
            assetRef: SOURCE_ASSET,
            sha256,
            size: new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource)
              .byteLength,
            shellVersion: 1,
          },
        })
      : options.spec;
  if (spec !== null) {
    harness.ship.setChannelSpec(SOURCE_CHANNEL, spec);
  }
  const served =
    options.served === undefined ? COMPLIANT_FIXTURE.bundleSource : null;
  if (served !== null) {
    harness.ship.serveAsset(SOURCE_ASSET, served);
  } else if (options.served != null) {
    harness.ship.serveAsset(SOURCE_ASSET, options.served);
  }

  harness.ship.files.set(
    RUBRIC_PATH,
    JSON.stringify(
      completedRubric({
        surfaceId: options.rubricSurfaceId ?? FORK_ID,
        bundleSha256: options.rubricSha256 ?? sha256,
        // Scored under the definition the staging pass wrote and preview
        // rendered. A source with no definition has no fork spec to score, so
        // a placeholder stands in — those tests refuse long before the sheet
        // is read.
        specSha256:
          options.rubricSpecSha256 ??
          (spec === null ? '0'.repeat(64) : forkSpecHash(spec)),
        // A fork opens on the copied definition's own starting point; state
        // never travels.
        initialState: spec === null ? undefined : spec.initialState,
        ...(options.rubricStateOverride === undefined
          ? {}
          : { stateOverride: options.rubricStateOverride }),
        checks: options.rubricChecks,
      }),
      null,
      2
    )
  );
  return harness;
}

type Harness = ReturnType<typeof setup>;

async function stage(harness: Harness, extra: string[] = []) {
  return run(
    [
      'fork',
      SOURCE_CHANNEL,
      '--into',
      DEST_CHANNEL,
      '--stage-bundle',
      STAGE_BUNDLE,
      '--stage-spec',
      STAGE_SPEC,
      '--json',
      ...extra,
    ],
    harness.deps
  );
}

async function fork(harness: Harness, extra: string[] = []) {
  return run(
    [
      'fork',
      SOURCE_CHANNEL,
      '--into',
      DEST_CHANNEL,
      '--surface-id',
      FORK_ID,
      '--rubric',
      RUBRIC_PATH,
      '--json',
      ...extra,
    ],
    harness.deps
  );
}

/** The destination's definition exactly as the ship holds it. */
function landedSpec(harness: Harness): Record<string, unknown> {
  const text = harness.ship.channelSpecText(DEST_CHANNEL);
  expect(text).not.toBeNull();
  return JSON.parse(text as string) as Record<string, unknown>;
}

function blobEntries(harness: Harness, channelId: string): unknown[] {
  return (harness.ship.posts.get(channelId) ?? []).flatMap((post) =>
    post.blob ? (JSON.parse(post.blob) as unknown[]) : []
  );
}

/* ------------------------------------------------------------------ */
/* The derivation, on its own                                          */
/* ------------------------------------------------------------------ */

describe('deriveForkSpec', () => {
  const provenance = buildForkProvenance({
    surfaceId: 'srf-potluck',
    specRevision: 4,
    sha256: 'a'.repeat(64),
    channel: null,
    mode: 'copy',
  });

  it('carries everything but the recipe, and overrides exactly four fields', () => {
    const source = sourceSpec({
      bundle: {
        assetRef: SOURCE_ASSET,
        sha256: 'a'.repeat(64),
        size: 2048,
        shellVersion: 3,
      },
    });
    const forked = deriveForkSpec({
      sourceRaw: source,
      surfaceId: 'dash-new',
      assetRef: 'https://mine.example/copy.js',
      size: 2048,
      provenance,
    });

    expect(forked.surfaceId).toBe('dash-new');
    expect(forked.specRevision).toBe(1);
    expect(forked.bundle).toEqual({
      // Re-hosting changes WHERE the bytes are and nothing about what they
      // are: content addressing is what makes the integrity guarantee survive
      // the copy, so every field but the pointer rides through.
      assetRef: 'https://mine.example/copy.js',
      sha256: 'a'.repeat(64),
      size: 2048,
      shellVersion: 3,
    });
    expect('recipe' in forked).toBe(false);
    expect(forked.provenance).toEqual(provenance);
    expect(forked['x-fourth-bite']).toEqual(source['x-fourth-bite']);
    expect(forked.memberInteraction).toEqual(source.memberInteraction);
    expect(
      (forked.actions as Record<string, Record<string, unknown>>)['bring-salad']
        .duplicatesTolerated
    ).toBe(true);
  });

  // The fulcrum, made visible. The derivation is correct because of WHICH
  // object it is handed, and nothing in its own body can show that. Handing it
  // the schema's view of the same spec produces a spec that publishes cleanly
  // and has silently lost a key — so if this assertion ever stops holding, the
  // schema has changed and the raw/validated distinction this command rests on
  // needs re-checking, not the test.
  it('loses the undeclared key when handed the validated view instead', () => {
    const source = sourceSpec({
      bundle: {
        assetRef: SOURCE_ASSET,
        sha256: 'a'.repeat(64),
        size: 2048,
        shellVersion: 1,
      },
    });
    const validated = SurfaceSpecSchema.parse(source) as Record<
      string,
      unknown
    >;
    expect('x-fourth-bite' in validated).toBe(false);

    const fromValidated = deriveForkSpec({
      sourceRaw: validated,
      surfaceId: 'dash-new',
      assetRef: 'u',
      size: 2048,
      provenance,
    });
    expect('x-fourth-bite' in fromValidated).toBe(false);
    // …and the declared markers survive even the validated route, which is why
    // an undeclared key is the only witness that tells the two apart.
    expect(fromValidated.memberInteraction).toEqual(source.memberInteraction);
  });

  it('omits the source channel from provenance unless asked', () => {
    expect(
      buildForkProvenance({
        surfaceId: 's',
        specRevision: 2,
        sha256: 'b'.repeat(64),
        channel: null,
        mode: 'copy',
      })
    ).toEqual({
      surfaceId: 's',
      specRevision: 2,
      sha256: 'b'.repeat(64),
      mode: 'copy',
    });
    expect(
      buildForkProvenance({
        surfaceId: 's',
        specRevision: 2,
        sha256: 'b'.repeat(64),
        channel: SOURCE_CHANNEL,
        mode: 'regenerated',
      }).channel
    ).toBe(SOURCE_CHANNEL);
  });
});

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

describe('surface fork — staging', () => {
  it('writes the verified bundle and the derived definition, and touches no ship', async () => {
    const harness = setup();
    expect(await stage(harness)).toBe(0);

    const result = harness.json();
    expect(result.phase).toBe('stage');
    expect(result.wroteToShip).toBe(false);
    expect(result.recipeCarried).toBe(false);
    expect(typeof result.provenanceIsAClaim).toBe('string');
    expect(result.provenance).toEqual({
      surfaceId: 'srf-potluck',
      specRevision: 4,
      sha256: bundleHash(harness),
      mode: 'copy',
    });

    // The bytes on disk are the source's bytes, hash-checked on the way past.
    expect(harness.ship.files.get(STAGE_BUNDLE)).toBe(
      COMPLIANT_FIXTURE.bundleSource
    );
    const staged = JSON.parse(
      harness.ship.files.get(STAGE_SPEC) as string
    ) as Record<string, unknown>;
    expect(staged.surfaceId).toBe((result.surfaceId as string) ?? '');
    expect(staged.specRevision).toBe(1);
    expect('recipe' in staged).toBe(false);
    // The staged pointer names nowhere on purpose: the fork does not host the
    // source's bytes and must never point a member's client at the source's
    // bucket.
    expect((staged.bundle as Record<string, unknown>).assetRef).toBe(
      `surface://pending/${bundleHash(harness)}`
    );

    expect(harness.ship.descriptionWrites).toHaveLength(0);
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.posts.get(DEST_CHANNEL) ?? []).toHaveLength(0);
  });

  it('mints an id that is not the source’s, and names it in the next command', async () => {
    const harness = setup();
    expect(await stage(harness, [])).toBe(0);
    const minted = harness.json().surfaceId as string;
    expect(minted).not.toBe('srf-potluck');
    expect(minted.length).toBeGreaterThan(0);
  });

  it('names the source channel in provenance only when asked', async () => {
    const harness = setup();
    expect(await stage(harness, ['--include-source-channel'])).toBe(0);
    expect((harness.json().provenance as Record<string, unknown>).channel).toBe(
      SOURCE_CHANNEL
    );
  });

  it('refuses a source with no definition, and stages nothing', async () => {
    const harness = setup({ spec: null });
    expect(await stage(harness)).toBe(1);
    expect(harness.json().code).toBe('spec-absent');
    expect(harness.ship.files.has(STAGE_BUNDLE)).toBe(false);
    expect(harness.ship.files.has(STAGE_SPEC)).toBe(false);
  });

  it('refuses a source whose definition does not validate', async () => {
    const harness = setup({ spec: { version: 1, surfaceId: 'oops' } });
    expect(await stage(harness)).toBe(1);
    expect(harness.json().code).toBe('spec-invalid');
  });

  it('refuses a destination that already publishes an app', async () => {
    const harness = setup();
    harness.ship.setChannelSpec(
      DEST_CHANNEL,
      sourceSpec({
        surfaceId: 'srf-live',
        specRevision: 9,
        bundle: {
          assetRef: 'https://live.example/app.js',
          sha256: 'c'.repeat(64),
          size: 100,
          shellVersion: 1,
        },
      })
    );
    expect(await stage(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('fork-destination-occupied');
    expect(result.message).toContain('srf-live');
    expect(harness.ship.files.has(STAGE_BUNDLE)).toBe(false);
  });

  it('refuses bytes that do not match the hash the source pins', async () => {
    const harness = setup();
    harness.ship.tamperAsset(SOURCE_ASSET, '/* not the app */');
    expect(await stage(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('bundle-unavailable');
    expect((result.details as Record<string, unknown>).reason).toBe(
      'hash-mismatch'
    );
    expect(harness.ship.files.has(STAGE_BUNDLE)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Fork                                                                */
/* ------------------------------------------------------------------ */

describe('surface fork — landing the copy', () => {
  it('re-uploads, writes, reads back, and mirrors', async () => {
    const harness = setup();
    expect(await fork(harness)).toBe(0);

    const result = harness.json();
    expect(result.phase).toBe('fork');
    expect(result.channel).toBe(DEST_CHANNEL);
    expect(result.surfaceId).toBe(FORK_ID);
    expect(result.specRevision).toBe(1);
    expect(result.recipeCarried).toBe(false);
    expect(result.uploaded).toBe(true);
    expect(typeof result.provenanceIsAClaim).toBe('string');

    // Re-hosted: the bytes went to this ship's storage, and the hash did not
    // change on the way.
    expect(harness.ship.uploads).toHaveLength(1);
    expect(harness.ship.uploads[0].fileName).toBe(`${bundleHash(harness)}.js`);
    expect(result.assetRef).not.toBe(SOURCE_ASSET);
    expect(result.sha256).toBe(bundleHash(harness));

    const landed = landedSpec(harness);
    expect(landed.surfaceId).toBe(FORK_ID);
    expect(landed.specRevision).toBe(1);
    expect((landed.bundle as Record<string, unknown>).assetRef).toBe(
      result.assetRef
    );

    // The mirror, read back off the channel rather than assumed from the poke.
    const entries = blobEntries(harness, DEST_CHANNEL) as Record<
      string,
      unknown
    >[];
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('surface-spec-mirror');
    expect(entries[0].surfaceId).toBe(FORK_ID);
    expect(canonicalJson(entries[0].spec)).toBe(canonicalJson(landed));
  });

  it('refuses a rubric scored for a different app', async () => {
    const harness = setup({ rubricSurfaceId: 'srf-somebody-else' });
    expect(await fork(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-mismatch');
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  // The binding that stands in for "the source moved between staging and
  // forking": a revised source serves different bytes, and the sheet scored
  // against the old ones stops naming them.
  it('refuses a sheet scored against other bytes', async () => {
    const harness = setup({ rubricSha256: 'd'.repeat(64) });
    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-mismatch');
    expect(result.message).toContain('different builds');
    expect(harness.ship.uploads).toHaveLength(0);
  });

  /**
   * The staging pass and the landing pass are two commands with a human's
   * scoring in between, and the source can move between them.
   *
   * A source that republishes a SPEC-only revision — same bundle, same hash —
   * changes what the fork derives without changing a byte the sheet's bundle
   * hash names. The sheet was scored on renders of the older definition, so it
   * is not a sheet for this copy. Both arms are the same setup and the same
   * republish; only the re-scoring differs.
   */
  it("refuses when the source's SPEC moved but its bundle did not", async () => {
    const harness = setup();
    const sha256 = bundleHash(harness);
    const bytes = new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource);
    const bundle = {
      assetRef: SOURCE_ASSET,
      sha256,
      size: bytes.byteLength,
      shellVersion: 1,
    };
    // A spec-only revision at the source: one string, no new bytes.
    harness.ship.setChannelSpec(
      SOURCE_CHANNEL,
      sourceSpec({ bundle, title: 'Potluck, renamed by the source' })
    );

    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    // The sheet still names the bytes this fork will host, so the bundle half
    // of the binding is satisfied and cannot be what refuses below.
    expect(sheet.bundleSha256).toBe(sha256);

    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-mismatch');
    expect(String(result.message)).toContain('scores a spec hashing to');
    expect(String(result.message)).toContain('SPEC-only change');
    expect(String(result.message)).not.toContain('different builds');
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  it('forks that same revision once the copy has been re-previewed', async () => {
    // The positive arm. Without it the refusal above would pass equally
    // against a binding that refused every sheet ever written.
    const harness = setup();
    const bytes = new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource);
    const republished = sourceSpec({
      bundle: {
        assetRef: SOURCE_ASSET,
        sha256: bundleHash(harness),
        size: bytes.byteLength,
        shellVersion: 1,
      },
      title: 'Potluck, renamed by the source',
    });
    harness.ship.setChannelSpec(SOURCE_CHANNEL, republished);
    expect(await fork(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-mismatch');

    harness.ship.files.set(
      RUBRIC_PATH,
      JSON.stringify(
        completedRubric({
          surfaceId: FORK_ID,
          bundleSha256: bundleHash(harness),
          specSha256: forkSpecHash(republished),
          initialState: republished.initialState,
        })
      )
    );
    expect(await fork(harness)).toBe(0);
    expect(landedSpec(harness).title).toBe('Potluck, renamed by the source');
  });

  /**
   * The discriminator, and why it has to be the undeclared key (D138).
   *
   * `title` is declared on `SurfaceSpecSchema`, so the two tests above would
   * pass just as well against a spec hash taken over the VALIDATED view — they
   * cannot tell a raw derivation from a re-encoded one. `x-fourth-bite` can:
   * the schema strips it, so a validated hash is blind to a change confined to
   * it, and the fork would land a definition carrying data nobody rendered.
   */
  it('refuses when only a key the schema strips moved at the source', async () => {
    const harness = setup();
    const bytes = new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource);
    const bundle = {
      assetRef: SOURCE_ASSET,
      sha256: bundleHash(harness),
      size: bytes.byteLength,
      shellVersion: 1,
    };
    const before = sourceSpec({ bundle });
    const after = sourceSpec({
      bundle,
      'x-fourth-bite': { why: 'the source rewrote the undeclared key' },
    });
    // Raw, two documents; validated, one. The second assertion is what fails
    // if the hash is ever moved onto the schema's output.
    expect(forkSpecHash(after)).not.toBe(forkSpecHash(before));
    expect(surfaceCanonicalHash(SurfaceSpecSchema.parse(after))).toBe(
      surfaceCanonicalHash(SurfaceSpecSchema.parse(before))
    );

    harness.ship.setChannelSpec(SOURCE_CHANNEL, after);
    expect(await fork(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-mismatch');
    expect(String(harness.json().message)).toContain('SPEC-only change');
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  /**
   * The state binding at the fork end.
   *
   * A fork never carries state — the copy opens on the definition's own
   * `initialState` in a channel that has no history — so a sheet scored against
   * the SOURCE's live board (a `surface preview --state` run against
   * `tlon surface state --json`, which `SKILL.md` names as a thing to do) is a
   * sheet about screens this copy will not show anyone.
   */
  it('refuses a sheet whose captures opened on a substituted state', async () => {
    const harness = setup({
      rubricStateOverride: { bringing: { '~ten': "the source's live board" } },
    });
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    // Bundle and spec both match; only the board the captures opened on does
    // not, so neither older half of the binding can be what refuses.
    expect(sheet.bundleSha256).toBe(bundleHash(harness));
    expect(sheet.stateSource).toBe('override');

    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-mismatch');
    const message = String(result.message);
    expect(message).toContain('captures that opened on a state hashing to');
    expect(message).toContain('a board this app never opens on');
    expect(message).not.toContain('different builds');
    expect(message).not.toContain('SPEC-only change');
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  it('forks on a sheet from a run without --state', async () => {
    // The positive arm, separate: this one never asks for an override at all.
    const harness = setup();
    expect(
      JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string).stateSource
    ).toBe('spec-initial-state');
    expect(await fork(harness)).toBe(0);
    expect(landedSpec(harness).surfaceId).toBe(FORK_ID);
  });

  it("accepts an override that IS the copied definition's starting point", async () => {
    // What is compared is the STATE, not the flag. "Refuse any override sheet"
    // would pass the refusal above and fail here.
    const harness = setup({
      rubricStateOverride: (COMPLIANT_FIXTURE.spec as Record<string, unknown>)
        .initialState,
    });
    expect(
      JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string).stateSource
    ).toBe('override');
    expect(await fork(harness)).toBe(0);
    expect(landedSpec(harness).surfaceId).toBe(FORK_ID);
  });

  it('refuses a sheet carrying no state provenance', async () => {
    for (const field of ['stateSource', 'stateSha256']) {
      const harness = setup();
      const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
      delete sheet[field];
      harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet));
      expect(await fork(harness)).toBe(1);
      expect(harness.json().code).toBe('rubric-incomplete');
      expect(JSON.stringify(harness.json().details)).toContain(field);
      expect(harness.ship.uploads).toHaveLength(0);
    }
  });

  it('refuses a sheet carrying no spec hash at all', async () => {
    // The compatibility decision at the fork end: a sheet written before the
    // spec binding existed, or one somebody deleted a line out of, looks
    // exactly like this. Accepting it would make the binding satisfiable by
    // omission on both commands at once.
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    delete sheet.specSha256;
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet));
    expect(await fork(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-incomplete');
    expect(JSON.stringify(harness.json().details)).toContain('specSha256');
    expect(harness.ship.uploads).toHaveLength(0);
  });

  // The copied `memberInteraction` marker makes check 8 apply to the FORK. A
  // sheet carrying only the seven universal checks is therefore incomplete
  // here even though it would be complete for an app without the marker —
  // which is the mechanical half of "the source's sheet does not travel".
  it('demands the display-only check the copied marker makes applicable', async () => {
    const harness = setup({ rubricChecks: UNCONDITIONAL_RUBRIC_CHECKS });
    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-incomplete');
    expect(JSON.stringify(result.details)).toContain(
      'display-only-was-asked-for'
    );
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  it('refuses to reuse the source’s own surface id', async () => {
    const harness = setup({ rubricSurfaceId: 'srf-potluck' });
    expect(
      await run(
        [
          'fork',
          SOURCE_CHANNEL,
          '--into',
          DEST_CHANNEL,
          '--surface-id',
          'srf-potluck',
          '--rubric',
          RUBRIC_PATH,
          '--json',
        ],
        harness.deps
      )
    ).toBe(1);
    expect(harness.json().code).toBe('usage');
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  // The hash proves the bytes are unchanged. It does not prove they pass the
  // gate as it stands here, which is the whole reason a plain copy re-lints.
  it('re-gates the copied bytes rather than trusting the hash', async () => {
    const harness = setup();
    const broken = `${COMPLIANT_FIXTURE.bundleSource}\nexport const buildStamp = 1;\n`;
    const bytes = new TextEncoder().encode(broken);
    harness.ship.tamperAsset(SOURCE_ASSET, broken);
    // The source's definition is republished to pin the broken bytes, so the
    // fetch verifies and the ONLY thing standing between the copy and the
    // channel is the gate.
    const republished = sourceSpec({
      bundle: {
        assetRef: SOURCE_ASSET,
        sha256: harness.deps.sha256Hex(bytes),
        size: bytes.byteLength,
        shellVersion: 1,
      },
    });
    harness.ship.setChannelSpec(SOURCE_CHANNEL, republished);
    harness.ship.files.set(
      RUBRIC_PATH,
      JSON.stringify(
        completedRubric({
          surfaceId: FORK_ID,
          bundleSha256: harness.deps.sha256Hex(bytes),
          specSha256: forkSpecHash(republished, { size: bytes.byteLength }),
          initialState: republished.initialState,
        })
      )
    );

    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('lint-failed');
    expect(
      (
        (result.details as Record<string, unknown>).violations as {
          rule: string;
        }[]
      ).map((violation) => violation.rule)
    ).toContain('module-syntax');
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  // A faithful copy of a preserving spec is a channel that renders
  // migration-pending to every client until a snapshot exists under it. The
  // copy keeps the flag; the snapshot is what keeps the copy usable.
  it('posts the starting snapshot when the copied spec preserves state', async () => {
    const harness = setup({
      spec: sourceSpec({
        preserveState: true,
        bundle: {
          assetRef: SOURCE_ASSET,
          sha256: 'placeholder',
          size: 1,
          shellVersion: 1,
        },
      }),
    });
    // Pin the real bytes now that the harness exists.
    const bytes = new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource);
    const republished = sourceSpec({
      preserveState: true,
      bundle: {
        assetRef: SOURCE_ASSET,
        sha256: harness.deps.sha256Hex(bytes),
        size: bytes.byteLength,
        shellVersion: 1,
      },
    });
    harness.ship.setChannelSpec(SOURCE_CHANNEL, republished);
    // The source's definition moved after `setup()` scored the sheet, so the
    // sheet is re-scored against what the fork will now derive — the same
    // thing the bot does by re-staging and re-previewing.
    harness.ship.files.set(
      RUBRIC_PATH,
      JSON.stringify(
        completedRubric({
          surfaceId: FORK_ID,
          bundleSha256: harness.deps.sha256Hex(bytes),
          specSha256: forkSpecHash(republished),
          initialState: republished.initialState,
        })
      )
    );

    expect(await fork(harness)).toBe(0);
    const result = harness.json();
    expect(result.preserveState).toBe(true);
    expect(typeof result.snapshotPostId).toBe('string');

    const entries = blobEntries(harness, DEST_CHANNEL) as Record<
      string,
      unknown
    >[];
    const snapshot = entries.find(
      (entry) => entry.type === 'surface-snapshot'
    ) as Record<string, unknown>;
    expect(snapshot.upToSequenceNum).toBe(0);
    expect(snapshot.specRevision).toBe(1);

    // The claim that matters is not that a post exists: it is that the shared
    // reducer no longer answers `migration-pending` for this channel.
    const landed = SurfaceSpecSchema.parse(landedSpec(harness));
    const posts = (harness.ship.posts.get(DEST_CHANNEL) ?? []).map(
      ({ kind: _kind, ...post }) => post
    );
    const reduction = harness.deps.reduce({
      spec: landed,
      hostShip: '~zod',
      posts,
    });
    expect(reduction.status).toBe('reduced');
  });

  // `size` is a sanity bound a member's client checks before it fetches, and
  // nothing verifies the source's declared one on the way in — the fetch
  // checks the hash and the cap, not the number. A copy that carried a wrong
  // size would hand the fork's members a bound their client refuses the bundle
  // on, over bytes that are provably the right ones.
  it('declares the length of the bytes it hosts, not the source’s claim', async () => {
    const bytes = new TextEncoder().encode(COMPLIANT_FIXTURE.bundleSource);
    const harness = setup();
    harness.ship.setChannelSpec(
      SOURCE_CHANNEL,
      sourceSpec({
        bundle: {
          assetRef: SOURCE_ASSET,
          sha256: bundleHash(harness),
          // A lie the schema accepts: positive, under the cap, and nothing
          // ever compares it against the bytes.
          size: 7,
          shellVersion: 1,
        },
      })
    );

    expect(await fork(harness)).toBe(0);
    const landed = landedSpec(harness);
    expect((landed.bundle as Record<string, unknown>).size).toBe(
      bytes.byteLength
    );
    expect((landed.bundle as Record<string, unknown>).sha256).toBe(
      bundleHash(harness)
    );
  });

  it('reports the definition unconfirmed when the write does not land', async () => {
    const harness = setup({ swallowDescriptionWrite: true });
    expect(await fork(harness)).toBe(1);
    expect(harness.json().code).toBe('publish-unconfirmed');
    expect(harness.ship.posts.get(DEST_CHANNEL) ?? []).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* The fourth bite                                                     */
/* ------------------------------------------------------------------ */

/**
 * D72's follow-up named this command as the predicted fourth instance of one
 * bug: a written spec compared against, or rebuilt from, the SCHEMA's view of
 * itself, which silently drops every key the schema does not declare. The
 * prediction was specific — "the fork would silently drop
 * `duplicatesTolerated` from every forked `append` app, and the fork would
 * fail its own gate on a bundle that passed at the source".
 *
 * So this is not a test that the fork copies fields. It is a test that the
 * fork copies the fields NOBODY LISTED, through a command that reads the
 * source, derives, writes, and then confirms itself by reading back — four
 * places the stripping could happen, all of which have to be raw for the copy
 * to arrive whole.
 */
describe('surface fork — the fourth bite', () => {
  it('lands opt-out markers and an undeclared key byte-faithfully', async () => {
    const harness = setup();
    expect(await fork(harness)).toBe(0);

    const source = JSON.parse(
      harness.ship.channelSpecText(SOURCE_CHANNEL) as string
    ) as Record<string, unknown>;
    const landed = landedSpec(harness);

    // 1. The gate opt-outs, both of them, with their values intact — and
    //    `memberInteraction` in its current object shape, so a copy written
    //    against the bare-'none' shape it used to have would fail here.
    expect(landed.memberInteraction).toEqual({
      mode: 'none',
      because: 'the bot posts the rollover every morning',
    });
    expect(
      (landed.actions as Record<string, Record<string, unknown>>)['bring-salad']
        .duplicatesTolerated
    ).toBe(true);

    // 2. The undeclared key: the only witness that the derivation and the
    //    read-back comparison both ran over raw cells.
    expect(landed['x-fourth-bite']).toEqual(source['x-fourth-bite']);

    // 3. Minus the recipe. It is member-visible where it was written, and the
    //    fork's group never had access to it.
    expect('recipe' in source).toBe(true);
    expect('recipe' in landed).toBe(false);

    // 4. Plus the provenance, without the source channel.
    expect(landed.provenance).toEqual({
      surfaceId: 'srf-potluck',
      specRevision: 4,
      sha256: bundleHash(harness),
      mode: 'copy',
    });

    // 5. And nothing else moved. Everything outside the five fields this
    //    command owns is compared whole, so a copy that quietly dropped a key
    //    this test never thought to name still fails.
    const owned = (spec: Record<string, unknown>) => {
      const rest = { ...spec };
      delete rest.surfaceId;
      delete rest.specRevision;
      delete rest.recipe;
      delete rest.provenance;
      const bundle = { ...(rest.bundle as Record<string, unknown>) };
      delete bundle.assetRef;
      rest.bundle = bundle;
      return rest;
    };
    expect(canonicalJson(owned(landed))).toBe(canonicalJson(owned(source)));
  });

  // The other half of the prediction: the copy must pass the gate the source
  // passed. It does BECAUSE the marker travelled — the same spec with the
  // marker stripped is a different question, and `surface-lint.test.ts` owns
  // that one. Here the claim is only that the landed definition still
  // validates and still declares what the gate reads.
  it('lands a definition the schema and the gate both still accept', async () => {
    const harness = setup();
    expect(await fork(harness)).toBe(0);
    const landed = landedSpec(harness);

    expect(SurfaceSpecSchema.safeParse(landed).success).toBe(true);
    expect(
      harness.deps.lint({
        bundleSource: COMPLIANT_FIXTURE.bundleSource,
        spec: landed,
      }).ok
    ).toBe(true);
    // The copied marker is what makes the fork's own sheet carry check 8,
    // which is the mechanism by which "the source's sheet does not travel" is
    // enforced rather than merely stated.
    expect(applicableRubricChecks(landed).map((check) => check.id)).toContain(
      'display-only-was-asked-for'
    );
  });
});

/* ------------------------------------------------------------------ */
/* The write fence                                                     */
/* ------------------------------------------------------------------ */

function scope(overrides: Partial<SurfaceWriteScope> = {}): SurfaceWriteScope {
  return {
    source: '/fence.json',
    channel: null,
    preState: null,
    groups: null,
    ...overrides,
  };
}

describe('surface fork — the write fence', () => {
  it('refuses a destination in a group this process is not scoped to', async () => {
    const harness = setup({
      writeScope: scope({ groups: ['~zod/elsewhere'] }),
    });
    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('write-out-of-scope');
    expect(result.message).toContain(DEST_CHANNEL);
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  // Staging writes nothing to a ship, and is fenced anyway: it is the first
  // half of a write, and finding out at step 3 means a preview and a scoring
  // round were already spent on a board the operator fenced out.
  it('refuses staging for an out-of-scope destination too', async () => {
    const harness = setup({
      writeScope: scope({ groups: ['~zod/elsewhere'] }),
    });
    expect(await stage(harness)).toBe(1);
    expect(harness.json().code).toBe('write-out-of-scope');
    expect(harness.ship.files.has(STAGE_BUNDLE)).toBe(false);
  });

  it('refuses a sibling destination when a channel is bound', async () => {
    const harness = setup({
      writeScope: scope({ channel: 'chat/~zod/dash-0002' }),
    });
    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('write-out-of-scope');
    expect(result.message).toContain('chat/~zod/dash-0002');
  });

  // The read/write split, from the side that would be easy to get wrong: a
  // fence bounds where this process may WRITE. Reading the source you are
  // forking from is not a write, and a fence that blocked it would make the
  // command unusable for its only purpose — copying an app out of a group you
  // do not administer.
  it('reads a source outside the fence while writing inside it', async () => {
    const harness = setup({
      writeScope: scope({ channel: DEST_CHANNEL, groups: [DEST_GROUP] }),
    });
    expect(await fork(harness)).toBe(0);
    expect(harness.json().source).toMatchObject({
      channel: SOURCE_CHANNEL,
      group: SOURCE_GROUP,
    });
  });

  it('refuses when the destination no longer carries the bound pre-state', async () => {
    const harness = setup({
      writeScope: scope({
        channel: DEST_CHANNEL,
        groups: [DEST_GROUP],
        preState: 'unpublished:something-else',
      }),
    });
    expect(await fork(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('pre-state-moved');
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  it('permits the fork when the bound pre-state still holds', async () => {
    const harness = setup({
      writeScope: scope({
        channel: DEST_CHANNEL,
        groups: [DEST_GROUP],
        preState: 'unpublished:empty',
      }),
    });
    expect(await fork(harness)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Regenerate                                                          */
/* ------------------------------------------------------------------ */

describe('surface fork --regenerate', () => {
  async function regenerate(harness: Harness, extra: string[] = []) {
    return run(
      ['fork', SOURCE_CHANNEL, '--regenerate', '--json', ...extra],
      harness.deps
    );
  }

  // The mode's whole distinction, pinned from the side that can only pass if
  // the bundle is genuinely never fetched: storage serves NOTHING at the
  // source's assetRef, which makes any copy path fail with
  // `bundle-unavailable`.
  it('hands over the recipe without fetching a single byte of the app', async () => {
    const harness = setup({ served: null });
    expect(await regenerate(harness)).toBe(0);

    const result = harness.json();
    expect(result.phase).toBe('regenerate');
    expect(result.copiedBundle).toBe(false);
    expect(result.wroteToShip).toBe(false);
    const brief = result.brief as Record<string, unknown>;
    expect(brief.recipe).toEqual({
      request: 'a potluck signup for the ~ten crew',
      notes: 'the source author wrote this for their group, not for ours',
    });
    expect(brief.provenance).toEqual({
      surfaceId: 'srf-potluck',
      specRevision: 4,
      sha256: bundleHash(harness),
      mode: 'regenerated',
    });
    expect(harness.ship.descriptionWrites).toHaveLength(0);
    expect(harness.ship.uploads).toHaveLength(0);
  });

  it('writes the brief where it is asked to', async () => {
    const harness = setup({ served: null });
    expect(await regenerate(harness, ['--brief-out', BRIEF_PATH])).toBe(0);
    const written = JSON.parse(
      harness.ship.files.get(BRIEF_PATH) as string
    ) as Record<string, unknown>;
    expect((written.provenance as Record<string, unknown>).mode).toBe(
      'regenerated'
    );
    expect((written.source as Record<string, unknown>).channel).toBeUndefined();
  });

  it('refuses a source published without a recipe', async () => {
    const harness = setup({ served: null });
    const withoutRecipe = sourceSpec({
      bundle: {
        assetRef: SOURCE_ASSET,
        sha256: bundleHash(harness),
        size: 10,
        shellVersion: 1,
      },
    });
    delete withoutRecipe.recipe;
    harness.ship.setChannelSpec(SOURCE_CHANNEL, withoutRecipe);

    expect(await regenerate(harness)).toBe(1);
    expect(harness.json().code).toBe('recipe-absent');
  });

  // A sheet handed to a mode that lands nothing is scored work thrown away in
  // silence, which is the one thing the mode split must never do.
  it('refuses a rubric, rather than ignoring the scoring behind it', async () => {
    const harness = setup({ served: null });
    expect(
      await run(
        [
          'fork',
          SOURCE_CHANNEL,
          '--regenerate',
          '--rubric',
          RUBRIC_PATH,
          '--json',
        ],
        harness.deps
      )
    ).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('usage');
    expect(result.message).toContain('--rubric');
  });

  it('refuses flags that belong to the copy path', async () => {
    const harness = setup();
    expect(
      await run(
        [
          'fork',
          SOURCE_CHANNEL,
          '--regenerate',
          '--into',
          DEST_CHANNEL,
          '--json',
        ],
        harness.deps
      )
    ).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('usage');
    expect(result.message).toContain('--into');
  });
});

/* ------------------------------------------------------------------ */
/* Argument shape                                                      */
/* ------------------------------------------------------------------ */

describe('surface fork — argument shape', () => {
  it('requires a source channel', async () => {
    const harness = setup();
    expect(await run(['fork', '--json'], harness.deps)).toBe(1);
    expect(harness.json().code).toBe('usage');
  });

  it('refuses staging flags on a landing run', async () => {
    const harness = setup();
    expect(await fork(harness, ['--stage-bundle', STAGE_BUNDLE])).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('usage');
    expect(result.message).toContain('--stage-bundle');
  });

  it('refuses a surface id on a staging run', async () => {
    const harness = setup();
    expect(await stage(harness, ['--surface-id', FORK_ID])).toBe(1);
    expect(harness.json().message).toContain('--surface-id');
  });
});

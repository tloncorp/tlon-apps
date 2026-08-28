import type { Json } from '@tloncorp/api';
import { SURFACE_CAPS } from '@tloncorp/api';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { byteLength, sha256Hex } from './bundleServer';

const here = path.dirname(fileURLToPath(import.meta.url));

function readBundle(name: string): string {
  return fs.readFileSync(path.join(here, 'bundles', name), 'utf8');
}

/**
 * The byte-identity torture payload.
 *
 * The `surfaceSpec` lives inside the channel's `description` cell, which
 * is a Hoon `@t` cord that %groups stores, relays and re-serializes. Every
 * client-side guarantee about the spec surviving a metadata edit has so
 * far been proven against the TypeScript encode/decode pair only — this
 * payload is what puts the BACKEND round trip under the same scrutiny.
 *
 * Each key isolates one way a JSON round trip through another runtime can
 * silently rewrite bytes. If any of them comes back different, the client's
 * hash-and-bytes model of the description cell is wrong, and that is a
 * finding about the backend, not something to normalize around.
 *
 * Deliberately excluded: NUL and lone surrogates. A `@t` cord cannot carry
 * a NUL, and a lone surrogate is not valid UTF-8 — neither is a thing a
 * real spec can contain, so including them would produce a "failure" that
 * says nothing about whether the guarantee holds.
 */
export const BYTE_IDENTITY_PROBES: Record<string, Json> = {
  // 1. unicode normalization: the same grapheme in NFD and NFC. A
  //    normalizing round trip collapses these two into one.
  // decomposed: e + COMBINING ACUTE ACCENT (U+0065 U+0301)
  'unicode-nfd': 'caf\u0065\u0301',
  // precomposed: LATIN SMALL LETTER E WITH ACUTE (U+00E9)
  'unicode-nfc': 'caf\u00e9',
  // 2. multi-codepoint emoji: ZWJ sequence plus a skin-tone modifier
  'unicode-zwj': '\u{1F469}\u{1F3FD}‍\u{1F680}',
  // 3. non-latin scripts, including RTL
  'unicode-cjk': '日本語',
  'unicode-rtl': 'עברית',
  // 4. whitespace a trimming serializer would eat
  'whitespace-edges': '  leading and trailing  ',
  'whitespace-escapes': 'tab:\there\nnewline\r\ncrlf',
  // 5. characters that have to survive JSON escaping in both directions
  'json-escapes': 'quote:" backslash:\\ slash:/ brace:{} bracket:[]',
  // 6. key ordering: deliberately not alphabetical, not insertion-sorted
  'key-order': { z: 1, a: 2, M: 3, _1: 4 },
  // 7. number formatting
  'number-forms': [0, -1, 1.5, 9007199254740991, 0.1],
  // 8. an empty string, an empty object and an empty array
  'empty-forms': { s: '', o: {}, a: [] },
  // 9. nesting, since depth is where re-serializers reorder or reflow
  nested: { a: { b: { c: { d: ['deep', { e: 'deeper' }] } } } },
};

export interface SeedBundle {
  name: string;
  content: string;
  declaredLength?: number;
}

/* ------------------------------------------------------------------ */
/* workout tracker: the host-is-the-clock fixture (D54)                */
/* ------------------------------------------------------------------ */

/**
 * The whole point of this fixture is that a member's action is an
 * idempotent `set`, never an `append` — so the outcome is one of exactly
 * two spec-authored literals, and a duplicate invoke re-sets the same path
 * to the same literal.
 */
const OK = { r: 'ok' } as const;
const FAIL = { r: 'fail' } as const;

type Outcome = typeof OK | typeof FAIL;

/** Workout A: squat, bench press, barbell row. */
const A = (squat: Outcome, bench: Outcome, row: Outcome) => ({
  squat,
  bench,
  row,
});

/** Workout B: squat, overhead press, deadlift. */
const B = (squat: Outcome, ohp: Outcome, deadlift: Outcome) => ({
  squat,
  ohp,
  deadlift,
});

/**
 * Archived history, seeded through `initialState` so the chart and the
 * progression have something to derive from on the first render. The live
 * rollover below adds 2026-08-21 on top of this by the mechanism under
 * test, rather than by assertion.
 *
 * Shaped so every derived quantity has a non-trivial value to prove:
 * ~zod misses bench on 08-12 and 08-17 and misses it again in the live
 * session, which is the third consecutive miss and must deload 25 → 22.5;
 * ~zod misses OHP once on 08-14 and then makes it, which must RESET the
 * streak rather than accumulate; ~ten carries an open one-miss streak on
 * OHP with no deload. The two ships are offset by one session so their
 * A/B alternations differ, which is what makes the alternation derived
 * rather than global.
 */
const WORKOUT_HISTORY: Record<string, Record<string, object>> = {
  '2026-08-03': { '~zod': A(OK, OK, OK) },
  '2026-08-05': { '~zod': B(OK, OK, OK) },
  '2026-08-07': { '~zod': A(OK, OK, OK) },
  '2026-08-10': { '~zod': B(OK, OK, OK) },
  '2026-08-12': { '~zod': A(OK, FAIL, OK), '~ten': A(OK, OK, OK) },
  '2026-08-14': { '~zod': B(OK, FAIL, OK), '~ten': B(OK, OK, OK) },
  '2026-08-17': { '~zod': A(OK, FAIL, OK), '~ten': A(OK, OK, OK) },
  '2026-08-19': { '~zod': B(OK, OK, OK), '~ten': B(OK, FAIL, OK) },
};

/** The date the seeded host rollover archives. */
export const WORKOUT_ROLLOVER_DATE = '2026-08-21';

/**
 * Exactly what the host's rollover op archives — and, independently, what
 * the reducer must already be holding in `/today` when the host posts it.
 * The seed asserts those two are the same object, which is the check that
 * makes the rollover proven rather than assumed.
 */
export const WORKOUT_ROLLOVER_VALUE = {
  // A plain object KEY, not a pointer segment: D51's `~` → `~0` escaping
  // applies to paths only, so this is the bare ship name — the same form
  // `$actor` substitution lands in state.
  '~zod': A(OK, FAIL, OK),
};

/** The action a member invokes twice, to exercise D54's idempotency claim. */
export const WORKOUT_DUPLICATED_ACTION = 'squat-ok';

/**
 * A once-only invoke ABOVE the rollover, used as the negative control for
 * the idempotency check: dropping this post must change the fold, which is
 * what proves the "dropping the duplicate changed nothing" result is a
 * measurement rather than a comparison that cannot see anything.
 */
export const WORKOUT_CONTROL_ACTION = 'ohp-fail';

const WORKOUT_LIFT_ORDER = ['squat', 'bench', 'row', 'ohp', 'deadlift'];

function workoutActions(): Record<string, { ops: object[] }> {
  const actions: Record<string, { ops: object[] }> = {};
  for (const id of WORKOUT_LIFT_ORDER) {
    // Two parameterless actions per lift — ten in total, against a cap of
    // 64 — each a single idempotent `set` keyed by the verified actor.
    actions[`${id}-ok`] = {
      ops: [{ op: 'set', path: `/today/$actor/${id}`, value: OK }],
    };
    actions[`${id}-fail`] = {
      ops: [{ op: 'set', path: `/today/$actor/${id}`, value: FAIL }],
    };
  }
  // `del` on a missing path is a no-op (§7), so this is idempotent too.
  actions['clear-today'] = {
    ops: [{ op: 'del', path: '/today/$actor' }],
  };
  return actions;
}

export type SpecOverride = (bundle: {
  assetRef: string;
  sha256: string;
  size: number;
  shellVersion: number;
}) => Record<string, unknown>;

export interface SeedPost {
  /** which ship writes it */
  as: 'zod' | 'ten';
  kind: 'event' | 'snapshot' | 'spec';
  /** fallback story text, exactly as a real writer would supply */
  fallback: string;
  entry: Record<string, unknown>;
}

export interface SeedFixture {
  /** stable channel slug — the seed is re-runnable, so ids must not drift */
  slug: string;
  title: string;
  description: string;
  /** bundle file served by the local storage stand-in, if any */
  bundle?: SeedBundle;
  /**
   * Builds the raw value written to the payload's `surfaceSpec` key. Not
   * typed as `SurfaceSpec` because three fixtures deliberately write
   * something that is NOT a valid spec — that is the whole point of them.
   */
  spec: SpecOverride;
  /** what `readSurfaceSpec` must report for the written spec */
  expectedRead: 'valid' | 'invalid' | 'version-too-new';
  /** what a human should see on web */
  expected: string;
  posts?: (spec: Record<string, unknown>) => SeedPost[];
  /**
   * A later spec write, for the fixture whose behavior is about a revision
   * transition. Takes the revision to write, so a bump is repeatable: each
   * `--bump` reads the ship's current revision and writes the next one,
   * rather than re-writing a fixed number that is already there.
   */
  revise?: (
    bundle: Parameters<SpecOverride>[0],
    revision: number
  ) => Record<string, unknown>;
}

function bundleRefOf(assetRef: string, content: string) {
  return {
    assetRef,
    sha256: sha256Hex(content),
    size: byteLength(content),
    shellVersion: 1,
  };
}

export function bundleRef(origin: string, bundle: SeedBundle) {
  return bundleRefOf(`${origin}/${bundle.name}`, bundle.content);
}

/**
 * A bundle whose served body is comfortably over the 256 KB cap AND whose
 * `Content-Length` says so. That combination is what `fetchBundleText`'s
 * pre-buffer check exists for: the body is refused on its declared length,
 * before a byte of it is read.
 *
 * The spec's own `bundle.size` still has to be within the cap — the schema
 * refuses anything larger, so an "oversized" spec would never validate and
 * the fixture would land on `invalid definition` instead of exercising the
 * fetch path at all. A spec that under-declares a body the host then
 * over-delivers is precisely the lying-asset-host case.
 */
function oversizedBody(): string {
  const header =
    '// Oversized bundle fixture. The served body is over the 256 KB cap\n' +
    '// and Content-Length says so, so it is refused before it is buffered.\n' +
    "surface.register({ render: () => 'this should never run' });\n";
  const padding = '// '.padEnd(80, 'x') + '\n';
  const target = SURFACE_CAPS.bundleSize + 64 * 1024;
  let body = header;
  while (byteLength(body) < target) {
    body += padding;
  }
  return body;
}

export function buildFixtures(): SeedFixture[] {
  const pollBundle: SeedBundle = {
    name: 'poll.js',
    content: readBundle('poll.js'),
  };
  const chartBundle: SeedBundle = {
    name: 'chart.js',
    content: readBundle('chart.js'),
  };
  const brokenBundle: SeedBundle = {
    name: 'broken.js',
    content: readBundle('broken.js'),
  };
  const revisionBundle: SeedBundle = {
    name: 'revision.js',
    content: readBundle('revision.js'),
  };
  const hostileBundle: SeedBundle = {
    name: 'hostile-navigation.js',
    content: readBundle('hostile-navigation.js'),
  };
  const workoutBundle: SeedBundle = {
    name: 'workout.js',
    content: readBundle('workout.js'),
  };
  const oversized = oversizedBody();
  const oversizedBundle: SeedBundle = {
    name: 'oversized.js',
    content: oversized,
    declaredLength: byteLength(oversized),
  };

  return [
    {
      slug: 'surface-poll',
      title: 'Poll — happy path',
      description: 'Two members, both able to invoke.',
      bundle: pollBundle,
      expectedRead: 'valid',
      expected:
        'A rendered poll with two options. Both ~zod and ~ten have already voted (Pizza 1, Tacos 1, turnout 2). Voting again as the signed-in ship overwrites that ship’s vote rather than adding one.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-poll',
        specRevision: 1,
        // unicode in a field the renderer actually shows, so a mangled
        // round trip is visible as well as measurable
        title: 'Lunch poll — café \u{1F32E}',
        bundle,
        initialState: {
          question: 'What should we get for lunch?',
          options: [
            { id: 'pizza', label: 'Pizza', actionId: 'vote-pizza' },
            { id: 'tacos', label: 'Tacos', actionId: 'vote-tacos' },
          ],
          votes: {},
        },
        actions: {
          'vote-pizza': {
            ops: [{ op: 'set', path: '/votes/$actor', value: 'pizza' }],
          },
          'vote-tacos': {
            ops: [{ op: 'set', path: '/votes/$actor', value: 'tacos' }],
          },
        },
        // the byte-identity torture payload rides in `recipe`, which the
        // reducer and the renderer both ignore — so it stresses the
        // transport without perturbing what a human sees
        recipe: BYTE_IDENTITY_PROBES,
      }),
      posts: (spec) => [
        {
          as: 'zod',
          kind: 'event',
          fallback:
            'Voted in “Lunch poll”. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: spec.specRevision as number,
            mode: 'invoke',
            actionId: 'vote-pizza',
          },
        },
        {
          as: 'ten',
          kind: 'event',
          fallback:
            'Voted in “Lunch poll”. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: spec.specRevision as number,
            mode: 'invoke',
            actionId: 'vote-tacos',
          },
        },
      ],
    },

    {
      slug: 'surface-chart',
      title: 'Chart.js — real canvas draw',
      description: 'The first fixture that asks a real 2D context to draw.',
      bundle: chartBundle,
      expectedRead: 'valid',
      expected:
        'A drawn bar chart with three bars (Ship 1, Boat 2, Plane 0). If the canvas is blank or the card shows “Chart.js is not available”, the vendored Chart.js is not reaching a live 2D context.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-chart',
        specRevision: 1,
        title: 'Transport survey',
        bundle,
        initialState: {
          title: 'How did you get here?',
          seriesLabel: 'Responses',
          labels: ['Ship', 'Boat', 'Plane'],
          entries: {},
        },
        actions: {
          'pick-ship': {
            ops: [{ op: 'set', path: '/entries/$actor', value: 'Ship' }],
          },
          'pick-boat': {
            ops: [{ op: 'set', path: '/entries/$actor', value: 'Boat' }],
          },
          'pick-plane': {
            ops: [{ op: 'set', path: '/entries/$actor', value: 'Plane' }],
          },
        },
      }),
      posts: (spec) => [
        {
          as: 'zod',
          kind: 'event',
          fallback: 'Answered a survey. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: spec.specRevision as number,
            mode: 'invoke',
            actionId: 'pick-ship',
          },
        },
        {
          as: 'ten',
          kind: 'event',
          fallback: 'Answered a survey. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: spec.specRevision as number,
            mode: 'invoke',
            actionId: 'pick-boat',
          },
        },
        // A host event, so the chart carries a bar no member set and host
        // ops are visibly folding alongside invokes.
        //
        // The pointer segment is `~0sampel-palnet`, not `~sampel-palnet`:
        // `~` is RFC 6901's escape character, so a bare `~s` is an invalid
        // escape and the reducer skips the op (only that op — the entry
        // still applies). Ship names as pointer segments always need the
        // `~` → `~0` escape, which is exactly what the reducer does to
        // `$actor` before substituting it.
        {
          as: 'zod',
          kind: 'event',
          fallback: 'Dashboard updated. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: spec.specRevision as number,
            mode: 'host',
            ops: [
              { op: 'set', path: '/entries/~0sampel-palnet', value: 'Boat' },
            ],
          },
        },
      ],
    },

    {
      slug: 'surface-migration',
      title: 'Migration pending',
      description: 'A preserving revision whose snapshot was withheld.',
      bundle: pollBundle,
      expectedRead: 'valid',
      expected:
        '“Dashboard update in progress”. NOT an error state, and no stale state behind it — the spec preserves state across the revision but the host has not posted the migration snapshot at revision 2, so there is nothing valid to fold from.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-migration',
        specRevision: 2,
        title: 'Migration pending poll',
        bundle,
        preserveState: true,
        initialState: {
          question: 'This state must never be shown',
          options: [],
          votes: {},
        },
        actions: {
          'vote-pizza': {
            ops: [{ op: 'set', path: '/votes/$actor', value: 'pizza' }],
          },
        },
      }),
      posts: (spec) => [
        // a revision-1 snapshot and a revision-1 event: both are ignored
        // at revision 2, so their presence proves the migration gate is
        // refusing to fall back across revisions rather than simply
        // finding nothing
        {
          as: 'zod',
          kind: 'snapshot',
          fallback: 'Dashboard snapshot. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-snapshot',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: 1,
            upToSequenceNum: 0,
            state: {
              question: 'STALE REVISION 1 STATE — must not be rendered',
              options: [],
              votes: { '~zod': 'pizza' },
            },
          },
        },
        {
          as: 'zod',
          kind: 'event',
          fallback: 'Voted. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: 1,
            mode: 'invoke',
            actionId: 'vote-pizza',
          },
        },
      ],
    },

    {
      slug: 'surface-invalid',
      title: 'Invalid definition',
      description: 'A surfaceSpec that is present but does not validate.',
      expectedRead: 'invalid',
      expected:
        '“This dashboard can’t be displayed” (invalid definition). Critically it must NOT fall back to the chat renderer — the event posts below must never appear as chat messages.',
      spec: () => ({
        version: 1,
        surfaceId: 'seed-invalid',
        specRevision: 1,
        title: 'Invalid on purpose',
        // sha256 is the wrong length and size is negative: two independent
        // schema violations in the field the client treats as authority
        bundle: {
          assetRef: 'http://127.0.0.1:4321/poll.js',
          sha256: 'not-a-sha',
          size: -1,
          shellVersion: 1,
        },
        initialState: { note: 'unreachable' },
        // action ids are constrained to /^[a-z0-9-]+$/
        actions: { 'NOT A VALID ACTION ID': { ops: [] } },
      }),
      posts: (spec) => [
        {
          as: 'zod',
          kind: 'event',
          fallback: 'This is a surface event post. It must NOT render as chat.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: 1,
            mode: 'host',
            ops: [{ op: 'set', path: '/note', value: 'folded nothing' }],
          },
        },
      ],
    },

    {
      slug: 'surface-future',
      title: 'Spec version too new',
      description: 'A spec declaring a protocol version this client predates.',
      expectedRead: 'version-too-new',
      expected:
        '“Update Tlon to view this”. Refusal, not best-effort: a future-version spec is not invalid, it is from the future, and the client must not guess at it.',
      spec: () => ({
        version: 2,
        surfaceId: 'seed-future',
        specRevision: 1,
        title: 'From the future',
        bundle: {
          assetRef: 'http://127.0.0.1:4321/poll.js',
          sha256: 'a'.repeat(64),
          size: 1024,
          shellVersion: 1,
        },
        initialState: {},
        actions: {},
        // a key this client version has never heard of, which must ride
        // through the payload round trip untouched
        futureOnlyField: { capability: 'not-yet-invented' },
      }),
    },

    {
      slug: 'surface-broken-bundle',
      title: 'Broken bundle',
      description: 'A bundle whose render always throws.',
      bundle: brokenBundle,
      expectedRead: 'valid',
      expected:
        'The sandbox loads and the harness error boundary paints its broken state inside the frame (“This app hit an error”). The surrounding Tlon chrome stays intact — an app exception must not white-screen the channel.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-broken',
        specRevision: 1,
        title: 'Broken app',
        bundle,
        initialState: { anything: true },
        actions: {},
      }),
    },

    {
      slug: 'surface-oversized',
      title: 'Oversized bundle',
      description: 'The asset host serves a body over the cap (F7 path).',
      bundle: oversizedBundle,
      expectedRead: 'valid',
      expected:
        '“Can’t load this dashboard right now” with a Retry button. The spec is valid and declares a within-cap size; the asset host answers with a 320 KB body and a truthful Content-Length, and the host refuses it before buffering. Retry must fail the same way, not differently.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-oversized',
        specRevision: 1,
        title: 'Oversized bundle',
        // the spec declares a within-cap size; the asset host lies by
        // delivering far more. Declaring the real size would fail schema
        // validation and land on `invalid` instead of the fetch path.
        bundle: { ...bundle, size: 1024 },
        initialState: {},
        actions: {},
      }),
    },

    {
      slug: 'surface-revision',
      title: 'Stale revision (F2)',
      description: 'A revision bump with a byte-identical bundle.',
      bundle: revisionBundle,
      expectedRead: 'valid',
      expected:
        'After seeding, revision 2 with an empty ping list. The bundle bytes are IDENTICAL across revisions 1 and 2, so a host that keyed its sandbox session on the bundle hash alone would still be showing revision 1 with ~zod’s ping. Use `--bump` to bump it again while the page is open.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-revision',
        specRevision: 1,
        title: 'Revision probe',
        bundle,
        initialState: {
          title: 'Revision probe',
          revision: 1,
          note: 'This is the FIRST revision. Ping, then re-run the seed with --bump.',
          pings: {},
        },
        actions: {
          ping: { ops: [{ op: 'set', path: '/pings/$actor', value: true }] },
        },
      }),
      posts: (spec) => [
        {
          as: 'zod',
          kind: 'event',
          fallback: 'Pinged. Update Tlon to view this dashboard.',
          entry: {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId as string,
            specRevision: 1,
            mode: 'invoke',
            actionId: 'ping',
          },
        },
      ],
      // The bump: same bundle bytes, same assetRef, same sha256 — only the
      // revision and the initialState move. Non-preserving, so the new
      // revision resets to an empty ping list and the previous revision's
      // ping must not replay.
      revise: (bundle, revision) => ({
        version: 1,
        surfaceId: 'seed-revision',
        specRevision: revision,
        title: 'Revision probe',
        bundle,
        initialState: {
          title: 'Revision probe',
          revision,
          note:
            `This is revision ${revision}. The bundle bytes have not changed ` +
            'since revision 1.',
          pings: {},
        },
        actions: {
          ping: { ops: [{ op: 'set', path: '/pings/$actor', value: true }] },
        },
      }),
    },

    {
      slug: 'surface-hostile-nav',
      title: 'Hostile navigation',
      description: 'The posture suite’s probes, live in a real channel.',
      bundle: hostileBundle,
      expectedRead: 'valid',
      expected:
        'A card listing five self-navigation vectors with a Fire button each. Firing any of them must leave the dashboard on screen. If the frame is replaced by a red “NAVIGATION SUCCEEDED” page, that vector reached an off-origin URL from inside the sandbox and the request itself was the egress.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-hostile-nav',
        specRevision: 1,
        title: 'Hostile navigation probes',
        bundle,
        initialState: {
          // which vectors the host's in-realm shim can even reach; the
          // rest go through an object reference or the parser and are
          // untouched by anything the host can do inside the realm
          shimmed: ['nav-replace', 'nav-href'],
        },
        actions: {},
      }),
    },

    {
      slug: 'surface-workout',
      title: 'Workout tracker — host is the clock',
      description: 'Derived state, and a rollover instead of an append.',
      bundle: workoutBundle,
      expectedRead: 'valid',
      expected:
        'A StrongLifts 5×5 dashboard: a log card with All reps / Missed for five lifts, a crew card showing ~zod and ~ten at different working weights, a drawn line chart of squat weight over nine archived dates, and an archived-session list whose newest date is 2026-08-21. ~zod’s bench must read 22.5 kg with a “Bench Press deloaded ×1” badge (three consecutive misses, 25 × 0.9); ~zod’s next workout must read B and ~ten’s A. Tapping the same button twice must change nothing on the second tap.',
      spec: (bundle) => ({
        version: 1,
        surfaceId: 'seed-workout',
        // bumped when the bundle's bytes change: the sha256 in `bundle`
        // changes but nothing else does, and a client that already synced
        // revision 1 has no signal to re-read the spec or re-fetch. A real
        // `surface publish` bumps for the same reason (§9).
        specRevision: 2,
        title: 'StrongLifts 5×5',
        bundle,
        // The log, and nothing derived. Working weight, the A/B
        // alternation, failure streaks and the deload are all computed in
        // `render` — the op language has no arithmetic, so there is no
        // other place they could live (plan §9).
        initialState: {
          program: 'StrongLifts 5×5',
          progression: '+2.5 kg a session, +5 kg deadlift, −10% after 3 misses',
          unit: 'kg',
          barWeight: 20,
          plateStep: 2.5,
          deloadAfter: 3,
          deloadFactor: 0.9,
          chartLift: 'squat',
          historyShown: 6,
          liftOrder: WORKOUT_LIFT_ORDER,
          lifts: {
            squat: { label: 'Squat', scheme: '5×5', start: 20, inc: 2.5 },
            bench: { label: 'Bench Press', scheme: '5×5', start: 20, inc: 2.5 },
            row: { label: 'Barbell Row', scheme: '5×5', start: 30, inc: 2.5 },
            ohp: {
              label: 'Overhead Press',
              scheme: '5×5',
              start: 20,
              inc: 2.5,
            },
            // the deadlift's conventional +5 kg, and a single work set
            deadlift: { label: 'Deadlift', scheme: '1×5', start: 40, inc: 5 },
          },
          workouts: {
            A: ['squat', 'bench', 'row'],
            B: ['squat', 'ohp', 'deadlift'],
          },
          history: WORKOUT_HISTORY,
          today: {},
        },
        actions: workoutActions(),
      }),
      posts: (spec) => {
        const event = (entry: Record<string, unknown>) => ({
          type: 'surface-event',
          version: 1,
          surfaceId: spec.surfaceId as string,
          specRevision: spec.specRevision as number,
          ...entry,
        });
        const log = (as: 'zod' | 'ten', actionId: string): SeedPost => ({
          as,
          kind: 'event',
          fallback: 'Logged a lift. Update Tlon to view this dashboard.',
          entry: event({ mode: 'invoke', actionId }),
        });

        return [
          // ~zod's session, straight into the scratch area. Three
          // idempotent `set /today/$actor/<lift>` writes.
          log('zod', 'squat-ok'),
          log('zod', 'bench-fail'),
          log('zod', 'row-ok'),

          // The host rollover (D54's host-is-the-clock). The host computes
          // both the date and the archived value from its own fold, so
          // members never supply either — two raw ops, against a cap of 20.
          {
            as: 'zod',
            kind: 'event',
            fallback:
              'Archived the day’s session. Update Tlon to view this dashboard.',
            entry: event({
              mode: 'host',
              ops: [
                {
                  op: 'set',
                  path: `/history/${WORKOUT_ROLLOVER_DATE}`,
                  value: WORKOUT_ROLLOVER_VALUE,
                },
                { op: 'del', path: '/today' },
              ],
            }),
          },

          // Post-rollover: the next session starts in a scratch area the
          // host just emptied.
          log('zod', WORKOUT_DUPLICATED_ACTION),
          // The D54 probe: the SAME action again. Two posts land, carrying
          // byte-identical blob entries, and the fold must be unchanged.
          log('zod', WORKOUT_DUPLICATED_ACTION),
          log('zod', WORKOUT_CONTROL_ACTION),
          log('zod', 'deadlift-ok'),

          // ~ten trains on its own alternation.
          log('ten', 'squat-ok'),
          log('ten', 'bench-ok'),

          // §4.3's host-only rule, probed with a payload that could not be
          // missed if it folded: a NON-host ship posting raw ops that would
          // delete the entire archive and forge a perfect session.
          {
            as: 'ten',
            kind: 'event',
            fallback:
              'A non-host ship attempted a rollover. The reducer must ignore it.',
            entry: event({
              mode: 'host',
              ops: [
                { op: 'del', path: '/history' },
                {
                  op: 'set',
                  path: '/today',
                  value: {
                    '~ten': {
                      squat: OK,
                      bench: OK,
                      row: OK,
                      ohp: OK,
                      deadlift: OK,
                    },
                  },
                },
              ],
            }),
          },
        ];
      },
    },
  ];
}

/** Every bundle the local storage stand-in must serve. */
export function bundlesOf(fixtures: SeedFixture[]): SeedBundle[] {
  const seen = new Map<string, SeedBundle>();
  for (const fixture of fixtures) {
    if (fixture.bundle && !seen.has(fixture.bundle.name)) {
      seen.set(fixture.bundle.name, fixture.bundle);
    }
  }
  return [...seen.values()];
}

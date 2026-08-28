import * as api from '@tloncorp/api';
import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  StructuredChannelDescriptionPayload as SCDP,
  readSurfaceSpec,
} from '@tloncorp/api';
import { constructStory, getLevelFromVolumeMap } from '@tloncorp/api/urbit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as db from '../src/db';
import { isSurfaceChannel } from '../src/logic/surfaceChannels';
import * as store from '../src/store';
import { applySurfaceChannelNotificationDefaults } from '../src/store/surfaceNotificationDefaults';
import { hydrateSurface } from '../src/store/surface/hydration';
import {
  DEFAULT_ATTACKER_PORT,
  DEFAULT_BUNDLE_PORT,
  startAttackerServer,
  startBundleServer,
} from './bundleServer';
import {
  BYTE_IDENTITY_PROBES,
  type SeedFixture,
  WORKOUT_CONTROL_ACTION,
  WORKOUT_DUPLICATED_ACTION,
  WORKOUT_ROLLOVER_DATE,
  buildFixtures,
  bundleRef,
  bundlesOf,
} from './fixtures';
import {
  SHIPS,
  WEB_URLS,
  assertShipReachable,
  connectAs,
  disconnect,
  resetDatabase,
} from './shipClient';

/**
 * Seeds the surface-channel fixture menagerie onto the local rube
 * fakeships, as REAL channels written through the REAL client store.
 *
 * Nothing here hand-writes ship state. Channels come from
 * `store.createChannel`; every spec write goes through
 * `store.updateChannel`, which is the one production call site of
 * `StructuredChannelDescriptionPayload.applyMetadataEdit`; posts go
 * through `api.sendPost` with the allowlisted surface kind tails. The
 * point is that a human clicking through the result is exercising the same
 * code paths the app does, and that the verification below is measuring
 * the backend rather than a mock of it.
 *
 * Usage (from the repo root, with `./start-playwright-dev.sh` already run):
 *
 *   pnpm seed:surfaces           seed, verify, then keep serving bundles
 *   pnpm seed:surfaces --once    seed, verify, exit (bundles stop being served)
 *   pnpm seed:surfaces --bump    bump the F2 fixture's revision only
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_OUT = path.resolve(here, 'served');

const GROUP_SLUG = 'surface-seed';
const GROUP_ID = `${SHIPS.zod.name}/${GROUP_SLUG}`;
const GROUP_TITLE = 'Surface seed';

/** The surface channel content configuration: surface renderer, no composer. */
const SURFACE_CONFIG: ChannelContentConfiguration = {
  draftInput: DraftInputId.none,
  defaultPostContentRenderer: PostContentRendererId.chat,
  defaultPostCollectionRenderer: CollectionRendererId.surface,
};

type Ship = 'zod' | 'ten';

interface Failure {
  fixture: string;
  what: string;
  detail: string;
}

const failures: Failure[] = [];
const notes: string[] = [];

function fail(fixture: string, what: string, detail: string) {
  failures.push({ fixture, what, detail });
  console.log(`  ✗ ${fixture}: ${what}\n      ${detail}`);
}

function pass(fixture: string, what: string) {
  console.log(`  ✓ ${fixture}: ${what}`);
}

function note(text: string) {
  notes.push(text);
  console.log(`  · ${text}`);
}

/* ------------------------------------------------------------------ */
/* byte identity                                                       */
/* ------------------------------------------------------------------ */

/**
 * The first codepoint-level difference between two strings, with enough
 * context to identify the construct that moved. Reported rather than
 * normalized: a difference here is a fact about the backend.
 */
function firstDifference(
  written: string,
  readBack: string
): { index: number; written: string; readBack: string } | null {
  const a = [...written];
  const b = [...readBack];
  const limit = Math.max(a.length, b.length);
  for (let i = 0; i < limit; i++) {
    if (a[i] !== b[i]) {
      const from = Math.max(0, i - 30);
      return {
        index: i,
        written: `${a.slice(from, i + 30).join('')} ⟨codepoint ${
          a[i] === undefined
            ? 'END'
            : `U+${a[i].codePointAt(0)!.toString(16).toUpperCase()}`
        }⟩`,
        readBack: `${b.slice(from, i + 30).join('')} ⟨codepoint ${
          b[i] === undefined
            ? 'END'
            : `U+${b[i].codePointAt(0)!.toString(16).toUpperCase()}`
        }⟩`,
      };
    }
  }
  return null;
}

function bytesEqual(a: string, b: string): boolean {
  return Buffer.from(a, 'utf8').equals(Buffer.from(b, 'utf8'));
}

/* ------------------------------------------------------------------ */
/* ship-side reads                                                     */
/* ------------------------------------------------------------------ */

/**
 * The channel's description cell exactly as %groups holds it, read
 * straight out of a scry with no client-side transform in between.
 *
 * This is the measurement that matters for byte identity: `toClientChannel`
 * would hand back `rawPersistenceFields`, which is faithful but is still
 * TypeScript we wrote. Reading the scry JSON directly means the comparison
 * is client-written bytes against backend-held bytes and nothing else.
 */
async function scryChannelDescription(
  groupId: string,
  channelId: string
): Promise<string | undefined> {
  const group = await api.scry<{
    channels?: Record<string, { meta?: { description?: string } }>;
  }>({ app: 'groups', path: `/v2/groups/${groupId}` });
  return group?.channels?.[channelId]?.meta?.description;
}

/* ------------------------------------------------------------------ */
/* writers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Writes a fixture's spec into the channel description through the real
 * metadata-edit path, and returns both the bytes we handed the backend and
 * the bytes it handed back.
 *
 * The read-modify-write is exactly what a spec writer has to do (plan §3):
 * decode the CURRENT stored payload, set `surfaceSpec`, and re-encode. The
 * push itself is `store.updateChannel`, which rebuilds the description via
 * `applyMetadataEdit` from the stored payload — so `surfaceSpec` and any
 * unknown payload key ride through without this code naming them.
 */
async function writeSpec(
  fixture: SeedFixture,
  channelId: string,
  group: db.Group,
  spec: Record<string, unknown>
): Promise<{ written: string; readBack: string | undefined }> {
  const current = await db.getChannel({ id: channelId, includeWriters: true });
  if (!current) {
    throw new Error(`channel ${channelId} is not in the local mirror`);
  }

  // read-modify-write over the CURRENT stored payload
  const decoded = SCDP.decode(current.descriptionPayload);
  const nextPayload = SCDP.encode({
    ...decoded,
    surfaceSpec: spec as never,
  }) as string;

  // Land the new payload in the local mirror first, exactly as a sync
  // would, so `updateChannel`'s `applyMetadataEdit` reads it as the
  // current payload and carries `surfaceSpec` through untouched.
  await db.updateChannel({
    id: channelId,
    ...SCDP.rawPersistenceFields(nextPayload),
  });

  const withPayload = await db.getChannel({
    id: channelId,
    includeWriters: true,
  });
  if (!withPayload) {
    throw new Error(`channel ${channelId} vanished mid-write`);
  }

  // What `updateChannel` will hand the backend. Pure and deterministic
  // over the same inputs, so computing it here does not change what is
  // sent — it only lets us name the bytes we expect back.
  const written = SCDP.applyMetadataEdit(withPayload.descriptionPayload, {
    description: withPayload.description,
    channelContentConfiguration: withPayload.contentConfiguration,
  });

  const navSection = (group.navSections ?? []).find((section) =>
    section.channels?.some((c) => c.channelId === channelId)
  );

  await store.updateChannel({
    groupId: group.id,
    channel: withPayload,
    sectionId: navSection?.sectionId ?? 'default',
    // The seed's channels are created with empty reader and writer role
    // sets (the v0 personal-group policy: every member may post, and what
    // a post can MEAN is bounded by the invoke design). `getChannel` only
    // hydrates writer roles, so readers are passed through as the empty
    // set they were created with rather than guessed at.
    readers: [],
    writers: withPayload.writerRoles?.map((role) => role.roleId) ?? [],
    join: true,
  });

  const readBack = await scryChannelDescription(group.id, channelId);
  return { written, readBack };
}

const KIND_TAIL = {
  event: 'surface/event',
  snapshot: 'surface/snapshot',
  spec: 'surface/spec',
} as const;

async function postSurfaceRecord(
  channelId: string,
  record: {
    kind: 'event' | 'snapshot' | 'spec';
    fallback: string;
    entry: object;
  }
): Promise<void> {
  // exactly one surface blob entry per post, plus fallback Story text so
  // pre-surface clients degrade to an inert chat message (plan §9)
  await api.sendPost({
    channelId,
    authorId: api.getCurrentUserId(),
    content: constructStory([record.fallback]),
    blob: JSON.stringify([record.entry]),
    sentAt: Date.now(),
    kindTail: KIND_TAIL[record.kind],
  });
}

/* ------------------------------------------------------------------ */
/* phases                                                              */
/* ------------------------------------------------------------------ */

/** The nests %channels currently holds, whatever %groups thinks. */
async function shipNests(): Promise<
  Record<string, { perms?: { group?: string } }>
> {
  return api
    .scry<Record<string, { perms?: { group?: string } }>>({
      app: 'channels',
      path: '/v3/channels',
    })
    .catch(() => ({}));
}

/** The channels %groups lists under the seed group, or null if no group. */
async function shipGroupChannels(): Promise<Set<string> | null> {
  const group = await api
    .scry<{ channels?: Record<string, unknown> }>({
      app: 'groups',
      path: `/v2/groups/${GROUP_ID}`,
    })
    .catch(() => null);
  return group === null ? null : new Set(Object.keys(group.channels ?? {}));
}

/**
 * The seed is re-runnable by REUSE, not by teardown, and that is a
 * constraint the backend imposes rather than a preference.
 *
 * A channel's identity lives in three places and the app's delete only
 * reaches one of them. `store.deleteChannel` pokes %groups, which unlists
 * the nest; %channels and %channels-server both keep their own maps.
 * %channels-server's `ca-create` then opens with
 *
 *     ?:  (~(has by v-channels) n)
 *       %-  (slog leaf+"channel-server: create already exists: {<n>}" ~)
 *       ca-core
 *
 * — a SILENT no-op. So re-creating a channel under a name that was ever
 * used before leaves it half-created: %channels holds an entry whose
 * `perms.group` is the bunt flag (`~zod/`), %groups never learns about it,
 * and the client's tracked poke still resolves successfully because
 * %channels answered. Measured directly on ~zod; see the seed doc.
 *
 * Reuse sidesteps this entirely: a name is created once on a ship and
 * never again. Determinism across runs comes from clearing the channel's
 * POSTS instead, which has no such asymmetry.
 */
async function ensureSeedGroup(): Promise<db.Group> {
  const listed = await shipGroupChannels();
  if (listed === null) {
    console.log(`  creating ${GROUP_ID}`);
    await store.createDefaultGroup({
      groupId: GROUP_ID,
      title: GROUP_TITLE,
      memberIds: [SHIPS.ten.name],
    });
  } else {
    console.log(`  reusing ${GROUP_ID}`);
  }
  await store.syncGroups();
  const group = await db.getGroup({ id: GROUP_ID });
  if (!group) {
    throw new Error(`seed group ${GROUP_ID} did not come back from the ship`);
  }
  return group;
}

async function ensureFixtureChannels(fixtures: SeedFixture[]): Promise<void> {
  const listed = (await shipGroupChannels()) ?? new Set<string>();
  const nests = await shipNests();
  const created: string[] = [];

  for (const fixture of fixtures) {
    const channelId = channelIdOf(fixture);
    if (listed.has(channelId)) {
      console.log(`  reusing ${channelId}`);
      continue;
    }
    if (channelId in nests) {
      // The half-created state above. It cannot be repaired by creating
      // the same name again — that is exactly the no-op — and there is no
      // supported poke that makes %channels-server forget a nest.
      throw new Error(
        `${channelId} exists in %channels but is not listed in ${GROUP_ID}.\n` +
          'This name is burned on this ship: %channels-server silently\n' +
          'no-ops a create for a nest it already holds, so re-creating it\n' +
          'will keep failing. Reset the fakeship state (stop the dev\n' +
          'environment and re-run ./start-playwright-dev.sh, which nukes\n' +
          'ship state) and seed again.'
      );
    }
    console.log(`  creating ${channelId}`);
    await store.createChannel({
      groupId: GROUP_ID,
      title: fixture.title,
      description: fixture.description,
      channelType: 'chat',
      contentConfiguration: SURFACE_CONFIG,
      customSlug: fixture.slug,
      // empty writer set: every group member may post, which is the v0
      // personal-group policy. What a post can MEAN is bounded by the
      // invoke design, not by who may write.
      writers: [],
      readers: [],
    });
    created.push(channelId);
  }

  // `store.createChannel` resolves once %channels has the nest, but the
  // channel only reaches the GROUP after %channels-server relays the create
  // on. Syncing before that lands would have `insertGroups` reconcile the
  // group's channel set against a listing that does not include them yet.
  if (created.length > 0) {
    await waitForShipListing(created);
  }
  await store.syncGroups();
}

async function waitForShipListing(channelIds: string[]): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const listed = (await shipGroupChannels()) ?? new Set<string>();
    const missing = channelIds.filter((id) => !listed.has(id));
    if (missing.length === 0) {
      return;
    }
    if (attempt === 39) {
      throw new Error(
        `%groups never listed ${JSON.stringify(missing)}; the create was ` +
          'accepted by %channels but never relayed on'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Clears a seeded channel's posts so a re-run folds the same history the
 * first run did. This is the half of "re-runnable" that deleting channels
 * was meant to provide, and unlike channel deletion it is symmetric: the
 * host may delete any post in a channel it hosts.
 */
async function clearSeededPosts(fixtures: SeedFixture[]): Promise<void> {
  for (const fixture of fixtures) {
    const channelId = channelIdOf(fixture);
    await store.syncPosts({ channelId, mode: 'newest', count: 200 });
    const posts = await db.getSequencedChannelPosts({
      channelId,
      mode: 'newest',
      count: 200,
    });
    const live = posts.filter((post) => !post.isDeleted);
    for (const post of live) {
      // `api.deletePost` rather than `store.deletePost`: the store action
      // routes through `sessionActionQueue`, which only drains once a
      // client session reaches `ready`. The seed has no session, so the
      // queue would never drain and the run would hang here.
      await api.deletePost(post.channelId, post.id, post.authorId);
    }
    if (live.length > 0) {
      console.log(`  cleared ${live.length} post(s) from ${channelId}`);
    }
  }
}

function channelIdOf(fixture: SeedFixture): string {
  return `chat/${SHIPS.zod.name}/${fixture.slug}`;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const args = new Set(process.argv.slice(2));
  const bumpOnly = args.has('--bump');
  const once = args.has('--once');

  console.log('\n=== surface channel seed ===\n');

  console.log('ships:');
  for (const key of ['zod', 'ten'] as Ship[]) {
    await assertShipReachable(SHIPS[key]);
    console.log(`  ✓ ${SHIPS[key].name} at ${SHIPS[key].url}`);
  }

  const fixtures = buildFixtures();
  const bundles = bundlesOf(fixtures);

  // `--bump` is meant to be run WHILE a serving instance is up and a
  // dashboard is open in a browser — that is the whole F2 observation — so
  // it must not try to bind the ports that instance already holds. It only
  // needs the bundle bytes, which it hashes off disk.
  const bundleOrigin = `http://127.0.0.1:${DEFAULT_BUNDLE_PORT}`;
  const servers = bumpOnly
    ? null
    : {
        bundle: await startBundleServer({
          bundles,
          outDir: BUNDLE_OUT,
          port: DEFAULT_BUNDLE_PORT,
        }),
        attacker: await startAttackerServer(DEFAULT_ATTACKER_PORT),
      };
  if (servers) {
    console.log(`\nbundle host: ${bundleOrigin} (${bundles.length} bundles)`);
    console.log(`probe target: ${servers.attacker.origin}\n`);
  }

  const specs = new Map<string, Record<string, unknown>>();

  /* ---- phase 1: ~zod ---------------------------------------------- */
  resetDatabase();
  await connectAs(SHIPS.zod);
  await store.setupHighPrioritySubscriptions();

  if (bumpOnly) {
    // `--bump` runs against a fresh in-memory mirror, so pull the group
    // and channels down before reading the current revision off them.
    await store.syncGroups();
    await runBump(fixtures, bundleOrigin);
  } else {
    console.log('group and channels:');
    await ensureSeedGroup();
    await ensureFixtureChannels(fixtures);

    console.log('\nclearing posts from any previous run:');
    await clearSeededPosts(fixtures);

    const groupAfter = (await db.getGroup({ id: GROUP_ID }))!;

    console.log('\nwriting specs (byte-identity check on every write):');
    for (const fixture of fixtures) {
      const channelId = channelIdOf(fixture);
      const bundle = fixture.bundle
        ? bundleRef(bundleOrigin, fixture.bundle)
        : {
            assetRef: `${bundleOrigin}/poll.js`,
            sha256: 'a'.repeat(64),
            size: 1024,
            shellVersion: 1,
          };
      const spec = fixture.spec(bundle);
      specs.set(fixture.slug, spec);

      const { written, readBack } = await writeSpec(
        fixture,
        channelId,
        groupAfter,
        spec
      );
      checkByteIdentity(fixture.slug, written, readBack);
    }

    console.log('\nposting surface records as ~zod:');
    for (const fixture of fixtures) {
      const posts = fixture.posts?.(specs.get(fixture.slug)!) ?? [];
      for (const post of posts.filter((p) => p.as === 'zod')) {
        await postSurfaceRecord(channelIdOf(fixture), post);
      }
      if (posts.some((p) => p.as === 'zod')) {
        pass(
          fixture.slug,
          `${posts.filter((p) => p.as === 'zod').length} record(s)`
        );
      }
    }

    console.log('\nF4 — auto-hush on surface channel discovery:');
    await runF4Hush(fixtures);

    /* ---- phase 2: ~ten -------------------------------------------- */
    console.log('\n~ten joins and invokes:');
    disconnect();
    resetDatabase();
    await connectAs(SHIPS.ten);
    await store.setupHighPrioritySubscriptions();
    await store.joinGroup({ id: GROUP_ID } as db.Group);
    await waitForTenMembership();

    for (const fixture of fixtures) {
      const posts = fixture.posts?.(specs.get(fixture.slug)!) ?? [];
      for (const post of posts.filter((p) => p.as === 'ten')) {
        await postSurfaceRecord(channelIdOf(fixture), post);
        pass(
          fixture.slug,
          post.entry['mode'] === 'host'
            ? '~ten posted raw ops as a non-host ship'
            : `~ten invoked ${String(post.entry['actionId'])}`
        );
      }
    }

    /* ---- phase 3: verification as ~zod ----------------------------- */
    disconnect();
    resetDatabase();
    await connectAs(SHIPS.zod);
    await store.setupHighPrioritySubscriptions();
    await store.syncGroups();

    console.log(
      '\nF3 — metadata ahead of posts yields partial, then hydrated:'
    );
    await runF3(fixtures[0]);

    console.log('\nF4 — no notifications from surface interaction:');
    await runF4NoNotifications(fixtures);

    console.log('\nverifying every fixture from the ship:');
    for (const fixture of fixtures) {
      await verifyFixture(fixture);
    }

    console.log('\napplying the F2 revision bump (same bundle bytes):');
    await runBump(fixtures, bundleOrigin);
  }

  /* ---- report ------------------------------------------------------ */
  report(fixtures, bundleOrigin, `http://127.0.0.1:${DEFAULT_ATTACKER_PORT}`);

  if (once || servers === null) {
    await servers?.bundle.close();
    await servers?.attacker.close();
    process.exit(failures.length === 0 ? 0 : 1);
  }

  console.log(
    '\nBundle host is still running so the seeded dashboards can load.\n' +
      'Press Ctrl+C when you are done clicking through.\n'
  );
  process.on('SIGINT', () => {
    void servers.bundle.close();
    void servers.attacker.close();
    process.exit(failures.length === 0 ? 0 : 1);
  });
  await new Promise(() => {});
}

/* ------------------------------------------------------------------ */
/* checks                                                              */
/* ------------------------------------------------------------------ */

function checkByteIdentity(
  slug: string,
  written: string,
  readBack: string | undefined
) {
  if (readBack === undefined) {
    fail(
      slug,
      'byte identity',
      'the channel has no description cell on the ship'
    );
    return;
  }
  if (bytesEqual(written, readBack)) {
    pass(
      slug,
      `byte-identical round trip (${Buffer.byteLength(written, 'utf8')} bytes)`
    );
    return;
  }
  const diff = firstDifference(written, readBack);
  fail(
    slug,
    'BYTE IDENTITY VIOLATED',
    `wrote ${Buffer.byteLength(written, 'utf8')} bytes, read back ${Buffer.byteLength(
      readBack,
      'utf8'
    )}.\n      first difference at codepoint ${diff?.index}\n` +
      `      wrote:     …${diff?.written}…\n` +
      `      read back: …${diff?.readBack}…`
  );
}

/**
 * Runs each byte-identity probe on its own, through the same real write
 * path, so a failure names the construct rather than the payload. Only
 * runs when the aggregate check has already failed — otherwise it is a
 * dozen extra ship writes proving something already proven.
 */
async function bisectByteIdentity(
  channelId: string,
  group: db.Group
): Promise<void> {
  console.log(
    '\n  bisecting the byte-identity failure, one construct at a time:'
  );
  for (const [name, value] of Object.entries(BYTE_IDENTITY_PROBES)) {
    const probeSpec = {
      version: 1,
      surfaceId: 'seed-bisect',
      specRevision: 1,
      bundle: {
        assetRef: 'http://127.0.0.1:4321/poll.js',
        sha256: 'a'.repeat(64),
        size: 1024,
        shellVersion: 1,
      },
      initialState: {},
      actions: {},
      recipe: { [name]: value },
    };
    const { written, readBack } = await writeSpec(
      { slug: `probe:${name}` } as SeedFixture,
      channelId,
      group,
      probeSpec
    );
    if (readBack !== undefined && bytesEqual(written, readBack)) {
      console.log(`    ✓ ${name}`);
    } else {
      const diff = readBack ? firstDifference(written, readBack) : null;
      console.log(
        `    ✗ ${name} — wrote ${JSON.stringify(value)}, differs at codepoint ${diff?.index}`
      );
    }
  }
}

async function verifyFixture(fixture: SeedFixture): Promise<void> {
  const channelId = channelIdOf(fixture);
  const channel = await db.getChannel({ id: channelId });
  if (!channel) {
    fail(fixture.slug, 'sync', 'the channel did not come back from the ship');
    return;
  }

  // 1. the spec, read from the persisted raw value the renderer reads
  const read = readSurfaceSpec(channel.surfaceSpec);
  if (read.status === fixture.expectedRead) {
    pass(fixture.slug, `readSurfaceSpec → ${read.status}`);
  } else {
    fail(
      fixture.slug,
      'readSurfaceSpec',
      `expected ${fixture.expectedRead}, got ${read.status}`
    );
  }

  // 2. the channel is recognizable as a surface channel at all
  if (!isSurfaceChannel(channel)) {
    fail(
      fixture.slug,
      'content configuration',
      'the channel does not read as a surface channel after the round trip'
    );
  }

  // 3. hydration, which is where the reducer, the revision filter and the
  //    migration gate all show up.
  //
  // The window is sized to the channel's ACCUMULATED history, not its live
  // post count. The seed is re-runnable by clearing posts, and a cleared
  // post keeps its sequence number — so after a handful of runs the oldest
  // live post sits well above sequence 1, and `hydrateSurface` (called with
  // no backfill here) can only reach the channel start if the local mirror
  // already holds every row down to it. At `count: 50` the workout fixture,
  // which posts eleven records a run, crossed that line and reported
  // `partial` — an artifact of re-running the seed, not of the fixture.
  const window = 400;
  await store.syncPosts({ channelId, mode: 'newest', count: window });
  const hydration = await hydrateSurface({ channelId, pageSize: window });
  note(`${fixture.slug}: hydration → ${hydration.status}`);

  if (fixture.slug === 'surface-poll' && hydration.status === 'hydrated') {
    const votes = (hydration.state as { votes?: Record<string, string> }).votes;
    const voters = Object.keys(votes ?? {}).sort();
    if (
      voters.length === 2 &&
      votes?.['~zod'] === 'pizza' &&
      votes?.['~ten'] === 'tacos'
    ) {
      pass(
        fixture.slug,
        'both members folded ($actor keyed by verified author)'
      );
    } else {
      fail(
        fixture.slug,
        'two-member fold',
        `expected ~zod→pizza and ~ten→tacos, got ${JSON.stringify(votes)}`
      );
    }
  }

  if (fixture.slug === 'surface-migration') {
    if (hydration.status === 'migration-pending') {
      pass(fixture.slug, 'migration-pending, carrying no state');
      if (hydration.state !== undefined) {
        fail(
          fixture.slug,
          'migration-pending',
          'the pending state carried reduced state, which §6 forbids'
        );
      }
    } else {
      fail(
        fixture.slug,
        'migration gate',
        `expected migration-pending, got ${hydration.status}`
      );
    }
  }

  if (fixture.slug === 'surface-workout') {
    await runWorkoutChecks(fixture);
  }
}

/* ------------------------------------------------------------------ */
/* the host-is-the-clock checks (D54)                                  */
/* ------------------------------------------------------------------ */

/** A post's surface blob entries, parsed with no client transform. */
function blobEntries(post: db.Post): Record<string, unknown>[] {
  if (typeof post.blob !== 'string' || post.blob.length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(post.blob);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

/** Key-order-independent comparison, for state built by different routes. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(
            (value as Record<string, unknown>)[key]
          )}`
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * The four claims the workout fixture exists to test, each measured
 * against the real post set the ships hold rather than against the
 * fixture's own intent:
 *
 *  1. the host rollover archived EXACTLY the `/today` the fold was
 *     holding at that moment (computed by re-folding the posts beneath
 *     the rollover, not by trusting the literal the host wrote), and
 *     `/today` was cleared;
 *  2. a duplicate invoke is a state no-op — the two posts carry
 *     byte-identical blobs, and dropping one produces a byte-identical
 *     fold (D54's central claim, verified by observation);
 *  3. a NON-host ship's raw ops are ignored (§4.3 host-only rule);
 *  4. the whole reduced state is exactly the log, with nothing derived
 *     stored in it.
 */
async function runWorkoutChecks(fixture: SeedFixture): Promise<void> {
  const slug = fixture.slug;
  const channelId = channelIdOf(fixture);
  const channel = await db.getChannel({ id: channelId });
  const read = readSurfaceSpec(channel?.surfaceSpec ?? null);
  if (read.status !== 'valid') {
    fail(slug, 'setup', `the spec reads back as ${read.status}`);
    return;
  }
  const spec = read.spec;

  const posts = await db.getSequencedChannelPosts({
    channelId,
    mode: 'newest',
    count: 200,
  });
  const reduction = store.reduceSurfaceChannel({ channelId, spec, posts });
  if (reduction.status !== 'reduced') {
    fail(slug, 'fold', `expected a reduction, got ${reduction.status}`);
    return;
  }
  const state = reduction.state as {
    history?: Record<string, Record<string, unknown>>;
    today?: Record<string, Record<string, unknown>>;
  };

  /* ---- 1. the rollover ------------------------------------------- */

  const rollover = posts.find((post) =>
    blobEntries(post).some(
      (entry) =>
        entry.mode === 'host' &&
        Array.isArray(entry.ops) &&
        (entry.ops as { path?: string }[]).some(
          (op) => op.path === `/history/${WORKOUT_ROLLOVER_DATE}`
        )
    )
  );
  if (!rollover || typeof rollover.sequenceNum !== 'number') {
    fail(slug, 'rollover', 'no host rollover post is on the ship');
    return;
  }

  // What the fold held one post before the rollover: the value the host
  // would have computed from its own fold.
  const beneath = posts.filter(
    (post) =>
      typeof post.sequenceNum === 'number' &&
      post.sequenceNum < (rollover.sequenceNum as number)
  );
  const before = store.reduceSurfaceChannel({
    channelId,
    spec,
    posts: beneath,
  });
  const scratchBefore =
    before.status === 'reduced'
      ? (before.state as { today?: unknown }).today
      : undefined;
  const archived = (state.history ?? {})[WORKOUT_ROLLOVER_DATE];

  if (canonicalJson(archived) === canonicalJson(scratchBefore)) {
    pass(
      slug,
      `rollover archived the exact pre-rollover scratch area under ${WORKOUT_ROLLOVER_DATE}`
    );
  } else {
    fail(
      slug,
      'rollover archive',
      `/history/${WORKOUT_ROLLOVER_DATE} is ${JSON.stringify(archived)} but ` +
        `the fold beneath the rollover held ${JSON.stringify(scratchBefore)}`
    );
  }

  // `del /today` cleared the scratch area: the pre-rollover lifts are
  // gone and only the post-rollover ones remain.
  const zodToday = Object.keys((state.today ?? {})['~zod'] ?? {}).sort();
  const expectedZodToday = ['deadlift', 'ohp', 'squat'];
  if (canonicalJson(zodToday) === canonicalJson(expectedZodToday)) {
    pass(slug, 'del /today cleared the scratch area across the rollover');
  } else {
    fail(
      slug,
      'rollover clear',
      `~zod's scratch area is ${JSON.stringify(zodToday)}; expected ` +
        `${JSON.stringify(expectedZodToday)} (the pre-rollover lifts should ` +
        'have been deleted)'
    );
  }

  /* ---- 2. idempotency (D54) --------------------------------------- */

  const byBlob = new Map<string, db.Post[]>();
  for (const post of posts) {
    if (typeof post.blob !== 'string' || post.blob.length === 0) {
      continue;
    }
    const key = JSON.stringify([post.authorId, post.blob]);
    byBlob.set(key, [...(byBlob.get(key) ?? []), post]);
  }
  const duplicated = [...byBlob.values()].filter((group) => group.length > 1);

  // D54's premise, measured rather than argued: the fixture invokes
  // `squat-ok` three times as ~zod — once in the session the host archived
  // and twice after it — and all THREE posts carry byte-identical blobs.
  // Nothing in the entry distinguishes the legitimate second session from
  // the double-tap; only the host's rollover between them does. That is
  // exactly why `append` is unfixable in v0 and `set` is not.
  if (duplicated.length !== 1 || duplicated[0].length !== 3) {
    fail(
      slug,
      'duplicate invoke',
      `expected exactly one group of three byte-identical blobs, found ${
        duplicated.length
      } group(s) of sizes ${JSON.stringify(duplicated.map((g) => g.length))}`
    );
    return;
  }
  const identical = [...duplicated[0]].sort(
    (a, b) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0)
  );
  const actionId = blobEntries(identical[0])[0]?.actionId;
  if (actionId !== WORKOUT_DUPLICATED_ACTION) {
    fail(
      slug,
      'duplicate invoke',
      `the byte-identical group invokes ${String(actionId)}, not ${WORKOUT_DUPLICATED_ACTION}`
    );
    return;
  }
  const archivedTwin = identical[0];
  const doubleTap = identical[2];
  const rolloverSeq = rollover.sequenceNum as number;
  if (
    !(
      (archivedTwin.sequenceNum ?? 0) < rolloverSeq &&
      (identical[1].sequenceNum ?? 0) > rolloverSeq &&
      (doubleTap.sequenceNum ?? 0) > rolloverSeq
    )
  ) {
    fail(
      slug,
      'duplicate invoke',
      `the three identical invokes are at seq ${JSON.stringify(
        identical.map((post) => post.sequenceNum)
      )}, which does not straddle the rollover at seq ${rolloverSeq}`
    );
    return;
  }
  pass(
    slug,
    `three distinct posts (seq ${identical
      .map((post) => post.sequenceNum)
      .join(', ')}) carry byte-identical ` +
      `${Buffer.byteLength(archivedTwin.blob!, 'utf8')}-byte blobs`
  );

  const foldWithout = (post: db.Post) => {
    const result = store.reduceSurfaceChannel({
      channelId,
      spec,
      posts: posts.filter((candidate) => candidate.id !== post.id),
    });
    return result.status === 'reduced'
      ? JSON.stringify(result.state)
      : '<not reduced>';
  };
  const foldedAll = JSON.stringify(reduction.state);

  // The claim: dropping the double-tap changes nothing.
  if (foldWithout(doubleTap) === foldedAll) {
    pass(
      slug,
      'the second invoke changed nothing: folding without it is byte-identical'
    );
  } else {
    fail(
      slug,
      'IDEMPOTENCY VIOLATED',
      'dropping the duplicate post changed the fold.\n' +
        `      with both: ${foldedAll}\n` +
        `      with one:  ${foldWithout(doubleTap)}`
    );
  }

  // The negative control, so the result above is a measurement rather than
  // a comparison that cannot see anything: a once-only invoke from the same
  // ship, above the same rollover, whose removal MUST change the fold.
  const control = posts.find((post) =>
    blobEntries(post).some((entry) => entry.actionId === WORKOUT_CONTROL_ACTION)
  );
  if (!control) {
    fail(
      slug,
      'idempotency control',
      `no ${WORKOUT_CONTROL_ACTION} invoke is on the ship to control against`
    );
  } else if (foldWithout(control) !== foldedAll) {
    pass(
      slug,
      `dropping the once-only ${WORKOUT_CONTROL_ACTION} invoke DOES change the fold`
    );
  } else {
    fail(
      slug,
      'idempotency control',
      `dropping the once-only ${WORKOUT_CONTROL_ACTION} invoke changed nothing ` +
        'either, so the comparison above cannot distinguish a folded post ' +
        'from an ignored one'
    );
  }

  // Measured, and worth stating because it is a property of the PATTERN
  // rather than of this fixture: dropping the pre-rollover twin of the
  // duplicate also changes nothing. The rollover writes a literal the host
  // computed off-fold and then deletes `/today`, so once a day is archived,
  // none of the member invokes underneath it are load-bearing any more —
  // the archived day is host-ASSERTED, not reducer-derived.
  if (foldWithout(archivedTwin) === foldedAll) {
    note(
      `${slug}: after the rollover, the member invokes it archived are no ` +
        'longer load-bearing — the dated history is a host-authored literal, ' +
        'not a reducer-verified copy of what /today held'
    );
  } else {
    note(
      `${slug}: dropping a pre-rollover invoke still changes the fold, so ` +
        'the archived day depends on posts beneath the rollover'
    );
  }

  /* ---- 3. host-only raw ops (§4.3) -------------------------------- */

  const forged = posts.filter(
    (post) =>
      post.authorId !== SHIPS.zod.name &&
      blobEntries(post).some((entry) => entry.mode === 'host')
  );
  if (forged.length === 0) {
    fail(
      slug,
      'host-only rule',
      'no non-host raw-op post is on the ship, so the rule was never probed'
    );
  } else {
    const historyDates = Object.keys(state.history ?? {}).length;
    const tenToday = Object.keys((state.today ?? {})['~ten'] ?? {}).sort();
    const intact =
      historyDates === 9 &&
      canonicalJson(tenToday) === canonicalJson(['bench', 'squat']);
    if (intact && reduction.skippedEventCount >= 1) {
      pass(
        slug,
        `~ten's raw-op rollover was skipped (${reduction.skippedEventCount} ` +
          `skipped event(s); ${historyDates} archived dates intact)`
      );
    } else {
      fail(
        slug,
        'HOST-ONLY RULE VIOLATED',
        `a non-host ship's raw ops folded: ${historyDates} archived dates ` +
          `(expected 9), ~ten's scratch area is ${JSON.stringify(tenToday)} ` +
          `(expected ["bench","squat"]), ${reduction.skippedEventCount} skipped`
      );
    }
  }

  /* ---- 4. the state is the log and nothing else -------------------- */

  const derivedKeys = Object.keys(state.today ?? {}).length;
  note(
    `${slug}: reduced state carries ${
      Object.keys(state.history ?? {}).length
    } archived dates and ${derivedKeys} scratch ship(s); every weight, ` +
      'streak and deload on screen is derived in render()'
  );
}

/**
 * F3: a fold whose window does not reach the channel's advertised head
 * must report `partial` and carry NO state, then `hydrated` once the
 * posts catch up. ("Metadata ahead of posts" — a truncated fold is wrong
 * derived state, not stale state, so it must carry nothing.)
 *
 * In a browser this window is a race you can only hope to catch. Here it
 * is constructed, but out of real ship data on both ends: a fresh local
 * mirror takes the SERVER's own head watermark (the `newest` field the
 * posts scry returns, which is what sync writes) together with only the
 * oldest slice of the history. Nothing is fabricated — the head is the
 * ship's, the posts are the ship's, and the only contrivance is stopping
 * the local window short, which is exactly what a lagging client does.
 */
async function runF3(fixture: SeedFixture): Promise<void> {
  const channelId = channelIdOf(fixture);

  // a fresh mirror: the channel and its spec, no posts
  resetDatabase();
  await store.syncGroups();
  if (!(await db.getChannel({ id: channelId }))) {
    fail('F3', 'setup', 'the channel is missing from a fresh mirror');
    return;
  }

  // one post from the bottom of the history, plus the ship's real head
  const slice = await api.getSequencedChannelPosts({
    channelId,
    start: 1,
    end: 1,
  });
  const head = slice.newestSequenceNum;
  if (head == null || head < 2) {
    fail(
      'F3',
      'setup',
      `the ship advertises head ${head} for ${channelId}; the fixture needs ` +
        'at least two sequenced posts for a window to fall short of it'
    );
    return;
  }
  if (slice.posts.length > 0) {
    await db.insertChannelPosts({ posts: slice.posts });
  }
  await db.setLatestChannelSequenceNum({ channelId, sequenceNum: head });

  const partial = await hydrateSurface({ channelId, backfill: undefined });
  if (partial.status !== 'partial') {
    fail(
      'F3',
      'metadata-ahead-of-posts',
      `window newest=${partial.newestLoadedSeq} vs ship head=${head}: ` +
        `expected partial, got ${partial.status}`
    );
  } else if (partial.state !== undefined) {
    fail('F3', 'partial', 'the partial result carried state, which §6 forbids');
  } else {
    pass(
      'F3',
      `window newest=${partial.newestLoadedSeq} < ship head=${head} → partial, carrying no state`
    );
  }

  await store.syncPosts({ channelId, mode: 'newest', count: 50 });
  const caught = await hydrateSurface({ channelId });
  if (caught.status === 'hydrated') {
    pass('F3', 'posts catch up → hydrated');
  } else {
    fail(
      'F3',
      'catch-up',
      `expected hydrated once posts synced, got ${caught.status}`
    );
  }
}

/**
 * F4, first half: on discovery, every surface channel is hushed on the
 * SHIP.
 *
 * The suppression that matters cannot be done client-side. The activity
 * payload carries neither the post's kind nor its blob, the backend has no
 * surface awareness, and the default volume map notifies on `%post` — so
 * left alone every dashboard button tap pushes to every unmuted member.
 * The only place that decision can be unmade is the recipient's own
 * %activity agent, which is what `setChannelVolumeLevel('hush')` reaches.
 *
 * "hush" is not stored as a label: the ship holds the expanded volume map,
 * and hush is the map with `notify: false` on every event type. Read it
 * back through the same decoder the app uses rather than string-matching.
 */
async function runF4Hush(fixtures: SeedFixture[]): Promise<void> {
  // The hush is gated on the ship's "already defaulted" markers having been
  // read into the local mirror: hushing against an empty mirror would
  // re-mute a surface the user unmuted on another device. A real client
  // gets that read from `syncSettings` during boot; the seed has no boot
  // sequence, so it does the same read explicitly. Without it the sweep
  // defers and hushes nothing.
  await store.syncSettings();
  await applySurfaceChannelNotificationDefaults();

  const volumes = await api.getVolumeSettings();

  let hushed = 0;
  for (const fixture of fixtures) {
    const channelId = channelIdOf(fixture);
    const key = Object.keys(volumes ?? {}).find((k) => k.includes(channelId));
    const map = key ? (volumes[key] ?? undefined) : undefined;
    const level = map === undefined ? undefined : getLevelFromVolumeMap(map);
    if (level === 'hush') {
      hushed += 1;
    } else {
      fail(
        fixture.slug,
        'F4 auto-hush',
        map === undefined
          ? 'no volume entry on the ship for this channel'
          : `volume level is ${level}, not hush`
      );
    }
  }
  if (hushed === fixtures.length) {
    pass('F4', `all ${hushed} surface channels hushed on the ship`);
  }

  // the badge half is a client-side filter keyed off the content
  // configuration, which is the only surface signal the client always has
  const surfaceChannels = (await db.getAllChannels()).filter((c) =>
    isSurfaceChannel(c)
  );
  if (surfaceChannels.length >= fixtures.length) {
    pass(
      'F4',
      `${surfaceChannels.length} channels read as surface → excluded from badges`
    );
  } else {
    fail(
      'F4',
      'badge exclusion',
      `only ${surfaceChannels.length} of ${fixtures.length} channels read as surface channels`
    );
  }
}

/**
 * F4, second half: after real interaction, %activity holds no NOTIFYING
 * event for a surface channel.
 *
 * The hush above is the mechanism; this is the outcome, measured after
 * ~ten's invokes have actually landed. Unread counts are expected to be
 * non-zero — hush suppresses notification, not unreads, and badges are
 * excluded client-side — so the assertion is specifically on `notify`.
 */
async function runF4NoNotifications(fixtures: SeedFixture[]): Promise<void> {
  const unreads = await api.getGroupAndChannelUnreads();
  const seeded = new Set(fixtures.map((f) => channelIdOf(f)));
  const notifying = unreads.channelUnreads.filter(
    (unread) => seeded.has(unread.channelId) && unread.notify
  );
  if (notifying.length === 0) {
    pass(
      'F4',
      'no surface channel carries a notifying activity summary after invokes'
    );
  } else {
    fail(
      'F4',
      'notification suppression',
      `${notifying.length} surface channel(s) notify: ` +
        JSON.stringify(notifying.map((u) => u.channelId))
    );
  }
}

/**
 * F2: bump the revision with a byte-identical bundle. What this half can
 * prove headlessly is that the bump lands and that the new revision reads
 * back cleanly; that the OPEN dashboard replaces its session rather than
 * freezing is a browser-side observation, and the checklist says so.
 */
async function runBump(
  fixtures: SeedFixture[],
  bundleOrigin: string
): Promise<void> {
  const fixture = fixtures.find((f) => f.revise);
  if (!fixture?.revise || !fixture.bundle) {
    fail('F2', 'setup', 'no fixture declares a revision');
    return;
  }
  const group = await db.getGroup({ id: GROUP_ID });
  if (!group) {
    fail('F2', 'setup', `${GROUP_ID} is not in the local mirror; seed first`);
    return;
  }

  const before = bundleRef(bundleOrigin, fixture.bundle);
  const channelId = channelIdOf(fixture);

  // Read the revision off the SHIP, not off a constant, so `--bump` is
  // repeatable: every invocation moves the revision forward by one and a
  // human can bump as many times as they like with the page open.
  const previous = await db.getChannel({ id: channelId });
  const previousSpec = readSurfaceSpec(previous?.surfaceSpec ?? null);
  const previousHash =
    previousSpec.status === 'valid' ? previousSpec.spec.bundle.sha256 : null;
  const previousRevision =
    previousSpec.status === 'valid' ? previousSpec.spec.specRevision : 0;
  const revised = fixture.revise(before, previousRevision + 1);

  const { written, readBack } = await writeSpec(
    fixture,
    channelId,
    group,
    revised
  );
  checkByteIdentity(
    `${fixture.slug}@rev${revised.specRevision}`,
    written,
    readBack
  );

  const after = readSurfaceSpec(
    SCDP.rawPersistenceFields(readBack).surfaceSpec
  );
  if (after.status !== 'valid') {
    fail(
      'F2',
      'revision bump',
      `the bumped spec reads back as ${after.status}`
    );
    return;
  }
  if (previousHash !== null && after.spec.bundle.sha256 !== previousHash) {
    fail(
      'F2',
      'unchanged bundle',
      'the bundle hash moved with the revision, so this is not the F2 case'
    );
    return;
  }
  pass(
    'F2',
    `revision ${after.spec.specRevision} with an unchanged bundle (${after.spec.bundle.sha256.slice(0, 12)}…)`
  );
  note(
    `F2 browser half: with the dashboard open, revision ${previousRevision} → ` +
      `${after.spec.specRevision} must remount the sandbox — the new revision ` +
      'number, an empty ping list, and Ping still working.'
  );
}

async function waitForTenMembership(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await store.syncGroups();
    const group = await db.getGroup({ id: GROUP_ID });
    if (group?.currentUserIsMember) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  note(
    '~ten did not report membership within 10s; its invokes may be rejected'
  );
}

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

function report(
  fixtures: SeedFixture[],
  bundleOrigin: string,
  attackerOrigin: string
) {
  console.log('\n=== seeded ===\n');
  console.log(`group:   ${GROUP_ID} (“${GROUP_TITLE}”)`);
  console.log(`bundles: ${bundleOrigin}`);
  console.log(`probe target: ${attackerOrigin}`);
  console.log(`open as ~zod: ${WEB_URLS.zod}/apps/groups/`);
  console.log(`open as ~ten: ${WEB_URLS.ten}/apps/groups/\n`);
  for (const fixture of fixtures) {
    console.log(`  ${fixture.title}`);
    console.log(`    ${channelIdOf(fixture)}`);
  }

  console.log('\n=== result ===\n');
  if (failures.length === 0) {
    console.log(`all checks passed (${notes.length} notes)`);
    return;
  }
  console.log(`${failures.length} failure(s):\n`);
  for (const failure of failures) {
    console.log(`  ✗ [${failure.fixture}] ${failure.what}`);
    console.log(`      ${failure.detail}\n`);
  }
  const byteFailure = failures.some((f) => f.what.includes('BYTE IDENTITY'));
  if (byteFailure) {
    console.log(
      'STOP: the description-cell round trip through %groups is NOT byte\n' +
        'preserving. Do not normalize around this — the client treats the\n' +
        'stored spec as exactly the bytes it wrote.\n'
    );
  }
}

main().catch((error) => {
  console.error('\nseed failed:\n', error);
  process.exit(1);
});

export { bisectByteIdentity };

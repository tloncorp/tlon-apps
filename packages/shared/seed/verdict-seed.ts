/**
 * The verdict run's CLEAN SEED: one fresh group, created for this run and
 * nothing else, with its identities written down so contamination is
 * CHECKABLE afterwards rather than asserted beforehand.
 *
 * ## Why a fresh group
 *
 * 6a.5's Notes-for-6b, item 6: "Both generations in this run landed on boards
 * built hours earlier by the routing verification, which turned half the
 * generation measurement into a revision measurement." Nobody decided that;
 * the run simply reused whatever was in `~zod/surface-seed`, and the reuse was
 * invisible in the numbers. A measurement that shares fixtures with an earlier
 * measurement is not measuring what it says it is.
 *
 * So this makes a group that has never held anything, and writes down its
 * identity plus the identity of everything that was ALREADY on the ship at
 * seed time. That second list is the load-bearing half: "no 6a board is in
 * this run" then becomes a set difference a reader can compute, not a claim
 * they have to take on faith.
 *
 * ## What it does NOT create
 *
 * The four dashboards. Those are the generation phase's output and the bot
 * creates them itself through `tlon surface create` — that call is part of the
 * loop being measured. Seeding them here would hand the loop four apps it did
 * not make and repeat 6a.5's mistake in a new place.
 *
 * ## The burned-name constraint (D50)
 *
 * A channel name is single-use FOREVER on a ship: %channels-server silently
 * no-ops `ca-create` for a nest it already holds, so a re-created name lands
 * half-created — present in %channels, absent from %groups — and cannot be
 * repaired. Group slugs are minted randomly here for the same reason, and this
 * script REFUSES to mint a second one if a run log already exists, so a
 * careless second invocation cannot quietly burn a name and split the run's
 * fixtures across two groups.
 *
 * Usage (from the repo root, with the rube fakeships already up):
 *
 *   pnpm --filter @tloncorp/shared exec vite-node --config seed/vite.config.ts \
 *     seed/verdict-seed.ts
 *
 *   ... --  --new-run          mint a new group even though a run log exists
 *   ... --  --slug <slug>      use this slug instead of minting one
 *   ... --  --out <dir>        where the run log goes
 */
import * as api from '@tloncorp/api';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as db from '../src/db';
import { isSurfaceChannel } from '../src/logic/surfaceChannels';
import * as store from '../src/store';
import {
  SHIPS,
  assertShipReachable,
  connectAs,
  disconnect,
  resetDatabase,
} from './shipClient';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const DEFAULT_OUT = path.join(
  REPO_ROOT,
  'packages',
  'openclaw',
  'dev',
  'surfaces-6a-out',
  'verdict-run'
);

const args = process.argv.slice(2);
const flagValue = (name: string): string | null => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const OUT_DIR = path.resolve(flagValue('--out') ?? DEFAULT_OUT);
const LOG_PATH = path.join(OUT_DIR, 'seed.json');
const NEW_RUN = args.includes('--new-run');

/**
 * A slug nothing has used. Not a timestamp: two invocations in the same second
 * would collide, and a collision here is a permanently burned name rather than
 * an error you can retry.
 */
function mintSlug(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let tail = '';
  for (let i = 0; i < 8; i++) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `verdict-${tail}`;
}

interface ShipCensus {
  ship: string;
  groups: {
    id: string;
    title: string;
    channels: { nest: string; title: string; isSurface: boolean }[];
  }[];
}

/**
 * Everything already on the ship, read from the ship rather than from the
 * client mirror.
 *
 * This is the contamination baseline. It is taken BEFORE the new group is
 * created, so anything in it is by construction not ours, and anything of ours
 * is by construction not in it.
 */
async function censusOf(shipName: string): Promise<ShipCensus> {
  const listing = await api.scry<
    Record<
      string,
      { meta?: { title?: string }; channels?: Record<string, unknown> }
    >
  >({ app: 'groups', path: '/v2/groups' });
  const groups = Object.entries(listing ?? {}).map(([id, group]) => ({
    id,
    title: group?.meta?.title ?? '',
    channels: Object.keys(group?.channels ?? {}).map((nest) => ({
      nest,
      title: '',
      isSurface: false,
    })),
  }));
  return { ship: shipName, groups };
}

/**
 * The census above reads the group listing, which does not carry the content
 * configuration a surface channel is identified by. This second pass reads the
 * client's own mirror after a sync, where `isSurfaceChannel` is the same
 * predicate the app uses — so "which of the pre-existing channels are
 * dashboards" is answered by the app's own definition rather than by a name
 * prefix.
 */
async function annotateSurfaces(census: ShipCensus): Promise<void> {
  await store.syncGroups();
  // Per group, not `getGroups` — that query does not join the channels table,
  // so its rows carry no `channels` at all and every annotation silently reads
  // as "not a dashboard". Which is exactly the shape of failure this whole
  // baseline exists to prevent, so it gets a sentence rather than a fix in
  // passing.
  let annotated = 0;
  for (const group of census.groups) {
    const mirrored = await db.getGroup({
      id: group.id,
      includeUnjoinedChannels: true,
    });
    for (const channel of group.channels) {
      const known = (mirrored?.channels ?? []).find(
        (candidate) => candidate.id === channel.nest
      );
      if (!known) continue;
      channel.title = known.title ?? '';
      channel.isSurface = isSurfaceChannel(known);
      annotated += 1;
    }
  }
  const total = census.groups.reduce((n, g) => n + g.channels.length, 0);
  if (total > 0 && annotated === 0) {
    throw new Error(
      `the contamination baseline listed ${total} channel(s) and could annotate none of them. ` +
        'An unannotated baseline reports zero pre-existing dashboards whether or not there are any, ' +
        'which is worse than no baseline. Fix the mirror read before seeding.'
    );
  }
}

async function main() {
  if (existsSync(LOG_PATH) && !NEW_RUN) {
    const existing = JSON.parse(readFileSync(LOG_PATH, 'utf8')) as {
      group?: { id?: string };
    };
    console.error(
      `A run log already exists at ${LOG_PATH}, naming ${existing.group?.id}.\n\n` +
        'Refusing to mint a second group. Channel and group names are\n' +
        'single-use forever on a ship (D50), so a second seed would burn a\n' +
        "name AND split this run's fixtures across two groups without\n" +
        'anything downstream noticing. Pass --new-run if a genuinely new run\n' +
        'is what you mean; the old log is overwritten, so copy it first if it\n' +
        'still matters.'
    );
    process.exit(1);
  }

  await assertShipReachable(SHIPS.zod);
  await assertShipReachable(SHIPS.ten);

  /* ---- as ~zod: census, then create ------------------------------- */
  resetDatabase();
  await connectAs(SHIPS.zod);
  await store.setupHighPrioritySubscriptions();

  console.log(
    'taking the contamination baseline (everything already on ~zod):'
  );
  const before = await censusOf(SHIPS.zod.name);
  await annotateSurfaces(before);
  const priorSurfaces = before.groups.flatMap((group) =>
    group.channels.filter((c) => c.isSurface).map((c) => c.nest)
  );
  console.log(
    `  ${before.groups.length} group(s), ${priorSurfaces.length} pre-existing dashboard channel(s)`
  );

  const slug = flagValue('--slug') ?? mintSlug();
  const groupId = `${SHIPS.zod.name}/${slug}`;
  if (before.groups.some((group) => group.id === groupId)) {
    console.error(
      `${groupId} already exists on ~zod, so it is not a clean seed. ` +
        'Re-run without --slug to mint a fresh one.'
    );
    process.exit(1);
  }

  console.log(`\ncreating ${groupId}:`);
  await store.createDefaultGroup({
    groupId,
    title: 'Verdict run',
    memberIds: [SHIPS.ten.name],
  });
  await store.syncGroups();
  const group = await db.getGroup({ id: groupId });
  if (!group) {
    throw new Error(`${groupId} did not come back from the ship`);
  }
  const channels = (group.channels ?? []).map((channel) => ({
    nest: channel.id,
    title: channel.title ?? '',
    type: channel.type,
    isSurface: isSurfaceChannel(channel),
    createdBy: 'verdict-seed',
  }));
  for (const channel of channels) {
    console.log(`  ${channel.nest}  ${JSON.stringify(channel.title)}`);
  }

  /* ---- as ~ten: join, so the second member is real ---------------- */
  console.log('\n~ten joins:');
  disconnect();
  resetDatabase();
  await connectAs(SHIPS.ten);
  await store.setupHighPrioritySubscriptions();
  await store.joinGroup({ id: groupId } as db.Group);

  let joined = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    await store.syncGroups();
    const mirrored = await db.getGroup({ id: groupId });
    if (mirrored?.currentUserIsMember) {
      joined = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!joined) {
    throw new Error(
      `~ten did not become a member of ${groupId}. The seed is incomplete; ` +
        'do not run the measurement against a one-member group — every ' +
        '"who has not responded" behaviour needs a second ship to be about.'
    );
  }
  console.log(`  ~ten is a member of ${groupId}`);

  /* ---- the run log ------------------------------------------------ */
  const log = {
    kind: 'verdict-run-clean-seed',
    seededAt: new Date().toISOString(),
    why: 'A fresh group for the verdict run, so no generation lands on a board an earlier run built (6a.5 Notes-for-6b item 6).',
    ships: {
      host: { name: SHIPS.zod.name, url: SHIPS.zod.url },
      member: { name: SHIPS.ten.name, url: SHIPS.ten.url },
    },
    group: {
      id: groupId,
      slug,
      title: 'Verdict run',
      host: SHIPS.zod.name,
      members: [SHIPS.zod.name, SHIPS.ten.name],
    },
    channels,
    dashboards: {
      seeded: [],
      note: 'Empty by design. The four generation-phase dashboards are created by the BOT through `tlon surface create`; that call is part of the loop being measured. Append them here as they are made, so the run log stays the single record of what this group holds.',
    },
    contamination: {
      how: 'Set difference. `priorState` is everything that was on ~zod BEFORE this group existed; anything in it is by construction not part of this run, and anything of this run is by construction not in it. A later reader checks the claim rather than trusting it.',
      priorGroupIds: before.groups.map((g) => g.id),
      priorSurfaceChannels: priorSurfaces,
      priorState: before,
    },
    burnedNameWarning:
      'Channel and group names are single-use forever on a ship (D50): %channels-server silently no-ops a create for a nest it already holds. Do not re-create any name listed here.',
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(LOG_PATH, `${JSON.stringify(log, null, 2)}\n`);

  const readable = [
    '# Verdict run — clean seed',
    '',
    `Seeded ${log.seededAt}`,
    '',
    `- group: **${groupId}** ("Verdict run"), host ${SHIPS.zod.name}, members ${SHIPS.zod.name} + ${SHIPS.ten.name}`,
    ...channels.map(
      (c) => `- channel: \`${c.nest}\` — ${JSON.stringify(c.title)} (${c.type})`
    ),
    '',
    '## Contamination check',
    '',
    `Before this group existed, ~zod held ${before.groups.length} group(s) and`,
    `${priorSurfaces.length} dashboard channel(s). None of them is in this group,`,
    'and this group is in none of them. The full prior listing is in `seed.json`',
    'under `contamination.priorState`, so the claim is a set difference rather',
    'than an assertion.',
    '',
    'Pre-existing dashboard channels (all OFF LIMITS to this run):',
    '',
    ...priorSurfaces.map((nest) => `- \`${nest}\``),
    '',
    '## Dashboards',
    '',
    'None seeded, by design — the bot creates them. Append them here as they',
    'are published.',
    '',
  ].join('\n');
  writeFileSync(path.join(OUT_DIR, 'seed.md'), `${readable}\n`);

  console.log(`\nrun log: ${LOG_PATH}`);
  console.log(`         ${path.join(OUT_DIR, 'seed.md')}`);
  process.exit(0);
}

void main();

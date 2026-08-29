import { StructuredChannelDescriptionPayload as SCDP } from '@tloncorp/api';
import { toClientGroupsV7 } from '@tloncorp/api';
import type * as ub from '@tloncorp/api/urbit/groups';
import { expect, test } from 'vitest';

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { hydrateSurface } from './hydration';

setupDatabaseTestSuite();

/**
 * Convergence on a republished spec: the description cell is authoritative
 * (plan §3), so what a client renders must track the CONTENT of that cell —
 * the payload bytes and the bundle hash. `specRevision` correlates events
 * and snapshots with the spec they targeted (§4.3–4.4, §6); it is not a
 * change signal, so a client that only notices republished specs when the
 * revision moves is wrong in both directions:
 *
 * - it misses a bundle swapped at the same revision (D56, the reported
 *   defect), and
 * - it would keep folding under a revision that no longer governs.
 *
 * Both directions are asserted below, end to end from the wire payload the
 * ship hands `%groups` through to what the renderer would run.
 */

const GROUP = '~zod/dashboards';
const CHANNEL = 'chat/~zod/dashboard';
const SURFACE = 'srf-dash';
const MEMBER = '~ten';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function surfaceSpec({
  specRevision,
  sha256,
}: {
  specRevision: number;
  sha256: string;
}) {
  return {
    version: 1,
    surfaceId: SURFACE,
    specRevision,
    bundle: {
      assetRef: `https://storage.example/${sha256}`,
      sha256,
      size: 512,
      shellVersion: 1,
    },
    initialState: { log: [] },
    actions: {
      // deliberately no `acceptStale`: an invoke stamped with a superseded
      // revision must stop folding once the revision moves
      'log-entry': { ops: [{ op: 'append', path: '/log', value: '$actor' }] },
    },
  };
}

/**
 * A channel's `meta.image` / `meta.cover` as the ship carries them. One wire
 * field feeds two columns: `toClientMeta` routes a `#`-prefixed value into
 * `iconImageColor`/`coverImageColor` and anything else into
 * `iconImage`/`coverImage`.
 */
type ChannelArt = { image?: string; cover?: string };

/** The `%groups` payload for a group holding one surface channel. */
function groupPayload(
  spec: ReturnType<typeof surfaceSpec>,
  art: ChannelArt = {}
) {
  const description = SCDP.encode({
    description: 'Dashboard',
    surfaceSpec: spec as never,
  }) as string;
  return {
    [GROUP]: {
      meta: { title: 'Dashboards', description: '', image: '', cover: '' },
      admissions: { privacy: 'public' },
      seats: {},
      roles: {},
      channels: {
        [CHANNEL]: {
          join: true,
          added: 1,
          readers: [],
          zone: 'default',
          meta: {
            title: 'Dash',
            description,
            image: art.image ?? '',
            cover: art.cover ?? '',
          },
        },
      },
      'active-channels': [CHANNEL],
      sections: {},
      'section-order': [],
    },
  } as unknown as Record<string, ub.GroupV7>;
}

/**
 * One group sync, exactly as the client performs it: the ship's payload
 * through the real extraction and into the persisted channel model.
 */
async function syncGroupFromShip(
  spec: ReturnType<typeof surfaceSpec>,
  art: ChannelArt = {}
) {
  await db.insertGroups({
    groups: toClientGroupsV7(groupPayload(spec, art), true),
  });
}

/** A member invoking `log-entry`, stamped with the revision they saw. */
async function postInvoke(sequenceNum: number, specRevision: number) {
  await db.insertChannelPosts({
    posts: [
      {
        id: `post-${sequenceNum}`,
        type: 'chat',
        channelId: CHANNEL,
        authorId: MEMBER,
        sentAt: sequenceNum * 1000,
        receivedAt: sequenceNum * 1000,
        sequenceNum,
        blob: JSON.stringify([
          {
            type: 'surface-event',
            version: 1,
            surfaceId: SURFACE,
            specRevision,
            mode: 'invoke',
            actionId: 'log-entry',
          },
        ]),
        syncedAt: 0,
      } as db.Post,
    ],
  });
  await db.updateChannel({ id: CHANNEL, lastPostSequenceNum: sequenceNum });
}

test('a republished bundle reaches a client that already holds the channel, at an unchanged spec revision', async () => {
  await syncGroupFromShip(surfaceSpec({ specRevision: 1, sha256: HASH_A }));
  await postInvoke(1, 1);

  const before = await hydrateSurface({ channelId: CHANNEL });
  expect(before.status).toBe('hydrated');
  expect(before.spec?.bundle.sha256).toBe(HASH_A);

  // The bot republishes new bundle bytes into the same cell without moving
  // the revision. The cell's content is what changed, so the cell's content
  // is what the client must notice.
  await syncGroupFromShip(surfaceSpec({ specRevision: 1, sha256: HASH_B }));

  const after = await hydrateSurface({ channelId: CHANNEL });
  expect(after.status).toBe('hydrated');
  expect(after.spec?.bundle.sha256).toBe(HASH_B);
  expect(after.spec?.specRevision).toBe(1);
  // the revision did not move, so the existing invoke still folds
  expect(after.state).toEqual({ log: [MEMBER] });

  // The verbatim payload has to keep up too, not just the extracted spec:
  // every metadata edit rebuilds the description cell from this string
  // (`applyMetadataEdit`), so a stale copy would push the superseded spec
  // back onto the ship the next time anyone renames the channel.
  const stored = await db.getChannel({ id: CHANNEL });
  expect(
    SCDP.surfaceSpec(SCDP.decode(stored?.descriptionPayload))?.bundle.sha256
  ).toBe(HASH_B);
});

test('a republished bundle with a bumped spec revision reaches the client, and the new revision governs the fold', async () => {
  await syncGroupFromShip(surfaceSpec({ specRevision: 1, sha256: HASH_A }));
  await postInvoke(1, 1);

  const before = await hydrateSurface({ channelId: CHANNEL });
  expect(before.status).toBe('hydrated');
  expect(before.spec?.bundle.sha256).toBe(HASH_A);
  expect(before.state).toEqual({ log: [MEMBER] });

  await syncGroupFromShip(surfaceSpec({ specRevision: 2, sha256: HASH_B }));

  const after = await hydrateSurface({ channelId: CHANNEL });
  expect(after.status).toBe('hydrated');
  expect(after.spec?.bundle.sha256).toBe(HASH_B);
  expect(after.spec?.specRevision).toBe(2);
  // revision still means what §4.3 says it means: the revision-1 invoke no
  // longer folds under revision 2, so the fold restarts from initialState
  expect(after.state).toEqual({ log: [] });
});

/**
 * Every channel column the group payload is authoritative for has to move on
 * a re-sync, not just the two the surfaces work happened to need. `%groups`
 * carries the channel's icon and cover in the same `meta` cell as its title
 * and description, so `insertGroups` is the only write that refreshes them on
 * a boot or a full group sync — and a column missing from its conflict-update
 * set is pinned to whatever the row held when it was created (D76).
 *
 * Asserted in both directions. A one-directional check (unset -> set) passes
 * against a writer that can only ever add a colour; the failure an admin
 * actually reports is the second half — clearing or replacing a colour that
 * comes straight back.
 */
test('a channel colour change reaches a client that already holds the channel, in both directions', async () => {
  const spec = surfaceSpec({ specRevision: 1, sha256: HASH_A });

  await syncGroupFromShip(spec, { image: '#112233', cover: '#445566' });
  const initial = await db.getChannel({ id: CHANNEL });
  expect(initial?.iconImageColor).toBe('#112233');
  expect(initial?.coverImageColor).toBe('#445566');

  // Direction 1: an admin picks different colours.
  await syncGroupFromShip(spec, { image: '#aabbcc', cover: '#ddeeff' });
  const recoloured = await db.getChannel({ id: CHANNEL });
  expect(recoloured?.iconImageColor).toBe('#aabbcc');
  expect(recoloured?.coverImageColor).toBe('#ddeeff');

  // Direction 2: an admin replaces the icon colour with an image and drops
  // the cover entirely. Both colour columns must go back to null — the same
  // `meta` field now routes to `iconImage`, so a pinned colour would render
  // underneath an unrelated image forever.
  await syncGroupFromShip(spec, {
    image: 'https://storage.example/icon.png',
    cover: '',
  });
  const cleared = await db.getChannel({ id: CHANNEL });
  expect(cleared?.iconImage).toBe('https://storage.example/icon.png');
  expect(cleared?.iconImageColor).toBeNull();
  expect(cleared?.coverImage).toBeNull();
  expect(cleared?.coverImageColor).toBeNull();
});

/**
 * The complement of the test above, and the reason the exclusion list had to
 * be audited rather than inherited: a full group payload does NOT carry every
 * channel column. `toClientChannel` never populates `addedToGroupAt` (the
 * wire's `added` field is dropped on the floor), so any conflict-update set
 * that names the column writes `excluded.added_to_group_at` — which drizzle
 * emits as a literal `null` for a column absent from the insert values.
 * Listing it therefore does not refresh it; it erases it. `channelActions`
 * re-encodes `added` from this column on the next metadata edit, so an erased
 * value is silently replaced with "now".
 */
test('a group sync preserves channel columns the payload does not carry', async () => {
  const spec = surfaceSpec({ specRevision: 1, sha256: HASH_A });
  await syncGroupFromShip(spec);

  await db.updateChannel({ id: CHANNEL, addedToGroupAt: 1700000000000 });

  await syncGroupFromShip(spec);

  const after = await db.getChannel({ id: CHANNEL });
  expect(after?.addedToGroupAt).toBe(1700000000000);
});

import {
  StructuredChannelDescriptionPayload as SCDP,
  toClientGroups,
} from '@tloncorp/api';
import type * as ub from '@tloncorp/api/urbit/groups';
import { getTableColumns, sql } from 'drizzle-orm';
import { expect, test } from 'vitest';

import groupsResponse from '../test/groups.json';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import { channelConflictExclusions, insertGroups } from './queries';
import { channels as $channels } from './schema';
import type { Channel, Group } from './types';

setupDatabaseTestSuite();

/**
 * `insertGroups` derives its channel conflict-update set from the schema:
 * every column of `channels` is refreshed from the `%groups` payload except
 * the ones named in `channelConflictExclusions`. That inverts the old
 * hand-list's default from opt-in to opt-out, which is only safe while the
 * two sets between them account for the whole table.
 *
 * Adding a column to `channels` and nothing else lands it in the updated set
 * silently. For a column %groups is authoritative for that is the right
 * answer; for a client-local one it is a data-loss bug, and for a column the
 * payload does not carry it is a guaranteed null-out (drizzle emits a literal
 * `null` for absent columns, so `excluded.<col>` is null). This test makes
 * that a decision someone has to make out loud.
 *
 * The classification itself lives in the exclusion list's comments and in the
 * comment above the `onConflictDoUpdate`. This only asserts that one was made.
 */
test('every channels column is classified as group-sync-authoritative or excluded', () => {
  const schemaColumns = Object.keys(getTableColumns($channels)).sort();

  const excluded = [...channelConflictExclusions].sort();
  const updated = schemaColumns.filter(
    (name) => !channelConflictExclusions.includes(name as never)
  );

  // Total coverage: the two sets partition the table.
  expect([...updated, ...excluded].sort()).toEqual(schemaColumns);

  // The exclusion list is only allowed to name real columns — a renamed
  // column must not leave a dead string behind that silently stops excluding
  // anything.
  expect(excluded.filter((name) => !schemaColumns.includes(name))).toEqual([]);

  // Pin the classification itself, so a schema addition surfaces here as a
  // diff to read rather than a set that quietly grew by one.
  expect(updated).toEqual([
    'contentConfiguration',
    'coverImage',
    'coverImageColor',
    'currentUserIsHost',
    'description',
    'descriptionPayload',
    'groupId',
    'iconImage',
    'iconImageColor',
    // `id` is the conflict target, so setting it from `excluded` is a no-op;
    // it is left in the updated set rather than excluded so this list reads
    // as "everything the schema has that isn't deliberately held back".
    'id',
    'surfaceSpec',
    'title',
    'type',
  ]);
});

/**
 * The classification test above asserts a decision was made. This one asserts
 * the decision is RIGHT for the half of it that fails silently.
 *
 * Drizzle's `buildInsertQuery` emits every column of the table and substitutes
 * a literal `null` for any whose value is `undefined`
 * (`sqlite-core/dialect.js`: `colValue === void 0 || (is(colValue, Param) &&
 * colValue.value === void 0)` -> `sql`null``). `excluded.<col>` is therefore
 * that null. Naming a column the payload cannot carry does not refresh it, it
 * ERASES it — and an erase looks exactly like a sync that ran, so nothing
 * anywhere fails. The pre-D77 hand-list named `addedToGroupAt` and
 * `isPendingChannel` and had been nulling both on every boot.
 *
 * Note the predicate is `undefined`, not key absence: `contentConfiguration`
 * is always a KEY on `toClientChannel`'s result and is `undefined` whenever
 * the description carries no configuration, which null-fills identically.
 * "Which columns does the payload carry" therefore has to be asked of values,
 * not of `Object.keys`.
 *
 * So: run the real encoder over a corpus of real wire payloads to learn which
 * columns it is capable of populating; seed a row where all 29 columns hold
 * distinct non-null values; sync; and require every column the encoder can
 * never populate to come back byte-identical. A wrong exclusion stops being a
 * silent erase and becomes this test failing.
 *
 * `packages/shared/src/store/surface/specConvergence.test.ts` has the
 * one-column version of this (`addedToGroupAt`, the reported incident). This
 * is the same assertion over all sixteen.
 *
 * What this deliberately does NOT assert is that a column the encoder CAN
 * populate is preserved when a given payload happens to omit it. For those the
 * null-fill is the intended behaviour: the `meta` cell is a snapshot, so an
 * admin clearing a channel's description sends a payload with no
 * `description`, and the client has to converge on empty rather than pin the
 * old string. "Absent" and "should be null" are the same statement for a
 * snapshot column and opposite statements for a column the encoder drops on
 * the floor — which is exactly why the two cannot be told apart mechanically,
 * and why the exclusion list is a hand-made classification.
 */

/** A `%groups` wire group holding one channel, for widening the corpus. */
function wireGroup(
  id: string,
  channelId: string,
  description: string | null
): Record<string, ub.GroupV11> {
  return {
    [id]: {
      meta: { title: 'Corpus', description: '', image: '', cover: '' },
      admissions: { privacy: 'public' },
      seats: {},
      roles: {},
      channels: {
        [channelId]: {
          join: true,
          added: 1,
          readers: [],
          zone: 'default',
          meta: {
            title: 'Corpus channel',
            description,
            image: '#ff0000',
            cover: 'https://storage.example/cover.png',
          },
        },
      },
    },
  } as unknown as Record<string, ub.GroupV11>;
}

/**
 * Every column `toClientChannel` is capable of populating, learned by running
 * the real encoder rather than by reading its source. The corpus is the
 * repo's recorded `%groups` payload plus synthetic groups covering the
 * conditional branches the recording does not reach — chiefly
 * `contentConfiguration`, which no channel in the recording configures.
 */
function encoderCorpus(): Channel[] {
  const groups: Group[] = [
    ...toClientGroups(
      groupsResponse as unknown as Record<string, ub.GroupV11>,
      true
    ),
    ...toClientGroups(
      wireGroup(
        '~zod/corpus-configured',
        'chat/~zod/corpus-configured',
        SCDP.encode({
          description: 'configured',
          channelContentConfiguration: {
            draftInput: 'chat',
            defaultPostContentRenderer: 'chat',
            defaultPostCollectionRenderer: 'chat',
          },
        } as never) as string
      ),
      true
    ),
    ...toClientGroups(
      wireGroup('~zod/corpus-bare', 'chat/~zod/corpus-bare', null),
      true
    ),
  ];
  return groups.flatMap((g) => g.channels ?? []);
}

/**
 * `Channel` is the drizzle INSERT model widened with relations, so its
 * `keyof` admits `members`/`posts`/… — names that are not columns. Index the
 * column map by its own keys instead.
 */
const channelColumns = getTableColumns($channels);
type ChannelColumn = keyof typeof channelColumns;

const columnNames = (Object.keys(channelColumns) as ChannelColumn[]).sort();

/** The storage column name for a TS column name. */
function sqlName(name: ChannelColumn): string {
  return channelColumns[name].name;
}

/** Columns of `channels` the payload holds a defined value for. */
function carriedColumns(channel: Channel): ChannelColumn[] {
  return Object.entries(channel)
    .filter(([name, value]) => name in channelColumns && value !== undefined)
    .map(([name]) => name as ChannelColumn);
}

/**
 * A distinct, non-null storage value per column. Written and read back as raw
 * SQL so the comparison is over what is actually in the row: drizzle's
 * boolean/json/timestamp mapping is bypassed on both sides, which is why an
 * integer column that models a boolean is seeded with a distinct integer
 * rather than 0/1. Non-nullness is the load-bearing property — a column
 * seeded null could not tell "preserved" from "erased" apart.
 */
function seedValue(name: ChannelColumn, index: number): string | number {
  switch (channelColumns[name].dataType) {
    case 'string':
      return `seed:${name}`;
    // stored as text, so it still has to parse — a drizzle-mapped read of the
    // row would throw on a bare marker string
    case 'json':
      return JSON.stringify([`seed:${name}`]);
    default:
      return 1_000_000 + index;
  }
}

test('insertGroups never erases a channel column the group payload cannot carry', async () => {
  const client = getClient()!;

  const everCarried = new Set(encoderCorpus().flatMap(carriedColumns));
  const neverCarried = columnNames.filter((name) => !everCarried.has(name));

  // Anti-vacuity: if the encoder ever grew to carry the whole table, every
  // assertion below would pass over an empty set. Pin the partition so that
  // becomes a diff to read instead of a test that stopped testing.
  expect([...everCarried].sort()).toEqual([
    'contentConfiguration',
    'coverImage',
    'coverImageColor',
    'currentUserIsHost',
    'currentUserIsMember',
    'description',
    'descriptionPayload',
    'groupId',
    'iconImage',
    'iconImageColor',
    'id',
    'surfaceSpec',
    'title',
    'type',
  ]);
  expect(neverCarried).toEqual([
    'addedToGroupAt',
    'contactId',
    'firstUnreadPostId',
    'isDmInvite',
    'isNewMatchedContact',
    'isPendingChannel',
    'lastPostAt',
    'lastPostId',
    'lastPostSequenceNum',
    'lastViewedAt',
    'order',
    'postCount',
    'remoteUpdatedAt',
    'syncedAt',
    'unreadCount',
  ]);

  const group = toClientGroups(
    groupsResponse as unknown as Record<string, ub.GroupV11>,
    true
  ).find((g) => (g.channels?.length ?? 0) > 1)!;
  const target = group.channels![0]!.id;

  await insertGroups({ groups: [group] });

  // Seed every column with a distinct non-null value. `id` and `groupId` keep
  // their real values: `id` is the conflict target, and both are columns the
  // encoder carries, so neither is in the asserted set.
  const assignments = columnNames
    .filter((name) => name !== 'id' && name !== 'groupId')
    .map(
      (name, index) =>
        sql`${sql.identifier(sqlName(name))} = ${seedValue(name, index)}`
    );
  await client.run(
    sql`update channels set ${sql.join(assignments, sql.raw(', '))} where id = ${target}`
  );

  const readRaw = async () =>
    (
      (await client.all(
        sql`select * from channels where id = ${target}`
      )) as Record<string, unknown>[]
    )[0]!;

  // Verify the seed took. A seed that silently failed to populate would leave
  // nulls behind and make the parity assertion unable to express the defect.
  const seeded = await readRaw();
  expect(columnNames.filter((name) => seeded[sqlName(name)] == null)).toEqual(
    []
  );

  await insertGroups({ groups: [group] });

  const after = await readRaw();
  for (const name of neverCarried) {
    const column = sqlName(name);
    expect(
      { [name]: after[column] },
      `insertGroups wrote ${name}, which the %groups payload cannot carry — ` +
        `excluded.${column} is drizzle's null-fill, so this is an erase`
    ).toEqual({ [name]: seeded[column] });
  }

  // `currentUserIsMember` is the one exclusion the rule above cannot protect:
  // the payload DOES carry it, so it is held back for a different reason —
  // `reconcileJoinedGroupChannels` is its single source of truth, and
  // `agentGroupOnboarding` calls `updateChannel` straight after each
  // `insertGroups` precisely because this write must not touch it.
  // It is the one column here whose payload value is a real alternative, so
  // assert against the seed rather than against null.
  expect(after.current_user_is_member).toBe(seeded.current_user_is_member);
  expect(
    group.channels!.find((c) => c.id === target)!.currentUserIsMember
  ).toBe(true);
});

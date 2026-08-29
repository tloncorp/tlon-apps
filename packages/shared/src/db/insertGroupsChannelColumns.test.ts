import { getTableColumns } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { channelConflictExclusions } from './queries';
import { channels as $channels } from './schema';

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

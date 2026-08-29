import * as api from '@tloncorp/api';
import * as $ from 'drizzle-orm';
import { expect, test, vi } from 'vitest';

import { batchEffects } from '../../db/query';
import * as schema from '../../db/schema';
import { getClient, setupDatabaseTestSuite } from '../../test/helpers';
import { handleGroupUpdate } from './sync';

setupDatabaseTestSuite();

// `addChannelToNavSection` events carry both a bare backend zone id
// (`sectionId`) and a prefixed local DB id (`navSectionId =
// `${groupId}-${sectionId}``). The handler must use `navSectionId` for
// every DB write — the FK on `group_nav_section_channels.groupNavSectionId`
// targets `group_nav_sections.id`, which is the prefixed form.
test('addChannelToNavSection writes the prefixed nav-section-id and removes existing dupes', async () => {
  const groupId = '~bus/test-group';
  const channelId = 'chat/~bus/example';
  const defaultNavSectionId = `${groupId}-default`;
  const customNavSectionId = `${groupId}-abc`;

  const client = getClient();
  if (!client) throw new Error('test db client not initialized');

  await client.insert(schema.groups).values({
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: false,
    hostUserId: '~bus',
  });
  await client.insert(schema.groupNavSections).values([
    { id: defaultNavSectionId, sectionId: 'default', groupId },
    { id: customNavSectionId, sectionId: 'abc', groupId },
  ]);
  await client.insert(schema.channels).values({
    id: channelId,
    type: 'chat',
    groupId,
  });
  // Seed the duplicate state we want the handler to clean up.
  await client.insert(schema.groupNavSectionChannels).values([
    {
      groupNavSectionId: defaultNavSectionId,
      channelId,
      channelIndex: 0,
    },
    {
      groupNavSectionId: customNavSectionId,
      channelId,
      channelIndex: 0,
    },
  ]);

  await batchEffects('test:addChannelToNavSection', async (ctx) => {
    await handleGroupUpdate(
      {
        type: 'addChannelToNavSection',
        channelId,
        groupId,
        navSectionId: customNavSectionId,
        sectionId: 'abc',
      },
      ctx
    );
  });

  const allRowsForChannel = await client.query.groupNavSectionChannels.findMany(
    {
      where: $.eq(schema.groupNavSectionChannels.channelId, channelId),
    }
  );

  // Exactly one row for the channel after the dedupe.
  expect(allRowsForChannel).toHaveLength(1);
  // ...and it points at the prefixed nav-section-id, not the bare zone id.
  expect(allRowsForChannel[0]?.groupNavSectionId).toBe(customNavSectionId);

  // Defensive: no row was written under the bare backend zone id.
  const rowsWithBareZoneId =
    await client.query.groupNavSectionChannels.findMany({
      where: $.eq(schema.groupNavSectionChannels.groupNavSectionId, 'abc'),
    });
  expect(rowsWithBareZoneId).toHaveLength(0);
});

// When the channel named by an `addChannelToNavSection` event is already
// persisted in `update.navSectionId`, processing the event must be a no-op
// — including not perturbing the `channelIndex` of any other channels in
// the target section. Without idempotency, replayed subscription events
// repeatedly shift indices via the helper's UPDATE-then-INSERT-onConflict
// pattern and corrupt ordering metadata.
test('addChannelToNavSection is idempotent on replay and does not shift target-section indexes', async () => {
  const groupId = '~bus/test-group';
  const channelA = 'chat/~bus/alpha';
  const channelB = 'chat/~bus/bravo';
  const customNavSectionId = `${groupId}-abc`;

  const client = getClient();
  if (!client) throw new Error('test db client not initialized');

  await client.insert(schema.groups).values({
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: false,
    hostUserId: '~bus',
  });
  await client
    .insert(schema.groupNavSections)
    .values([{ id: customNavSectionId, sectionId: 'abc', groupId }]);
  await client.insert(schema.channels).values([
    { id: channelA, type: 'chat', groupId },
    { id: channelB, type: 'chat', groupId },
  ]);
  // Both channels are already in the target section.
  await client.insert(schema.groupNavSectionChannels).values([
    {
      groupNavSectionId: customNavSectionId,
      channelId: channelA,
      channelIndex: 0,
    },
    {
      groupNavSectionId: customNavSectionId,
      channelId: channelB,
      channelIndex: 1,
    },
  ]);

  const snapshotIndexes = async () => {
    const rows = await client.query.groupNavSectionChannels.findMany({
      where: $.eq(
        schema.groupNavSectionChannels.groupNavSectionId,
        customNavSectionId
      ),
    });
    return Object.fromEntries(
      rows.map((r) => [r.channelId as string, r.channelIndex])
    );
  };

  const before = await snapshotIndexes();
  expect(before).toEqual({ [channelA]: 0, [channelB]: 1 });

  // Process the event twice.
  for (let i = 0; i < 2; i++) {
    await batchEffects(`test:replay-${i}`, async (ctx) => {
      await handleGroupUpdate(
        {
          type: 'addChannelToNavSection',
          channelId: channelA,
          groupId,
          navSectionId: customNavSectionId,
          sectionId: 'abc',
        },
        ctx
      );
    });
  }

  // Membership row count for the target section is stable.
  const targetRowsAfter = await client.query.groupNavSectionChannels.findMany({
    where: $.eq(
      schema.groupNavSectionChannels.groupNavSectionId,
      customNavSectionId
    ),
  });
  expect(targetRowsAfter).toHaveLength(2);

  // No new row was created under the bare backend zone id.
  const rowsWithBareZoneId =
    await client.query.groupNavSectionChannels.findMany({
      where: $.eq(schema.groupNavSectionChannels.groupNavSectionId, 'abc'),
    });
  expect(rowsWithBareZoneId).toHaveLength(0);

  // All target-section channelIndex values are unchanged from the seed.
  const after = await snapshotIndexes();
  expect(after).toEqual(before);
});

// The handler dedups other-section memberships before inserting into the
// target section. Both writes must share a transaction: if the insert
// fails (e.g. the target nav section row hasn't been applied locally yet
// and FK enforcement rejects the insert), the dedup delete must roll back
// so the channel isn't left orphaned in no section.
test('addChannelToNavSection rolls back the dedup delete if the insert fails', async () => {
  const groupId = '~bus/test-group';
  const channelId = 'chat/~bus/example';
  const sectionADbId = `${groupId}-default`;
  const missingSectionDbId = `${groupId}-not-yet-synced`;

  const client = getClient();
  if (!client) throw new Error('test db client not initialized');

  // Enable FK enforcement so the insert against a nonexistent target
  // nav-section row triggers a real FK violation. The migration setup
  // doesn't enable foreign_keys by default; enabling here keeps the
  // toggle scoped to this test.
  client.run($.sql`PRAGMA foreign_keys = ON`);

  await client.insert(schema.groups).values({
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: false,
    hostUserId: '~bus',
  });
  // Only section A exists locally — the event will name a section that
  // hasn't been applied yet.
  await client
    .insert(schema.groupNavSections)
    .values([{ id: sectionADbId, sectionId: 'default', groupId }]);
  await client.insert(schema.channels).values({
    id: channelId,
    type: 'chat',
    groupId,
  });
  await client.insert(schema.groupNavSectionChannels).values([
    {
      groupNavSectionId: sectionADbId,
      channelId,
      channelIndex: 0,
    },
  ]);

  await expect(
    batchEffects('test:rollback-fk', async (ctx) => {
      await handleGroupUpdate(
        {
          type: 'addChannelToNavSection',
          channelId,
          groupId,
          navSectionId: missingSectionDbId,
          sectionId: 'not-yet-synced',
        },
        ctx
      );
    })
  ).rejects.toThrow();

  // The dedup delete was rolled back — the channel still belongs to
  // section A locally instead of being orphaned in no section.
  const rows = await client.query.groupNavSectionChannels.findMany({
    where: $.eq(schema.groupNavSectionChannels.channelId, channelId),
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.groupNavSectionId).toBe(sectionADbId);
});

test('addChannel propagates group sync failures for normal channels', async () => {
  const groupId = '~bus/test-group';
  const channelId = 'chat/~bus/example';

  const client = getClient();
  if (!client) throw new Error('test db client not initialized');

  const getGroup = vi
    .spyOn(api, 'getGroup')
    .mockRejectedValue(new Error('missing v2 group scry'));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  await client.insert(schema.groups).values({
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: false,
    hostUserId: '~bus',
  });

  try {
    await expect(
      batchEffects('test:add-channel-sync-failure', async (ctx) => {
        await handleGroupUpdate(
          {
            type: 'addChannel',
            channel: {
              id: channelId,
              type: 'chat',
              groupId,
              currentUserIsMember: false,
            },
          },
          ctx
        );
      })
    ).rejects.toThrow('missing v2 group scry');
  } finally {
    consoleError.mockRestore();
    getGroup.mockRestore();
  }
});

/**
 * The live metadata-edit path, which nothing else covers. A channel edit
 * arrives as an `r-channel` `edit` fact on `/v1/groups`; the api layer turns
 * it into an `updateChannel` update via the real `toClientChannel`, and the
 * handler writes it with `db.updateChannel`. Everything a surface channel
 * needs rides in the channel's `meta.description` cell — the verbatim
 * `descriptionPayload` and the `surfaceSpec` inside it — so if any link in
 * that chain dropped them, a republished dashboard would only reach clients
 * at their next boot.
 *
 * The raw wire event is fed through `toV1GroupsUpdate` rather than a
 * hand-built `GroupUpdate`, because `toClientChannel` is where the payload
 * would be lost.
 *
 * `api.getGroup` deliberately answers with a channel-less group. The handler
 * follows its write with a forced `syncGroup`, and after the D76 change that
 * re-sync rewrites the same columns (D75) — so a scry that echoed the edit
 * would make this test pass even if `db.updateChannel` wrote nothing. An
 * empty `channels` skips `insertGroups`' channel upsert entirely, leaving the
 * fact-carried write as the only thing that touched the row.
 */
test('an r-channel edit fact carries the description payload and surface spec into the channel row', async () => {
  const groupId = '~bus/test-group';
  const channelId = 'chat/~bus/example';

  const client = getClient();
  if (!client) throw new Error('test db client not initialized');

  const spec = {
    version: 1,
    surfaceId: 'srf-live',
    specRevision: 3,
    bundle: {
      assetRef: 'https://storage.example/live',
      sha256: 'c'.repeat(64),
      size: 128,
      shellVersion: 1,
    },
    initialState: {},
    actions: {},
  };
  const description = api.StructuredChannelDescriptionPayload.encode({
    description: 'Edited dashboard',
    surfaceSpec: spec as never,
  }) as string;

  await client.insert(schema.groups).values({
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: false,
    hostUserId: '~bus',
  });
  // The row as it stood before the edit: an ordinary channel, no payload.
  await client.insert(schema.channels).values({
    id: channelId,
    type: 'chat',
    groupId,
    title: 'Before',
  });

  const getGroup = vi.spyOn(api, 'getGroup').mockResolvedValue({
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: false,
    hostUserId: '~bus',
    channels: [],
  } as unknown as Awaited<ReturnType<typeof api.getGroup>>);
  const getUnreads = vi
    .spyOn(api, 'getGroupAndChannelUnreads')
    .mockResolvedValue({
      channelUnreads: [],
      groupUnreads: [],
      threadActivity: [],
    } as unknown as Awaited<ReturnType<typeof api.getGroupAndChannelUnreads>>);

  try {
    const update = api.toV1GroupsUpdate({
      flag: groupId,
      'r-group': {
        channel: {
          nest: channelId,
          'r-channel': {
            edit: {
              join: true,
              added: 1,
              readers: [],
              zone: 'default',
              meta: {
                title: 'After',
                description,
                image: '#aabbcc',
                cover: '#ddeeff',
              },
            },
          },
        },
      },
    } as never);

    expect(update?.type).toBe('updateChannel');

    await batchEffects('test:r-channel-edit', async (ctx) => {
      await handleGroupUpdate(update!, ctx);
    });
  } finally {
    getUnreads.mockRestore();
    getGroup.mockRestore();
  }

  const rows = await client.query.channels.findMany({
    where: $.eq(schema.channels.id, channelId),
  });
  const row = rows[0];
  expect(row?.title).toBe('After');
  expect(row?.description).toBe('Edited dashboard');
  expect(row?.descriptionPayload).toBe(description);
  expect(
    api.StructuredChannelDescriptionPayload.surfaceSpec(
      api.StructuredChannelDescriptionPayload.decode(row?.descriptionPayload)
    )?.specRevision
  ).toBe(3);
  expect(row?.surfaceSpec).not.toBeNull();
  expect(row?.iconImageColor).toBe('#aabbcc');
  expect(row?.coverImageColor).toBe('#ddeeff');
});

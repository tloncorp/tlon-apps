import * as $ from 'drizzle-orm';
import { expect, test } from 'vitest';

import { batchEffects } from '../../db/query';
import * as schema from '../../db/schema';
import { getClient, setupDatabaseTestSuite } from '../../test/helpers';
import { handleGroupUpdate } from './sync';

setupDatabaseTestSuite();

// Regression test for TLON-5656 follow-up:
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

// Idempotency regression for TLON-5656 second follow-up:
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

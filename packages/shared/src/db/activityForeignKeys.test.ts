import { expect, test } from 'vitest';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import { clearActivityEvents, deleteGroup, insertGroups } from './queries';
import { activityEvents, activityEventContactGroups } from './schema';

setupDatabaseTestSuite();

test('an event can appear in several buckets while group deletion and activity reset clear its pins', async () => {
  const client = getClient()!;
  const group = {
    id: '~nec/activity-group',
    hostUserId: '~nec',
    currentUserIsMember: true,
    currentUserIsHost: true,
  };
  await insertGroups({ groups: [group] });
  await client.insert(activityEvents).values([
    {
      id: 'same-event',
      bucketId: 'all',
      sourceId: 'contact/~nec',
      type: 'post',
      timestamp: 1,
    },
    {
      id: 'same-event',
      bucketId: 'mentions',
      sourceId: 'contact/~nec',
      type: 'post',
      timestamp: 1,
    },
  ]);
  await client
    .insert(activityEventContactGroups)
    .values({ activityEventId: 'same-event', groupId: group.id });
  await deleteGroup(group.id);
  expect(await client.select().from(activityEventContactGroups)).toHaveLength(
    0
  );
  await insertGroups({ groups: [group] });
  await client
    .insert(activityEventContactGroups)
    .values({ activityEventId: 'same-event', groupId: group.id });
  await clearActivityEvents();
  expect(await client.select().from(activityEvents)).toHaveLength(0);
  expect(await client.select().from(activityEventContactGroups)).toHaveLength(
    0
  );
});

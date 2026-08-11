import { beforeEach, expect, it, vi } from 'vitest';

import { fixturePosts } from './contentHelpers';
import { seedCosmosDb } from './cosmosDbSeed';
import { group, groupWithNoColorOrImage } from './fakeData';

const dbSpies = vi.hoisted(() => ({
  insertChannelPosts: vi.fn(async () => undefined),
  insertGroups: vi.fn(async () => undefined),
}));

vi.mock('@tloncorp/shared/db', () => dbSpies);

beforeEach(() => {
  vi.clearAllMocks();
});

it('seeds every group referenced by fixture posts', async () => {
  await seedCosmosDb();

  expect(dbSpies.insertGroups).toHaveBeenCalledWith({
    groups: [group, groupWithNoColorOrImage],
  });
  expect(dbSpies.insertChannelPosts).toHaveBeenCalledWith({
    posts: fixturePosts,
  });
});

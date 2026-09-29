import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getInitData } from '../client/initApi';
import * as urbit from '../client/urbit';
import rawGroupsInit from './fixtures/groupsInit5.json';

vi.mock('../client/urbit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/urbit')>();
  return {
    ...actual,
    scry: vi.fn(),
    getCurrentUserId: () => '~solfer-magfed',
  };
});

const scry = vi.mocked(urbit.scry);
const paths = () => scry.mock.calls.map(([endpoint]) => endpoint.path);

// %groups 12.3.0 shipped without Buckets, and develop carries Buckets at the
// same 12.3.0, so the version alone sends a released ship to a /v11 it does
// not serve. Refused, init must still hydrate.
describe('getInitData on a ship the version wrongly credits with Buckets', () => {
  beforeEach(() => {
    scry.mockReset();
    urbit.setDeskSupportsBuckets(true);
  });

  test('falls back to /v10 and turns Buckets off when /v11 is refused', async () => {
    scry.mockImplementation(async ({ path }) => {
      if (path === '/v11/init') {
        throw new urbit.BadResponseError(404, 'Not Found');
      }
      return rawGroupsInit as never;
    });

    const data = await getInitData();

    expect(paths()).toEqual(['/v11/init', '/v10/init']);
    expect(data.buckets).toEqual([]);
    expect(urbit.getDeskSupportsBuckets()).toBe(false);
  });

  test('uses /v11 alone on a ship that serves it', async () => {
    scry.mockResolvedValue({ ...rawGroupsInit, buckets: [] } as never);

    await getInitData();

    expect(paths()).toEqual(['/v11/init']);
    expect(urbit.getDeskSupportsBuckets()).toBe(true);
  });

  test('asks for /v10 alone when the version says no Buckets', async () => {
    urbit.setDeskSupportsBuckets(false);
    scry.mockResolvedValue(rawGroupsInit as never);

    await getInitData();

    expect(paths()).toEqual(['/v10/init']);
  });

  test('reports the /v11 error when /v10 is refused too', async () => {
    scry.mockImplementation(async ({ path }) => {
      throw new urbit.BadResponseError(path === '/v11/init' ? 502 : 404, path);
    });

    await expect(getInitData()).rejects.toMatchObject({ status: 502 });
  });
});

import {
  DurableClient,
  configureDurableClient,
} from '@tloncorp/api/client/durable';
import type * as db from '@tloncorp/shared/db';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('@tloncorp/shared', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({}));
vi.mock('../contexts/appDataContext', () => ({}));
vi.mock('./user', () => ({}));

import { getChannelActionCapabilities } from './channelUtils';

const bucket = { id: 'buckets/~zod/files', type: 'buckets' } as db.Channel;

afterEach(() => configureDurableClient(undefined as unknown as DurableClient));

test('a bucket can be deleted only where its files go with it', () => {
  expect(getChannelActionCapabilities(bucket).canDelete).toBe(false);
  configureDurableClient(new DurableClient('token'));
  expect(getChannelActionCapabilities(bucket)).toMatchObject({
    canDelete: true,
    canLeave: false,
  });
});

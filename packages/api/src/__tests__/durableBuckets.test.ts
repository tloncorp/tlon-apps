import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  BucketsActionFailed,
  getBucket,
  sendBucketsAction,
} from '../client/bucketsApi';
import { deleteBucketObject, grantBucketRead } from '../client/bucketsBroker';
import { DurableClient, configureDurableClient } from '../client/durable';
import { durableBucketState } from '../client/durableBuckets';

const flag = { host: '~sampel-palnet', name: 'files' };
const channelId = 'buckets/~sampel-palnet/files';

function client() {
  const value = new DurableClient('secret', 'https://slab.test');
  value.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [],
    bot: null,
    revision: 0,
    groups: [],
    rooms: [
      {
        id: 'group-room',
        channelId,
        title: 'Files',
        members: ['brian'],
        groupId: '~sampel-palnet/work',
        kind: 'channel',
      },
    ],
  };
  return value;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  configureDurableClient(client());
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

test('an upload grant is absolute and carries the session', async () => {
  fetchMock.mockResolvedValueOnce(
    reply(200, {
      upload: {
        session: 's',
        entryId: 3,
        url: '/v1/files/upload/t',
        headers: [['Content-Type', 'text/plain']],
        expiresAt: '2026-01-01T00:00:00Z',
      },
    })
  );
  const body = await sendBucketsAction(
    {
      type: 'begin-upload',
      flag,
      parentId: null,
      name: 'a.txt',
      mime: 'text/plain',
      size: 1,
      checksum: null,
    },
    '0vabc'
  );
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://slab.test/v1/rooms/group-room/bucket');
  expect(JSON.parse(init.body)).toEqual({
    action: {
      type: 'begin-upload',
      flag,
      parentId: null,
      name: 'a.txt',
      mime: 'text/plain',
      size: 1,
      checksum: null,
    },
    requestId: '0vabc',
  });
  expect(body).toEqual({
    upload: expect.objectContaining({
      url: 'https://slab.test/v1/files/upload/t',
      headers: [
        ['Content-Type', 'text/plain'],
        ['Authorization', 'Bearer secret'],
      ],
    }),
  });
});

test('refusals arrive as typed bucket failures', async () => {
  fetchMock.mockResolvedValueOnce(reply(403, { error: 'No permission' }));
  const sent = sendBucketsAction({
    type: 'create-folder',
    flag,
    parentId: null,
    name: 'Docs',
  });
  await expect(sent).rejects.toBeInstanceOf(BucketsActionFailed);
  await expect(sent).rejects.toMatchObject({ type: 'not-authorized' });
});

test('reads and object deletes need no storage token', async () => {
  expect(
    await sendBucketsAction({ type: 'issue-bucket-read', flag })
  ).toMatchObject({ token: { token: '' } });
  await deleteBucketObject('', flag.host, '/v1/rooms/r/attachments/a/content');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a snapshot reports admin among restricted writers', async () => {
  fetchMock.mockResolvedValueOnce(
    reply(200, {
      bucket: { id: 1 },
      group: { host: '~sampel-palnet', name: 'work' },
      writers: ['editor'],
      entries: [],
      revision: 4,
    })
  );
  expect(await getBucket(flag)).toMatchObject({
    flag,
    state: { writers: ['admin', 'editor'], revision: 4 },
  });
  fetchMock.mockResolvedValueOnce(reply(404, { error: 'Bucket not found' }));
  expect(await getBucket(flag)).toBeNull();
});

test('a read grant is a download ticket', async () => {
  const path = '/v1/rooms/group-room/attachments/a/content';
  fetchMock.mockResolvedValueOnce(reply(200, { [path]: `${path}?ticket=xyz` }));
  const grant = await grantBucketRead('', flag.host, path, 'a.txt');
  expect(grant.readUrl).toBe(`https://slab.test${path}?ticket=xyz`);
});

test('deleting a bucket is one directory request', async () => {
  const durable = client();
  configureDurableClient(durable);
  const directory = vi
    .spyOn(durable, 'directory')
    .mockResolvedValue({ groupId: 'g' });
  expect(await sendBucketsAction({ type: 'delete-bucket', flag })).toEqual({
    ok: null,
  });
  expect(directory).toHaveBeenCalledWith({
    type: 'deleteChannel',
    groupId: '~sampel-palnet/work',
    channelId,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a read at the current revision comes back unchanged', async () => {
  fetchMock.mockResolvedValueOnce(reply(200, { unchanged: true, revision: 4 }));
  expect(await durableBucketState(client(), channelId, 4)).toBe('unchanged');
  expect(fetchMock.mock.calls[0][0]).toBe(
    'https://slab.test/v1/rooms/group-room/bucket?after=4'
  );
});

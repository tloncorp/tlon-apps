import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  AppDoc,
  createAppChannel,
  deleteAppChannel,
  getAppDoc,
  getAppDocs,
  readAppDocBody,
  writeAppDoc,
} from '../client/appsApi';
import { BadResponseError, poke, scry } from '../client/urbit';

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');

  return {
    ...actual,
    poke: vi.fn(),
    scry: vi.fn(),
    subscribe: vi.fn(),
  };
});

const doc: AppDoc = {
  group: '~zod/house',
  writers: [],
  revision: 3,
  body: '{"meals":["soup"]}',
  applied: ['w3', 'w2'],
  updated: '~2026.8.20',
};

beforeEach(() => {
  vi.mocked(poke).mockReset();
  vi.mocked(scry).mockReset();
});

describe('createAppChannel', () => {
  test('pokes %apps with the create action', async () => {
    await createAppChannel({
      name: 'meals',
      group: '~zod/house',
      title: 'Meals',
      description: 'What we are eating',
      readers: ['member'],
      writers: ['admin'],
      body: '{}',
    });

    expect(poke).toHaveBeenCalledWith({
      app: 'apps',
      mark: 'apps-action-1',
      json: {
        create: {
          name: 'meals',
          group: '~zod/house',
          title: 'Meals',
          description: 'What we are eating',
          readers: ['member'],
          writers: ['admin'],
          body: '{}',
        },
      },
    });
  });

  // The agent's dejs reads these as lists, so they have to be present. Sending
  // them as undefined would drop the keys and fail the whole envelope.
  test('sends empty role lists rather than omitting them', async () => {
    await createAppChannel({
      name: 'meals',
      group: '~zod/house',
      title: 'Meals',
      description: '',
      body: '{}',
    });

    const json = vi.mocked(poke).mock.calls[0]?.[0].json as {
      create: { readers: string[]; writers: string[] };
    };
    expect(json.create.readers).toEqual([]);
    expect(json.create.writers).toEqual([]);
  });
});

describe('writeAppDoc', () => {
  test('carries the id and expected revision', async () => {
    await writeAppDoc({
      flag: '~zod/meals',
      id: 'w4',
      expected: 3,
      body: '{"meals":[]}',
    });

    expect(poke).toHaveBeenCalledWith({
      app: 'apps',
      mark: 'apps-action-1',
      json: {
        write: {
          flag: '~zod/meals',
          id: 'w4',
          expected: 3,
          body: '{"meals":[]}',
        },
      },
    });
  });

  // null is the wire form of a ~ expected revision, which opts into
  // last-write-wins. It has to survive as null rather than becoming undefined,
  // which JSON.stringify would drop.
  test('keeps a null expected revision on the wire', async () => {
    await writeAppDoc({
      flag: '~zod/meals',
      id: 'w4',
      expected: null,
      body: '{}',
    });

    const json = vi.mocked(poke).mock.calls[0]?.[0].json;
    expect(JSON.parse(JSON.stringify(json))).toEqual({
      write: { flag: '~zod/meals', id: 'w4', expected: null, body: '{}' },
    });
  });
});

describe('deleteAppChannel', () => {
  test('pokes %apps with the flag', async () => {
    await deleteAppChannel('~zod/meals');
    expect(poke).toHaveBeenCalledWith({
      app: 'apps',
      mark: 'apps-action-1',
      json: { delete: { flag: '~zod/meals' } },
    });
  });
});

describe('getAppDocs', () => {
  test('unwraps the docs envelope', async () => {
    vi.mocked(scry).mockResolvedValue({ docs: { '~zod/meals': doc } });
    await expect(getAppDocs()).resolves.toEqual({ '~zod/meals': doc });
    expect(scry).toHaveBeenCalledWith({ app: 'apps', path: '/v1/docs' });
  });
});

describe('getAppDoc', () => {
  test('splits the flag into the scry path', async () => {
    vi.mocked(scry).mockResolvedValue({ doc: { flag: '~zod/meals', doc } });
    await expect(getAppDoc('~zod/meals')).resolves.toEqual(doc);
    expect(scry).toHaveBeenCalledWith({
      app: 'apps',
      path: '/v1/doc/~zod/meals',
    });
  });

  // A channel we have lost read access to reads as absent, not as an error, so
  // a 404 is a normal answer here.
  test('returns null on a 404', async () => {
    vi.mocked(scry).mockRejectedValue(new BadResponseError(404, 'not found'));
    await expect(getAppDoc('~zod/meals')).resolves.toBeNull();
  });

  test('rethrows anything else', async () => {
    vi.mocked(scry).mockRejectedValue(new BadResponseError(500, 'boom'));
    await expect(getAppDoc('~zod/meals')).rejects.toThrow(BadResponseError);
  });

  test('rejects a malformed flag before scrying', async () => {
    await expect(getAppDoc('nope')).rejects.toThrow('malformed channel flag');
    expect(scry).not.toHaveBeenCalled();
  });
});

describe('readAppDocBody', () => {
  test('parses a document body', () => {
    expect(readAppDocBody(doc)).toEqual({ meals: ['soup'] });
  });

  // The body is written by whichever kit owns the surface, so a client can
  // legitimately meet one it cannot read. That degrades to null rather than
  // throwing and taking the channel down with it.
  test('returns null for a body it cannot parse', () => {
    expect(readAppDocBody({ ...doc, body: 'not json' })).toBeNull();
  });
});

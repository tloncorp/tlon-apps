import { afterEach, describe, expect, it } from 'bun:test';

import type { RawGroupForAdminVerification } from './commands/groups-verification';
import {
  VERIFY_ATTEMPTS,
  VERIFY_DELAY_MS,
  assertActingShipCanAdminister,
  getGroupHost,
  verifyRawGroupState,
} from './group-admin';
import { mockedScry } from './tloncorp-api-mock';

// The mocked `getCurrentUserId` acts as ~zod.
const FOREIGN = '~bus/team';

function scryReturning(
  responses: Array<RawGroupForAdminVerification | Error>
): { paths: string[] } {
  const calls = { paths: [] as string[] };
  mockedScry.impl = async (...args: unknown[]) => {
    const { app, path } = args[0] as { app: string; path: string };
    calls.paths.push(`${app}${path}`);
    const next = responses[Math.min(calls.paths.length, responses.length) - 1];
    if (next instanceof Error) throw next;
    return structuredClone(next);
  };
  return calls;
}

afterEach(() => {
  mockedScry.impl = async () => undefined;
});

describe('group-admin constants and host', () => {
  it('keeps the shared poll budget', () => {
    expect(VERIFY_ATTEMPTS).toBe(5);
    expect(VERIFY_DELAY_MS).toBe(500);
  });

  it('derives the normalized host from the flag', () => {
    expect(getGroupHost('bus/team')).toBe('~bus');
  });
});

describe('verifyRawGroupState', () => {
  it('returns the first satisfying snapshot, after exactly that many reads', async () => {
    const calls = scryReturning([
      { 'section-order': ['a'] },
      { 'section-order': ['b'] },
      { 'section-order': ['c'], admins: ['third'] },
      { 'section-order': ['c'], admins: ['fourth'] },
    ]);
    const snapshot = await verifyRawGroupState(
      FOREIGN,
      (g) => g['section-order']?.[0] === 'c',
      () => 'unreachable'
    );
    expect(snapshot.admins).toEqual(['third']);
    expect(calls.paths).toEqual(
      Array(3).fill(`groups/v2/ui/groups/${FOREIGN}`)
    );
  });

  it('retries through an intermittent read error', async () => {
    const calls = scryReturning([new Error('scry 500'), { admins: ['x'] }]);
    const snapshot = await verifyRawGroupState(
      FOREIGN,
      (g) => !!g.admins,
      () => 'unreachable'
    );
    expect(snapshot.admins).toEqual(['x']);
    expect(calls.paths).toHaveLength(2);
  });

  it('describes the last snapshot after exhausting every read', async () => {
    const calls = scryReturning([
      { 'section-order': ['a'] },
      { 'section-order': ['last'] },
    ]);
    const message = await verifyRawGroupState(
      FOREIGN,
      () => false,
      (last) => `order is ${last?.['section-order']?.join(',')}`
    ).catch((error: Error) => error.message);
    expect(message).toBe('order is last');
    expect(calls.paths).toHaveLength(VERIFY_ATTEMPTS);
  });

  it('appends the last error when reads keep failing', async () => {
    scryReturning([new Error('scry 503')]);
    const message = await verifyRawGroupState(
      FOREIGN,
      () => true,
      (last) => `no snapshot: ${last === undefined}`
    ).catch((error: Error) => error.message);
    expect(message).toBe('no snapshot: true (last error: Error: scry 503)');
  });
});

describe('assertActingShipCanAdminister', () => {
  it('accepts the host after one read', async () => {
    const calls = scryReturning([{ admins: [], seats: {} }]);
    await assertActingShipCanAdminister('~zod/team', 'kick');
    expect(calls.paths).toEqual(['groups/v2/ui/groups/~zod/team']);
  });

  it('accepts a seat holding a custom admin-marked role on a foreign host', async () => {
    const calls = scryReturning([
      { admins: ['stewards'], seats: { '~zod': { roles: ['stewards'] } } },
    ]);
    await assertActingShipCanAdminister(FOREIGN, 'kick');
    expect(calls.paths).toHaveLength(1);
  });

  it('absorbs a just-granted admin role', async () => {
    const calls = scryReturning([
      { admins: ['admin'], seats: { '~zod': { roles: [] } } },
      { admins: ['admin'], seats: { '~zod': { roles: ['admin'] } } },
    ]);
    await assertActingShipCanAdminister(FOREIGN, 'kick');
    expect(calls.paths).toHaveLength(2);
  });

  it('refuses a literal `admin` role the group does not mark admin', async () => {
    const calls = scryReturning([
      { admins: ['stewards'], seats: { '~zod': { roles: ['admin'] } } },
    ]);
    const message = await assertActingShipCanAdminister(FOREIGN, 'kick').catch(
      (error: Error) => error.message
    );
    expect(message).toBe(
      `Can't kick in ${FOREIGN}: you (~zod) are not an admin of this group. It's hosted by ~bus. Ask the host to grant admin.`
    );
    expect(calls.paths).toHaveLength(VERIFY_ATTEMPTS);
  });

  it('reports an unreadable group', async () => {
    scryReturning([new Error('scry 404')]);
    const message = await assertActingShipCanAdminister(
      FOREIGN,
      'pin posts'
    ).catch((error: Error) => error.message);
    expect(message).toBe(
      `Can't pin posts in ${FOREIGN}: could not read group state: Error: scry 404`
    );
  });
});

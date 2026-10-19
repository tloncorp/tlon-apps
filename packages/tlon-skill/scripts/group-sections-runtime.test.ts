import { afterEach, describe, expect, it } from 'bun:test';

import {
  assertActingShipCanAdminister,
  getRawGroupForAdminVerification,
  verifyRawGroupState,
} from './group-admin';
import { createGroupSectionsDeps } from './group-sections-runtime';
import { mockedPoke } from './tloncorp-api-mock';

afterEach(() => {
  mockedPoke.impl = async () => undefined;
});

describe('createGroupSectionsDeps', () => {
  it('pokes %groups with the group-action-5 mark', async () => {
    const calls: unknown[] = [];
    mockedPoke.impl = async (...args: unknown[]) => {
      calls.push(args[0]);
    };
    const json = { group: { flag: '~zod/team', 'a-group': {} } };
    await createGroupSectionsDeps().pokeGroupAction(json);
    expect(calls).toEqual([{ app: 'groups', mark: 'group-action-5', json }]);
  });

  it('formats indexes as @ud strings', () => {
    const deps = createGroupSectionsDeps();
    expect(deps.formatUd(2)).toBe('2');
    expect(deps.formatUd(1000)).toBe('1.000');
  });

  it('generates section ids the way the app does', () => {
    expect(createGroupSectionsDeps().createSectionId()).toMatch(
      /^z[0-9a-v]{1,5}$/
    );
  });

  it('wires the shared admin and read-back helpers', () => {
    const deps = createGroupSectionsDeps();
    expect(deps.assertCanAdminister).toBe(assertActingShipCanAdminister);
    expect(deps.getRawGroup).toBe(getRawGroupForAdminVerification);
    expect(deps.verify).toBe(verifyRawGroupState);
  });
});

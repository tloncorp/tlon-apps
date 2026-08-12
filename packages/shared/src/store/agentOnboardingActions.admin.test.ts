import { describe, expect, test, vi } from 'vitest';

import { _testing } from './agentOnboardingActions';

const groupWithAgent = (status: 'invited' | 'joined', admin = false) =>
  ({
    members: [
      {
        contactId: '~zod',
        status,
        roles: admin ? [{ roleId: 'admin' }] : [],
      },
    ],
  }) as never;

describe('agent onboarding admin grant', () => {
  test('waits for the agent to join before assigning admin', async () => {
    let joined = false;
    let admin = false;
    const getGroup = vi.fn(async () =>
      groupWithAgent(joined ? 'joined' : 'invited', admin)
    );
    const addMembersToRole = vi.fn(async () => {
      admin = true;
    });
    const wait = vi.fn(async () => {
      joined = true;
    });

    await expect(
      _testing.grantAgentAdmin('~ten/group', '~zod', {
        delays: [0, 1],
        timeoutMs: 100,
        sleep: wait,
        getGroup: getGroup as never,
        addMembersToRole: addMembersToRole as never,
      })
    ).resolves.toBeUndefined();

    expect(wait).toHaveBeenCalledOnce();
    expect(addMembersToRole).toHaveBeenCalledOnce();
    expect(addMembersToRole).toHaveBeenCalledWith({
      groupId: '~ten/group',
      roleId: 'admin',
      ships: ['~zod'],
    });
  });

  test('accepts a grant whose response was lost once remote state verifies it', async () => {
    let admin = false;
    const getGroup = vi.fn(async () => groupWithAgent('joined', admin));
    const addMembersToRole = vi.fn(async () => {
      admin = true;
      throw new Error('response lost');
    });

    await expect(
      _testing.grantAgentAdmin('~ten/group', '~zod', {
        delays: [0],
        timeoutMs: 100,
        getGroup: getGroup as never,
        addMembersToRole: addMembersToRole as never,
      })
    ).resolves.toBeUndefined();

    expect(addMembersToRole).toHaveBeenCalledOnce();
    expect(getGroup).toHaveBeenCalledTimes(2);
  });
});

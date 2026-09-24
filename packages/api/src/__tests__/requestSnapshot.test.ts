import {
  type Mock,
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import * as groupsApi from '../client/groupsApi';
import * as urbit from '../client/urbit';
import { ThreadResponseBodyError } from '../http-api';
import type * as db from '../types/models';

// Wire-level neutrality for request migrations. Every migrated call goes
// through these wrappers, so what they receive is what reaches the ship: the
// snapshot pins app, path, mark, payload and options for each request a
// module makes. A migration must leave it unchanged.

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');
  return {
    ...actual,
    scry: vi.fn(),
    scryNoun: vi.fn(),
    poke: vi.fn(),
    pokeNoun: vi.fn(),
    trackedPoke: vi.fn(),
    trackedPokeNoun: vi.fn(),
    subscribe: vi.fn(),
    subscribeOnce: vi.fn(),
    thread: vi.fn(),
    requestJson: vi.fn(),
    request: vi.fn(),
  };
});

const WRAPPERS = [
  'scry',
  'scryNoun',
  'poke',
  'pokeNoun',
  'trackedPoke',
  'trackedPokeNoun',
  'subscribe',
  'subscribeOnce',
  'thread',
  'requestJson',
  'request',
] as const;

function wrapperCalls() {
  const calls: Record<string, unknown[][]> = {};
  for (const name of WRAPPERS) {
    const mock = urbit[name] as unknown as Mock;
    if (mock.mock.calls.length) {
      calls[name] = mock.mock.calls;
    }
    mock.mockClear();
  }
  return calls;
}

// Only the arguments matter; the functions may fail on the mocked results.
async function capture(run: () => unknown) {
  try {
    await run();
  } catch {
    // ignored
  }
  return wrapperCalls();
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

const groupId = '~zod/test-group';
const channelId = 'chat/~zod/test-channel';
const contactIds = ['~bus', '~ten'];
const meta = { title: 't', description: 'd', image: 'i', cover: 'c' };
const navSection: db.GroupNavSection = {
  id: 'section-row',
  sectionId: 'section-1',
  groupId,
  title: 'Section',
  description: 'about',
  iconImage: 'icon',
  coverImage: 'cover',
  coverImageColor: null,
  sectionIndex: 0,
  channels: [
    { channelId: 'chat/~zod/b', channelIndex: 1, groupNavSectionId: 's' },
    { channelId: 'chat/~zod/a', channelIndex: 0, groupNavSectionId: 's' },
  ],
} as unknown as db.GroupNavSection;
const group = {
  id: groupId,
  title: 'Title',
  iconImage: 'icon',
  channels: [
    { id: channelId, title: 'Channel', description: 'desc' },
  ] as db.Channel[],
} as db.Group;

describe('groupsApi', () => {
  const cases: [string, () => unknown][] = [
    ['getPinnedItems', () => groupsApi.getPinnedItems()],
    [
      'acceptGroupJoin',
      () => groupsApi.acceptGroupJoin({ groupId, contactIds }),
    ],
    [
      'rejectGroupJoin',
      () => groupsApi.rejectGroupJoin({ groupId, contactIds }),
    ],
    ['cancelGroupJoin', () => groupsApi.cancelGroupJoin(groupId)],
    [
      'inviteGroupMembers',
      () => groupsApi.inviteGroupMembers({ groupId, contactIds }),
    ],
    [
      'revokeGroupMemberInvites',
      () => groupsApi.revokeGroupMemberInvites({ groupId, contactIds }),
    ],
    [
      'rescindGroupInvitationRequest',
      () => groupsApi.rescindGroupInvitationRequest(groupId),
    ],
    [
      'kickUsersFromGroup',
      () => groupsApi.kickUsersFromGroup({ groupId, contactIds }),
    ],
    [
      'banUsersFromGroup',
      () => groupsApi.banUsersFromGroup({ groupId, contactIds }),
    ],
    [
      'unbanUsersFromGroup',
      () => groupsApi.unbanUsersFromGroup({ groupId, contactIds }),
    ],
    ['leaveGroup', () => groupsApi.leaveGroup(groupId)],
    ['requestGroupInvitation', () => groupsApi.requestGroupInvitation(groupId)],
    [
      'updateGroupPrivacy',
      () =>
        groupsApi.updateGroupPrivacy({
          groupId,
          oldPrivacy: 'public',
          newPrivacy: 'secret',
        }),
    ],
    ['unpinItem', () => groupsApi.unpinItem(groupId)],
    ['pinItem', () => groupsApi.pinItem(channelId)],
    [
      'setPinnedItemOrder',
      () => groupsApi.setPinnedItemOrder([groupId, channelId]),
    ],
    ['getChannelPreview', () => groupsApi.getChannelPreview(channelId)],
    ['getGroupPreview', () => groupsApi.getGroupPreview(groupId)],
    ['findGroupsHostedBy', () => groupsApi.findGroupsHostedBy('~zod')],
    [
      'createGroup',
      () =>
        groupsApi.createGroup({
          group,
          memberIds: contactIds,
          placeHolderTitle: 'p',
        }),
    ],
    [
      'createGroup recovers a lost response via scry',
      () => {
        (urbit.thread as unknown as Mock).mockRejectedValueOnce(
          new ThreadResponseBodyError(new Error('stalled'))
        );
        return groupsApi.createGroup({
          group: { ...group, title: '' } as db.Group,
        });
      },
    ],
    ['getGroup', () => groupsApi.getGroup(groupId)],
    ['getGroups', () => groupsApi.getGroups()],
    ['updateGroupMeta', () => groupsApi.updateGroupMeta({ groupId, meta })],
    [
      'updateGroupBlob',
      () => groupsApi.updateGroupBlob({ groupId, blob: '{"a":1}' }),
    ],
    ['deleteGroup', () => groupsApi.deleteGroup(groupId)],
    ['addNavSection', () => groupsApi.addNavSection({ groupId, navSection })],
    [
      'deleteNavSection',
      () => groupsApi.deleteNavSection({ groupId, sectionId: 'section-1' }),
    ],
    [
      'updateNavSection',
      () => groupsApi.updateNavSection({ groupId, navSection }),
    ],
    [
      'addChannelToNavSection',
      () =>
        groupsApi.addChannelToNavSection({
          groupId,
          navSectionId: 'section-1',
          channelId,
        }),
    ],
    [
      'addChannelListingToGroup',
      () =>
        groupsApi.addChannelListingToGroup({
          channelId,
          groupId,
          sectionId: 'default',
          meta,
        }),
    ],
    [
      'addChannelListingToGroup with readers and join',
      () =>
        groupsApi.addChannelListingToGroup({
          channelId,
          groupId,
          sectionId: 'default',
          meta,
          readers: ['admin'],
          join: true,
        }),
    ],
    [
      'addChannelToGroup',
      () =>
        groupsApi.addChannelToGroup({
          channelId,
          groupId,
          sectionId: 'default',
        }),
    ],
    [
      'updateChannel',
      () =>
        groupsApi.updateChannel({
          groupId,
          channelId,
          channel: {
            added: 1,
            meta,
            section: 'default',
            readers: [],
            join: false,
          } as never,
        }),
    ],
    ['deleteChannel', () => groupsApi.deleteChannel({ groupId, channelId })],
    [
      'updateGroupNavigation',
      () =>
        groupsApi.updateGroupNavigation({
          groupId,
          navSections: [
            { ...navSection, sectionId: 'second', sectionIndex: 1 },
            navSection,
          ],
        }),
    ],
    [
      'addGroupRole',
      () =>
        groupsApi.addGroupRole({
          groupId,
          roleId: 'admin',
          meta: { title: 'A' },
        }),
    ],
    [
      'deleteGroupRole',
      () => groupsApi.deleteGroupRole({ groupId, roleId: 'admin' }),
    ],
    [
      'updateGroupRole',
      () =>
        groupsApi.updateGroupRole({
          groupId,
          roleId: 'admin',
          meta: { title: 'A', description: 'B' },
        }),
    ],
    [
      'addMembersToRole',
      () =>
        groupsApi.addMembersToRole({
          groupId,
          roleId: 'admin',
          ships: contactIds,
        }),
    ],
    [
      'removeMembersFromRole',
      () =>
        groupsApi.removeMembersFromRole({
          groupId,
          roleId: 'admin',
          ships: contactIds,
        }),
    ],
    [
      'removeAllRolesFromMembers',
      () =>
        groupsApi.removeAllRolesFromMembers({
          groupId,
          contactIds,
          roleIds: ['admin', 'member'],
        }),
    ],
    ['subscribeGroups', () => groupsApi.subscribeGroups(() => {})],
    ['joinGroup', () => groupsApi.joinGroup(groupId)],
    ['rejectGroupInvitation', () => groupsApi.rejectGroupInvitation(groupId)],
  ];

  test.each(cases)('%s', async (_name, run) => {
    expect(await capture(run)).toMatchSnapshot();
  });
});

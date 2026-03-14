import { describe, expect, test } from 'vitest';

import {
  buildAddRoleParamsFromRoleSelection,
  getRoleSelectionSaveAction,
  withCreatedRoleSelection,
} from './roleSelectionNavigation';

describe('role selection routing', () => {
  test('builds add-role params that preserve the return destination', () => {
    expect(
      buildAddRoleParamsFromRoleSelection({
        groupId: 'group-1',
        selectedRoleIds: ['admin'],
        returnScreen: 'ChannelInfo',
        returnParams: {
          chatType: 'channel',
          chatId: 'chan-1',
          groupId: 'group-1',
        },
      })
    ).toEqual({
      groupId: 'group-1',
      returnScreen: 'SelectChannelRoles',
      returnParams: {
        groupId: 'group-1',
        selectedRoleIds: ['admin'],
        returnScreen: 'ChannelInfo',
        returnParams: {
          chatType: 'channel',
          chatId: 'chan-1',
          groupId: 'group-1',
        },
      },
    });
  });

  test('applies created role metadata to selector params', () => {
    expect(
      withCreatedRoleSelection(
        {
          groupId: 'group-1',
          selectedRoleIds: ['admin'],
          returnScreen: 'ChannelInfo',
          returnParams: {
            chatType: 'channel',
            chatId: 'chan-1',
            groupId: 'group-1',
          },
        },
        'writer',
        'Writer'
      )
    ).toEqual({
      groupId: 'group-1',
      selectedRoleIds: ['admin'],
      createdRoleId: 'writer',
      createdRoleTitle: 'Writer',
      returnScreen: 'ChannelInfo',
      returnParams: {
        chatType: 'channel',
        chatId: 'chan-1',
        groupId: 'group-1',
      },
    });
  });

  test('creates a save action for chat details with admin ensured', () => {
    expect(
      getRoleSelectionSaveAction(
        {
          groupId: 'group-1',
          selectedRoleIds: ['writer'],
          createdRoleId: 'writer',
          createdRoleTitle: 'Writer',
          returnScreen: 'ChatDetails',
          returnParams: {
            chatType: 'channel',
            chatId: 'chan-1',
            groupId: 'group-1',
          },
        },
        ['writer']
      )
    ).toEqual({
      type: 'NAVIGATE',
      payload: {
        name: 'ChatDetails',
        params: {
          chatType: 'channel',
          chatId: 'chan-1',
          groupId: 'group-1',
          selectedRoleIds: ['admin', 'writer'],
          createdRoleId: 'writer',
          createdRoleTitle: 'Writer',
        },
      },
    });
  });
});

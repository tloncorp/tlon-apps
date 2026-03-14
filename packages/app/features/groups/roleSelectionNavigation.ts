import type {
  GroupSettingsStackParamList,
  SelectChannelRolesParams,
} from '../../navigation/types';
import { ensureAdminRole } from '../../ui/components/ManageChannels/channelFormUtils';

const createNavigateAction = <TParams>(
  name: string,
  params: TParams
): {
  type: 'NAVIGATE';
  payload: {
    name: string;
    params: TParams;
  };
} => ({
  type: 'NAVIGATE',
  payload: {
    name,
    params,
  },
});

export const buildSelectChannelRolesParams = (
  params: SelectChannelRolesParams
): SelectChannelRolesParams => params;

export function buildAddRoleParamsFromRoleSelection(
  params: SelectChannelRolesParams,
  selectedRoleIds = params.selectedRoleIds
): GroupSettingsStackParamList['AddRole'] {
  return {
    groupId: params.groupId,
    returnScreen: 'SelectChannelRoles',
    returnParams: buildSelectChannelRolesParams({
      ...params,
      selectedRoleIds,
    }),
  };
}

export const withCreatedRoleSelection = (
  params: SelectChannelRolesParams,
  createdRoleId: string,
  createdRoleTitle: string
): SelectChannelRolesParams => ({
  ...params,
  createdRoleId,
  createdRoleTitle,
});

export const getRoleSelectionSaveAction = (
  params: SelectChannelRolesParams,
  selectedRoleIds: string[]
) => {
  const finalRoleIds = ensureAdminRole(selectedRoleIds);

  switch (params.returnScreen) {
    case 'CreateChannelPermissions':
      return createNavigateAction(params.returnScreen, {
        ...params.returnParams,
        selectedRoleIds: finalRoleIds,
      });
    case 'EditChannelPrivacy':
      return createNavigateAction(params.returnScreen, {
        ...params.returnParams,
        selectedRoleIds: finalRoleIds,
      });
    case 'ChannelInfo':
      return createNavigateAction(params.returnScreen, {
        ...params.returnParams,
        selectedRoleIds: finalRoleIds,
        createdRoleId: params.createdRoleId,
        createdRoleTitle: params.createdRoleTitle,
      });
    case 'ChatDetails':
      return createNavigateAction(params.returnScreen, {
        ...params.returnParams,
        selectedRoleIds: finalRoleIds,
        createdRoleId: params.createdRoleId,
        createdRoleTitle: params.createdRoleTitle,
      });
  }
}

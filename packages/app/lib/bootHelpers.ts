import { AnalyticsEvent, AppInvite, createDevLogger } from '@tloncorp/shared';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as hostingApi from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';

import { trackOnboardingAction } from '../utils/posthog';

const logger = createDevLogger('bootHelpers', true);

export default {
  reserveNode,
  checkNodeBooted,
  getInvitedGroupAndDm,
};

export async function reserveNode(
  hostingUserId: string,
  skipShipIds: string[] = []
): Promise<string> {
  const user = await hostingApi.getHostingUser(hostingUserId);

  // if the hosting user already has a ship tied to their account, use that
  if (user.ships?.length) {
    await db.hostedUserNodeId.setValue(user.ships[0]);
    return user.ships[0];
  }

  // otherwise reserve a new ship
  const ships = await hostingApi.getReservableShips(hostingUserId);
  const ship = ships.find(
    ({ id, readyForDistribution }) =>
      !skipShipIds.includes(id) && readyForDistribution
  );
  if (!ship) {
    throw new Error('No available ships found.');
  }

  const { reservedBy } = await hostingApi.reserveShip(hostingUserId, ship.id);
  if (reservedBy !== hostingUserId) {
    return reserveNode(hostingUserId, [ship.id]);
  }

  await hostingApi.allocateReservedShip(hostingUserId);
  trackOnboardingAction({
    actionName: 'Urbit ID Selected',
    ship: ship.id,
  });

  await db.hostedUserNodeId.setValue(ship.id);

  return ship.id;
}

export async function checkNodeBooted(): Promise<boolean> {
  try {
    const { status: nodeStatus } = await store.checkHostingNodeStatus();
    return nodeStatus === HostedNodeStatus.Running;
  } catch (e) {
    return false;
  }
}

async function getInvitedGroupAndDm(lureMeta: AppInvite | null): Promise<{
  invitedDm: db.Channel | null;
  tlonTeamDM: db.Channel | null;
  invitedGroup: db.Group | null;
  personalGroup: db.Group | null;
}> {
  if (!lureMeta) {
    throw new Error('no stored invite found, cannot check');
  }
  const { invitedGroupId, inviterUserId, inviteType } = lureMeta;
  const tlonTeam = `~wittyr-witbes`;
  const isPersonalInvite = inviteType === 'user';
  if (!inviterUserId || (!isPersonalInvite && !invitedGroupId)) {
    logger.trackEvent(AnalyticsEvent.InviteError, {
      message: 'invite is missing metadata',
      context:
        'this will prevent the group from being auto-joined, but an invite should still be delivered',
      invite: lureMeta,
    });
    throw new Error('invite is missing metadata');
  }
  // use api client to see if you have pending DM and group invite
  const invitedDm = await db.getChannel({ id: inviterUserId });
  const tlonTeamDM = await db.getChannel({ id: tlonTeam });
  const personalGroup = await db.getPersonalGroup();
  const invitedGroup = isPersonalInvite
    ? null
    : await db.getGroup({ id: invitedGroupId! });

  return { invitedDm, invitedGroup, tlonTeamDM, personalGroup };
}

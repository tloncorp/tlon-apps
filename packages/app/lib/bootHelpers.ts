import { AnalyticsEvent, AppInvite, createDevLogger } from '@tloncorp/shared';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as hostingApi from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';

import { trackOnboardingAction } from '../utils/posthog';

const logger = createDevLogger('bootHelpers', true);

export enum NodeBootPhase {
  IDLE = 1,
  RESERVING = 10,
  BOOTING = 20,
  AUTHENTICATING = 30,
  CONNECTING = 40,
  SCAFFOLDING_WAYFINDING = 50,
  CHECKING_FOR_INVITE = 60,
  ACCEPTING_INVITES = 70,
  READY = 200,
  ERROR = 400,
}

export const BootPhaseExplanations: Record<NodeBootPhase, string> = {
  [NodeBootPhase.IDLE]: 'Waiting to start',
  [NodeBootPhase.RESERVING]: 'Reserving your p2p node',
  [NodeBootPhase.BOOTING]: 'Booting your p2p node',
  [NodeBootPhase.AUTHENTICATING]: 'Authenticating with your node',
  [NodeBootPhase.CONNECTING]: 'Establishing a connection to your node',
  [NodeBootPhase.SCAFFOLDING_WAYFINDING]: 'Setting up your beginner wayfinding',
  [NodeBootPhase.CHECKING_FOR_INVITE]: 'Confirming your invites were received',
  [NodeBootPhase.ACCEPTING_INVITES]:
    'Initializing the conversations you were invited to',
  [NodeBootPhase.READY]: 'Your node is ready',
  [NodeBootPhase.ERROR]: 'Your node errored while initializing',
};

export const BootPhaseNames: Record<NodeBootPhase, string> = {
  [NodeBootPhase.IDLE]: 'Idle',
  [NodeBootPhase.RESERVING]: 'Reserving',
  [NodeBootPhase.BOOTING]: 'Booting',
  [NodeBootPhase.AUTHENTICATING]: 'Authenticating',
  [NodeBootPhase.CONNECTING]: 'Connecting',
  [NodeBootPhase.SCAFFOLDING_WAYFINDING]: 'Scaffolding Wayfinding',
  [NodeBootPhase.CHECKING_FOR_INVITE]: 'Checking for Invites',
  [NodeBootPhase.ACCEPTING_INVITES]: 'Accepting Invites',
  [NodeBootPhase.READY]: 'Ready',
  [NodeBootPhase.ERROR]: 'Error',
};

export default {
  NodeBootPhase,
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
    const nodeStatus = await store.checkHostingNodeStatus();
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

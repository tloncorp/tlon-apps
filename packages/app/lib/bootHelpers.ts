import { getLandscapeAuthCookie } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';

import { LureData } from '../contexts/branch';
import * as hostingApi from '../lib/hostingApi';
import { trackOnboardingAction } from '../utils/posthog';
import { getShipFromCookie, getShipUrl } from '../utils/ship';

export enum NodeBootPhase {
  IDLE = 'idle',
  RESERVING = 'reserving',
  BOOTING = 'booting',
  AUTHENTICATING = 'authenticating',
  CONNECTING = 'connecting',
  CHECKING_FOR_INVITE = 'checking-for-invite',
  ACCEPTING_INVITES = 'accepting-invites',
  READY = 'ready',
  ERROR = 'error',
}

export const BootPhaseExplanations: Record<NodeBootPhase, string> = {
  [NodeBootPhase.IDLE]: 'Waiting to start',
  [NodeBootPhase.RESERVING]: 'Reserving your p2p node',
  [NodeBootPhase.BOOTING]: 'Booting your p2p node',
  [NodeBootPhase.AUTHENTICATING]: 'Authenticating with your node',
  [NodeBootPhase.CONNECTING]: 'Establishing a connection to your node',
  [NodeBootPhase.CHECKING_FOR_INVITE]: 'Confirming your invites were received',
  [NodeBootPhase.ACCEPTING_INVITES]:
    'Initializing the conversations you were invited to',
  [NodeBootPhase.READY]: 'Your node is ready',
  [NodeBootPhase.ERROR]: 'Your node errored while initializing',
};

export default {
  NodeBootPhase,
  reserveNode,
  checkNodeBooted,
  authenticateNode,
  getInvitedGroupAndDm,
};

export async function reserveNode(
  hostingUserId: string,
  skipShipIds: string[] = []
): Promise<string> {
  const user = await hostingApi.getHostingUser(hostingUserId);

  // if the hosting user already has a ship tied to their account, use that
  if (user.ships?.length) {
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

  return ship.id;
}

async function checkNodeBooted(nodeId: string): Promise<boolean> {
  const shipsWithStatus = await hostingApi.getShipsWithStatus([nodeId]);
  if (!shipsWithStatus) {
    return false;
  }

  const { status: shipStatus } = shipsWithStatus;

  if (shipStatus !== 'Ready') {
    return false;
  }

  return true;
}

async function authenticateNode(
  nodeId: string
): Promise<{ nodeId: string; nodeUrl: string; authCookie: string }> {
  const { code: accessCode } = await hostingApi.getShipAccessCode(nodeId);
  const nodeUrl = getShipUrl(nodeId);
  const authCookie = await getLandscapeAuthCookie(nodeUrl, accessCode);
  if (!authCookie) {
    throw new Error("Couldn't log you into your ship.");
  }

  // TODO: shouldn't this be the same?
  const ship = getShipFromCookie(authCookie);

  return {
    nodeId,
    nodeUrl,
    authCookie,
  };
}

async function getInvitedGroupAndDm(lureMeta: LureData | null): Promise<{
  invitedDm: db.Channel | null;
  tlonTeamDM: db.Channel | null;
  invitedGroup: db.Group | null;
}> {
  if (!lureMeta) {
    throw new Error('no stored invite found, cannot check');
  }
  const { invitedGroupId, inviterUserId } = lureMeta;
  const tlonTeam = `~wittyr-witbes`;
  if (!invitedGroupId || !inviterUserId) {
    throw new Error(
      `invalid invite metadata: group[${invitedGroupId}] inviter[${inviterUserId}]`
    );
  }
  // use api client to see if you have pending DM and group invite
  const invitedDm = await db.getChannel({ id: inviterUserId });
  const tlonTeamDM = await db.getChannel({ id: tlonTeam });
  const invitedGroup = await db.getGroup({ id: invitedGroupId });

  return { invitedDm, invitedGroup, tlonTeamDM };
}

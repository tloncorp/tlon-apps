import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import { withRetry } from '../logic';

const logger = createDevLogger('hostingActions', true);

export enum HostingAccountIssue {
  RequiresVerification = 'RequiresVerification',
  NoAssignedShip = 'NoAssignedShip',
}

export async function logInHostedUser({
  otp,
  email,
  phoneNumber,
}: {
  otp: string;
  email?: string;
  phoneNumber?: string;
}): Promise<HostingAccountIssue | undefined> {
  if (!email && !phoneNumber) {
    throw new Error('Either email or password must be provided');
  }

  logger.log('logging in hosted user', { email, phoneNumber });
  const user = await api.logInHostingUser({
    otp,
    email,
    phoneNumber,
  });

  logger.trackEvent('Authenticated with hosting', { email, phoneNumber });
  db.haveHostedLogin.setValue(true);

  const hasSignedUp = await db.didSignUp.getValue();
  if (!hasSignedUp) {
    logger.trackEvent(AnalyticsEvent.LoggedInBeforeSignup);
  }

  // TODO: check if needs verification

  if (user.ships.length === 0) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'User has no assigned node',
      email,
      phoneNumber,
    });
    return HostingAccountIssue.NoAssignedShip;
  }

  const nodeId = user.ships[0];
  await db.hostedUserNodeId.setValue(nodeId);
  await db.hostedAccountIsInitialized.setValue(true);
}

export async function checkHostingNodeStatus(): Promise<domain.HostedNodeStatus> {
  const nodeId = await db.hostedUserNodeId.getValue();
  if (!nodeId) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to check node status without a node ID',
    });
    throw new Error('Cannot check node status, no node ID found');
  }

  try {
    const nodeStatus = await withRetry(() => api.getNodeStatus(nodeId), {
      numOfAttempts: 5,
    });
    return nodeStatus;
  } catch (e) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Failed to get node status',
      errorMessage: e.message,
      errorStack: e.stack,
    });
    return domain.HostedNodeStatus.Unknown;
  }
}

export async function authenticateWithReadyNode(): Promise<db.ShipInfo | null> {
  const nodeId = await db.hostedUserNodeId.getValue();
  if (!nodeId) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to authenticate but missing node ID',
    });
    throw new Error('Cannot check node status, no node ID found');
  }

  let accessCode = null;
  try {
    const result = await api.getShipAccessCode(nodeId);
    accessCode = result.code;
  } catch (e) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Failed to get access code',
      errorMessage: e.message,
      errorStack: e.stack,
    });
    return null;
  }

  const nodeUrl = logic.getShipUrl(nodeId);
  let authCookie = null;
  try {
    authCookie = await api.getLandscapeAuthCookie(nodeUrl, accessCode);
  } catch (e) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Failed to get Landscape auth cookie',
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }

  if (authCookie) {
    return {
      ship: nodeId,
      shipUrl: nodeUrl,
      authCookie,
      authType: 'hosted',
    };
  }

  return null;
}

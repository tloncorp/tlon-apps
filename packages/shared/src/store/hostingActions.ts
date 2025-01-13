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
  email,
  phoneNumber,
  otp,
  password,
}: {
  otp?: string;
  password?: string;
  email?: string;
  phoneNumber?: string;
}): Promise<HostingAccountIssue | undefined> {
  if (!email && !phoneNumber) {
    throw new Error('Either email or password must be provided');
  }

  logger.log('logging in hosted user', { email, phoneNumber, otp, password });
  const user = await api.logInHostingUser({
    otp,
    password,
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
    if (nodeStatus === domain.HostedNodeStatus.Running) {
      await db.hostedNodeIsRunning.setValue(true);
    }
    logger.trackEvent(AnalyticsEvent.LoginDebug, {
      context: 'Checked node status',
      nodeId,
      nodeStatus,
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
    const result = await withRetry(() => api.getShipAccessCode(nodeId), {
      numOfAttempts: 5,
    });
    accessCode = result.code;
  } catch (e) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Failed to get access code after 5 attempts',
      errorMessage: e.message,
      errorStack: e.stack,
    });
    return null;
  }

  const nodeUrl = logic.getShipUrl(nodeId);
  let authCookie = null;
  try {
    authCookie = await withRetry(
      () => api.getLandscapeAuthCookie(nodeUrl, accessCode),
      { numOfAttempts: 5 }
    );
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'Failed to get Landscape auth cookie after 5 attempts',
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }

  if (authCookie) {
    logger.trackEvent(AnalyticsEvent.LoginDebug, {
      context: 'Authenticated with node',
      nodeId,
      nodeUrl,
    });
    return {
      ship: nodeId,
      shipUrl: nodeUrl,
      authCookie,
      authType: 'hosted',
    };
  }

  logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
    context: 'Failed to authenticate with ready node',
  });
  return null;
}

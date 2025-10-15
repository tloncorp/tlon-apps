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
  NoInventory = 'NoInventory',
  ManualUpdateRequired = 'ManualUpdateRequired',
}

export async function signUpHostedUser(params: {
  otp: string;
  email?: string;
  phoneNumber?: string;
  inviteId: string;
  priorityToken: string;
  recaptcha: {
    token: string;
    platform: 'ios' | 'android' | 'web' | 'ios_test' | 'android_test';
  };
}): Promise<HostingAccountIssue | undefined> {
  try {
    const user = await api.signUpHostingUser({
      ...params,
      lure: params.inviteId,
      recaptchaToken: params.recaptcha.token,
      platform: params.recaptcha.platform,
    });

    if (user.requirePhoneNumberVerification && !user.phoneNumberVerifiedAt) {
      return HostingAccountIssue.RequiresVerification;
    }
  } catch (err) {
    if (err instanceof api.HostingError) {
      if (err.details.status === 409) {
        // we don't gracefully handle no inventory this far in the flow,
        // but we should track it
        logger.trackEvent('No Available Inventory for Signup', {
          email: params.email,
          phoneNumber: params.phoneNumber,
        });
        return HostingAccountIssue.NoInventory;
      }
    }
    throw err;
  }
}

export async function requestPhoneVerify(phoneNumber: string): Promise<void> {
  const userId = await db.hostingUserId.getValue();
  if (!userId) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to request phone verify without user ID',
    });
    throw new Error('Cannot request phone verify, no user ID found');
  }

  await api.requestPhoneVerify(userId, phoneNumber);
}

export async function checkPhoneVerify(code: string) {
  const userId = await db.hostingUserId.getValue();
  if (!userId) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to check phone verify without user ID',
    });
    throw new Error('Cannot check phone verify, no user ID found');
  }

  await api.checkPhoneVerify(userId, code);
}

export async function checkAccountStatus(): Promise<HostingAccountIssue | null> {
  const userId = await db.hostingUserId.getValue();
  if (!userId) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to account status without user ID',
    });
    throw new Error('Cannot check account status, no user ID found');
  }

  const user = await api.getHostingUser(userId);

  if (user.requirePhoneNumberVerification && !user.phoneNumberVerifiedAt) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'Account requires phone verification',
    });
    return HostingAccountIssue.RequiresVerification;
  }

  if (user.ships.length === 0) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'User has no assigned node',
    });
    return HostingAccountIssue.NoAssignedShip;
  }

  const nodeId = user.ships[0];
  await db.hostedUserNodeId.setValue(nodeId);
  await db.hostedAccountIsInitialized.setValue(true);

  return null;
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

  if (user.requirePhoneNumberVerification && !user.phoneNumberVerifiedAt) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'Account requires phone verification',
    });
    return HostingAccountIssue.RequiresVerification;
  }

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

export async function checkHostingNodeStatus(
  supressStatusLog?: boolean
): Promise<{ status: domain.HostedNodeStatus; isBeingRevived: boolean }> {
  const nodeId = await db.hostedUserNodeId.getValue();
  if (!nodeId) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to check node status without a node ID',
    });
    throw new Error('Cannot check node status, no node ID found');
  }

  try {
    const { status: nodeStatus, isBeingRevived } =
      await api.getNodeStatus(nodeId);
    if (nodeStatus === domain.HostedNodeStatus.Running) {
      await db.hostedNodeIsRunning.setValue(true);
    }

    if (!supressStatusLog) {
      switch (nodeStatus) {
        case domain.HostedNodeStatus.Paused:
        case domain.HostedNodeStatus.Suspended:
          logger.trackEvent(AnalyticsEvent.NodeNotRunning, {
            phase: nodeStatus,
            nodeId,
          });
          break;
        case domain.HostedNodeStatus.UnderMaintenance:
          logger.trackEvent(AnalyticsEvent.NodeUnderMaintenance, { nodeId });
          break;
        default:
          logger.trackEvent(AnalyticsEvent.LoginDebug, {
            context: 'Checked node status',
            nodeId,
            nodeStatus,
          });
      }
    }

    return { status: nodeStatus, isBeingRevived };
  } catch (e) {
    logger.trackError(AnalyticsEvent.LoginDebug, {
      context: 'Failed to get node status',
      errorMessage: e.message,
      errorStack: e.stack,
    });
    return { status: domain.HostedNodeStatus.Unknown, isBeingRevived: false };
  }
}

export async function authenticateWithReadyNode(
  preloadedCode?: string | null
): Promise<db.ShipInfo | null> {
  const nodeId = await db.hostedUserNodeId.getValue();
  if (!nodeId) {
    logger.trackError(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to authenticate but missing node ID',
    });
    throw new Error('Cannot check node status, no node ID found');
  }

  let accessCode = preloadedCode;
  if (!accessCode) {
    try {
      const result = await api.getShipAccessCode(nodeId);
      accessCode = result.code;
    } catch (e) {
      logger.trackError(AnalyticsEvent.LoginDebug, {
        context: 'Failed to get access code',
        errorMessage: e.message,
        errorStack: e.stack,
      });
      return null;
    }
  }

  const nodeUrl = logic.getShipUrl(nodeId);
  let authCookie = null;
  try {
    authCookie = await withRetry(
      () => api.getLandscapeAuthCookie(nodeUrl, accessCode),
      { numOfAttempts: 5 }
    );
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.LoginDebug, {
      context: 'Failed to get Landscape auth cookie',
      errorMessage: e.message,
      errorStack: e.stack,
    });
    return null;
  }

  if (!authCookie) {
    logger.trackEvent(AnalyticsEvent.LoginDebug, {
      context: 'Failed to authenticate with ready node',
    });
    return null;
  }

  logger.trackEvent(AnalyticsEvent.LoginDebug, {
    context: 'Authenticated with node',
    nodeId,
    nodeUrl,
  });

  await db.nodeAccessCode.setValue(accessCode);

  return {
    ship: nodeId,
    shipUrl: nodeUrl,
    authCookie,
    authType: 'hosted',
  };
}

export async function clearShipRevivalStatus() {
  const nodeId = await db.hostedUserNodeId.getValue();
  if (!nodeId) {
    logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
      context: 'Tried to clear revival status without node ID',
    });
    throw new Error('Cannot clear revival status, no node ID found');
  }

  // note: the Hosting api only lets us blindly toggle the revival status,
  // not explicitly clear it
  await api.clearShipRevivalStatus(nodeId);
}

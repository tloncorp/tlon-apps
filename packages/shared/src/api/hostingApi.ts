import { Buffer } from 'buffer';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import {
  AnalyticsEvent,
  HostedShipResponse,
  ReservableShip,
  ReservedShip,
  User,
  getConstants,
} from '../domain';
import { withRetry } from '../logic';

const logger = createDevLogger('hostingApi', false);

interface HostingResponseErrorDetails {
  status: number | null;
  method: string;
  path: string;
  responseText?: string;
}
export class HostingError extends Error {
  details: HostingResponseErrorDetails;
  shouldTrack: boolean;

  constructor(
    message: string,
    details: HostingResponseErrorDetails,
    shouldTrack: boolean = true
  ) {
    super(message);
    this.name = 'HostingError';
    this.details = details;
    this.shouldTrack = shouldTrack;
  }
}

const ALREADY_IN_USE = 409;
const CANNOT_BOOT = 409;
const RATE_LIMITED = 429;
const EXPECTED_ERRORS = [ALREADY_IN_USE, CANNOT_BOOT, RATE_LIMITED];

const MANUAL_UPDATE_REQUIRED_MESSAGE = 'manual update has been requested';

const hostingFetchResponse = async (
  path: string,
  init?: RequestInit
): Promise<Response> => {
  const env = getConstants();
  const fetchInit = {
    ...init,
  };
  if (env.API_AUTH_USERNAME && env.API_AUTH_PASSWORD) {
    fetchInit.headers = {
      Authorization: `Basic ${Buffer.from(
        `${env.API_AUTH_USERNAME}:${env.API_AUTH_PASSWORD}`
      ).toString('base64')}`,
      ...fetchInit.headers,
    };
  }

  if (__DEV__) {
    console.debug('Request:', path);
  }

  const hostingCookie = await db.hostingAuthToken.getValue();
  const modifiedCookie = hostingCookie.replace(' HttpOnly;', '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  const response = await fetch(`${env.API_URL}${path}`, {
    ...fetchInit,
    credentials: 'include',
    signal: controller.signal,
    headers: {
      ...fetchInit.headers,
      Cookie: modifiedCookie,
    },
  });
  clearTimeout(timeoutId);
  return response;
};

const hostingFetch = async <T extends object>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  let response = null;
  try {
    response = await hostingFetchResponse(path, init);
  } catch (e) {
    const hostingErr = new HostingError(
      e.name && e.name === 'AbortError'
        ? 'Request timed out'
        : 'Unknown error occurred',
      {
        method: init?.method ?? 'GET',
        path,
        status: null,
      }
    );
    logger.trackEvent(AnalyticsEvent.UnexpectedHostingError, {
      details: hostingErr.details,
      errorMessage: hostingErr.message,
      errorStack: hostingErr.stack,
    });
    throw hostingErr;
  }

  const responseText = await response.text();
  logger.log('Response:', response.status, responseText);

  let result: { message: string } | T = { message: 'Empty response' };
  try {
    result = JSON.parse(responseText) as { message: string } | T;
  } catch (e) {
    const hostingErr = new HostingError('Failed to parse response', {
      method: init?.method ?? 'GET',
      path,
      status: response.status,
      responseText,
    });
    logger.trackEvent(AnalyticsEvent.UnexpectedHostingError, {
      details: hostingErr.details,
      errorMessage: hostingErr.message,
      errorStack: hostingErr.stack,
    });
    throw hostingErr;
  }

  if (!response.ok) {
    const err = new HostingError(
      'message' in result ? result.message : 'An unknown error has occurred.',
      {
        method: init?.method ?? 'GET',
        path,
        status: response.status,
      }
    );
    const eventId = EXPECTED_ERRORS.includes(err.details.status ?? 0)
      ? AnalyticsEvent.ExpectedHostingError
      : AnalyticsEvent.UnexpectedHostingError;
    logger.trackEvent(eventId, {
      details: err.details,
      errorMessage: err.message,
      errorStack: err.stack,
    });
    throw err;
  }

  return result as T;
};

const rawHostingFetch = async (path: string, init?: RequestInit) => {
  const response = await hostingFetchResponse(path, init);
  return response;
};

export type HostingHeartBeatCode = 'expired' | 'ok' | 'unknown';
export const getHostingHeartBeat = async (): Promise<HostingHeartBeatCode> => {
  const userId = await db.hostingUserId.getValue();
  const response = await rawHostingFetch(`/v1/users/${userId}`);

  // 401 indicates that the authentication token is expired.
  if (response.status === 401) {
    return 'expired';
  }

  // if we get a response in the 2xx range, we know it's definitely still valid
  if (response.status >= 200 && response.status < 300) {
    return 'ok';
  }

  return 'unknown';
};

export const getHostingAvailability = async (params: {
  email?: string;
  lure?: string;
  priorityToken?: string;
}) =>
  hostingFetch<{
    enabled: boolean;
    validEmail: boolean;
  }>(`/v1/sign-up?${new URLSearchParams(params)}`);

export const addUserToWaitlist = async ({
  email,
  lure,
}: {
  email: string;
  lure?: string;
}) =>
  hostingFetch<object>(
    `/v1/users/add-to-waitlist${lure ? `?lure=${lure}` : ''}`,
    {
      method: 'POST',
      body: JSON.stringify(email),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

export const signUpHostingUser = async (params: {
  phoneNumber?: string;
  otp?: string;
  email?: string;
  password?: string;
  lure?: string;
  priorityToken?: string;
  recaptchaToken?: string;
  platform?: 'ios' | 'android' | 'web' | 'ios_test' | 'android_test';
}) => {
  const response = await hostingFetchResponse('/v1/sign-up', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber: params.phoneNumber,
      otp: params.otp,
      email: params.email,
      password: params.password,
      lure: params.lure,
      priorityToken: params.priorityToken,
      recaptcha: {
        recaptchaToken: { token: params.recaptchaToken || '' },
        recaptchaPlatform: params.platform,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    const hostingErr = new HostingError(message, {
      status: response.status,
      method: 'POST',
      path: '/v1/sign-up',
    });
    throw hostingErr;
  }

  const result = (await response.json()) as HostingError | User;

  const setCookie = response.headers.get('Set-Cookie');
  if (setCookie) {
    db.hostingAuthToken.setValue(setCookie);
  }

  const userId = 'id' in result && (result as User).id;
  if (userId) {
    db.hostingUserId.setValue(userId);
  }

  return result as User;
};

export const logInHostingUser = async (params: {
  email?: string;
  phoneNumber?: string;
  otp?: string;
  password?: string;
}) => {
  const response = await hostingFetchResponse('/v1/login', {
    method: 'POST',
    body: JSON.stringify(params),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = (await response.json()) as HostingError | User;
  if (!response.ok) {
    throw new HostingError(
      'message' in result ? result.message : 'An unknown error has occurred.',
      { status: response.status, method: 'POST', path: '/v1/login' }
    );
  }

  const setCookie = response.headers.get('Set-Cookie');
  const user = 'id' in result && (result as User).id;
  if (setCookie) {
    db.hostingAuthToken.setValue(setCookie);
  }

  if (user) {
    db.hostingUserId.setValue(user);
  }

  return result as User;
};

export const getHostingUser = async (userId: string) => {
  const hostingUser = await hostingFetch<User>(`/v1/users/${userId}`);
  return hostingUser;
};

export const requestPhoneVerify = async (userId: string, phoneNumber: string) =>
  hostingFetch<object>(`/v1/users/${userId}/request-phone-verify`, {
    method: 'POST',
    body: JSON.stringify(phoneNumber),
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const requestSignupOtp = async ({
  email,
  phoneNumber,
  recaptchaToken,
  platform,
}: {
  email?: string;
  phoneNumber?: string;
  recaptchaToken?: string;
  platform?: 'ios' | 'android' | 'web' | 'ios_test' | 'android_test';
}) => {
  try {
    await hostingFetch('/v1/request-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        phoneNumber,
        otpMode: 'SignupOTP',
        recaptcha: {
          recaptchaToken: { token: recaptchaToken || '' },
          recaptchaPlatform: platform,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    if (err instanceof HostingError) {
      const status = err.details.status;
      if (status === ALREADY_IN_USE) {
        logger.trackEvent('Signup Creds Already In Use', {
          email,
          phoneNumber,
        });
      } else if (status === RATE_LIMITED) {
        logger.trackEvent('Signup OTP Rate Limited', { email, phoneNumber });
      } else {
        logger.trackEvent(AnalyticsEvent.FailedSignupOTP, {
          details: err.details,
          errorMessage: err.message,
          email,
          phoneNumber,
        });
      }
    }
    throw err;
  }
};

export const requestLoginOtp = async ({
  phoneNumber,
  email,
  recaptchaToken,
  platform,
}: {
  phoneNumber?: string;
  email?: string;
  recaptchaToken: string;
  platform: 'ios' | 'android' | 'web' | 'ios_test' | 'android_test';
}) => {
  if (!phoneNumber && !email) {
    throw new Error('Either phone number or email must be provided');
  }

  const response = await rawHostingFetch('/v1/request-otp', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber,
      email,
      otpMode: 'LoginOTP',
      recaptcha: {
        recaptchaToken: { token: recaptchaToken || '' },
        recaptchaPlatform: platform,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const WAIT_TO_RESEND = 429;
    const hostingError = new HostingError(
      'Failed to send login OTP',
      { status: response.status, method: 'POST', path: '/v1/request-otp' },
      [WAIT_TO_RESEND].includes(response.status)
    );

    if (hostingError.shouldTrack) {
      logger.trackError(AnalyticsEvent.FailedLoginOTP, {
        status: response.status,
      });
    }

    throw hostingError;
  }
};

export const checkPhoneVerify = async (userId: string, code: string) =>
  hostingFetch<object>(`/v1/users/${userId}/check-phone-verify`, {
    method: 'POST',
    body: JSON.stringify(code),
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const verifyEmailDigits = async (email: string, digits: string) =>
  hostingFetch<object>(`/v1/verify-email-digits/${email}/${digits}`);

export const getReservableShips = async (user: string) =>
  hostingFetch<ReservableShip[]>(`/v1/users/${user}/reservable-ships`);

export const reserveShip = async (userId: string, ship: string) =>
  hostingFetch<ReservedShip>(`/v1/users/${userId}/reserve-ship`, {
    method: 'POST',
    body: JSON.stringify({ ship }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const allocateReservedShip = async (user: string) =>
  hostingFetch<object>(`/v1/users/${user}/allocate-reserved-ship`, {
    method: 'PATCH',
  });

export const resendEmailVerification = async (userId: string) =>
  hostingFetch<object>(`/v1/users/${userId}/verify-email`, {
    method: 'PUT',
  });

export const requestPasswordReset = async (email: string) =>
  hostingFetch<object>('/v1/users/password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const getShip = async (shipId: string) => {
  const ship = await hostingFetch<HostedShipResponse>(`/v1/ships/${shipId}`);
  return ship;
};

export const clearShipRevivalStatus = async (shipId: string) => {
  return hostingFetch(`/v1/ships/${shipId}/wayfinding`, {
    method: 'PATCH',
  });
};

export const getShipAccessCode = async (shipId: string) =>
  hostingFetch<{ code: string }>(`/v1/ships/${shipId}/network`);

export const resumeShip = async (shipId: string) =>
  hostingFetch<object>(`/v1/ships/${shipId}/resume`, {
    method: 'PATCH',
  });

export const bootShip = async (shipId: string) =>
  hostingFetch<object>('/v1/ships', {
    method: 'POST',
    body: JSON.stringify({ ship: shipId }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const getNodeStatus = async (
  nodeId: string
): Promise<{ status: domain.HostedNodeStatus; isBeingRevived: boolean }> => {
  let result = null;
  try {
    result = await getShip(nodeId);
  } catch (e) {
    throw new Error('Hosting API call failed');
  }

  const nodeStatus = result.status ? result.status.phase ?? 'Unknown' : null;
  const isBooting = result.ship?.booting;
  const manualUpdateNeeded = result.ship?.manualUpdateNeeded;
  const isBeingRevived = result.ship?.showWayfinding ?? false;

  // If user has a ready ship, let's use it
  if (nodeStatus === 'Ready') {
    return { status: domain.HostedNodeStatus.Running, isBeingRevived };
  }

  // If user has a paused ship, resume it
  if (nodeStatus === 'Suspended') {
    if (!isBooting) {
      await resumeShip(nodeId);
    }
    return { status: domain.HostedNodeStatus.Paused, isBeingRevived };
  }

  if (nodeStatus === 'UnderMaintenance' || manualUpdateNeeded) {
    return { status: domain.HostedNodeStatus.UnderMaintenance, isBeingRevived };
  }

  // If user has a suspended ship, boot it
  if (nodeStatus === null) {
    if (!isBooting) {
      // missing status means the ship is stopped but isn't gauranteed
      // to be bootable
      try {
        await bootShip(nodeId);
      } catch (err) {
        if (
          err.message &&
          err.message.includes(MANUAL_UPDATE_REQUIRED_MESSAGE)
        ) {
          return {
            status: domain.HostedNodeStatus.UnderMaintenance,
            isBeingRevived,
          };
        }
        throw err;
      }
    }
    return { status: domain.HostedNodeStatus.Suspended, isBeingRevived };
  }

  return { status: domain.HostedNodeStatus.Unknown, isBeingRevived };
};

export const inviteShipWithLure = async (params: {
  ship: string;
  lure: string;
}) =>
  hostingFetch<object>('/v1/raw-bite', {
    method: 'POST',
    body: JSON.stringify(params),
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const checkIfAccountDeleted = async (): Promise<boolean> => {
  const hostingUserId = await db.hostingUserId.getValue();
  if (hostingUserId) {
    try {
      const user = await withRetry(() => getHostingUser(hostingUserId), {
        startingDelay: 500,
        numOfAttempts: 5,
      });
      if (!user.verified) {
        return true;
      }
    } catch (err) {
      return true;
    }
  }

  return false;
};

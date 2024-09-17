import * as logic from '@tloncorp/shared/dist/logic';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';

import {
  API_AUTH_PASSWORD,
  API_AUTH_USERNAME,
  API_URL,
  DEFAULT_LURE,
  DEFAULT_PRIORITY_TOKEN,
} from '../constants';
import type {
  BootPhase,
  HostedShipStatus,
  ReservableShip,
  ReservedShip,
  User,
} from '../types/hosting';
import {
  getHostingUserId,
  setHostingToken,
  setHostingUserId,
} from '../utils/hosting';

type HostingError = {
  message: string;
};

const hostingFetchResponse = async (
  path: string,
  init?: RequestInit
): Promise<Response> => {
  const fetchInit = {
    ...init,
  };
  if (API_AUTH_USERNAME && API_AUTH_PASSWORD) {
    fetchInit.headers = {
      Authorization: `Basic ${Buffer.from(
        `${API_AUTH_USERNAME}:${API_AUTH_PASSWORD}`
      ).toString('base64')}`,
      ...fetchInit.headers,
    };
  }

  if (__DEV__) {
    console.debug('Request:', path);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  const response = await fetch(`${API_URL}${path}`, {
    ...fetchInit,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return response;
};

const hostingFetch = async <T extends object>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await hostingFetchResponse(path, init);
  const responseText = await response.text();

  if (__DEV__) {
    console.debug('Response:', responseText);
  }

  const result = JSON.parse(responseText) as HostingError | T;
  if (!response.ok) {
    throw new Error(
      'message' in result ? result.message : 'An unknown error has occurred.'
    );
  }

  return result as T;
};

const rawHostingFetch = async (path: string, init?: RequestInit) => {
  const response = await hostingFetchResponse(path, init);
  return response;
};

export type HostingHeartBeatCode = 'expired' | 'ok' | 'unknown';
export const getHostingHeartBeat = async (): Promise<HostingHeartBeatCode> => {
  const userId = await getHostingUserId();
  const response = await rawHostingFetch(`/v1/users/${userId}`);

  // 401 indicates that the authentication token is expired
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
  email: string;
  password: string;
  lure?: string;
  priorityToken?: string;
  recaptchaToken?: string;
}) =>
  hostingFetch<object>('/v1/sign-up', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      lure: params.lure,
      priorityToken: params.priorityToken,
      recaptcha: {
        recaptchaToken: { token: params.recaptchaToken || '' },
        recaptchaPlatform: Platform.OS,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const logInHostingUser = async (params: {
  email: string;
  password: string;
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
    throw new Error(
      'message' in result ? result.message : 'An unknown error has occurred.'
    );
  }

  const setCookie = response.headers.get('Set-Cookie');
  const user = 'id' in result && (result as User).id;
  if (setCookie) {
    setHostingToken(setCookie);
  }

  if (user) {
    setHostingUserId(user);
  }

  return result as User;
};

export const isUsingTlonAuth = () => {
  return Boolean(getHostingUserId() ?? false);
};

export const getHostingUser = async (userId: string) =>
  hostingFetch<User>(`/v1/users/${userId}`);

export const requestPhoneVerify = async (userId: string, phoneNumber: string) =>
  hostingFetch<object>(`/v1/users/${userId}/request-phone-verify`, {
    method: 'POST',
    body: JSON.stringify(phoneNumber),
    headers: {
      'Content-Type': 'application/json',
    },
  });

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

export const getShip = async (shipId: string) =>
  hostingFetch<{ status?: HostedShipStatus }>(`/v1/ships/${shipId}`);

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

export const getShipsWithStatus = async (
  ships: string[]
): Promise<
  | {
      status: BootPhase;
      shipId: string;
    }
  | undefined
> => {
  const shipResults = await Promise.allSettled(ships.map(getShip));
  const shipStatuses = shipResults.map((result) =>
    result.status === 'fulfilled'
      ? result.value.status?.phase ?? 'Unknown'
      : 'Unknown'
  );

  // If user has a ready ship, let's use it
  const readyIndex = shipStatuses.indexOf('Ready');
  if (readyIndex >= 0) {
    const shipId = ships[readyIndex];
    return {
      status: 'Ready',
      shipId,
    };
  }

  // If user has a booted ship, resume it
  const suspendedIndex = shipStatuses.indexOf('Suspended');
  if (suspendedIndex >= 0) {
    const shipId = ships[suspendedIndex];
    await resumeShip(shipId);
    return { status: 'Suspended', shipId };
  }

  // If user has a halted ship, boot it
  const unknownIndex = shipStatuses.indexOf('Unknown');
  if (unknownIndex >= 0) {
    const shipId = ships[unknownIndex];
    await bootShip(shipId);
    return { status: 'Unknown', shipId };
  }

  return undefined;
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
  const hostingUserId = await getHostingUserId();
  if (hostingUserId) {
    try {
      const user = await logic.withRetry(() => getHostingUser(hostingUserId), {
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

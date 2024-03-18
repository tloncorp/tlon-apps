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
} from '../types';
import { setHostingToken, setHostingUserId } from '../utils/hosting';

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
      lure: params.lure || DEFAULT_LURE,
      priorityToken: params.priorityToken || DEFAULT_PRIORITY_TOKEN,
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

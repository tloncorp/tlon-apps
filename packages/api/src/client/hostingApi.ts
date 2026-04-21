import { Buffer } from 'buffer';

import { createDevLogger } from '../lib/logger';
import { withRetry } from '../lib/utils';
import * as domain from '../types';
import {
  AnalyticsEvent,
  HostedShipResponse,
  ReservableShip,
  ReservedShip,
  User,
  getConstants,
} from '../types';

const logger = createDevLogger('hostingApi', false);

interface StoredValue<T> {
  getValue: () => Promise<T>;
  setValue: (value: T) => Promise<void>;
}

interface HostingSessionStore {
  authToken: StoredValue<string>;
  userId: StoredValue<string>;
  botEnabled: StoredValue<boolean>;
}

function createMemoryValue<T>(initialValue: T): StoredValue<T> {
  let value = initialValue;

  return {
    async getValue() {
      return value;
    },
    async setValue(next: T) {
      value = next;
    },
  };
}

const sessionStore: HostingSessionStore = {
  authToken: createMemoryValue(''),
  userId: createMemoryValue(''),
  botEnabled: createMemoryValue(false),
};

export function configureHostingSessionStore(
  nextStore: Partial<HostingSessionStore>
) {
  if (nextStore.authToken) {
    sessionStore.authToken = nextStore.authToken;
  }

  if (nextStore.userId) {
    sessionStore.userId = nextStore.userId;
  }

  if (nextStore.botEnabled) {
    sessionStore.botEnabled = nextStore.botEnabled;
  }
}

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

  const hostingCookie = await sessionStore.authToken.getValue();
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
  const startTime = performance.now();
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

  const stopTime = performance.now();
  const responseText = await response.text();

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

  try {
    const durationSeconds = Number(((stopTime - startTime) / 1000).toFixed(2));
    logger.trackEvent('Hosting Request Analytics', {
      path: path.split('?')[0],
      method: init?.method ?? 'GET',
      durationSeconds,
    });
  } catch (e) {
    logger.trackError('Failed to Capture Hosting Request Analytics', {
      errorMessage: e.toString(),
    });
  }

  return result as T;
};

const rawHostingFetch = async (path: string, init?: RequestInit) => {
  const response = await hostingFetchResponse(path, init);
  return response;
};

// --- JSON helpers for hosting API requests ---

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

// --- Tlawn (bot) types ---

export interface TlawnProviderConfigInfo {
  keys: Record<string, string>;
  models: TlawnModelEntry[];
  defaultKeys: Record<string, { key: string; id?: string }>;
}

export interface TlawnModelEntry {
  provider: string;
  model: string;
}

export interface TlawnPrimaryModelUpdate {
  provider: string;
  model: string;
  fallbacks?: TlawnModelEntry[];
}

export interface TlawnBotInfo {
  enabled: boolean;
  provider?: string;
  model?: string;
  moon?: string;
}

export interface TlawnConfig {
  dmAllowlist: string[];
  defaultAuthorizedShips: string[];
  channelRules: Record<string, { mode: string; allowedShips: string[] }>;
  groupChannels: string[];
  groupInviteAllowlist: string[];
  autoAcceptDmInvites: boolean;
  autoDiscoverChannels: boolean;
}

// --- Tlawn (bot) user-level endpoints ---

export async function getTlawnProviderKeys(
  userId: string
): Promise<TlawnProviderConfigInfo> {
  return hostingFetch<TlawnProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/provider-keys`
  );
}

export async function setTlawnProviderKey(
  userId: string,
  provider: string,
  key: string
): Promise<TlawnProviderConfigInfo> {
  return hostingFetch<TlawnProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/provider-keys/${provider}`,
    jsonInit('PUT', { key })
  );
}

export async function deleteTlawnProviderKey(
  userId: string,
  provider: string
): Promise<TlawnProviderConfigInfo> {
  return hostingFetch<TlawnProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/provider-keys/${provider}`,
    { method: 'DELETE' }
  );
}

export async function setTlawnPrimaryModel(
  userId: string,
  update: TlawnPrimaryModelUpdate
): Promise<TlawnProviderConfigInfo> {
  return hostingFetch<TlawnProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/primary-model`,
    jsonInit('PUT', update)
  );
}

export interface TlawnProviderModel {
  id: string;
  [key: string]: unknown;
}

/**
 * Validate an API key and list available models for a provider.
 * Returns the raw provider response (e.g. { data: [{ id: "model-id", ... }] }).
 * Throws on invalid key (401/403) or missing key.
 */
export async function getTlawnProviderModels(
  userId: string,
  provider: string
): Promise<{ data: TlawnProviderModel[] }> {
  return hostingFetch<{ data: TlawnProviderModel[] }>(
    `/v1/tlawn/users/${userId}/provider-models?provider=${encodeURIComponent(provider)}`
  );
}

// --- Tlawn (bot) ship-level endpoints ---

export async function getTlawnBotInfo(
  ship: string
): Promise<TlawnBotInfo> {
  return hostingFetch<TlawnBotInfo>(`/v1/tlawn/ships/${ship}`);
}

export async function getTlawnNickname(
  ship: string
): Promise<string | null> {
  const result = await rawHostingFetch(`/v1/tlawn/ships/${ship}/nickname`);
  const text = await result.text();
  try {
    return JSON.parse(text) as string | null;
  } catch {
    return null;
  }
}

export async function setTlawnNickname(
  ship: string,
  nickname: string
): Promise<string | null> {
  const result = await rawHostingFetch(
    `/v1/tlawn/ships/${ship}/nickname`,
    jsonInit('PUT', { nickname })
  );
  const text = await result.text();
  try {
    return JSON.parse(text) as string | null;
  } catch {
    return null;
  }
}

export async function getTlawnAvatar(
  ship: string
): Promise<string | null> {
  const result = await rawHostingFetch(`/v1/tlawn/ships/${ship}/avatar`);
  const text = await result.text();
  try {
    return JSON.parse(text) as string | null;
  } catch {
    return null;
  }
}

export async function setTlawnAvatar(
  ship: string,
  url: string
): Promise<string | null> {
  const result = await rawHostingFetch(
    `/v1/tlawn/ships/${ship}/avatar`,
    jsonInit('PUT', { url })
  );
  const text = await result.text();
  try {
    return JSON.parse(text) as string | null;
  } catch {
    return null;
  }
}

export async function getTlawnConfig(
  ship: string
): Promise<TlawnConfig> {
  return hostingFetch<TlawnConfig>(`/v1/tlawn/ships/${ship}/config`);
}

export async function setTlawnConfig(
  ship: string,
  config: Partial<TlawnConfig>
): Promise<TlawnConfig> {
  return hostingFetch<TlawnConfig>(
    `/v1/tlawn/ships/${ship}/config`,
    jsonInit('PUT', config)
  );
}

export async function reloadBot(ship: string): Promise<void> {
  await rawHostingFetch(`/v1/tlawn/ships/${ship}/reload`, {
    method: 'POST',
  });
}

export async function isBotRunning(ship: string): Promise<boolean> {
  const result = await hostingFetch<{ running: boolean }>(
    `/v1/tlawn/ships/${ship}/running`
  );
  return result.running;
}

// Poll `isBotRunning` until the bot reports as running or the timeout elapses.
// Transient errors (the gateway going down during restart) are swallowed so
// we keep polling. Returns true if running, false on timeout.
export async function awaitBotRunning(
  ship: string,
  {
    timeoutMs = 30_000,
    pollIntervalMs = 1500,
  }: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await isBotRunning(ship)) return true;
    } catch {
      // transient — gateway likely restarting
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}

export type HostingHeartBeatCode = 'expired' | 'ok' | 'unknown';
export const getHostingHeartBeat = async (): Promise<HostingHeartBeatCode> => {
  const userId = await sessionStore.userId.getValue();
  const response = await rawHostingFetch(`/v1/users/${userId}`);

  try {
    const body = (await response.json()) as User;

    if (body.botEnabled !== null && body.botEnabled !== undefined) {
      logger.trackEvent('Bot status set', {
        enabled: body.botEnabled,
        $set: {
          botEnabled: body.botEnabled,
        },
      });
      await sessionStore.botEnabled.setValue(body.botEnabled);
    }
  } catch (e) {
    logger.trackError(
      'Failed to read bot enabled status from hosting heartbeat',
      {
        errorMessage: e.toString(),
        responseText: await response.text(),
      }
    );
  }

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
    sessionStore.authToken.setValue(setCookie);
  }

  const userId = 'id' in result && (result as User).id;
  if (userId) {
    sessionStore.userId.setValue(userId);
    if (result.botEnabled !== null && result.botEnabled !== undefined) {
      logger.trackEvent('Bot status set', {
        enabled: result.botEnabled,
        $set: {
          botEnabled: result.botEnabled,
        },
      });
      await sessionStore.botEnabled.setValue(result.botEnabled);
    }
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
    sessionStore.authToken.setValue(setCookie);
  }

  if (user) {
    sessionStore.userId.setValue(user);
    if (result.botEnabled !== null && result.botEnabled !== undefined) {
      logger.trackEvent('Bot status set', {
        enabled: result.botEnabled,
        $set: {
          botEnabled: result.botEnabled,
        },
      });
      sessionStore.botEnabled.setValue(result.botEnabled);
    }
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

export const assignShipToUser = async (userId: string) => {
  const response = await hostingFetch<domain.AssignmentResponse>(
    `/v1/users/${userId}/assign-ship`,
    {
      method: 'PATCH',
      body: JSON.stringify({}), // indicates any available ship is fine
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const nodeId = response.ship.ship.id;
  const isReady = response.ship.status.phase === 'Ready';
  const code = response.code;
  const personalInviteToken = response.personalLureToken || null;
  const homeGroupInviteToken = response.homeGroupLureToken || null;

  if (!nodeId) {
    throw new Error('Invalid ship assignment response');
  }

  return { nodeId, isReady, code, personalInviteToken, homeGroupInviteToken };
};

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
): Promise<{ status: domain.HostedNodeStatus; showWayfinding: boolean }> => {
  let result = null;
  try {
    result = await getShip(nodeId);
  } catch (e) {
    throw new Error('Hosting API call failed');
  }

  const nodeStatus = result.status ? result.status.phase ?? 'Unknown' : null;
  const isBooting = result.ship?.booting;
  const manualUpdateNeeded = result.ship?.manualUpdateNeeded;
  const showWayfinding = result.ship?.showWayfinding ?? false;

  // If user has a ready ship, let's use it
  if (nodeStatus === 'Ready') {
    return { status: domain.HostedNodeStatus.Running, showWayfinding };
  }

  // If user has a paused ship, resume it
  if (nodeStatus === 'Suspended') {
    if (!isBooting) {
      await resumeShip(nodeId);
    }
    return { status: domain.HostedNodeStatus.Paused, showWayfinding };
  }

  if (nodeStatus === 'UnderMaintenance' || manualUpdateNeeded) {
    return { status: domain.HostedNodeStatus.UnderMaintenance, showWayfinding };
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
            showWayfinding,
          };
        }
        throw err;
      }
    }
    return { status: domain.HostedNodeStatus.Suspended, showWayfinding };
  }

  return { status: domain.HostedNodeStatus.Unknown, showWayfinding };
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
  const hostingUserId = await sessionStore.userId.getValue();
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

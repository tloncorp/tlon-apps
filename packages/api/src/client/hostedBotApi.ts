import { createDevLogger } from '../lib/logger';

const logger = createDevLogger('hostedBotApi', false);

// Re-use the hosting fetch infrastructure from hostingApi.
// These imports are internal to the api package so we import directly.
import { HostingError } from './hostingApi';
import { getConstants } from '../types';

// --- Types ---

export interface HostedBotProviderConfigInfo {
  keys: Record<string, string>;
  models: HostedBotModelEntry[];
  defaultKeys: Record<string, { key: string; id?: string }>;
}

export interface HostedBotModelEntry {
  provider: string;
  model: string;
}

export interface HostedBotPrimaryModelUpdate {
  provider: string;
  model: string;
  fallbacks?: HostedBotModelEntry[];
}

export interface HostedBotProviderKeysUpdate {
  keys?: Record<string, string>;
  models?: HostedBotModelEntry[];
}

export interface HostedBotBotInfo {
  enabled: boolean;
  provider?: string;
  model?: string;
  moon?: string;
}

export interface HostedBotConfig {
  dmAllowlist: string[];
  defaultAuthorizedShips: string[];
  channelRules: Record<string, { mode: string; allowedShips: string[] }>;
  groupChannels: string[];
  groupInviteAllowlist: string[];
  autoAcceptDmInvites: boolean;
  autoDiscoverChannels: boolean;
}

// --- Fetch helper ---
// Follows the same pattern as hostingApi but scoped to hosted bot endpoints.
// Requires the caller to pass userId/shipId since this module doesn't own
// the session store.

interface HostedBotFetchInit extends RequestInit {
  json?: unknown;
}

async function hostedBotFetch<T>(
  path: string,
  authCookie: string,
  init?: HostedBotFetchInit
): Promise<T> {
  const env = getConstants();
  const modifiedCookie = authCookie.replace(' HttpOnly;', '');
  const { json, ...fetchInit } = init ?? {};

  const headers: Record<string, string> = {
    ...(fetchInit.headers as Record<string, string>),
    Cookie: modifiedCookie,
  };
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(`${env.API_URL}${path}`, {
      ...fetchInit,
      credentials: 'include',
      signal: controller.signal,
      headers,
      body: json !== undefined ? JSON.stringify(json) : fetchInit.body,
    });
  } catch (e) {
    throw new HostingError(
      e.name === 'AbortError' ? 'Request timed out' : 'Unknown error occurred',
      { method: fetchInit.method ?? 'GET', path, status: null }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await response.text();
  let result: T;
  try {
    result = JSON.parse(responseText) as T;
  } catch {
    throw new HostingError('Failed to parse response', {
      method: fetchInit.method ?? 'GET',
      path,
      status: response.status,
      responseText,
    });
  }

  if (!response.ok) {
    throw new HostingError(
      (result as any)?.message ?? 'An unknown error has occurred.',
      { method: fetchInit.method ?? 'GET', path, status: response.status }
    );
  }

  return result;
}

// --- User-level endpoints ---

export async function getProviderKeys(
  userId: string,
  authCookie: string
): Promise<HostedBotProviderConfigInfo> {
  return hostedBotFetch<HostedBotProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/provider-keys`,
    authCookie
  );
}

export async function updateProviderKeys(
  userId: string,
  authCookie: string,
  update: HostedBotProviderKeysUpdate
): Promise<HostedBotProviderConfigInfo> {
  return hostedBotFetch<HostedBotProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/provider-keys`,
    authCookie,
    { method: 'PUT', json: update }
  );
}

export async function setProviderKey(
  userId: string,
  authCookie: string,
  provider: string,
  key: string
): Promise<HostedBotProviderConfigInfo> {
  return hostedBotFetch<HostedBotProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/provider-keys/${provider}`,
    authCookie,
    { method: 'PUT', json: { key } }
  );
}

export async function deleteProviderKey(
  userId: string,
  authCookie: string,
  provider: string
): Promise<HostedBotProviderConfigInfo> {
  return hostedBotFetch<HostedBotProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/provider-keys/${provider}`,
    authCookie,
    { method: 'DELETE' }
  );
}

export async function setPrimaryModel(
  userId: string,
  authCookie: string,
  update: HostedBotPrimaryModelUpdate
): Promise<HostedBotProviderConfigInfo> {
  return hostedBotFetch<HostedBotProviderConfigInfo>(
    `/v1/tlawn/users/${userId}/primary-model`,
    authCookie,
    { method: 'PUT', json: update }
  );
}

// --- Ship-level endpoints ---

export async function getBotInfo(
  ship: string,
  authCookie: string
): Promise<HostedBotBotInfo> {
  return hostedBotFetch<HostedBotBotInfo>(
    `/v1/tlawn/ships/${ship}`,
    authCookie
  );
}

export async function setBotEnabled(
  ship: string,
  authCookie: string,
  enabled: boolean,
  moon?: string
): Promise<string | null> {
  return hostedBotFetch<string | null>(
    `/v1/tlawn/ships/${ship}/enabled`,
    authCookie,
    { method: 'PUT', json: { enabled, moon } }
  );
}

export async function getBotNickname(
  ship: string,
  authCookie: string
): Promise<string | null> {
  return hostedBotFetch<string | null>(
    `/v1/tlawn/ships/${ship}/nickname`,
    authCookie
  );
}

export async function setBotNickname(
  ship: string,
  authCookie: string,
  nickname: string
): Promise<string | null> {
  return hostedBotFetch<string | null>(
    `/v1/tlawn/ships/${ship}/nickname`,
    authCookie,
    { method: 'PUT', json: { nickname } }
  );
}

export async function getBotConfig(
  ship: string,
  authCookie: string
): Promise<HostedBotConfig> {
  return hostedBotFetch<HostedBotConfig>(
    `/v1/tlawn/ships/${ship}/config`,
    authCookie
  );
}

export async function updateBotConfig(
  ship: string,
  authCookie: string,
  config: Partial<HostedBotConfig>
): Promise<HostedBotConfig> {
  return hostedBotFetch<HostedBotConfig>(
    `/v1/tlawn/ships/${ship}/config`,
    authCookie,
    { method: 'PUT', json: config }
  );
}

export async function addBotToGroup(
  ship: string,
  authCookie: string,
  group: string,
  moon?: string
): Promise<void> {
  await hostedBotFetch<void>(
    `/v1/tlawn/ships/${ship}/join?group=${encodeURIComponent(group)}${moon ? `&moon=${encodeURIComponent(moon)}` : ''}`,
    authCookie,
    { method: 'POST' }
  );
}

export async function addBotToCordon(
  ship: string,
  authCookie: string,
  group: string,
  moon?: string
): Promise<void> {
  await hostedBotFetch<void>(
    `/v1/tlawn/ships/${ship}/add-to-cordon?group=${encodeURIComponent(group)}${moon ? `&moon=${encodeURIComponent(moon)}` : ''}`,
    authCookie,
    { method: 'POST' }
  );
}

export async function reloadBot(
  ship: string,
  authCookie: string
): Promise<void> {
  await hostedBotFetch<void>(
    `/v1/tlawn/ships/${ship}/reload`,
    authCookie,
    { method: 'POST' }
  );
}

export async function isBotRunning(
  ship: string,
  authCookie: string
): Promise<boolean> {
  const result = await hostedBotFetch<{ running: boolean }>(
    `/v1/tlawn/ships/${ship}/running`,
    authCookie
  );
  return result.running;
}

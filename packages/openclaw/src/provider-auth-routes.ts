import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  clearAuthProfileCooldown,
  clearRuntimeAuthProfileStoreSnapshots,
  ensureAuthProfileStore,
  listProfilesForProvider,
  resolveApiKeyForProfile,
  resolveDefaultAgentDir,
} from 'openclaw/plugin-sdk/agent-runtime';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-runtime';
import {
  removeProviderAuthProfilesWithLock,
  upsertAuthProfileWithLock,
  validateAnthropicSetupToken,
} from 'openclaw/plugin-sdk/provider-auth';
import {
  type ModelsAuthLoginFlowOptions,
  runModelsAuthLoginFlow,
} from 'openclaw/plugin-sdk/provider-auth-login-flow-runtime';

export const PROVIDER_AUTH_ROUTE = '/tlon/provider-auth';

const FLOW_TTL_MS = 15 * 60_000;
const START_WAIT_MS = 15_000;
const MAX_BODY_BYTES = 16 * 1024;
const ANTHROPIC_PROFILE_ID = 'anthropic:default';
const OPENAI_CODEX_MODELS_URL =
  'https://chatgpt.com/backend-api/codex/models?client_version=1.0.0';
const OPENAI_CODEX_MODELS_TIMEOUT_MS = 10_000;

type ProviderId = 'openai' | 'anthropic';
type FlowStatus =
  | 'awaiting_browser'
  | 'awaiting_token'
  | 'authenticating'
  | 'complete'
  | 'error';

type ProviderAuthFlow = {
  id: string;
  provider: ProviderId;
  status: FlowStatus;
  createdAt: number;
  expiresAt: number;
  verificationUrl?: string;
  userCode?: string;
  error?: string;
};

type PublicProviderAuthFlow = Omit<ProviderAuthFlow, 'createdAt'>;

const flows = new Map<string, ProviderAuthFlow>();
const flowWaiters = new Map<string, Set<() => void>>();

type GatewayModelCatalogEntry = {
  provider?: unknown;
  id?: unknown;
  key?: unknown;
  name?: unknown;
  api?: unknown;
  baseUrl?: unknown;
  available?: unknown;
};

type SubscriptionModel = {
  id: string;
  name?: string;
};

type SubscriptionModelCatalog = Partial<
  Record<ProviderId, SubscriptionModel[]>
>;

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function publicFlow(flow: ProviderAuthFlow): PublicProviderAuthFlow {
  return {
    id: flow.id,
    provider: flow.provider,
    status: flow.status,
    expiresAt: flow.expiresAt,
    ...(flow.verificationUrl ? { verificationUrl: flow.verificationUrl } : {}),
    ...(flow.userCode ? { userCode: flow.userCode } : {}),
    ...(flow.error ? { error: flow.error } : {}),
  };
}

function normalizeProvider(value: unknown): ProviderId | null {
  return value === 'openai' || value === 'anthropic' ? value : null;
}

function pruneFlows(now = Date.now()) {
  for (const [id, flow] of flows) {
    if (flow.expiresAt <= now) {
      flows.delete(id);
      notifyFlowWaiters(id);
    }
  }
}

function notifyFlowWaiters(flowId: string) {
  const waiters = flowWaiters.get(flowId);
  if (!waiters) {
    return;
  }
  flowWaiters.delete(flowId);
  for (const resolve of waiters) {
    resolve();
  }
}

function updateFlow(
  flowId: string,
  patch: Partial<Omit<ProviderAuthFlow, 'id' | 'provider' | 'createdAt'>>
) {
  const flow = flows.get(flowId);
  if (!flow) {
    return;
  }
  Object.assign(flow, patch);
  notifyFlowWaiters(flowId);
}

function waitForFlowUpdate(flowId: string): Promise<void> {
  return new Promise((resolve) => {
    const waiters = flowWaiters.get(flowId) ?? new Set();
    waiters.add(resolve);
    flowWaiters.set(flowId, waiters);
    const timeout = setTimeout(() => {
      waiters.delete(resolve);
      if (waiters.size === 0) {
        flowWaiters.delete(flowId);
      }
      resolve();
    }, START_WAIT_MS);
    timeout.unref();
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) {
      throw new Error('request body is too large');
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function readModelCatalogEntries(value: unknown): GatewayModelCatalogEntry[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const models = (value as { models?: unknown }).models;
  return Array.isArray(models)
    ? models.filter(
        (entry): entry is GatewayModelCatalogEntry =>
          Boolean(entry) && typeof entry === 'object'
      )
    : [];
}

function normalizeCatalogEntry(entry: GatewayModelCatalogEntry): {
  provider: string;
  id: string;
  name?: string;
  api?: string;
  baseUrl?: string;
  available?: boolean;
} | null {
  let provider =
    typeof entry.provider === 'string' ? entry.provider.trim() : '';
  let id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if ((!provider || !id) && typeof entry.key === 'string') {
    const separator = entry.key.indexOf('/');
    if (separator > 0 && separator < entry.key.length - 1) {
      provider ||= entry.key.slice(0, separator).trim();
      id ||= entry.key.slice(separator + 1).trim();
    }
  }
  if (!provider || !id) {
    return null;
  }
  return {
    provider,
    id,
    ...(typeof entry.name === 'string' && entry.name.trim()
      ? { name: entry.name.trim() }
      : {}),
    ...(typeof entry.api === 'string' && entry.api.trim()
      ? { api: entry.api.trim() }
      : {}),
    ...(typeof entry.baseUrl === 'string' && entry.baseUrl.trim()
      ? { baseUrl: entry.baseUrl.trim() }
      : {}),
    ...(typeof entry.available === 'boolean'
      ? { available: entry.available }
      : {}),
  };
}

function isOpenAISubscriptionModel(entry: {
  id: string;
  api?: string;
  baseUrl?: string;
}): boolean {
  if (entry.api) {
    return entry.api === 'openai-chatgpt-responses';
  }
  if (entry.baseUrl) {
    return entry.baseUrl.includes('chatgpt.com/backend-api');
  }

  // Some models.list projections omit transport metadata and expose only a
  // provider-qualified key. These are the native Codex ids supported by 7.1.
  return (
    entry.id.includes('codex') ||
    /^gpt-5\.(?:4(?:-(?:mini|pro))?|5(?:-pro)?|6-(?:sol|terra|luna))$/.test(
      entry.id
    )
  );
}

export function extractSubscriptionModels(
  value: unknown
): SubscriptionModelCatalog {
  const catalog: SubscriptionModelCatalog = {};
  const entries = readModelCatalogEntries(value)
    .map(normalizeCatalogEntry)
    .filter((entry) => entry !== null);

  for (const provider of ['openai', 'anthropic'] as const) {
    const seen = new Set<string>();
    catalog[provider] = entries
      .filter((entry) => {
        if (entry.provider !== provider || !entry.id) {
          return false;
        }

        // OpenAI's canonical provider contains both direct Platform API rows
        // and native ChatGPT/Codex subscription rows. Only the latter can be
        // powered by the OAuth profile created by this flow.
        if (provider === 'openai' && !isOpenAISubscriptionModel(entry)) {
          return false;
        }

        const id = entry.id;
        if (seen.has(id)) {
          return false;
        }
        seen.add(id);
        return true;
      })
      .map((entry) => ({
        id: entry.id,
        ...(entry.name ? { name: entry.name } : {}),
      }));
  }

  return catalog;
}

export function extractOpenAICodexModels(value: unknown): SubscriptionModel[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  const rows = (value as { models?: unknown }).models;
  if (!Array.isArray(rows)) {
    return [];
  }

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return [];
    }
    const model = row as Record<string, unknown>;
    const visibility =
      typeof model.visibility === 'string'
        ? model.visibility.trim().toLowerCase()
        : '';
    if (visibility && visibility !== 'list') {
      return [];
    }
    if (model.show_in_picker === false || model.showInPicker === false) {
      return [];
    }

    const rawId =
      typeof model.slug === 'string'
        ? model.slug
        : typeof model.id === 'string'
          ? model.id
          : '';
    const id = rawId.trim();
    if (!id || seen.has(id)) {
      return [];
    }
    seen.add(id);

    const rawName =
      typeof model.display_name === 'string'
        ? model.display_name
        : typeof model.displayName === 'string'
          ? model.displayName
          : typeof model.name === 'string'
            ? model.name
            : '';
    const name = rawName.trim();
    return [{ id, ...(name ? { name } : {}) }];
  });
}

function errorMessage(error: unknown, secret?: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  return secret ? raw.split(secret).join('[redacted]') : raw;
}

export function isManagedConfigLockPermissionError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    /\bEACCES\b/.test(message) &&
    /(?:^|[/\\])openclaw\.json\.lock(?:['"]|$)/.test(message)
  );
}

export function parseOpenAIVerificationMessage(
  message: string
): { verificationUrl: string; userCode: string } | null {
  const urlMatch = /^URL:\s*(\S+)\s*$/im.exec(message);
  const codeMatch = /^Code:\s*(\S+)\s*$/im.exec(message);
  if (!urlMatch?.[1] || !codeMatch?.[1]) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(urlMatch[1]);
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'auth.openai.com' ||
    url.pathname !== '/codex/device'
  ) {
    return null;
  }
  return {
    verificationUrl: url.toString(),
    userCode: codeMatch[1],
  };
}

function createRuntime(api: OpenClawPluginApi) {
  return {
    log: (...args: unknown[]) => {
      api.logger.info(`[tlon] Provider auth: ${args.map(String).join(' ')}`);
    },
    error: (...args: unknown[]) => {
      api.logger.warn(`[tlon] Provider auth: ${args.map(String).join(' ')}`);
    },
    exit: (code: number) => {
      throw new Error(`provider auth exited with code ${code}`);
    },
  };
}

function unsupportedPrompt(): never {
  throw new Error('provider requested an unsupported interactive prompt');
}

function createPrompter(params: {
  onNote?: (message: string, title?: string) => void;
  token?: string;
}): ModelsAuthLoginFlowOptions['prompter'] {
  return {
    intro: async () => {},
    outro: async () => {},
    note: async (message, title) => params.onNote?.(message, title),
    plain: async (message) => params.onNote?.(message),
    select: async () => unsupportedPrompt(),
    multiselect: async () => unsupportedPrompt(),
    text: async ({ validate }) => {
      if (!params.token) {
        unsupportedPrompt();
      }
      const validationError = validate?.(params.token);
      if (validationError) {
        throw new Error(validationError);
      }
      return params.token;
    },
    confirm: async () => unsupportedPrompt(),
    progress: () => ({
      update: () => {},
      stop: () => {},
    }),
  };
}

async function runOpenAIFlow(api: OpenClawPluginApi, flowId: string) {
  try {
    await runModelsAuthLoginFlow({
      provider: 'openai',
      method: 'device-code',
      agent: 'main',
      runtime: createRuntime(api),
      prompter: createPrompter({
        onNote: (message) => {
          const verification = parseOpenAIVerificationMessage(message);
          if (verification) {
            updateFlow(flowId, {
              ...verification,
              status: 'awaiting_browser',
            });
          }
        },
      }),
      isRemote: true,
      openUrl: async () => {},
    });
    updateFlow(flowId, { status: 'complete' });
  } catch (error) {
    // OpenClaw 7.1 persists the auth profile before applying the provider's
    // optional model-allowlist patch. Tlon's generated config is intentionally
    // root-managed, so that final write cannot acquire openclaw.json.lock.
    // The credential is already durable in the pier-backed auth store.
    if (isManagedConfigLockPermissionError(error)) {
      api.logger.info(
        '[tlon] OpenAI auth saved; skipped optional root-managed config patch'
      );
      updateFlow(flowId, { status: 'complete' });
      return;
    }
    updateFlow(flowId, { status: 'error', error: errorMessage(error) });
  }
}

async function runAnthropicFlow(
  api: OpenClawPluginApi,
  flowId: string,
  token: string
) {
  updateFlow(flowId, { status: 'authenticating', error: undefined });
  try {
    const normalizedToken = token.replaceAll(/\s+/g, '').trim();
    const validationError = validateAnthropicSetupToken(normalizedToken);
    if (validationError) {
      throw new Error(validationError);
    }

    const cfg = api.runtime.config.current() as OpenClawConfig;
    const agentDir = resolveDefaultAgentDir(cfg);
    const store = await upsertAuthProfileWithLock({
      profileId: ANTHROPIC_PROFILE_ID,
      credential: {
        type: 'token',
        provider: 'anthropic',
        token: normalizedToken,
      },
      agentDir,
    });
    if (!store) {
      throw new Error(
        'Failed to update the auth profile store; please try again'
      );
    }
    await clearAuthProfileCooldown({
      store,
      profileId: ANTHROPIC_PROFILE_ID,
      agentDir,
    });
    await refreshGatewayAuthState(api);
    updateFlow(flowId, { status: 'complete' });
  } catch (error) {
    updateFlow(flowId, {
      status: 'error',
      error: errorMessage(error, token),
    });
  }
}

async function refreshExpiredOpenAIProfiles(api: OpenClawPluginApi) {
  const cfg = api.runtime.config.current() as OpenClawConfig;
  const agentDir = resolveDefaultAgentDir(cfg);
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
    config: cfg,
  });

  for (const profileId of listProfilesForProvider(store, 'openai')) {
    const credential = store.profiles[profileId];
    if (
      credential?.type !== 'oauth' ||
      !credential.expires ||
      credential.expires > Date.now() + 60_000
    ) {
      continue;
    }
    try {
      await resolveApiKeyForProfile({
        cfg,
        store,
        profileId,
        agentDir,
        forceRefresh: true,
      });
    } catch {
      api.logger.warn(
        `[tlon] OpenAI auth refresh failed for ${profileId}; re-login may be required`
      );
    }
  }
}

async function refreshGatewayAuthState(api: OpenClawPluginApi) {
  clearRuntimeAuthProfileStoreSnapshots();
  try {
    await api.runtime.gateway.request('models.authStatus', { refresh: true });
  } catch (error) {
    api.logger.warn(
      `[tlon] Provider auth state refresh failed: ${errorMessage(error)}`
    );
  }
}

async function loadOpenAISubscriptionModels(
  api: OpenClawPluginApi
): Promise<SubscriptionModel[]> {
  const cfg = api.runtime.config.current() as OpenClawConfig;
  const agentDir = resolveDefaultAgentDir(cfg);
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
    config: cfg,
  });
  const models: SubscriptionModel[] = [];
  const seen = new Set<string>();

  for (const profileId of listProfilesForProvider(store, 'openai')) {
    const credential = store.profiles[profileId];
    if (credential?.type !== 'oauth') {
      continue;
    }
    try {
      const resolved = await resolveApiKeyForProfile({
        cfg,
        store,
        profileId,
        agentDir,
      });
      if (!resolved?.apiKey || resolved.profileType !== 'oauth') {
        continue;
      }
      const resolvedCredential =
        resolved.credential?.type === 'oauth'
          ? resolved.credential
          : credential;
      const response = await fetch(OPENAI_CODEX_MODELS_URL, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${resolved.apiKey}`,
          ...(resolvedCredential.accountId
            ? { 'ChatGPT-Account-ID': resolvedCredential.accountId }
            : {}),
        },
        signal: AbortSignal.timeout(OPENAI_CODEX_MODELS_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(
          `Codex model discovery returned HTTP ${response.status}`
        );
      }
      const discovered = extractOpenAICodexModels(await response.json());
      for (const model of discovered) {
        if (!seen.has(model.id)) {
          seen.add(model.id);
          models.push(model);
        }
      }
    } catch (error) {
      api.logger.warn(
        `[tlon] OpenAI subscription model discovery failed for ${profileId}: ${errorMessage(
          error
        )}`
      );
    }
  }

  return models;
}

async function loadSubscriptionModelCatalog(
  api: OpenClawPluginApi
): Promise<SubscriptionModelCatalog> {
  const [openai, gatewayResult] = await Promise.all([
    loadOpenAISubscriptionModels(api),
    api.runtime.gateway
      .request('models.list', { view: 'all' })
      .catch((error: unknown) => {
        api.logger.warn(
          `[tlon] Anthropic subscription model catalog load failed: ${errorMessage(
            error
          )}`
        );
        return {};
      }),
  ]);
  const gatewayCatalog = extractSubscriptionModels(gatewayResult);
  return {
    openai,
    anthropic: gatewayCatalog.anthropic ?? [],
  };
}

function includeDetectedAuthFailures(
  api: OpenClawPluginApi,
  value: unknown
): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }
  const result = value as {
    providers?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(result.providers)) {
    return value;
  }

  const cfg = api.runtime.config.current() as OpenClawConfig;
  const agentDir = resolveDefaultAgentDir(cfg);
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
    config: cfg,
  });
  const authFailureReasons = new Set([
    'auth',
    'auth_permanent',
    'session_expired',
  ]);

  return {
    ...result,
    providers: result.providers.map((provider) => {
      const providerId =
        typeof provider.provider === 'string' ? provider.provider : '';
      const profiles = Array.isArray(provider.profiles)
        ? (provider.profiles as Array<Record<string, unknown>>)
        : [];
      const hasSubscriptionProfile = profiles.some((profile) => {
        if (providerId === 'openai') {
          return profile.type === 'oauth';
        }
        if (providerId === 'anthropic') {
          return profile.type === 'oauth' || profile.type === 'token';
        }
        return true;
      });
      const subscriptionStatus =
        (providerId === 'openai' || providerId === 'anthropic') &&
        !hasSubscriptionProfile
          ? { ...provider, status: 'missing', expiry: undefined }
          : provider;
      const hasDetectedFailure = listProfilesForProvider(
        store,
        providerId
      ).some((profileId) => {
        const credential = store.profiles[profileId];
        if (credential?.type !== 'oauth' && credential?.type !== 'token') {
          return false;
        }
        const usage = store.usageStats?.[profileId];
        return (
          authFailureReasons.has(usage?.disabledReason ?? '') ||
          authFailureReasons.has(usage?.cooldownReason ?? '')
        );
      });
      return hasDetectedFailure
        ? {
            ...subscriptionStatus,
            status: 'expired',
            reason: 'auth_failure',
          }
        : subscriptionStatus;
    }),
  };
}

function createFlow(provider: ProviderId): ProviderAuthFlow {
  const now = Date.now();
  const flow: ProviderAuthFlow = {
    id: randomUUID(),
    provider,
    status: provider === 'openai' ? 'awaiting_browser' : 'awaiting_token',
    createdAt: now,
    expiresAt: now + FLOW_TTL_MS,
  };
  flows.set(flow.id, flow);
  return flow;
}

export function registerProviderAuthRoutes(api: OpenClawPluginApi): boolean {
  api.registerHttpRoute({
    path: PROVIDER_AUTH_ROUTE,
    auth: 'gateway',
    match: 'prefix',
    gatewayRuntimeScopeSurface: 'trusted-operator',
    handler: async (req, res) => {
      pruneFlows();
      const url = new URL(req.url ?? PROVIDER_AUTH_ROUTE, 'http://localhost');
      const suffix = url.pathname.slice(PROVIDER_AUTH_ROUTE.length);

      try {
        if (req.method === 'GET' && suffix === '/status') {
          await refreshExpiredOpenAIProfiles(api);
          const [result, subscriptionModels] = await Promise.all([
            api.runtime.gateway.request('models.authStatus', {
              refresh: true,
            }),
            loadSubscriptionModelCatalog(api),
          ]);
          const status = includeDetectedAuthFailures(api, result);
          writeJson(res, 200, {
            ...(status && typeof status === 'object' ? status : {}),
            subscriptionModels,
          });
          return;
        }

        if (req.method === 'POST' && suffix === '/start') {
          const body = asRecord(await readJsonBody(req));
          const provider = normalizeProvider(body.provider);
          if (!provider) {
            writeJson(res, 400, {
              error: 'provider must be openai or anthropic',
            });
            return;
          }

          const flow = createFlow(provider);
          if (provider === 'openai') {
            void runOpenAIFlow(api, flow.id);
            if (!flow.verificationUrl && flow.status === 'awaiting_browser') {
              await waitForFlowUpdate(flow.id);
            }
          }
          writeJson(res, 202, { flow: publicFlow(flow) });
          return;
        }

        if (req.method === 'GET' && suffix === '/flow') {
          const flowId = url.searchParams.get('flowId');
          const flow = flowId ? flows.get(flowId) : undefined;
          if (!flow) {
            writeJson(res, 404, { error: 'flow not found or expired' });
            return;
          }
          writeJson(res, 200, { flow: publicFlow(flow) });
          return;
        }

        if (req.method === 'POST' && suffix === '/complete') {
          const body = asRecord(await readJsonBody(req));
          const flowId =
            typeof body.flowId === 'string' ? body.flowId.trim() : '';
          const token = typeof body.token === 'string' ? body.token.trim() : '';
          const flow = flows.get(flowId);
          if (!flow || flow.provider !== 'anthropic') {
            writeJson(res, 404, { error: 'flow not found or expired' });
            return;
          }
          if (flow.status !== 'awaiting_token' && flow.status !== 'error') {
            writeJson(res, 409, {
              error: `flow cannot be completed while ${flow.status}`,
            });
            return;
          }
          if (!token) {
            writeJson(res, 400, { error: 'token is required' });
            return;
          }

          await runAnthropicFlow(api, flow.id, token);
          const completedFlow = flows.get(flow.id) ?? flow;
          writeJson(res, completedFlow.status === 'complete' ? 200 : 400, {
            flow: publicFlow(completedFlow),
          });
          return;
        }

        if (req.method === 'DELETE' && suffix === '/provider') {
          const provider = normalizeProvider(url.searchParams.get('provider'));
          if (!provider) {
            writeJson(res, 400, {
              error: 'provider must be openai or anthropic',
            });
            return;
          }
          const cfg = api.runtime.config.current() as OpenClawConfig;
          const agentDir = resolveDefaultAgentDir(cfg);
          const store = ensureAuthProfileStore(agentDir, {
            allowKeychainPrompt: false,
            config: cfg,
          });
          const removedProfiles = listProfilesForProvider(store, provider);
          const updated = await removeProviderAuthProfilesWithLock({
            provider,
            agentDir,
          });
          if (!updated) {
            throw new Error(
              'Failed to update the auth profile store; please try again'
            );
          }
          await refreshGatewayAuthState(api);
          writeJson(res, 200, { provider, removedProfiles });
          return;
        }

        writeJson(res, 404, { error: 'not found' });
      } catch (error) {
        const message = errorMessage(error);
        const statusCode =
          message.includes('JSON') ||
          message.includes('request body') ||
          message.includes('too large')
            ? 400
            : 500;
        writeJson(res, statusCode, { error: message });
      }
    },
  });

  api.logger.info('[tlon] Provider auth routes registered (auth: gateway)');
  return true;
}

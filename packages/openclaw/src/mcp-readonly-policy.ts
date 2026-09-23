import { sharedMap } from './shared-state.js';

const MCP_TOOL_NAMES = {
  listUpstreams: 'mcp__list_upstreams',
  search: 'mcp__search',
  describe: 'mcp__describe',
  call: 'mcp__call',
} as const;

export const MCP_READ_TOOL_NAMES = [
  MCP_TOOL_NAMES.listUpstreams,
  MCP_TOOL_NAMES.search,
  MCP_TOOL_NAMES.describe,
  MCP_TOOL_NAMES.call,
] as const;

export function isMcpDescribeToolName(name: string) {
  return name === MCP_TOOL_NAMES.describe;
}

export function isMcpListUpstreamsToolName(name: string) {
  return name === MCP_TOOL_NAMES.listUpstreams;
}

export function isMcpCallToolName(name: string) {
  return name === MCP_TOOL_NAMES.call;
}

const describedReadOnlyTools = sharedMap<string, { providerId: string | null }>(
  'mcpReadOnlyPolicy.describedTools'
);
const knownProviderIdsBySession = sharedMap<string, readonly string[]>(
  'mcpReadOnlyPolicy.knownProviderIdsBySession'
);
const cronJobBySession = sharedMap<string, string>(
  'mcpReadOnlyPolicy.cronJobBySession'
);

function toolName(params: unknown): string | null {
  if (!params || typeof params !== 'object') return null;
  const name = (params as Record<string, unknown>).name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

function findExactDescribedTool(value: unknown, name: string) {
  const queue = [parseJson(value)];
  const visited = new Set<unknown>();
  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      queue.push(...candidate);
      continue;
    }
    const candidateRecord = record(candidate);
    if (!candidateRecord) continue;
    if (candidateRecord.name === name) return candidateRecord;
    // Traverse only broker response envelopes. In particular, never inspect
    // inputSchema or arbitrary tool output, where an untrusted tool can place
    // a decoy readOnlyHint.
    for (const key of ['tool', 'tools', 'result', 'data', 'content']) {
      const nested = candidateRecord[key];
      if (nested !== undefined) queue.push(parseJson(nested));
    }
    if (typeof candidateRecord.text === 'string') {
      queue.push(parseJson(candidateRecord.text));
    }
  }
  return null;
}

function ownProviderId(value: Record<string, unknown> | null) {
  if (!value) return null;
  for (const key of ['upstreamId', 'upstream_id', 'providerId', 'serverId']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return null;
}

function upstreamIds(value: unknown): string[] | null {
  const queue = [parseJson(value)];
  const visited = new Set<unknown>();
  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);
    const candidateRecord = record(candidate);
    if (!candidateRecord) {
      if (Array.isArray(candidate)) queue.push(...candidate);
      continue;
    }
    if (Array.isArray(candidateRecord.upstreams)) {
      const ids = candidateRecord.upstreams.map((upstream) => {
        const id = record(upstream)?.id;
        return typeof id === 'string' && id.length > 0 ? id : null;
      });
      return ids.every((id): id is string => Boolean(id))
        ? [...new Set(ids)]
        : null;
    }
    for (const key of ['result', 'data', 'content']) {
      const nested = candidateRecord[key];
      if (nested !== undefined) queue.push(parseJson(nested));
    }
    if (typeof candidateRecord.text === 'string') {
      queue.push(parseJson(candidateRecord.text));
    }
  }
  return null;
}

export function rememberMcpUpstreams(
  sessionKey: string | undefined,
  result: unknown
) {
  if (!sessionKey) return;
  knownProviderIdsBySession.delete(sessionKey);
  const ids = upstreamIds(result);
  if (ids) knownProviderIdsBySession.set(sessionKey, ids);
}

function providerForTool(
  sessionKey: string | undefined,
  params: unknown,
  descriptor: Record<string, unknown> | null
) {
  // Params are model-authored and cannot assert their own provider. Only the
  // broker's descriptor or its complete upstream catalog is authoritative.
  const explicit = ownProviderId(descriptor);
  if (explicit) return explicit;
  const name = toolName(params);
  if (!name) return null;
  const lowerName = name.toLowerCase();
  const matches = (knownProviderIdsBySession.get(sessionKey ?? '') ?? [])
    .filter((providerId) => {
      const lowerProviderId = providerId.toLowerCase();
      return (
        lowerName === lowerProviderId ||
        ['_', '.', ':', '/'].some((delimiter) =>
          lowerName.startsWith(`${lowerProviderId}${delimiter}`)
        )
      );
    })
    .sort((left, right) => right.length - left.length);
  if (matches.length === 0) return null;
  if (matches[1]?.length === matches[0]?.length) return null;
  return matches[0] ?? null;
}

function isAllowedProvider(
  providerId: string | null,
  allowedProviderIds: readonly string[]
) {
  return Boolean(providerId && allowedProviderIds.includes(providerId));
}

function cacheKey(sessionKey: string, providerId: string, name: string) {
  return `${sessionKey}\u0000${providerId}\u0000${name}`;
}

export function rememberDescribedReadOnlyMcpTool(
  sessionKey: string | undefined,
  params: unknown,
  result: unknown,
  allowedProviderIds: readonly string[]
) {
  const name = toolName(params);
  if (!sessionKey || !name) return;
  const requestedProviderId = providerForTool(sessionKey, params, null);
  if (
    !requestedProviderId ||
    !isAllowedProvider(requestedProviderId, allowedProviderIds)
  ) {
    return;
  }
  const key = cacheKey(sessionKey, requestedProviderId, name);
  // An exact re-description replaces the prior descriptor. Revoke first so a
  // mutating or malformed replacement cannot inherit an earlier read grant.
  describedReadOnlyTools.delete(key);
  const descriptor = findExactDescribedTool(result, name);
  const annotations = record(descriptor?.annotations);
  const describedProviderId = ownProviderId(descriptor);
  if (
    annotations?.readOnlyHint !== true ||
    (describedProviderId !== null &&
      describedProviderId !== requestedProviderId)
  ) {
    return;
  }
  describedReadOnlyTools.set(key, { providerId: requestedProviderId });
}

export function mayCallDescribedReadOnlyMcpTool(
  sessionKey: string | undefined,
  params: unknown,
  allowedProviderIds: readonly string[]
) {
  // Scheduled onboarding runs fail closed: prose is not a permission boundary,
  // so mcp__call is available only after the broker describes that exact tool
  // with the MCP readOnlyHint in this same session.
  const name = toolName(params);
  const requestedProviderId = providerForTool(sessionKey, params, null);
  const permission =
    sessionKey && name && requestedProviderId
      ? describedReadOnlyTools.get(
          cacheKey(sessionKey, requestedProviderId, name)
        )
      : undefined;
  return Boolean(
    permission &&
    permission.providerId === requestedProviderId &&
    isAllowedProvider(requestedProviderId, allowedProviderIds)
  );
}

export function mayDescribeMcpTool(
  sessionKey: string | undefined,
  params: unknown,
  allowedProviderIds: readonly string[]
) {
  return isAllowedProvider(
    providerForTool(sessionKey, params, null),
    allowedProviderIds
  );
}

export function rememberCronJobForSession(
  sessionKey: string | undefined,
  jobId: string | undefined
) {
  if (sessionKey && jobId) cronJobBySession.set(sessionKey, jobId);
}

export function cronJobForSession(sessionKey: string | undefined) {
  return sessionKey ? cronJobBySession.get(sessionKey) : undefined;
}

export function clearCronJobForSession(
  sessionKey: string | undefined,
  expectedJobId?: string
) {
  if (!sessionKey) return;
  const current = cronJobBySession.get(sessionKey);
  if (expectedJobId && current !== expectedJobId) return;
  cronJobBySession.delete(sessionKey);
  const prefix = `${sessionKey}\u0000`;
  for (const key of describedReadOnlyTools.keys()) {
    if (key.startsWith(prefix)) describedReadOnlyTools.delete(key);
  }
  knownProviderIdsBySession.delete(sessionKey);
}

export const mcpReadOnlyPolicyTesting = {
  clear: () => {
    describedReadOnlyTools.clear();
    knownProviderIdsBySession.clear();
    cronJobBySession.clear();
  },
};

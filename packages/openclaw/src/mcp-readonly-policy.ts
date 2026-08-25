import { sharedMap } from './shared-state.js';

const describedReadOnlyTools = sharedMap<string, { providerId: string | null }>(
  'mcpReadOnlyPolicy.describedTools'
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

function providerForTool(
  params: unknown,
  descriptor: Record<string, unknown> | null,
  allowedProviderIds: readonly string[]
) {
  const explicit = ownProviderId(record(params)) ?? ownProviderId(descriptor);
  if (explicit) return explicit;
  const name = toolName(params);
  if (!name) return null;
  const lowerName = name.toLowerCase();
  return (
    allowedProviderIds.find((providerId) => {
      const lowerProviderId = providerId.toLowerCase();
      return (
        lowerName === lowerProviderId ||
        ['.', ':', '/', '__'].some((delimiter) =>
          lowerName.startsWith(`${lowerProviderId}${delimiter}`)
        )
      );
    }) ?? null
  );
}

function isAllowedProvider(
  providerId: string | null,
  allowedProviderIds: readonly string[]
) {
  return Boolean(providerId && allowedProviderIds.includes(providerId));
}

function cacheKey(sessionKey: string, name: string) {
  return `${sessionKey}\u0000${name}`;
}

export function rememberDescribedReadOnlyMcpTool(
  sessionKey: string | undefined,
  params: unknown,
  result: unknown,
  allowedProviderIds: readonly string[]
) {
  const name = toolName(params);
  if (!sessionKey || !name) return;
  const descriptor = findExactDescribedTool(result, name);
  const annotations = record(descriptor?.annotations);
  const providerId = providerForTool(params, descriptor, allowedProviderIds);
  if (
    annotations?.readOnlyHint !== true ||
    !isAllowedProvider(providerId, allowedProviderIds)
  ) {
    return;
  }
  describedReadOnlyTools.set(cacheKey(sessionKey, name), { providerId });
}

export function mayCallDescribedReadOnlyMcpTool(
  sessionKey: string | undefined,
  params: unknown,
  allowedProviderIds: readonly string[]
) {
  // Scheduled onboarding runs fail closed: prose is not a permission boundary,
  // so mcp_call is available only after the broker describes that exact tool
  // with the MCP readOnlyHint in this same session.
  const name = toolName(params);
  const permission =
    sessionKey && name
      ? describedReadOnlyTools.get(cacheKey(sessionKey, name))
      : undefined;
  return Boolean(
    permission && isAllowedProvider(permission.providerId, allowedProviderIds)
  );
}

export function mayDescribeMcpTool(
  params: unknown,
  allowedProviderIds: readonly string[]
) {
  return isAllowedProvider(
    providerForTool(params, null, allowedProviderIds),
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
}

export const mcpReadOnlyPolicyTesting = {
  clear: () => {
    describedReadOnlyTools.clear();
    cronJobBySession.clear();
  },
};

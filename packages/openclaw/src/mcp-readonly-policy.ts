import { sharedMap } from './shared-state.js';

const describedReadOnlyTools = sharedMap<string, true>(
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

function declaresReadOnlyTool(value: unknown): boolean {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) {
    return parsed.some(declaresReadOnlyTool);
  }
  if (!parsed || typeof parsed !== 'object') return false;
  const record = parsed as Record<string, unknown>;
  const annotations = record.annotations;
  if (
    annotations &&
    typeof annotations === 'object' &&
    (annotations as Record<string, unknown>).readOnlyHint === true
  ) {
    return true;
  }
  return Object.values(record).some(declaresReadOnlyTool);
}

function cacheKey(sessionKey: string, name: string) {
  return `${sessionKey}\u0000${name}`;
}

export function rememberDescribedReadOnlyMcpTool(
  sessionKey: string | undefined,
  params: unknown,
  result: unknown
) {
  const name = toolName(params);
  if (!sessionKey || !name || !declaresReadOnlyTool(result)) return;
  describedReadOnlyTools.set(cacheKey(sessionKey, name), true);
}

export function mayCallDescribedReadOnlyMcpTool(
  sessionKey: string | undefined,
  params: unknown
) {
  // Scheduled onboarding runs fail closed: prose is not a permission boundary,
  // so mcp_call is available only after the broker describes that exact tool
  // with the MCP readOnlyHint in this same session.
  const name = toolName(params);
  return Boolean(
    sessionKey && name && describedReadOnlyTools.has(cacheKey(sessionKey, name))
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

export const mcpReadOnlyPolicyTesting = {
  clear: () => {
    describedReadOnlyTools.clear();
    cronJobBySession.clear();
  },
};

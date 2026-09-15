function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * OpenClaw exposes one broad cron schema for every action. Some providers fill
 * unused schema fields, so an update can arrive with `patch.agentId` even when
 * the model is only changing mutable payload fields. Core correctly rejects
 * agent ownership changes; omit that immutable field so the remaining patch
 * is validated and applied without changing ownership.
 */
export function stripImmutableCronUpdateAgentId(params: unknown): boolean {
  if (!isRecord(params) || params.action !== 'update') {
    return false;
  }

  const patch = params.patch;
  if (!isRecord(patch) || !Object.hasOwn(patch, 'agentId')) {
    return false;
  }

  return Reflect.deleteProperty(patch, 'agentId');
}

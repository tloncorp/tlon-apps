/** Deliver one saved-login approval card per browser session in each agent run. */
export type BrowserLoginToolResult = {
  toolName: string;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type RunContext = { sessionKey?: string; sessionId?: string; runId?: string };

export function createBrowserLoginApprovalHandler(
  sendHandoff: (
    sessionId: string,
    choice: { id: string; revision: number } | undefined,
    ctx: RunContext
  ) => Promise<unknown>
) {
  const runKey = (ctx: RunContext) =>
    JSON.stringify([ctx.sessionKey, ctx.runId]);
  const deliveries = new Map<string, Map<string, Promise<unknown>>>();
  const handle = async (
    event: BrowserLoginToolResult,
    ctx: RunContext = {}
  ): Promise<void> => {
    if (
      event.error ||
      event.toolName !== 'mcp__call' ||
      (event.params.name !== 'browser_browser_login' &&
        event.params.name !== 'browser_login')
    )
      return;
    let argumentsValue = event.params.arguments;
    if (typeof argumentsValue === 'string') {
      try {
        argumentsValue = JSON.parse(argumentsValue);
      } catch {
        return;
      }
    }
    const args = record(argumentsValue);
    const sessionId = args.session_id;
    if (
      (args.action !== undefined && args.action !== 'use') ||
      typeof sessionId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(sessionId)
    )
      return;
    const result = record(event.result);
    const details = record(result.details);
    const outcome = record(details.structuredContent);
    if (
      result.isError === true ||
      details.status === 'error' ||
      outcome.session_id !== sessionId ||
      record(outcome.login).status !== 'approval_required'
    )
      return;

    const key = runKey(ctx);
    const delivered =
      deliveries.get(key) ?? new Map<string, Promise<unknown>>();
    deliveries.set(key, delivered);
    const existing = delivered.get(sessionId);
    if (existing) {
      await existing;
      return;
    }
    const requested = record(args.record);
    const choice =
      typeof requested.id === 'string' &&
      typeof requested.revision === 'number' &&
      Number.isInteger(requested.revision) &&
      requested.revision > 0
        ? { id: requested.id, revision: requested.revision }
        : undefined;
    const promise = Promise.resolve().then(() =>
      sendHandoff(sessionId, choice, ctx)
    );
    delivered.set(sessionId, promise);
    try {
      await promise;
    } catch (error) {
      delivered.delete(sessionId);
      throw error;
    }
  };
  return {
    handle,
    endRun: (ctx: RunContext) => {
      deliveries.delete(runKey(ctx));
    },
  };
}

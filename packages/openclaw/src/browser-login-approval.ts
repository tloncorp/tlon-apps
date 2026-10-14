/** Sends owner approval through the same authenticated secure-entry path as browser handoff. */
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

export function createBrowserLoginApprovalHandler(
  sendHandoff: (sessionId: string) => Promise<unknown>
) {
  const pending = new Map<string, Promise<unknown>>();
  return async (event: BrowserLoginToolResult): Promise<void> => {
    if (
      event.error ||
      event.toolName !== 'mcp__call' ||
      event.params.name !== 'browser_browser_login'
    )
      return;
    const args = record(event.params.arguments);
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

    // Concurrent requests for this session share one card. A later request
    // prepares a fresh single-use form, including after a delivery failure.
    const existing = pending.get(sessionId);
    if (existing) {
      await existing;
      return;
    }
    const delivery = Promise.resolve().then(() => sendHandoff(sessionId));
    pending.set(sessionId, delivery);
    try {
      await delivery;
    } finally {
      pending.delete(sessionId);
    }
  };
}

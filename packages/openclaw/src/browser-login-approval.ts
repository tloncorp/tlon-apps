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
  // Browser sessions have a maximum lifetime of 24 hours. Keep successful
  // delivery for that lifetime so sequential retries cannot reopen the modal.
  const delivered = new Map<
    string,
    { promise: Promise<unknown>; expiresAt: number }
  >();
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

    const now = Date.now();
    for (const [id, entry] of delivered) {
      if (entry.expiresAt <= now) delivered.delete(id);
    }
    const existing = delivered.get(sessionId);
    if (existing) {
      await existing.promise;
      return;
    }
    const promise = Promise.resolve().then(() => sendHandoff(sessionId));
    delivered.set(sessionId, {
      promise,
      expiresAt: now + 24 * 60 * 60_000,
    });
    try {
      await promise;
    } catch (error) {
      delivered.delete(sessionId);
      throw error;
    }
  };
}

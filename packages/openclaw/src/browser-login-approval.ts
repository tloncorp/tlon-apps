import {
  formFieldsSchema,
  type FormFields,
} from './browser-session-handoff.js';

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
const PREPARED_FORM_LIFETIME_MS = 5 * 60_000;

export function createBrowserLoginApprovalHandler(
  sendHandoff: (
    sessionId: string,
    choice: { id: string; revision: number } | undefined,
    ctx: RunContext,
    fields: FormFields | undefined,
    formId?: string
  ) => Promise<unknown>
) {
  const runKey = (ctx: RunContext) =>
    JSON.stringify([ctx.sessionKey, ctx.runId]);
  const preparedForms = new Map<string, number>();
  const legacyDeliveries = new Map<string, Set<string>>();
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
    const fields = formFieldsSchema.safeParse(args.fields);
    const formId =
      typeof args.form_id === 'string' && /^[a-f0-9-]{36}$/.test(args.form_id)
        ? args.form_id
        : undefined;
    if (
      (!fields.success && !formId) ||
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

    const legacyKey = runKey(ctx);
    if (formId) {
      const now = Date.now();
      for (const [form, deadline] of preparedForms) {
        if (deadline <= now) preparedForms.delete(form);
      }
      const key = `${sessionId}:${formId}`;
      if (preparedForms.has(key)) return;
      // A prepared form is single-use even if the card is cancelled or fails
      // to send. Keep the claim for the form's lifetime, across agent turns.
      preparedForms.set(key, now + PREPARED_FORM_LIFETIME_MS);
    } else {
      const delivered = legacyDeliveries.get(legacyKey) ?? new Set<string>();
      if (delivered.has(sessionId)) return;
      delivered.add(sessionId);
      legacyDeliveries.set(legacyKey, delivered);
    }
    const requested = record(args.record);
    const choice =
      typeof requested.id === 'string' &&
      typeof requested.revision === 'number' &&
      Number.isInteger(requested.revision) &&
      requested.revision > 0
        ? { id: requested.id, revision: requested.revision }
        : undefined;
    if (formId) await sendHandoff(sessionId, choice, ctx, undefined, formId);
    else {
      try {
        await sendHandoff(
          sessionId,
          choice,
          ctx,
          fields.success ? fields.data : undefined
        );
      } catch (error) {
        legacyDeliveries.get(legacyKey)?.delete(sessionId);
        throw error;
      }
    }
  };
  return {
    handle,
    endRun: (ctx: RunContext) => {
      legacyDeliveries.delete(runKey(ctx));
    },
  };
}

import { z } from 'zod';

import {
  BrowserHandoffCleanupError,
  formFieldsSchema,
} from './browser-session-handoff.js';

export const BROWSER_LOGIN_TOOL = 'tlon_browser_login';
export const BROWSER_LOGIN_MCP_USE_REASON =
  'Use tlon_browser_login to request approval for a prepared saved login. Use browser_login through MCP for list and prepare.';

const inputSchema = z
  .object({
    session_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/),
    form_id: z.string().uuid().optional(),
    record: z
      .object({
        id: z.string().min(1).max(128),
        revision: z.number().int().positive(),
      })
      .strict()
      .optional(),
    bindings: z
      .array(
        z
          .object({
            sourceField: z.string().min(1).max(64),
            targetField: z.string().regex(/^f[0-9]{1,2}$/),
          })
          .strict()
      )
      .min(1)
      .max(2)
      .optional(),
    fields: formFieldsSchema.optional(),
  })
  .strict();
type LoginInput = z.infer<typeof inputSchema>;
type Conversation = { sessionKey?: string; sessionId?: string };
type McpResult = { metadata: Record<string, unknown>; isError: boolean };
const PREPARED_FORM_LIFETIME_MS = 5 * 60_000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isDirectBrowserLoginUse(params: Record<string, unknown>) {
  if (
    params.name !== 'browser_browser_login' &&
    params.name !== 'browser_login'
  )
    return false;
  let args = params.arguments;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return true;
    }
  }
  const action = record(args).action;
  return action !== 'list' && action !== 'prepare';
}

function result(status: string, text: string, sessionId?: string) {
  return {
    content: [{ type: 'text' as const, text }],
    details: { status, ...(sessionId ? { session_id: sessionId } : {}) },
  };
}

export const browserLoginToolDefinition = {
  name: BROWSER_LOGIN_TOOL,
  label: 'Tlon Saved Login',
  description:
    'Use a saved website login in the current browser session. First list saved logins and prepare the form with browser_login through MCP. Supply the prepared form ID, selected record, and explicit field bindings. This tool waits for card delivery and returns its outcome. The owner approves in Tlon.',
  parameters: z.toJSONSchema(inputSchema),
};

export function createBrowserLoginApprovalExecutor({
  isPending,
  requestLogin,
  sendHandoff,
  warn,
}: {
  isPending: (sessionId: string) => Promise<boolean>;
  requestLogin: (args: LoginInput, signal?: AbortSignal) => Promise<McpResult>;
  sendHandoff: (args: LoginInput, ctx: Conversation) => Promise<unknown>;
  warn: (message: string) => void;
}) {
  const preparedForms = new Map<string, number>();
  return async (params: unknown, ctx: Conversation, signal?: AbortSignal) => {
    const parsed = inputSchema.safeParse(params);
    if (!parsed.success)
      return result(
        'invalid_request',
        'Supply a valid browser session and saved login selection.'
      );
    const args = parsed.data;
    const sessionId = args.session_id;
    if (
      !ctx.sessionKey ||
      (args.form_id
        ? !args.record || !args.bindings
        : !args.fields || !!args.bindings)
    )
      return result(
        'invalid_request',
        'Use an active conversation. Prepare the login form and provide its ID, selected record, and field bindings.',
        sessionId
      );
    const key = args.form_id ? `${sessionId}:${args.form_id}` : undefined;
    const now = Date.now();
    for (const [form, deadline] of preparedForms) {
      if (deadline <= now) preparedForms.delete(form);
    }
    const alreadyRequested = () =>
      result(
        'login_already_requested',
        'This prepared login was already requested. Start with a fresh form only if the owner asks again.',
        sessionId
      );
    if (key && preparedForms.has(key)) return alreadyRequested();
    if (await isPending(sessionId))
      return result(
        'secure_entry_pending',
        'This browser is waiting for secure entry. Wait for its result.',
        sessionId
      );

    let response: McpResult;
    try {
      response = await requestLogin(args, signal);
    } catch {
      warn('Could not request saved login from the browser service.');
      return result(
        'login_unavailable',
        'Could not request the saved login. This attempt could not proceed.',
        sessionId
      );
    }
    const status = record(response.metadata.login).status;
    if (response.isError || response.metadata.session_id !== sessionId)
      return result(
        'login_unavailable',
        'The browser service rejected this saved-login request. Check the selected record and bindings before starting another attempt.',
        sessionId
      );
    if (status === 'filled')
      return result(
        'filled',
        'Saved login fields were filled securely without submitting. Inspect the page before continuing.',
        sessionId
      );
    if (status !== 'approval_required')
      return result(
        'login_unavailable',
        'The browser service did not accept this login for owner approval.',
        sessionId
      );

    if (key) {
      if (preparedForms.has(key)) return alreadyRequested();
      // Keep the claim across turns for the lifetime of the prepared form.
      preparedForms.set(key, Date.now() + PREPARED_FORM_LIFETIME_MS);
    }
    try {
      await sendHandoff(args, ctx);
      return result(
        'approval_pending',
        'The saved-login approval card was sent. End this turn with NO_REPLY and wait for the secure-entry result to resume the conversation.',
        sessionId
      );
    } catch (error) {
      if (error instanceof BrowserHandoffCleanupError) {
        warn(
          'Could not send the saved-login approval card or confirm cleanup.'
        );
        return result(
          'delivery_failed',
          'The saved-login approval card could not be sent. Cleanup could not be confirmed. Tell the owner what happened and wait for a new request before another login.',
          sessionId
        );
      }
      warn('Could not send the saved-login approval card.');
      return result(
        'delivery_failed',
        'The saved-login approval card could not be sent. This attempt ended. Tell the owner the card could not be sent and close the browser if the task is finished. Start a fresh login only if the owner asks again.',
        sessionId
      );
    }
  };
}

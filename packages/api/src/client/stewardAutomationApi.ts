import { z } from 'zod';

import type * as ub from '../urbit';
import { requestJson, scry, subscribe } from './urbit';

/**
 * Client for %steward's automation module on the owner ship: read the
 * mirrored task map, and create / update / delete a bot's tasks through
 * the HTTP edit loop at /steward/~/v1/automation.
 *
 * Each edit is a POST held open until the terminal response or the owner's
 * 20-second pending wake. The envelope's `body.type` decides the outcome:
 * `created` / `updated` / `deleted` resolve, `error` throws a
 * StewardAutomationEditError carrying the typed error, and `pending` throws
 * a StewardAutomationPendingError carrying the request id so the caller can
 * pick the result up later with getAutomationRequest. The mirror is the
 * confirmation: an accepted edit shows up as a `set` / `del` on the tasks
 * feed once the harness re-projects.
 */

const AUTOMATION_V1_PATH = '/steward/~/v1/automation';
const REQUEST_V1_PATH = `${AUTOMATION_V1_PATH}/request`;
const TASKS_V1_PATH = `${AUTOMATION_V1_PATH}/tasks`;
const TASKS_FEED = { app: 'steward', path: '/v1/automation/tasks' };

// Typed failure from the automation action-error union. `errorType` mirrors
// the wire's `errorType`; `harness-offline` means no plugin is attached to
// the bot, so the edit was refused without waiting.
export class StewardAutomationEditError extends Error {
  readonly errorType: string;
  readonly requestId: string;

  constructor(message: string, errorType: string, requestId: string) {
    super(message);
    this.name = 'StewardAutomationEditError';
    this.errorType = errorType;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// The owner's pending wake fired before the bot answered. The request stays
// open on the owner; poll getAutomationRequest(requestId) for the result, or
// watch the tasks feed for the change itself.
export class StewardAutomationPendingError extends Error {
  readonly requestId: string;
  readonly status: string;

  constructor(requestId: string, status: string) {
    super('%steward automation edit is still pending');
    this.name = 'StewardAutomationPendingError';
    this.requestId = requestId;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const responseBodySchema = z.union([
  z.object({
    type: z.enum(['created', 'updated', 'deleted']),
    id: z.string(),
  }),
  z.object({
    type: z.literal('error'),
    errorType: z.string(),
    message: z.array(z.string()).default([]),
  }),
  z.object({
    type: z.literal('pending'),
    status: z.string(),
  }),
]);

const responseSchema = z.object({
  requestId: z.string(),
  body: responseBodySchema,
});

function parseResponse(raw: unknown): ub.StewardAutomationResponse {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Unexpected %steward automation response: ${parsed.error.issues[0]?.message ?? 'malformed envelope'}`
    );
  }
  return parsed.data;
}

function errorMessage(
  body: Extract<ub.StewardAutomationResponseBody, { type: 'error' }>
): string {
  const detail = body.message.map((line) => line.trim()).filter(Boolean);
  return `%steward automation error (${body.errorType})${
    detail.length ? `: ${detail.join('\n')}` : ''
  }`;
}

export interface StewardAutomationEditResult {
  requestId: string;
  /** The harness's job id: the created id, or the id that was updated or deleted. */
  id: string;
}

/**
 * POST one edit and resolve its terminal envelope. Throws
 * StewardAutomationEditError on `error`, StewardAutomationPendingError on
 * `pending`.
 */
export async function editAutomation(
  request: ub.StewardAutomationEditRequest
): Promise<StewardAutomationEditResult> {
  const raw = await requestJson(AUTOMATION_V1_PATH, 'POST', request);
  const response = parseResponse(raw);
  return settle(response);
}

function settle(
  response: ub.StewardAutomationResponse
): StewardAutomationEditResult {
  const { body } = response;
  switch (body.type) {
    case 'created':
    case 'updated':
    case 'deleted':
      return { requestId: response.requestId, id: body.id };
    case 'error':
      throw new StewardAutomationEditError(
        errorMessage(body),
        body.errorType,
        response.requestId
      );
    case 'pending':
      throw new StewardAutomationPendingError(response.requestId, body.status);
  }
}

/** Create a task on `bot`. Resolves with the job id the harness assigned. */
export function createAutomation(params: {
  bot: string;
  task: ub.StewardAutomationTask;
  requestId?: string;
}): Promise<StewardAutomationEditResult> {
  return editAutomation({
    ...(params.requestId ? { requestId: params.requestId } : {}),
    bot: params.bot,
    action: { create: params.task },
  });
}

/** Patch task `id` on `bot`; only the fields present in `task` change. */
export function updateAutomation(params: {
  bot: string;
  id: string;
  task: ub.StewardAutomationTask;
  requestId?: string;
}): Promise<StewardAutomationEditResult> {
  return editAutomation({
    ...(params.requestId ? { requestId: params.requestId } : {}),
    bot: params.bot,
    action: { update: { id: params.id, ...params.task } },
  });
}

/** Delete task `id` on `bot`. */
export function deleteAutomation(params: {
  bot: string;
  id: string;
  requestId?: string;
}): Promise<StewardAutomationEditResult> {
  return editAutomation({
    ...(params.requestId ? { requestId: params.requestId } : {}),
    bot: params.bot,
    action: { delete: { id: params.id } },
  });
}

/**
 * The current envelope for a request, `pending` while the owner is still
 * waiting. Unlike editAutomation this never throws on the body: it is the
 * polling escape hatch after a StewardAutomationPendingError. 404 (unknown
 * or swept request) surfaces as a BadResponseError from requestJson.
 */
export async function getAutomationRequest(
  requestId: string
): Promise<ub.StewardAutomationResponse> {
  const raw = await requestJson(`${REQUEST_V1_PATH}/${requestId}`, 'GET');
  return parseResponse(raw);
}

/**
 * Resolve a pending edit by polling getAutomationRequest until it is
 * terminal. Resolves or throws exactly like editAutomation.
 */
export async function awaitAutomationRequest(
  requestId: string,
  options: { intervalMs?: number; attempts?: number } = {}
): Promise<StewardAutomationEditResult> {
  const intervalMs = options.intervalMs ?? 2_000;
  const attempts = options.attempts ?? 30;
  let last: ub.StewardAutomationResponse | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await getAutomationRequest(requestId);
    if (last.body.type !== 'pending') {
      return settle(last);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new StewardAutomationPendingError(
    requestId,
    last?.body.type === 'pending' ? last.body.status : 'sending'
  );
}

/** The mirror: every ship's tasks keyed by `~ship`, over HTTP. */
export async function getAutomations(): Promise<ub.StewardAutomationShipTasks> {
  return requestJson<ub.StewardAutomationShipTasks>(TASKS_V1_PATH, 'GET');
}

/** The mirror via scry, for callers already on a channel. */
export async function scryAutomations(): Promise<ub.StewardAutomationShipTasks> {
  return scry<ub.StewardAutomationShipTasks>({
    app: 'steward',
    path: '/v1/automation/tasks',
  });
}

/**
 * Live updates to the mirror. The first fact is a complete `tasks`
 * snapshot; thereafter `set` / `del` per task and `gone` when a bot's
 * entry is removed. Resolves with the subscription id for unsubscribe.
 */
export function subscribeToAutomations(
  handler: (update: ub.StewardAutomationUpdate) => void
): Promise<number> {
  return subscribe<ub.StewardAutomationUpdate>(TASKS_FEED, handler);
}

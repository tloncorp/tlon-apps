/**
 * Wire types for the %steward agent's automation module: the mirrored task
 * map, the feed that keeps it current, and the owner edit loop. See
 * desk/sur/steward/automation.hoon and docs/backend/desk/app/steward.md.
 */

export type StewardAutomationSchedule =
  | { kind: 'cron'; expr?: string; tz?: string; staggerMs?: number }
  | { kind: 'at'; at?: number }
  | { kind: 'every'; everyMs?: number; anchorMs?: number };

export interface StewardAutomationPayload {
  kind?: string;
  message?: string;
}

/** A task definition. Every field is optional; an update carries a patch in this shape. */
export interface StewardAutomationTask {
  agentId?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  schedule?: StewardAutomationSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload?: StewardAutomationPayload;
  createdAtMs?: number;
  updatedAtMs?: number;
}

/** One ship's tasks keyed by the harness's job id. */
export type StewardAutomationTasks = Record<string, StewardAutomationTask>;

/** The mirror: every ship's tasks keyed by `~ship`. */
export type StewardAutomationShipTasks = Record<string, StewardAutomationTasks>;

/** The `u-automation` fact on /v1/automation/tasks. */
export type StewardAutomationUpdate =
  | { tasks: StewardAutomationShipTasks }
  | { set: { ship: string; id: string; task: StewardAutomationTask } }
  | { del: { ship: string; id: string } }
  | { gone: { ship: string } };

/** The edit verb. */
export type StewardAutomationEdit =
  | { create: StewardAutomationTask }
  | { update: { id: string } & StewardAutomationTask }
  | { delete: { id: string } };

/** POST /steward/~/v1/automation body. `requestId` is minted when absent. */
export interface StewardAutomationEditRequest {
  requestId?: string;
  bot: string;
  action: StewardAutomationEdit;
}

export type StewardAutomationErrorType =
  | 'not-authorized'
  | 'not-found'
  | 'invalid'
  | 'harness-offline'
  | 'harness-error'
  | 'unknown';

export type StewardAutomationPokeStatus = 'sending' | 'acked' | 'nacked';

export type StewardAutomationResponseBody =
  | { type: 'created' | 'updated' | 'deleted'; id: string }
  | {
      type: 'error';
      errorType: StewardAutomationErrorType | string;
      message: string[];
    }
  | { type: 'pending'; status: StewardAutomationPokeStatus | string };

/** The per-request envelope: the POST body on completion, the GET by id, and the /v1/automation/request/<uv> fact. */
export interface StewardAutomationResponse {
  requestId: string;
  body: StewardAutomationResponseBody;
}

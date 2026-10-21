import type { AgentEndEvent, AgentHookContext } from './agent-hook-types.js';
import type { CronChangedEvent } from './cron-telemetry.js';

import { sharedMap } from './shared-state.js';
import { isSuccessfulSilentAgentOutput } from './silent-reply.js';

type CronOutput = {
  runId: string;
  sessionId: string;
  silent: boolean;
};

// Discovery/prewarm and activation can load separate copies of the plugin.
// Keep only bounded, content-free evidence, consumed by the terminal cron hook.
const outputs = sharedMap<string, CronOutput>('cronSilence.outputs');

export function beginCronSilenceObservation(ctx: AgentHookContext): void {
  if (!ctx.sessionKey) return;
  const existing = outputs.get(ctx.sessionKey);
  const sameRun =
    existing !== undefined &&
    existing.runId === ctx.runId &&
    (!ctx.sessionId || existing.sessionId === ctx.sessionId);
  // Model hooks can omit identity fields supplied by agent_turn_prepare.
  // Only inherit them for the same run without a conflicting session ID.
  const trigger = ctx.trigger ?? (sameRun ? 'cron' : undefined);
  const sessionId = ctx.sessionId ?? (sameRun ? existing.sessionId : undefined);
  // A later interactive turn must invalidate any unconsumed cron evidence too.
  outputs.delete(ctx.sessionKey);
  if (trigger !== 'cron' || !ctx.runId || !sessionId) return;
  outputs.set(ctx.sessionKey, {
    runId: ctx.runId,
    sessionId,
    silent: false,
  });
  while (outputs.size > 512) {
    const oldest = outputs.keys().next().value;
    if (oldest === undefined) break;
    outputs.delete(oldest);
  }
}

export function recordCronSilenceOutput(
  event: AgentEndEvent,
  ctx: AgentHookContext
): void {
  const entry = ctx.sessionKey ? outputs.get(ctx.sessionKey) : undefined;
  if (!entry || entry.runId !== ctx.runId || entry.sessionId !== ctx.sessionId)
    return;
  entry.silent = isSuccessfulSilentAgentOutput(event);
}

export function consumeCronSilenceOutput(event: CronChangedEvent): boolean {
  if (!event.sessionKey) return false;
  const entry = outputs.get(event.sessionKey);
  outputs.delete(event.sessionKey);
  return (
    (event.sessionTarget ?? event.job?.sessionTarget) === 'isolated' &&
    !!entry &&
    entry.sessionId === event.sessionId &&
    entry.silent
  );
}

export function clearCronSilenceObservations(): void {
  outputs.clear();
}

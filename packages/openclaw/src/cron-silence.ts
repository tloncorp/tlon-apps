import type {
  PluginHookAgentContext,
  PluginHookAgentEndEvent,
  PluginHookCronChangedEvent,
} from 'openclaw/plugin-sdk/types';

import { sharedMap } from './shared-state.js';

type CronOutput = {
  runId: string;
  sessionId: string;
  silent: boolean;
};

// Discovery/prewarm and activation can load separate copies of the plugin.
// Keep only bounded, content-free evidence, consumed by the terminal cron hook.
const outputs = sharedMap<string, CronOutput>('cronSilence.outputs');

export function isExplicitSilentReply(text: string | undefined): boolean {
  return text?.trim().toUpperCase() === 'NO_REPLY';
}

export function beginCronSilenceObservation(ctx: PluginHookAgentContext): void {
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
  event: PluginHookAgentEndEvent,
  ctx: PluginHookAgentContext
): void {
  const entry = ctx.sessionKey ? outputs.get(ctx.sessionKey) : undefined;
  if (!entry || entry.runId !== ctx.runId || entry.sessionId !== ctx.sessionId)
    return;
  entry.silent = false;
  if (!event.success || event.error) return;
  const last = event.messages.at(-1);
  if (!last || typeof last !== 'object') return;
  const message = last as { role?: unknown; content?: unknown };
  if (message.role !== 'assistant' || !Array.isArray(message.content)) return;
  const texts: string[] = [];
  for (const block of message.content) {
    if (!block || typeof block !== 'object') return;
    if (block.type === 'thinking') continue;
    if (block.type !== 'text' || typeof block.text !== 'string') return;
    texts.push(block.text);
  }
  entry.silent = isExplicitSilentReply(texts.join('\n'));
}

export function consumeCronSilenceOutput(
  event: PluginHookCronChangedEvent
): boolean {
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

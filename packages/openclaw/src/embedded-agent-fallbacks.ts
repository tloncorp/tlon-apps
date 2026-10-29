import { rm } from 'node:fs/promises';
import type {
  OpenClawConfig,
  OpenClawPluginApi,
} from 'openclaw/plugin-sdk/core';

type RunEmbeddedAgent =
  OpenClawPluginApi['runtime']['agent']['runEmbeddedAgent'];

/** An agent's configured model fallbacks, as OpenClaw resolves them. */
export function configuredModelFallbacks(
  config: OpenClawConfig,
  agentId: string
): string[] {
  const agentModel = config.agents?.list?.find(
    (agent) => agent.id.trim().toLowerCase() === agentId.trim().toLowerCase()
  )?.model;
  // Match OpenClaw 2026.7.1: an agent-specific primary opts out of global
  // fallbacks unless that agent also supplies its own fallback list.
  const model = agentModel || config.agents?.defaults?.model;
  if (!model || typeof model === 'string') return [];
  const defaults = config.agents?.defaults?.model;
  const fallbacks =
    model.fallbacks ??
    (model.primary?.trim() || typeof defaults === 'string'
      ? []
      : (defaults?.fallbacks ?? []));
  return [...new Set(fallbacks.map((ref) => ref.trim()))].filter(
    (ref) => ref && ref !== model.primary?.trim()
  );
}

const PROVIDER_FAILOVER_REASONS = new Set([
  'auth',
  'auth_permanent',
  'billing',
  'rate_limit',
  'overloaded',
  'timeout',
  'server_error',
  'model_not_found',
]);

/**
 * Run an embedded agent turn, failing over to the next model the way a
 * scheduled run would. The SDK resolves the primary but leaves failover to
 * its caller. Only a structured provider failure before any tool has run is
 * retried, since replaying a turn that already acted could act twice.
 *
 * `primary` is the model to start with (the config's own when unset), and
 * `fallbacks` the models after it (the agent's configured ones when unset).
 */
export async function runEmbeddedAgentWithFallbacks(
  deps: {
    runEmbeddedAgent: RunEmbeddedAgent;
    logger: { warn: (message: string) => void };
  },
  params: Parameters<RunEmbeddedAgent>[0] & {
    config: OpenClawConfig;
    agentId: string;
    sessionFile: string;
  },
  options: { label: string; primary?: string; fallbacks?: string[] }
) {
  const fallbacks =
    options.fallbacks ??
    configuredModelFallbacks(params.config, params.agentId);
  const candidates = [options.primary, ...fallbacks];
  const deadline = Date.now() + params.timeoutMs;
  let toolStarted = false;
  for (const [index, model] of candidates.entries()) {
    params.abortSignal?.throwIfAborted();
    if (Date.now() >= deadline)
      throw new Error(`${options.label} model timeout`);
    try {
      return await deps.runEmbeddedAgent({
        ...params,
        model,
        timeoutMs: Math.max(1, deadline - Date.now()),
        modelFallbacksOverride: fallbacks.slice(index),
        // Let core probe another model after a transient provider cooldown.
        allowTransientCooldownProbe: index > 0,
        onAgentEvent: (event) => {
          if (event.stream === 'tool') toolStarted = true;
        },
      });
    } catch (error) {
      if (
        params.abortSignal?.aborted ||
        toolStarted ||
        index === candidates.length - 1 ||
        Date.now() >= deadline ||
        !error ||
        typeof error !== 'object' ||
        !('name' in error) ||
        error.name !== 'FailoverError' ||
        !('reason' in error) ||
        !PROVIDER_FAILOVER_REASONS.has(String(error.reason))
      )
        throw error;
      deps.logger.warn(
        `[tlon] ${options.label} trying fallback ${candidates[index + 1]} (${String(error.reason)})`
      );
      // A scratch transcript and no tool has run: start the next model with
      // just the prompt, without the failed attempt's text.
      await rm(params.sessionFile, { force: true });
    }
  }
  throw new Error(`${options.label} exhausted model candidates`);
}

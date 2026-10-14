import { describe, expect, it } from 'vitest';

import entry from '../index.js';
import { PERSONAL_CLAIMS_CONTEXT } from './personal-claims-context.js';

type PromptBuildHandler = (
  event: { prompt: string; messages: unknown[] },
  ctx: { modelProviderId?: string; modelId?: string }
) => { appendSystemContext?: string } | undefined;

/**
 * Registers the plugin against a stand-in api that records hooks. Every other
 * member returns the same proxy, so registration runs without a gateway.
 */
function registerPromptBuildHook(): PromptBuildHandler {
  const hooks = new Map<string, unknown>();
  const proxy: unknown = new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === 'registrationMode') return 'full';
      // Both api.config and api.runtime.config land here.
      if (prop === 'config') return { loadConfig: () => ({}) };
      if (prop === 'on') {
        return (name: string, handler: unknown) => hooks.set(name, handler);
      }
      // `then` must stay undefined so an awaited proxy resolves to itself.
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      return proxy;
    },
    apply: () => proxy,
  });
  entry.register(proxy as never);
  return hooks.get('before_prompt_build') as PromptBuildHandler;
}

const EVENT = { prompt: '', messages: [] };

describe('before_prompt_build system context', () => {
  const handler = registerPromptBuildHook();

  it.each([
    ['a direct provider', 'anthropic', 'claude-sonnet-4-6'],
    ['an OpenRouter model', 'openrouter', 'openai/gpt-6-luna'],
  ])(
    'bounds personal claims and keeps the privacy note on %s',
    (_, provider, model) => {
      const context = handler(EVENT, {
        modelProviderId: provider,
        modelId: model,
      })?.appendSystemContext;

      expect(context?.startsWith(PERSONAL_CLAIMS_CONTEXT)).toBe(true);
      expect(context).toContain('Data retention: ');
    }
  );

  it('bounds personal claims when the run names no model', () => {
    expect(handler(EVENT, {})?.appendSystemContext).toBe(
      PERSONAL_CLAIMS_CONTEXT
    );
  });
});

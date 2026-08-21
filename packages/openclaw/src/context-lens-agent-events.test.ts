import type {
  OpenClawPluginApi,
  PluginAgentEventSubscriptionRegistration,
} from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import { registerContextLensAgentEvents } from './context-lens-agent-events.js';
import { subscribeToContextLensEvents } from './context-lens-events.js';
import {
  bindContextLensToRun,
  createContextLensRegistry,
  unbindContextLensFromRun,
} from './context-lens.js';

function makeApi(registrations: PluginAgentEventSubscriptionRegistration[]) {
  return {
    agent: {
      events: {
        registerAgentEventSubscription: (
          registration: PluginAgentEventSubscriptionRegistration
        ) => registrations.push(registration),
      },
    },
    logger: { info: () => {} },
  } as unknown as OpenClawPluginApi;
}

describe('Context Lens OpenClaw agent-event adapter', () => {
  it('does not register when Context Lens has no reader path', () => {
    const registrations: PluginAgentEventSubscriptionRegistration[] = [];
    expect(registerContextLensAgentEvents(makeApi(registrations), false)).toBe(
      false
    );
    expect(registrations).toEqual([]);
  });

  it('uses the namespaced 7.1 subscription and publishes correlated activity', async () => {
    const registrations: PluginAgentEventSubscriptionRegistration[] = [];
    expect(registerContextLensAgentEvents(makeApi(registrations), true)).toBe(
      true
    );
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.streams).not.toContain('thinking');
    expect(registrations[0]?.streams).not.toContain('assistant');
    expect(registrations[0]?.streams).toContain('tlon.request_input');

    const registry = createContextLensRegistry();
    const runId = 'adapter-run-1';
    const lens = registry.create({
      messageId: 'adapter-message-1',
      chatType: 'dm',
      sessionKey: 'adapter-session-1',
    });
    bindContextLensToRun(runId, registry, lens.lensId);

    const received: string[] = [];
    const unsubscribe = subscribeToContextLensEvents((event) => {
      if (event.lens.lensId === lens.lensId) {
        received.push(event.detail?.activity?.progressText ?? 'missing');
      }
    });

    try {
      await registrations[0]?.handle(
        {
          runId,
          sessionKey: 'adapter-session-1',
          seq: 1,
          ts: 1_000,
          stream: 'item',
          data: {
            itemId: 'commentary-1',
            kind: 'preamble',
            phase: 'update',
            progressText: 'Mapping the live event',
          },
        },
        {
          getRunContext: () => undefined,
          setRunContext: () => {},
          clearRunContext: () => {},
        }
      );
      await registrations[0]?.handle(
        {
          runId,
          sessionKey: 'adapter-session-1',
          seq: 2,
          ts: 1_100,
          stream: 'codex_app_server.item',
          data: {
            itemId: 'commentary-1',
            type: 'agentMessage',
            phase: 'completed',
          },
        },
        {
          getRunContext: () => undefined,
          setRunContext: () => {},
          clearRunContext: () => {},
        }
      );
    } finally {
      unsubscribe();
      unbindContextLensFromRun(runId, lens.lensId);
    }

    expect(received).toEqual(['Mapping the live event', 'missing']);
    expect(registry.get(lens.lensId)?.activity.items).toEqual([
      expect.objectContaining({
        id: 'commentary-1',
        kind: 'commentary',
        progressText: 'Mapping the live event',
        status: 'completed',
      }),
    ]);
  });

  it('ignores completion markers for final assistant answers', async () => {
    const registrations: PluginAgentEventSubscriptionRegistration[] = [];
    registerContextLensAgentEvents(makeApi(registrations), true);
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'adapter-message-2',
      chatType: 'dm',
    });
    bindContextLensToRun('adapter-run-2', registry, lens.lensId);

    try {
      await registrations[0]?.handle(
        {
          runId: 'adapter-run-2',
          seq: 1,
          ts: 1_000,
          stream: 'codex_app_server.item',
          data: {
            itemId: 'final-answer-1',
            type: 'agentMessage',
            phase: 'completed',
          },
        },
        {
          getRunContext: () => undefined,
          setRunContext: () => {},
          clearRunContext: () => {},
        }
      );
    } finally {
      unbindContextLensFromRun('adapter-run-2', lens.lensId);
    }

    expect(registry.get(lens.lensId)?.activity.items).toEqual([]);
  });

  it('records a plugin-owned requester gate without inferring it from prose', async () => {
    const registrations: PluginAgentEventSubscriptionRegistration[] = [];
    registerContextLensAgentEvents(makeApi(registrations), true);
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'adapter-message-3',
      chatType: 'dm',
    });
    bindContextLensToRun('adapter-run-3', registry, lens.lensId);

    try {
      await registrations[0]?.handle(
        {
          runId: 'adapter-run-3',
          seq: 1,
          ts: 1_000,
          stream: 'tlon.request_input',
          data: {
            phase: 'requested',
            status: 'waiting',
            itemId: 'request-input:call-1',
            title: 'Which group should I create?',
            source: 'tlon_request_input',
            toolCallId: 'call-1',
          },
        },
        {
          getRunContext: () => undefined,
          setRunContext: () => {},
          clearRunContext: () => {},
        }
      );
    } finally {
      unbindContextLensFromRun('adapter-run-3', lens.lensId);
    }

    expect(registry.get(lens.lensId)?.activity.items).toEqual([
      expect.objectContaining({
        id: 'request-input:call-1',
        kind: 'request_input',
        title: 'Which group should I create?',
        status: 'waiting',
        toolCallId: 'call-1',
      }),
    ]);
  });
});

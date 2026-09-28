import { access } from 'node:fs/promises';
import { beforeEach, expect, it, vi } from 'vitest';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { personalizeTip, type TipDraft } from './personalize.js';

const run = vi.hoisted(() => vi.fn());
vi.mock('../../runtime.js', () => ({
  getTlonRuntime: () => ({
    channel: { routing: { resolveAgentRoute: () => ({ agentId: 'main' }) } },
    agent: { runEmbeddedAgent: run, resolveAgentDir: () => '/agent-auth' },
  }),
}));
const draft: TipDraft = {
  step: 'recurring-help',
  text: 'Want a weekly update?',
  state: {
    owner: '~ten',
    version: 1,
    enrolledAt: 1,
    status: 'active',
    topic: 'architecture',
    purpose: 'work',
    lastOwnerText: 'I prepare client meetings every Friday.',
    sent: [],
    skipped: [],
  },
};
beforeEach(() => {
  run.mockReset();
  run.mockResolvedValue({
    meta: {},
    payloads: [
      {
        text: 'Before your Friday client meetings, I could prepare a company update. Want to try one?',
      },
    ],
  });
});
it('uses configured inference without tools or delivery and removes its scratch transcript', async () => {
  const text = await personalizeTip(draft, {} as OpenClawConfig, 'default');
  expect(text).toContain('Friday client meetings');
  const params = run.mock.calls[0][0];
  expect(params).toMatchObject({
    modelRun: true,
    disableTools: true,
    disableMessageTool: true,
    toolsAllow: [],
    timeoutMs: 15000,
    agentId: 'main',
    agentAccountId: 'default',
  });
  expect(params.prompt).toContain('client meetings');
  expect(params.prompt).toContain('untrusted background');
  await expect(access(params.workspaceDir)).rejects.toThrow();
});
it('skips inference without useful user context', async () => {
  await expect(
    personalizeTip(
      {
        ...draft,
        state: {
          ...draft.state,
          topic: undefined,
          purpose: undefined,
          lastOwnerText: undefined,
        },
      },
      {},
      'default'
    )
  ).resolves.toBeUndefined();
  expect(run).not.toHaveBeenCalled();
});
it.each([
  {
    meta: { error: { message: 'provider failed' } },
    payloads: [{ text: 'partial output' }],
  },
  { meta: { aborted: true }, payloads: [{ text: 'partial output' }] },
  { meta: {}, payloads: [{ text: 'NO_REPLY' }] },
  { meta: {}, payloads: [{ text: 'x'.repeat(801) }] },
  { meta: {}, payloads: [{ text: 'provider failure', isError: true }] },
])('falls back for unusable generation %#', async (result) => {
  run.mockResolvedValue(result);
  expect(await personalizeTip(draft, {}, 'default')).toBeUndefined();
});
it('cleans up after a rejected model request', async () => {
  run.mockRejectedValue(new Error('offline'));
  await expect(personalizeTip(draft, {}, 'default')).rejects.toThrow('offline');
  await expect(access(run.mock.calls[0][0].workspaceDir)).rejects.toThrow();
});

it('uses the routed agent model rather than the runner default', async () => {
  await personalizeTip(
    draft,
    {
      agents: {
        defaults: { model: 'openai/default' },
        list: [{ id: 'main', model: 'custom-proxy/my-model' }],
      },
    },
    'default'
  );
  expect(run.mock.calls[0][0]).toMatchObject({
    provider: 'custom-proxy',
    model: 'my-model',
  });
});
it('resolves a configured default model alias', async () => {
  await personalizeTip(
    draft,
    {
      agents: {
        defaults: {
          model: 'fast',
          models: { 'custom-proxy/fast-model': { alias: 'fast' } },
        },
      },
    },
    'default'
  );
  expect(run.mock.calls[0][0]).toMatchObject({
    provider: 'custom-proxy',
    model: 'fast-model',
  });
});

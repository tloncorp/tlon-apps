import { access } from 'node:fs/promises';
import { beforeEach, expect, it, vi } from 'vitest';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import {
  CAMPAIGN_GATE_POLICY,
  TIP_NOT_WORTH_SENDING,
  type TipDraft,
  personalizeTip,
} from './personalize.js';

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
it('asks whether a gated tip is worth sending, with the tips already sent', async () => {
  const gated: TipDraft = {
    ...draft,
    gated: true,
    state: {
      ...draft.state,
      sent: [{ step: 'useful-request', at: 1, text: 'An earlier tip.' }],
    },
  };
  await personalizeTip(gated, {}, 'default');
  expect(run.mock.calls[0][0].prompt).toContain(CAMPAIGN_GATE_POLICY);
  expect(run.mock.calls[0][0].prompt).toContain(
    '"earlierTips":["An earlier tip."]'
  );

  await personalizeTip(draft, {}, 'default');
  expect(run.mock.calls[1][0].prompt).not.toContain(TIP_NOT_WORTH_SENDING);
  expect(run.mock.calls[1][0].prompt).not.toContain('earlierTips');
});
it.each([TIP_NOT_WORTH_SENDING, ` ${TIP_NOT_WORTH_SENDING}.\n`, 'skip_tip'])(
  'reports a gated tip the model turned down: %j',
  async (text) => {
    run.mockResolvedValue({ meta: {}, payloads: [{ text }] });
    expect(
      await personalizeTip({ ...draft, gated: true }, {}, 'default')
    ).toBeNull();
    // Without a gate there is nothing to turn down, so it is just unusable.
    expect(await personalizeTip(draft, {}, 'default')).toBeUndefined();
  }
);
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

import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentTaskPlanToolParams,
  agentTaskPlanToolParameters,
  createAgentTaskPlanToolExecutor,
  resolveOnboardingDmGroupId,
  resolveTaskPlanGroupId,
} from './agent-task-plan-tool.js';

const validPlan: AgentTaskPlanToolParams = {
  target: 'chat/~zod/home-group-chat',
  summary: 'I’ll share a useful design research brief every morning.',
  purposeId: 'agent-research',
  purpose: 'Design research',
  approach: 'Compare primary releases with independent analysis',
  topics: ['AI agents', 'Product design'],
  scheduleHour: 8,
  scheduleMinute: 30,
  scheduleDescription: 'every morning',
  taskPrompt:
    'Find a useful new AI-agent tool for product designers and explain the evidence with source links.',
};
const validGroupId = '~zod/home-group';

const validEvidence = {
  interviewStartMessageId: '~owner/interview-start',
  interviewMessageId: '~owner/interview-final',
  interviewTimezone: 'America/New_York',
};

function executionBoundary() {
  return {
    getEvidence: vi.fn(() => validEvidence),
    resolveGroupId: vi.fn(async () => validGroupId),
    assertCurrent: vi.fn(),
    finish: vi.fn(),
  };
}

describe('agent task plan tool', () => {
  it('keeps trusted and derived fields out of the model schema', () => {
    expect(agentTaskPlanToolParameters.properties).not.toHaveProperty(
      'groupId'
    );
    expect(agentTaskPlanToolParameters.properties).not.toHaveProperty(
      'scheduleExpression'
    );
    expect(agentTaskPlanToolParameters.properties).not.toHaveProperty(
      'surfaceId'
    );
    expect(agentTaskPlanToolParameters.properties).not.toHaveProperty(
      'fallbackSummary'
    );
  });

  it('accepts the furnished bot DM only with its trusted group binding', () => {
    expect(
      resolveOnboardingDmGroupId('~ten', {
        ...validEvidence,
        onboardingTarget: '~ten',
        onboardingGroupId: '~ten/workspace',
      })
    ).toBe('~ten/workspace');
    expect(() =>
      resolveOnboardingDmGroupId('~other', {
        ...validEvidence,
        onboardingTarget: '~ten',
        onboardingGroupId: '~ten/workspace',
      })
    ).toThrow('not bound');
  });

  it('resolves exactly one group from the active channel target', () => {
    expect(
      resolveTaskPlanGroupId(
        JSON.stringify([
          {
            id: '~zod/home-group',
            channels: [{ nest: validPlan.target }],
          },
        ]),
        validPlan.target
      )
    ).toBe('~zod/home-group');
    expect(() => resolveTaskPlanGroupId('[]', validPlan.target)).toThrow(
      'exactly one Tlon group'
    );
    expect(() => resolveTaskPlanGroupId('not json', validPlan.target)).toThrow(
      'could not read'
    );
  });

  it('builds one valid automatic action with fuzzy visible timing', async () => {
    const postPlan = vi.fn(async () => '{}');
    await createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    })('plan', validPlan);
    const blob = JSON.parse(postPlan.mock.calls[0]![0].blob);
    expect(A2UI.validateBlobEntry(blob[0])).toBe(true);
    const serialized = JSON.stringify(blob);
    expect(serialized).toContain('every morning');
    expect(serialized).not.toContain('8:30 AM');
    expect(serialized).not.toContain('Create this task');

    const root = blob[0].messages[1]?.updateComponents?.components.find(
      (component) => component.id === 'root'
    );
    expect(root).toEqual(
      expect.objectContaining({
        children: ['summary', 'auto-provision'],
      })
    );

    const action = blob[0].messages[1]?.updateComponents?.components.find(
      (component) => component.id === 'auto-provision'
    );
    expect(action).toEqual(
      expect.objectContaining({
        action: {
          event: {
            name: 'tlon.provisionAgent',
            context: expect.objectContaining({
              groupId: validGroupId,
              interviewStartMessageId: validEvidence.interviewStartMessageId,
              interviewMessageId: validEvidence.interviewMessageId,
              interviewTimezone: validEvidence.interviewTimezone,
              scheduleExpression: '30 8 * * *',
              taskPrompt: validPlan.taskPrompt,
            }),
          },
        },
      })
    );
  });

  it('accepts model-authored prose without a hardcoded phrase classifier', async () => {
    const execute = createAgentTaskPlanToolExecutor({
      postPlan: vi.fn(async () => '{}'),
      ...executionBoundary(),
    });
    const result = await execute('fuzzy-plan', {
      ...validPlan,
      summary: 'I’ll send a gentle nudge after dinner-ish.',
      scheduleHour: 19,
      scheduleMinute: 30,
      scheduleDescription: 'after dinner-ish',
    });
    expect(result.details).toBeUndefined();
  });

  it('validates explicit and trusted timezones structurally', async () => {
    const postPlan = vi.fn(async () => '{}');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    });
    expect(
      (
        await execute('bad-zone', {
          ...validPlan,
          timezoneOverride: 'not/a-zone',
        })
      ).content[0]?.text
    ).toContain('timezoneOverride');
    const boundary = executionBoundary();
    boundary.getEvidence.mockReturnValue({
      ...validEvidence,
      interviewTimezone: 'not/a-zone',
    });
    const trustedResult = await createAgentTaskPlanToolExecutor({
      postPlan,
      ...boundary,
    })('bad-trusted-zone', validPlan);
    expect(trustedResult.content[0]?.text).toContain(
      'trusted interview timezone'
    );
    expect(postPlan).not.toHaveBeenCalled();
  });

  it('requires a trusted owner message and protocol-bounded fields', async () => {
    const postPlan = vi.fn(async () => '{}');
    const boundary = executionBoundary();
    boundary.getEvidence.mockReturnValue({
      ...validEvidence,
      interviewMessageId: ' ',
    });
    const trustedResult = await createAgentTaskPlanToolExecutor({
      postPlan,
      ...boundary,
    })('missing-owner', validPlan);
    expect(trustedResult.content[0]?.text).toContain('trusted owner interview');
    const longResult = await createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    })('long-summary', { ...validPlan, summary: 'x'.repeat(1001) });
    expect(longResult.content[0]?.text).toContain('1-1000 characters');
    expect(postPlan).not.toHaveBeenCalled();
  });

  it('serializes and posts one plan, then hands status to the coordinator', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const boundary = executionBoundary();
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...boundary,
    });

    const result = await execute('call-1', validPlan);

    expect(result.details).toBeUndefined();
    expect(postPlan).toHaveBeenCalledOnce();
    expect(postPlan.mock.calls[0]?.[0].target).toBe(validPlan.target);
    expect(postPlan.mock.calls[0]?.[0].fallbackSummary).toBe(validPlan.summary);
    expect(result.content[0]?.text).toContain('Return NO_REPLY');
    expect(boundary.finish).toHaveBeenCalledWith('call-1', true);
  });

  it('uses the deterministic group resolver', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const resolveGroupId = vi.fn(async () => '~zod/resolved-group');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
      resolveGroupId,
    });

    await execute('call-resolved', validPlan);

    expect(resolveGroupId).toHaveBeenCalledWith(
      validPlan.target,
      validEvidence
    );
    expect(postPlan.mock.calls[0]?.[0].blob).toContain('~zod/resolved-group');
  });

  it('rechecks freshness after async group resolution', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const boundary = executionBoundary();
    boundary.assertCurrent.mockImplementation(() => {
      throw new Error('newer owner message');
    });
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      resolveGroupId: vi.fn(async () => validGroupId),
      ...boundary,
    });

    const result = await execute('call-stale', validPlan);

    expect(result.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
    expect(boundary.finish).toHaveBeenCalledWith('call-stale', false);
  });

  it('retains the one-plan claim after an ambiguous publication failure', async () => {
    const boundary = executionBoundary();
    const execute = createAgentTaskPlanToolExecutor({
      postPlan: vi.fn(async () => {
        throw new Error('connection closed');
      }),
      ...boundary,
    });

    const result = await execute('call-ambiguous', validPlan);

    expect(result.details).toEqual({ error: true });
    expect(boundary.finish).toHaveBeenCalledWith('call-ambiguous', true);
  });
});

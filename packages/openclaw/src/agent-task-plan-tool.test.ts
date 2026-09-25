import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentTaskPlanToolParams,
  buildAgentTaskPlanBlob,
  createAgentTaskPlanToolExecutor,
  resolveOnboardingDmGroupId,
  resolveTaskPlanGroupId,
} from './agent-task-plan-tool.js';

const validPlan: AgentTaskPlanToolParams = {
  target: 'chat/~zod/home-group-chat',
  fallbackSummary: 'A short design research brief every morning.',
  surfaceId: 'agent-task-plan-test-1',
  summary: 'I’ll share a useful design research brief every morning.',
  groupId: '~zod/home-group',
  purposeId: 'agent-research',
  purpose: 'Design research',
  approach: 'Compare primary releases with independent analysis',
  topics: ['AI agents', 'Product design'],
  scheduleHour: 8,
  scheduleMinute: 30,
  scheduleExpression: '30 8 * * *',
  scheduleDescription: 'every morning',
  taskPrompt:
    'Find a useful new AI-agent tool for product designers and explain the evidence with source links.',
};

const validEvidence = {
  interviewStartMessageId: '~owner/interview-start',
  interviewMessageId: '~owner/interview-final',
  interviewTimezone: 'America/New_York',
};

function executionBoundary() {
  return {
    getEvidence: vi.fn(() => validEvidence),
    assertCurrent: vi.fn(),
    finish: vi.fn(),
  };
}

describe('agent task plan tool', () => {
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

  it('builds one valid automatic action with fuzzy visible timing', () => {
    const blob = buildAgentTaskPlanBlob(validPlan, validEvidence);
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
              groupId: validPlan.groupId,
              interviewStartMessageId: validEvidence.interviewStartMessageId,
              interviewMessageId: validEvidence.interviewMessageId,
              interviewTimezone: validEvidence.interviewTimezone,
              scheduleExpression: validPlan.scheduleExpression,
              taskPrompt: validPlan.taskPrompt,
            }),
          },
        },
      })
    );
  });

  it('accepts model-authored prose without a hardcoded phrase classifier', () => {
    expect(() =>
      buildAgentTaskPlanBlob(
        {
          ...validPlan,
          fallbackSummary: 'A gentle nudge after dinner-ish.',
          summary: 'I’ll send a gentle nudge after dinner-ish.',
          scheduleHour: 19,
          scheduleMinute: 30,
          scheduleExpression: '30 19 * * *',
          scheduleDescription: 'after dinner-ish',
        },
        validEvidence
      )
    ).not.toThrow();
  });

  it('keeps daily schedule fields structurally consistent', () => {
    expect(() =>
      buildAgentTaskPlanBlob(
        { ...validPlan, scheduleExpression: '0 9 * * 1' },
        validEvidence
      )
    ).toThrow('onboarding schedules must be daily');
  });

  it('validates explicit and trusted timezones structurally', () => {
    expect(() =>
      buildAgentTaskPlanBlob(
        { ...validPlan, timezoneOverride: 'not/a-zone' },
        validEvidence
      )
    ).toThrow('timezoneOverride');
    expect(() =>
      buildAgentTaskPlanBlob(validPlan, {
        ...validEvidence,
        interviewTimezone: 'not/a-zone',
      })
    ).toThrow('trusted interview timezone');
  });

  it('requires a trusted owner message and protocol-bounded fields', () => {
    expect(() =>
      buildAgentTaskPlanBlob(validPlan, {
        ...validEvidence,
        interviewMessageId: ' ',
      })
    ).toThrow('trusted owner interview');
    expect(() =>
      buildAgentTaskPlanBlob(
        { ...validPlan, surfaceId: `agent-task-plan-${'x'.repeat(497)}` },
        validEvidence
      )
    ).toThrow('at most 512 characters');
    expect(() =>
      buildAgentTaskPlanBlob(
        { ...validPlan, summary: 'x'.repeat(1001) },
        validEvidence
      )
    ).toThrow('1-1000 characters');
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
    expect(postPlan.mock.calls[0]?.[0].fallbackSummary).toBe(
      validPlan.fallbackSummary
    );
    expect(result.content[0]?.text).toContain('Return NO_REPLY');
    expect(boundary.finish).toHaveBeenCalledWith('call-1', true);
  });

  it('uses the deterministic group resolver instead of the model group id', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const resolveGroupId = vi.fn(async () => '~zod/resolved-group');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      resolveGroupId,
      ...executionBoundary(),
    });

    await execute('call-resolved', {
      ...validPlan,
      groupId: '~zod/mistyped-group',
    });

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
      resolveGroupId: vi.fn(async () => validPlan.groupId),
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

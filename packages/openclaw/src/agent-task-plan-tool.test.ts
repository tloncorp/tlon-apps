import { describe, expect, it, vi } from 'vitest';

import {
  AgentTaskPlanToolParams,
  buildAgentTaskPlanBlob,
  createAgentTaskPlanToolExecutor,
  resolveTaskPlanGroupId,
} from './agent-task-plan-tool.js';

const validPlan: AgentTaskPlanToolParams = {
  target: 'chat/~zod/home-group-chat',
  fallbackSummary: 'Weekday research brief at 8:30 AM.',
  surfaceId: 'agent-task-plan-test-1',
  summary: 'Track agent tools for designers every weekday at 8:30 AM.',
  groupId: '~zod/home-group',
  purposeId: 'agent-research',
  purpose: 'Agent tools research',
  topics: ['AI agents', 'Product design'],
  scheduleHour: 8,
  scheduleMinute: 30,
  scheduleExpression: '30 8 * * 1-5',
  scheduleDescription: 'every weekday at 8:30 AM',
  taskPrompt:
    'Track newly released AI-agent tools for product designers and summarize useful evidence with source links.',
};

describe('agent task plan tool', () => {
  it('resolves the exact current group from the target channel', () => {
    expect(
      resolveTaskPlanGroupId(
        JSON.stringify([
          {
            id: '~zod/other-group',
            channels: [{ nest: 'chat/~zod/other-chat' }],
          },
          {
            id: '~zod/home-group-full',
            channels: [{ nest: validPlan.target }],
          },
        ]),
        validPlan.target
      )
    ).toBe('~zod/home-group-full');
  });

  it('rejects a target that does not identify exactly one group', () => {
    expect(() => resolveTaskPlanGroupId('[]', validPlan.target)).toThrow(
      'exactly one Tlon group'
    );
  });

  it('builds the owner-confirmable A2UI action from typed model input', () => {
    expect(buildAgentTaskPlanBlob(validPlan)).toEqual([
      expect.objectContaining({
        type: 'a2ui',
        messages: expect.arrayContaining([
          expect.objectContaining({
            updateComponents: expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  id: 'confirm',
                  action: {
                    event: {
                      name: 'tlon.provisionAgent',
                      context: expect.objectContaining({
                        groupId: '~zod/home-group',
                        scheduleExpression: '30 8 * * 1-5',
                        taskPrompt:
                          expect.stringContaining('product designers'),
                      }),
                    },
                  },
                }),
              ]),
            }),
          }),
        ]),
      }),
    ]);
  });

  it('serializes and posts one valid blob without model-authored shell quoting', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const execute = createAgentTaskPlanToolExecutor({ postPlan });

    const result = await execute('call-1', validPlan);

    expect(result.details).toBeUndefined();
    expect(postPlan).toHaveBeenCalledOnce();
    const posted = postPlan.mock.calls[0]?.[0];
    expect(posted?.target).toBe(validPlan.target);
    expect(JSON.parse(posted?.blob ?? '')).toEqual(
      buildAgentTaskPlanBlob(validPlan)
    );
  });

  it('replaces a mistyped model group with the deterministic channel group', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const resolveGroupId = vi.fn(async () => '~zod/home-group-full');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      resolveGroupId,
    });

    await execute('call-resolved-group', {
      ...validPlan,
      groupId: '~zod/home-group-ful',
    });

    expect(resolveGroupId).toHaveBeenCalledWith(validPlan.target);
    const posted = postPlan.mock.calls[0]?.[0];
    expect(JSON.parse(posted?.blob ?? '')).toEqual(
      buildAgentTaskPlanBlob({
        ...validPlan,
        groupId: '~zod/home-group-full',
      })
    );
  });

  it('rejects malformed schedules before posting', async () => {
    const postPlan = vi.fn(async () => 'unexpected');
    const execute = createAgentTaskPlanToolExecutor({ postPlan });

    const result = await execute('call-2', {
      ...validPlan,
      scheduleExpression: 'every weekday',
    });

    expect(result.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
  });

  it('rejects contradictory result-count instructions before posting', async () => {
    const postPlan = vi.fn(async () => 'unexpected');
    const execute = createAgentTaskPlanToolExecutor({ postPlan });

    const result = await execute('call-3', {
      ...validPlan,
      taskPrompt:
        'Return exactly three items. If there are fewer than three useful items, return fewer.',
    });

    expect(result.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
  });
});

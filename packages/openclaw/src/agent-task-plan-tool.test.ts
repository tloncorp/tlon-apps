import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  AgentTaskPlanToolParams,
  buildAgentTaskPlanBlob,
  createAgentTaskPlanToolExecutor,
  resolveTaskPlanGroupId,
} from './agent-task-plan-tool.js';

const validPlan: AgentTaskPlanToolParams = {
  target: 'chat/~zod/home-group-chat',
  fallbackSummary: 'Daily research brief at 8:30 AM.',
  surfaceId: 'agent-task-plan-test-1',
  summary: 'Track agent tools for designers daily at 8:30 AM.',
  groupId: '~zod/home-group',
  purposeId: 'agent-research',
  purpose: 'Agent tools research',
  approach: 'Compare primary releases with independent expert analysis',
  topics: ['AI agents', 'Product design'],
  scheduleHour: 8,
  scheduleMinute: 30,
  scheduleExpression: '30 8 * * *',
  scheduleDescription: 'daily at 8:30 AM',
  taskPrompt:
    'Track newly released AI-agent tools for product designers and summarize useful evidence with source links.',
};

const validEvidence = {
  interviewStartMessageId: '~owner/interview-start',
  interviewMessageId: '~owner/interview-1',
};

function executionBoundary() {
  return {
    getEvidence: vi.fn(() => validEvidence),
    assertCurrent: vi.fn(),
    finish: vi.fn(),
  };
}

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

  it('builds an automatic A2UI action without a confirmation control', () => {
    expect(buildAgentTaskPlanBlob(validPlan, validEvidence)).toEqual([
      expect.objectContaining({
        type: 'a2ui',
        version: 2,
        storyMode: 'fallback',
        messages: expect.arrayContaining([
          expect.objectContaining({
            updateComponents: expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  id: 'auto-provision',
                  action: {
                    event: {
                      name: 'tlon.provisionAgent',
                      context: expect.objectContaining({
                        groupId: '~zod/home-group',
                        scheduleExpression: '30 8 * * *',
                        approach: validPlan.approach,
                        taskPrompt: validPlan.taskPrompt,
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
    expect(
      JSON.stringify(buildAgentTaskPlanBlob(validPlan, validEvidence))
    ).toContain(validPlan.summary);
    const serialized = JSON.stringify(
      buildAgentTaskPlanBlob(validPlan, validEvidence)
    );
    expect(serialized).not.toContain('Create this task');
    expect(serialized).toContain('"children":["summary"]');
    expect(
      A2UI.validateBlobEntry(
        buildAgentTaskPlanBlob(validPlan, validEvidence)[0]
      )
    ).toBe(true);
  });

  it('allows the durable approach marker to recover an expired interview start', () => {
    const serialized = JSON.stringify(
      buildAgentTaskPlanBlob(validPlan, {
        interviewMessageId: '~owner/interview-final',
      })
    );
    expect(serialized).toContain('~owner/interview-final');
    expect(serialized).not.toContain('interviewStartMessageId');
  });

  it('serializes and posts one valid blob without model-authored shell quoting', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    });

    const result = await execute('call-1', validPlan);

    expect(result.details).toBeUndefined();
    expect(postPlan).toHaveBeenCalledOnce();
    const posted = postPlan.mock.calls[0]?.[0];
    expect(posted?.target).toBe(validPlan.target);
    expect(posted?.fallbackSummary).toBe(validPlan.fallbackSummary);
    expect(JSON.parse(posted?.blob ?? '')).toEqual(
      buildAgentTaskPlanBlob(validPlan, validEvidence)
    );
  });

  it('keeps the fallback available to clients that support only v1', () => {
    const [entry] = buildAgentTaskPlanBlob(validPlan, validEvidence);
    const legacyEntry = entry as unknown as { version?: unknown };
    const legacyClientAccepts = legacyEntry.version === 1;

    expect(legacyClientAccepts).toBe(false);
    expect(entry).toEqual(expect.objectContaining({ storyMode: 'fallback' }));
    expect(validPlan.fallbackSummary).toBeTruthy();
  });

  it('rechecks the owner turn after group resolution and before posting', async () => {
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

  it('keeps A2UI surface and text lengths within the shared validator limits', () => {
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

  it('replaces a mistyped model group with the deterministic channel group', async () => {
    const postPlan = vi.fn(async () => '{"ok":true}');
    const resolveGroupId = vi.fn(async () => '~zod/home-group-full');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      resolveGroupId,
      ...executionBoundary(),
    });

    await execute('call-resolved-group', {
      ...validPlan,
      groupId: '~zod/home-group-ful',
    });

    expect(resolveGroupId).toHaveBeenCalledWith(validPlan.target);
    const posted = postPlan.mock.calls[0]?.[0];
    expect(JSON.parse(posted?.blob ?? '')).toEqual(
      buildAgentTaskPlanBlob(
        {
          ...validPlan,
          groupId: '~zod/home-group-full',
        },
        validEvidence
      )
    );
  });

  it('rejects malformed schedules before posting', async () => {
    const postPlan = vi.fn(async () => 'unexpected');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    });

    const result = await execute('call-2', {
      ...validPlan,
      scheduleExpression: 'every weekday',
    });

    expect(result.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
  });

  it('keeps an explicit timezone override internal to the action', () => {
    const blob = buildAgentTaskPlanBlob(
      {
        ...validPlan,
        fallbackSummary: 'Daily robotics brief at 3 PM Tokyo time.',
        summary: 'Japanese robotics releases daily at 3 PM Tokyo time.',
        scheduleHour: 15,
        scheduleMinute: 0,
        scheduleExpression: '0 15 * * *',
        scheduleDescription: 'daily at 3 PM Tokyo time',
        timezoneOverride: 'Asia/Tokyo',
      },
      validEvidence
    );

    expect(JSON.stringify(blob)).toContain('"timezoneOverride":"Asia/Tokyo"');
    expect(JSON.stringify(blob)).toContain('Tokyo time');
  });

  it('accepts an explicit UTC schedule described as UTC time', () => {
    const blob = buildAgentTaskPlanBlob(
      {
        ...validPlan,
        fallbackSummary: 'Daily robotics brief at 8:30 AM UTC time.',
        summary: 'Track robotics releases daily at 8:30 AM UTC time.',
        scheduleDescription: 'daily at 8:30 AM UTC time',
        timezoneOverride: 'UTC',
      },
      validEvidence
    );

    expect(JSON.stringify(blob)).toContain('"timezoneOverride":"UTC"');
  });

  it('normalizes a blank timezone override to the device-local path', () => {
    const serialized = JSON.stringify(
      buildAgentTaskPlanBlob(
        { ...validPlan, timezoneOverride: '' },
        validEvidence
      )
    );

    expect(serialized).not.toContain('timezoneOverride');
  });

  it('rejects invalid overrides and technical timezone copy', async () => {
    const postPlan = vi.fn(async () => 'unexpected');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    });

    const invalidOverride = await execute('call-invalid-timezone', {
      ...validPlan,
      timezoneOverride: 'Mars/Olympus',
    });
    const leakedIdentifier = await execute('call-leaked-timezone', {
      ...validPlan,
      summary: 'Run daily at 8:30 AM in America/New_York.',
    });
    const omittedOverride = await execute('call-omitted-timezone', {
      ...validPlan,
      fallbackSummary: 'Daily research brief at 8:30 AM Tokyo time.',
      summary: 'Track agent tools daily at 8:30 AM Tokyo time.',
      scheduleDescription: 'daily at 8:30 AM Tokyo time',
    });
    const hiddenOverride = await execute('call-hidden-timezone', {
      ...validPlan,
      timezoneOverride: 'Asia/Tokyo',
    });
    const mismatchedOverride = await execute('call-mismatched-timezone', {
      ...validPlan,
      fallbackSummary: 'Daily research brief at 8:30 AM Tokyo time.',
      summary: 'Track agent tools daily at 8:30 AM Tokyo time.',
      scheduleDescription: 'daily at 8:30 AM Tokyo time',
      timezoneOverride: 'Europe/London',
    });
    const unlistedReadableZone = await execute('call-unlisted-zone', {
      ...validPlan,
      fallbackSummary: 'Daily research brief at 8:30 AM, Sydney time.',
      summary: 'Track agent tools daily at 8:30 AM, Sydney time.',
      scheduleDescription: 'daily at 8:30 AM, Sydney time',
    });

    expect(invalidOverride.details).toEqual({ error: true });
    expect(leakedIdentifier.details).toEqual({ error: true });
    expect(omittedOverride.details).toEqual({ error: true });
    expect(hiddenOverride.details).toEqual({ error: true });
    expect(mismatchedOverride.details).toEqual({ error: true });
    expect(unlistedReadableZone.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
  });

  it('rejects a visible summary that contradicts the actual daily time', async () => {
    const postPlan = vi.fn(async () => 'unexpected');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    });

    const result = await execute('call-contradictory-copy', {
      ...validPlan,
      summary: 'Track agent tools daily at 9 AM.',
    });

    expect(result.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
  });

  it('rejects non-daily schedules and 24-hour display copy', async () => {
    const postPlan = vi.fn(async () => 'unexpected');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    });

    const weekly = await execute('call-weekly', {
      ...validPlan,
      scheduleExpression: '30 8 * * 1',
      scheduleDescription: 'weekly on Monday at 8:30 AM',
    });
    const twentyFourHour = await execute('call-24-hour', {
      ...validPlan,
      fallbackSummary: 'Daily research brief at 18:00.',
      summary: 'Track agent tools daily at 18:00.',
      scheduleHour: 18,
      scheduleMinute: 0,
      scheduleExpression: '0 18 * * *',
      scheduleDescription: 'daily at 18:00',
    });

    expect(weekly.details).toEqual({ error: true });
    expect(twentyFourHour.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
  });

  it('accepts readable :00 copy and cadence words that belong to the topic', () => {
    expect(() =>
      buildAgentTaskPlanBlob(
        {
          ...validPlan,
          fallbackSummary: 'Daily weekly-meal-planning advice at 8:00 AM.',
          summary:
            'Improve a weekly meal plan with one focused update daily at 8:00 AM.',
          scheduleMinute: 0,
          scheduleExpression: '0 8 * * *',
          scheduleDescription: 'every day at 8:00 AM',
        },
        validEvidence
      )
    ).not.toThrow();
  });

  it('rejects contradictory result-count instructions before posting', async () => {
    const postPlan = vi.fn(async () => 'unexpected');
    const execute = createAgentTaskPlanToolExecutor({
      postPlan,
      ...executionBoundary(),
    });

    const result = await execute('call-3', {
      ...validPlan,
      taskPrompt:
        'Return exactly three items. If there are fewer than three useful items, return fewer.',
    });

    expect(result.details).toEqual({ error: true });
    expect(postPlan).not.toHaveBeenCalled();
  });
});

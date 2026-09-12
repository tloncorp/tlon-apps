import { describe, expect, it } from 'vitest';

import { buildAgentTaskDemoRows, getAgentTaskDemoAutoExpandedId } from './demo';

describe('agent task row demo choreography', () => {
  it('advances the progress ring before completing the first task', () => {
    expect(buildAgentTaskDemoRows(0)[0]).toMatchObject({
      status: 'running',
      progress: 0,
    });
    expect(buildAgentTaskDemoRows(1)[0]).toMatchObject({
      status: 'running',
      progress: 0.66,
    });
    expect(buildAgentTaskDemoRows(2)[0].status).toBe('completed');
  });

  it('hints automatic disclosure only when a task becomes active', () => {
    expect(getAgentTaskDemoAutoExpandedId(0)).toBe('map-events');
    expect(getAgentTaskDemoAutoExpandedId(1)).toBeUndefined();
    expect(getAgentTaskDemoAutoExpandedId(2)).toBe('shape-rows');
    expect(getAgentTaskDemoAutoExpandedId(3)).toBeUndefined();
  });

  it('shows failure and recovery as distinct states', () => {
    expect(buildAgentTaskDemoRows(4)[2].status).toBe('failed');
    expect(buildAgentTaskDemoRows(5)[2].status).toBe('completed');
  });
});

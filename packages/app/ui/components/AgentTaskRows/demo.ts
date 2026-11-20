import type { AgentTaskRow } from './AgentTaskRows';

export const AGENT_TASK_DEMO_TICKS = [600, 900, 2400, 1400, 2400, 600];

export function buildAgentTaskDemoRows(tick: number): AgentTaskRow[] {
  const mapped = tick >= 2;
  const fixtureFailed = tick === 4;
  const fixtureDone = tick >= 5;

  return [
    {
      id: 'map-events',
      sequence: 1,
      title: 'Map agent turn events',
      status: mapped ? 'completed' : 'running',
      progress: mapped ? undefined : tick >= 1 ? 0.66 : 0,
      meta: '4 events',
      details: [
        { label: 'Commentary', value: 'Live progress narration' },
        { label: 'Tools', value: 'Calls and command output' },
        { label: 'Lifecycle', value: 'Started, waiting, completed' },
      ],
    },
    {
      id: 'shape-rows',
      sequence: 2,
      title: 'Shape Ochre task rows',
      status: mapped ? 'running' : 'pending',
      meta: '2 files',
      details: [
        { label: 'Presentation', value: 'Capsules and grouped list' },
        { label: 'Interaction', value: 'Click any row to inspect details' },
        { label: 'Motion', value: 'Stagger, expand, and state transitions' },
      ],
    },
    {
      id: 'messenger-fixture',
      sequence: 3,
      title: 'Prepare Messenger fixture',
      status: fixtureDone ? 'completed' : fixtureFailed ? 'failed' : 'pending',
      meta: 'fixture',
      details: [
        { label: 'Theme', value: 'Light and dark Ochre tokens' },
        { label: 'Access', value: 'Keyboard focus and reduced motion' },
      ],
    },
  ];
}

export function getAgentTaskDemoAutoExpandedId(tick: number) {
  if (tick === 0) return 'map-events';
  if (tick === 2) return 'shape-rows';
  return undefined;
}

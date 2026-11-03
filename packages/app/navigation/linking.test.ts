import { getStateFromPath } from '@react-navigation/core';
import { describe, expect, test } from 'vitest';

import { getMobileLinkingConfig } from './linking';

type Route = {
  name: string;
  params?: object;
  state?: { routes: Route[] };
};

// The innermost route a path resolves to, the screen it opens.
function screenFor(path: string): Route | undefined {
  const state = getStateFromPath(path, getMobileLinkingConfig('').config!);
  let route = state?.routes.at(-1) as Route | undefined;
  while (route?.state) {
    route = route.state.routes.at(-1);
  }
  return route;
}

describe('mobile linking', () => {
  test('opens a task run history and one run from their paths', () => {
    expect(screenFor('/apps/groups/tasks/~bot/job-1/runs')).toMatchObject({
      name: 'ScheduledTaskRuns',
      params: { botShip: '~bot', taskId: 'job-1' },
    });
    expect(
      screenFor('/apps/groups/tasks/~bot/job-1/runs/lens-1')
    ).toMatchObject({
      name: 'ScheduledTaskRun',
      params: { botShip: '~bot', taskId: 'job-1', lensId: 'lens-1' },
    });
  });
});

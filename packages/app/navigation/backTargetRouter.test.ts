import {
  CommonActions,
  StackActions,
  StackRouter,
} from '@react-navigation/routers';
import { describe, expect, test } from 'vitest';

import { resolveChannelBackTarget } from './backTarget';

// Locks React Navigation v7's *name-only* `pop` behavior (when no `getId` is
// declared on the stack screens) against the helper's pop-vs-replace decision,
// at the router-reducer level — no NavigationContainer render harness needed.

const ROUTE_NAMES = ['ChatList', 'DM', 'GroupDM', 'Channel', 'Post'];
const TARGET = 'chat/~zod/general';
const OTHER = 'chat/~bus/random';
const ORIGIN_DM = '~nec';

const router = StackRouter({});
const routerOptions = {
  routeNames: ROUTE_NAMES,
  routeParamList: {},
  routeGetIdList: {},
};

type RouteSpec = { name: string; channelId?: string };

function makeState(specs: RouteSpec[]) {
  return {
    stale: false as const,
    type: 'stack' as const,
    key: 'stack-test',
    index: specs.length - 1,
    routeNames: ROUTE_NAMES,
    preloadedRoutes: [],
    routes: specs.map((spec, i) => ({
      key: `${spec.name}-${i}`,
      name: spec.name,
      params: spec.channelId ? { channelId: spec.channelId } : undefined,
    })),
  };
}

// Mirror useNavigateBackFromPost: pick the action the helper's decision implies.
function actionForBack(
  state: ReturnType<typeof makeState>,
  target: { screenName: string; channelId: string }
) {
  const focused = state.routes[state.index];
  const previous = state.index > 0 ? state.routes[state.index - 1] : undefined;
  const decision = resolveChannelBackTarget(previous, focused?.name, target);
  const params = { channelId: target.channelId };
  return decision === 'replace-post'
    ? StackActions.replace(target.screenName, params)
    : CommonActions.navigate(target.screenName, params, { pop: true });
}

function routeSummary(state: {
  routes: { name: string; params?: { channelId?: string } }[];
}) {
  return state.routes.map((r) => [r.name, r.params?.channelId]);
}

describe('back-from-post router behavior', () => {
  test('reference-from-DM: replaces Post, preserving the originating DM', () => {
    const state = makeState([
      { name: 'ChatList' },
      { name: 'DM', channelId: ORIGIN_DM },
      { name: 'Post', channelId: TARGET },
    ]);
    const action = actionForBack(state, {
      screenName: 'Channel',
      channelId: TARGET,
    });
    const next = router.getStateForAction(state, action, routerOptions)!;

    expect(routeSummary(next)).toEqual([
      ['ChatList', undefined],
      ['DM', ORIGIN_DM],
      ['Channel', TARGET],
    ]);
  });

  test('in-channel thread: pops to the existing channel route', () => {
    const state = makeState([
      { name: 'ChatList' },
      { name: 'Channel', channelId: TARGET },
      { name: 'Post', channelId: TARGET },
    ]);
    const action = actionForBack(state, {
      screenName: 'Channel',
      channelId: TARGET,
    });
    const next = router.getStateForAction(state, action, routerOptions)!;

    expect(routeSummary(next)).toEqual([
      ['ChatList', undefined],
      ['Channel', TARGET],
    ]);
  });

  test('reference-from-DM beneath a channel: does not pop past the DM', () => {
    const state = makeState([
      { name: 'ChatList' },
      { name: 'Channel', channelId: TARGET },
      { name: 'DM', channelId: ORIGIN_DM },
      { name: 'Post', channelId: TARGET },
    ]);
    const action = actionForBack(state, {
      screenName: 'Channel',
      channelId: TARGET,
    });
    const next = router.getStateForAction(state, action, routerOptions)!;

    expect(routeSummary(next)).toEqual([
      ['ChatList', undefined],
      ['Channel', TARGET],
      ['DM', ORIGIN_DM],
      ['Channel', TARGET],
    ]);
  });

  test('guard: a raw name-only pop would land on the wrong same-name channel', () => {
    const state = makeState([
      { name: 'ChatList' },
      { name: 'Channel', channelId: TARGET },
      { name: 'Channel', channelId: OTHER },
      { name: 'Post', channelId: TARGET },
    ]);

    // The helper must choose replace here (prev is a different-channelId Channel).
    const previous = state.routes[state.index - 1];
    expect(
      resolveChannelBackTarget(previous, 'Post', {
        screenName: 'Channel',
        channelId: TARGET,
      })
    ).toBe('replace-post');

    // Demonstrate why: a raw name-only pop pops to the nearest 'Channel'
    // (the OTHER one at index 2) and overwrites its params — never reaching the
    // intended target route at index 1.
    const rawPop = CommonActions.navigate(
      'Channel',
      { channelId: TARGET },
      { pop: true }
    );
    const popped = router.getStateForAction(state, rawPop, routerOptions)!;
    expect(popped.routes).toHaveLength(3);
    expect(popped.routes[popped.routes.length - 1].name).toBe('Channel');
    // Index 1's original Channel(target) route is still stranded beneath.
    expect(routeSummary(popped)).toEqual([
      ['ChatList', undefined],
      ['Channel', TARGET],
      ['Channel', TARGET],
    ]);
  });
});

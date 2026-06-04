import { StackActions, StackRouter } from '@react-navigation/routers';
import { describe, expect, test } from 'vitest';

// Locks the back-from-Post navigation behavior at the router-reducer level — no
// NavigationContainer render harness needed. useNavigateBackFromPost's narrow
// branch dispatches a single StackActions.popTo(screenName, params): popTo pops
// back to an existing same-name route if one is in the stack, or replaces the
// focused Post in place if not — never pushing a duplicate that would strand
// Post and create a back-stack loop. With no getId on the stack screens, popTo
// matches by name only (see the same-name tests below).

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

// Mirror useNavigateBackFromPost's narrow branch.
function popToChannel(screenName: string, channelId: string) {
  return StackActions.popTo(screenName, { channelId });
}

function routeSummary(state: {
  routes: { name: string; params?: { channelId?: string } }[];
}) {
  return state.routes.map((r) => [r.name, r.params?.channelId]);
}

describe('back-from-post router behavior (popTo)', () => {
  test('reference-from-DM: replaces Post, preserving the originating DM', () => {
    // The Linear repro: the target channel is not in the stack. popTo's
    // not-found branch drops the focused Post and slots Channel in beneath it,
    // preserving the originating DM. (This is the loop the PR fixes — a plain
    // navigate(pop:true) would push a duplicate Channel and leave Post under it.)
    const state = makeState([
      { name: 'ChatList' },
      { name: 'DM', channelId: ORIGIN_DM },
      { name: 'Post', channelId: TARGET },
    ]);
    const next = router.getStateForAction(
      state,
      popToChannel('Channel', TARGET),
      routerOptions
    )!;

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
    const next = router.getStateForAction(
      state,
      popToChannel('Channel', TARGET),
      routerOptions
    )!;

    expect(routeSummary(next)).toEqual([
      ['ChatList', undefined],
      ['Channel', TARGET],
    ]);
  });

  test('same channel already open beneath the DM: pops back to it', () => {
    // The target channel is already in the stack (below the originating DM).
    // popTo pops back to that existing route, collapsing the DM/Post detour
    // rather than passing back through the DM. Non-looping; back then goes to
    // ChatList.
    const state = makeState([
      { name: 'ChatList' },
      { name: 'Channel', channelId: TARGET },
      { name: 'DM', channelId: ORIGIN_DM },
      { name: 'Post', channelId: TARGET },
    ]);
    const next = router.getStateForAction(
      state,
      popToChannel('Channel', TARGET),
      routerOptions
    )!;

    expect(routeSummary(next)).toEqual([
      ['ChatList', undefined],
      ['Channel', TARGET],
    ]);
  });

  test('accepted tradeoff: name-only match pops to the nearest same-name channel', () => {
    // Two stacked Channel routes for different channels. With no getId, popTo
    // matches by name and pops to the *nearest* Channel (OTHER), overwriting its
    // params with the target — so the distinct OTHER channel is collapsed into
    // the target. This is the pre-existing name-only behavior we accept rather
    // than adding getId (which would change pop/dedupe matching app-wide). Still
    // non-looping.
    const state = makeState([
      { name: 'ChatList' },
      { name: 'Channel', channelId: TARGET },
      { name: 'Channel', channelId: OTHER },
      { name: 'Post', channelId: TARGET },
    ]);
    const next = router.getStateForAction(
      state,
      popToChannel('Channel', TARGET),
      routerOptions
    )!;

    expect(routeSummary(next)).toEqual([
      ['ChatList', undefined],
      ['Channel', TARGET],
      ['Channel', TARGET],
    ]);
  });
});

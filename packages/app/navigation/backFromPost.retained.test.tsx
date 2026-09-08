import {
  CommonActions,
  StackActions,
  StackRouter,
  type StackNavigationState,
  type ParamListBase,
} from '@react-navigation/routers';
import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigateBackFromPost } from './utils';

const boundary = vi.hoisted(() => ({
  narrow: false,
  navigation: undefined as unknown,
}));
vi.mock('@react-navigation/native', async () => {
  const routers = await vi.importActual<
    typeof import('@react-navigation/routers')
  >('@react-navigation/routers');
  return {
    CommonActions: routers.CommonActions,
    StackActions: routers.StackActions,
    useNavigation: () => boundary.navigation,
  };
});
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ log: vi.fn() }),
  AnalyticsEvent: { NavigationTabSelected: 'tab' },
  trackEvent: vi.fn(),
}));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({}));
vi.mock('@tloncorp/ui', () => ({
  useIsWindowNarrow: () => boundary.narrow,
  useGlobalSearch: () => ({ lastOpenTab: 'Home' }),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('../utils/botSettings', () => ({ openExternalBotSettings: vi.fn() }));

const names = [
  'ChatList',
  'ChannelRoot',
  'Channel',
  'DM',
  'GroupDM',
  'Post',
  'MainTabs',
  'Activity',
];
const options = { routeNames: names, routeParamList: {}, routeGetIdList: {} };
const router = StackRouter({});
type State = StackNavigationState<ParamListBase>;
type Spec = {
  name: string;
  params?: Record<string, unknown>;
  state?: { index: number; routes: { name: string }[] };
};
const TARGET = 'chat/~zod/general';
const OTHER = 'chat/~bus/random';
const POST = 'parent-two';
let renderer: ReactTestRenderer | undefined;
let back!: ReturnType<typeof useNavigateBackFromPost>;
function Probe() {
  back = useNavigateBackFromPost();
  return null;
}
function makeState(specs: Spec[], index = specs.length - 1): State {
  return {
    stale: false,
    type: 'stack',
    key: 'test-stack',
    index,
    routeNames: names,
    preloadedRoutes: [],
    routes: specs.map((spec, i) => ({ ...spec, key: `${spec.name}-${i}` })),
  };
}
function setup(specs: Spec[], narrow = false, index?: number) {
  let state = makeState(specs, index);
  const commands: { kind: string; args: unknown[] }[] = [];
  const apply = (action: Parameters<typeof router.getStateForAction>[1]) => {
    const next = router.getStateForAction(state, action, options);
    if (!next || next.stale !== false)
      throw new Error(
        `Router did not return a complete state for ${action.type}`
      );
    state = next;
  };
  boundary.narrow = narrow;
  boundary.navigation = {
    getState: () => state,
    goBack: () => {
      commands.push({ kind: 'back', args: [] });
      apply(CommonActions.goBack());
    },
    dispatch: (action: Parameters<typeof apply>[0]) => {
      commands.push({ kind: 'dispatch', args: [action] });
      apply(action);
    },
    navigate: (
      name: string,
      params?: Record<string, unknown>,
      opts?: { pop?: boolean }
    ) => {
      commands.push({ kind: 'navigate', args: [name, params, opts] });
      apply(CommonActions.navigate({ name, params, pop: opts?.pop }));
    },
  };
  act(() => {
    renderer = create(<Probe />);
  });
  return {
    commands,
    state: () => state,
    replace: (specs: Spec[], index?: number) => {
      state = makeState(specs, index);
    },
    press: (id = TARGET, type: db.Channel['type'] = 'chat') =>
      act(() => back({ id, type, groupId: '~zod/group' } as db.Channel, POST)),
  };
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe('actual Back hook: retained reading route versus selected navigation', () => {
  it.each([
    { narrow: false, name: 'ChannelRoot', id: TARGET, type: 'chat' },
    { narrow: true, name: 'Channel', id: TARGET, type: 'chat' },
    { narrow: true, name: 'DM', id: '~nec', type: 'dm' },
    { narrow: true, name: 'GroupDM', id: '0v4.group-dm', type: 'groupDm' },
  ] as const)(
    'reveals exact retained $name without a new selection ($id)',
    ({ narrow, name, id, type }) => {
      const n = setup(
        [
          { name: 'ChatList' },
          {
            name,
            params: {
              channelId: id,
              groupId: 'original-group',
              retained: 'draft-owner',
            },
          },
          { name: 'Post', params: { channelId: id } },
        ],
        narrow
      );
      const retained = n.state().routes[1];
      n.press(id, type);
      expect(n.commands).toEqual([{ kind: 'back', args: [] }]);
      expect(n.state().routes).toEqual([n.state().routes[0], retained]);
      expect(n.state().routes[1]).toBe(retained);
      expect(n.state().routes[1].params).not.toHaveProperty('selectedPostId');
    }
  );
  it('preserves the existing selected route entry rather than selecting the thread parent again', () => {
    const n = setup([
      {
        name: 'ChannelRoot',
        params: {
          channelId: TARGET,
          selectedPostId: 'old-selected-entry',
          startDraft: true,
        },
      },
      { name: 'Post' },
    ]);
    const retained = n.state().routes[0];
    n.press();
    expect(n.commands).toEqual([{ kind: 'back', args: [] }]);
    expect(n.state().routes[0]).toBe(retained);
    expect(n.state().routes[0].params).toEqual({
      channelId: TARGET,
      selectedPostId: 'old-selected-entry',
      startDraft: true,
    });
  });
  it.each([
    { narrow: false, name: 'ChannelRoot' },
    { narrow: true, name: 'Channel' },
  ])(
    'keeps intentional selected navigation for a different $name channel',
    ({ narrow, name }) => {
      const n = setup(
        [
          { name: 'ChatList' },
          { name, params: { channelId: OTHER } },
          { name: 'Post' },
        ],
        narrow
      );
      n.press();
      expect(n.commands[0].kind).toBe(narrow ? 'dispatch' : 'navigate');
      expect(n.state().routes.at(-1)?.params).toMatchObject({
        channelId: TARGET,
        selectedPostId: POST,
      });
      expect(n.state().routes.some((r) => r.name === 'Post')).toBe(false);
    }
  );
  it('keeps reference-from-DM replacement without a Post back-stack loop', () => {
    const n = setup(
      [
        { name: 'ChatList' },
        { name: 'DM', params: { channelId: '~nec' } },
        { name: 'Post' },
      ],
      true
    );
    n.press();
    expect(n.commands[0]).toEqual({
      kind: 'dispatch',
      args: [
        StackActions.popTo('Channel', {
          channelId: TARGET,
          selectedPostId: POST,
          groupId: '~zod/group',
        }),
      ],
    });
    expect(n.state().routes.map((r) => r.name)).toEqual([
      'ChatList',
      'DM',
      'Channel',
    ]);
  });
  it('keeps selected destination recovery when there is no retained channel', () => {
    const n = setup([{ name: 'Post' }], true);
    n.press();
    expect(n.state().routes).toHaveLength(1);
    expect(n.state().routes[0]).toMatchObject({
      name: 'Channel',
      params: { channelId: TARGET, selectedPostId: POST },
    });
    expect(n.commands[0].kind).toBe('dispatch');
  });
  it('reads channel identity at press time rather than retaining the prior matching render', () => {
    const n = setup(
      [{ name: 'Channel', params: { channelId: TARGET } }, { name: 'Post' }],
      true
    );
    n.replace([
      { name: 'DM', params: { channelId: '~nec' } },
      { name: 'Post' },
    ]);
    n.press();
    expect(n.commands[0].kind).toBe('dispatch');
    expect(n.state().routes.map((r) => r.name)).toEqual(['DM', 'Channel']);
  });
  it('recognizes a matching retained route that appears after the hook renders', () => {
    const n = setup(
      [{ name: 'Channel', params: { channelId: OTHER } }, { name: 'Post' }],
      true
    );
    n.replace([
      { name: 'Channel', params: { channelId: TARGET, retained: 'new-visit' } },
      { name: 'Post' },
    ]);
    const retained = n.state().routes[0];
    n.press();
    expect(n.commands).toEqual([{ kind: 'back', args: [] }]);
    expect(n.state().routes[0]).toBe(retained);
    expect(n.state().index).toBe(0);
  });
  it('keeps Activity return through the actual tab helper', () => {
    const n = setup(
      [{ name: 'MainTabs', params: { screen: 'Activity' } }, { name: 'Post' }],
      true
    );
    n.press();
    expect(n.commands).toEqual([
      {
        kind: 'navigate',
        args: ['MainTabs', { screen: 'Activity' }, { pop: true }],
      },
    ]);
  });
  it('keeps a non-chat reference return to the originating desktop chat', () => {
    const n = setup([
      { name: 'ChannelRoot', params: { channelId: TARGET } },
      { name: 'Post' },
    ]);
    const retained = n.state().routes[0];
    n.press('diary/~bus/notes', 'notebook');
    expect(n.commands).toEqual([{ kind: 'back', args: [] }]);
    expect(n.state().routes[0]).toBe(retained);
  });
});

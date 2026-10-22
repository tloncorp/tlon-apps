import {
  BaseNavigationContainer,
  NavigationContext,
  type ParamListBase,
  StackRouter,
  TabActions,
  TabRouter,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { Fragment, useContext, useMemo } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useInstalledNavigationOptions } from './useInstalledNavigationOptions';

// The hook only needs the route context, which the native package re-exports
// from core. Loading the native package itself pulls in React Native.
vi.mock('@react-navigation/native', () =>
  vi.importActual('@react-navigation/core')
);

type NavigatorProps = Parameters<typeof useNavigationBuilder>[1];

function Header(_props: { routeName: string; title: string }) {
  return null;
}

// Like native stack: covered routes stay mounted, and a header without a
// title option falls back to the route name.
function StackNavigator(props: NavigatorProps) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    StackRouter,
    props
  );

  return (
    <NavigationContent>
      {state.routes.map((route) => {
        const { title } = descriptors[route.key].options as { title?: string };
        return (
          <Fragment key={route.key}>
            <Header routeName={route.name} title={title ?? route.name} />
            {descriptors[route.key].render()}
          </Fragment>
        );
      })}
    </NavigationContent>
  );
}

// Like native tabs after their first visit, every tab stays mounted.
function TabNavigator(props: NavigatorProps) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    TabRouter,
    props
  );

  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <Fragment key={route.key}>{descriptors[route.key].render()}</Fragment>
      ))}
    </NavigationContent>
  );
}

const Stack = createNavigatorFactory(StackNavigator)();
const Tabs = createNavigatorFactory(TabNavigator)();

function HeaderOwner({ title }: { title: string }) {
  const navigation = useContext(NavigationContext);
  const options = useMemo(() => ({ title }), [title]);
  useInstalledNavigationOptions(navigation, options);
  return null;
}

const ChatList = () => <HeaderOwner title="Home" />;
const Activity = () => <HeaderOwner title="Activity" />;
const Channel = () => null;

function MainTabs() {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="ChatList" component={ChatList} />
      <Tabs.Screen name="Activity" component={Activity} />
    </Tabs.Navigator>
  );
}

describe('useInstalledNavigationOptions', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  function renderApp() {
    const navigation = createNavigationContainerRef<ParamListBase>();
    act(() => {
      renderer = create(
        <BaseNavigationContainer ref={navigation}>
          <Stack.Navigator>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Channel" component={Channel} />
          </Stack.Navigator>
        </BaseNavigationContainer>
      );
    });
    return navigation;
  }

  function mainTabsHeaderTitle() {
    return renderer?.root.findByProps({ routeName: 'MainTabs' }).props.title;
  }

  it('shows the selected tab in the header the tabs share', () => {
    const navigation = renderApp();
    expect(mainTabsHeaderTitle()).toBe('Home');

    act(() => navigation.dispatch(TabActions.jumpTo('Activity')));
    expect(mainTabsHeaderTitle()).toBe('Activity');

    act(() => navigation.dispatch(TabActions.jumpTo('ChatList')));
    expect(mainTabsHeaderTitle()).toBe('Home');
  });

  it('shows the selected tab when the tabs mount under a pushed screen', () => {
    const navigation = renderApp();

    // Notification taps and deep links rebuild the stack this way, so the tabs
    // mount for the first time while the channel covers them.
    act(() =>
      navigation.resetRoot({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'Channel' }],
      })
    );
    expect(navigation.getCurrentRoute()?.name).toBe('Channel');
    expect(mainTabsHeaderTitle()).toBe('Home');

    act(() => navigation.goBack());
    expect(navigation.getCurrentRoute()?.name).toBe('ChatList');
    expect(mainTabsHeaderTitle()).toBe('Home');
  });
});

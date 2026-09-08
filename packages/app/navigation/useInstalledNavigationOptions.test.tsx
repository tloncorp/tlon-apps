import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import React, { createContext, useContext } from 'react';
import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import {
  StackActions,
  StackRouter,
  type StackActionHelpers,
  type StackNavigationState,
  type StackRouterOptions,
} from '@react-navigation/routers';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInstalledNavigationOptions } from './useInstalledNavigationOptions';

const hidden = { headerShown: false };
const loading = { headerShown: true, title: 'Thread' };
const loaded = { headerShown: true, title: 'Thread: channel' };
let renderer: ReactTestRenderer | undefined;
function nav(type = 'stack') {
  let focused = true;
  const listeners = new Map<string, () => void>();
  const parent = { setOptions: vi.fn() };
  const value = {
    getState: () => ({ type }),
    getParent: () => parent,
    setOptions: vi.fn(),
    isFocused: () => focused,
    addListener: (event: string, callback: () => void) => {
      listeners.set(event, callback);
      return () => {
        if (listeners.get(event) === callback) listeners.delete(event);
      };
    },
  };
  return {
    value: value as unknown as NavigationProp<ParamListBase>,
    setOptions: value.setOptions,
    parent,
    focus: (next: boolean) => {
      focused = next;
    },
    remove: () => listeners.get('beforeRemove')?.(),
  };
}
function Header({
  navigation,
  options = loading,
}: {
  navigation: NavigationProp<ParamListBase>;
  options?: typeof loading;
}) {
  useInstalledNavigationOptions(navigation, options, true, hidden);
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});
it('retires the covered stack loading header before an inline Post header appears', () => {
  const n = nav();
  act(() => {
    renderer = create(<Header navigation={n.value} />);
  });
  n.focus(false);
  act(() => renderer!.update(<div data-inline-header="Post" />));
  expect(n.setOptions).toHaveBeenLastCalledWith(hidden);
  n.focus(true);
  expect(n.setOptions).toHaveBeenLastCalledWith(hidden);
  expect(n.parent.setOptions).not.toHaveBeenCalled();
});
it('lets the replacement chat header own the final route options', () => {
  const n = nav();
  act(() => {
    renderer = create(<Header key="loading" navigation={n.value} />);
  });
  n.focus(false);
  act(() =>
    renderer!.update(
      <Header key="loaded" navigation={n.value} options={loaded} />
    )
  );
  expect(n.setOptions).toHaveBeenLastCalledWith(loaded);
});
it('preserves an outgoing route header when beforeRemove has fired', () => {
  const n = nav();
  act(() => {
    renderer = create(<Header navigation={n.value} />);
  });
  n.remove();
  act(() => renderer!.update(<div />));
  expect(n.setOptions).toHaveBeenCalledTimes(1);
  expect(n.setOptions).toHaveBeenLastCalledWith(loading);
});
it('does not clear a shared parent header when an inactive tab retires', () => {
  const n = nav('tab');
  act(() => {
    renderer = create(<Header navigation={n.value} />);
  });
  n.focus(false);
  act(() => renderer!.update(<div />));
  expect(n.parent.setOptions).toHaveBeenCalledTimes(1);
  expect(n.parent.setOptions).toHaveBeenLastCalledWith(loading);
});

type HeaderOptions = { headerShown?: boolean; title?: string };
type Mode = 'loading' | 'inline' | 'chat';
const modeContext = createContext<Mode>('loading');
const descriptorOptions = new Map<string, HeaderOptions>();
const routeNavigation = new Map<string, NavigationProp<ParamListBase>>();
const coverOptions = { headerShown: true, title: 'Cover B' };
function RetainedStack({ children }: { children: React.ReactNode }) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder<
    StackNavigationState<ParamListBase>,
    StackRouterOptions,
    StackActionHelpers<ParamListBase>,
    HeaderOptions,
    Record<string, never>
  >(StackRouter, { children });
  for (const route of state.routes) {
    const descriptor = descriptors[route.key];
    descriptorOptions.set(route.name, descriptor.options);
    routeNavigation.set(route.name, descriptor.navigation);
  }
  // Keep covered descriptors mounted, just like the native stack's retained
  // routes. Navigation, options binding, focus and removal are real core code.
  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <React.Fragment key={route.key}>
          {descriptors[route.key].render()}
        </React.Fragment>
      ))}
    </NavigationContent>
  );
}
const Stack = createNavigatorFactory(RetainedStack)();
function RouteA({ navigation }: { navigation: NavigationProp<ParamListBase> }) {
  const mode = useContext(modeContext);
  return mode === 'inline' ? (
    <div data-inline-post-header="Post" />
  ) : (
    <Header
      key={mode}
      navigation={navigation}
      options={mode === 'chat' ? loaded : loading}
    />
  );
}
function RouteB({ navigation }: { navigation: NavigationProp<ParamListBase> }) {
  return <Header navigation={navigation} options={coverOptions} />;
}
function realStack(
  mode: Mode,
  navRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>
) {
  return (
    <modeContext.Provider value={mode}>
      <BaseNavigationContainer ref={navRef}>
        <Stack.Navigator>
          <Stack.Screen name="A" component={RouteA} />
          <Stack.Screen name="B" component={RouteB} />
        </Stack.Navigator>
      </BaseNavigationContainer>
    </modeContext.Provider>
  );
}
it('real retained stack resets only covered A when loading becomes an inline Post header', async () => {
  const navRef = createNavigationContainerRef<ParamListBase>();
  await act(async () => {
    renderer = create(realStack('loading', navRef));
  });
  expect(descriptorOptions.get('A')).toMatchObject(loading);
  await act(async () => navRef.dispatch(StackActions.push('B')));
  expect(routeNavigation.get('A')!.isFocused()).toBe(false);
  expect(routeNavigation.get('B')!.isFocused()).toBe(true);
  const coverBefore = { ...descriptorOptions.get('B') };
  await act(async () => renderer!.update(realStack('inline', navRef)));
  expect(descriptorOptions.get('A')!.headerShown).toBe(false);
  expect(descriptorOptions.get('B')).toEqual(coverBefore);
  expect(navRef.getCurrentRoute()?.name).toBe('B');
  await act(async () => navRef.dispatch(StackActions.pop()));
  expect(navRef.getCurrentRoute()?.name).toBe('A');
  expect(descriptorOptions.get('A')!.headerShown).toBe(false);
  expect(
    renderer!.root.findAllByProps({ 'data-inline-post-header': 'Post' })
  ).toHaveLength(1);
});
it('real retained stack leaves the replacement chat title on A and covering B unchanged', async () => {
  const navRef = createNavigationContainerRef<ParamListBase>();
  await act(async () => {
    renderer = create(realStack('loading', navRef));
  });
  await act(async () => navRef.dispatch(StackActions.push('B')));
  const coverBefore = { ...descriptorOptions.get('B') };
  await act(async () => renderer!.update(realStack('chat', navRef)));
  expect(descriptorOptions.get('A')).toMatchObject(loaded);
  expect(descriptorOptions.get('B')).toEqual(coverBefore);
  await act(async () => navRef.dispatch(StackActions.pop()));
  expect(descriptorOptions.get('A')).toMatchObject(loaded);
});
it('real stack beforeRemove preserves the outgoing B header until its route is removed', async () => {
  const navRef = createNavigationContainerRef<ParamListBase>();
  await act(async () => {
    renderer = create(realStack('loading', navRef));
  });
  await act(async () => navRef.dispatch(StackActions.push('B')));
  // Spy delegates to the real route-owned binding; this tests actual router
  // beforeRemove ordering, not a manually invoked removal callback.
  const optionsSpy = vi.spyOn(routeNavigation.get('B')!, 'setOptions');
  await act(async () => navRef.dispatch(StackActions.pop()));
  expect(optionsSpy).not.toHaveBeenCalled();
  expect(navRef.getCurrentRoute()?.name).toBe('A');
  expect(descriptorOptions.get('A')).toMatchObject(loading);
});

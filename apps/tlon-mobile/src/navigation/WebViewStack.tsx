import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { useWebViewContext } from '../contexts/webview';
import { useScreenOptions } from '../hooks/useScreenOptions';
import { getInitialPath } from '../lib/WebAppHelpers';
import { ExternalWebViewScreen } from '../screens/ExternalWebViewScreen';
import { WebviewPlaceholderScreen } from '../screens/WebViewScreen';
import type { TabParamList, WebViewStackParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, keyof TabParamList>;

const Stack = createNativeStackNavigator<WebViewStackParamList>();

export const WebViewStack = (props: Props) => {
  const focused = useIsFocused();
  const screenOptions = useScreenOptions();
  const {
    setGotoPath,
    gotoTab,
    reactingToWebappNav,
    setGotoTab,
    setReactingToWebappNav,
    lastGroupsPath,
    lastMessagesPath,
  } = useWebViewContext();

  // Handle navigation when the webview is focused
  useEffect(() => {
    const unsubscribe = props.navigation.addListener('focus', () => {
      // If we're reacting to a webapp navigation, stay where we are
      if (reactingToWebappNav) {
        setReactingToWebappNav(false);
        return;
      }

      // If we're navigating to the Messages tab, go to its last location
      if (props.route.name === 'Messages' && lastMessagesPath) {
        console.log(
          `tab ${props.route.name}: navigating to ${lastMessagesPath}`
        );
        setGotoPath(lastMessagesPath);
        return;
      }

      // If we're navigating to the Groups tab, go to its last location
      if (props.route.name === 'Groups' && lastGroupsPath) {
        console.log(`tab ${props.route.name}: navigating to ${lastGroupsPath}`);
        setGotoPath(lastGroupsPath);
        return;
      }

      // Else, go to the tab's initial location
      setGotoPath(props.route.params.initialPath);
    });

    return unsubscribe;
  }, [
    lastGroupsPath,
    lastMessagesPath,
    props.navigation,
    props.route,
    reactingToWebappNav,
    setGotoPath,
    setReactingToWebappNav,
  ]);

  // If the webview changes the active tab, navigate to it
  useEffect(() => {
    // If we're not focused, ignore
    if (!focused) {
      return;
    }

    if (gotoTab && gotoTab !== props.route.name) {
      setReactingToWebappNav(true);
      props.navigation.navigate(gotoTab as keyof TabParamList, {
        initialPath: getInitialPath(gotoTab),
      });
      setGotoTab(null);
    }
  }, [
    focused,
    gotoTab,
    props.navigation,
    props.route.name,
    setGotoTab,
    setReactingToWebappNav,
  ]);

  return (
    <Stack.Navigator initialRouteName="Webview" screenOptions={screenOptions}>
      <Stack.Screen
        name="Webview"
        component={WebviewPlaceholderScreen}
        initialParams={props.route.params}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ExternalWebView" component={ExternalWebViewScreen} />
    </Stack.Navigator>
  );
};

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';

import { useWebViewContext } from '../contexts/webview/webview';
import { useScreenOptions } from '../hooks/useScreenOptions';
import { getInitialPath } from '../lib/WebAppHelpers';
import { ExternalWebViewScreen } from '../screens/ExternalWebViewScreen';
import { WebviewPlaceholderScreen } from '../screens/WebviewPlaceholderScreen';
import type { TabParamList, WebViewStackParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, keyof TabParamList>;

const Stack = createNativeStackNavigator<WebViewStackParamList>();
const DOUBLE_CLICK_WINDOW = 300;

/*
  Since the webview for the webapp is located in an overlay outside of the tab navigator,
  we handle most related navigation logic here
*/
export const WebViewStack = (props: Props) => {
  const focused = useIsFocused();
  const screenOptions = useScreenOptions();
  const [doubleClickTimeout, setDoubleClickTimeout] = useState<number | null>(
    null
  );
  const {
    setGotoPath,
    gotoTab,
    reactingToWebappNav,
    setGotoTab,
    setReactingToWebappNav,
    lastGroupsPath,
    lastMessagesPath,
    setLastGroupsPath,
    setLastMessagesPath,
  } = useWebViewContext();

  // Handle navigation when the webview is focused
  useFocusEffect(() => {
    const unsubscribe = props.navigation.addListener('focus', () => {
      // If we're reacting to a webapp navigation, stay where we are
      if (reactingToWebappNav) {
        setReactingToWebappNav(false);
        return;
      }

      // If we're navigating to the Messages tab, go to its last location
      if (props.route.name === 'Messages' && lastMessagesPath) {
        setGotoPath(lastMessagesPath);
        return;
      }

      // If we're navigating to the Groups tab, go to its last location
      if (props.route.name === 'Groups' && lastGroupsPath) {
        setGotoPath(lastGroupsPath);
        return;
      }

      // Else, go to the tab's initial location
      // setGotoPath(props.route.params.initialPath);
      setGotoPath(getInitialPath(props.route.name));
    });

    return unsubscribe;
  });

  // Handle double clicking a nav icon returning to the tab's initial location
  useEffect(() => {
    const unsubscribe = props.navigation.addListener('tabPress', () => {
      if (doubleClickTimeout !== null) {
        // double click detected
        window.clearTimeout(doubleClickTimeout);
        setDoubleClickTimeout(null);

        setGotoPath(getInitialPath(props.route.name));
        if (props.route.name === 'Messages') {
          setLastMessagesPath(getInitialPath(props.route.name));
        }

        if (props.route.name === 'Groups') {
          setLastGroupsPath(getInitialPath(props.route.name));
        }
      } else {
        const timeout = window.setTimeout(() => {
          setDoubleClickTimeout(null);
        }, DOUBLE_CLICK_WINDOW);
        setDoubleClickTimeout(timeout);
      }
    });
    return unsubscribe;
  }, [
    doubleClickTimeout,
    props.navigation,
    props.route.name,
    setGotoPath,
    setLastGroupsPath,
    setLastMessagesPath,
  ]);

  // Handle the webapp internally navigating to a different tab (vs via bottom nav click)
  useEffect(() => {
    // if we're not focused, ignore
    if (!focused) {
      return;
    }

    if (gotoTab && gotoTab !== props.route.name) {
      // we have to register that we're reacting to webapp navigation
      // so we know not to return to the tab's default/last location (as with a tab click)
      setReactingToWebappNav(true);

      // navigate to the new active tab
      // props.navigation.navigate(gotoTab as keyof TabParamList);
      props.navigation.navigate(gotoTab as keyof TabParamList, {
        screen: 'Webview',
      });

      // clear the gotoTab since it's been handled
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

  // useEffect(() => {
  //   async function manageAccount() {
  //     const [hostingSession, hostingUserId] = await Promise.all([
  //       getHostingToken(),
  //       getHostingUserId(),
  //     ]);
  //     // didManageAccount.current = true;
  //     props.push('ExternalWebView', {
  //       uri: 'https://tlon.network/account',
  //       headers: {
  //         Cookie: hostingSession,
  //       },
  //       injectedJavaScript: `localStorage.setItem("X-SESSION-ID", "${hostingUserId}")`,
  //     });
  //   }
  // }, [didManageAccount])

  return (
    <Stack.Navigator initialRouteName="Webview" screenOptions={screenOptions}>
      <Stack.Screen
        name="Webview"
        component={WebviewPlaceholderScreen}
        // initialParams={props.route.params}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ExternalWebView" component={ExternalWebViewScreen} />
    </Stack.Navigator>
  );
};

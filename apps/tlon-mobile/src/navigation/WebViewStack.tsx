import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useScreenOptions } from '../hooks/useScreenOptions';
import { ExternalWebViewScreen } from '../screens/ExternalWebViewScreen';
import { WebViewScreen } from '../screens/WebViewScreen';
import type { TabParamList, WebViewStackParamList } from '../types';

type Props = BottomTabScreenProps<
  TabParamList,
  'Groups' | 'Messages' | 'Activity' | 'Profile'
>;

const Stack = createNativeStackNavigator<WebViewStackParamList>();

export const WebViewStack = (props: Props) => {
  const screenOptions = useScreenOptions();
  return (
    <Stack.Navigator initialRouteName="WebView" screenOptions={screenOptions}>
      <Stack.Screen
        name="WebView"
        component={WebViewScreen}
        initialParams={props.route.params}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ExternalWebView" component={ExternalWebViewScreen} />
    </Stack.Navigator>
  );
};

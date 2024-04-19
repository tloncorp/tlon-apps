import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ImageViewerScreen from '../screens/ImageViewerScreen';
import type { RootStackParamList } from '../types';
import { TabStack } from './TabStack';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Root.Navigator
      initialRouteName="Tabs"
      screenOptions={{ headerShown: false }}
    >
      <Root.Screen name="Tabs" component={TabStack} />
      <Root.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ animation: 'fade' }}
      />
    </Root.Navigator>
  );
}

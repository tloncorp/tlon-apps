import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppLauncherScreen } from '../../features/apps/AppLauncherScreen';
import { AppViewerScreen } from '../../features/apps/AppViewerScreen';
import { AppsDrawerParamList } from '../types';

const AppsStack = createNativeStackNavigator<AppsDrawerParamList>();

export const AppsNavigator = () => {
  return (
    <AppsStack.Navigator
      initialRouteName="AppLauncher"
      screenOptions={{ headerShown: false }}
    >
      <AppsStack.Screen name="AppLauncher" component={AppLauncherScreen} />
      <AppsStack.Screen name="AppViewer" component={AppViewerScreen} />
    </AppsStack.Navigator>
  );
};

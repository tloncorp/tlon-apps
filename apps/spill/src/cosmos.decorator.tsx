import React from 'react';
import {TamaguiProvider} from '@theme';
import {SizableText, YStack} from '@ochre';
import {PropsWithChildren} from 'react';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {RealmProvider} from '@db';
import {Navigation} from '@utils/navigation';

export default ({children}: PropsWithChildren) => {
  return (
    <RealmProvider>
      <TamaguiProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <Navigation.Navigator>
              <Navigation.Screen
                name="ConfigurableHome"
                options={{
                  headerShown: false,
                }}>
                {() => <MainContent>{children}</MainContent>}
              </Navigation.Screen>
            </Navigation.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </TamaguiProvider>
    </RealmProvider>
  );
};

const MainContent = ({children}: PropsWithChildren) => {
  const insets = useSafeAreaInsets();
  return (
    <YStack
      paddingTop={insets.top}
      flex={1}
      alignContent="center"
      justifyContent="center">
      <YStack flex={1}>{children}</YStack>
    </YStack>
  );
};

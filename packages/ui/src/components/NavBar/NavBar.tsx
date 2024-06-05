import { BlurView } from 'expo-blur';
import React, { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../core';
import { XStack } from '../../core';
import { View } from '../View';

export const navHeight = 50;

const NavBar = React.memo(function NavBar(props: {
  children: React.ReactNode | React.ReactNode[] | null | undefined;
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      width={'100%'}
      height={navHeight + bottom}
      backgroundColor={'$background'}
    >
      <XStack
        justifyContent="space-around"
        alignItems="flex-start"
        paddingTop={'$m'}
      >
        {props.children}
      </XStack>
    </View>
  );
});

function BlurOnIos(props: PropsWithChildren) {
  const theme = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={75}
        tint={theme.isDark ? 'regular' : 'light'}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {props.children}
      </BlurView>
    );
  }
  return <>{props.children}</>;
}

export default NavBar;

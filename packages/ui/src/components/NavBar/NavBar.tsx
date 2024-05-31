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
      position="absolute"
      width={'100%'}
      bottom={0}
      paddingTop={'$m'}
      height={navHeight + bottom}
      backgroundColor={Platform.OS === 'ios' ? 'transparent' : '$background'}
    >
      <BlurOnIos>
        <XStack
          justifyContent="space-around"
          alignItems="flex-start"
          paddingTop={'$m'}
        >
          {props.children}
        </XStack>
      </BlurOnIos>
    </View>
  );
});

function BlurOnIos(props: PropsWithChildren) {
  const theme = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={100}
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

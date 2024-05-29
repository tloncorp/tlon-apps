import { BlurView } from 'expo-blur';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../core';
import { XStack } from '../../core';
import { View } from '../View';

export const navHeight = 50;

const NavBar = React.memo(function NavBar(props: {
  children: React.ReactNode | React.ReactNode[] | null | undefined;
}) {
  const { bottom } = useSafeAreaInsets();

  const theme = useTheme();

  return (
    <View
      position="absolute"
      width={'100%'}
      bottom={0}
      paddingTop={'$m'}
      borderTopColor={'$border'}
      height={navHeight + bottom}
    >
      <BlurView
        intensity={100}
        tint={theme.isDark ? 'regular' : 'light'}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <XStack justifyContent="space-around" alignItems="flex-start">
        {props.children}
      </XStack>
    </View>
  );
});

export default NavBar;

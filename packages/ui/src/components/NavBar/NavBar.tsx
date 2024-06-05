import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { XStack } from '../../core';
import { View } from '../View';

export const navHeight = 50;

const NavBar = React.memo(function NavBar(props: {
  children: React.ReactNode | React.ReactNode[] | null | undefined;
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      width="100%"
      height={navHeight + bottom}
      backgroundColor="$background"
      paddingTop="$m"
    >
      <XStack
        justifyContent="space-around"
        alignItems="flex-start"
        paddingTop="$m"
      >
        {props.children}
      </XStack>
    </View>
  );
});

export default NavBar;

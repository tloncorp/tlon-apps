import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { XStack } from '../../core';
import { View } from '../View';

const NavBar = React.memo(function NavBar(props: {
  children: React.ReactNode | React.ReactNode[] | null | undefined;
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      width="100%"
      backgroundColor="$background"
      paddingTop="$s"
      paddingBottom={bottom}
    >
      <XStack justifyContent="space-around" alignItems="flex-start">
        {props.children}
      </XStack>
    </View>
  );
});

export default NavBar;

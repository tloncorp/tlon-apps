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
      position="absolute"
      width={'100%'}
      bottom={0}
      backgroundColor={'$background'}
      borderTopWidth={1}
      paddingTop={'$m'}
      borderTopColor={'$border'}
      height={navHeight + bottom}
    >
      <XStack justifyContent="space-around" alignItems="flex-start">
        {props.children}
      </XStack>
    </View>
  );
});

export default NavBar;

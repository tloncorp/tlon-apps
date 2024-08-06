import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getToken } from 'tamagui';
import { XStack } from 'tamagui';

import { View } from '../View';

const NavBar = React.memo(function NavBar(props: {
  children: React.ReactNode | React.ReactNode[] | null | undefined;
}) {
  const { bottom } = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const largeSize = getToken('$l');

  return (
    <View
      width="100%"
      backgroundColor="$background"
      paddingTop={isAndroid ? '$m' : '$s'}
      paddingBottom={isAndroid ? largeSize + bottom : bottom}
    >
      <XStack justifyContent="space-around" alignItems="flex-start">
        {props.children}
      </XStack>
    </View>
  );
});

export default NavBar;

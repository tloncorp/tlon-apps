import { View } from '@tloncorp/ui';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';
import { XStack } from 'tamagui';

const NavBar = React.memo(function NavBar(props: {
  children: React.ReactNode | React.ReactNode[] | null | undefined;
}) {
  const { bottom } = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const largeSize = getTokenValue('$l');

  return (
    <View
      width="100%"
      backgroundColor="$background"
      // On native there is no top padding: each icon centers itself within
      // its min-height touch target, which puts it at the same visual
      // position the padding used to.
      paddingTop={Platform.OS === 'web' ? '$s' : undefined}
      paddingBottom={isAndroid ? largeSize + bottom : bottom}
    >
      <XStack justifyContent="space-around" alignItems="flex-start">
        {props.children}
      </XStack>
    </View>
  );
});

export default NavBar;

import { ComponentProps } from 'react';
import { Modal as RNModal } from 'react-native';
import { View } from 'tamagui';

import { useWindowSafeAreaInsets } from '../hooks/useWindowSafeAreaInsets';
import { Overlay } from './Overlay';
import { ZStack } from './ZStack';

export function Modal(props: ComponentProps<typeof RNModal>) {
  const { left, right } = useWindowSafeAreaInsets();
  const onDismiss = () => {
    if (props.onDismiss) {
      props.onDismiss();
    }
  };

  return (
    <RNModal transparent={true} {...props}>
      <ZStack flex={1}>
        <Overlay onPress={onDismiss} />
        <View
          flex={1}
          position="absolute"
          inset={0}
          paddingLeft={left}
          paddingRight={right}
          pointerEvents="box-none"
        >
          {props.children}
        </View>
      </ZStack>
    </RNModal>
  );
}

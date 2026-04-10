import { ComponentProps } from 'react';
import { Modal as RNModal } from 'react-native';
import { View } from 'tamagui';

import { Overlay } from './Overlay';
import { ZStack } from './ZStack';

export function Modal(props: ComponentProps<typeof RNModal>) {
  const onDismiss = () => {
    if (props.onDismiss) {
      props.onDismiss();
    }
  };

  return (
    <RNModal transparent={true} {...props}>
      <ZStack flex={1}>
        <Overlay onPress={onDismiss} />
        <View flex={1} position="absolute">
          {props.children}
        </View>
      </ZStack>
    </RNModal>
  );
}

import { ComponentProps } from 'react';
import { Modal as RNModal } from 'react-native';

import { View, ZStack } from '../core';

export function Modal(props: ComponentProps<typeof RNModal>) {
  const onDismiss = () => {
    console.log('got dismiss..');
    if (props.onDismiss) {
      props.onDismiss();
    }
  };

  return (
    <RNModal transparent={true} {...props}>
      <ZStack flex={1} justifyContent="center" alignItems="center">
        <ModalOverlay onPress={onDismiss} />
        <View
          flex={1}
          justifyContent="center"
          alignItems="center"
          onPress={onDismiss}
        >
          {props.children}
        </View>
      </ZStack>
    </RNModal>
  );
}

export function ModalOverlay(props: ComponentProps<typeof View>) {
  return <View flex={1} backgroundColor="$darkOverlay" {...props} />;
}

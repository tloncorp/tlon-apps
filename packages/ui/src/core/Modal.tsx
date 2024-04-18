import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { ComponentProps } from 'react';
import { Modal as RNModal } from 'react-native';

import { View, ZStack } from './tamagui';

export function Modal(props: ComponentProps<typeof RNModal>) {
  const onDismiss = () => {
    if (props.onDismiss) {
      props.onDismiss();
    }
  };

  return (
    <RNModal transparent={true} {...props}>
      <ZStack flex={1} justifyContent="center" alignItems="center">
        <ModalOverlay onPress={onDismiss} />
        <View flex={1} position="absolute" onPress={onDismiss}>
          {props.children}
        </View>
      </ZStack>
    </RNModal>
  );
}

export function ModalOverlay(props: ComponentProps<typeof View>) {
  return (
    <MotiView
      style={{ flex: 1 }}
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        opacity: {
          type: 'timing',
          delay: 150,
          duration: 200,
        },
      }}
    >
      <View flex={1} {...props}>
        <BlurView style={{ flex: 1 }} intensity={40} tint="dark" />
      </View>
    </MotiView>
  );
}

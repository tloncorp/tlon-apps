import { ParentAgnosticKeyboardAvoidingView } from '@tloncorp/ui';
import { useFixtureSelect } from 'react-cosmos/client';
import {
  Button,
  Keyboard,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import { ScrollView, View as TamaguiView, Text, YStack } from 'tamagui';

import { FixtureWrapper } from './FixtureWrapper';

export default function ParentAgnosticKeyboardAvoidingViewDemo() {
  const [componentType, setComponentType] = useFixtureSelect(
    'KAV implementation',
    {
      defaultValue: 'ParentAgnosticKeyboardAvoidingView',
      options: ['ParentAgnosticKeyboardAvoidingView', 'KeyboardAvoidingView'],
    }
  );

  const KAVComponent =
    componentType === 'ParentAgnosticKeyboardAvoidingView'
      ? ParentAgnosticKeyboardAvoidingView
      : KeyboardAvoidingView;

  return (
    <FixtureWrapper
      fillWidth
      fillHeight
      // Using safe area insets also exercises the KeyboardAvoidingView behavior,
      // but it's maybe harder to follow than an explicit paddingBottom -
      // uncommenting the following line should still work with
      // `ParentAgnosticKeyboardAvoidingView`.
      //
      safeArea={true}
    >
      <TamaguiView
        // With a stock `KeyboardAvoidingView`, using `paddingTop > 0` would break layout.
        paddingTop={100}
        backgroundColor="$background"
        flex={1}
      >
        <YStack justifyContent="space-between" width="100%" height="100%">
          <YStack alignItems="stretch" flex={1}>
            <ScrollView
              flex={1}
              contentContainerStyle={{
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                gap: 12,
              }}
            >
              <Button
                title={`Now using: ${componentType}`}
                onPress={() =>
                  setComponentType(
                    componentType === 'ParentAgnosticKeyboardAvoidingView'
                      ? 'KeyboardAvoidingView'
                      : 'ParentAgnosticKeyboardAvoidingView'
                  )
                }
              />
              <TextInput placeholder="Use me to show keyboard" />
              <Button onPress={Keyboard.dismiss} title="Dismiss keyboard" />
            </ScrollView>
            <KAVComponent>
              <Text
                style={{ padding: 10, backgroundColor: 'rgba(255, 0, 0, 0.2)' }}
              >
                I avoid the keyboard
              </Text>
            </KAVComponent>
          </YStack>
          <Text
            style={{ padding: 10, backgroundColor: 'rgba(0, 255, 0, 0.2)' }}
          >
            Footer
          </Text>
        </YStack>
      </TamaguiView>
    </FixtureWrapper>
  );
}

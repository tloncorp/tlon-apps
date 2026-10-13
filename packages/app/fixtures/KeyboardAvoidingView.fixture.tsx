import { Button, Keyboard, TextInput } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Text, YStack } from 'tamagui';

import { FixtureWrapper } from './FixtureWrapper';

export default function KeyboardAvoidingViewDemo() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} paddingTop={100}>
        <KeyboardAvoidingView
          behavior="padding"
          automaticOffset
          style={{ flex: 1 }}
        >
          <YStack flex={1} justifyContent="space-between">
            <Text>The parent has a vertical offset.</Text>
            <TextInput placeholder="Use me to show keyboard" />
            <Button onPress={Keyboard.dismiss} title="Dismiss keyboard" />
          </YStack>
        </KeyboardAvoidingView>
        <Text>Footer outside keyboard avoidance</Text>
      </YStack>
    </FixtureWrapper>
  );
}

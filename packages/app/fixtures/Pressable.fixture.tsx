import { Pressable, Text, View } from '@tloncorp/ui';
import { useValue } from 'react-cosmos/client';
import { Alert, SafeAreaView, Switch } from 'react-native';

export default {
  Nested() {
    const [innerPressableEnabled, setInnerPressableEnabled] = useValue(
      'Enable inner press handler',
      { defaultValue: true }
    );
    const [siblingPressableEnabled, setSiblingPressableEnabled] = useValue(
      'Enable sibling press handler',
      { defaultValue: true }
    );
    return (
      <SafeAreaView>
        <View>
          <Pressable
            padding={20}
            backgroundColor="$negativeBackground"
            onPress={() => {
              Alert.alert('Outer: onPress fired');
            }}
            onTouchEndCapture={(event) => {
              event.stopPropagation();
            }}
          >
            <Text padding={20}>Outer view (has onPress handler)</Text>
            <Pressable
              padding={20}
              backgroundColor="$positiveBackground"
              onPress={
                innerPressableEnabled
                  ? (event) => {
                      event.persist();
                      console.log(event);
                      Alert.alert('Inner: onPress fired');
                    }
                  : undefined
              }
            >
              <Text padding={20}>
                Inner view{' '}
                {innerPressableEnabled
                  ? '(has onPress handler)'
                  : '(does not have onPress handler)'}{' '}
              </Text>
            </Pressable>
          </Pressable>

          {/* Sibling floating above the other pressables */}
          <Pressable
            position="absolute"
            bottom={20}
            right={0}
            padding={20}
            backgroundColor="rgba(100, 255, 100, 0.5)"
            onPress={
              siblingPressableEnabled
                ? () => {
                    Alert.alert('Sibling: onPress fired');
                  }
                : undefined
            }
          >
            <Text>
              Sibling (press handler{' '}
              {siblingPressableEnabled ? 'enabled' : 'disabled'})
            </Text>
          </Pressable>
        </View>

        {/* Settings panel */}
        <View gap={8} padding={8}>
          <View flexDirection="row" alignItems="center" gap={12}>
            <Switch
              value={innerPressableEnabled}
              onValueChange={setInnerPressableEnabled}
            />
            <Text>Enable inner press handler</Text>
          </View>
          <View flexDirection="row" alignItems="center" gap={12}>
            <Switch
              value={siblingPressableEnabled}
              onValueChange={setSiblingPressableEnabled}
            />
            <Text>Enable sibling press handler</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  },
};

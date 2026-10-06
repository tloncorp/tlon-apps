import { Switch } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, View, XStack, YStack, getTokenValue } from 'tamagui';

import { useIsWindowNarrow } from '../utils';
import { Field, TextInput } from './Form';
import { ScreenHeader } from './ScreenHeader';
import { useScreenScrollProps } from './useScreenScrollProps';

export type FeatureFlagTextSetting = {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  secure?: boolean;
  onChange: (value: string) => void;
};

export function FeatureFlagScreenView({
  features,
  textSettings,
  onBackPressed,
  onFlagToggled,
}: {
  features: { name: string; label: string; enabled: boolean }[];
  textSettings?: FeatureFlagTextSetting[];
  onBackPressed: () => void;
  onFlagToggled: (flagName: string, enabled: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollProps = useScreenScrollProps();

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? onBackPressed : undefined}
        title="Experimental features"
        placement="navigation"
      />
      <KeyboardAwareScrollView
        {...scrollProps}
        bottomOffset={24}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 600,
          marginHorizontal: 'auto',
        }}
        contentContainerStyle={{
          gap: getTokenValue('$s', 'size'),
          paddingTop: getTokenValue('$l', 'size'),
          paddingHorizontal: getTokenValue('$l', 'size'),
          paddingBottom: insets.bottom,
        }}
      >
        {features.map((feature) => {
          return (
            <XStack
              key={feature.name}
              justifyContent="space-between"
              alignItems="center"
              padding="$l"
            >
              <SizableText flexShrink={1}>{feature.label}</SizableText>
              <Switch
                style={{ flexShrink: 0 }}
                value={feature.enabled}
                onValueChange={(enabled) =>
                  onFlagToggled(feature.name, enabled)
                }
              ></Switch>
            </XStack>
          );
        })}
        {textSettings?.map((setting) => (
          <YStack key={setting.key} padding="$l">
            <Field label={setting.label}>
              <TextInput
                value={setting.value}
                placeholder={setting.placeholder}
                secureTextEntry={setting.secure}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setting.onChange}
              />
            </Field>
          </YStack>
        ))}
      </KeyboardAwareScrollView>
    </View>
  );
}

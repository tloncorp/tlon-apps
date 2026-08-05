import { Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, SizableText, View, XStack, YStack } from 'tamagui';

import { useIsWindowNarrow } from '../utils';
import { Field, TextInput } from './Form';
import { ScreenHeader } from './ScreenHeader';

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

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? onBackPressed : undefined}
        title={'Experimental features'}
      />
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 600,
          marginHorizontal: 'auto',
        }}
        contentContainerStyle={{
          gap: '$s',
          paddingTop: '$l',
          paddingHorizontal: '$l',
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
      </ScrollView>
    </View>
  );
}

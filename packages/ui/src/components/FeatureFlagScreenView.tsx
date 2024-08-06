import { Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, SizableText, View, XStack } from 'tamagui';

import { GenericHeader } from './GenericHeader';

export function FeatureFlagScreenView({
  features,
  onBackPressed,
  onFlagToggled,
}: {
  features: { name: string; label: string; enabled: boolean }[];
  onBackPressed: () => void;
  onFlagToggled: (flagName: string, enabled: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  console.log('render', features);

  return (
    <View flex={1}>
      <GenericHeader title={'Feature Previews'} goBack={onBackPressed} />
      <ScrollView
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
              <SizableText>{feature.label}</SizableText>
              <Switch
                value={feature.enabled}
                onValueChange={(enabled) =>
                  onFlagToggled(feature.name, enabled)
                }
              ></Switch>
            </XStack>
          );
        })}
      </ScrollView>
    </View>
  );
}

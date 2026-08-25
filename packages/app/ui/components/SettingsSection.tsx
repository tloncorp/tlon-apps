import { Text } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';
import { View, YStack } from 'tamagui';

export function SettingsSection({
  title,
  description,
  children,
}: PropsWithChildren<{
  title?: string;
  description?: string;
}>) {
  return (
    <YStack gap="$m">
      {title ? (
        <Text
          size="$label/m"
          color="$secondaryText"
          fontWeight="500"
          paddingHorizontal="$s"
        >
          {title}
        </Text>
      ) : null}
      <YStack
        borderWidth={1}
        borderColor="$border"
        borderRadius="$xl"
        backgroundColor="$background"
        overflow="hidden"
      >
        {children}
      </YStack>
      {description ? (
        <Text size="$label/s" color="$secondaryText" paddingHorizontal="$s">
          {description}
        </Text>
      ) : null}
    </YStack>
  );
}

export function SettingsDivider() {
  return <View height={1} backgroundColor="$border" />;
}

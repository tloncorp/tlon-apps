import { Button, Icon, LoadingSpinner, Text } from '@tloncorp/ui';
import { ComponentProps, ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { useTopLevelTabBarClearance } from '../../../navigation/useTopLevelTabBarContentInset';
import { ImageAvatar, SigilAvatar } from '../../../ui/components/Avatar';
import { SettingsSection } from '../../../ui/components/SettingsSection';

/** Bot settings forms sit beside the native settings lists, so group like them. */
export function BotSettingsSection(
  props: Omit<ComponentProps<typeof SettingsSection>, 'variant'>
) {
  return <SettingsSection variant="grouped" {...props} />;
}
export function BotAvatar({
  size,
  avatarUrl,
  sigilContactId,
}: {
  size: number;
  avatarUrl?: string;
  /** Shown in place of a missing avatar; the face icon stands in without it. */
  sigilContactId?: string;
}) {
  return (
    <ImageAvatar
      imageUrl={avatarUrl || undefined}
      width={size}
      height={size}
      borderRadius="$l"
      fallback={
        sigilContactId ? (
          <SigilAvatar
            contactId={sigilContactId}
            size="custom"
            width={size}
            height={size}
            borderRadius="$l"
          />
        ) : (
          <View
            width={size}
            height={size}
            alignItems="center"
            justifyContent="center"
            borderRadius="$l"
            backgroundColor="$background"
          >
            <Icon type="Face" size="$l" color="$secondaryText" />
          </View>
        )
      }
    />
  );
}

export function ApplyChangesBar({
  changeCount,
  labels,
  applying,
  disabled,
  error,
  onDiscard,
  onApply,
}: {
  changeCount: number;
  labels: string[];
  applying: boolean;
  disabled?: boolean;
  error?: string | null;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const insets = useSafeAreaInsets();
  // On the Settings tab the native tab bar floats over the bottom of the
  // screen, so the bar has to clear it rather than the home indicator alone.
  // Off the tab screens the clearance is 0 and the safe area applies as before.
  const tabBarClearance = useTopLevelTabBarClearance();

  if (changeCount === 0 && !error && !applying) {
    return null;
  }

  return (
    <YStack
      borderTopWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      paddingHorizontal="$l"
      paddingTop="$m"
      paddingBottom={tabBarClearance || insets.bottom}
      gap="$m"
    >
      {/* Surface apply errors right here, above the buttons — otherwise they're
          easy to miss buried in the scrolling form. */}
      {error ? <BotSettingsErrorText>{error}</BotSettingsErrorText> : null}
      {applying ? <LoadingSpinner size="small" /> : null}
      {!applying ? (
        <YStack gap="$m">
          <Button
            preset="secondaryOutline"
            label="Discard"
            onPress={onDiscard}
          />
          <Button
            preset="primary"
            label={`Apply ${changeCount} Change${changeCount > 1 ? 's' : ''}`}
            disabled={disabled}
            onPress={onApply}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

export function BotSettingsErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text size="$label/s" color="$negativeActionText" paddingHorizontal="$s">
      {children}
    </Text>
  );
}

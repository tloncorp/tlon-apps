import { TlonText } from '@tloncorp/ui';
import { View, YStack } from 'tamagui';

import { ArvosDiscussing } from '../../ui';

function EmptyStateBase({ children }: { children: React.ReactNode }) {
  return (
    <View
      flex={1}
      backgroundColor="$secondaryBackground"
      position="relative"
      overflow="hidden"
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        paddingHorizontal="$4xl"
      >
        {children}
      </YStack>
    </View>
  );
}

export function HomeEmptyState() {
  return (
    <EmptyStateBase>
      <YStack gap="$3xl" alignItems="center" maxWidth={280}>
        <ArvosDiscussing
          color="$tertiaryText"
          maxHeight={200}
          aspectRatio={911 / 755}
        />
        <YStack gap="$m" alignItems="center">
          <TlonText.Text size="$label/2xl" color="$primaryText">
            Start messaging!
          </TlonText.Text>
          <TlonText.Text size="$label/m" color="$tertiaryText">
            Your chats will appear here.
          </TlonText.Text>
        </YStack>
      </YStack>
    </EmptyStateBase>
  );
}

export function MessagesEmptyState() {
  return (
    <EmptyStateBase>
      <></>
    </EmptyStateBase>
  );
}

export function ActivityEmptyState() {
  return (
    <EmptyStateBase>
      <></>
    </EmptyStateBase>
  );
}

export function SettingsEmptyState() {
  return (
    <EmptyStateBase>
      <></>
    </EmptyStateBase>
  );
}

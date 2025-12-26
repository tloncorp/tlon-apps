import { View, YStack } from 'tamagui';

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
      <></>
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

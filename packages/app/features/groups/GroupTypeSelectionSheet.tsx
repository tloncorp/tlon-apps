import { Pressable, Text } from '@tloncorp/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { ActionSheet, useIsWindowNarrow } from '../../ui';
import { SplashOptionCard } from '../../ui/components/Wayfinding/SplashOptionCard';
import { buildStarterOptions } from '../../ui/components/Wayfinding/starterOptions';

/**
 * The create-a-workspace picker, mirroring onboarding's starter screen: the
 * same kit options, the same "Something else" escape hatch. Onboarding is
 * select-then-Next because it sits in a paged sequence; here a tap chooses,
 * which is the sheet idiom. Either way the answer is a kit id — `undefined`
 * means "no starter", which provisioning maps to the blank kit so the result
 * is still a workspace with a seated agent.
 */
export function GroupTypeSelectionSheet({
  open,
  onOpenChange,
  onSelectKit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectKit: (kitId?: string) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();
  const options = buildStarterOptions();

  const content = (
    <YStack flex={1} gap="$l" paddingBottom={bottom}>
      <ActionSheet.SimpleHeader
        title="Create a workspace"
        subtitle="Pick something to start with. You can change it later, or add more."
      />
      <YStack gap="$m" paddingHorizontal="$xl">
        {options.map((option) => (
          <SplashOptionCard
            key={option.id}
            testID={`create-starter-option-${option.id}`}
            option={{
              label: option.label,
              description: option.description,
              recommendationLabel: option.recommendationLabel,
            }}
            selected={false}
            onPress={() => onSelectKit(option.id)}
          />
        ))}
        <Pressable
          testID="create-starter-something-else"
          onPress={() => onSelectKit(undefined)}
        >
          <Text
            size="$label/m"
            color="$secondaryText"
            textAlign="center"
            paddingVertical="$l"
          >
            Something else
          </Text>
        </Pressable>
      </YStack>
    </YStack>
  );

  if (!isWindowNarrow) {
    return (
      <ActionSheet
        open={open}
        onOpenChange={onOpenChange}
        mode="dialog"
        closeButton
        dialogContentProps={{ width: 600 }}
      >
        <View flex={1} padding="$m">
          {content}
        </View>
      </ActionSheet>
    );
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[90]}
      snapPointsMode="percent"
      modal
    >
      {content}
    </ActionSheet>
  );
}

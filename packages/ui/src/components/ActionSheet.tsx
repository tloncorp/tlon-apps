import { ColorTokens, Stack, Text, View } from '../core';
import { Sheet } from './Sheet';

export type Action = {
  title: string;
  description?: string;
  backgroundColor?: ColorTokens;
  borderColor?: ColorTokens;
  titleColor?: ColorTokens;
  action?: () => void;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: Action[];
  sheetTitle?: string;
  sheetDescription?: string;
};

export default function ActionSheet({
  open,
  onOpenChange,
  sheetTitle,
  sheetDescription,
  actions,
}: Props) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPointsMode="fit"
      animation="quick"
    >
      <Sheet.Overlay animation="quick" />
      <Sheet.Frame>
        <Sheet.Handle paddingTop="$xl" />
        <View
          gap="$xl"
          paddingHorizontal="$2xl"
          paddingTop="$xl"
          paddingBottom="$4xl"
        >
          {sheetTitle || sheetDescription ? (
            <Stack paddingBottom="$m" flexDirection="column">
              {sheetTitle ? (
                <Text fontSize="$l" fontWeight="500">
                  {sheetTitle}
                </Text>
              ) : null}
              {sheetDescription ? (
                <Text fontSize="$l" color="$secondaryText">
                  {sheetDescription}
                </Text>
              ) : null}
            </Stack>
          ) : null}

          {actions.map((action, index) => (
            <Stack
              key={index}
              padding="$l"
              backgroundColor={action.backgroundColor}
              borderWidth={1}
              borderColor={action.borderColor ?? 'rgb(229, 229, 229)'}
              borderRadius="$l"
              onPress={action.action}
            >
              <Text fontSize="$l" color={action.titleColor} fontWeight="500">
                {action.title}
              </Text>
              {action.description ? (
                <Text color="$secondaryText" fontSize="$s">
                  {action.description}
                </Text>
              ) : null}
            </Stack>
          ))}
        </View>
      </Sheet.Frame>
    </Sheet>
  );
}

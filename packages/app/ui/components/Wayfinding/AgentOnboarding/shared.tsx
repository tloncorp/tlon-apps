import { AgentGroupTemplate } from '@tloncorp/shared/domain';
import { Icon, IconType, LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import { View, XStack, YStack } from 'tamagui';

export interface BuildLine {
  id: string;
  text: string;
  /** bolded fragment appended after `text` */
  emphasis?: string;
  /** muted trailing fragment, em-dash separated */
  aside?: string;
  tone: 'done' | 'muted';
}

export const ACCENTS: Record<
  'blue' | 'green' | 'indigo',
  { soft: string; strong: string }
> = {
  blue: { soft: '$blueSoft', strong: '$blue' },
  green: { soft: '$greenSoft', strong: '$green' },
  indigo: { soft: '$indigoSoft', strong: '$indigo' },
};

export function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function AgentAvatar({ size }: { size: number }) {
  return (
    <View
      width={size}
      height={size}
      borderRadius={size / 4}
      backgroundColor="$secondaryBackground"
      alignItems="center"
      justifyContent="center"
    >
      <Text fontSize={size * 0.55} trimmed={false}>
        🌱
      </Text>
    </View>
  );
}

export function PurposeCard({
  template,
  onPress,
}: {
  template: AgentGroupTemplate;
  onPress: () => void;
}) {
  const agent = template.agent;
  const accent = ACCENTS[agent.cardColor];
  return (
    <Pressable testID={`PurposeCard-${template.id}`} onPress={onPress}>
      <XStack
        borderWidth={1}
        borderColor="$border"
        borderRadius="$xl"
        padding="$l"
        gap="$l"
        alignItems="flex-start"
        backgroundColor="$background"
      >
        <View
          width={32}
          height={32}
          borderRadius="$m"
          backgroundColor={accent.soft as '$blueSoft'}
          alignItems="center"
          justifyContent="center"
        >
          <Icon
            type={agent.cardIcon as IconType}
            color={accent.strong as '$blue'}
            customSize={[18, 18]}
          />
        </View>
        <YStack flex={1} minWidth={0} gap="$xs">
          <Text size="$label/l" fontWeight="500" trimmed={false}>
            {agent.cardTitle}
          </Text>
          <Text size="$label/m" color="$secondaryText" trimmed={false}>
            {agent.cardDescription}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  );
}

export function BuildReceipt({
  lines,
  activeLabel,
  inset = true,
}: {
  lines: BuildLine[];
  activeLabel: string | null;
  /** true when rendered in the scripted transcript, indented under the agent */
  inset?: boolean;
}) {
  return (
    <YStack
      borderWidth={1}
      borderColor="$border"
      borderRadius="$xl"
      marginLeft={inset ? 54 : 0}
      marginRight={inset ? '$xl' : 0}
      marginTop="$s"
      paddingHorizontal="$l"
      paddingVertical="$xs"
      backgroundColor="$background"
    >
      {lines.map((line, index) => (
        <XStack
          key={line.id}
          alignItems="center"
          gap="$m"
          paddingVertical={9}
          borderBottomWidth={index === lines.length - 1 && !activeLabel ? 0 : 1}
          borderBottomColor="$secondaryBackground"
        >
          <Icon
            type={line.tone === 'muted' ? 'Info' : 'Checkmark'}
            color={line.tone === 'muted' ? '$tertiaryText' : '$green'}
            customSize={[15, 15]}
          />
          <Text size="$label/m" trimmed={false} flex={1}>
            {line.text}
            {line.emphasis ? (
              <Text size="$label/m" fontWeight="600" trimmed={false}>
                {line.emphasis}
              </Text>
            ) : null}
            {line.aside ? (
              <Text size="$label/m" color="$secondaryText" trimmed={false}>
                {' '}
                — {line.aside}
              </Text>
            ) : null}
          </Text>
        </XStack>
      ))}
      {activeLabel ? (
        <XStack alignItems="center" gap="$m" paddingVertical={9}>
          <LoadingSpinner size="small" color="$positiveActionText" />
          <Text
            size="$label/m"
            color="$positiveActionText"
            trimmed={false}
            flex={1}
          >
            {activeLabel}
          </Text>
        </XStack>
      ) : null}
    </YStack>
  );
}

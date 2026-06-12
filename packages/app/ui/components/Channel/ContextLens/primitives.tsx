import { Pressable } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';

import { type LensTone, TONE_COLORS } from './format';

export function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack
      gap="$s"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      padding="$m"
      backgroundColor="$secondaryBackground"
    >
      <SizableText
        size="$s"
        color="$tertiaryText"
        textTransform="uppercase"
        letterSpacing={0}
      >
        {title}
      </SizableText>
      {children}
    </YStack>
  );
}

export function Metric({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const row = (
    <XStack
      alignItems="flex-start"
      justifyContent="space-between"
      gap="$m"
      minWidth={0}
    >
      <SizableText size="$s" color="$secondaryText" flexShrink={0}>
        {label}
      </SizableText>
      <SizableText
        size="$s"
        color={onPress ? '$positiveActionText' : '$primaryText'}
        textAlign="right"
        flex={1}
        minWidth={0}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </SizableText>
    </XStack>
  );

  if (!onPress) {
    return row;
  }

  return (
    <Pressable onPress={onPress} pressStyle={{ opacity: 0.6 }}>
      {row}
    </Pressable>
  );
}

export function DetailRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return <Metric label={label} value={value || 'unknown'} onPress={onPress} />;
}

export function PreviewText({ value }: { value: string }) {
  return (
    <SizableText
      size="$s"
      color="$secondaryText"
      backgroundColor="$background"
      borderRadius="$s"
      padding="$s"
    >
      {value}
    </SizableText>
  );
}

export function MutedLine({ value }: { value: string }) {
  return (
    <SizableText size="$s" color="$tertiaryText">
      {value}
    </SizableText>
  );
}

export function LensListItem({
  title,
  meta,
  detail,
  tone,
}: {
  title: string;
  meta: string;
  detail: string;
  tone: LensTone;
}) {
  return (
    <YStack
      gap="$2xs"
      minWidth={0}
      borderLeftWidth={2}
      borderColor={TONE_COLORS[tone]}
      paddingLeft="$s"
      paddingVertical="$2xs"
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$s"
        minWidth={0}
      >
        <SizableText
          size="$s"
          color="$primaryText"
          flex={1}
          minWidth={0}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {title}
        </SizableText>
        <SizableText size="$s" color="$tertiaryText" flexShrink={0}>
          {meta}
        </SizableText>
      </XStack>
      <SizableText size="$s" color="$secondaryText">
        {detail}
      </SizableText>
    </YStack>
  );
}

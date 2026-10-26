import { Button, Text } from '@tloncorp/ui';
import type { ReactElement, ReactNode } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../../ActionSheet';
import { ListItem } from '../../ListItem';

export type FirstRunSheetRow = {
  key: string;
  icon?: ReactNode;
  /** A small grey label above the title, as in the access sheet. */
  label?: string;
  title: string;
  detail?: string;
};

/**
 * The short sheets the first run asks before handing off to someone else's
 * sign-in: a header, a line of context, a grouped card of facts, then go on
 * or stay.
 */
export function FirstRunSheet({
  open,
  onOpenChange,
  title,
  icon,
  intro,
  rows,
  footnote,
  primaryLabel,
  onPrimary,
  primaryLoading,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  testID,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: ReactElement;
  intro?: string;
  rows: FirstRunSheetRow[];
  footnote?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel: string;
  onSecondary: () => void;
  testID?: string;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} title={title} modal>
      {/* The title lines up with the text under it, as on the canvas. */}
      <ActionSheet.Header leadingIcon paddingLeft="$s">
        {icon ?? null}
        <ListItem.MainContent>
          <Text
            fontSize={20}
            lineHeight={26}
            fontWeight="600"
            letterSpacing={-0.3}
            color="$primaryText"
            accessibilityRole="header"
          >
            {title}
          </Text>
        </ListItem.MainContent>
      </ActionSheet.Header>
      <ActionSheet.Content testID={testID}>
        <YStack paddingHorizontal="$xl" gap="$l">
          {intro ? (
            <Text
              fontSize={16}
              lineHeight={24}
              color="$primaryText"
              paddingHorizontal="$xs"
            >
              {intro}
            </Text>
          ) : null}
          <YStack
            backgroundColor="$secondaryBackground"
            borderRadius={22}
            paddingHorizontal="$xl"
          >
            {rows.map((row, index) => (
              <XStack
                key={row.key}
                paddingVertical="$l"
                gap="$l"
                alignItems="flex-start"
                borderBottomWidth={index < rows.length - 1 ? 1 : 0}
                borderColor="$border"
              >
                {row.icon ? (
                  <View marginTop={1} flexShrink={0}>
                    {row.icon}
                  </View>
                ) : null}
                <YStack flex={1} gap={2}>
                  {row.label ? (
                    <Text fontSize={14} lineHeight={20} color="$secondaryText">
                      {row.label}
                    </Text>
                  ) : null}
                  <Text fontSize={16} lineHeight={22} color="$primaryText">
                    {row.title}
                  </Text>
                  {row.detail ? (
                    <Text fontSize={14} lineHeight={20} color="$secondaryText">
                      {row.detail}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
            ))}
          </YStack>
          {footnote ? (
            <Text
              fontSize={14}
              lineHeight={20}
              color="$secondaryText"
              paddingHorizontal="$xs"
            >
              {footnote}
            </Text>
          ) : null}
          <YStack gap="$xs" marginTop="$xs">
            <Button
              preset="hero"
              label={primaryLabel}
              onPress={onPrimary}
              loading={primaryLoading}
              disabled={primaryDisabled || primaryLoading}
              testID="first-run-sheet-primary"
            />
            <Button
              preset="minimal"
              intent="secondary"
              centered
              label={secondaryLabel}
              onPress={onSecondary}
              testID="first-run-sheet-secondary"
            />
          </YStack>
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

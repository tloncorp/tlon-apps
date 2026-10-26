import { Button, Icon, LoadingSpinner, Text } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import { useIsDarkMode } from '../../../../hooks/useDarkMode';
import { ScreenHeader } from '../../ScreenHeader';
import { FIRST_RUN_STEP_COUNT, firstRunCopy } from './firstRunCopy';
import type { FirstRunSetupStatus } from './types';

// Measurements from the design canvas (a 390 × 844 phone).
export const FIRST_RUN_ART_HEIGHT = 340;
const HEADER_HEIGHT = 44;
const CONTENT_TOP_UNDER_ART = 20;
const CONTENT_TOP_UNDER_HEADER = 12;
const FOOTER_GAP = 14;
const DOT_SIZE = 7;

export function FirstRunTitle({
  title,
  accent,
}: {
  title: string;
  accent: string;
}) {
  return (
    <Text
      marginHorizontal="$xl"
      fontSize={24}
      lineHeight={30}
      fontWeight="600"
      letterSpacing={-0.3}
      color="$primaryText"
      accessibilityRole="header"
    >
      {title}{' '}
      <Text
        fontSize={24}
        lineHeight={30}
        fontWeight="600"
        letterSpacing={-0.3}
        color="$positiveActionText"
      >
        {accent}
      </Text>
    </Text>
  );
}

export function StepDots({ step }: { step: number }) {
  const isDark = useIsDarkMode();
  return (
    <XStack
      justifyContent="center"
      gap="$s"
      accessible
      accessibilityRole="image"
      accessibilityLabel={firstRunCopy.stepLabel(step)}
    >
      {Array.from({ length: FIRST_RUN_STEP_COUNT }, (_, index) => (
        <View
          key={index}
          width={DOT_SIZE}
          height={DOT_SIZE}
          borderRadius={DOT_SIZE / 2}
          backgroundColor={
            index + 1 === step ? '$primaryText' : isDark ? '#4A4646' : '#D6D6D6'
          }
        />
      ))}
    </XStack>
  );
}

/** The quiet line above the dots that carries setup from screen 2 on. */
export function SetupStatusLine({ status }: { status: FirstRunSetupStatus }) {
  return (
    <XStack
      justifyContent="center"
      alignItems="center"
      gap="$m"
      minHeight={16}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID={`first-run-status-${status}`}
    >
      {status === 'running' ? (
        <View
          width={14}
          height={14}
          alignItems="center"
          justifyContent="center"
        >
          <View transform={[{ scale: 0.7 }]}>
            <LoadingSpinner size="small" color="$secondaryText" />
          </View>
        </View>
      ) : status === 'ready' ? (
        <Icon type="Checkmark" customSize={[14, 14]} color="$secondaryText" />
      ) : null}
      <Text fontSize={13} lineHeight={16} color="$secondaryText">
        {firstRunCopy.status[status]}
      </Text>
    </XStack>
  );
}

/**
 * The frame every first-run screen shares: art or a back row on top, a
 * two-tone title, optional body text and content, then the status line, the
 * five step dots and the big button. The middle scrolls on short phones.
 */
export function FirstRunFrame({
  step,
  art,
  artHeight = FIRST_RUN_ART_HEIGHT,
  onBack,
  title,
  accent,
  body,
  children,
  status,
  primaryLabel,
  onPrimary,
  primaryLoading,
  primaryDisabled,
  overlay,
  testID,
}: {
  step: number;
  art?: ReactNode;
  artHeight?: number;
  onBack?: () => void;
  title: string;
  accent: string;
  body?: string;
  children?: ReactNode;
  status?: FirstRunSetupStatus | null;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  /** Sheets the screen presents, kept outside its scrolling content. */
  overlay?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const backButton = onBack ? (
    <ScreenHeader.BackButton onPress={onBack} />
  ) : null;

  return (
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={Math.max(insets.bottom, 16)}
      testID={testID}
    >
      {art ? (
        <View height={artHeight} width="100%" overflow="hidden">
          {art}
        </View>
      ) : (
        <XStack
          height={HEADER_HEIGHT}
          paddingHorizontal="$xs"
          alignItems="center"
        >
          {backButton}
        </XStack>
      )}
      {art && backButton ? (
        <XStack
          position="absolute"
          top={insets.top}
          left="$xs"
          height={HEADER_HEIGHT}
          alignItems="center"
          zIndex={1}
        >
          {backButton}
        </XStack>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: art ? CONTENT_TOP_UNDER_ART : CONTENT_TOP_UNDER_HEADER,
          paddingBottom: 8,
        }}
        bounces={false}
      >
        <FirstRunTitle title={title} accent={accent} />
        {body ? (
          <Text
            marginTop="$l"
            marginHorizontal="$xl"
            fontSize={16}
            lineHeight={24}
            color="$secondaryText"
          >
            {body}
          </Text>
        ) : null}
        {children}
      </ScrollView>

      <YStack paddingHorizontal="$xl" paddingTop="$l" gap={FOOTER_GAP}>
        {status ? <SetupStatusLine status={status} /> : null}
        <StepDots step={step} />
        <Button
          preset="hero"
          shadow
          label={primaryLabel}
          onPress={onPrimary}
          loading={primaryLoading}
          disabled={primaryDisabled || primaryLoading}
          testID="first-run-primary"
        />
      </YStack>
      {overlay}
    </View>
  );
}

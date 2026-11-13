import { LoadingSpinner, Pressable, Text, triggerHaptic } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import { useIsDarkMode } from '../../../../hooks/useDarkMode';
import { ScreenHeader } from '../../ScreenHeader';

/** Profile, Setting up, then the five first-run screens. */
export const ONBOARDING_STEP_COUNT = 9;

const HEADER_HEIGHT = 44;
const DOT_SIZE = 7;
/** The drawing and the list under it sit this far apart. */
export const ART_TO_CONTENT_GAP = 32;

export function OnboardingStepDots({ step }: { step: number }) {
  const isDark = useIsDarkMode();
  return (
    <XStack
      justifyContent="center"
      gap={6}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Step ${step} of ${ONBOARDING_STEP_COUNT}`}
    >
      {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => (
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

export type LineButtonProps = {
  label: string;
  onPress: () => void;
  /** Quiet is the gray button: a way past the screen, not its main action. */
  tone?: 'primary' | 'quiet';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

/** The big button at the foot of each screen. */
export function LineButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
  loading,
  testID,
}: LineButtonProps) {
  const inactive = disabled || loading;
  const background = disabled
    ? '$border'
    : tone === 'quiet'
      ? '$secondaryBackground'
      : '$primaryText';
  const foreground = disabled
    ? '$tertiaryText'
    : tone === 'quiet'
      ? '$primaryText'
      : '$background';
  return (
    <Pressable
      onPress={() => {
        if (inactive) return;
        triggerHaptic('baseButtonClick');
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      testID={testID}
    >
      <XStack
        height={56}
        borderRadius={12}
        backgroundColor={background}
        alignItems="center"
        justifyContent="center"
        gap="$m"
        paddingHorizontal="$xl"
      >
        <Text
          fontSize={17}
          lineHeight={24}
          letterSpacing={-0.2}
          color={foreground}
          numberOfLines={1}
        >
          {label}
        </Text>
        {loading ? <LoadingSpinner size="small" color={foreground} /> : null}
      </XStack>
    </Pressable>
  );
}

/**
 * The frame every onboarding screen shares: a back arrow and the step dots,
 * a centered title and subtitle, the content, and one or two buttons. The
 * content is centered between the subtitle and the buttons unless it says to
 * sit at the top, and it scrolls on short phones.
 */
export function LineStepFrame({
  step,
  onBack,
  title,
  subtitle,
  children,
  align = 'center',
  primary,
  secondary,
  footer,
  overlay,
  keyboardBottomOffset,
  testID,
}: {
  step: number;
  onBack?: () => void;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  align?: 'center' | 'top';
  primary?: LineButtonProps;
  /** A second button, under the first. */
  secondary?: LineButtonProps;
  /** Replaces the buttons, for a screen that places its own. */
  footer?: ReactNode;
  /** Sheets the screen presents, kept outside its scrolling content. */
  overlay?: ReactNode;
  /**
   * For a screen with a text field: how much room to keep between the focused
   * field and the keyboard, for a button riding on top of it. Short phones
   * then scroll the field into view.
   */
  keyboardBottomOffset?: number;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const Scroll =
    keyboardBottomOffset === undefined ? ScrollView : KeyboardAwareScrollView;
  return (
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top + 2}
      paddingBottom={Math.max(insets.bottom, 14) + 10}
      testID={testID}
    >
      <XStack
        height={HEADER_HEIGHT}
        alignItems="center"
        justifyContent="center"
      >
        {onBack ? (
          <View
            position="absolute"
            left="$s"
            top={0}
            bottom={0}
            justifyContent="center"
          >
            <ScreenHeader.BackButton onPress={onBack} />
          </View>
        ) : null}
        <OnboardingStepDots step={step} />
      </XStack>

      <Scroll
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        {...(keyboardBottomOffset === undefined
          ? {}
          : { bottomOffset: keyboardBottomOffset })}
      >
        <Text
          marginTop={22}
          marginHorizontal="$2xl"
          textAlign="center"
          fontSize={34}
          lineHeight={34}
          letterSpacing={-0.374}
          color="$primaryText"
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            marginTop={10}
            marginHorizontal={32}
            textAlign="center"
            fontSize={16}
            lineHeight={24}
            letterSpacing={-0.032}
            color="$secondaryText"
          >
            {subtitle}
          </Text>
        ) : null}
        <YStack
          flexGrow={1}
          justifyContent={align === 'center' ? 'center' : 'flex-start'}
          paddingTop={24}
        >
          {children}
        </YStack>
      </Scroll>

      {footer ??
        (primary ? (
          <YStack paddingHorizontal="$2xl" gap={12}>
            <LineButton {...primary} />
            {secondary ? <LineButton tone="quiet" {...secondary} /> : null}
          </YStack>
        ) : null)}
      {overlay}
    </View>
  );
}

/** A row of the bullet list under a drawing: an icon, then one line. */
export function LineBulletList({
  items,
}: {
  items: { icon: ReactNode; label: string }[];
}) {
  return (
    <YStack marginHorizontal={40}>
      {items.map((item) => (
        <XStack key={item.label} minHeight={44} alignItems="center" gap={14}>
          <View width={26} alignItems="center">
            {item.icon}
          </View>
          <Text
            flex={1}
            fontSize={16}
            lineHeight={24}
            letterSpacing={-0.032}
            color="$primaryText"
          >
            {item.label}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}

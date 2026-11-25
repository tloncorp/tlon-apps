import { LoadingSpinner, Pressable, Text, triggerHaptic } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '../../ScreenHeader';
import { OnboardingButton } from '../OnboardingButton';
import { LINE, LineOutline, LineRule } from './lineKit';

/** Profile, Notifications, Setting up, then the five first-run screens. */
export const ONBOARDING_STEP_COUNT = 8;

const HEADER_HEIGHT = 44;
const DASH_WIDTH = 16;
const DASH_HEIGHT = 2;
/** The content starts this far under the subtitle. */
const SUBTITLE_TO_CONTENT_GAP = 32;
/** A drawing and the list under it sit this far apart. */
export const ART_TO_CONTENT_GAP = 32;
/** On the first-run screens, the drawing starts this far under the subtitle. */
export const ART_TOP_GAP = 54;
/** There, a bullet list starts this far under the drawing. */
export const ART_TO_BULLETS_GAP = 34;
/** And a boxed list, of models or services, this far. */
export const ART_TO_BOX_GAP = 55;
/** The main button at the foot of each screen, the welcome screen's. */
export const LINE_BUTTON_HEIGHT = 56;
/** A quiet button, its label alone, under the main one. */
const QUIET_BUTTON_HEIGHT = 44;
const QUIET_BUTTON_GAP = 4;
/** Space under the buttons, over the home indicator's inset. */
const FOOT_GAP = 10;
const FOOT_GAP_UNDER_QUIET = 2;

/** The progress along the top: one short dash per step, ink up to this one. */
export function OnboardingStepDots({ step }: { step: number }) {
  return (
    <XStack
      justifyContent="center"
      gap={5}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Step ${step} of ${ONBOARDING_STEP_COUNT}`}
    >
      {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => (
        <View
          key={index}
          width={DASH_WIDTH}
          height={DASH_HEIGHT}
          backgroundColor={index < step ? '$primaryText' : '$border'}
        />
      ))}
    </XStack>
  );
}

export type LineButtonProps = {
  label: string;
  onPress: () => void;
  /** Quiet is a text button: a way past the screen, not its main action. */
  tone?: 'primary' | 'quiet';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

/**
 * The big button at the foot of each screen: the welcome screen's solid,
 * rounded button, without its shadow. A quiet one is its label alone.
 */
export function LineButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
  loading,
  testID,
}: LineButtonProps) {
  if (tone === 'primary') {
    return (
      <OnboardingButton
        shadow={false}
        label={label}
        onPress={onPress}
        disabled={disabled}
        loading={loading}
        testID={testID}
      />
    );
  }
  const inactive = disabled || loading;
  const foreground = disabled ? '$tertiaryText' : '$secondaryText';
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
        height={QUIET_BUTTON_HEIGHT}
        alignItems="center"
        justifyContent="center"
        gap="$m"
      >
        <Text
          size="$label/xl"
          trimmed={false}
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
 * The frame every onboarding screen shares: a back arrow and the progress
 * dashes, a centered title and subtitle, the content, and one or two
 * buttons. The content starts a fixed gap under the subtitle, and it scrolls
 * on short phones.
 */
export function LineStepFrame({
  step,
  onBack,
  title,
  subtitle,
  children,
  contentGap = SUBTITLE_TO_CONTENT_GAP,
  primary,
  secondary,
  footer,
  overlay,
  keyboardBottomOffset,
  testID,
}: {
  /** The step in onboarding's progress; a side screen has none. */
  step?: number;
  onBack?: () => void;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  /**
   * How far under the subtitle the content starts; less than zero reaches up
   * into the subtitle's last line.
   */
  contentGap?: number;
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
      paddingBottom={
        Math.max(insets.bottom, 14) +
        (secondary && !footer ? FOOT_GAP_UNDER_QUIET : FOOT_GAP)
      }
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
        {step === undefined ? null : <OnboardingStepDots step={step} />}
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
          marginTop={28}
          marginHorizontal={32}
          textAlign="center"
          fontSize={26}
          lineHeight={32}
          letterSpacing={-0.5}
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
            size="$label/xl"
            trimmed={false}
            color="$secondaryText"
          >
            {subtitle}
          </Text>
        ) : null}
        <YStack marginTop={contentGap}>{children}</YStack>
      </Scroll>

      {footer ??
        (primary ? (
          <YStack paddingHorizontal="$2xl" gap={QUIET_BUTTON_GAP}>
            <LineButton {...primary} />
            {secondary ? <LineButton tone="quiet" {...secondary} /> : null}
          </YStack>
        ) : null)}
      {overlay}
    </View>
  );
}

/** The underline sits this far under the top of a link's line. */
const LINK_UNDERLINE_TOP = 20;

/** A centered text link with a thin underline, in a 44 pt tap area. */
export function LineTextLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      testID={testID}
    >
      <View height={44} alignItems="center" justifyContent="center">
        <View>
          <Text
            fontSize={15}
            lineHeight={21}
            letterSpacing={-0.1}
            color="$primaryText"
          >
            {label}
          </Text>
          <View
            position="absolute"
            left={0}
            right={0}
            top={LINK_UNDERLINE_TOP}
            height={LINE}
          >
            <LineRule />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** An icon in a small outlined tile, as in the bullet and data lists. */
export const LINE_ICON_TILE = 40;

export function LineIconTile({ children }: { children: ReactNode }) {
  return (
    <View
      width={LINE_ICON_TILE}
      height={LINE_ICON_TILE}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
    >
      {children}
      <LineOutline radius={10} />
    </View>
  );
}

/** The bullet list under a drawing: per row, an icon in a tile, then text. */
export function LineBulletList({
  items,
}: {
  items: { icon: ReactNode; label: string }[];
}) {
  return (
    <YStack marginHorizontal={32} gap={22}>
      {items.map((item) => (
        <XStack key={item.label} alignItems="center" gap={16}>
          <LineIconTile>{item.icon}</LineIconTile>
          <Text flex={1} size="$label/xl" trimmed={false} color="$primaryText">
            {item.label}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}

import { NodeBootPhase } from '@tloncorp/shared/domain';
import { LoadingSpinner, Text } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { View, XStack, YStack } from 'tamagui';

import { useOnboardingGlyph } from './line/AvatarGlyphPicker';
import { ART_TO_CONTENT_GAP, LineStepFrame } from './line/LineStepFrame';
import { LINE, LineOutline, useLineColors } from './line/lineKit';
import { SetupArt } from './line/onboardingArt';

export type SetupStepKey = 'computer' | 'network' | 'bot';

// Each step is done once the boot sequence is past its last phase.
const SETUP_STEPS: {
  key: SetupStepKey;
  label: string;
  lastPhase: NodeBootPhase;
}[] = [
  {
    key: 'computer',
    label: 'Preparing your Tlon computer',
    lastPhase: NodeBootPhase.BOOTING,
  },
  {
    key: 'network',
    label: 'Connecting to the network',
    lastPhase: NodeBootPhase.CONNECTING,
  },
  {
    key: 'bot',
    label: 'Setting up your Tlonbot',
    lastPhase: NodeBootPhase.ACCEPTING_INVITES,
  },
];

/**
 * The step a boot phase is on. At IDLE nothing is in progress yet, so the
 * first step shows as current.
 */
export function setupStepForBootPhase(
  bootPhase: NodeBootPhase
): SetupStepKey | 'done' {
  return SETUP_STEPS.find((step) => bootPhase <= step.lastPhase)?.key ?? 'done';
}

type StepState = 'done' | 'current' | 'pending';

const SPOKEN_STATE: Record<StepState, string> = {
  done: 'done',
  current: 'in progress',
  pending: 'not started',
};

const STEP_ROW = 48;
const MARKER = 32;

/**
 * The Setting up screen at the end of signup, step 2 of onboarding. The first
 * run shows it too, when someone finishes before their Tlonbot is ready.
 * Continue waits for setup; with no `onContinue`, the screen moves on by
 * itself once it's done.
 */
export function SettingUpScreen({
  body,
  current,
  onContinue,
  step = 2,
}: {
  body: ReactNode;
  current: SetupStepKey | 'done';
  onContinue?: () => void;
  /** Which onboarding step's dot is lit; the first run's wait is the last. */
  step?: number;
}) {
  const glyph = useOnboardingGlyph();
  const { ink } = useLineColors();
  const currentIndex =
    current === 'done'
      ? SETUP_STEPS.length
      : SETUP_STEPS.findIndex((step) => step.key === current);
  return (
    <LineStepFrame
      step={step}
      title="Setting up"
      subtitle={body}
      primary={{
        label: 'Continue',
        onPress: () => onContinue?.(),
        disabled: !onContinue || current !== 'done',
        testID: 'setting-up-continue',
      }}
    >
      <SetupArt glyph={glyph} />
      <YStack
        marginTop={ART_TO_CONTENT_GAP}
        marginHorizontal="$2xl"
        accessibilityLabel="Setup steps"
      >
        {/* The rule joins the markers, behind them. It's drawn in SVG like
            the other lines: a 0.5 pt wide view rounds to two pixels. */}
        <Svg
          width={1}
          height={STEP_ROW * (SETUP_STEPS.length - 1)}
          style={{
            position: 'absolute',
            left: MARKER / 2 - LINE / 2,
            top: STEP_ROW / 2,
          }}
        >
          <Rect width={LINE} height="100%" fill={ink} />
        </Svg>
        {SETUP_STEPS.map((step, index) => (
          <SetupStepRow
            key={step.key}
            label={step.label}
            state={
              index < currentIndex
                ? 'done'
                : index === currentIndex
                  ? 'current'
                  : 'pending'
            }
          />
        ))}
      </YStack>
    </LineStepFrame>
  );
}

function SetupStepRow({ label, state }: { label: string; state: StepState }) {
  const { paper } = useLineColors();
  return (
    <XStack
      // Grows with larger system text sizes.
      minHeight={STEP_ROW}
      alignItems="center"
      gap="$l"
      accessible
      accessibilityLabel={`${label}, ${SPOKEN_STATE[state]}`}
    >
      <View
        width={MARKER}
        height={MARKER}
        borderRadius={MARKER / 2}
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
      >
        {state === 'done' ? (
          <View
            width={22}
            height={22}
            borderRadius={11}
            backgroundColor="$primaryText"
            alignItems="center"
            justifyContent="center"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 7L10 17L5 12"
                stroke={paper}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        ) : state === 'current' ? (
          <LoadingSpinner size="small" color="$secondaryText" />
        ) : (
          <View width={12} height={12}>
            <LineOutline radius={6} />
          </View>
        )}
      </View>
      <Text
        flex={1}
        fontSize={16}
        lineHeight={24}
        letterSpacing={-0.032}
        color={state === 'pending' ? '$secondaryText' : '$primaryText'}
      >
        {label}
      </Text>
    </XStack>
  );
}

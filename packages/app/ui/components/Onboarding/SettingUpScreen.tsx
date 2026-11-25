import { NodeBootPhase } from '@tloncorp/shared/domain';
import { LoadingSpinner, Text } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import Svg, { Path } from 'react-native-svg';
import { View, XStack, YStack } from 'tamagui';

import { useOnboardingGlyph } from './line/AvatarGlyphPicker';
import { ART_TO_CONTENT_GAP, LineStepFrame } from './line/LineStepFrame';
import { LineOutline, useLineColors } from './line/lineKit';
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
    label: 'Preparing your Sato’s computer',
    lastPhase: NodeBootPhase.BOOTING,
  },
  {
    key: 'network',
    label: 'Connecting to the network',
    lastPhase: NodeBootPhase.CONNECTING,
  },
  {
    key: 'bot',
    label: 'Setting up your Sato',
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

const STEP_ROW = 24;
const MARKER = 22;

/**
 * The Setting up screen at the end of signup, step 3 of onboarding. The first
 * run shows it too, when someone finishes before their Tlonbot is ready.
 * Continue waits for setup; with no `onContinue`, the screen moves on by
 * itself once it's done.
 */
export function SettingUpScreen({
  body,
  current,
  onContinue,
  step = 3,
}: {
  body: ReactNode;
  current: SetupStepKey | 'done';
  onContinue?: () => void;
  /** Which onboarding step's dot is lit; the first run's wait is the last. */
  step?: number;
}) {
  const glyph = useOnboardingGlyph();
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
        marginTop={ART_TO_CONTENT_GAP + 8}
        marginLeft={56}
        marginRight="$2xl"
        gap={14}
        accessibilityLabel="Setup steps"
      >
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
  const { ink } = useLineColors();
  return (
    <XStack
      // Grows with larger system text sizes.
      minHeight={STEP_ROW}
      alignItems="center"
      gap={12}
      accessible
      accessibilityLabel={`${label}, ${SPOKEN_STATE[state]}`}
    >
      <View
        width={MARKER}
        height={MARKER}
        alignItems="center"
        justifyContent="center"
      >
        {state === 'done' ? (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke={ink}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : state === 'current' ? (
          <LoadingSpinner size="small" color="$primaryText" />
        ) : (
          <View width={12} height={12}>
            <LineOutline radius={6} color="$tertiaryText" />
          </View>
        )}
      </View>
      <Text
        flex={1}
        fontSize={17}
        lineHeight={24}
        letterSpacing={-0.2}
        color={state === 'current' ? '$primaryText' : '$secondaryText'}
      >
        {label}
      </Text>
    </XStack>
  );
}

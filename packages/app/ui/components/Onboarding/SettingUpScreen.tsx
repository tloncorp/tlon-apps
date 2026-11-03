import { NodeBootPhase } from '@tloncorp/shared/domain';
import { Icon, LoadingSpinner, TlonText } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { ArvosDiscussing } from '../ArvosDiscussing';
import { OnboardingStepLayout, STEP_ROW_HEIGHT } from './OnboardingStepLayout';

const ART_HEIGHT = 200;
const ART_GAP = 48;

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

/**
 * The Setting up screen at the end of signup. The first run shows it too,
 * when someone finishes before their Tlonbot is ready.
 */
export function SettingUpScreen({
  body,
  current,
}: {
  body: ReactNode;
  current: SetupStepKey | 'done';
}) {
  const currentIndex =
    current === 'done'
      ? SETUP_STEPS.length
      : SETUP_STEPS.findIndex((step) => step.key === current);
  return (
    <OnboardingStepLayout title="Setting up" body={body}>
      <YStack flex={1}>
        {/* The art takes the spot the permission prompt had on Allow
            notifications, and shrinks on short screens to keep the steps
            above the bottom slot. */}
        <View flex={1} minHeight={0} marginBottom={ART_GAP}>
          {/* Placed absolutely so the art only takes the room that's left and
              never pushes the steps down; with large text it gives way. */}
          <View
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={0}
            alignItems="center"
            justifyContent="center"
          >
            <View width="100%" height="100%" maxHeight={ART_HEIGHT}>
              <ArvosDiscussing width="100%" height="100%" />
            </View>
          </View>
        </View>
        <YStack>
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
        <View height="$l" />
      </YStack>
    </OnboardingStepLayout>
  );
}

// A row per step, its marker on the left margin. Steps not started yet have
// no marker, just a grey label.
function SetupStepRow({ label, state }: { label: string; state: StepState }) {
  return (
    <XStack
      // Grows with larger system text sizes.
      minHeight={STEP_ROW_HEIGHT}
      paddingVertical="$l"
      alignItems="center"
      gap="$xl"
      accessible
      accessibilityLabel={`${label}, ${SPOKEN_STATE[state]}`}
    >
      <View
        width="$3xl"
        height="$3xl"
        alignItems="center"
        justifyContent="center"
      >
        {state === 'done' ? (
          <Icon type="Checkmark" color="$primaryText" />
        ) : state === 'current' ? (
          <LoadingSpinner size="small" color="$secondaryText" />
        ) : null}
      </View>
      <YStack flex={1}>
        <TlonText.Text
          size="$label/xl"
          color={state === 'pending' ? '$secondaryText' : '$primaryText'}
        >
          {label}
        </TlonText.Text>
      </YStack>
    </XStack>
  );
}

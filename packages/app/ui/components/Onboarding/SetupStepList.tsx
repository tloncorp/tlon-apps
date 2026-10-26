import { Icon, LoadingSpinner, TlonText } from '@tloncorp/ui';
import { View, XStack, YStack } from 'tamagui';

import { STEP_ROW_HEIGHT } from './OnboardingStepLayout';

export type SetupStepState = 'done' | 'current' | 'failed' | 'pending';

export type SetupStep = { label: string; state: SetupStepState };

const SPOKEN_STATE: Record<SetupStepState, string> = {
  done: 'done',
  current: 'in progress',
  failed: 'didn’t finish',
  pending: 'not started',
};

/**
 * The setup checklist: a row per step, its marker on the left margin. Steps
 * not started yet have no marker, just a grey label.
 */
export function SetupStepList({
  steps,
  failedLabel = 'Didn’t finish',
}: {
  steps: SetupStep[];
  /** The line under a step that stopped. */
  failedLabel?: string;
}) {
  return (
    <YStack>
      {steps.map((step) => (
        <XStack
          key={step.label}
          // Grows with larger system text sizes.
          minHeight={STEP_ROW_HEIGHT}
          paddingVertical="$l"
          alignItems="center"
          gap="$xl"
          accessible
          accessibilityLabel={`${step.label}, ${SPOKEN_STATE[step.state]}`}
        >
          <View
            width="$3xl"
            height="$3xl"
            alignItems="center"
            justifyContent="center"
          >
            {step.state === 'done' ? (
              <Icon type="Checkmark" color="$primaryText" />
            ) : step.state === 'current' ? (
              <LoadingSpinner size="small" color="$secondaryText" />
            ) : step.state === 'failed' ? (
              <Icon type="Close" color="$negativeActionText" />
            ) : null}
          </View>
          <YStack flex={1} gap="$s">
            <TlonText.Text
              size="$label/xl"
              color={
                step.state === 'pending' ? '$secondaryText' : '$primaryText'
              }
            >
              {step.label}
            </TlonText.Text>
            {step.state === 'failed' ? (
              <TlonText.Text size="$label/m" color="$negativeActionText">
                {failedLabel}
              </TlonText.Text>
            ) : null}
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

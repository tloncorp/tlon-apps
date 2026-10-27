import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Icon,
  LoadingSpinner,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { NodeBootPhase } from '@tloncorp/shared/domain';
import { useEffect } from 'react';

import { AnimatedArvosDiscussing } from '../../components/AnimatedArvosDiscussing';
import {
  OnboardingStepLayout,
  STEP_ROW_HEIGHT,
} from '../../components/OnboardingStepLayout';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

const ART_HEIGHT = 200;
const ART_GAP = 48;

export const ReserveShipScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const isReady = signupContext.bootPhase >= NodeBootPhase.READY;

  // Disable back button once you reach this screen
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
      }),
    [navigation]
  );

  useEffect(() => {
    if (!signupContext.didCompleteOnboarding) {
      signupContext.setOnboardingValues({ didCompleteOnboarding: true });
    }
    signupContext.kickOffBootSequence();
  }, [signupContext]);

  return (
    <OnboardingStepLayout
      title="Setting up"
      body={
        isReady
          ? 'Your Tlon computer is ready. Taking you in now.'
          : "We're getting your Tlon computer ready. You'll go straight in when it's done."
      }
    >
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
              <AnimatedArvosDiscussing />
            </View>
          </View>
        </View>
        <BootStepDisplay bootPhase={signupContext.bootPhase} />
        <View height="$l" />
      </YStack>
    </OnboardingStepLayout>
  );
};

interface DisplayStep {
  description: string;
  startExclusive: NodeBootPhase;
  endInclusive: NodeBootPhase;
}
const DISPLAY_STEPS: DisplayStep[] = [
  {
    description: 'Preparing your Tlon computer',
    startExclusive: NodeBootPhase.IDLE,
    endInclusive: NodeBootPhase.BOOTING,
  },
  {
    description: 'Connecting to the network',
    startExclusive: NodeBootPhase.BOOTING,
    endInclusive: NodeBootPhase.CONNECTING,
  },
  {
    description: 'Setting up your Tlonbot',
    startExclusive: NodeBootPhase.CONNECTING,
    endInclusive: NodeBootPhase.ACCEPTING_INVITES,
  },
];

// Each step is a row the height of the notification options two screens
// back, with its marker on the left margin. Steps not started yet have no
// marker, just a gray label.
function BootStepDisplay(props: { bootPhase: NodeBootPhase }) {
  return (
    <YStack>
      {DISPLAY_STEPS.map((step) => {
        const hasCompleted = props.bootPhase > step.endInclusive;
        const isOnStep =
          props.bootPhase > step.startExclusive &&
          props.bootPhase <= step.endInclusive;
        // At IDLE nothing is in progress yet; show the first step as current.
        const isCurrent =
          isOnStep ||
          (props.bootPhase <= NodeBootPhase.IDLE && step === DISPLAY_STEPS[0]);
        const status = hasCompleted
          ? 'done'
          : isCurrent
            ? 'in progress'
            : 'not started';
        return (
          <XStack
            key={step.description}
            // Grows with larger system text sizes.
            minHeight={STEP_ROW_HEIGHT}
            paddingVertical="$l"
            alignItems="center"
            gap="$xl"
            accessible
            accessibilityLabel={`${step.description}, ${status}`}
          >
            <View
              width="$3xl"
              height="$3xl"
              alignItems="center"
              justifyContent="center"
            >
              {hasCompleted ? (
                <Icon type="Checkmark" color="$primaryText" />
              ) : isCurrent ? (
                <LoadingSpinner size="small" color="$secondaryText" />
              ) : null}
            </View>
            <TlonText.Text
              flex={1}
              size="$label/xl"
              color={
                hasCompleted || isCurrent ? '$primaryText' : '$secondaryText'
              }
            >
              {step.description}
            </TlonText.Text>
          </XStack>
        );
      })}
    </YStack>
  );
}

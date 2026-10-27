import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArvosDiscussing,
  OnboardingStepLayout,
  type SetupStep,
  SetupStepList,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { NodeBootPhase } from '@tloncorp/shared/domain';
import { useEffect } from 'react';

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
              <ArvosDiscussing width="100%" height="100%" />
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

// Steps finish in order as the boot phase moves through their ranges. At
// IDLE nothing is in progress yet, so the first step shows as current.
function BootStepDisplay(props: { bootPhase: NodeBootPhase }) {
  const steps: SetupStep[] = DISPLAY_STEPS.map((step) => {
    const hasCompleted = props.bootPhase > step.endInclusive;
    const isOnStep =
      props.bootPhase > step.startExclusive &&
      props.bootPhase <= step.endInclusive;
    const isCurrent =
      isOnStep ||
      (props.bootPhase <= NodeBootPhase.IDLE && step === DISPLAY_STEPS[0]);
    return {
      label: step.description,
      state: hasCompleted ? 'done' : isCurrent ? 'current' : 'pending',
    };
  });
  return <SetupStepList steps={steps} />;
}

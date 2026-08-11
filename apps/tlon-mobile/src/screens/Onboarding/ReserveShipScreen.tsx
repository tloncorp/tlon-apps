import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArvosDiscussing,
  IconType,
  ListItem,
  LoadingSpinner,
  OnboardingTextBlock,
  ScreenHeader,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { NodeBootPhase } from '@tloncorp/shared/domain';
import { useEffect } from 'react';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();

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
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        title={
          signupContext.bootPhase < NodeBootPhase.READY
            ? "We're setting you up"
            : 'Setup complete!'
        }
      />
      <OnboardingTextBlock marginTop="$5xl" gap="$5xl">
        <ArvosDiscussing width="100%" height={200} />
        <BootStepDisplay
          bootPhase={signupContext.bootPhase}
          withKit={Boolean(lureMeta?.kit && !lureMeta?.invitedGroupId)}
        />
      </OnboardingTextBlock>
    </View>
  );
};

interface DisplayStep {
  description: string;
  icon: IconType;
  startExclusive: NodeBootPhase;
  endInclusive: NodeBootPhase;
}
const DISPLAY_STEPS: DisplayStep[] = [
  {
    description: 'Preparing your Tlon computer',
    icon: 'Gift',
    startExclusive: NodeBootPhase.IDLE,
    endInclusive: NodeBootPhase.BOOTING,
  },
  {
    description: 'Connecting to the network',
    icon: 'Link',
    startExclusive: NodeBootPhase.BOOTING,
    endInclusive: NodeBootPhase.CONNECTING,
  },
  {
    description: 'Setting up your Tlonbot',
    icon: 'Face',
    startExclusive: NodeBootPhase.CONNECTING,
    endInclusive: NodeBootPhase.ACCEPTING_INVITES,
  },
];

// Shown only when the signup rode a kit-bearing personal invite link.
const KIT_DISPLAY_STEP: DisplayStep = {
  description: 'Installing your kit',
  icon: 'SmushStar',
  startExclusive: NodeBootPhase.ACCEPTING_INVITES,
  endInclusive: NodeBootPhase.INSTALLING_KIT,
};

function BootStepDisplay(props: {
  bootPhase: NodeBootPhase;
  withKit: boolean;
}) {
  const steps = props.withKit
    ? [...DISPLAY_STEPS, KIT_DISPLAY_STEP]
    : DISPLAY_STEPS;
  return (
    <YStack width="100%">
      {steps.map((step, index) => {
        const isOnStep =
          props.bootPhase > step.startExclusive &&
          props.bootPhase <= step.endInclusive;
        const hasCompleted = props.bootPhase > step.endInclusive;
        return (
          <ListItem backgroundColor="unset" key={index}>
            <ListItem.SystemIcon color="$primaryText" icon={step.icon} />
            <ListItem.MainContent>
              <ListItem.Title>{step.description}</ListItem.Title>
            </ListItem.MainContent>
            <ListItem.EndContent width="$3xl" alignItems="center">
              {isOnStep && <LoadingSpinner size="small" />}
              {hasCompleted && <ListItem.SystemIcon icon="Checkmark" />}
            </ListItem.EndContent>
          </ListItem>
        );
      })}
    </YStack>
  );
}

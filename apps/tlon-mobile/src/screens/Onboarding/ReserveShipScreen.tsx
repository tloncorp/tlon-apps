import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import { NodeBootPhase } from '@tloncorp/app/lib/bootHelpers';
import {
  ArvosDiscussing,
  IconType,
  ListItem,
  LoadingSpinner,
  OnboardingTextBlock,
  ScreenHeader,
  View,
  YStack,
} from '@tloncorp/ui';
import { useLureMetadata } from 'packages/app/contexts/branch';
import { useEffect, useMemo } from 'react';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const lureMeta = useLureMetadata();

  // Disable back button once you reach this screen
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
      }),
    [navigation]
  );

  useEffect(() => {
    if (!signupContext.didCompleteSignup) {
      signupContext.setDidCompleteSignup(true);
    }
  }, [signupContext]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title={
          signupContext.bootPhase < NodeBootPhase.READY
            ? "We're setting you up"
            : 'Setup complete!'
        }
        showSessionStatus={false}
      />
      <OnboardingTextBlock marginTop="$5xl" gap="$5xl">
        <ArvosDiscussing width="100%" height={200} />
        <BootStepDisplay
          bootPhase={signupContext.bootPhase}
          withInvites={Boolean(lureMeta)}
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
function BootStepDisplay(props: {
  bootPhase: NodeBootPhase;
  withInvites: boolean;
}) {
  const displaySteps = useMemo(() => {
    const steps: DisplayStep[] = [
      {
        description: 'Unboxing your new peer',
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
    ];

    if (props.withInvites) {
      steps.push({
        description: 'Finding peers on the network',
        icon: 'ChannelGalleries',
        startExclusive: NodeBootPhase.CONNECTING,
        endInclusive: NodeBootPhase.ACCEPTING_INVITES,
      });
    }

    return steps;
  }, [props.withInvites]);

  return (
    <YStack width="100%">
      {displaySteps.map((step, index) => {
        const isOnStep =
          props.bootPhase > step.startExclusive &&
          props.bootPhase <= step.endInclusive;
        const hasCompleted = props.bootPhase > step.endInclusive;
        return (
          <ListItem backgroundColor="unset" key={index} paddingVertical={0}>
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

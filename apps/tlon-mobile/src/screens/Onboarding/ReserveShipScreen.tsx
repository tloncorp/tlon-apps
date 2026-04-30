import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import {
  ArvosDiscussing,
  IconType,
  ListItem,
  LoadingSpinner,
  SplashParagraph,
  SplashTitle,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { NodeBootPhase } from '@tloncorp/shared/domain';
import { Text } from '@tloncorp/ui';
import { useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const signupContext = useSignupContext();
  const lureMeta = useLureMetadata();

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

  const isReady = signupContext.bootPhase >= NodeBootPhase.READY;

  return (
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <SplashTitle>
          {isReady ? (
            <>
              Setup is <Text color="$positiveActionText">complete.</Text>
            </>
          ) : (
            <>
              Setting <Text color="$positiveActionText">things up.</Text>
            </>
          )}
        </SplashTitle>
        <SplashParagraph marginBottom={0}>
          Your peer-to-peer node is being prepared. This usually takes just a
          moment.
        </SplashParagraph>
        <YStack alignItems="center" paddingTop="$xl">
          <ArvosDiscussing width="100%" height={200} />
        </YStack>
        <View paddingHorizontal="$xl">
          <BootStepDisplay
            bootPhase={signupContext.bootPhase}
            withInvites={Boolean(lureMeta)}
          />
        </View>
      </YStack>
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

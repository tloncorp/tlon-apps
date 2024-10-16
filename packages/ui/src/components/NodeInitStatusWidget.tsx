import { NodeBootPhase } from '@tloncorp/shared/dist/logic';
import { useMemo } from 'react';
import { YStack } from 'tamagui';

import { RadioControl } from './Form';
import { ListItem } from './ListItem';
import { LoadingSpinner } from './LoadingSpinner';

interface WidgetStep {
  title: string;
  startExclusive: number;
  stopInclusive: number;
}

export function NodeInitStatusWidget(props: {
  bootPhase: NodeBootPhase;
  hasInvite: boolean;
}) {
  const displaySteps = useMemo(
    () => getDisplaySteps(props.bootPhase, props.hasInvite),
    [props.bootPhase, props.hasInvite]
  );

  return (
    <YStack>
      {displaySteps.map((step, index) => {
        const isLoading =
          props.bootPhase > step.startExclusive &&
          props.bootPhase <= step.stopInclusive;
        const isComplete = props.bootPhase > step.stopInclusive;

        return (
          <ListItem key={index}>
            <ListItem.MainContent>{step.title}</ListItem.MainContent>
            <ListItem.EndContent>
              {isLoading && <LoadingSpinner size="small" />}
              {isComplete && <RadioControl checked />}
            </ListItem.EndContent>
          </ListItem>
        );
      })}
    </YStack>
  );
}

function getDisplaySteps(bootPhase: NodeBootPhase, hasInvite: boolean) {
  const steps: WidgetStep[] = [
    {
      title: 'Booting your node',
      startExclusive: NodeBootPhase.IDLE,
      stopInclusive: NodeBootPhase.BOOTING,
    },
    {
      title: 'Establishing a connection',
      startExclusive: NodeBootPhase.BOOTING,
      stopInclusive: NodeBootPhase.CONNECTING,
    },
  ];

  if (hasInvite) {
    steps.push({
      title: 'Contacting initial peers',
      startExclusive: NodeBootPhase.CONNECTING,
      stopInclusive: NodeBootPhase.ACCEPTING_INVITES,
    });
  }

  return steps;
}

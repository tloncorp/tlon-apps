// tamagui-ignore
import { ConnectionState } from '@tloncorp/shared/api';

import { Text, YStack } from '../ui';
import {
  ConnectionStatusComponent,
  getStatusLabels,
} from '../ui/components/ConnectionStatus';
import { FixtureWrapper } from './FixtureWrapper';

// All possible connection states
const allConnectionStates: ConnectionState[] = [
  // Successful states
  'yes',

  // Failed states (always complete)
  'crash',
  'no-data',
  'no-dns',

  // Disconnected states (always complete)
  'no-our-planet',
  'no-our-galaxy',
  'no-sponsor-hit',
  'no-sponsor-miss',
  'no-their-galaxy',

  // In-progress states (incomplete)
  'setting-up',
  'trying-dns',
  'trying-local',
  'trying-target',
  'trying-sponsor',
];

// Generate connection states with complete/incomplete variants using getStatusLabels
const generateConnectionStates = () => {
  return allConnectionStates.map((state) => {
    const isInProgress = [
      'setting-up',
      'trying-dns',
      'trying-local',
      'trying-target',
      'trying-sponsor',
    ].includes(state);

    return {
      status: state,
      complete: !isInProgress,
    };
  });
};

const connectionStates = generateConnectionStates();

export default {
  'Connection Status': (
    <FixtureWrapper fillWidth backgroundColor="$background">
      <YStack gap="$2xl">
        <Text fontSize="$xl">Success States</Text>
        <YStack gap="$m">
          {connectionStates
            .filter((status) => status.status === 'yes')
            .map((mockStatus, index) => {
              return (
                <ConnectionStatusComponent
                  key={`success-${index}`}
                  contactId={`~zod`}
                  mockStatus={mockStatus}
                  onPress={() => console.log('Pressed:', mockStatus.status)}
                />
              );
            })}
        </YStack>
        <Text fontSize="$xl">Connecting States</Text>
        <YStack gap="$m">
          {connectionStates
            .filter((status) =>
              [
                'setting-up',
                'trying-dns',
                'trying-local',
                'trying-target',
                'trying-sponsor',
              ].includes(status.status)
            )
            .map((mockStatus, index) => {
              return (
                <ConnectionStatusComponent
                  key={`progress-${index}`}
                  contactId={`~zod`}
                  mockStatus={mockStatus}
                  autoCheck={true}
                  onPress={() => console.log('Pressed:', mockStatus.status)}
                />
              );
            })}
        </YStack>
        <Text fontSize="$xl">Failed States (ship-side)</Text>
        <YStack gap="$m">
          {connectionStates
            .filter((status) =>
              ['crash', 'no-data', 'no-dns'].includes(status.status)
            )
            .map((mockStatus, index) => {
              return (
                <ConnectionStatusComponent
                  key={`failed-${index}`}
                  contactId={`~zod`}
                  mockStatus={mockStatus}
                  onPress={() => console.log('Pressed:', mockStatus.status)}
                />
              );
            })}
        </YStack>
        <Text fontSize="$xl">Disconnected States (network-side)</Text>
        <YStack gap="$m">
          {connectionStates
            .filter((status) =>
              [
                'no-our-planet',
                'no-our-galaxy',
                'no-sponsor-hit',
                'no-sponsor-miss',
                'no-their-galaxy',
              ].includes(status.status)
            )
            .map((mockStatus, index) => {
              return (
                <ConnectionStatusComponent
                  key={`disconnected-${index}`}
                  contactId={`~zod`}
                  mockStatus={mockStatus}
                  onPress={() => console.log('Pressed:', mockStatus.status)}
                />
              );
            })}
        </YStack>
      </YStack>
    </FixtureWrapper>
  ),
};

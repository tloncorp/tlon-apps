import { Text } from '@tloncorp/ui';

import { BucketsLiveChannel } from '../features/buckets/BucketsLiveChannel';
import {
  DEFAULT_SHIP_LOGIN_ACCESS_CODE,
  DEFAULT_SHIP_LOGIN_URL,
} from '../lib/envVars';
import { YStack } from '../ui';
import { FixtureUrbitClient, FixtureWrapper } from './FixtureWrapper';

function shipFromUrl(shipUrl: string) {
  try {
    return `~${new URL(shipUrl).hostname.split('.')[0]}`;
  } catch {
    return '';
  }
}

const shipName = shipFromUrl(DEFAULT_SHIP_LOGIN_URL);
const urbitClient: FixtureUrbitClient | undefined =
  shipName && DEFAULT_SHIP_LOGIN_URL && DEFAULT_SHIP_LOGIN_ACCESS_CODE
    ? {
        accessCode: DEFAULT_SHIP_LOGIN_ACCESS_CODE,
        shipName,
        shipUrl: DEFAULT_SHIP_LOGIN_URL,
      }
    : undefined;

function LiveHostedBucket() {
  if (!urbitClient) {
    return (
      <FixtureWrapper fillHeight fillWidth>
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          padding="$2xl"
        >
          <Text color="$primaryText" size="$label/l" textAlign="center">
            Start Cosmos with the hosted ship login environment variables to use
            this fixture.
          </Text>
        </YStack>
      </FixtureWrapper>
    );
  }

  return (
    <FixtureWrapper
      fillHeight
      fillWidth
      currentUserId={shipName}
      urbitClient={urbitClient}
    >
      <BucketsLiveChannel
        flag={{ host: shipName, name: 'live-canary' }}
        viewport="responsive"
      />
    </FixtureWrapper>
  );
}

export default {
  'Live hosted ship': <LiveHostedBucket />,
};

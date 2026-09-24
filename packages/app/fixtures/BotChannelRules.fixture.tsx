import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TlawnChannelGroups } from '@tloncorp/api';
import { queryClient } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';
import { View, useWindowDimensions } from 'react-native';

import { BotChannelRuleSettingsScreen } from '../features/settings/BotChannelRuleSettingsScreen';
import { BotChannelRulesScreen } from '../features/settings/BotChannelRulesScreen';
import {
  normalizeProviderConfig,
  normalizeTlonbotConfig,
} from '../features/settings/bot/helpers';
import { mcpProviderQueryKeys } from '../lib/mcpProviders';
import { RootStackParamList } from '../navigation/types';
import { FixtureWrapper } from './FixtureWrapper';

const SHIP = 'zod';
const USER = '~zod';
const MOON = '~doznec-dozzod-zod';

// Channels the user's ship can see: the bot is in Lounge, was kicked from
// Garden, and was never added to Studio.
const userChannels: TlawnChannelGroups = {
  [USER]: {
    lounge: {
      title: 'Lounge',
      channels: { general: 'General', random: 'Random' },
    },
    garden: { title: 'Garden', channels: { plots: 'Plots', seeds: 'Seeds' } },
    studio: { title: 'Studio', channels: { sketches: 'Sketches' } },
  },
};

// The moon's listing as cached before the kick: it still includes Garden.
const moonChannels: TlawnChannelGroups = {
  [USER]: {
    lounge: userChannels[USER].lounge,
    garden: userChannels[USER].garden,
  },
};

const config = normalizeTlonbotConfig({
  defaultAuthorizedShips: [USER],
  channelRules: {
    'chat/~zod/general': { mode: 'open', allowedShips: [] },
    'chat/~zod/plots': { mode: 'allowlist', allowedShips: [USER] },
    'chat/~zod/seeds': { mode: 'open', allowedShips: [] },
  },
});

function seedBotQueries() {
  queryClient.setQueryData(['tlonbot', 'ready', SHIP], true);
  queryClient.setQueryData(
    ['tlonbot', 'provider-config', ''],
    normalizeProviderConfig({})
  );
  queryClient.setQueryData(['tlonbot', 'settings', SHIP], config);
  queryClient.setQueryData(['tlonbot', 'nickname', SHIP], 'Tlonbot');
  queryClient.setQueryData(['tlonbot', 'channels', SHIP], userChannels);
  queryClient.setQueryData(['tlonbot', 'moon', SHIP], MOON);
  queryClient.setQueryData(
    ['tlonbot', 'moon-channels', SHIP, MOON],
    moonChannels
  );
  queryClient.setQueryData(mcpProviderQueryKeys.status(SHIP), {
    available: false,
    grants: [],
  });
  queryClient.setQueryData(mcpProviderQueryKeys.providers, []);
  queryClient.setQueryData(['tlonbot', 'llm-auth-status', SHIP], {
    ts: 0,
    providers: [],
  });
}

async function seedRoster(kicked: boolean) {
  await db.addChatMembers({
    chatId: '~zod/lounge',
    contactIds: [USER, MOON],
    type: 'group',
    joinStatus: 'joined',
  });
  await db.addChatMembers({
    chatId: '~zod/garden',
    contactIds: [USER],
    type: 'group',
    joinStatus: 'joined',
  });
  await db.addChatMembers({
    chatId: '~zod/studio',
    contactIds: [USER],
    type: 'group',
    joinStatus: 'joined',
  });
  if (kicked) {
    await db.removeChatMembers({ chatId: '~zod/garden', contactIds: [MOON] });
  } else {
    await db.addChatMembers({
      chatId: '~zod/garden',
      contactIds: [MOON],
      type: 'group',
      joinStatus: 'joined',
    });
  }
}

function SeededBot({
  kicked,
  children,
}: PropsWithChildren<{ kicked: boolean }>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const previousCurrentUserId = window.our;
    window.our = USER;
    seedBotQueries();
    seedRoster(kicked).then(() => setReady(true));
    return () => {
      window.our = previousCurrentUserId;
    };
  }, [kicked]);

  return ready ? <>{children}</> : null;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

function BotChannelRulesFixture() {
  const [scenario] = useFixtureSelect('bot membership', {
    options: ['kicked from Garden', 'member of Garden'],
  });
  // The web renderer gives the document no height, so size the navigator to
  // the window or its screens collapse to their headers.
  const { height } = useWindowDimensions();

  return (
    <FixtureWrapper fillWidth fillHeight>
      <SeededBot kicked={scenario === 'kicked from Garden'}>
        <View style={{ height }}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="BotChannelRulesSettings"
              component={BotChannelRulesScreen}
            />
            <Stack.Screen
              name="BotChannelRuleSettings"
              component={BotChannelRuleSettingsScreen}
            />
          </Stack.Navigator>
        </View>
      </SeededBot>
    </FixtureWrapper>
  );
}

export default {
  'Channel rules': <BotChannelRulesFixture />,
};

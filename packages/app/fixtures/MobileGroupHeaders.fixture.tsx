import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  getInitializedClient,
  getSession,
  setSession,
  updateInitializedClient,
  updateSession,
} from '@tloncorp/shared';
import { useEffect, useState } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';
import { Platform } from 'react-native';

import { nativeHeaderPresentationOptions } from '../navigation/nativeHeaderOptions';
import { Button, ChannelHeader, PostScreenView, Text, View } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group, tlonLocalGettingStarted } from './fakeData';

const Stack = createNativeStackNavigator();
const longGroup = {
  ...group,
  title: "~firtul-navsun's Group with a very long name",
  iconImage: null,
};
const channel = {
  ...tlonLocalGettingStarted,
  type: 'chat' as const,
  title: 'Chat',
  group: undefined,
  groupId: longGroup.id,
};
const singleChannelGroup = { ...longGroup, channels: [channel] };

function HeaderScreen() {
  useEffect(() => {
    const previousSession = getSession();
    const previouslyInitialized = getInitializedClient();
    updateSession({ channelStatus: 'active', isSyncing: false });
    updateInitializedClient(true);
    return () => {
      if (previousSession) {
        setSession(previousSession);
      } else {
        updateSession(null);
      }
      updateInitializedClient(previouslyInitialized);
    };
  }, []);
  const [scenario] = useFixtureSelect('Scenario', {
    options: ['Long group', 'Short group', 'Group thread', 'Loading'],
  });
  const [pressed, setPressed] = useState('');
  const model =
    scenario === 'Short group'
      ? { ...singleChannelGroup, title: 'Friends' }
      : singleChannelGroup;

  if (scenario === 'Group thread') {
    return (
      <PostScreenView
        channel={channel}
        group={model}
        parentPost={null}
        handleGoToUserProfile={() => {}}
        onPressRetry={async () => {}}
        onPressDelete={() => {}}
        negotiationMatch
        onGroupAction={() => {}}
        goToDm={() => {}}
        goBack={() => setPressed('Back')}
      />
    );
  }

  return (
    <View flex={1} backgroundColor="$background">
      <ChannelHeader
        title={model.title ?? ''}
        description=""
        channel={channel}
        group={model}
        goBack={() => setPressed('Back')}
        goToSearch={() => setPressed('Search')}
        goToChatDetails={() => setPressed(model.title ?? '')}
        onToggleContextLens={() => setPressed('Details')}
        showSearchButton
        showSpinner={scenario === 'Loading'}
        loadingSubtitle={scenario === 'Loading' ? 'Loading messages…' : null}
      />
      <View flex={1} alignItems="center" justifyContent="center" gap="$l">
        <Text>{pressed || 'Tap the header title or either action.'}</Text>
        <Button label="Clear result" onPress={() => setPressed('')} />
      </View>
    </View>
  );
}

export default function MobileGroupHeadersFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <Stack.Navigator
        screenOptions={{
          ...nativeHeaderPresentationOptions,
          headerShown: Platform.OS !== 'web',
        }}
      >
        <Stack.Screen name="Header regression" component={HeaderScreen} />
      </Stack.Navigator>
    </FixtureWrapper>
  );
}

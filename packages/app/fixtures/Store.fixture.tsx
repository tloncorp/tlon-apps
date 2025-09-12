import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { MockedFunction } from '@tloncorp/shared/utils';
import { useEffect, useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';

import { FixtureWrapper } from './FixtureWrapper';
import * as fakeApiJson from './__data__';
import { useMockScry } from './__mocks__/mockUtils';
import * as fakeData from './fakeData';

export default function StoreFixture() {
  return (
    <FixtureWrapper safeArea fillWidth fillHeight>
      <ScrollView>
        <ControlledSync />
      </ScrollView>
    </FixtureWrapper>
  );
}

function ReadWriteDatabase() {
  const allChannels = store.useAllChannels({ enabled: true }).data;
  return (
    <>
      <Text>All channels in database</Text>
      <Text>{JSON.stringify(allChannels, null, 2)}</Text>
      <Button
        title="Insert test group"
        onPress={() => {
          db.insertGroups({ groups: [fakeData.group] });
        }}
      />
    </>
  );
}

function AttemptApiAccess() {
  const [currentUserId] = useState(() => api.getCurrentUserId());

  const [groupsFromApi, setGroupsFromApi] = useState<any>(null);
  useEffect(() => {
    (async () => {
      api.scry.mock.enabled = true;
      api.scry.mock.implementation(async ({ app, path }) => {
        console.log('scry', app, path);
        return fakeApiJson.groups as any;
      });

      setGroupsFromApi(await api.getGroups());
    })().catch((err) => {
      console.error('Failed to fetch groups from API', err);
    });
    return () => {
      api.scry.mock.reset();
    };
  }, []);

  useEffect(() => {
    console.log('groupsFromApi changed', groupsFromApi);
  }, [groupsFromApi]);

  return (
    <View style={{ flex: 1 }}>
      <Text>All groups for {currentUserId}</Text>
      <Button
        title="Read from API (console)"
        onPress={async () => {
          try {
            console.log('Fetching...');
            console.log(await api.getGroups());
          } catch (err) {
            console.error('Failed', err);
          }
        }}
      />
      <Text>{JSON.stringify(groupsFromApi, null, 2)}</Text>
    </View>
  );
}

MockedFunction.cast(api.subscribe).mock.enabled = true;

function ControlledSync() {
  // fine to use any store methods
  const groupsQuery = store.useGroups({});

  useMockScry('groups-ui', '/v4/init', async () => fakeApiJson.init);

  return (
    <View style={{ flex: 1 }}>
      <Button
        title="Sync"
        onPress={() => {
          console.log('Syncing...');
          store.syncStart().catch((err) => {
            console.error('Failed to start sync', err);
          });
        }}
      />
      <Button
        title="Manually fetch groups from DB"
        onPress={async () => {
          console.log(await db.getGroups({}));
        }}
      />
      <Text>Sync results</Text>
      <Text>Group count: {groupsQuery.data?.length}</Text>
    </View>
  );
}

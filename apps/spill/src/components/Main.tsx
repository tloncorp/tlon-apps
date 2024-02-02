import React, {PropsWithChildren, useEffect} from 'react';
import {UpdateMode} from 'realm';
import * as api from '@api';
import * as db from '@db';
import {createLogger} from '@utils/debug';
import useIsLoggedIn from '@utils/state';
import {useSync} from '@utils/sync';
import {Routes} from './Routes';
import {Stack} from '@ochre';
import {ObjectDetailView} from './ObjectDetailView';
import {ShipLoginScreen} from './screens/ShipLoginScreen';

const logger = createLogger('Main');

export function Main() {
  const isLoggedIn = useIsLoggedIn();
  const realm = db.useRealm();
  logger.log('realm initialized at', realm.path);
  const {sync} = useSync();

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    const channelEventEmitter = api.createChannelSubscription();
    channelEventEmitter.on('post', post => {
      realm.write(() => {
        db.create(realm, 'Post', post, UpdateMode.Modified);
      });
    });
    channelEventEmitter.on('posts', posts => {
      realm.write(() => {
        posts.forEach(post => {
          db.create(realm, 'Post', post, UpdateMode.Modified);
        });
      });
    });
    sync();
  }, [isLoggedIn, realm, sync]);

  return (
    <Stack flex={1} backgroundColor={'$background'}>
      <AuthCheck>
        <Routes />
        <ObjectDetailView />
      </AuthCheck>
    </Stack>
  );
}
export function AuthCheck({children}: PropsWithChildren) {
  const isLoggedIn = useIsLoggedIn();
  if (isLoggedIn == null) {
    return children;
  }
  return isLoggedIn ? children : <ShipLoginScreen />;
}

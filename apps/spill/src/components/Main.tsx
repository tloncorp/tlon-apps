import * as api from '@api';
import * as db from '@db';
import {Stack} from '@ochre';
import {createLogger} from '@utils/debug';
import React, {PropsWithChildren, useEffect} from 'react';
import {useSync} from '../utils/sync';
import {ObjectDetailView} from './ObjectDetailView';
import {Routes} from './Routes';
import {ShipLoginScreen} from './screens/ShipLoginScreen';

const logger = createLogger('Main');

export function Main() {
  const realm = db.useRealm();
  const ops = db.useOps();
  const authState = api.useAuthState();
  const {sync} = useSync();

  useEffect(() => {
    // Log realm path so that we can find for browsing with realm studio
    logger.log('realm initialized at', realm.path);
    // Initial attempt to authenticate with stored account
    const account = ops.getAccount();
    api.authenticateWithAccount(account);
    // Only want this to log once on initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'logged-in') {
      return;
    }
    const channelEventEmitter = api.createChannelSubscription();
    channelEventEmitter.on('post', post => {
      ops.createOrUpdatePost(post);
    });
    channelEventEmitter.on('posts', posts => {
      ops.createOrUpdatePosts(posts);
    });
    sync();
  }, [ops, sync, authState]);

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
  const authState = api.useAuthState();
  if (
    authState === 'initial' ||
    authState === 'verifying-cookie' ||
    authState === 'logged-in'
  ) {
    return children;
  }
  return <ShipLoginScreen />;
}

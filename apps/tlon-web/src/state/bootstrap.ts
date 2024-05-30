import { onlyChats, stripPrefixes } from '@tloncorp/shared/dist/urbit/activity';
import { GroupsInit } from '@tloncorp/shared/dist/urbit/ui';
import Urbit from '@urbit/http-api';
import _ from 'lodash';

import api from '@/api';
import { useChatStore } from '@/chat/useChatStore';
import { asyncWithDefault } from '@/logic/utils';
import queryClient from '@/queryClient';

import { unreadsKey } from './activity';
import { initializeChat } from './chat';
import useContactState from './contact';
import useDocketState from './docket';
import useKilnState from './kiln';
import { useLocalState } from './local';
import { useLureState } from './lure/lure';
import usePalsState from './pals';
import { pinsKey } from './pins';
import useSchedulerStore from './scheduler';
import { useStorage } from './storage';
import { useUnreadsStore } from './unreads';

const emptyGroupsInit: GroupsInit = {
  groups: {},
  gangs: {},
  channels: {},
  activity: {},
  pins: [],
  chat: {
    dms: [],
    clubs: {},
    invited: [],
  },
};

async function startGroups() {
  // make sure if this errors we don't kill the entire app
  const { channels, groups, gangs, pins, chat, activity } =
    await asyncWithDefault(
      () =>
        api.scry<GroupsInit>({
          app: 'groups-ui',
          path: '/v2/init',
        }),
      emptyGroupsInit
    );

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);
  queryClient.setQueryData(['channels'], channels);
  queryClient.setQueryData(pinsKey(), pins);
  initializeChat(chat);

  useUnreadsStore.getState().update(activity);
  // strip channel/ship/club from start
  const unreads = stripPrefixes(activity);
  queryClient.setQueryData(unreadsKey, unreads);
  // make sure we remove the app part from the nest before handing it over
  useChatStore.getState().update(
    _.mapKeys(
      onlyChats(unreads),
      // strip kind from start
      (v, k) => k.replace(/\w*\//, '')
    )
  );
  console.log(unreads, useChatStore.getState().chats);
}

type Bootstrap = 'initial' | 'reset' | 'full-reset';

function auxiliaryData() {
  const { wait } = useSchedulerStore.getState();
  wait(() => {
    useContactState.getState().start();
    useStorage.getState().initialize(api as unknown as Urbit);
  }, 4);

  wait(() => {
    useKilnState.getState().initializeKiln();
    const { start, fetchCharges } = useDocketState.getState();
    fetchCharges();
    start();
    useLureState.getState().start();

    if (!import.meta.env.DEV) {
      usePalsState.getState().initializePals();
    }
  }, 5);

  api.poke({
    app: 'groups-ui',
    mark: 'ui-vita',
    json: null,
  });
}

let auxiliaryTimer = 0;
export default async function bootstrap(reset = 'initial' as Bootstrap) {
  if (reset === 'full-reset') {
    api.reset();
  }

  startGroups();

  if (reset === 'initial') {
    auxiliaryData();
  } else {
    clearTimeout(auxiliaryTimer);
    auxiliaryTimer = setTimeout(
      () => auxiliaryData(),
      30 * 1000
    ) as unknown as number;
  }
}

useLocalState.setState({
  onReconnect: () => {
    const { reset } = useSchedulerStore.getState();
    reset();
    bootstrap('reset');

    useLocalState.setState({
      lastReconnect: Date.now(),
      subscription: 'connected',
    });
  },
});

import _ from 'lodash';
import Urbit from '@urbit/http-api';
import api from '@/api';
import { asyncWithDefault } from '@/logic/utils';
import queryClient from '@/queryClient';
import { GroupsInit } from '@/types/ui';
import { useChatStore } from '@/chat/useChatStore';
import { useLocalState } from './local';
import { useLureState } from './lure/lure';
import { useStorage } from './storage';
import useContactState from './contact';
import useDocketState from './docket';
import useKilnState from './kiln';
import usePalsState from './pals';
import useSchedulerStore from './scheduler';
import { initializeChat } from './chat';
import { pinsKey } from './pins';
import { ChannnelKeys } from './channel/keys';

const emptyGroupsInit: GroupsInit = {
  groups: {},
  gangs: {},
  channels: {},
  unreads: {},
  dms: [],
  clubs: {},
  dmUnreads: {},
  invited: [],
  pins: [],
};

async function startGroups() {
  // make sure if this errors we don't kill the entire app
  const { channels, unreads, groups, gangs, pins, ...chatData } =
    await asyncWithDefault(
      () =>
        api.scry<GroupsInit>({
          app: 'groups-ui',
          path: '/init',
        }),
      emptyGroupsInit
    );

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);
  queryClient.setQueryData(['channels'], channels);
  queryClient.setQueryData(['unreads'], unreads);
  queryClient.setQueryData(pinsKey(), pins);
  initializeChat(chatData);

  // if we have unreads for cached channels, refetch them
  // in advance
  Object.keys(unreads || {}).forEach((nest) => {
    const unread = unreads[nest];
    const queryKey = ChannnelKeys.infinitePostsKey(nest);
    if (unread.count > 0 && queryClient.getQueryData(queryKey)) {
      queryClient.refetchQueries(queryKey);
    }
  });

  // make sure we remove the app part from the nest before handing it over
  useChatStore
    .getState()
    .update(_.mapKeys(unreads, (v, k) => k.replace(/\w*\//, '')));
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

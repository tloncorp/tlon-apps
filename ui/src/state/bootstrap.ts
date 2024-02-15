import _ from 'lodash';
import Urbit from '@urbit/http-api';
import api from '@/api';
import {
  asyncWithDefault,
  asyncWithFallback,
  isTalk,
  nestToFlag,
} from '@/logic/utils';
import queryClient from '@/queryClient';
import { Gangs, Groups } from '@/types/groups';
import { TalkInit, GroupsInit } from '@/types/ui';
import { useChatStore } from '@/chat/useChatStore';
import useContactState from './contact';
import useDocketState from './docket';
import useKilnState from './kiln';
import { useLocalState } from './local';
import { useLureState } from './lure/lure';
import usePalsState from './pals';
import useSchedulerStore from './scheduler';
import { useStorage } from './storage';
import { initializeChat } from './chat';
import { pinsKey } from './pins';
import { ChannnelKeys } from './channel/keys';

const emptyGroupsInit: GroupsInit = {
  groups: {},
  gangs: {},
  channels: {},
  unreads: {},
  pins: [],
};

async function chatScry<T>(path: string, def: T) {
  return asyncWithDefault(
    () =>
      api.scry<T>({
        app: 'chat',
        path,
      }),
    def
  );
}

async function startGroups() {
  // make sure if this errors we don't kill the entire app
  const { channels, unreads, groups, gangs, pins } = await asyncWithDefault(
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
  useChatStore.getState().update(
    _.mapKeys(
      _.pickBy(unreads, (v, k) => k.startsWith('chat')),
      (v, k) => k.replace(/\w*\//, '')
    )
  );
}

async function startTalk() {
  // since talk is a separate desk we need to offer a fallback
  const { groups, gangs, ...chatData } = await asyncWithFallback(
    () =>
      api.scry<TalkInit>({
        app: 'talk-ui',
        path: '/init',
      }),
    async () => {
      const [groupsRes, gangsRes, dms, clubs, invited, unreads] =
        await Promise.all([
          asyncWithDefault(
            () =>
              api.scry<Groups>({
                app: 'groups',
                path: '/groups/light/v1',
              }),
            {}
          ),
          asyncWithDefault(
            () =>
              api.scry<Gangs>({
                app: 'groups',
                path: '/gangs',
              }),
            {}
          ),
          chatScry('/dm', []),
          chatScry('/clubs', {}),
          chatScry('/dm/invited', []),
          chatScry('/unreads', {}),
        ]);
      return {
        groups: groupsRes,
        gangs: gangsRes,
        dms,
        clubs,
        invited,
        unreads,
      };
    }
  );

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);
  initializeChat(chatData);
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
    app: isTalk ? 'talk-ui' : 'groups-ui',
    mark: 'ui-vita',
    json: null,
  });
}

let auxiliaryTimer = 0;
export default async function bootstrap(
  reset = 'initial' as Bootstrap,
  sendVita = true
) {
  const { wait } = useSchedulerStore.getState();

  if (reset === 'full-reset') {
    api.reset();
  }

  if (isTalk) {
    startTalk();
    wait(() => startGroups(), 5);
  } else {
    startGroups();
    wait(async () => startTalk(), 5);
  }

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

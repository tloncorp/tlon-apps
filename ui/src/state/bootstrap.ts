import Urbit from '@urbit/http-api';
import api from '@/api';
import { asyncWithDefault, asyncWithFallback, isTalk } from '@/logic/utils';
import queryClient from '@/queryClient';
import { Gangs, Groups } from '@/types/groups';
import { TalkInit, GroupsInit } from '@/types/ui';
import { useChatStore } from '@/chat/useChatStore';
import { useChatState } from './chat';
import useContactState from './contact';
import useDocketState from './docket';
import useKilnState from './kiln';
import { useLocalState } from './local';
import { useLureState } from './lure/lure';
import usePalsState from './pals';
import useSchedulerStore from './scheduler';
import { useStorage } from './storage';

const emptyGroupsInit: GroupsInit = {
  groups: {},
  gangs: {},
  channels: {},
  briefs: {},
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
  const { channels, briefs, groups, gangs } = await asyncWithDefault(
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
  queryClient.setQueryData(['briefs'], briefs);
  useChatStore.getState().update(briefs);
}

async function startTalk() {
  // since talk is a separate desk we need to offer a fallback
  const { groups, gangs, ...chat } = await asyncWithFallback(
    () =>
      api.scry<TalkInit>({
        app: 'talk-ui',
        path: '/init',
      }),
    async () => {
      const [groupsRes, gangsRes, dms, clubs, invited, pinsResp, briefs] =
        await Promise.all([
          asyncWithDefault(
            () =>
              api.scry<Groups>({
                app: 'groups',
                path: '/groups/light/v0',
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
          chatScry('/pins', { pins: [] }),
          chatScry('/briefs', {}),
        ]);
      return {
        groups: groupsRes,
        gangs: gangsRes,
        dms,
        clubs,
        invited,
        pins: pinsResp.pins,
        briefs,
      };
    }
  );

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);
  useChatState.getState().start(chat);
}

type Bootstrap = 'initial' | 'reset' | 'full-reset';

export default async function bootstrap(reset = 'initial' as Bootstrap) {
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
    api.poke({
      app: isTalk ? 'talk-ui' : 'groups-ui',
      mark: 'ui-vita',
      json: null,
    });
  }, 5);
}

useLocalState.setState({
  onReconnect: () => {
    const { reset } = useSchedulerStore.getState();
    reset();
    bootstrap('reset');

    useLocalState.setState({ lastReconnect: Date.now() });
  },
});

import Urbit from '@urbit/http-api';
import api from '@/api';
import { asyncWithDefault, asyncWithFallback, isTalk } from '@/logic/utils';
import queryClient from '@/queryClient';
import { Gangs, Groups } from '@/types/groups';
import { TalkInit, GroupsInit } from '@/types/ui';
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
  chat: { briefs: {}, chats: {}, pins: [] },
  heap: { briefs: {}, stash: {} },
  diary: { briefs: {}, shelf: {} },
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

async function startGroups(talkStarted: boolean) {
  // make sure if this errors we don't kill the entire app
  const { chat, heap, diary, groups, gangs } = await asyncWithDefault(
    () =>
      api.scry<GroupsInit>({
        app: 'groups-ui',
        path: '/init/v0',
      }),
    emptyGroupsInit
  );

  if (!talkStarted) {
    useChatState.getState().start(chat);
  }

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);
  queryClient.setQueryData(['diary', 'shelf'], diary.shelf);
  queryClient.setQueryData(['diary', 'briefs'], diary.briefs);
  queryClient.setQueryData(['heap', 'stash'], heap.stash);
  queryClient.setQueriesData(['heap', 'briefs'], heap.briefs);
}

async function startTalk(groupsStarted: boolean) {
  // since talk is a separate desk we need to offer a fallback
  const { groups, gangs, ...chat } = await asyncWithFallback(
    () =>
      api.scry<TalkInit>({
        app: 'talk-ui',
        path: '/init/v0',
      }),
    async () => {
      const [
        groupsRes,
        gangsRes,
        briefs,
        chats,
        dms,
        clubs,
        invited,
        pinsResp,
      ] = await Promise.all([
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
        chatScry('/briefs', {}),
        chatScry('/chats', {}),
        chatScry('/dm', []),
        chatScry('/clubs', {}),
        chatScry('/dm/invited', []),
        chatScry('/pins', { pins: [] }),
      ]);
      return {
        groups: groupsRes,
        gangs: gangsRes,
        briefs,
        chats,
        dms,
        clubs,
        invited,
        pins: pinsResp.pins,
      };
    }
  );

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);
  useChatState.getState().startTalk(chat, !groupsStarted);
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
    startTalk(false);
    wait(() => startGroups(true), 5);
  } else {
    startGroups(false);
    wait(async () => startTalk(true), 5);
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

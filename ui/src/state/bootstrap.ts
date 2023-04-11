import api from '@/api';
import { asyncWithDefault, asyncWithFallback, isTalk } from '@/logic/utils';
import queryClient from '@/queryClient';
import { Gangs, Groups } from '@/types/groups';
import { TalkInit, GroupsInit } from '@/types/ui';
import Urbit from '@urbit/http-api';
import { useChatState } from './chat';
import useContactState from './contact';
import { useDiaryState } from './diary';
import useDocketState from './docket';
import { useHeapState } from './heap/heap';
import useKilnState from './kiln';
import { useLocalState } from './local';
import { useLureState } from './lure/lure';
import usePalsState from './pals';
import useSchedulerStore from './scheduler';
import { useSettingsState } from './settings';
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

async function startGroups(talkStarted: boolean, withSubs: boolean) {
  // make sure if this errors we don't kill the entire app
  const { chat, heap, diary, groups, gangs } = await asyncWithDefault(
    () =>
      api.scry<GroupsInit>({
        app: 'groups-ui',
        path: '/init',
      }),
    emptyGroupsInit
  );

  if (!talkStarted) {
    useChatState.getState().start(chat, withSubs);
  }

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);

  useHeapState.getState().start(heap, withSubs);
  useDiaryState.getState().start(diary, withSubs);
}

async function startTalk(groupsStarted: boolean, withSubs: boolean) {
  // since talk is a separate desk we need to offer a fallback
  const { groups, gangs, ...chat } = await asyncWithFallback(
    () =>
      api.scry<TalkInit>({
        app: 'talk-ui',
        path: '/init',
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
              path: '/groups/light',
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
  useChatState.getState().startTalk(chat, !groupsStarted, withSubs);
}

type Bootstrap = 'initial' | 'reset' | 'full-reset';

export default async function bootstrap(reset = 'initial' as Bootstrap) {
  const { wait } = useSchedulerStore.getState();
  if (reset === 'full-reset') {
    api.reset();
  }

  const startSubs = reset !== 'reset';

  if (isTalk) {
    startTalk(false, startSubs);
    wait(() => startGroups(true, startSubs), 5);
  } else {
    startGroups(false, startSubs);
    wait(async () => startTalk(true, startSubs), 5);
  }

  const { initialize: settingsInitialize, fetchAll } =
    useSettingsState.getState();

  wait(() => {
    if (startSubs) {
      useContactState.getState().initialize(api as unknown as Urbit);
      useStorage.getState().initialize(api as unknown as Urbit);
    }

    fetchAll();
  }, 4);

  wait(() => {
    useKilnState.getState().initializeKiln();
    const { start, fetchCharges } = useDocketState.getState();
    fetchCharges();
    if (startSubs) {
      start();
      settingsInitialize(api as unknown as Urbit);
    }
    useLureState.getState().start();

    if (!import.meta.env.DEV) {
      usePalsState.getState().initializePals(startSubs);
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
    bootstrap('reset');

    useLocalState.setState({ lastReconnect: Date.now() });
    queryClient.invalidateQueries();
  },
});

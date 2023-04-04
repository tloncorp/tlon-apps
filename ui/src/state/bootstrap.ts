import api from '@/api';
import { asyncWithDefault, asyncWithFallback, isTalk } from '@/logic/utils';
import { Gangs, Groups } from '@/types/groups';
import { TalkInit, GroupsInit } from '@/types/ui';
import { QueryClient } from '@tanstack/react-query';
import { useChatState } from './chat';
import useContactState from './contact';
import { useDiaryState } from './diary';
import useDocketState from './docket';
import { useHeapState } from './heap/heap';
import useKilnState from './kiln';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: Infinity,
    },
  },
});

async function startGroups(talkStarted: boolean) {
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
    useChatState.getState().start(chat);
  }

  queryClient.setQueryData(['groups'], groups);
  queryClient.setQueryData(['gangs'], gangs);

  useHeapState.getState().start(heap);
  useDiaryState.getState().start(diary);
}

async function startTalk(groupsStarted: boolean) {
  // since talk is a separate desk we need to offer a fallback
  const { ...chat } = await asyncWithFallback(
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

  useChatState.getState().startTalk(chat, !groupsStarted);
}

export default async function bootstrap(reset = false) {
  const { wait } = useSchedulerStore.getState();
  if (reset) {
    api.reset();
    useChatState.getState().clearSubs();
    useHeapState.getState().clearSubs();
    useDiaryState.getState().clearSubs();
  }

  if (isTalk) {
    startTalk(false);
    wait(() => startGroups(true), 5);
  } else {
    startGroups(false);
    wait(async () => startTalk(true), 5);
  }

  const { initialize: settingsInitialize, fetchAll } =
    useSettingsState.getState();

  wait(() => {
    useContactState.getState().initialize(api);
    useStorage.getState().initialize(api);

    fetchAll();
  }, 4);

  wait(() => {
    settingsInitialize(api);
    useKilnState.getState().initializeKiln();
    const { start, fetchCharges } = useDocketState.getState();
    fetchCharges();
    start();
    useLureState.getState().start();

    usePalsState.getState().initializePals();
    api.poke({
      app: isTalk ? 'talk-ui' : 'groups-ui',
      mark: 'ui-vita',
      json: null,
    });
  }, 5);
}

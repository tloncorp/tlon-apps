import api from '@/api';
import { isTalk } from '@/logic/utils';
import { useChatState } from './chat';
import useContactState from './contact';
import { useDiaryState } from './diary';
import { useGroupState } from './groups';
import useHarkState from './hark';
import { useHeapState } from './heap/heap';
import { useSettingsState } from './settings';
import { useStorage } from './storage';

export default function bootstrap() {
  useGroupState.getState().start();
  useChatState.getState().start();

  if (isTalk) {
    useChatState.getState().fetchDms();
  } else {
    useHeapState.getState().start();
    useDiaryState.getState().start();
  }

  useHarkState.getState().start();
  useContactState.getState().initialize(api);
  const { initialize: settingsInitialize, fetchAll } =
    useSettingsState.getState();
  settingsInitialize(api);
  fetchAll();

  useStorage.getState().initialize(api);
}

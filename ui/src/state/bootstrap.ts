import api from '@/api';
import { isTalk } from '@/logic/utils';
import { useChatState } from './chat';
import useContactState from './contact';
import { useDiaryState } from './diary';
import useDocketState from './docket';
import { useGroupState } from './groups';
import useHarkState from './hark';
import { useHeapState } from './heap/heap';
import useKilnState from './kiln';
import usePalsState from './pals';
import { useSettingsState } from './settings';
import { useStorage } from './storage';

export default async function bootstrap(reset = false) {
  if (reset) {
    api.reset();
    useChatState.getState().clearSubs();
    useHeapState.getState().clearSubs();
    useDiaryState.getState().clearSubs();
  }

  useGroupState.getState().start();
  useChatState.getState().start();

  if (isTalk) {
    useChatState.getState().fetchDms();
    useChatState.getState().fetchMultiDms();
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
  useKilnState.getState().initializeKiln();
  const { fetchCharges } = useDocketState.getState();
  fetchCharges();

  usePalsState.getState().initializePals();
}

import type { LegendListRef } from '@legendapp/list/react-native';
import { createContext } from 'react';
import type { NativeScrollEvent } from 'react-native';

/** Opt-in fixture observation. No listener or polling runs in ordinary chats. */
export type ConversationListDiagnostics = {
  attach: (
    list: LegendListRef,
    channelId: string,
    scrollViewTestID?: string
  ) => () => void;
  nativeScroll?: (event: NativeScrollEvent) => void;
  event: (
    name: string,
    values?: Record<string, number | string | boolean>
  ) => void;
};

export const ConversationListDiagnosticsContext =
  createContext<ConversationListDiagnostics | null>(null);

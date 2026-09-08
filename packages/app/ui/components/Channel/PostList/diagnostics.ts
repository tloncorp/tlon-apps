import type * as db from '@tloncorp/shared/db';
import type { LegendListRef } from '@legendapp/list/react-native';
import { createContext } from 'react';
import type { NativeScrollEvent } from 'react-native';

import type { PostListMethods } from './shared';

/** Opt-in fixture observation. No listener or polling runs in ordinary chats. */
export type ConversationListDiagnostics = {
  /** Explicit fixture-only native provider timing; absent in ordinary chats. */
  nativeReadTimingSession?: string;
  attach: (
    list: LegendListRef,
    channelId: string,
    scrollViewTestID?: string
  ) => () => void;
  /** Fixture commands use the same intent-aware handle as production callers. */
  attachMethods?: (methods: PostListMethods) => () => void;
  ruler?: {
    scope: string;
    rowMetadata: (post: db.Post) => {
      scope: string;
      key: string;
      signature: { content: string; reactions: string; replies: number };
    };
  };
  nativeScroll?: (event: NativeScrollEvent) => void;
  event: (
    name: string,
    values?: Record<string, number | string | boolean>
  ) => void;
};

export const ConversationListDiagnosticsContext =
  createContext<ConversationListDiagnostics | null>(null);

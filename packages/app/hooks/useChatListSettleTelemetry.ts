import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo, useRef } from 'react';

import {
  getChatListTelemetrySignature,
  observeChatListMeasurementStart,
  reportChatListRendered,
  reportChatListSnapshot,
  setChatListFocused,
} from '../lib/chatListSettleTelemetry';

export function useChatListSettleTelemetry({
  chats,
  isFocused,
}: {
  chats: db.GroupedChats | null | undefined;
  isFocused: boolean;
}) {
  useEffect(() => {
    setChatListFocused(isFocused);
  }, [isFocused]);

  useEffect(() => {
    if (isFocused && chats) {
      reportChatListSnapshot(chats);
    }
  }, [chats, isFocused]);

  const chatListTelemetrySignature = useMemo(
    () => (chats ? getChatListTelemetrySignature(chats) : null),
    [chats]
  );
  const chatListTelemetrySignatureRef = useRef<string | null>(null);
  const chatsRef = useRef<typeof chats>(chats);
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    chatListTelemetrySignatureRef.current = chatListTelemetrySignature;
  }, [chatListTelemetrySignature]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || !chatListTelemetrySignature) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      reportChatListRendered(chatListTelemetrySignature);
    });
    return () => cancelAnimationFrame(frame);
  }, [chatListTelemetrySignature, isFocused]);

  useEffect(() => {
    return observeChatListMeasurementStart(() => {
      const signature = chatListTelemetrySignatureRef.current;
      const currentChats = chatsRef.current;
      if (!isFocusedRef.current || !signature || !currentChats) {
        return;
      }

      reportChatListSnapshot(currentChats);
      requestAnimationFrame(() => {
        reportChatListRendered(signature);
      });
    });
  }, []);
}

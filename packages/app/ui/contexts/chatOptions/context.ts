import type * as ub from '@tloncorp/api/urbit';
import type * as db from '@tloncorp/shared/db';
import type * as store from '@tloncorp/shared/store';
import { createContext } from 'react';

export type ChatOptionsContextValue = {
  useGroup: typeof store.useGroup;
  group?: db.Group | null;
  channel?: db.Channel | null;
  markGroupRead: () => void;
  markChannelRead: (options?: { includeThreads?: boolean }) => void;
  onPressGroupMeta: (fromBlankChannel?: boolean) => void;
  onPressGroupMembers: () => void;
  onPressManageChannels: () => void;
  onPressInvite?: () => void;
  onPressGroupPrivacy: () => void;
  onPressRoles: () => void;
  onPressChannelMembers: () => void;
  onPressChannelMeta: () => void;
  onPressChannelTemplate: () => void;
  onPressChatDetails: (chat: {
    type: 'group' | 'channel';
    id: string;
    groupId?: string;
  }) => void;
  togglePinned: () => void;
  leaveGroup: () => Promise<void>;
  leaveChannel: () => void;
  updateVolume: (level: ub.NotificationLevel | null) => void;
  setChannelSortPreference?: (sortBy: 'recency' | 'arranged') => void;
  open: (chatId: string, chatType: 'group' | 'channel') => void;
  setChat: (chat: { id: string; type: 'group' | 'channel' } | null) => void;
} | null;

export const ChatOptionsContext = createContext<ChatOptionsContextValue>(null);

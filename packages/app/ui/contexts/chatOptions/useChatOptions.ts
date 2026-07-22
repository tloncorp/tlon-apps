import { useContext } from 'react';

import { ChatOptionsContext, ChatOptionsContextValue } from './context';

const noop = () => {};
const noopAsync = async () => {};
const defaultValue: ChatOptionsContextValue = {
  group: null,
  channel: null,
  markGroupRead: noopAsync,
  markChannelRead: noopAsync,
  onPressGroupMeta: noop,
  onPressGroupMembers: noop,
  onPressManageChannels: noop,
  onPressInvite: noop,
  onPressGroupPrivacy: noop,
  onPressRoles: noop,
  onPressChannelMembers: noop,
  onPressChannelMeta: noop,
  onPressChannelTemplate: noop,
  onPressChatDetails: noop,
  togglePinned: noop,
  leaveGroup: noopAsync,
  leaveChannel: noop,
  updateVolume: noopAsync,
  setChannelSortPreference: noop,
  open: noop,
  setChat: noop,
};

export const useChatOptions = (disabled = false) => {
  const value = useContext(ChatOptionsContext);
  if (disabled) {
    return defaultValue;
  }
  if (!value) {
    throw new Error('useChatOptions used outside of ChatOptions context');
  }
  return value;
};

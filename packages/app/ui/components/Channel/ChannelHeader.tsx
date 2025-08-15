import {
  useConnectionStatus,
  useContact,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useChatOptions } from '../../contexts';
import { useChatDescription, useChatTitle } from '../../utils/channelUtils';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import { FacePile } from '../FacePile/FacePile';
import { ScreenHeader } from '../ScreenHeader';

export interface ChannelHeaderItemsContextValue {
  registerItem: (options: { item: JSX.Element }) => { remove: () => void };
  items: readonly JSX.Element[];
}

const ChannelHeaderItemsContext =
  createContext<ChannelHeaderItemsContextValue | null>(null);

/**
 * Provides a way for children to dynamically register new header items.
 * These items are rendered between the search and overflow menu buttons.
 *
 * ```tsx
 * // in a child:
 * useRegisterChannelHeaderItem(useMemo(() => <Button>Add flarb</Button>, []));
 * // make sure to use `useMemo` to avoid re-registering the item on every render!
 * ```
 */
export function ChannelHeaderItemsProvider({
  children,
}: {
  children: JSX.Element;
}) {
  const [items, setItems] = useState<JSX.Element[]>([]);
  const registerItem = useCallback(
    ({ item }: { item: JSX.Element }) => {
      setItems((prev) => [...prev, item]);
      return {
        remove: () => {
          setItems((prev) => prev.filter((i) => i !== item));
        },
      };
    },
    [setItems]
  );
  return (
    <ChannelHeaderItemsContext.Provider value={{ registerItem, items }}>
      {children}
    </ChannelHeaderItemsContext.Provider>
  );
}

export function useRegisterChannelHeaderItem(item: JSX.Element | null) {
  const registerItem = useContext(ChannelHeaderItemsContext)?.registerItem;

  // NB: Since we're mutating the ChannelHeaderItemsContext in this effect, we
  // need to be careful about the dependencies to avoid recursively updating on
  // every change to the context. We avoid this by (1) defining `registerItem`
  // using a `useCallback`, and (2) only listing `registerItem` as a dependency
  // of the effect (and importantly not `items` nor the full context value).
  useEffect(() => {
    if (registerItem == null || item == null) {
      return;
    }
    const { remove } = registerItem({ item });
    return remove;
  }, [registerItem, item]);
}

export function ChannelHeader({
  title,
  description,
  channel,
  group,
  goBack,
  goToSearch,
  goToEdit,
  goToChatDetails,
  goToProfile,
  showSpinner,
  showSearchButton = false,
  showMenuButton = false,
  showEditButton = false,
}: {
  title: string;
  description: string;
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  goToEdit?: () => void;
  goToChatDetails?: () => void;
  goToProfile?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  showEditButton?: boolean;
  post?: db.Post;
}) {
  const connectionStatus = useConnectionStatus();
  const chatTitle = useChatTitle(channel, group);
  const chatDescription = useChatDescription(channel, group);

  // Get contact info for 1:1 DMs - only fetch when we have a valid contact ID
  const dmContactId = channel.type === 'dm' ? channel.contactId : null;
  const { data: dmContact } = useContact({ id: dmContactId || '' });

  const getChannelTypeName = (channelType: db.Channel['type']) => {
    switch (channelType) {
      case 'chat':
        return 'Chat channel';
      case 'notebook':
        return 'Notebook channel';
      case 'gallery':
        return 'Gallery channel';
      default:
        return 'Channel';
    }
  };

  const contextItems = useContext(ChannelHeaderItemsContext)?.items ?? [];
  const isWindowNarrow = useIsWindowNarrow();

  const titleText = useMemo(() => {
    return chatTitle ?? title;
  }, [chatTitle, title]);

  const subtitleText = useMemo(() => {
    if (connectionStatus !== 'Connected') {
      const statusText =
        connectionStatus === 'Connecting' || connectionStatus === 'Reconnecting'
          ? 'Connecting...'
          : connectionStatus === 'Idle'
            ? 'Initializing...'
            : 'Disconnected';
      return statusText;
    }

    // DM (1:1) - Show contact's status if available, otherwise "Direct message"
    if (channel.type === 'dm') {
      if (dmContactId && dmContact?.status) {
        return dmContact.status;
      }
      return 'Direct message';
    }

    // Group DM (multi-DM) - "Chat with N members"
    if (channel.type === 'groupDm') {
      const memberCount = channel.members?.length ?? 0;
      const result = `Chat with ${memberCount} members`;
      return result;
    }

    // Single-channel chat group
    if (channel.type === 'chat' && group) {
      const hasMultipleChannels = (group.channels?.length ?? 0) > 1;

      // If it's a single-channel group
      if (!hasMultipleChannels) {
        // If group has title and description, use description
        if (group.title && group.title.trim() !== '' && group.description) {
          return group.description;
        }
        // If it's a single-channel group without explicit title/description, show member count
        const memberCount = group.members?.length ?? 0;
        const result = `Chat with ${memberCount} members`;
        return result;
      }

      // For multi-channel groups, check for descriptions first
      if (chatDescription && chatDescription.trim()) {
        return chatDescription;
      }
      if (description && description.trim()) {
        return description;
      }
      // No description, return channel type
      const channelType = getChannelTypeName(channel.type);
      return channelType;
    }

    // For other channel types (notebook, gallery, etc.)
    if (chatDescription && chatDescription.trim()) {
      return chatDescription;
    }
    if (description && description.trim()) {
      return description;
    }

    // No description available, show channel type for non-DM channels
    if (
      channel.type === 'chat' ||
      channel.type === 'notebook' ||
      channel.type === 'gallery'
    ) {
      const channelType = getChannelTypeName(channel.type);
      return channelType;
    }

    return '';
  }, [
    connectionStatus,
    channel,
    group,
    chatDescription,
    description,
    dmContactId,
    dmContact?.status,
  ]);

  const displayTitle = useDebouncedValue(titleText, 300);
  const displaySubtitle = useDebouncedValue(subtitleText, 300);

  const shouldShowFacePile = useMemo(() => {
    if (!channel) return false;

    // Show for DMs and group DMs
    if (channel.type === 'dm' || channel.type === 'groupDm') {
      return true;
    }

    // Show for single-channel groups (when group has only one channel and no explicit title)
    if (channel.type === 'chat' && group) {
      const hasMultipleChannels = (group.channels?.length ?? 0) > 1;
      const hasGroupTitle = group.title && group.title.trim() !== '';
      return !hasMultipleChannels && !hasGroupTitle;
    }

    return false;
  }, [channel, group]);

  const facePileContacts = useMemo(() => {
    if (!shouldShowFacePile || !channel?.members) return [];

    // For DMs and group DMs, show all members
    if (channel.type === 'dm' || channel.type === 'groupDm') {
      return channel.members
        .map((member) => member.contact)
        .filter(Boolean) as db.Contact[];
    }

    // For single-channel groups, show group members
    if (channel.type === 'chat' && group?.members) {
      return group.members
        .map((member) => member.contact)
        .filter(Boolean) as db.Contact[];
    }

    return [];
  }, [shouldShowFacePile, channel, group]);

  const facePileTitle = useMemo(() => {
    if (!shouldShowFacePile) return null;

    if (channel.type === 'chat' && group) {
      const memberCount = group.members?.length ?? 0;
      return `Chat`;
    }

    // For DMs and group DMs, use the existing title logic
    return displayTitle;
  }, [shouldShowFacePile, channel, group, displayTitle]);

  const titleWidth = () => {
    if (showSearchButton && showMenuButton) {
      return 55;
    } else if (contextItems.length > 0 && showMenuButton) {
      return 55;
    } else if (showSearchButton || showMenuButton) {
      return 75;
    } else {
      return 100;
    }
  };

  const handleTitlePress = useMemo(() => {
    // For DMs, navigate to profile
    if (channel.type === 'dm' && goToProfile) {
      return goToProfile;
    }

    // For group DMs, group chats, notebooks, and galleries, navigate to chat details/group info
    if (
      (channel.type === 'groupDm' ||
        channel.type === 'chat' ||
        channel.type === 'notebook' ||
        channel.type === 'gallery') &&
      goToChatDetails
    ) {
      return goToChatDetails;
    }

    return undefined;
  }, [channel.type, goToProfile, goToChatDetails]);

  return (
    <>
      <ScreenHeader
        title={displayTitle}
        subtitle={displaySubtitle}
        showSessionStatus
        showSubtitle
        borderBottom
        isLoading={showSpinner}
        onTitlePress={handleTitlePress}
        useHorizontalTitleLayout={!isWindowNarrow}
        leftControls={goBack && <ScreenHeader.BackButton onPress={goBack} />}
        rightControls={
          <>
            {showSearchButton && (
              <ScreenHeader.IconButton type="Search" onPress={goToSearch} />
            )}
            {/* this fragment/map is necessary to be able to provide a key to the items */}
            {contextItems.map((item, index) => (
              <Fragment key={index}>{item}</Fragment>
            ))}
            {showEditButton && (
              <ScreenHeader.TextButton
                onPress={goToEdit}
                testID="ChannelHeaderEditButton"
              >
                Edit
              </ScreenHeader.TextButton>
            )}
          </>
        }
      />
    </>
  );
}

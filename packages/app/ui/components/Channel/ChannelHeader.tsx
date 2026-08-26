import {
  isChatChannel,
  useConnectionStatus,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useContact, useNotesDeskAvailable } from '@tloncorp/shared/store';
import { useIsWindowNarrow } from '@tloncorp/ui';
import {
  Fragment,
  ReactElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useShipConnectionStatus } from '../../../features/top/useShipConnectionStatus';
import { useCurrentUserId } from '../../contexts/appDataContext';
import { getChannelHost, useChatDescription, useChatTitle } from '../../utils';
import { ContactAvatar } from '../Avatar';
import ConnectionStatus from '../ConnectionStatus';
import { GroupAvatar } from '../GroupAvatar';
import { ScreenHeader, type ScreenHeaderAction } from '../ScreenHeader';
import { useScreenScrollProps } from '../useScreenScrollProps';
import {
  getChannelConnectionStatusText,
  getChannelHeaderLoadingSubtitle,
  isHostedChannelType,
} from './ChannelHeader.helpers';

type ChannelHeaderItem = ReactElement | ScreenHeaderAction[];

interface ChannelHeaderItemsContextValue {
  registerItem: (item: ChannelHeaderItem) => () => void;
  setLoadingSubtitle: (subtitle: string | null) => void;
  items: readonly ChannelHeaderItem[];
  loadingSubtitle: string | null;
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
  children: ReactElement;
}) {
  const [items, setItems] = useState<ChannelHeaderItem[]>([]);
  const [loadingSubtitle, setLoadingSubtitle] = useState<string | null>(null);
  const registerItem = useCallback((item: ChannelHeaderItem) => {
    setItems((prev) => [...prev, item]);
    return () => {
      setItems((prev) => prev.filter((registered) => registered !== item));
    };
  }, []);
  return (
    <ChannelHeaderItemsContext.Provider
      value={{
        registerItem,
        setLoadingSubtitle,
        items,
        loadingSubtitle,
      }}
    >
      {children}
    </ChannelHeaderItemsContext.Provider>
  );
}

export function useRegisterChannelHeaderItem(
  item: ReactElement | ScreenHeaderAction[] | null
) {
  const registerItem = useContext(ChannelHeaderItemsContext)?.registerItem;

  // Depend on the stable registration callbacks rather than the full context;
  // the context value changes whenever an item registers.
  useEffect(() => {
    if (item == null) {
      return;
    }

    return registerItem?.(item);
  }, [item, registerItem]);
}

export function useRegisterChannelHeaderLoadingSubtitle(
  loadingSubtitle: string | null
) {
  const setLoadingSubtitle = useContext(
    ChannelHeaderItemsContext
  )?.setLoadingSubtitle;

  useEffect(() => {
    if (!setLoadingSubtitle) return;
    setLoadingSubtitle(loadingSubtitle);
    return () => setLoadingSubtitle(null);
  }, [loadingSubtitle, setLoadingSubtitle]);
}

export function ChannelHeader({
  title,
  titleIcon,
  description,
  channel,
  group,
  goBack,
  goToSearch,
  goToEdit,
  goToChatDetails,
  goToProfile,
  onToggleContextLens,
  contextLensOpen = false,
  contextLensActive = false,
  showSpinner,
  loadingSubtitle = 'Loading messages…',
  hideIdentity = false,
  backDisabled = false,
  showSearchButton = false,
  showEditButton = false,
  preferProvidedTitle = false,
  post,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  description: string;
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  goToEdit?: () => void;
  goToChatDetails?: () => void;
  goToProfile?: () => void;
  onToggleContextLens?: () => void;
  contextLensOpen?: boolean;
  contextLensActive?: boolean;
  showSpinner?: boolean;
  loadingSubtitle?: string | null;
  hideIdentity?: boolean;
  backDisabled?: boolean;
  showSearchButton?: boolean;
  showEditButton?: boolean;
  preferProvidedTitle?: boolean;
  post?: db.Post;
}) {
  const connectionStatus = useConnectionStatus();
  const chatTitle = useChatTitle(channel, group);
  const chatDescription = useChatDescription(channel, group);
  const currentUserId = useCurrentUserId();

  // Get contact info for 1:1 DMs - only fetch when we have a valid contact ID
  const dmContactId = channel.type === 'dm' ? channel.contactId : null;
  const { data: dmContact } = useContact({ id: dmContactId || '' });
  const { data: notesAvailable = false } = useNotesDeskAvailable();

  const getChannelTypeName = useCallback(
    (channelType: db.Channel['type']) => {
      switch (channelType) {
        case 'chat':
          return 'Chat channel';
        case 'notebook':
          return notesAvailable ? 'Bulletin channel' : 'Notebook channel';
        case 'notes':
          return 'Notebook channel';
        case 'gallery':
          return 'Gallery channel';
        default:
          return 'Channel';
      }
    },
    [notesAvailable]
  );

  const context = useContext(ChannelHeaderItemsContext);
  const registeredItems = context?.items ?? [];
  const contextItems = registeredItems.filter(
    (item): item is ReactElement => !Array.isArray(item)
  );
  const contextActions = registeredItems.flatMap((item) =>
    Array.isArray(item) ? item : []
  );
  const registeredLoadingSubtitle = context?.loadingSubtitle ?? null;
  const isWindowNarrow = useIsWindowNarrow();

  const channelHost = useMemo(() => {
    return getChannelHost(channel, currentUserId);
  }, [channel, currentUserId]);
  const isHostedChannel = isHostedChannelType(channel.type);
  const channelHostConnectionStatus = useShipConnectionStatus(channelHost, {
    enabled: isHostedChannel,
  });
  const isChannelHostOffline =
    isHostedChannel &&
    channelHostConnectionStatus.complete &&
    channelHostConnectionStatus.status !== 'yes';
  const channelConnectionStatusText = getChannelConnectionStatusText(
    connectionStatus,
    isChannelHostOffline
  );

  const titleText = useMemo(() => {
    return preferProvidedTitle ? title : (chatTitle ?? title);
  }, [chatTitle, preferProvidedTitle, title]);

  const subtitleText = useMemo(() => {
    if (channelConnectionStatusText) {
      return channelConnectionStatusText;
    }

    // Viewing a post (PostScreenView with a single post/thread)
    if (post) {
      const channelName = channel.title ?? chatTitle ?? 'channel';
      const preview = post.textContent?.slice(0, 50) ?? '';
      const ellipsis = (post.textContent?.length ?? 0) > 50 ? '…' : '';
      return `Post in ${channelName}${preview ? `: ${preview}${ellipsis}` : ''}`;
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
      channel.type === 'notes' ||
      channel.type === 'gallery'
    ) {
      const channelType = getChannelTypeName(channel.type);
      return channelType;
    }

    return '';
  }, [
    channelConnectionStatusText,
    channel,
    group,
    chatDescription,
    chatTitle,
    description,
    dmContactId,
    dmContact?.status,
    getChannelTypeName,
    post,
  ]);

  const displayTitle = useDebouncedValue(titleText, 300);
  const displaySubtitle = useDebouncedValue(subtitleText, 300);
  const headerLoadingSubtitle = getChannelHeaderLoadingSubtitle({
    channelConnectionStatusText,
    loadingSubtitle,
    registeredLoadingSubtitle,
    showSpinner,
  });
  const headerTitle = displayTitle;

  const avatarElement = useMemo(() => {
    // For DMs, show the other user's avatar
    if (channel.type === 'dm' && dmContactId) {
      return <ContactAvatar contactId={dmContactId} size="$2xl" />;
    }

    // For group DMs, show group avatar as fallback
    if (channel.type === 'groupDm' && group) {
      return <GroupAvatar model={group} size="$2xl" />;
    }

    // For group channels
    if (channel.type === 'chat' && group) {
      const hasMultipleChannels = (group.channels?.length ?? 0) > 1;
      const hasGroupTitle = group.title && group.title.trim() !== '';
      const isSingleChannelGroup = !hasMultipleChannels && !hasGroupTitle;

      // Don't show group icons for channels within multi-channel groups when using horizontal layout
      if (!isSingleChannelGroup && !isWindowNarrow) {
        return null;
      }

      // If group has an avatar, use it
      if (group.iconImage) {
        return <GroupAvatar model={group} size="$2xl" />;
      }

      // For single-channel groups without explicit title, use group avatar
      if (isSingleChannelGroup) {
        return <GroupAvatar model={group} size="$2xl" />;
      }

      // For other cases (single-channel groups or vertical layout), use group avatar (with fallback)
      return <GroupAvatar model={group} size="$2xl" />;
    }

    // For notebook and gallery channels, show group avatar only in vertical layout (narrow/mobile)
    if (
      (channel.type === 'notebook' || channel.type === 'gallery') &&
      group &&
      isWindowNarrow
    ) {
      return <GroupAvatar model={group} size="$2xl" />;
    }

    return null;
  }, [channel, group, dmContactId, isWindowNarrow]);

  const handleTitlePress = useMemo(() => {
    // For DMs, navigate to profile
    if (channel.type === 'dm' && goToProfile) {
      return goToProfile;
    }

    // For group DMs, group chats, notebooks, notes, and galleries, navigate to chat details/group info
    if (
      (channel.type === 'groupDm' ||
        channel.type === 'chat' ||
        channel.type === 'notebook' ||
        channel.type === 'notes' ||
        channel.type === 'gallery') &&
      goToChatDetails
    ) {
      return goToChatDetails;
    }

    return undefined;
  }, [channel.type, goToProfile, goToChatDetails]);

  const headerProps = {
    title: headerTitle,
    titleIcon: hideIdentity ? null : (
      <>
        {avatarElement || titleIcon}
        {channelHost && !isWindowNarrow && (
          <ConnectionStatus contactId={channelHost} type="indicator" />
        )}
      </>
    ),
    subtitle: hideIdentity ? undefined : displaySubtitle,
    testID: 'ChannelHeaderTitle',
    showSubtitle: !hideIdentity,
    borderBottom: true,
    loadingSubtitle:
      hideIdentity && !registeredLoadingSubtitle ? null : headerLoadingSubtitle,
    onTitlePress: hideIdentity ? undefined : handleTitlePress,
    useHorizontalTitleLayout: !isWindowNarrow,
  };
  const rightActions: ScreenHeaderAction[] = [
    {
      id: 'channel-search',
      icon: 'Search',
      label: 'Search',
      onPress: goToSearch,
      visible: showSearchButton,
    },
    ...contextActions,
    {
      id: 'channel-edit',
      text: 'Edit',
      onPress: goToEdit,
      testID: 'ChannelHeaderEditButton',
      visible: showEditButton,
    },
    {
      id: 'channel-context-lens',
      icon: 'RightSidebar',
      label: 'Toggle context lens',
      onPress: onToggleContextLens,
      testID: 'ContextLensHeaderButton',
      tint: contextLensActive ? '$positiveActionText' : undefined,
      backgroundTint: contextLensOpen ? '$secondaryBackground' : undefined,
      visible: !!onToggleContextLens,
    },
  ];
  const usesNavigationHeader = isChatChannel(channel);
  // The conversation list owns its scroll props, but this call installs the
  // matching native scroll-edge options on the navigator.
  useScreenScrollProps({
    enabled: usesNavigationHeader,
    bottomEdgeEffect: 'soft',
  });

  if (usesNavigationHeader) {
    // Native navigation headers accept declarative actions only. Element-style
    // registrations are reserved for inline notebook and gallery headers.
    return (
      <ScreenHeader
        {...headerProps}
        placement="navigation"
        backAction={goBack}
        backDisabled={backDisabled}
        rightActions={rightActions}
      />
    );
  }

  return (
    <ScreenHeader
      {...headerProps}
      backAction={goBack}
      backDisabled={backDisabled}
      rightActions={rightActions}
      rightControls={
        contextItems.length ? (
          <>
            {/* this fragment/map is necessary to be able to provide a key to the items */}
            {contextItems.map((item, index) => (
              <Fragment key={index}>{item}</Fragment>
            ))}
          </>
        ) : null
      }
    />
  );
}

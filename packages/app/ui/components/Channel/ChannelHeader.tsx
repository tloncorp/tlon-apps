import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useConnectionStatus, useDebouncedValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useContact, useNotesDeskAvailable } from '@tloncorp/shared/store';
import { Icon, Text, useIsWindowNarrow } from '@tloncorp/ui';
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
import { ActivityIndicator, Platform, Pressable } from 'react-native';
import { XStack } from 'tamagui';

import type { RootStackParamList } from '../../../navigation/types';
import { useNativeHeaderItems } from '../nativeHeaderItems';
import { useCurrentUserId } from '../../contexts/appDataContext';
import { getChannelHost, useChatDescription, useChatTitle } from '../../utils';
import { ContactAvatar } from '../Avatar';
import ConnectionStatus from '../ConnectionStatus';
import { GroupAvatar } from '../GroupAvatar';
import { ScreenHeader } from '../ScreenHeader';
import {
  ScreenHeaderControlChrome,
  ScreenHeaderControlsChrome,
} from '../ScreenHeaderChrome';

export interface ChannelHeaderItemsContextValue {
  registerItem: (options: { item: ReactElement }) => { remove: () => void };
  setLoadingSubtitle: (subtitle: string | null) => void;
  items: readonly ReactElement[];
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
  const [items, setItems] = useState<ReactElement[]>([]);
  const [loadingSubtitle, setLoadingSubtitle] = useState<string | null>(null);
  const registerItem = useCallback(
    ({ item }: { item: ReactElement }) => {
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
    <ChannelHeaderItemsContext.Provider
      value={{ registerItem, setLoadingSubtitle, items, loadingSubtitle }}
    >
      {children}
    </ChannelHeaderItemsContext.Provider>
  );
}

export function useRegisterChannelHeaderItem(item: ReactElement | null) {
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
  showSearchButton = false,
  showEditButton = false,
  preferProvidedTitle = false,
  post,
  useFloatingHeaderChrome = false,
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
  showSearchButton?: boolean;
  showEditButton?: boolean;
  preferProvidedTitle?: boolean;
  post?: db.Post;
  useFloatingHeaderChrome?: boolean;
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
  const contextItems = context?.items ?? [];
  const registeredLoadingSubtitle = context?.loadingSubtitle ?? null;
  const isWindowNarrow = useIsWindowNarrow();

  const channelHost = useMemo(() => {
    return getChannelHost(channel, currentUserId);
  }, [channel, currentUserId]);

  const titleText = useMemo(() => {
    return preferProvidedTitle ? title : chatTitle ?? title;
  }, [chatTitle, preferProvidedTitle, title]);

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
    connectionStatus,
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
  const headerLoadingSubtitle = registeredLoadingSubtitle
    ? registeredLoadingSubtitle
    : showSpinner
      ? loadingSubtitle
      : connectionStatus !== 'Connected'
        ? subtitleText
        : null;
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

  if (Platform.OS === 'ios' && useFloatingHeaderChrome) {
    return (
      <NativeChannelHeader
        title={headerTitle}
        titleIcon={hideIdentity ? null : avatarElement || titleIcon}
        loadingTitle={
          hideIdentity && !registeredLoadingSubtitle
            ? null
            : headerLoadingSubtitle
        }
        onTitlePress={hideIdentity ? undefined : handleTitlePress}
        goBack={goBack}
        goToSearch={goToSearch}
        showSearchButton={showSearchButton}
        contextItems={contextItems}
        showEditButton={showEditButton}
        goToEdit={goToEdit}
        onToggleContextLens={onToggleContextLens}
        contextLensOpen={contextLensOpen}
        contextLensActive={contextLensActive}
      />
    );
  }

  const rightControlsContent = (
    <>
      {showSearchButton &&
        (useFloatingHeaderChrome ? (
          <ScreenHeaderControlChrome>
            <ScreenHeader.IconButton type="Search" onPress={goToSearch} />
          </ScreenHeaderControlChrome>
        ) : (
          <ScreenHeader.IconButton type="Search" onPress={goToSearch} />
        ))}
      {/* this fragment/map is necessary to be able to provide a key to the items */}
      {contextItems.map((item, index) => (
        <Fragment key={index}>
          {useFloatingHeaderChrome ? (
            <ScreenHeaderControlChrome>{item}</ScreenHeaderControlChrome>
          ) : (
            item
          )}
        </Fragment>
      ))}
      {showEditButton &&
        (useFloatingHeaderChrome ? (
          <ScreenHeaderControlChrome>
            <ScreenHeader.TextButton
              onPress={goToEdit}
              testID="ChannelHeaderEditButton"
              color="$primaryText"
            >
              Edit
            </ScreenHeader.TextButton>
          </ScreenHeaderControlChrome>
        ) : (
          <ScreenHeader.TextButton
            onPress={goToEdit}
            testID="ChannelHeaderEditButton"
            color="$primaryText"
          >
            Edit
          </ScreenHeader.TextButton>
        ))}
      {onToggleContextLens &&
        (useFloatingHeaderChrome ? (
          <ScreenHeaderControlChrome>
            <ScreenHeader.IconButton
              type="RightSidebar"
              onPress={onToggleContextLens}
              testID="ContextLensHeaderButton"
              color={contextLensActive ? '$positiveActionText' : '$primaryText'}
              backgroundColor={
                contextLensOpen ? '$secondaryBackground' : 'transparent'
              }
            />
          </ScreenHeaderControlChrome>
        ) : (
          <ScreenHeader.IconButton
            type="RightSidebar"
            onPress={onToggleContextLens}
            testID="ContextLensHeaderButton"
            color={contextLensActive ? '$positiveActionText' : '$primaryText'}
            backgroundColor={
              contextLensOpen ? '$secondaryBackground' : 'transparent'
            }
          />
        ))}
    </>
  );

  return (
    <ScreenHeader
      title={headerTitle}
      titleIcon={
        hideIdentity ? null : (
          <>
            {avatarElement || titleIcon}
            {channelHost && !isWindowNarrow && (
              <ConnectionStatus contactId={channelHost} type="indicator" />
            )}
          </>
        )
      }
      subtitle={hideIdentity ? undefined : displaySubtitle}
      testID="ChannelHeaderTitle"
      showSubtitle={!hideIdentity}
      borderBottom
      floating={useFloatingHeaderChrome}
      loadingSubtitle={
        hideIdentity && !registeredLoadingSubtitle
          ? null
          : headerLoadingSubtitle
      }
      onTitlePress={hideIdentity ? undefined : handleTitlePress}
      useHorizontalTitleLayout={!isWindowNarrow}
      leftControls={
        goBack &&
        (useFloatingHeaderChrome ? (
          <ScreenHeaderControlChrome>
            <ScreenHeader.BackButton onPress={goBack} />
          </ScreenHeaderControlChrome>
        ) : (
          <ScreenHeader.BackButton onPress={goBack} />
        ))
      }
      rightControls={
        useFloatingHeaderChrome ? (
          <ScreenHeaderControlsChrome>
            {rightControlsContent}
          </ScreenHeaderControlsChrome>
        ) : (
          rightControlsContent
        )
      }
    />
  );
}

function NativeChannelHeader({
  title,
  titleIcon,
  loadingTitle,
  onTitlePress,
  goBack,
  goToSearch,
  showSearchButton,
  contextItems,
  showEditButton,
  goToEdit,
  onToggleContextLens,
  contextLensOpen,
  contextLensActive,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  loadingTitle?: string | null;
  onTitlePress?: () => void;
  goBack?: () => void;
  goToSearch?: () => void;
  showSearchButton: boolean;
  contextItems: readonly ReactElement[];
  showEditButton: boolean;
  goToEdit?: () => void;
  onToggleContextLens?: () => void;
  contextLensOpen: boolean;
  contextLensActive: boolean;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const nativeHeaderOptions = useMemo(
    () => ({
      headerTitle: () => (
        <NativeChannelHeaderTitle
          title={title}
          titleIcon={titleIcon}
          loadingTitle={loadingTitle}
          onPress={onTitlePress}
        />
      ),
    }),
    [loadingTitle, onTitlePress, title, titleIcon]
  );

  useNativeHeaderItems({
    navigation,
    title,
    left: [
      {
        id: 'channel-back',
        icon: 'ChevronLeft',
        label: 'Back',
        onPress: goBack,
        visible: !!goBack,
      },
    ],
    right: [
      {
        id: 'channel-search',
        icon: 'Search',
        label: 'Search',
        onPress: goToSearch,
        visible: !!(showSearchButton && goToSearch),
      },
      ...contextItems.map((element, index) => ({
        id: `channel-context-${index}`,
        element,
      })),
      {
        id: 'channel-edit',
        text: 'Edit',
        onPress: goToEdit,
        visible: !!(showEditButton && goToEdit),
      },
      {
        id: 'channel-context-lens',
        icon: 'RightSidebar',
        label: 'Toggle context lens',
        onPress: onToggleContextLens,
        selected: contextLensOpen,
        tint: contextLensActive ? '$positiveActionText' : undefined,
        visible: !!onToggleContextLens,
      },
    ],
    options: nativeHeaderOptions,
    revision: contextItems,
  });

  return null;
}

function NativeChannelHeaderTitle({
  title,
  titleIcon,
  loadingTitle,
  onPress,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  loadingTitle?: string | null;
  onPress?: () => void;
}) {
  const content = (
    <XStack
      height={44}
      maxWidth={220}
      alignItems="center"
      justifyContent="center"
      gap="$s"
    >
      {titleIcon}
      {loadingTitle ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text
          size="$label/2xl"
          color="$primaryText"
          numberOfLines={1}
          maxWidth={175}
        >
          {title}
        </Text>
      )}
      {onPress && !loadingTitle ? (
        <Icon type="ChevronDown" color="$primaryText" size="$s" />
      ) : null}
    </XStack>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

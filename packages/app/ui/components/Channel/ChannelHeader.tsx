import {
  getNestParts,
  useConnectionStatus,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { View, XStack } from 'tamagui';

import { useChatOptions, useCurrentUserId } from '../../contexts';
import { useChatTitle } from '../../utils';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import ConnectionStatus from '../ConnectionStatus';
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
  channel,
  group,
  goBack,
  goToSearch,
  goToEdit,
  goToChatDetails,
  showSpinner,
  showSearchButton = true,
  showMenuButton = false,
  showEditButton = false,
}: {
  title: string;
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  goToEdit?: () => void;
  goToChatDetails?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  showEditButton?: boolean;
  post?: db.Post;
}) {
  const chatOptions = useChatOptions();
  const [openChatOptions, setOpenChatOptions] = useState(false);
  const connectionStatus = useConnectionStatus();
  const chatTitle = useChatTitle(channel, group);
  const currentUserId = useCurrentUserId();

  const handlePressOverflowMenu = useCallback(() => {
    chatOptions.open(channel.id, 'channel');
  }, [channel.id, chatOptions]);

  const contextItems = useContext(ChannelHeaderItemsContext)?.items ?? [];
  const isWindowNarrow = useIsWindowNarrow();

  const channelHost = useMemo(() => {
    if (channel.type === 'dm') {
      return channel.id;
    }

    if (channel.type === 'groupDm') {
      return currentUserId;
    }

    const { ship } = getNestParts(channel.id);

    return ship;
  }, [channel, currentUserId]);

  const titleText = useMemo(() => {
    if (connectionStatus === 'Connected') {
      return chatTitle ?? title;
    }

    const statusText =
      connectionStatus === 'Connecting' || connectionStatus === 'Reconnecting'
        ? 'Connecting...'
        : connectionStatus === 'Idle'
          ? 'Initializing...'
          : 'Disconnected';

    return statusText;
  }, [chatTitle, title, connectionStatus]);
  const displayTitle = useDebouncedValue(titleText, 300);

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

  return (
    <>
      <ScreenHeader
        title={
          <XStack alignItems="center" gap="$m">
            <Pressable flex={1} onPress={goToChatDetails}>
              <ScreenHeader.Title testID="ChannelHeaderTitle">
                <XStack alignItems="center">
                  {channelHost && isWindowNarrow && (
                    <ConnectionStatus
                      contactId={channelHost}
                      type="indicator"
                    />
                  )}
                  {displayTitle}
                </XStack>
              </ScreenHeader.Title>
            </Pressable>
          </XStack>
        }
        titleWidth={titleWidth()}
        showSessionStatus
        isLoading={showSpinner}
        leftControls={goBack && <ScreenHeader.BackButton onPress={goBack} />}
        rightControls={
          <>
            {channelHost && !isWindowNarrow && (
              <ConnectionStatus
                contactId={channelHost}
                type="indicator-with-text"
              />
            )}
            {showSearchButton && (
              <ScreenHeader.IconButton type="Search" onPress={goToSearch} />
            )}
            {/* this fragment/map is necessary to be able to provide a key to the items */}
            {contextItems.map((item, index) => (
              <Fragment key={index}>{item}</Fragment>
            ))}
            {showMenuButton ? (
              isWindowNarrow ? (
                <ScreenHeader.IconButton
                  type="Overflow"
                  onPress={handlePressOverflowMenu}
                  testID="ChannelOptionsSheetTrigger"
                />
              ) : (
                <ChatOptionsSheet
                  open={openChatOptions}
                  onOpenChange={setOpenChatOptions}
                  chat={{ type: 'channel', id: channel.id }}
                  trigger={<ScreenHeader.IconButton type="Overflow" />}
                />
              )
            ) : null}
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

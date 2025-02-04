import * as db from '@tloncorp/shared/db';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useChatOptions } from '../../contexts';
import useIsWindowNarrow from '../../hooks/useIsWindowNarrow';
import { useGroupTitle } from '../../utils';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import Pressable from '../Pressable';
import { ScreenHeader } from '../ScreenHeader';
import { BaubleHeader } from './BaubleHeader';

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
  mode = 'default',
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
  mode?: 'default' | 'next';
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  goToEdit?: () => void;
  goToChannels?: () => void; // remove once we're confident we don't wanna open that as a pattern
  goToChatDetails?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  showEditButton?: boolean;
  post?: db.Post;
}) {
  const chatOptions = useChatOptions();
  const [openChatOptions, setOpenChatOptions] = useState(false);

  const handlePressOverflowMenu = useCallback(() => {
    chatOptions.open(channel.id, 'channel');
  }, [channel.id, chatOptions]);

  const contextItems = useContext(ChannelHeaderItemsContext)?.items ?? [];
  const isWindowNarrow = useIsWindowNarrow();

  console.log('mode', mode);

  if (mode === 'next') {
    return <BaubleHeader channel={channel} group={group} />;
  }

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
          <Pressable onPress={goToChatDetails}>
            <ScreenHeader.Title>{title}</ScreenHeader.Title>
          </Pressable>
        }
        titleWidth={titleWidth()}
        showSessionStatus
        isLoading={showSpinner}
        leftControls={goBack && <ScreenHeader.BackButton onPress={goBack} />}
        rightControls={
          <>
            {showSearchButton && (
              <ScreenHeader.IconButton type="Search" onPress={goToSearch} />
            )}
            {contextItems}
            {showMenuButton ? (
              isWindowNarrow ? (
                <ScreenHeader.IconButton
                  type="Overflow"
                  onPress={handlePressOverflowMenu}
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
              <ScreenHeader.TextButton onPress={goToEdit}>
                Edit
              </ScreenHeader.TextButton>
            )}
          </>
        }
      />
    </>
  );
}

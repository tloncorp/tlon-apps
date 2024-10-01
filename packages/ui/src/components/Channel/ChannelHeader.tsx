import * as db from '@tloncorp/shared/dist/db';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Button } from '../Button';
import { ChatOptionsSheet, ChatOptionsSheetMethods } from '../ChatOptionsSheet';
import { GenericHeader } from '../GenericHeader';
import { Icon } from '../Icon';
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
  showSpinner,
  showSearchButton = true,
  showMenuButton = false,
}: {
  title: string;
  mode?: 'default' | 'next';
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  post?: db.Post;
}) {
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);

  const handlePressOverflowMenu = useCallback(() => {
    chatOptionsSheetRef.current?.open(channel.id, channel.type);
  }, [channel.id, channel.type]);

  const contextItems = useContext(ChannelHeaderItemsContext)?.items ?? [];

  if (mode === 'next') {
    return <BaubleHeader channel={channel} group={group} />;
  }

  return (
    <>
      <GenericHeader
        title={title}
        goBack={goBack}
        showSpinner={showSpinner}
        rightContent={
          <>
            {showSearchButton && (
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={goToSearch}
              >
                <Icon type="Search" />
              </Button>
            )}
            {contextItems}
            {showMenuButton && (
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={handlePressOverflowMenu}
              >
                <Icon type="Overflow" />
              </Button>
            )}
          </>
        }
      />
      <ChatOptionsSheet ref={chatOptionsSheetRef} />
    </>
  );
}

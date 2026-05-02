import { FlashList, ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  Icon,
  Image,
  Pressable,
  SectionListHeader,
  Text,
  getDarkColor,
  isLightColor,
} from '@tloncorp/ui';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { Square, View, XStack, getTokenValue } from 'tamagui';

import { useFilteredChats } from '../../hooks/useFilteredChats';
import { useOpenApps } from '../../hooks/useOpenApps';
import { useResolvedChats } from '../../hooks/useResolvedChats';
import { ChatListItem } from '../../ui';

const isWeb = Platform.OS === 'web';
const TITLE_DARK = '#1f2937';
const TITLE_LIGHT = '#e5e7eb';
const ICON_SIZE = 28;
const blendStyle = isWeb
  ? ({ mixBlendMode: 'hard-light' } as { mixBlendMode: 'hard-light' })
  : undefined;

type LeapItem =
  | { type: 'header'; title: string; key: string }
  | { type: 'launcher'; key: string }
  | {
      type: 'app';
      app: store.InstalledApp;
      isOpen: boolean;
      key: string;
    }
  | { type: 'chat'; chat: db.Chat; key: string };

const isSelectable = (item: LeapItem) => item.type !== 'header';

export interface FilteredLeapListRef {
  selectNext: () => void;
  selectPrevious: () => void;
  pressSelected: () => void;
}

function AppIcon({ app }: { app: store.InstalledApp }) {
  const lightBg = app.color ? isLightColor(app.color) : true;
  const fallbackInitialColor = app.color ? getDarkColor(app.color) : 'white';
  const initialColor = isWeb
    ? lightBg
      ? TITLE_DARK
      : TITLE_LIGHT
    : fallbackInitialColor;
  return (
    <Square
      size={ICON_SIZE}
      borderRadius="$s"
      overflow="hidden"
      backgroundColor={app.color || '$secondaryBackground'}
      alignItems="center"
      justifyContent="center"
    >
      {app.image ? (
        <Image
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          width="100%"
          height="100%"
          source={{ uri: app.image }}
          contentFit="cover"
        />
      ) : (
        <Text
          size="$label/s"
          fontWeight="600"
          color={initialColor}
          style={blendStyle}
        >
          {app.title.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </Square>
  );
}

function LauncherRow({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      backgroundColor={selected ? '$positiveBackground' : 'transparent'}
      borderRadius="$m"
      paddingHorizontal="$m"
      paddingVertical="$s"
    >
      <XStack alignItems="center" gap="$m">
        <Square
          size={ICON_SIZE}
          borderRadius="$s"
          backgroundColor="$secondaryBackground"
          alignItems="center"
          justifyContent="center"
        >
          <Icon type="Discover" customSize={[18, 18]} />
        </Square>
        <View flex={1}>
          <Text size="$label/l" color="$primaryText" numberOfLines={1}>
            App launcher
          </Text>
        </View>
        <Text size="$label/s" color="$secondaryText">
          Browse
        </Text>
      </XStack>
    </Pressable>
  );
}

function AppRow({
  app,
  hint,
  selected,
  onPress,
}: {
  app: store.InstalledApp;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      backgroundColor={selected ? '$positiveBackground' : 'transparent'}
      borderRadius="$m"
      paddingHorizontal="$m"
      paddingVertical="$s"
    >
      <XStack alignItems="center" gap="$m">
        <AppIcon app={app} />
        <View flex={1}>
          <Text size="$label/l" color="$primaryText" numberOfLines={1}>
            {app.title}
          </Text>
        </View>
        <Text size="$label/s" color="$secondaryText">
          {hint}
        </Text>
      </XStack>
    </Pressable>
  );
}

export const FilteredLeapList = React.memo(
  forwardRef<
    FilteredLeapListRef,
    {
      searchQuery: string;
      onPressApp: (desk: string, isOpen: boolean) => void;
      onPressChat: (chat: db.Chat) => void;
      onPressLauncher: () => void;
    }
  >(function FilteredLeapList(
    { searchQuery, onPressApp, onPressChat, onPressLauncher },
    ref
  ) {
    const listRef = useRef<FlashList<LeapItem>>(null);

    const { data: chats } = store.useCurrentChats();
    const resolvedChats = useResolvedChats(chats);
    const filteredChatsConfig = useMemo(
      () => ({
        ...resolvedChats,
        pending: [],
        searchQuery,
        activeTab: 'all' as const,
      }),
      [resolvedChats, searchQuery]
    );
    const chatSections = useFilteredChats(filteredChatsConfig);

    const { data: installed = [] } = store.useInstalledApps();
    const openDesks = useOpenApps();
    const openSet = useMemo(() => new Set(openDesks), [openDesks]);

    const items = useMemo<LeapItem[]>(() => {
      const q = searchQuery.trim().toLowerCase();
      const matches = (a: store.InstalledApp) =>
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.desk.toLowerCase().includes(q);

      const active: store.InstalledApp[] = [];
      const others: store.InstalledApp[] = [];
      for (const app of installed) {
        if (!matches(app)) continue;
        if (openSet.has(app.desk)) active.push(app);
        else others.push(app);
      }

      const out: LeapItem[] = [];
      if (active.length > 0) {
        out.push({ type: 'header', title: 'Active', key: 'header:active' });
        for (const app of active) {
          out.push({
            type: 'app',
            app,
            isOpen: true,
            key: `app:${app.desk}`,
          });
        }
      }

      if (!q) {
        // No query: collapse the rest of the apps into a single "open
        // launcher" entry instead of listing them individually.
        out.push({ type: 'launcher', key: 'launcher' });
      } else if (others.length > 0) {
        out.push({ type: 'header', title: 'Apps', key: 'header:apps' });
        for (const app of others) {
          out.push({
            type: 'app',
            app,
            isOpen: false,
            key: `app:${app.desk}`,
          });
        }
      }

      for (const section of chatSections) {
        if (section.data.length === 0) continue;
        out.push({
          type: 'header',
          title: section.title,
          key: `header:${section.title}`,
        });
        for (const chat of section.data) {
          out.push({ type: 'chat', chat, key: `chat:${chat.type}:${chat.id}` });
        }
      }
      return out;
    }, [chatSections, installed, openSet, searchQuery]);

    const firstSelectableIndex = useMemo(() => {
      const i = items.findIndex(isSelectable);
      return i === -1 ? 0 : i;
    }, [items]);

    const [selectedIndex, setSelectedIndex] = useState(firstSelectableIndex);

    // Reset selection when items shape changes (e.g., new query).
    useEffect(() => {
      setSelectedIndex(firstSelectableIndex);
    }, [firstSelectableIndex]);

    const updateSelection = useCallback((index: number) => {
      setSelectedIndex(index);
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }, []);

    useImperativeHandle(ref, () => ({
      selectNext: () => {
        let next = selectedIndex + 1;
        while (next < items.length && !isSelectable(items[next])) next++;
        if (next < items.length) updateSelection(next);
      },
      selectPrevious: () => {
        let prev = selectedIndex - 1;
        while (prev >= 0 && !isSelectable(items[prev])) prev--;
        if (prev >= 0) updateSelection(prev);
      },
      pressSelected: () => {
        const item = items[selectedIndex];
        if (!item) return;
        if (item.type === 'launcher') onPressLauncher();
        if (item.type === 'app') onPressApp(item.app.desk, item.isOpen);
        if (item.type === 'chat') onPressChat(item.chat);
      },
    }));

    const renderItem: ListRenderItem<LeapItem> = useCallback(
      ({ item, index }) => {
        if (item.type === 'header') {
          return (
            <SectionListHeader>
              <SectionListHeader.Text>{item.title}</SectionListHeader.Text>
            </SectionListHeader>
          );
        }
        if (item.type === 'launcher') {
          return (
            <LauncherRow
              selected={index === selectedIndex}
              onPress={onPressLauncher}
            />
          );
        }
        if (item.type === 'app') {
          return (
            <AppRow
              app={item.app}
              hint={item.isOpen ? 'Switch' : 'Launch'}
              selected={index === selectedIndex}
              onPress={() => onPressApp(item.app.desk, item.isOpen)}
            />
          );
        }
        return (
          <ChatListItem
            disableOptimization
            model={item.chat}
            onPress={onPressChat}
            disableOptions
            showGroupTitle
            borderWidth="$2xs"
            marginHorizontal={-1}
            {...(index === selectedIndex
              ? {
                  backgroundColor: '$positiveBackground',
                  borderColor: '$positiveBorder',
                }
              : { borderColor: 'transparent' })}
          />
        );
      },
      [onPressApp, onPressChat, onPressLauncher, selectedIndex]
    );

    const getItemType = useCallback((item: LeapItem) => item.type, []);
    const keyExtractor = useCallback((item: LeapItem) => item.key, []);

    const contentContainerStyle = useMemo(
      () => ({
        padding: getTokenValue('$l', 'size'),
      }),
      []
    );

    if (items.length === 0) {
      if (searchQuery !== '') {
        return (
          <Text color="$tertiaryText" textAlign="center" fontFamily="$body">
            No results found
          </Text>
        );
      }
      return null;
    }

    return (
      <View flex={1}>
        <FlashList
          ref={listRef}
          data={items}
          renderItem={renderItem}
          getItemType={getItemType}
          keyExtractor={keyExtractor}
          estimatedItemSize={60}
          extraData={selectedIndex}
          contentContainerStyle={contentContainerStyle}
        />
      </View>
    );
  })
);

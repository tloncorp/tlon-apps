import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, IconType, Pressable, Text } from '@tloncorp/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, View, XStack, YStack, getTokenValue, useTheme } from 'tamagui';

import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { ListItem } from '../ui';
import {
  GlassSurface,
  supportsLiquidGlass,
} from '../ui/components/GlassSurface';
import { useCalm } from '../ui/contexts/appDataContext';
import { getChatTitle } from '../ui/utils/channelUtils';
import { getDrawerChats } from './drawerChats';
import { announceTopLevelSectionReselected } from './topLevelSectionReselect';
import {
  TOP_LEVEL_TABS,
  TopLevelTabName,
  getActiveTopLevelTab,
  getInitialTopLevelTab,
  getTopLevelTabNavigateAction,
  isTabPressBlockedByOnboardingLock,
  trackTopLevelTabSelection,
} from './topLevelTabs';
import { useRootNavigation } from './utils';

const logger = createDevLogger('TopLevelDrawerContent', false);

// The same touch target the bar's icons kept: iOS HIG 44pt, Material 48dp.
const SECTION_ROW_MIN_HEIGHT = 48;
// Shorter than a section row: these carry one line of text and there are many
// of them, so the list stays scannable rather than becoming a stack of slabs.
const CHAT_ROW_MIN_HEIGHT = 40;
// Holds the unread dot and the gap after it, so a row without one still lines
// its title up with the rows that have one.
const UNREAD_DOT_SLOT_WIDTH = 10;
// The footer's two controls, sized to match each other.
const FOOTER_CONTROL_SIZE = 48;
const FOOTER_CONTROL_RADIUS = FOOTER_CONTROL_SIZE / 2;

// The footer controls are Liquid Glass on an OS that has it, and the drawer's
// own flat surfaces everywhere else.
const usesIOSGlass = supportsLiquidGlass();

/**
 * The sections the drawer lists as rows, in the order it lists them.
 *
 * Bot and Settings are absent on purpose — they are reached from the footer
 * instead, as the `Chat` button and the settings icon.
 */
const DRAWER_SECTION_ROWS = [
  'Activity',
  'ChatList',
] as const satisfies readonly TopLevelTabName[];

function DrawerSection({
  icon,
  label,
  selected,
  hasUnread,
  disabled,
  onPress,
  testID,
}: {
  icon: IconType;
  label: string;
  selected: boolean;
  hasUnread: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      // The dot beside the label is decorative, so the unread state has to
      // reach a screen reader through the label itself.
      accessibilityLabel={hasUnread ? `${label}, unread` : label}
      accessibilityState={{ disabled, selected }}
      borderRadius="$l"
      paddingHorizontal="$l"
      justifyContent="center"
      minHeight={SECTION_ROW_MIN_HEIGHT}
      opacity={disabled ? 0.4 : 1}
      backgroundColor={selected ? '$secondaryBackground' : 'transparent'}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <XStack alignItems="center" gap="$l">
        <Icon type={icon} color={selected ? '$primaryText' : '$tertiaryText'} />
        <Text
          flex={1}
          size="$label/l"
          color={selected ? '$primaryText' : '$secondaryText'}
        >
          {label}
        </Text>
        {hasUnread ? <Circle size="$s" backgroundColor="$blue" /> : null}
      </XStack>
    </Pressable>
  );
}

const DrawerChatRow = React.memo(function DrawerChatRowComponent({
  chat,
  title,
  disabled,
  onPress,
}: {
  chat: db.Chat;
  title: string;
  disabled: boolean;
  onPress: (chat: db.Chat) => void;
}) {
  const handlePress = useCallback(() => onPress(chat), [chat, onPress]);
  // A muted chat is one the user asked not to be drawn back to, so it keeps
  // its unread count on the workspace list — where counts are read
  // deliberately — without lighting a dot here.
  const hasUnread =
    chat.unreadCount > 0 &&
    !logic.isMuted(chat.volumeSettings?.level, chat.type);

  return (
    <Pressable
      onPress={disabled ? undefined : handlePress}
      disabled={disabled}
      accessibilityRole="button"
      // The dot is decorative, so the unread state has to reach a screen
      // reader through the label itself.
      accessibilityLabel={hasUnread ? `${title}, unread` : title}
      accessibilityState={{ disabled }}
      testID={`TopLevelDrawerChat-${chat.id}`}
      borderRadius="$l"
      paddingHorizontal="$l"
      justifyContent="center"
      minHeight={CHAT_ROW_MIN_HEIGHT}
      opacity={disabled ? 0.4 : 1}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <XStack alignItems="center" gap="$m">
        {/* The dot sits in a fixed-width slot rather than in the flow, so one
            unread row does not indent its title past every read one. */}
        <View width={UNREAD_DOT_SLOT_WIDTH} alignItems="flex-start">
          {hasUnread ? <Circle size="$s" backgroundColor="$blue" /> : null}
        </View>
        <Text
          flex={1}
          numberOfLines={1}
          size="$label/l"
          fontWeight={hasUnread ? '600' : undefined}
          color="$primaryText"
        >
          {title}
        </Text>
        <ListItem.Time time={chat.timestamp} paddingBottom={0} />
      </XStack>
    </Pressable>
  );
});

/**
 * The button that opens the bot's own conversation.
 *
 * Liquid Glass is the chrome where the OS has it, so the control picks up the
 * list scrolling under it the way the composer's do. Everywhere else it is the
 * app's ordinary primary button, which brings its own fill.
 */
function DrawerChatButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  if (!usesIOSGlass) {
    return (
      <Button
        preset="primary"
        label="Chat"
        leadingIcon={TOP_LEVEL_TABS.BotChat.icon}
        onPress={onPress}
        testID="TopLevelDrawerChatButton"
      />
    );
  }

  return (
    // The pill sizes to its label, and a glass view given no size of its own
    // still draws but hit-tests as empty — taps land on the chats passing
    // underneath. So the glass goes behind as a backdrop, and the pressable
    // above it both sets the size and takes the touch. The settings button,
    // which has a fixed size, can host its pressable inside the glass.
    <View alignSelf="flex-start" borderRadius={FOOTER_CONTROL_RADIUS}>
      {/* Tinted rather than clear: this is the drawer's primary action, and
          clear glass over a pale panel leaves the label competing with the
          chat titles behind it. The tint is the fill the primary button
          carries everywhere else, so both treatments read as one control. */}
      <GlassSurface
        glassEffectStyle="regular"
        tintColor={theme.primaryText?.val}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, footerStyles.chatPill]}
      />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Chat"
        testID="TopLevelDrawerChatButton"
        height={FOOTER_CONTROL_SIZE}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        gap="$m"
        paddingHorizontal="$xl"
      >
        <Icon
          type={TOP_LEVEL_TABS.BotChat.icon}
          customSize={[20, 20]}
          color="$background"
        />
        <Text size="$label/l" color="$background">
          Chat
        </Text>
      </Pressable>
    </View>
  );
}

function DrawerSettingsButton({
  selected,
  disabled,
  onPress,
}: {
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const control = (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={TOP_LEVEL_TABS.Settings.title}
      accessibilityState={{ disabled, selected }}
      testID="TopLevelDrawerSection-Settings"
      width={FOOTER_CONTROL_SIZE}
      height={FOOTER_CONTROL_SIZE}
      borderRadius={FOOTER_CONTROL_RADIUS}
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.4 : 1}
      // Under glass the surface is the chrome, and a second fill on top of it
      // would flatten the effect; selection is tinted into the glass instead.
      backgroundColor={
        !usesIOSGlass && selected ? '$secondaryBackground' : 'transparent'
      }
      pressStyle={
        usesIOSGlass ? undefined : { backgroundColor: '$secondaryBackground' }
      }
      hoverStyle={
        usesIOSGlass ? undefined : { backgroundColor: '$secondaryBackground' }
      }
    >
      <Icon
        type={TOP_LEVEL_TABS.Settings.icon}
        color={selected ? '$primaryText' : '$tertiaryText'}
      />
    </Pressable>
  );

  if (!usesIOSGlass) {
    return control;
  }

  return (
    <GlassSurface
      isInteractive
      tintColor={selected ? theme.secondaryBackground?.val : undefined}
      style={footerStyles.settingsButton}
    >
      {control}
    </GlassSurface>
  );
}

const footerStyles = StyleSheet.create({
  chatPill: {
    borderRadius: FOOTER_CONTROL_RADIUS,
    overflow: 'hidden',
  },
  settingsButton: {
    width: FOOTER_CONTROL_SIZE,
    height: FOOTER_CONTROL_SIZE,
    borderRadius: FOOTER_CONTROL_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * The drawer panel: the sections above, every chat below, and the two
 * destinations that earned a control of their own pinned to the bottom.
 *
 * The drawer hosts the root stack rather than the sections themselves, so
 * nothing here is one of its own routes. Each target dispatches the same route
 * helper every other caller uses, which the stack below picks up.
 */
export function TopLevelDrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation } = props;
  const insets = useSafeAreaInsets();
  const botDm = useBotDmTab();
  const { disableNicknames } = useCalm();
  const { navigateToGroup, navigateToChannel } = useRootNavigation();
  // What each target marks: the bot DM marks its own control, so one message
  // never lights both it and Activity.
  const botDmHasUnread = store.useChannelHasUnread(
    botDm.enabled ? botDm.channelId : undefined
  );
  const unseenActivityCount = store.useUnreadUnseenActivityCount({
    excludeChannelId: botDm.enabled ? botDm.channelId : undefined,
  });
  const onboardingLock = useAnyAgentGroupOnboardingLock();
  // The panel is mounted for the app's whole life, open or not, so this query
  // would otherwise observe every chat forever — and `useCurrentChats` is
  // shared by key with the workspace list, whose own observer is deliberately
  // gated on focus. An ungated one here would hold that gate open and re-run
  // the whole chat query on every inbound message.
  const drawerOpen = useDrawerStatus() === 'open';
  const { data: chats } = store.useCurrentChats({ enabled: drawerOpen });
  // The drawer's own state holds one route — the root stack — so the section
  // to mark is read out of that stack's state. A cold load that named no
  // section leaves the sections navigator yet to report its state upward, and
  // until it does it is showing the route it initialises to.
  const selected =
    getActiveTopLevelTab(state.routes[state.index]?.state) ??
    getInitialTopLevelTab(botDm.enabled);

  const select = useCallback(
    (section: TopLevelTabName) => {
      if (isTabPressBlockedByOnboardingLock(onboardingLock.locked, section)) {
        return;
      }
      // Match the bar this replaces: track selections, not re-selections of
      // the section already showing — and let a re-selection send that
      // section's list back to the top, which is the other thing pressing the
      // active tab used to do.
      if (section === selected) {
        announceTopLevelSectionReselected(section);
      } else {
        trackTopLevelTabSelection(section);
      }
      // `MainTabs` is a route of the stack this drawer hosts, not of the
      // drawer, so the action is dispatched for the stack below to handle.
      navigation.dispatch(getTopLevelTabNavigateAction(section));
      // Choosing the section already showing changes no route, so the routers
      // leave the drawer open — and closing is what that press asked for
      // either way.
      navigation.closeDrawer();
    },
    [navigation, onboardingLock.locked, selected]
  );

  // Every chat is a destination inside Workspaces, so the lock that refuses
  // that section refuses these rows with it.
  const chatsLocked = isTabPressBlockedByOnboardingLock(
    onboardingLock.locked,
    'ChatList'
  );

  const openChat = useCallback(
    (chat: db.Chat) => {
      if (chatsLocked) {
        return;
      }
      if (chat.type === 'group' && chat.isPending) {
        // An invite is acted on through the preview sheet, which belongs to
        // the workspace list — so this lands there with the sheet open rather
        // than opening a group the user has not joined. No `ActionTappedChat`
        // for the same reason the workspace list does not record one: opening
        // a preview is not opening a chat.
        navigation.dispatch(
          getTopLevelTabNavigateAction('ChatList', { previewGroupId: chat.id })
        );
        navigation.closeDrawer();
        return;
      }
      logger.trackEvent(AnalyticsEvent.ActionTappedChat, {
        ...logic.getModelAnalytics(
          chat.type === 'group'
            ? { group: chat.group }
            : { channel: chat.channel }
        ),
        source: 'drawer',
      });
      if (chat.type === 'group') {
        navigateToGroup(chat.group.id);
      } else {
        navigateToChannel(chat.channel);
      }
      navigation.closeDrawer();
    },
    [chatsLocked, navigateToChannel, navigateToGroup, navigation]
  );

  const hasUnread: Partial<Record<TopLevelTabName, boolean>> = {
    Activity: unseenActivityCount > 0,
  };

  // Closed, the rows are not merely invisible but unbuilt: there is no
  // virtualisation here, so leaving them mounted would keep one view per chat
  // alive behind a panel nobody is looking at.
  const drawerChats = useMemo(
    () => (drawerOpen ? getDrawerChats(chats) : []),
    [chats, drawerOpen]
  );
  const titles = useMemo(
    () =>
      new Map(
        drawerChats.map((chat) => [
          chat.id,
          getChatTitle(chat, disableNicknames),
        ])
      ),
    [drawerChats, disableNicknames]
  );

  const sectionRows = (
    <YStack gap="$xs" paddingBottom="$m">
      {DRAWER_SECTION_ROWS.map((section) => (
        <DrawerSection
          key={section}
          icon={TOP_LEVEL_TABS[section].icon}
          label={TOP_LEVEL_TABS[section].title}
          selected={section === selected}
          hasUnread={hasUnread[section] ?? false}
          disabled={isTabPressBlockedByOnboardingLock(
            onboardingLock.locked,
            section
          )}
          onPress={() => select(section)}
          testID={`TopLevelDrawerSection-${section}`}
        />
      ))}
    </YStack>
  );

  // The footer floats over the list so the chats pass under the glass — that
  // is what gives it something to refract. Its height is measured rather than
  // computed: the non-glass `Chat` button is a different height from the glass
  // pill, and the list has to reserve whatever is actually there.
  const [footerHeight, setFooterHeight] = useState(0);

  const settingsDisabled = isTabPressBlockedByOnboardingLock(
    onboardingLock.locked,
    'Settings'
  );

  return (
    <YStack
      flex={1}
      paddingTop={insets.top + getTokenValue('$m', 'space')}
      paddingLeft={insets.left + getTokenValue('$m', 'space')}
      paddingRight={insets.right + getTokenValue('$m', 'space')}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: footerHeight }}
        testID="TopLevelDrawerChats"
      >
        {sectionRows}
        {drawerChats.map((chat) => (
          <DrawerChatRow
            key={chat.id}
            chat={chat}
            title={titles.get(chat.id) ?? ''}
            disabled={chatsLocked}
            onPress={openChat}
          />
        ))}
      </ScrollView>
      <XStack
        position="absolute"
        bottom={0}
        // The container's own padding already insets an absolute child, so
        // these stay at its edges rather than adding a second one.
        left={0}
        right={0}
        alignItems="center"
        justifyContent="space-between"
        gap="$m"
        paddingTop="$m"
        paddingBottom={insets.bottom + getTokenValue('$m', 'space')}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        {botDm.enabled ? (
          <View>
            <DrawerChatButton onPress={() => select('BotChat')} />
            {botDmHasUnread ? (
              <Circle
                size="$s"
                backgroundColor="$blue"
                position="absolute"
                top={-2}
                right={-2}
              />
            ) : null}
          </View>
        ) : (
          // Nothing to chat with: the account has no bot, the same reason the
          // section itself is not registered.
          <View />
        )}
        <DrawerSettingsButton
          selected={selected === 'Settings'}
          disabled={settingsDisabled}
          onPress={() => select('Settings')}
        />
      </XStack>
    </YStack>
  );
}

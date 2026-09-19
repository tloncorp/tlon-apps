import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, IconType, Pressable, Text } from '@tloncorp/ui';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, View, XStack, YStack, getTokenValue, useTheme } from 'tamagui';

import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { ListItem } from '../ui';
import { floatingChromeMetrics } from '../ui/components/conversationInsets';
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
  getExistingTopLevelTabRoute,
  getInitialTopLevelTab,
  getTopLevelTabNavigateAction,
  isTabPressBlockedByOnboardingLock,
  trackTopLevelTabSelection,
} from './topLevelTabs';
import {
  getMainGroupRoute,
  screenNameFromChannelId,
  useTypedReset,
} from './utils';

const logger = createDevLogger('TopLevelDrawerContent', false);

// The same touch target the bar's icons kept: iOS HIG 44pt, Material 48dp.
const SECTION_ROW_MIN_HEIGHT = 48;
// Shorter than a section row: these carry one line of text and there are many
// of them, so the list stays scannable rather than becoming a stack of slabs.
const CHAT_ROW_MIN_HEIGHT = 40;
// How far a row's own background is held off the panel's edge, and then how
// far its content is held off that. Everything the eye reads down the left —
// a section's icon, a chat's name, the `Chat` button — starts at their sum.
const PANEL_INSET = '$l' as const;
const CONTENT_INSET = '$l' as const;
// The footer's controls are the composer's controls: the settings button is
// the `+` button in another place, so it takes the same size and radius from
// the same source rather than a matching pair of numbers here.
const FOOTER_CONTROL_SIZE = floatingChromeMetrics.controlSize;
const FOOTER_CONTROL_RADIUS = floatingChromeMetrics.controlRadius;

// The footer controls are Liquid Glass on an OS that has it, and the drawer's
// own flat surfaces everywhere else.
const usesIOSGlass = supportsLiquidGlass();

// Both controls float over the list, so they get the lift the app's other
// floating chrome has — the composer's own value, written the way a shadow is
// written in a native style rather than as a `boxShadow` string. It sits on a
// wrapper rather than on the glass itself: the glass clips to its bounds, and
// a view that clips does not cast.
const FOOTER_CONTROL_SHADOW = {
  // The strength lives in `shadowOpacity`, never in the colour's alpha: on
  // iOS the opacity replaces it rather than multiplying with it, so an alpha
  // written into the colour beside `shadowOpacity: 1` is simply discarded and
  // the shadow comes out full-strength black.
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
} as const;

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
      paddingHorizontal={CONTENT_INSET}
      justifyContent="center"
      minHeight={SECTION_ROW_MIN_HEIGHT}
      opacity={disabled ? 0.4 : 1}
      backgroundColor={selected ? '$secondaryBackground' : 'transparent'}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <XStack alignItems="center" gap="$l">
        {/* Frame sized to the glyph: the default leaves 4pt of padding inside
            it, which would set every icon in from the column the names keep. */}
        <Icon
          type={icon}
          customSize={['$2xl', '$2xl']}
          color={selected ? '$primaryText' : '$tertiaryText'}
        />
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
  // A reaction, mention or thread reply can leave a row notified with a count
  // of zero, which the workspace rows read as unread and so does this.
  const notified =
    chat.type === 'group'
      ? (chat.group.unread?.notify ?? false)
      : (chat.channel.unread?.notify ?? false);
  // A muted chat is one the user asked not to be drawn back to, so it keeps
  // its unread count on the workspace list — where counts are read
  // deliberately — without lighting a dot here.
  const hasUnread =
    (chat.unreadCount > 0 || notified) &&
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
      paddingHorizontal={CONTENT_INSET}
      justifyContent="center"
      minHeight={CHAT_ROW_MIN_HEIGHT}
      opacity={disabled ? 0.4 : 1}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <XStack alignItems="center" gap="$m">
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
        {hasUnread ? <Circle size="$s" backgroundColor="$blue" /> : null}
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
function DrawerChatButton({
  hasUnread,
  selected,
  onPress,
}: {
  hasUnread: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  // The dot beside the button is decorative, so the unread state has to reach
  // a screen reader through the label — as the Bot row's did before it.
  const accessibilityLabel = hasUnread ? 'Chat, unread' : 'Chat';

  if (!usesIOSGlass) {
    return (
      <Button
        preset="primary"
        label="Chat"
        leadingIcon={TOP_LEVEL_TABS.BotChat.icon}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        testID="TopLevelDrawerChatButton"
        {...FOOTER_CONTROL_SHADOW}
      />
    );
  }

  return (
    // The pill sizes to its label, and a glass view given no size of its own
    // still draws but hit-tests as empty — taps land on the chats passing
    // underneath. So the glass goes behind as a backdrop, and the pressable
    // above it both sets the size and takes the touch. The settings button,
    // which has a fixed size, can host its pressable inside the glass.
    <View
      alignSelf="flex-start"
      borderRadius={FOOTER_CONTROL_RADIUS}
      {...FOOTER_CONTROL_SHADOW}
    >
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
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
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
      // Under glass this carries no selected state at all: it is the
      // composer's `+` in another place and reads the same way, and the `+`
      // has none. Where the section rows are is what marks the open section.
      // Off glass it keeps the fill, which is the only thing it would have.
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
      {/* The composer's `+` glyph colour: this is that button in another
          place, so it reads the same rather than dimming when unselected. */}
      <Icon type={TOP_LEVEL_TABS.Settings.icon} color="$primaryText" />
    </Pressable>
  );

  if (!usesIOSGlass) {
    return (
      <View borderRadius={FOOTER_CONTROL_RADIUS} {...FOOTER_CONTROL_SHADOW}>
        {control}
      </View>
    );
  }

  return (
    <View borderRadius={FOOTER_CONTROL_RADIUS} {...FOOTER_CONTROL_SHADOW}>
      <GlassSurface isInteractive style={footerStyles.settingsButton}>
        {control}
      </GlassSurface>
    </View>
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
  const reset = useTypedReset();
  // What each target marks: the bot DM marks its own control, so one message
  // never lights both it and Activity.
  const botDmHasUnread = store.useChannelHasUnread(
    botDm.enabled ? botDm.channelId : undefined
  );
  const unseenActivityCount = store.useUnreadUnseenActivityCount({
    excludeChannelId: botDm.enabled ? botDm.channelId : undefined,
  });
  const onboardingLock = useAnyAgentGroupOnboardingLock();
  // Every request to leave the drawer takes the next number; a continuation
  // that finishes holding an older one has been superseded and drops what it
  // was going to do. A chat open can outlive its own tap — the group has to be
  // read before its route is known — and by then the user may have chosen
  // something else, here or from any of the other controls.
  const navigationRequestRef = useRef(0);
  // The panel is mounted for the app's whole life, open or not, so this query
  // would otherwise observe every chat forever — and `useCurrentChats` is
  // shared by key with the workspace list, whose own observer is deliberately
  // gated on focus. An ungated one here would hold that gate open and re-run
  // the whole chat query on every inbound message.
  const drawerOpen = useDrawerStatus() === 'open';
  const { data: chats } = store.useCurrentChats({ enabled: drawerOpen });
  // Armed fresh each time the panel opens, so the one-chat-per-opening guard
  // in `openChat` never outlives the opening it belongs to.

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
      // Choosing a section supersedes a chat still resolving its route.
      navigationRequestRef.current += 1;
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
      const request = ++navigationRequestRef.current;
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
      // These rows are the workspace list's chats, so what they open is a
      // position inside Workspaces however the drawer was reached — otherwise
      // it is pushed above whichever section happened to be showing and stays
      // attributed to it.
      //
      // One dispatch for the section and the chat together: selecting the
      // section first and then navigating would show the workspace list in
      // between, because the group route has to read the group before it knows
      // whether to open its channel list or its only channel. And the section
      // is the `MainTabs` already standing rather than a fresh one, so the
      // sections keep what they were holding — the workspace list's filter and
      // scroll, Activity's scroll — as they would through an ordinary tab
      // switch.
      // Resetting to what is already showing would replace that route with a
      // newly keyed one, remounting the conversation and throwing away the
      // scroll position of whoever is reading it — so a row for where we
      // already are only closes the drawer.
      //
      // What "already there" means has to be the route this would build, not
      // the chat it came from. A group and a channel pinned out of that group
      // are two rows here, and both routes carry the same `groupId`, so
      // comparing ids would make either one answer for the other.
      const stackState = state.routes[state.index]?.state;
      const focused = stackState?.routes?.[stackState.index ?? 0];
      const focusedParams = focused?.params as
        | { channelId?: string; groupId?: string }
        | undefined;
      const showsRoute = (route: { name: string; params?: object }) => {
        if (route.name !== focused?.name) {
          return false;
        }
        const params = route.params as
          | { channelId?: string; groupId?: string }
          | undefined;
        return route.name === 'GroupChannels'
          ? params?.groupId === focusedParams?.groupId
          : params?.channelId === focusedParams?.channelId;
      };

      const sectionRoute = getExistingTopLevelTabRoute(stackState, 'ChatList');
      if (chat.type === 'group') {
        getMainGroupRoute(chat.group.id, true).then((groupRoute) => {
          if (
            navigationRequestRef.current !== request ||
            showsRoute(groupRoute)
          ) {
            return;
          }
          reset([sectionRoute, groupRoute]);
        });
      } else {
        const channelRoute = {
          name: screenNameFromChannelId(chat.channel.id) as
            | 'DM'
            | 'GroupDM'
            | 'Channel',
          params: {
            channelId: chat.channel.id,
            ...(chat.channel.groupId ? { groupId: chat.channel.groupId } : {}),
            // Picked straight out of the drawer, so it stands on its own like
            // every other row here — nothing is pushed behind it for a caret
            // to lead back to. A DM says this by its route name; a channel
            // pinned out of a group has to say it in a param.
            isDrawerDestination: true,
          },
        };
        if (!showsRoute(channelRoute)) {
          reset([sectionRoute, channelRoute]);
        }
      }
      navigation.closeDrawer();
    },
    [chatsLocked, navigation, reset, state]
  );

  const hasUnread: Partial<Record<TopLevelTabName, boolean>> = {
    Activity: unseenActivityCount > 0,
  };

  // Not gated on the drawer being open: the list is virtualised, so what is
  // mounted is what is on screen, and discarding it on close only made the
  // next open pay to build it again.
  const drawerChats = useMemo(() => getDrawerChats(chats), [chats]);
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
  const panelInset = getTokenValue(PANEL_INSET, 'space');

  const settingsDisabled = isTabPressBlockedByOnboardingLock(
    onboardingLock.locked,
    'Settings'
  );

  return (
    <YStack
      flex={1}
      paddingTop={insets.top + getTokenValue('$m', 'space')}
      paddingLeft={insets.left + panelInset}
      paddingRight={insets.right + panelInset}
    >
      <FlashList
        data={drawerChats}
        keyExtractor={(chat) => chat.id}
        renderItem={({ item }) => (
          <DrawerChatRow
            chat={item}
            title={titles.get(item.id) ?? ''}
            disabled={chatsLocked}
            onPress={openChat}
          />
        )}
        ListHeaderComponent={sectionRows}
        contentContainerStyle={{ paddingBottom: footerHeight }}
        testID="TopLevelDrawerChats"
      />
      <XStack
        position="absolute"
        bottom={0}
        // An absolutely positioned child is laid out against the container's
        // border box, not its padding box, so it carries the panel's inset
        // itself — and then its own padding puts the controls on the same
        // column as the rows' contents.
        left={insets.left + panelInset}
        right={insets.right + panelInset}
        alignItems="center"
        justifyContent="space-between"
        gap="$m"
        paddingHorizontal={CONTENT_INSET}
        paddingTop="$m"
        paddingBottom={insets.bottom + getTokenValue('$m', 'space')}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        {botDm.enabled ? (
          <View>
            <DrawerChatButton
              hasUnread={botDmHasUnread}
              selected={selected === 'BotChat'}
              onPress={() => select('BotChat')}
            />
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

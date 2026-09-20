import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import {
  AnalyticsEvent,
  configurationFromChannel,
  createDevLogger,
} from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, IconType, Pressable, Text } from '@tloncorp/ui';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, View, XStack, YStack, getTokenValue, useTheme } from 'tamagui';

import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { ListItem, getUnreadColors } from '../ui';
import { floatingChromeMetrics } from '../ui/components/conversationInsets';
import {
  GlassSurface,
  supportsLiquidGlass,
} from '../ui/components/GlassSurface';
import { useCalm } from '../ui/contexts/appDataContext';
import { getChannelTitle, getChatTitle } from '../ui/utils/channelUtils';
import { getDrawerChats } from './drawerChats';
import {
  DrawerRow,
  channelRecency,
  channelRowHasUnread,
  getDrawerRows,
  toggleUnfurled,
} from './drawerWorkspaceRows';
import {
  buildDrawerChannelRoute,
  drawerOwnsEdge,
  routeShowsChat,
} from './drawerDestination';
import { announceTopLevelSectionReselected } from './topLevelSectionReselect';
import type { RouteSnapshot } from './topLevelTabs';
import {
  TOP_LEVEL_TABS,
  TopLevelTabName,
  getActiveTopLevelTab,
  getInitialTopLevelTab,
  getStandingTopLevelTabRoute,
  getTopLevelTabNavigateAction,
  isTabPressBlockedByOnboardingLock,
  trackTopLevelTabSelection,
} from './topLevelTabs';
import { getMainGroupRoute, useTypedReset } from './utils';

const logger = createDevLogger('TopLevelDrawerContent', false);

// The same touch target the bar's icons kept: iOS HIG 44pt, Material 48dp.
const SECTION_ROW_MIN_HEIGHT = 48;
// Shorter than a section row: these carry one line of text and there are many
// of them, so the list stays scannable rather than becoming a stack of slabs.
const CHAT_ROW_MIN_HEIGHT = 40;
// An unfurled workspace and its channels are one block, so they share one
// fill and the rows between its ends carry no corners of their own.
const UNFURLED_FILL = '$secondaryBackground' as const;
// A row inside that block that is pressed, or is the conversation on screen.
// `$secondaryBackground` says both of those things everywhere else here and
// the block has already spent it; a border token because it is the only
// surface that differs from that fill in every theme on offer.
const UNFURLED_EMPHASIS = '$secondaryBorder' as const;
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
      // reach a screen reader through the label itself. It is always the
      // accent: Activity is where notifying activity collects, so there is no
      // quieter kind here to tell it apart from.
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
        {hasUnread ? (
          <Circle
            size="$s"
            backgroundColor={getUnreadColors(true).foreground}
          />
        ) : null}
      </XStack>
    </Pressable>
  );
}

const DrawerChatRow = React.memo(function DrawerChatRowComponent({
  chat,
  title,
  selected,
  disabled,
  unfurls,
  unfurled,
  onPress,
}: {
  chat: db.Chat;
  title: string;
  selected: boolean;
  disabled: boolean;
  /** Whether pressing this row opens its channels below it. */
  unfurls: boolean;
  unfurled: boolean;
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
  // The same accent/grey split the workspace list's count badge makes, in the
  // form this row has room for: the dot is the badge with the number taken
  // out, so it reads the colours from the same place rather than picking its
  // own.
  const unreadColor = getUnreadColors(notified).foreground;

  return (
    <Pressable
      onPress={disabled ? undefined : handlePress}
      disabled={disabled}
      accessibilityRole="button"
      // The dot is decorative, and its colour carries a distinction a screen
      // reader would otherwise lose entirely, so the label makes it in words.
      accessibilityLabel={
        hasUnread
          ? `${title}, ${notified ? 'unread, notified' : 'unread'}`
          : title
      }
      // A screen reader is told this row opens and closes, and which it is,
      // by the state rather than the label: the panel says it in words for
      // nothing else, and a row that merely opens a chat has no such state.
      accessibilityState={{
        disabled,
        selected,
        ...(unfurls ? { expanded: unfurled } : {}),
      }}
      testID={`TopLevelDrawerChat-${chat.id}`}
      borderTopLeftRadius="$l"
      borderTopRightRadius="$l"
      // Unfurled, this row is the top of its block rather than a row of its
      // own, so its lower corners are squared off against the channels below.
      borderBottomLeftRadius={unfurled ? 0 : '$l'}
      borderBottomRightRadius={unfurled ? 0 : '$l'}
      paddingHorizontal={CONTENT_INSET}
      justifyContent="center"
      minHeight={CHAT_ROW_MIN_HEIGHT}
      opacity={disabled ? 0.4 : 1}
      backgroundColor={
        unfurled
          ? UNFURLED_FILL
          : selected
            ? '$secondaryBackground'
            : 'transparent'
      }
      pressStyle={{
        backgroundColor: unfurled ? UNFURLED_EMPHASIS : '$secondaryBackground',
      }}
      hoverStyle={{
        backgroundColor: unfurled ? UNFURLED_EMPHASIS : '$secondaryBackground',
      }}
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
        {hasUnread ? <Circle size="$s" backgroundColor={unreadColor} /> : null}
      </XStack>
    </Pressable>
  );
});

/**
 * One channel of an unfurled workspace.
 *
 * It is the chat row above it with the workspace's fill already under it, so
 * everything a row says — its name, when it last saw anything, whether it is
 * holding unread — it says in the same places and the same greys.
 */
const DrawerChannelRow = React.memo(function DrawerChannelRowComponent({
  channel,
  title,
  selected,
  disabled,
  groupMuted,
  last,
  onPress,
}: {
  channel: db.Channel;
  title: string;
  selected: boolean;
  disabled: boolean;
  /** Muted at the workspace, which silences every channel that has not been
      turned back up on its own. */
  groupMuted: boolean;
  /** Last of its workspace's channels, so the block's fill ends here. */
  last: boolean;
  onPress: (channel: db.Channel) => void;
}) {
  const handlePress = useCallback(() => onPress(channel), [channel, onPress]);
  const notified = channel.unread?.notify ?? false;
  const hasUnread = channelRowHasUnread(channel, groupMuted);
  const unreadColor = getUnreadColors(notified).foreground;

  return (
    <Pressable
      onPress={disabled ? undefined : handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        hasUnread
          ? `${title}, ${notified ? 'unread, notified' : 'unread'}`
          : title
      }
      accessibilityState={{ disabled, selected }}
      testID={`TopLevelDrawerWorkspaceChannel-${channel.id}`}
      paddingHorizontal={CONTENT_INSET}
      justifyContent="center"
      minHeight={CHAT_ROW_MIN_HEIGHT}
      // Only the bottom of the block is rounded, and only the last row can be
      // it; the rows above square off against each other so the fill reads as
      // one surface rather than a stack of them.
      borderBottomLeftRadius={last ? '$l' : 0}
      borderBottomRightRadius={last ? '$l' : 0}
      marginBottom={last ? '$xs' : 0}
      opacity={disabled ? 0.4 : 1}
      backgroundColor={selected ? UNFURLED_EMPHASIS : UNFURLED_FILL}
      pressStyle={{ backgroundColor: UNFURLED_EMPHASIS }}
      hoverStyle={{ backgroundColor: UNFURLED_EMPHASIS }}
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
        {/* The value the channels are ordered by, so what a row says and where
            it sits cannot disagree. */}
        <ListItem.Time time={channelRecency(channel)} paddingBottom={0} />
        {hasUnread ? <Circle size="$s" backgroundColor={unreadColor} /> : null}
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
  // Ungated, as the desktop sidebars this panel is the mobile counterpart of
  // are. Gating it on the panel being open looks like a saving — the query is
  // a heavy one and the panel is shut most of the time — but React Query only
  // refetches a stale entry for an *active* observer, so a shut panel meant
  // every unread arriving in the meantime merely marked the entry stale.
  // Opening it then served the last value it happened to hold, sometimes
  // minutes old, and corrected it a beat later. The panel is the only place
  // unreads are visible from inside a conversation now that the tab bar is
  // gone, so its data has to be live, not fetched at the moment of looking.
  const { data: chats } = store.useCurrentChats();
  // Every closing of the panel voids whatever it had in flight. A chat open
  // outlives its own tap — the group has to be read before its route is known
  // — and the panel can be dismissed in that gap by the overlay, a back
  // action or a swipe, none of which go through the rows. Without this the
  // read would come back and navigate to a chat the user had just backed away
  // from. A closing the panel did itself, having navigated, is counted too:
  // by then the reset has already gone out.
  const drawerOpen = useDrawerStatus() === 'open';
  useEffect(() => {
    if (!drawerOpen) {
      navigationRequestRef.current += 1;
    }
  }, [drawerOpen]);

  // The drawer's own state holds one route — the root stack — so everything
  // about where the app is standing is read out of that stack's state.
  const rootStackState = state.routes[state.index]?.state;
  // What the app is standing on behind the panel, so a row can say it is the
  // one already open.
  const focusedStackRoute = rootStackState?.routes?.[rootStackState.index ?? 0];
  // A cold load that named no section leaves the sections navigator yet to
  // report its state upward, and until it does it is showing the route it
  // initialises to.
  const activeSection =
    getActiveTopLevelTab(rootStackState) ??
    getInitialTopLevelTab(botDm.enabled);
  // Standing in a chat the drawer opened, no section is marked. The section
  // below such a chat is only whichever one happened to be showing when it was
  // chosen — the chat was not reached through it — so marking it would light a
  // second row beside the chat's own and name somewhere the user is not. A
  // chat pushed over another screen is a position inside that hierarchy and
  // keeps its section marked.
  const selected = drawerOwnsEdge(rootStackState) ? null : activeSection;

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

  // Whether the app is already showing the route a row would build.
  //
  // What "already there" means has to be the route, not the chat it came from.
  // A group and a channel pinned out of that group are two rows here, and both
  // routes carry the same `groupId`, so comparing ids would make either one
  // answer for the other.
  const showsFocusedRoute = useCallback(
    (route: { name: string; params?: object }) => {
      if (route.name !== focusedStackRoute?.name) {
        return false;
      }
      const focusedParams = focusedStackRoute?.params as
        | { channelId?: string; groupId?: string }
        | undefined;
      const params = route.params as
        | { channelId?: string; groupId?: string }
        | undefined;
      return route.name === 'GroupChannels'
        ? params?.groupId === focusedParams?.groupId
        : params?.channelId === focusedParams?.channelId;
    },
    [focusedStackRoute]
  );

  /**
   * Open a channel: a chat row's own, or one chosen out of the workspace
   * unfurled above it.
   *
   * A channel's route is known without a read, so its swap lands in this same
   * tick — nothing can move underneath it — and the close follows it.
   */
  const openChannel = useCallback(
    (channel: db.Channel, source: 'drawer' | 'drawer_workspace' = 'drawer') => {
      if (chatsLocked) {
        return;
      }
      // Supersede anything still resolving its route, the same as any other
      // way of leaving the panel.
      navigationRequestRef.current += 1;
      logger.trackEvent(AnalyticsEvent.ActionTappedChat, {
        ...logic.getModelAnalytics({ channel }),
        source,
      });
      const stackState = state.routes[state.index]?.state;
      const sectionRoute = getStandingTopLevelTabRoute(stackState, 'ChatList');
      const channelRoute = buildDrawerChannelRoute(channel);
      if (!showsFocusedRoute(channelRoute)) {
        reset([sectionRoute, channelRoute]);
      }
      navigation.closeDrawer();
    },
    [chatsLocked, navigation, reset, showsFocusedRoute, state]
  );

  const openWorkspaceChannel = useCallback(
    (channel: db.Channel) => openChannel(channel, 'drawer_workspace'),
    [openChannel]
  );

  const openChat = useCallback(
    (chat: db.Chat) => {
      if (chatsLocked) {
        return;
      }
      if (chat.type === 'channel') {
        openChannel(chat.channel);
        return;
      }
      const request = ++navigationRequestRef.current;
      if (chat.isPending) {
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
        ...logic.getModelAnalytics({ group: chat.group }),
        source: 'drawer',
      });
      // The sections are left exactly as they stand. A chat picked here is not
      // a position inside any of them — the row below marks itself — and a
      // section named underneath it would be one the user never chose. It also
      // showed: the stack animates the outgoing screen away before the
      // incoming one arrives, so a workspace list switched to in this same
      // dispatch got a moment on screen, still half-drawn, between the chat
      // being left and the chat being opened.
      //
      // Still one dispatch for the two together, and still the `MainTabs`
      // already standing rather than a fresh one, so nothing below remounts
      // and every section keeps what it was holding.
      // Resetting to what is already showing would replace that route with a
      // newly keyed one, remounting the conversation and throwing away the
      // scroll position of whoever is reading it — so a row for where we
      // already are only closes the drawer.
      getMainGroupRoute(chat.group.id, true)
        .then((groupRoute) => {
          // The generation covers anything chosen from this panel. It cannot
          // see the app itself: whoever is on the screen behind the panel may
          // have gone somewhere before this read came back, so the stack has
          // to be where this left it too.
          const liveState = navigation.getState() as unknown as {
            index: number;
            routes: ReadonlyArray<RouteSnapshot>;
          };
          const liveStack = liveState.routes[liveState.index]?.state;
          const liveFocused = liveStack?.routes?.[liveStack.index ?? 0];
          if (
            navigationRequestRef.current !== request ||
            liveFocused?.key !== focusedStackRoute?.key ||
            showsFocusedRoute(groupRoute)
          ) {
            return;
          }
          // Read after the wait, not before it. The sections are carried
          // through this reset whole, so a snapshot taken before the group
          // was read would put back the tab that was showing then — and the
          // check above cannot notice, because a tab change inside
          // `MainTabs` leaves the route it looks at with the same key. The
          // cold-start claim of the bot section is one such change, and
          // undoing it would also spend its one shot.
          reset([
            getStandingTopLevelTabRoute(liveStack, 'ChatList'),
            groupRoute,
          ]);
        })
        .catch((err) => {
          logger.trackError('Failed to open chat from drawer', err);
        })
        // Closing waits for the swap, and closing at all does not wait for
        // it to have succeeded. The panel covers the screen the swap happens
        // on, so closing first plays it in the open: the panel slides away
        // onto the chat being left, and only then does the new one push in
        // over it. Closing after, the panel slides away onto the chat asked
        // for, already there.
        //
        // Only the request still current closes, for the same reason only it
        // navigates. A superseded one has had its closing done for it by
        // whatever superseded it, and closing again could shut a panel the
        // user has since reopened.
        .finally(() => {
          if (navigationRequestRef.current === request) {
            navigation.closeDrawer();
          }
        });
    },
    [
      chatsLocked,
      focusedStackRoute,
      navigation,
      openChannel,
      reset,
      showsFocusedRoute,
    ]
  );

  const hasUnread: Partial<Record<TopLevelTabName, boolean>> = {
    Activity: unseenActivityCount > 0,
  };

  // Not gated on the drawer being open: the list is virtualised, so what is
  // mounted is what is on screen, and discarding it on close only made the
  // next open pay to build it again.
  const drawerChats = useMemo(
    () => getDrawerChats(chats, botDm.enabled ? botDm.channelId : undefined),
    [chats, botDm]
  );
  // Which workspaces are showing their channels. Kept here rather than
  // persisted: the panel's content is mounted for as long as the navigator is,
  // so what the user opened is still open the next time they pull it out, and
  // a fresh launch starts from the list itself.
  const [unfurledGroupIds, setUnfurledGroupIds] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const toggleWorkspace = useCallback(
    (chat: db.Chat) => {
      if (chatsLocked) {
        return;
      }
      // Opening a workspace is a request to stay in the panel, so it supersedes
      // anything still resolving its route — a one-channel workspace tapped a
      // moment ago would otherwise come back, reset the stack and close the
      // panel out from under the channels just unfurled.
      navigationRequestRef.current += 1;
      setUnfurledGroupIds((current) => toggleUnfurled(current, chat.id));
    },
    [chatsLocked]
  );

  const rows = useMemo(
    () => getDrawerRows(drawerChats, unfurledGroupIds),
    [drawerChats, unfurledGroupIds]
  );
  const titles = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          row.key,
          row.kind === 'chat'
            ? getChatTitle(row.chat, disableNicknames)
            : getChannelTitle({
                ...configurationFromChannel(row.channel),
                channelTitle: row.channel.title,
                members: row.channel.members,
                disableNicknames,
              }),
        ])
      ),
    [rows, disableNicknames]
  );

  const renderRow = useCallback(
    ({ item }: { item: DrawerRow }) =>
      item.kind === 'chat' ? (
        <DrawerChatRow
          chat={item.chat}
          title={titles.get(item.key) ?? ''}
          selected={routeShowsChat(item.chat, focusedStackRoute)}
          disabled={chatsLocked}
          unfurls={item.unfurls}
          unfurled={item.unfurled}
          onPress={item.unfurls ? toggleWorkspace : openChat}
        />
      ) : (
        <DrawerChannelRow
          channel={item.channel}
          title={titles.get(item.key) ?? ''}
          selected={routeShowsChat(
            { type: 'channel', channel: item.channel },
            focusedStackRoute
          )}
          disabled={chatsLocked}
          groupMuted={item.groupMuted}
          last={item.last}
          onPress={openWorkspaceChannel}
        />
      ),
    [
      chatsLocked,
      focusedStackRoute,
      openChat,
      openWorkspaceChannel,
      titles,
      toggleWorkspace,
    ]
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
        data={rows}
        keyExtractor={(row) => row.key}
        // Two shapes of row in one list, so the recycler is told which is
        // which rather than handing a channel's view to a chat.
        getItemType={(row) => row.kind}
        renderItem={renderRow}
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

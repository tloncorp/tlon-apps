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
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, View, XStack, YStack, getTokenValue, useTheme } from 'tamagui';

import {
  CreateChatSheet,
  type CreateChatSheetMethods,
} from '../features/top/CreateChatSheet';
import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import { useChatSearch } from '../hooks/useChatSearch';
import { useChatSettingsNavigation } from '../hooks/useChatSettingsNavigation';
import {
  ChatOptionsProvider,
  ListItem,
  type TextInputRef,
  getUnreadColors,
  useChatOptions,
} from '../ui';
import { floatingChromeMetrics } from '../ui/components/conversationInsets';
import {
  GlassSurface,
  supportsLiquidGlass,
} from '../ui/components/GlassSurface';
import { useCalm } from '../ui/contexts/appDataContext';
import { getChannelTitle, getChatTitle } from '../ui/utils/channelUtils';
import { DrawerFilterTabs } from './DrawerFilterTabs';
import { DrawerSearchHeader } from './DrawerSearchHeader';
import { DRAWER_CONTROL_SHADOW } from './drawerControlShadow';
import {
  DRAWER_FILTER_LABELS,
  type DrawerFilter,
  type DrawerListRow,
  getDrawerChats,
  getDrawerSearchChats,
  getDrawerSearchRows,
  getUnreadDrawerFilters,
} from './drawerChats';
import { getDrawerChannelIcon, getDrawerChatIcon } from './drawerRowIcons';
import {
  channelRecency,
  channelRowHasUnread,
  chatRowHasUnread,
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

// One line of text apiece, and there are many of them, so the list stays
// scannable rather than becoming a stack of slabs.
const CHAT_ROW_MIN_HEIGHT = 40;
// The gap between everything a row lines up left to right.
const ROW_GAP = '$m' as const;
// The caret's column, held open on every chat row whether or not that row has
// one. A workspace that unfurls and a direct message that cannot are the same
// kind of destination, and letting the caret push one of them along would
// leave the glyphs beside them zig-zagging down the panel.
const CARET_SLOT = 14;
// The glyph that says what a row is, and the gap between it and the caret's
// column. Tighter than the gap before the name: the caret and the glyph
// together read as one mark on the row rather than as two columns.
const ROW_ICON_SIZE = 16;
const ROW_ICON_GAP = '$xs' as const;
// A channel of an unfurled workspace starts its glyph where the workspace
// above it starts its name, which is what makes the block read as nested.
// Computed rather than written down so it follows the pieces it clears.
const CHANNEL_INDENT =
  CARET_SLOT +
  getTokenValue(ROW_ICON_GAP, 'space') +
  ROW_ICON_SIZE +
  getTokenValue(ROW_GAP, 'space');
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
// a row's caret, its glyph, the bot's pill — starts at their sum.
const PANEL_INSET = '$l' as const;
const CONTENT_INSET = '$l' as const;
// The footer's controls are the composer's controls: the settings button is
// the `+` button in another place, so it takes the same size and radius from
// the same source rather than a matching pair of numbers here.
const FOOTER_CONTROL_SIZE = floatingChromeMetrics.controlSize;
const FOOTER_CONTROL_RADIUS = floatingChromeMetrics.controlRadius;

// What the footer's primary control is called. The bot's conversation can be
// renamed — `getDefaultBotName` turns a nickname into "<name>'s Tlonbot 🌱" —
// but a pill at the foot of the panel has room for the product's name and not
// for anybody's variation on it.
const BOT_BUTTON_LABEL = 'Tlonbot';

// The footer controls are Liquid Glass on an OS that has it, and the drawer's
// own flat surfaces everywhere else.
const usesIOSGlass = supportsLiquidGlass();

const DrawerChatRow = React.memo(function DrawerChatRowComponent({
  chat,
  title,
  selected,
  disabled,
  unfurls,
  unfurled,
  onPress,
  onLongPress,
}: {
  chat: db.Chat;
  title: string;
  selected: boolean;
  disabled: boolean;
  /** Whether pressing this row opens its channels below it. */
  unfurls: boolean;
  unfurled: boolean;
  onPress: (chat: db.Chat) => void;
  /** Held down: the chat's own options, or nothing for a row that has none. */
  onLongPress?: (chat: db.Chat) => void;
}) {
  const handlePress = useCallback(() => onPress(chat), [chat, onPress]);
  const handleLongPress = useCallback(
    () => onLongPress?.(chat),
    [chat, onLongPress]
  );
  const notified =
    chat.type === 'group'
      ? (chat.group.unread?.notify ?? false)
      : (chat.channel.unread?.notify ?? false);
  const hasUnread = chatRowHasUnread(chat);
  // The same accent/grey split the workspace list's count badge makes, in the
  // form this row has room for: the dot is the badge with the number taken
  // out, so it reads the colours from the same place rather than picking its
  // own.
  const unreadColor = getUnreadColors(notified).foreground;

  return (
    <Pressable
      onPress={disabled ? undefined : handlePress}
      onLongPress={disabled || !onLongPress ? undefined : handleLongPress}
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
      <XStack alignItems="center" gap={ROW_GAP}>
        <XStack alignItems="center" gap={ROW_ICON_GAP}>
          {/* The column is held open on every row; only a workspace with
              channels to choose between draws anything in it. */}
          <View width={CARET_SLOT} alignItems="center">
            {unfurls ? (
              <Icon
                type={unfurled ? 'ChevronDown' : 'ChevronRight'}
                customSize={[CARET_SLOT, CARET_SLOT]}
                color="$tertiaryText"
              />
            ) : null}
          </View>
          {/* Frame sized to the glyph: the default leaves 4pt of padding
              inside it, which would set every icon in from its column. */}
          <Icon
            type={getDrawerChatIcon(chat)}
            customSize={[ROW_ICON_SIZE, ROW_ICON_SIZE]}
            color="$tertiaryText"
          />
        </XStack>
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
      <XStack alignItems="center" gap={ROW_GAP} paddingLeft={CHANNEL_INDENT}>
        <Icon
          type={getDrawerChannelIcon(channel)}
          customSize={[ROW_ICON_SIZE, ROW_ICON_SIZE]}
          color="$tertiaryText"
        />
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
 * The name of the tab a run of search results would have been found under.
 *
 * On the same column as the rows' own content, and in the grey their times
 * are in: it labels them, and should not read as one of them.
 */
function DrawerSearchHeading({ filter }: { filter: DrawerFilter }) {
  return (
    <Text
      size="$label/s"
      color="$tertiaryText"
      accessibilityRole="header"
      paddingHorizontal={CONTENT_INSET}
      paddingTop="$l"
      paddingBottom="$xs"
    >
      {DRAWER_FILTER_LABELS[filter]}
    </Text>
  );
}

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
  const accessibilityLabel = hasUnread
    ? `${BOT_BUTTON_LABEL}, unread`
    : BOT_BUTTON_LABEL;

  if (!usesIOSGlass) {
    return (
      <Button
        preset="primary"
        label={BOT_BUTTON_LABEL}
        leadingIcon={TOP_LEVEL_TABS.BotChat.icon}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        testID="TopLevelDrawerChatButton"
        {...DRAWER_CONTROL_SHADOW}
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
      {...DRAWER_CONTROL_SHADOW}
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
          {BOT_BUTTON_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * One place in the footer's bubble.
 *
 * Sized and shaped like the control the bubble grew out of, so two of them
 * side by side fill it exactly and a press lands on a circle inside it rather
 * than squaring off one of its ends.
 */
function BubbleSlot({
  icon,
  label,
  selected,
  disabled,
  hasUnread,
  testID,
  onPress,
}: {
  icon: IconType;
  label: string;
  selected: boolean;
  disabled: boolean;
  hasUnread: boolean;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      // The dot is decorative, so the unread state has to reach a screen
      // reader through the label itself.
      accessibilityLabel={hasUnread ? `${label}, unread` : label}
      accessibilityState={{ disabled, selected }}
      testID={testID}
      width={FOOTER_CONTROL_SIZE}
      height={FOOTER_CONTROL_SIZE}
      borderRadius={FOOTER_CONTROL_RADIUS}
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.4 : 1}
      // Under glass these carry no selected state at all: the bubble is the
      // composer's `+` in another place and reads the same way, and the `+`
      // has none. Off glass the fill is the only thing they would have.
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
      <Icon type={icon} color="$primaryText" />
      {hasUnread ? (
        // Tucked against the glyph's own top-right rather than the slot's, so
        // it reads as belonging to the bell and not to the bubble — Activity
        // sits on the inside end, where a corner badge would float in the
        // middle of the control.
        <Circle
          size="$s"
          backgroundColor={getUnreadColors(true).foreground}
          position="absolute"
          top={10}
          right={9}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * The two destinations the panel keeps out of its list, in one bubble at the
 * foot of it: what has happened, and everything else.
 *
 * Activity used to be a row at the top. It is not a chat, and a list that is
 * nothing but chats reads faster without one thing in it that is not — so it
 * joined the control that already held the other such destination.
 */
function DrawerUtilityBubble({
  flexShrink,
  createLabel,
  createDisabled,
  activitySelected,
  activityHasUnread,
  activityDisabled,
  settingsSelected,
  settingsDisabled,
  onPressCreate,
  onPressActivity,
  onPressSettings,
}: {
  flexShrink?: number;
  /** What this tab's `+` makes, which is the only thing that says so. */
  createLabel: string;
  createDisabled: boolean;
  activitySelected: boolean;
  activityHasUnread: boolean;
  activityDisabled: boolean;
  settingsSelected: boolean;
  settingsDisabled: boolean;
  onPressCreate: () => void;
  onPressActivity: () => void;
  onPressSettings: () => void;
}) {
  const slots = (
    <XStack alignItems="center">
      {/* Leading, so the one control that makes something sits apart from the
          two that go somewhere. It carries no selected state because it is
          not a place: nothing it opens is a section this panel can be
          standing in. */}
      <BubbleSlot
        icon="Add"
        label={createLabel}
        selected={false}
        disabled={createDisabled}
        hasUnread={false}
        testID="TopLevelDrawerCreate"
        onPress={onPressCreate}
      />
      <BubbleSlot
        icon={TOP_LEVEL_TABS.Activity.icon}
        label={TOP_LEVEL_TABS.Activity.title}
        selected={activitySelected}
        disabled={activityDisabled}
        hasUnread={activityHasUnread}
        testID="TopLevelDrawerSection-Activity"
        onPress={onPressActivity}
      />
      <BubbleSlot
        icon={TOP_LEVEL_TABS.Settings.icon}
        label={TOP_LEVEL_TABS.Settings.title}
        selected={settingsSelected}
        disabled={settingsDisabled}
        hasUnread={false}
        testID="TopLevelDrawerSection-Settings"
        onPress={onPressSettings}
      />
    </XStack>
  );

  if (!usesIOSGlass) {
    return (
      <View
        flexShrink={flexShrink}
        borderRadius={FOOTER_CONTROL_RADIUS}
        {...DRAWER_CONTROL_SHADOW}
      >
        {slots}
      </View>
    );
  }

  return (
    <View
      flexShrink={flexShrink}
      borderRadius={FOOTER_CONTROL_RADIUS}
      {...DRAWER_CONTROL_SHADOW}
    >
      <GlassSurface isInteractive style={footerStyles.utilityBubble}>
        {slots}
      </GlassSurface>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  chatPill: {
    borderRadius: FOOTER_CONTROL_RADIUS,
    overflow: 'hidden',
  },
  utilityBubble: {
    // As wide as the controls it holds, so the glass is exactly them.
    width: FOOTER_CONTROL_SIZE * 3,
    height: FOOTER_CONTROL_SIZE,
    borderRadius: FOOTER_CONTROL_RADIUS,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
});

/**
 * The drawer panel: two tabs at the top with a search beside them, the chats
 * they cut between below them, and pinned to the bottom the three destinations
 * that are not chats — the bot's own conversation, Activity and Settings.
 *
 * The drawer hosts the root stack rather than the sections themselves, so
 * nothing here is one of its own routes. Each target dispatches the same route
 * helper every other caller uses, which the stack below picks up.
 */
function DrawerPanel(props: DrawerContentComponentProps) {
  const { state, navigation } = props;
  const insets = useSafeAreaInsets();
  const botDm = useBotDmTab();
  const { disableNicknames } = useCalm();
  const reset = useTypedReset();
  // What each footer control marks: the bot's conversation is the one chat the
  // list does not carry, and it marks its own pill, so one message from it
  // never lights both that pill and the bubble's Activity slot.
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
  // The search field, which a closing panel leaves open but lets go of: the
  // navigator only puts the keyboard away when a swipe starts, so a row that
  // navigates and closes the panel would otherwise leave it up over the
  // conversation it opened.
  const searchInputRef = useRef<TextInputRef>(null);
  // Held here for the same reason the tab is: the panel's content is mounted
  // for as long as the navigator is, so a search the user left to go and look
  // at one of its results is still there when they pull the panel back out.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // A chat reached through the search is told apart from one picked off the
  // list, as the workspace list's own filter tells its taps apart.
  const chatSource = searchQuery.trim() ? 'drawer_search' : 'drawer';
  useEffect(() => {
    if (!drawerOpen) {
      navigationRequestRef.current += 1;
      searchInputRef.current?.blur();
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
    (
      channel: db.Channel,
      source: 'drawer' | 'drawer_search' | 'drawer_workspace'
    ) => {
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
        openChannel(chat.channel, chatSource);
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
        source: chatSource,
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
      chatSource,
      chatsLocked,
      focusedStackRoute,
      navigation,
      openChannel,
      reset,
      showsFocusedRoute,
    ]
  );

  // Which half of the list is showing. Held here rather than persisted, for
  // the same reason the unfurled workspace is: the panel's content is mounted
  // for as long as the navigator is, so the tab the user last chose is still
  // chosen the next time they pull the panel out, and a fresh launch starts on
  // Workspaces.
  const [filter, setFilter] = useState<DrawerFilter>('workspaces');
  const listRef = useRef<FlashListRef<DrawerListRow>>(null);
  const selectFilter = useCallback((next: DrawerFilter) => {
    // Changing tabs is a request to stay in the panel, the same as unfurling a
    // workspace, so it supersedes anything still resolving its route. A
    // one-channel workspace tapped a moment ago is still reading its group,
    // and nothing else here would stop it: the app behind the panel has not
    // moved, so its own staleness checks pass and it would reset the stack and
    // close the panel out from under the tab just chosen.
    navigationRequestRef.current += 1;
    setFilter(next);
    // One list serves both tabs, so a tab change is a change of `data` on a
    // list that is still mounted and still holding the offset the other half
    // was scrolled to. Left alone, switching from far down a long Workspaces
    // list opens Messages partway through its conversations — or, when the
    // other half is shorter, at its tail with the newest rows above the fold.
    // Sent before the render that swaps the data, which is safe only because
    // the target is the top: an offset of zero is the same offset whichever
    // half the list is still measuring.
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // Opening the search is a request to stay in the panel, so it supersedes
  // anything still resolving its route, as changing tabs does.
  const openSearch = useCallback(() => {
    if (chatsLocked) {
      return;
    }
    navigationRequestRef.current += 1;
    setSearchOpen(true);
  }, [chatsLocked]);
  // Each query is a new list, and it starts at its top for the reason a tab
  // change does: the list is still holding whatever offset the last one was
  // scrolled to.
  const changeSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);
  const closeSearch = useCallback(() => {
    navigationRequestRef.current += 1;
    searchInputRef.current?.blur();
    setSearchQuery('');
    setSearchOpen(false);
  }, []);

  // Not gated on the drawer being open: the list is virtualised, so what is
  // mounted is what is on screen, and discarding it on close only made the
  // next open pay to build it again.
  const drawerChats = useMemo(
    () =>
      getDrawerChats(
        chats,
        filter,
        botDm.enabled ? botDm.channelId : undefined
      ),
    [chats, filter, botDm]
  );
  // Gated on the field, unlike the list: the search indexes every chat it is
  // handed, and the chat list changes with every unread that arrives, so an
  // index kept for a search nobody has opened is rebuilt for nothing.
  const searchChats = useMemo(
    () =>
      searchOpen
        ? getDrawerSearchChats(
            chats,
            botDm.enabled ? botDm.channelId : undefined
          )
        : [],
    [chats, botDm, searchOpen]
  );
  // The workspace list's own filter, so a name found there is found here.
  // Undebounced: the panel holds one user's chats, and a result that trails
  // the typing reads as the search not having heard it.
  const { isSearching, results: searchResults } = useChatSearch({
    chats: searchChats,
    searchQuery,
    debounceMs: 0,
    disableNicknames,
  });
  // Read across the whole list rather than the half being shown, so the tab
  // that is not showing can say it has something in it.
  const unreadFilters = useMemo(
    () =>
      getUnreadDrawerFilters(
        chats,
        botDm.enabled ? botDm.channelId : undefined
      ),
    [chats, botDm]
  );
  // Which workspace is showing its channels, if any. Kept here rather than
  // persisted: the panel's content is mounted for as long as the navigator is,
  // so what the user opened is still open the next time they pull it out, and
  // a fresh launch starts from the list itself.
  const [unfurledGroupId, setUnfurledGroupId] = useState<string | null>(null);
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
      setUnfurledGroupId((current) => toggleUnfurled(current, chat.id));
    },
    [chatsLocked]
  );

  // Held down, a chat row offers what the workspace list offers for the same
  // chat — the sheet below is that list's own.
  const { open: openChatOptions } = useChatOptions();
  const openOptions = useCallback(
    (chat: db.Chat) => {
      if (chatsLocked) {
        return;
      }
      // A request to stay in the panel, so it supersedes anything still
      // resolving a route, the same as unfurling a workspace or changing tabs.
      // A one-channel workspace tapped a moment ago is still reading its
      // group, and nothing else here would stop it: the app behind the panel
      // has not moved, so its staleness checks pass and it would reset the
      // stack and close the panel out from under the sheet just opened.
      navigationRequestRef.current += 1;
      // The sheet comes up from the bottom, where the keyboard is, and one
      // left up over a sheet traps the touches meant for it (TLON-6187).
      searchInputRef.current?.blur();
      openChatOptions(chat.id, chat.type);
    },
    [chatsLocked, openChatOptions]
  );

  // A field opened but not yet typed into leaves the tab's own list showing:
  // nothing has been asked of it yet, and swapping the list out under the
  // user's finger for one they did not ask for would only move what they were
  // about to press.
  const rows = useMemo<DrawerListRow[]>(
    () =>
      isSearching
        ? getDrawerSearchRows(searchResults, unfurledGroupId)
        : getDrawerRows(drawerChats, unfurledGroupId),
    [drawerChats, isSearching, searchResults, unfurledGroupId]
  );
  const titles = useMemo(
    () =>
      new Map(
        rows.flatMap((row): [string, string][] =>
          row.kind === 'heading'
            ? []
            : [
                [
                  row.key,
                  row.kind === 'chat'
                    ? getChatTitle(row.chat, disableNicknames)
                    : getChannelTitle({
                        ...configurationFromChannel(row.channel),
                        channelTitle: row.channel.title,
                        members: row.channel.members,
                        disableNicknames,
                      }),
                ],
              ]
        )
      ),
    [rows, disableNicknames]
  );

  const renderRow = useCallback(
    ({ item }: { item: DrawerListRow }) =>
      item.kind === 'heading' ? (
        <DrawerSearchHeading filter={item.filter} />
      ) : item.kind === 'chat' ? (
        <DrawerChatRow
          chat={item.chat}
          title={titles.get(item.key) ?? ''}
          selected={routeShowsChat(item.chat, focusedStackRoute)}
          disabled={chatsLocked}
          unfurls={item.unfurls}
          unfurled={item.unfurled}
          onPress={item.unfurls ? toggleWorkspace : openChat}
          // An invite has nothing to offer yet: it is not joined, so none of
          // the sheet's actions apply to it — the same row the workspace list
          // withholds the sheet from. Withheld rather than ignored, so holding
          // one down still reaches its preview the way tapping it does.
          onLongPress={item.chat.isPending ? undefined : openOptions}
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
      openOptions,
      openWorkspaceChannel,
      titles,
      toggleWorkspace,
    ]
  );

  // The footer floats over the list so the chats pass under the glass — that
  // is what gives it something to refract. Its height is measured rather than
  // computed: the non-glass `Chat` button is a different height from the glass
  // pill, and the list has to reserve whatever is actually there.
  const [footerHeight, setFooterHeight] = useState(0);
  const panelInset = getTokenValue(PANEL_INSET, 'space');

  // What the footer's `+` makes follows the tab being shown, because that is
  // the list it would add to. Workspaces opens the menu — a workspace is made
  // with the bot, or without one, and that choice belongs to the sheet.
  // Messages has only one answer, so it skips the menu and opens the contact
  // picker straight away.
  const createChatSheetRef = useRef<CreateChatSheetMethods | null>(null);
  const pressCreate = useCallback(() => {
    if (chatsLocked) {
      return;
    }
    // Supersedes a chat still resolving its route, for the reason every other
    // control that keeps the user in the panel does.
    navigationRequestRef.current += 1;
    // Out of the sheet's way, as for the chat options above.
    searchInputRef.current?.blur();
    createChatSheetRef.current?.open(filter === 'messages' ? 'dm' : undefined);
  }, [chatsLocked, filter]);
  // The sheet covers the panel, so the panel stays put while it is up; the
  // chat it makes is navigated to underneath, which is when to get out of the
  // way. A sheet dismissed without making anything leaves the panel as it was.
  const closeForCreatedChat = useCallback(() => {
    navigation.closeDrawer();
  }, [navigation]);

  const settingsDisabled = isTabPressBlockedByOnboardingLock(
    onboardingLock.locked,
    'Settings'
  );
  const activityDisabled = isTabPressBlockedByOnboardingLock(
    onboardingLock.locked,
    'Activity'
  );

  return (
    <YStack
      flex={1}
      paddingTop={insets.top + getTokenValue('$m', 'space')}
      paddingLeft={insets.left + panelInset}
      paddingRight={insets.right + panelInset}
    >
      {/* Above the list rather than inside it as a header: the tabs are what
          says which list this is, and the field what it has been narrowed
          to, so they have to stay on screen while it is scrolled. */}
      <YStack paddingBottom="$m">
        <DrawerSearchHeader
          ref={searchInputRef}
          open={searchOpen}
          query={searchQuery}
          disabled={chatsLocked}
          onOpen={openSearch}
          onChangeQuery={changeSearchQuery}
          onClose={closeSearch}
        >
          <DrawerFilterTabs
            activeFilter={filter}
            unreadFilters={unreadFilters}
            onPressFilter={selectFilter}
          />
        </DrawerSearchHeader>
      </YStack>
      <FlashList
        ref={listRef}
        // Results are a list of their own rather than new data for the tab's.
        // The list holds the row at the top of what it is showing in place
        // across a change of data, and results share rows with the tab: a
        // chat found a row below the Workspaces heading came back, when the
        // search closed, a row below the top of the tab's list with a blank
        // band above it. A list mounted fresh has no row to hold, and the
        // results, which change with every letter, are told not to hold one.
        key={isSearching ? 'search' : 'chats'}
        maintainVisibleContentPosition={
          isSearching ? { disabled: true } : undefined
        }
        data={rows}
        keyExtractor={(row) => row.key}
        // Three shapes of row in one list, so the recycler is told which is
        // which rather than handing a channel's view to a chat.
        getItemType={(row) => row.kind}
        renderItem={renderRow}
        contentContainerStyle={{ paddingBottom: footerHeight }}
        // A result is pressed with the keyboard still up, and the list's
        // default spends that first press putting the keyboard away.
        keyboardShouldPersistTaps="handled"
        // And the keyboard covers the foot of the panel, so scrolling for a
        // result further down puts it away rather than scrolling under it.
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          isSearching ? (
            <Text
              size="$label/m"
              color="$tertiaryText"
              paddingHorizontal={CONTENT_INSET}
              paddingTop="$l"
            >
              No results found
            </Text>
          ) : null
        }
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
          // The bubble beside it is three fixed controls wide and the row has
          // to hold both. At the narrowest width the app runs on there are
          // about 11pt to spare, which a larger system font size would spend,
          // so the pill is the piece that gives: it shrinks and its label
          // truncates rather than pushing Activity and Settings off the panel.
          <View flexShrink={1} minWidth={0}>
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
        <DrawerUtilityBubble
          // Fixed: three controls of a size the composer sets, not a share of
          // whatever is left.
          flexShrink={0}
          createLabel={
            filter === 'messages' ? 'New message' : 'Start a conversation'
          }
          createDisabled={chatsLocked}
          activitySelected={selected === 'Activity'}
          activityHasUnread={unseenActivityCount > 0}
          activityDisabled={activityDisabled}
          settingsSelected={selected === 'Settings'}
          settingsDisabled={settingsDisabled}
          onPressCreate={pressCreate}
          onPressActivity={() => select('Activity')}
          onPressSettings={() => select('Settings')}
        />
      </XStack>
      <CreateChatSheet
        ref={createChatSheetRef}
        onChatCreated={closeForCreatedChat}
      />
    </YStack>
  );
}

/**
 * The panel, and the chat options sheet a row opens when it is held down.
 *
 * The sheet is the workspace list's own — `ChatOptionsProvider` supplies its
 * actions and renders it — so a workspace or a conversation offers here
 * exactly what it offers there. The provider is mounted rather than reused:
 * every other one sits on a screen of the root stack, and this panel is above
 * that stack, not inside it.
 *
 * Its actions navigate, and the panel is covering what they navigate to, so
 * each one closes the panel on its way out. They dispatch through the drawer's
 * own navigation object, which the routers carry down into the stack it hosts
 * — the same path the rows' destinations take.
 */
export function TopLevelDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const settingsNavigation = useChatSettingsNavigation();
  const closingSettingsNavigation = useMemo(() => {
    const entries = Object.entries(settingsNavigation) as [
      keyof typeof settingsNavigation,
      (...args: never[]) => unknown,
    ][];
    return Object.fromEntries(
      entries.map(([name, handler]) => [
        name,
        (...args: never[]) => {
          navigation.closeDrawer();
          return handler(...args);
        },
      ])
    ) as typeof settingsNavigation;
  }, [navigation, settingsNavigation]);

  return (
    <ChatOptionsProvider {...closingSettingsNavigation}>
      <DrawerPanel {...props} />
    </ChatOptionsProvider>
  );
}

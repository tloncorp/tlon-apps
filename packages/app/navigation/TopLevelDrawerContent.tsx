import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import * as store from '@tloncorp/shared/store';
import { Icon, IconType, Pressable, Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Circle, XStack, YStack } from 'tamagui';

import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { useBotDmTab } from '../hooks/useBotDmTab';
import {
  TOP_LEVEL_TABS,
  TopLevelTabName,
  getActiveTopLevelTab,
  getInitialTopLevelTab,
  getTopLevelTabNavigateAction,
  isTabPressBlockedByOnboardingLock,
  trackTopLevelTabSelection,
} from './topLevelTabs';

// The same touch target the bar's icons kept: iOS HIG 44pt, Material 48dp.
const SECTION_ROW_MIN_HEIGHT = 48;

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

/**
 * The drawer panel: one row per top-level section.
 *
 * The drawer hosts the root stack rather than the sections themselves, so the
 * rows are not its own routes. They come from `TOP_LEVEL_TABS`, minus the Bot
 * row while the hosted-bot flag withholds that screen — the way the bar this
 * replaces left that icon out — and each one dispatches the same route helper
 * every other caller uses, which the stack below picks up.
 */
export function TopLevelDrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation } = props;
  const botDm = useBotDmTab();
  // What each row marks: the bot DM marks its own section, so one message
  // never lights both it and Activity.
  const botDmHasUnread = store.useChannelHasUnread(
    botDm.enabled ? botDm.channelId : undefined
  );
  const unseenActivityCount = store.useUnreadUnseenActivityCount({
    excludeChannelId: botDm.enabled ? botDm.channelId : undefined,
  });
  const onboardingLock = useAnyAgentGroupOnboardingLock();
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
      // the section already showing.
      if (section !== selected) {
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

  const hasUnread: Partial<Record<TopLevelTabName, boolean>> = {
    BotChat: botDmHasUnread,
    Activity: unseenActivityCount > 0,
  };

  const sections = (Object.keys(TOP_LEVEL_TABS) as TopLevelTabName[]).filter(
    (section) => section !== 'BotChat' || botDm.enabled
  );

  return (
    <DrawerContentScrollView {...props}>
      <YStack gap="$xs">
        {sections.map((section) => (
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
    </DrawerContentScrollView>
  );
}

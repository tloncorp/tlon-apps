import { Circle, XStack } from 'tamagui';

import { Tabs, getUnreadColors } from '../ui';
import {
  DRAWER_FILTERS,
  DRAWER_FILTER_LABELS,
  type DrawerFilter,
  type DrawerFilterUnreads,
} from './drawerChats';

/**
 * The panel's two tabs.
 *
 * The same underlined `Tabs` the workspace list filters with, so the panel and
 * the screen behind it read as one vocabulary rather than two controls that
 * happen to say similar words.
 *
 * A tab that is not the one showing says so when its half of the list holds
 * an unread, the way a row does: its title in bold, and a dot beside it in the
 * accent when one of those unreads notified, grey when none did. The half
 * being shown does not need either — its rows are saying it themselves — and
 * a dot there would only repeat them.
 */
export function DrawerFilterTabs({
  activeFilter,
  unreads,
  onPressFilter,
}: {
  activeFilter: DrawerFilter;
  /** What each tab's half is holding, shown or not. */
  unreads: DrawerFilterUnreads;
  onPressFilter: (filter: DrawerFilter) => void;
}) {
  return (
    <Tabs>
      {DRAWER_FILTERS.map((filter) => {
        const active = activeFilter === filter;
        const unread = active ? undefined : unreads[filter];
        const notified = unread === 'notified';
        return (
          <Tabs.Tab
            key={filter}
            name={filter}
            activeTab={activeFilter}
            onTabPress={onPressFilter}
            testID={`TopLevelDrawerFilter-${filter}`}
            accessibilityLabel={
              unread
                ? `${DRAWER_FILTER_LABELS[filter]}, ${notified ? 'unread, notified' : 'unread'}`
                : DRAWER_FILTER_LABELS[filter]
            }
          >
            <XStack alignItems="center" gap="$s">
              <Tabs.Title
                cursor="pointer"
                active={active}
                // The weight a row with an unread takes.
                fontWeight={unread ? '600' : undefined}
              >
                {DRAWER_FILTER_LABELS[filter]}
              </Tabs.Title>
              {unread ? (
                // The dot is decorative; a screen reader is told in the tab's
                // own label instead, since the tab is what it belongs to.
                <Circle
                  size="$s"
                  backgroundColor={getUnreadColors(notified).foreground}
                />
              ) : null}
            </XStack>
          </Tabs.Tab>
        );
      })}
    </Tabs>
  );
}

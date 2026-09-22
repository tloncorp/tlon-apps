import { Circle, XStack } from 'tamagui';

import { Tabs, getUnreadColors } from '../ui';
import {
  DRAWER_FILTERS,
  DRAWER_FILTER_LABELS,
  type DrawerFilter,
} from './drawerChats';

/**
 * The panel's two tabs.
 *
 * The same underlined `Tabs` the workspace list filters with, so the panel and
 * the screen behind it read as one vocabulary rather than two controls that
 * happen to say similar words.
 *
 * A tab that is not the one showing carries a dot when its half of the list
 * holds an unread. The half being shown does not need one — its rows are
 * saying it themselves — and a dot there would only repeat them.
 */
export function DrawerFilterTabs({
  activeFilter,
  unreadFilters,
  onPressFilter,
}: {
  activeFilter: DrawerFilter;
  /** The tabs holding an unread, shown or not. */
  unreadFilters: readonly DrawerFilter[];
  onPressFilter: (filter: DrawerFilter) => void;
}) {
  return (
    <Tabs>
      {DRAWER_FILTERS.map((filter) => {
        const active = activeFilter === filter;
        const showsUnread = !active && unreadFilters.includes(filter);
        return (
          <Tabs.Tab
            key={filter}
            name={filter}
            activeTab={activeFilter}
            onTabPress={onPressFilter}
            testID={`TopLevelDrawerFilter-${filter}`}
            accessibilityLabel={
              showsUnread
                ? `${DRAWER_FILTER_LABELS[filter]}, unread`
                : DRAWER_FILTER_LABELS[filter]
            }
          >
            <XStack alignItems="center" gap="$s">
              <Tabs.Title cursor="pointer" active={active}>
                {DRAWER_FILTER_LABELS[filter]}
              </Tabs.Title>
              {showsUnread ? (
                // The dot is decorative; a screen reader is told in the tab's
                // own label instead, since the tab is what it belongs to.
                <Circle
                  size="$s"
                  backgroundColor={getUnreadColors(false).foreground}
                />
              ) : null}
            </XStack>
          </Tabs.Tab>
        );
      })}
    </Tabs>
  );
}

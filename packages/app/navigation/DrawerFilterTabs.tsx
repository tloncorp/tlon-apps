import { Tabs } from '../ui';
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
 */
export function DrawerFilterTabs({
  activeFilter,
  onPressFilter,
}: {
  activeFilter: DrawerFilter;
  onPressFilter: (filter: DrawerFilter) => void;
}) {
  return (
    <Tabs>
      {DRAWER_FILTERS.map((filter) => (
        <Tabs.Tab
          key={filter}
          name={filter}
          activeTab={activeFilter}
          onTabPress={onPressFilter}
          testID={`TopLevelDrawerFilter-${filter}`}
        >
          <Tabs.Title cursor="pointer" active={activeFilter === filter}>
            {DRAWER_FILTER_LABELS[filter]}
          </Tabs.Title>
        </Tabs.Tab>
      ))}
    </Tabs>
  );
}

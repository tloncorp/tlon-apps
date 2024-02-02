import {TabBar} from '@components/TabBar';
import * as db from '@db';
import {Stack} from '@ochre';
import {
  BottomTabBarProps,
  BottomTabScreenProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {NavigationState} from '@react-navigation/native';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {TabEditorSheet} from '../TabEditorSheet';
import {StreamScreen} from './StreamScreen';

type TabParamList = {
  Empty: {};
  List: {
    settingsId: string;
    settingsIndex: number;
  };
};

type TabScreenProps<K extends keyof TabParamList = any> = BottomTabScreenProps<
  TabParamList,
  K
>;

export type TabNavigationState = NavigationState<TabParamList>;
export type TabNavigationRoute = TabNavigationState['routes'][number];
export type ListRoute = TabNavigationState['routes'][];

type TabBarProps = Omit<BottomTabBarProps, 'state'> & {
  state: TabNavigationState;
};

export const TabNavigator = createBottomTabNavigator<TabParamList>();

const DEFAULT_SETTINGS_KEY = 'settings';

interface ConfigurableHomeScreenContext {
  tabGroup: db.TabGroupSettings | null;
  addTab: () => void;
  openTab: (tabIndex: number) => void;
  editTab: (tabIndex: number) => void;
}

const defaultTabs: db.TabSettings[] = [
  {
    icon: {
      type: 'icon',
      value: 'Channel',
      color: '$color',
    },
    query: {
      groupBy: 'group',
    },
  },
  {
    icon: {
      type: 'icon',
      value: 'ChannelTalk',
      color: '$color',
    },
    query: {
      groupBy: 'channel',
    },
  },
];

export const ConfigurableHomeScreenContext =
  createContext<ConfigurableHomeScreenContext>({
    tabGroup: db.TabGroupSettings.default(DEFAULT_SETTINGS_KEY),
    addTab: () => {},
    openTab: () => {},
    editTab: () => {},
  });

export function ConfigurableHomeScreenNavigator() {
  const {addTab, editTab, openTab, tabGroup} = useContext(
    ConfigurableHomeScreenContext,
  );

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => {
      const {state} = props as TabBarProps;
      const activeRoute = state.routes[state.index];
      const activeIndex = isListParams(activeRoute?.params)
        ? activeRoute.params.settingsIndex
        : 0;
      return (
        <TabBar
          activeIndex={activeIndex}
          insets={props.insets}
          onPressAddTab={addTab}
          onPressTab={openTab}
          onLongPressTab={editTab}
          tabGroup={tabGroup}
        />
      );
    },
    [addTab, editTab, openTab, tabGroup],
  );

  const allTabs = [...defaultTabs, ...(tabGroup?.tabs ?? [])];

  return (
    <TabNavigator.Navigator
      tabBar={renderTabBar}
      screenOptions={tabNavigatorScreenOptions}>
      {allTabs.length ? (
        <TabNavigator.Screen
          name="List"
          component={StreamScreen}
          initialParams={{
            settingsId: DEFAULT_SETTINGS_KEY,
            settingsIndex: 0,
          }}
        />
      ) : (
        <TabNavigator.Screen name="Empty" component={EmptyScreen} />
      )}
    </TabNavigator.Navigator>
  );
}

const tabNavigatorScreenOptions = {
  headerTitleStyle: {
    fontWeight: '400',
    fontSize: 17,
  },
} as const;

function isListParams(params: any): params is TabParamList['List'] {
  return params?.settingsId && params?.settingsIndex !== undefined;
}

function EmptyScreen() {
  return null;
}

export const ConfigurableHomeScreen = ({
  navigation,
}: TabScreenProps<'List'>) => {
  const [addingTab, setAddingTab] = useState(false);
  const [editingTab, setEditingTab] = useState<number | null>(null);
  const {createTab, deleteTab, tabGroup} = useTabGroup();

  const contextValue = useMemo(() => {
    return {
      tabGroup,
      addTab: () => {
        setAddingTab(true);
      },
      editTab: (tabIndex: number) => {
        setEditingTab(tabIndex);
      },
      openTab: (tabIndex: number) => {
        navigation.navigate('List', {
          settingsId: DEFAULT_SETTINGS_KEY,
          settingsIndex: tabIndex,
        });
      },
    };
  }, [navigation, tabGroup]);

  const handleSheetClosed = useCallback(() => {
    setAddingTab(false);
    setEditingTab(null);
  }, []);

  const handlePressCancel = useCallback(() => {
    setAddingTab(false);
    setEditingTab(null);
  }, []);

  const handlePressSubmit = useCallback(
    (settings: db.TabSettings) => {
      createTab(settings, editingTab);
      setAddingTab(false);
      setEditingTab(null);
    },
    [createTab, editingTab],
  );

  const handlePressDelete = useCallback(() => {
    setAddingTab(false);
    setEditingTab(null);
    editingTab !== null && deleteTab(editingTab);
  }, [deleteTab, editingTab]);

  const editorTabSettings =
    (editingTab !== null ? tabGroup?.tabs?.[editingTab] : null) ?? null;

  return (
    <ConfigurableHomeScreenContext.Provider value={contextValue}>
      <Stack flex={1}>
        <ConfigurableHomeScreenNavigator />
        <TabEditorSheet
          isOpen={addingTab || editingTab !== null}
          onClose={handleSheetClosed}
          onPressCancel={handlePressCancel}
          onPressSubmit={handlePressSubmit}
          onPressDeleteTab={handlePressDelete}
          tabSettings={editorTabSettings}
        />
      </Stack>
    </ConfigurableHomeScreenContext.Provider>
  );
};

function useTabGroup(groupId = DEFAULT_SETTINGS_KEY) {
  const ops = db.useOps();
  const tabGroup = db.useObject('TabGroupSettings', groupId);

  const createTab = useCallback(
    (settings: db.TabSettings, index: number | null) => {
      ops.createOrUpdateTab({
        groupId: groupId,
        settings,
        settingsIndex: index,
      });
    },
    [ops, groupId],
  );

  const deleteTab = useCallback(
    (index: number) => {
      ops.deleteTab({groupId: groupId, settingsIndex: index});
    },
    [ops, groupId],
  );

  return useMemo(
    () => ({tabGroup, createTab, deleteTab}),
    [tabGroup, createTab, deleteTab],
  );
}

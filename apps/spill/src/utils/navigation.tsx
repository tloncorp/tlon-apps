import * as db from '@db';
import {useHeaderHeight} from '@react-navigation/elements';
import {useNavigation} from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useCallback} from 'react';
import {Dimensions} from 'react-native';

type RootStackParamList = {
  ConfigurableHome: undefined;
  Activity: {
    settingsId: string;
    settingsIndex: number;
  };
  Channel: {
    channelId: string;
    channelTitle: string;
    highlightedPostId?: string | null;
  };
  Group: {
    groupId: string;
    groupTitle: string;
  };
  Feed: {};
};

type FeedStackParamList = {
  Channel: {
    channelId: string;
    channelTitle: string;
    highlightedPostId?: string | null;
  };
  Group: {
    groupId: string;
    groupTitle: string;
  };
  Feed: {};
};

export type NavigationProp<T extends keyof RootStackParamList = any> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type NavigationScreenProps<K extends keyof RootStackParamList = any> =
  NativeStackScreenProps<RootStackParamList, K>;

export const Navigation = createNativeStackNavigator<RootStackParamList>();

export const FeedStack = createNativeStackNavigator<FeedStackParamList>();

// Necessary because of: https://github.com/software-mansion/react-native-screens/issues/1779
export function useScreenHeight() {
  const headerHeight = useHeaderHeight();
  return Dimensions.get('window').height - headerHeight;
}

export function useNavigateToChannel(channel: db.Channel) {
  const navigation = useNavigation<NavigationProp<any>>();
  return useCallback(
    (highlightedPost?: db.Post | null) =>
      navigateToChannel(navigation, channel, highlightedPost),
    [channel, navigation],
  );
}

export const navigateToChannel = (
  navigation: NavigationProp,
  channel: db.Channel,
  highlightedPost?: db.Post | null,
) => {
  navigation.push('Channel', {
    channelId: channel.id,
    channelTitle: channel.title ?? 'Untitled',
    highlightedPostId: highlightedPost?.id ?? null,
  });
};

export const navigateToGroup = (
  navigation: NavigationProp,
  group: db.Group,
) => {
  navigation.push('Group', {
    groupId: group.id,
    groupTitle: group.title ?? 'Untitled',
  });
};

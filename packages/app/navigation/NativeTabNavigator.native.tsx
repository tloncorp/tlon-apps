import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { NativeBottomTabScreenProps } from '@react-navigation/bottom-tabs/unstable';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import {
  ClipOp,
  ImageFormat,
  Skia,
  rect,
  rrect,
  useImage,
} from '@shopify/react-native-skia';
import * as store from '@tloncorp/shared/store';
import { ComponentType, useEffect, useState } from 'react';
import { type ImageSourcePropType, Platform } from 'react-native';
import { useTheme } from 'tamagui';

import { ActivityScreen } from '../features/top/ActivityScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import ContactsScreen from '../features/top/ContactsScreen';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useActiveTheme } from '../provider';
import type { NativeTabParamList } from './types';

const Tabs = createNativeBottomTabNavigator<NativeTabParamList>();

type TabIconName = 'home' | 'activity' | 'profile';

const TAB_AVATAR_SIZE = 20;
const TAB_AVATAR_SCALE = 3;
const TAB_AVATAR_RADIUS = 6;

const tabIcons = {
  home: {
    regular: require('./assets/tab-home.png'),
    selected: require('./assets/tab-home-filled.png'),
  },
  activity: {
    regular: require('./assets/tab-notifications.png'),
    selected: require('./assets/tab-notifications-filled.png'),
  },
  profile: {
    regular: require('./assets/tab-profile.png'),
    selected: require('./assets/tab-profile.png'),
  },
} as const;

function tabIcon(name: TabIconName, focused: boolean) {
  return {
    type: 'image' as const,
    source: focused ? tabIcons[name].selected : tabIcons[name].regular,
  };
}

function avatarTabIcon(source: ImageSourcePropType | undefined) {
  if (!source) {
    return tabIcon('profile', false);
  }

  return {
    type: 'image' as const,
    source,
    tinted: false,
  };
}

function useRoundedAvatarSource(avatarImage: string | null | undefined) {
  const supportedAvatarImage =
    Platform.OS === 'ios' && avatarImage && !avatarImage.endsWith('.svg')
      ? avatarImage
      : null;
  const image = useImage(supportedAvatarImage);
  const [source, setSource] = useState<ImageSourcePropType>();

  useEffect(() => {
    if (!image || !supportedAvatarImage) {
      setSource(undefined);
      return;
    }

    const pixelSize = TAB_AVATAR_SIZE * TAB_AVATAR_SCALE;
    const surface = Skia.Surface.MakeOffscreen(pixelSize, pixelSize);
    if (!surface) {
      setSource(undefined);
      return;
    }

    const canvas = surface.getCanvas();
    const destination = rect(0, 0, pixelSize, pixelSize);
    const sourceSize = Math.min(image.width(), image.height());
    const sourceRect = rect(
      (image.width() - sourceSize) / 2,
      (image.height() - sourceSize) / 2,
      sourceSize,
      sourceSize
    );
    const paint = Skia.Paint();

    canvas.clear(Skia.Color('transparent'));
    canvas.clipRRect(
      rrect(
        destination,
        TAB_AVATAR_RADIUS * TAB_AVATAR_SCALE,
        TAB_AVATAR_RADIUS * TAB_AVATAR_SCALE
      ),
      ClipOp.Intersect,
      true
    );
    canvas.drawImageRectCubic(
      image,
      sourceRect,
      destination,
      1 / 3,
      1 / 3,
      paint
    );
    surface.flush();

    const roundedImage = surface.makeImageSnapshot();
    const base64 = roundedImage.encodeToBase64(ImageFormat.PNG, 100);
    setSource({
      uri: `data:image/png;base64,${base64}`,
      width: TAB_AVATAR_SIZE,
      height: TAB_AVATAR_SIZE,
    });

    paint.dispose();
    roundedImage.dispose();
    surface.dispose();
  }, [image, supportedAvatarImage]);

  return source;
}

// The existing screen components navigate to detail routes in the parent
// native stack. React Navigation bubbles those actions at runtime; the cast
// lets us preserve their existing stack prop types during this first migration.
const ChatListTab = ChatListScreen as unknown as ComponentType<
  NativeBottomTabScreenProps<NativeTabParamList, 'ChatList'>
>;
const ActivityTab = ActivityScreen as unknown as ComponentType<
  NativeBottomTabScreenProps<NativeTabParamList, 'Activity'>
>;
const ContactsTab = ContactsScreen as unknown as ComponentType<
  NativeBottomTabScreenProps<NativeTabParamList, 'Contacts'>
>;

export function NativeTabNavigator() {
  const theme = useTheme();
  const activeTheme = useActiveTheme();
  const currentUserId = useCurrentUserId();
  const { data: currentUser } = store.useContact({ id: currentUserId });
  const roundedAvatarSource = useRoundedAvatarSource(currentUser?.avatarImage);
  const haveUnreadActivity = store.useHaveUnreadUnseenActivity();

  return (
    <ThemeProvider value={activeTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Tabs.Navigator
        initialRouteName="ChatList"
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primaryText?.val,
          tabBarInactiveTintColor: theme.secondaryText?.val,
          tabBarActiveIndicatorColor: theme.secondaryBackground?.val,
          tabBarLabel: Platform.OS === 'ios' ? '' : undefined,
          tabBarLabelVisibilityMode:
            Platform.OS === 'android' ? 'unlabeled' : undefined,
          tabBarControllerMode: Platform.OS === 'ios' ? 'tabBar' : undefined,
          tabBarMinimizeBehavior:
            Platform.OS === 'ios' ? 'onScrollDown' : undefined,
        }}
      >
        <Tabs.Screen
          name="ChatList"
          component={ChatListTab}
          options={{
            title: 'Home',
            headerShown: true,
            headerTitleAlign: 'center',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: theme.background?.val },
            headerTintColor: theme.primaryText?.val,
            headerTitleStyle: {
              color: theme.primaryText?.val,
              fontSize: 17,
              fontWeight: '500',
            },
            tabBarIcon: ({ focused }) => tabIcon('home', focused),
          }}
        />
        <Tabs.Screen
          name="Activity"
          component={ActivityTab}
          options={{
            title: 'Activity',
            tabBarBadge: haveUnreadActivity ? '' : undefined,
            tabBarIcon: ({ focused }) => tabIcon('activity', focused),
          }}
        />
        <Tabs.Screen
          name="Contacts"
          component={ContactsTab}
          options={{
            title: 'Contacts',
            tabBarIcon: ({ focused }) =>
              Platform.OS === 'ios'
                ? avatarTabIcon(roundedAvatarSource)
                : tabIcon('profile', focused),
          }}
        />
      </Tabs.Navigator>
    </ThemeProvider>
  );
}

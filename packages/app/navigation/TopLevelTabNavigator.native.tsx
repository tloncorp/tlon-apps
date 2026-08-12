import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
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
import { makeSigil } from '@tloncorp/ui';
import { toHex } from 'color2k';
import { useEffect, useMemo, useState } from 'react';
import { type ImageSourcePropType, PixelRatio, Platform } from 'react-native';
import { useTheme } from 'tamagui';

import { ActivityScreen } from '../features/top/ActivityScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import ContactsScreen from '../features/top/ContactsScreen';
import { useTopLevelTabController } from '../hooks/useTopLevelTabController';
import ProfileStatusSheet from '../ui/components/ProfileStatusSheet';
import { useIsDarkTheme, useSigilColors } from '../ui/utils/colorUtils';
import { TOP_LEVEL_TABS, trackTopLevelTabSelection } from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createNativeBottomTabNavigator<TopLevelTabParamList>();

type TabIconName = 'home' | 'activity' | 'profile';

const TAB_AVATAR_SIZE = 20;
const TAB_AVATAR_SCALE = PixelRatio.get() * 2;
const TAB_AVATAR_RADIUS = 6;
const TAB_SIGIL_SIZE = 12;

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

function useRoundedAvatarSource({
  avatarImage,
  contactId,
  backgroundColor,
  foregroundColor,
}: {
  avatarImage: string | null | undefined;
  contactId: string;
  backgroundColor: string;
  foregroundColor: string;
}) {
  const supportedAvatarImage =
    Platform.OS === 'ios' && avatarImage && !avatarImage.endsWith('.svg')
      ? avatarImage
      : null;
  const image = useImage(supportedAvatarImage);
  const [source, setSource] = useState<ImageSourcePropType>();

  useEffect(() => {
    if (Platform.OS !== 'ios') {
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

    if (image && supportedAvatarImage) {
      const sourceSize = Math.min(image.width(), image.height());
      const sourceRect = rect(
        (image.width() - sourceSize) / 2,
        (image.height() - sourceSize) / 2,
        sourceSize,
        sourceSize
      );
      const paint = Skia.Paint();
      canvas.drawImageRectCubic(
        image,
        sourceRect,
        destination,
        1 / 3,
        1 / 3,
        paint
      );
      paint.dispose();
    } else {
      canvas.drawColor(Skia.Color(backgroundColor));

      if (contactId.length <= 14) {
        try {
          const sigilPixelSize = TAB_SIGIL_SIZE * TAB_AVATAR_SCALE;
          // Skia's SVG parser doesn't reliably support the hsla() strings
          // returned by the theme color helpers, so use plain hex in the SVG.
          const sigilXml = makeSigil({
            point: contactId,
            detail: 'none',
            size: sigilPixelSize,
            space: 'none',
            foreground: toHex(foregroundColor),
            background: toHex(backgroundColor),
          });
          const sigil = Skia.SVG.MakeFromString(sigilXml);

          if (sigil) {
            try {
              const sigilOffset = (pixelSize - sigilPixelSize) / 2;
              canvas.save();
              try {
                canvas.translate(sigilOffset, sigilOffset);
                canvas.drawSvg(sigil, sigilPixelSize, sigilPixelSize);
              } finally {
                canvas.restore();
              }
            } finally {
              sigil.dispose();
            }
          }
        } catch {
          // A tab icon should never take down navigation. The profile color
          // already painted above remains as a safe fallback.
        }
      }
    }
    surface.flush();

    const roundedImage = surface.makeImageSnapshot();
    const base64 = roundedImage.encodeToBase64(ImageFormat.PNG, 100);
    setSource({
      uri: `data:image/png;base64,${base64}`,
      width: TAB_AVATAR_SIZE,
      height: TAB_AVATAR_SIZE,
      scale: TAB_AVATAR_SCALE,
    });

    roundedImage.dispose();
    surface.dispose();
  }, [
    backgroundColor,
    contactId,
    foregroundColor,
    image,
    supportedAvatarImage,
  ]);

  return source;
}

export function TopLevelTabNavigator() {
  const theme = useTheme();
  const isDarkTheme = useIsDarkTheme();
  const navigationTheme = useMemo(() => {
    const baseTheme = isDarkTheme ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: theme.background?.val ?? baseTheme.colors.background,
        card: theme.background?.val ?? baseTheme.colors.card,
        text: theme.primaryText?.val ?? baseTheme.colors.text,
        border: theme.border?.val ?? baseTheme.colors.border,
        primary: theme.primaryText?.val ?? baseTheme.colors.primary,
      },
    };
  }, [
    isDarkTheme,
    theme.background?.val,
    theme.border?.val,
    theme.primaryText?.val,
  ]);
  const { currentUserId, haveUnreadActivity, statusSheet } =
    useTopLevelTabController();
  const { data: currentUser } = store.useContact({ id: currentUserId });
  const { data: calmSettings } = store.useCalmSettings();
  const sigilColors = useSigilColors(currentUser?.color);
  const roundedAvatarSource = useRoundedAvatarSource({
    avatarImage: calmSettings?.disableAvatars
      ? undefined
      : currentUser?.avatarImage,
    contactId: currentUserId,
    backgroundColor: sigilColors.backgroundColor,
    foregroundColor: sigilColors.foregroundColor,
  });
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Tabs.Navigator
        initialRouteName="ChatList"
        backBehavior="history"
        screenListeners={({ navigation, route }) => ({
          tabPress: () => {
            // Match the web nav bar: track selections, not re-presses of the
            // active tab.
            if (!navigation.isFocused()) {
              trackTopLevelTabSelection(route.name);
            }
          },
          tabLongPress: () => {
            if (route.name === 'Contacts') {
              statusSheet.openSheet();
            }
          },
        })}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primaryText?.val,
          tabBarInactiveTintColor: theme.secondaryText?.val,
          tabBarActiveIndicatorColor: theme.secondaryBackground?.val,
          tabBarLabelVisibilityMode: 'unlabeled',
          tabBarLabel: Platform.OS === 'ios' ? '' : undefined,
          tabBarControllerMode: Platform.OS === 'ios' ? 'tabBar' : undefined,
          tabBarMinimizeBehavior:
            Platform.OS === 'ios' ? 'onScrollDown' : undefined,
        }}
      >
        <Tabs.Screen
          name="ChatList"
          component={ChatListScreen}
          options={{
            title: TOP_LEVEL_TABS.ChatList.title,
            tabBarIcon: ({ focused }) => tabIcon('home', focused),
          }}
        />
        <Tabs.Screen
          name="Activity"
          component={ActivityScreen}
          options={{
            title: TOP_LEVEL_TABS.Activity.title,
            tabBarBadge: haveUnreadActivity ? '' : undefined,
            tabBarIcon: ({ focused }) => tabIcon('activity', focused),
          }}
        />
        <Tabs.Screen
          name="Contacts"
          component={ContactsScreen}
          options={{
            title: TOP_LEVEL_TABS.Contacts.title,
            tabBarIcon: ({ focused }) =>
              Platform.OS === 'ios'
                ? avatarTabIcon(roundedAvatarSource)
                : tabIcon('profile', focused),
          }}
        />
      </Tabs.Navigator>
      {statusSheet.open && (
        <ProfileStatusSheet
          open
          onOpenChange={statusSheet.closeSheet}
          onUpdateStatus={statusSheet.updateStatus}
        />
      )}
    </NavigationThemeProvider>
  );
}

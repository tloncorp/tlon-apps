import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import {
  BlendMode,
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
import { getTokenValue, useTheme } from 'tamagui';

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

const TAB_AVATAR_SIZE = Platform.OS === 'android' ? 20 : 18;
const TAB_ICON_CANVAS_SIZE = Platform.OS === 'android' ? 24 : TAB_AVATAR_SIZE;
const TAB_AVATAR_SCALE = PixelRatio.get() * 2;
const TAB_AVATAR_RADIUS = 4;
const TAB_SIGIL_SIZE = 12;
const TAB_ACTIVITY_ICON_SIZE = 24;
const TAB_ACTIVITY_ICON_HEIGHT = 30;
const TAB_ACTIVITY_DOT_X = TAB_ACTIVITY_ICON_SIZE / 2;
const TAB_ACTIVITY_DOT_Y = 28;
const TAB_ACTIVITY_DOT_RADIUS = 2;

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

function originalTabIcon(
  source: ImageSourcePropType | undefined,
  focused: boolean
) {
  if (!source) {
    return tabIcon('activity', focused);
  }

  return {
    type: 'image' as const,
    source,
    tinted: false,
  };
}

function useUnreadActivityIconSources({
  activeColor,
  inactiveColor,
}: {
  activeColor: string;
  inactiveColor: string;
}) {
  const regularImage = useImage(tabIcons.activity.regular);
  const selectedImage = useImage(tabIcons.activity.selected);
  const [sources, setSources] = useState<{
    regular?: ImageSourcePropType;
    selected?: ImageSourcePropType;
  }>({});

  useEffect(() => {
    if (Platform.OS !== 'ios' || !regularImage || !selectedImage) {
      setSources({});
      return;
    }

    const renderSource = (
      image: NonNullable<typeof regularImage>,
      color: string
    ) => {
      const pixelWidth = TAB_ACTIVITY_ICON_SIZE * TAB_AVATAR_SCALE;
      const pixelHeight = TAB_ACTIVITY_ICON_HEIGHT * TAB_AVATAR_SCALE;
      // UIKit centers the taller dotted image as a whole. Offset the bell
      // within it so its visual position matches the undotted 24pt icon.
      const iconOffsetY =
        ((TAB_ACTIVITY_ICON_HEIGHT - TAB_ACTIVITY_ICON_SIZE) / 2) *
        TAB_AVATAR_SCALE;
      const destination = rect(0, iconOffsetY, pixelWidth, pixelWidth);
      const surface = Skia.Surface.MakeOffscreen(pixelWidth, pixelHeight);
      if (!surface) {
        return undefined;
      }

      const canvas = surface.getCanvas();
      const imagePaint = Skia.Paint();
      const tintPaint = Skia.Paint();
      const dotPaint = Skia.Paint();

      try {
        canvas.clear(Skia.Color('transparent'));
        canvas.drawImageRectCubic(
          image,
          rect(0, 0, image.width(), image.height()),
          destination,
          1 / 3,
          1 / 3,
          imagePaint
        );

        tintPaint.setColor(Skia.Color(color));
        tintPaint.setBlendMode(BlendMode.SrcIn);
        canvas.drawRect(destination, tintPaint);

        dotPaint.setColor(Skia.Color(getTokenValue('$blue', 'color')));
        dotPaint.setAntiAlias(true);
        canvas.drawCircle(
          TAB_ACTIVITY_DOT_X * TAB_AVATAR_SCALE,
          TAB_ACTIVITY_DOT_Y * TAB_AVATAR_SCALE,
          TAB_ACTIVITY_DOT_RADIUS * TAB_AVATAR_SCALE,
          dotPaint
        );
        surface.flush();

        const dottedImage = surface.makeImageSnapshot();
        try {
          return {
            uri: `data:image/png;base64,${dottedImage.encodeToBase64(
              ImageFormat.PNG,
              100
            )}`,
            width: TAB_ACTIVITY_ICON_SIZE,
            height: TAB_ACTIVITY_ICON_HEIGHT,
            scale: TAB_AVATAR_SCALE,
          } satisfies ImageSourcePropType;
        } finally {
          dottedImage.dispose();
        }
      } finally {
        imagePaint.dispose();
        tintPaint.dispose();
        dotPaint.dispose();
        surface.dispose();
      }
    };

    setSources({
      regular: renderSource(regularImage, inactiveColor),
      selected: renderSource(selectedImage, activeColor),
    });
  }, [activeColor, inactiveColor, regularImage, selectedImage]);

  return sources;
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
    avatarImage && !avatarImage.endsWith('.svg') ? avatarImage : null;
  const image = useImage(supportedAvatarImage);
  const [source, setSource] = useState<ImageSourcePropType>();

  useEffect(() => {
    const canvasPixelSize = TAB_ICON_CANVAS_SIZE * TAB_AVATAR_SCALE;
    const avatarPixelSize = TAB_AVATAR_SIZE * TAB_AVATAR_SCALE;
    const avatarOffset = (canvasPixelSize - avatarPixelSize) / 2;
    const surface = Skia.Surface.MakeOffscreen(
      canvasPixelSize,
      canvasPixelSize
    );
    if (!surface) {
      setSource(undefined);
      return;
    }

    const canvas = surface.getCanvas();
    const destination = rect(
      avatarOffset,
      avatarOffset,
      avatarPixelSize,
      avatarPixelSize
    );

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
              const sigilOffset = (canvasPixelSize - sigilPixelSize) / 2;
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
      width: TAB_ICON_CANVAS_SIZE,
      height: TAB_ICON_CANVAS_SIZE,
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
        notification: getTokenValue('$blue', 'color'),
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
  const unreadActivityIconSources = useUnreadActivityIconSources({
    activeColor: theme.primaryText?.val ?? navigationTheme.colors.text,
    inactiveColor: theme.secondaryText?.val ?? navigationTheme.colors.text,
  });
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
            tabBarBadge:
              Platform.OS === 'android' && haveUnreadActivity ? '' : undefined,
            tabBarIcon: ({ focused }) =>
              Platform.OS === 'ios' && haveUnreadActivity
                ? originalTabIcon(
                    focused
                      ? unreadActivityIconSources.selected
                      : unreadActivityIconSources.regular,
                    focused
                  )
                : tabIcon('activity', focused),
          }}
        />
        <Tabs.Screen
          name="Contacts"
          component={ContactsScreen}
          options={{
            title: TOP_LEVEL_TABS.Contacts.title,
            tabBarIcon: () => avatarTabIcon(roundedAvatarSource),
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

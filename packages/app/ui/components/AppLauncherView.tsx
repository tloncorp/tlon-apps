import type { InstalledApp } from '@tloncorp/shared/store';
import {
  Image,
  Pressable,
  Text,
  getDarkColor,
  isLightColor,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { Platform } from 'react-native';
import { ScrollView, View, YStack } from 'tamagui';

const TILE_SIZE = 140;
const TILE_CELL_PADDING = 10;
const NARROW_CELL_PADDING = 8;

const isWeb = Platform.OS === 'web';
// On web, mix-blend-hard-light (matching landscape's tile title) handles
// contrast against any tile color: paint the title pill the same color as
// the tile and let the blend mode do the work. The base text color is
// picked based on tile luminance — gray-800 over light tiles, gray-200
// over dark tiles — so the blend stays in the readable contrast range.
const TITLE_DARK = '#1f2937';
const TITLE_LIGHT = '#e5e7eb';
const blendStyle = isWeb
  ? ({ mixBlendMode: 'hard-light' } as { mixBlendMode: 'hard-light' })
  : undefined;

function AppTile({
  app,
  onPress,
}: {
  app: InstalledApp;
  onPress: (app: InstalledApp) => void;
}) {
  const lightBg = app.color ? isLightColor(app.color) : true;
  // Native lacks mix-blend-mode; fall back to landscape's HSL invert.
  const fallbackTitleColor = app.color ? getDarkColor(app.color) : 'white';
  const titleColor = isWeb
    ? lightBg
      ? TITLE_DARK
      : TITLE_LIGHT
    : fallbackTitleColor;
  const pillBackground = app.color || '$secondaryBackground';
  return (
    <Pressable
      onPress={() => onPress(app)}
      pressStyle={{ opacity: 0.7 }}
      hoverStyle={{ opacity: 0.85 }}
      borderRadius="$xl"
      width="100%"
      aspectRatio={1}
    >
      <View
        width="100%"
        height="100%"
        borderRadius="$xl"
        overflow="hidden"
        backgroundColor={app.color || '$secondaryBackground'}
      >
        {app.image && (
          <Image
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            width="100%"
            height="100%"
            source={{ uri: app.image }}
            contentFit="cover"
          />
        )}
        {app.title && (
          <View
            position="absolute"
            bottom="$l"
            left="$s"
            maxWidth="80%"
            paddingHorizontal="$s"
            paddingVertical="$xs"
            borderRadius="$s"
            backgroundColor={pillBackground}
          >
            <Text
              size="$label/l"
              fontWeight="600"
              color={titleColor}
              numberOfLines={2}
              style={blendStyle}
            >
              {app.title}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function AppLauncherView({
  apps,
  isLoading,
  onSelectApp,
}: {
  apps: InstalledApp[];
  isLoading: boolean;
  onSelectApp: (app: InstalledApp) => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();

  if (!isLoading && apps.length === 0) {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        paddingHorizontal="$xl"
      >
        <Text size="$body" color="$secondaryText" textAlign="center">
          No apps installed yet. Install apps from the Urbit network to see them
          here.
        </Text>
      </YStack>
    );
  }

  // On narrow windows, force a 2-column grid where tiles fill the available
  // width via percentage cells. On wide windows tiles stay at the fixed
  // TILE_SIZE and wrap as many per row as fit.
  const cellPadding = isWindowNarrow ? NARROW_CELL_PADDING : TILE_CELL_PADDING;
  const wideCellWidth = TILE_SIZE + TILE_CELL_PADDING * 2;
  const containerPadding = isWindowNarrow ? 8 : 12;

  return (
    <ScrollView
      flex={1}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: containerPadding,
      }}
    >
      <View
        width="100%"
        maxWidth={840}
        flexDirection="row"
        flexWrap="wrap"
        justifyContent="center"
        alignContent="flex-start"
      >
        {apps.map((app) =>
          isWindowNarrow ? (
            <View key={app.desk} width="50%" padding={cellPadding}>
              <AppTile app={app} onPress={onSelectApp} />
            </View>
          ) : (
            <View key={app.desk} width={wideCellWidth} padding={cellPadding}>
              <AppTile app={app} onPress={onSelectApp} />
            </View>
          )
        )}
      </View>
    </ScrollView>
  );
}

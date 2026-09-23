import { SkImage, Skia } from '@shopify/react-native-skia';
import { createDevLogger } from '@tloncorp/shared';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ImageSourcePropType, PixelRatio } from 'react-native';

const logger = createDevLogger('useBotTabIcon', false);

// Matches the bundled tab-*.png glyphs.
const TAB_ICON_POINTS = 24;
// Matches the unfocused avatar in the web nav bar.
const UNFOCUSED_OPACITY = 0.6;

export type BotTabIcon = {
  regular: ImageSourcePropType;
  selected: ImageSourcePropType;
};

const iconCache = new Map<string, Promise<BotTabIcon | null>>();

/**
 * The bot's avatar as a native tab bar icon, or null until one is ready.
 *
 * Native tabs take an image source, not a component, and iOS loads a remote
 * source at its natural size, clipped rather than scaled — a full-size avatar
 * would show as a patch of its center. So the avatar is cropped to a square
 * and drawn at exactly the icon's size before the tab bar sees it. It is shown
 * untinted, so the unfocused state is a dimmed copy rather than a tint color.
 */
export function useBotTabIcon(avatarUrl: string | null | undefined) {
  const [icon, setIcon] = useState<{ url: string; icon: BotTabIcon } | null>(
    null
  );

  useEffect(() => {
    if (!avatarUrl) {
      return;
    }
    let cancelled = false;
    loadTabIcon(avatarUrl).then((loaded) => {
      if (!cancelled && loaded) {
        setIcon({ url: avatarUrl, icon: loaded });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  return icon && icon.url === avatarUrl ? icon.icon : null;
}

function loadTabIcon(url: string) {
  let pending = iconCache.get(url);
  if (!pending) {
    pending = renderTabIcon(url).catch((error) => {
      logger.trackError('failed to render bot tab icon', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      // Let a later mount try again rather than caching the failure.
      iconCache.delete(url);
      return null;
    });
    iconCache.set(url, pending);
  }
  return pending;
}

async function renderTabIcon(url: string): Promise<BotTabIcon> {
  const scale = PixelRatio.get();
  const pixels = Math.round(TAB_ICON_POINTS * scale);
  const source = (file: File) => ({
    uri: file.uri,
    width: TAB_ICON_POINTS,
    height: TAB_ICON_POINTS,
    scale,
  });

  const directory = new Directory(Paths.cache, 'bot-tab-icon');
  directory.create({ intermediates: true, idempotent: true });
  // Avatar URLs change when the image does, so a rendered icon stays valid
  // for as long as its URL is the bot's avatar.
  const name = `icon-${hashString(url)}-${pixels}`;
  const selected = new File(directory, `${name}.png`);
  const regular = new File(directory, `${name}-dim.png`);

  if (!selected.exists || !regular.exists) {
    const avatar = Skia.Image.MakeImageFromEncoded(
      await Skia.Data.fromURI(url)
    );
    if (!avatar) {
      throw new Error('avatar could not be decoded');
    }
    selected.write(drawSquare(avatar, pixels, 1), { encoding: 'base64' });
    regular.write(drawSquare(avatar, pixels, UNFOCUSED_OPACITY), {
      encoding: 'base64',
    });
  }

  return { regular: source(regular), selected: source(selected) };
}

/** Center-crops the image to a square, scaled to fill; returns a base64 PNG. */
function drawSquare(image: SkImage, pixels: number, opacity: number) {
  const surface = Skia.Surface.Make(pixels, pixels);
  if (!surface) {
    throw new Error('could not create a drawing surface');
  }
  const side = Math.min(image.width(), image.height());
  const paint = Skia.Paint();
  paint.setAlphaf(opacity);
  surface
    .getCanvas()
    .drawImageRect(
      image,
      Skia.XYWHRect(
        (image.width() - side) / 2,
        (image.height() - side) / 2,
        side,
        side
      ),
      Skia.XYWHRect(0, 0, pixels, pixels),
      paint
    );
  surface.flush();
  return surface.makeImageSnapshot().encodeToBase64();
}

function hashString(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

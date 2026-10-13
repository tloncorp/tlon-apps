import { ClipOp, SkCanvas, SkImage, Skia } from '@shopify/react-native-skia';
import { createDevLogger } from '@tloncorp/shared';
import { makeSigil } from '@tloncorp/ui';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { AppState, ImageSourcePropType, PixelRatio } from 'react-native';

const logger = createDevLogger('useBotTabIcon', false);

// Matches the bundled tab-*.png glyphs.
const TAB_ICON_POINTS = 24;
// Matches the 24pt avatar beside a chat message's author.
const CORNER_RADIUS_POINTS = 4;
// Matches the unfocused avatar in the web nav bar.
const UNFOCUSED_OPACITY = 0.6;
const FETCH_TIMEOUT_MS = 15_000;
// Matches SigilAvatar's inner sigil at 24pt.
const SIGIL_RATIO = 0.625;

/** What the bot's tab should show: its avatar, or its sigil when it has none. */
export type BotTabIconSpec =
  | { kind: 'image'; url: string }
  | {
      kind: 'sigil';
      id: string;
      backgroundColor: string;
      foregroundColor: string;
    };

export type BotTabIcon = {
  regular: ImageSourcePropType;
  selected: ImageSourcePropType;
};

const iconCache = new Map<string, Promise<BotTabIcon | null>>();

function specKey(spec: BotTabIconSpec) {
  return spec.kind === 'image'
    ? `image:${spec.url}`
    : `sigil:${spec.id}:${spec.backgroundColor}:${spec.foregroundColor}`;
}

/**
 * The bot's avatar (or sigil) as a native tab bar icon, or null until one is
 * ready. Memoize `spec`: the icon is reloaded whenever it changes.
 *
 * Native tabs take an image source, not a component, and iOS loads a remote
 * source at its natural size, clipped rather than scaled — a full-size avatar
 * would show as a patch of its center. So the icon is drawn at exactly the
 * tab's size, with the chat avatar's rounded corners, before the tab bar sees
 * it. It is shown untinted, so the unfocused state is a dimmed copy rather than
 * a tint color.
 */
export function useBotTabIcon(spec: BotTabIconSpec | null) {
  const key = spec ? specKey(spec) : null;
  const [icon, setIcon] = useState<{ key: string; icon: BotTabIcon } | null>(
    null
  );

  useEffect(() => {
    if (!spec || !key) {
      return;
    }
    let cancelled = false;
    const load = () =>
      loadTabIcon(key, spec).then((loaded) => {
        if (!cancelled && loaded) {
          setIcon((current) =>
            current?.key === key && current.icon === loaded
              ? current
              : { key, icon: loaded }
          );
        }
      });
    load();
    // A failed load (offline, say) is retried whenever the app returns to the
    // foreground, since the navigator holding this hook never remounts. Once
    // loaded, this is a cache hit.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        load();
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [key, spec]);

  return icon && icon.key === key ? icon.icon : null;
}

function loadTabIcon(key: string, spec: BotTabIconSpec) {
  let pending = iconCache.get(key);
  if (!pending) {
    pending = renderTabIcon(key, spec).catch((error) => {
      logger.trackError('failed to render bot tab icon', {
        kind: spec.kind,
        error: error instanceof Error ? error.message : String(error),
      });
      // Let a later load try again rather than caching the failure.
      iconCache.delete(key);
      return null;
    });
    iconCache.set(key, pending);
  }
  return pending;
}

async function renderTabIcon(
  key: string,
  spec: BotTabIconSpec
): Promise<BotTabIcon> {
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
  // Avatar URLs change when the image does, and a sigil is fixed by its id and
  // colors, so a rendered icon stays valid for as long as its key does. The
  // corner radius is in the name too, so changing it redraws icons already on
  // disk.
  const name = `icon-${hashString(key)}-${pixels}-r${CORNER_RADIUS_POINTS}`;
  const selected = new File(directory, `${name}.png`);
  const regular = new File(directory, `${name}-dim.png`);

  if (!selected.exists || !regular.exists) {
    const draw =
      spec.kind === 'image'
        ? drawImage(await decodeImage(spec.url), pixels)
        : drawSigil(spec, pixels);
    writeAtomically(directory, selected, renderSquare(draw, pixels, 1));
    writeAtomically(
      directory,
      regular,
      renderSquare(draw, pixels, UNFOCUSED_OPACITY)
    );
  }

  return { regular: source(regular), selected: source(selected) };
}

async function decodeImage(url: string) {
  const image = Skia.Image.MakeImageFromEncoded(
    Skia.Data.fromBytes(await fetchBytes(url))
  );
  if (!image) {
    throw new Error('avatar could not be decoded');
  }
  return image;
}

// Not Skia.Data.fromURI: on Android it swallows fetch errors and never
// settles, so a 404 or an offline launch would hang the icon for the session.
async function fetchBytes(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`avatar fetch failed (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

type Draw = (canvas: SkCanvas) => void;

/** Center-crops the image to a square, scaled to fill. */
function drawImage(image: SkImage, pixels: number): Draw {
  const side = Math.min(image.width(), image.height());
  return (canvas) =>
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(
        (image.width() - side) / 2,
        (image.height() - side) / 2,
        side,
        side
      ),
      Skia.XYWHRect(0, 0, pixels, pixels),
      Skia.Paint()
    );
}

/**
 * The contact's color with its sigil centered on it, as SigilAvatar draws it.
 * Like UrbitSigil, only planets and larger get a glyph: a moon — which every
 * hosted bot is — is the bare color.
 */
function drawSigil(
  spec: Extract<BotTabIconSpec, { kind: 'sigil' }>,
  pixels: number
): Draw {
  const inner = Math.round(pixels * SIGIL_RATIO);
  const svg =
    spec.id.length <= 14
      ? Skia.SVG.MakeFromString(
          makeSigil({
            point: spec.id,
            detail: 'none',
            size: inner,
            space: 'none',
            foreground: spec.foregroundColor,
            background: spec.backgroundColor,
          })
        )
      : null;
  return (canvas) => {
    canvas.drawColor(Skia.Color(spec.backgroundColor));
    if (svg) {
      const offset = (pixels - inner) / 2;
      canvas.translate(offset, offset);
      canvas.drawSvg(svg, inner, inner);
    }
  };
}

/**
 * Runs the drawing at the given opacity, clipped to rounded corners; returns a
 * base64 PNG.
 */
function renderSquare(draw: Draw, pixels: number, opacity: number) {
  const surface = Skia.Surface.Make(pixels, pixels);
  if (!surface) {
    throw new Error('could not create a drawing surface');
  }
  const canvas = surface.getCanvas();
  const radius = (CORNER_RADIUS_POINTS * pixels) / TAB_ICON_POINTS;
  canvas.clipRRect(
    Skia.RRectXY(Skia.XYWHRect(0, 0, pixels, pixels), radius, radius),
    ClipOp.Intersect,
    true
  );
  const layer = Skia.Paint();
  layer.setAlphaf(opacity);
  canvas.saveLayer(layer);
  draw(canvas);
  canvas.restore();
  surface.flush();
  return surface.makeImageSnapshot().encodeToBase64();
}

// The cache trusts any file that exists, so a write cut short must not leave
// one behind under the final name.
function writeAtomically(directory: Directory, file: File, base64: string) {
  const temp = new File(directory, `${file.name}.tmp`);
  temp.write(base64, { encoding: 'base64' });
  temp.moveSync(file, { overwrite: true });
}

function hashString(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

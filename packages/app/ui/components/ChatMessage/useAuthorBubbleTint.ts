import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { getLuminance, hsla, parseToHsla } from 'color2k';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useTheme } from 'tamagui';

import { useCalm, useContact } from '../../contexts/appDataContext';
import { loadAverageImageColor } from '../../utils/averageImageColor';

const logger = createDevLogger('useAuthorBubbleTint', false);

// The tint keeps its source's hue at a fixed lightness, so a dark photo and a
// bright sigil both land on a wash as legible as the default grey: a pastel
// on light themes, a deep tone on dark ones.
const LIGHT_TINT = {
  lightness: 0.92,
  minSaturation: 0.55,
  maxSaturation: 0.85,
};
const DARK_TINT = { lightness: 0.2, minSaturation: 0.3, maxSaturation: 0.5 };
// Below this, a color (a default black sigil, a mostly grey photo) has no hue
// worth showing and keeps the plain grey bubble.
const MIN_SATURATION = 0.12;

// Settled colors by avatar URL; null when the image has no usable color.
// Components read it through useSyncExternalStore, so every change notifies.
const avatarColors = new Map<string, string | null>();
const pendingAvatarColors = new Map<string, Promise<void>>();
const avatarColorListeners = new Set<() => void>();

function subscribeToAvatarColors(listener: () => void) {
  avatarColorListeners.add(listener);
  return () => {
    avatarColorListeners.delete(listener);
  };
}

function notifyAvatarColorListeners() {
  avatarColorListeners.forEach((listener) => listener());
}

// Disk keeps the most recently sampled avatars; older ones are sampled again.
const MAX_STORED_AVATAR_COLORS = 500;
const PERSIST_DELAY_MS = 1000;

let storedColorsLoad: Promise<void> | undefined;
function loadStoredAvatarColors() {
  storedColorsLoad ??= db.avatarImageColors
    .getValue()
    .then((stored) => {
      for (const [url, color] of Object.entries(stored)) {
        if (!avatarColors.has(url)) {
          avatarColors.set(url, color);
        }
      }
      notifyAvatarColorListeners();
    })
    .catch((error) => {
      logger.log('could not read stored avatar colors', error);
    });
  return storedColorsLoad;
}

// Avatars arrive in bursts as a channel renders; write them in one batch.
let unsavedColors: Record<string, string> = {};
let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persistAvatarColor(url: string, color: string) {
  unsavedColors[url] = color;
  persistTimer ??= setTimeout(() => {
    const batch = unsavedColors;
    unsavedColors = {};
    persistTimer = undefined;
    db.avatarImageColors
      .setValue((current) => {
        const merged = Object.entries({ ...current, ...batch });
        return Object.fromEntries(merged.slice(-MAX_STORED_AVATAR_COLORS));
      })
      .catch((error) => {
        logger.log('could not store avatar colors', error);
      });
  }, PERSIST_DELAY_MS);
}

function loadAvatarColor(url: string) {
  let pending = pendingAvatarColors.get(url);
  if (!pending) {
    pending = loadStoredAvatarColors().then(async () => {
      if (avatarColors.has(url)) {
        return;
      }
      const color = await loadAverageImageColor(url).catch((error) => {
        logger.log('could not average avatar color', url, error);
        return null;
      });
      avatarColors.set(url, color);
      notifyAvatarColorListeners();
      // A failed sample may be a network blip, so only a result is stored.
      if (color) {
        persistAvatarColor(url, color);
      }
    });
    pendingAvatarColors.set(url, pending);
  }
  return pending;
}

function useAvatarColor(url: string | null) {
  const getColor = useCallback(
    () => (url ? avatarColors.get(url) : null),
    [url]
  );
  const color = useSyncExternalStore(subscribeToAvatarColors, getColor);
  useEffect(() => {
    if (url && !avatarColors.has(url)) {
      void loadAvatarColor(url);
    }
  }, [url]);
  return color;
}

function parseHueAndSaturation(color: string) {
  try {
    const [hue, saturation] = parseToHsla(color);
    return { hue, saturation };
  } catch {
    return null;
  }
}

/**
 * A wash of the author's avatar color for their bubbles: the average of their
 * avatar image, or their sigil color when they have no image. Null keeps the
 * default grey bubble; pass null for bubbles that are never tinted.
 */
export function useAuthorBubbleTint(authorId: string | null) {
  const contact = useContact(authorId ?? '');
  const calm = useCalm();
  const theme = useTheme();
  // Follows what the avatar shows: calm mode swaps images for sigils.
  const imageUrl =
    authorId && !calm.disableAvatars && contact?.avatarImage
      ? contact.avatarImage
      : null;
  const imageColor = useAvatarColor(imageUrl);
  const background = theme.background.val;

  return useMemo(() => {
    if (!authorId) {
      return null;
    }
    const source = imageUrl ? imageColor : contact?.color;
    const parsed = source ? parseHueAndSaturation(source) : null;
    if (!parsed || parsed.saturation < MIN_SATURATION) {
      return null;
    }
    const tint = getLuminance(background) < 0.5 ? DARK_TINT : LIGHT_TINT;
    const saturation = Math.min(
      Math.max(parsed.saturation, tint.minSaturation),
      tint.maxSaturation
    );
    return hsla(parsed.hue, saturation, tint.lightness, 1);
  }, [authorId, background, contact?.color, imageColor, imageUrl]);
}

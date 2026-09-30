import { createDevLogger } from '@tloncorp/shared';
import { getLuminance, hsla, parseToHsla } from 'color2k';
import { useEffect, useMemo, useReducer } from 'react';
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
const avatarColors = new Map<string, string | null>();
const pendingAvatarColors = new Map<string, Promise<void>>();

function loadAvatarColor(url: string) {
  let pending = pendingAvatarColors.get(url);
  if (!pending) {
    pending = loadAverageImageColor(url)
      .catch((error) => {
        logger.log('could not average avatar color', url, error);
        return null;
      })
      .then((color) => {
        avatarColors.set(url, color);
      });
    pendingAvatarColors.set(url, pending);
  }
  return pending;
}

function useAvatarColor(url: string | null) {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const renderedColor = url ? avatarColors.get(url) : null;
  const rendered = renderedColor !== undefined;
  useEffect(() => {
    if (!url || rendered) {
      return;
    }
    // Another bubble may have settled this URL between render and effect.
    if (avatarColors.has(url)) {
      rerender();
      return;
    }
    let cancelled = false;
    loadAvatarColor(url).then(() => {
      if (!cancelled) {
        rerender();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url, rendered]);
  return renderedColor;
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

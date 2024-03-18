import { SigilProps } from '@tloncorp/shared/dist/urbit/sigil';
import { Contact, cite } from '@urbit/api';
import '@urbit/sigil-js';
import classNames from 'classnames';
import { darken, lighten, parseToHsla } from 'color2k';
import _ from 'lodash';
import React, { CSSProperties, useMemo } from 'react';
import { isValidPatp, clan as shipType } from 'urbit-ob';

import { isValidUrl, normalizeUrbitColor } from '@/logic/utils';
import { useAvatar } from '@/state/avatar';
import { useContact } from '@/state/contact';
import { useCurrentTheme } from '@/state/local';
import { useCalm } from '@/state/settings';

export type AvatarSizes =
  | 'sidebar'
  | 'xxs'
  | 'xs'
  | 'small'
  | 'default-sm'
  | 'default'
  | 'big'
  | 'huge';

interface AvatarProps {
  ship: string;
  size?: AvatarSizes;
  className?: string;
  style?: CSSProperties;
  icon?: boolean;
  previewData?: {
    previewColor?: string;
    previewAvatar?: string;
  };
  loadImage?: boolean;
}

interface AvatarMeta {
  classes: string;
  size: number;
}

const sizeMap: Record<AvatarSizes, AvatarMeta> = {
  xxs: { classes: 'h-4 w-4', size: 10 },
  sidebar: { classes: 'h-[16px] w-[16px] rounded-[3px]', size: 11 },
  xs: { classes: 'w-6 h-6 rounded', size: 12 },
  small: { classes: 'w-8 h-8 rounded', size: 16 },
  'default-sm': { classes: 'w-9 h-9 rounded-lg', size: 18 },
  default: { classes: 'w-12 h-12 rounded-lg', size: 24 },
  big: { classes: 'w-[72px] h-[72px] rounded-lg', size: 40 },
  huge: { classes: 'w-20 h-20 rounded-xl', size: 48 },
};

export const foregroundFromBackground = (
  background: string
): 'black' | 'white' => {
  const rgb = {
    r: parseInt(background.slice(1, 3), 16),
    g: parseInt(background.slice(3, 5), 16),
    b: parseInt(background.slice(5, 7), 16),
  };
  const brightness = (299 * rgb.r + 587 * rgb.g + 114 * rgb.b) / 1000;
  const whiteBrightness = 255;

  return whiteBrightness - brightness < 70 ? 'black' : 'white';
};

const emptyContact: Contact = {
  nickname: '',
  bio: '',
  status: '',
  color: '#000000',
  avatar: null,
  cover: null,
  groups: [],
  'last-updated': 0,
};

function themeAdjustColor(color: string, theme: 'light' | 'dark'): string {
  const hsla = parseToHsla(color);
  const lightness = hsla[2];

  if (lightness <= 0.2 && theme === 'dark') {
    return lighten(color, 0.2 - lightness);
  }

  if (lightness >= 0.8 && theme === 'light') {
    return darken(color, lightness - 0.8);
  }

  return color;
}

function Avatar({
  ship,
  size = 'default',
  className,
  style,
  icon = true,
  loadImage = true,
  previewData,
}: AvatarProps) {
  const currentTheme = useCurrentTheme();
  const contact = useContact(ship);
  const calm = useCalm();
  const { previewColor, previewAvatar } = previewData ?? {};
  const previewAvatarIsValid = useMemo(
    () => previewAvatar && isValidUrl(previewAvatar),
    [previewAvatar]
  );
  const { color, avatar } = contact || emptyContact;
  const { hasLoaded, load } = useAvatar(
    (previewAvatarIsValid ? previewAvatar : avatar) || ''
  );
  const showImage = useMemo(
    () => loadImage && hasLoaded,
    [loadImage, hasLoaded]
  );
  const { classes, size: sigilSize } = useMemo(() => sizeMap[size], [size]);
  const adjustedColor = useMemo(
    () =>
      themeAdjustColor(
        normalizeUrbitColor(previewColor || color),
        currentTheme
      ),
    [previewColor, color, currentTheme]
  );
  const foregroundColor = useMemo(
    () => foregroundFromBackground(adjustedColor),
    [adjustedColor]
  );
  const citedShip = useMemo(() => cite(ship), [ship]);
  const props: SigilProps = {
    point: citedShip,
    size: sigilSize,
    detail: icon ? 'none' : 'default',
    space: 'none',
    background: adjustedColor,
    foreground: foregroundColor,
  };
  const invalidShip = useMemo(
    () => !isValidPatp(ship) || ['comet', 'moon'].includes(shipType(ship)),
    [ship]
  );

  const shouldShowImage = useMemo(
    () =>
      !calm.disableRemoteContent &&
      !calm.disableAvatars &&
      ((previewAvatarIsValid && showImage) ||
        (!previewAvatarIsValid && avatar && showImage)),
    [
      previewAvatarIsValid,
      showImage,
      calm.disableRemoteContent,
      calm.disableAvatars,
      avatar,
    ]
  );

  if (shouldShowImage && previewAvatarIsValid) {
    return (
      <img
        className={classNames(className, classes, 'object-cover')}
        src={previewAvatar}
        alt=""
        style={style}
        onLoad={load}
      />
    );
  }

  if (shouldShowImage && !previewAvatarIsValid) {
    return (
      <img
        className={classNames(className, classes, 'object-cover')}
        src={avatar ?? ''} // Defensively avoid null src
        alt=""
        style={style}
        onLoad={load}
      />
    );
  }

  // Fallback to sigil or other representation if the conditions for showing the image are not met
  return (
    <div
      className={classNames(
        'relative flex flex-none items-center justify-center rounded bg-black',
        classes,
        className
      )}
      style={{ backgroundColor: adjustedColor, ...style }}
    >
      {!invalidShip && <urbit-sigil {...props} />}
    </div>
  );
}

export default React.memo(Avatar);

export function useProfileColor(
  ship: string,
  previewData?: {
    previewColor?: string;
    previewAvatar?: string;
  }
) {
  const currentTheme = useCurrentTheme();
  const contact = useContact(ship);
  const { previewColor } = previewData ?? {};
  const { color } = contact || emptyContact;
  const adjustedColor = themeAdjustColor(
    normalizeUrbitColor(previewColor || color),
    currentTheme
  );
  return adjustedColor;
}

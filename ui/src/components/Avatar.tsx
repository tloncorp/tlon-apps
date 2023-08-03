import { isValidPatp } from 'urbit-ob';
import classNames from 'classnames';
import React, { CSSProperties } from 'react';
import '@urbit/sigil-js';
import { Contact, cite } from '@urbit/api';
import _ from 'lodash';
import { darken, lighten, parseToHsla } from 'color2k';
import { useCalm } from '@/state/settings';
import { useCurrentTheme } from '@/state/local';
import { normalizeUrbitColor, isValidUrl } from '@/logic/utils';
import { useContact } from '@/state/contact';
import { useAvatar } from '@/state/avatar';
import { SigilProps } from '@/types/sigil';

export type AvatarSizes = 'xxs' | 'xs' | 'small' | 'default' | 'huge';

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
  xs: { classes: 'w-6 h-6 rounded', size: 12 },
  small: { classes: 'w-8 h-8 rounded', size: 16 },
  default: { classes: 'w-12 h-12 rounded-lg', size: 24 },
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

export default function Avatar({
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
  const previewAvatarIsValid =
    previewAvatar && previewAvatar !== null && isValidUrl(previewAvatar);
  const { color, avatar } = contact || emptyContact;
  const { hasLoaded, load } = useAvatar(
    (previewAvatarIsValid ? previewAvatar : avatar) || ''
  );
  const showImage = loadImage || hasLoaded;
  const { classes, size: sigilSize } = sizeMap[size];
  const adjustedColor = themeAdjustColor(
    normalizeUrbitColor(previewColor || color),
    currentTheme
  );
  const foregroundColor = foregroundFromBackground(adjustedColor);
  const citedShip = cite(ship);
  const props: SigilProps = {
    point: citedShip || '~zod',
    size: sigilSize,
    detail: icon ? 'none' : 'default',
    space: 'none',
    background: adjustedColor,
    foreground: foregroundColor,
  };
  const invalidShip =
    !ship ||
    ship === 'undefined' ||
    !isValidPatp(ship) ||
    citedShip.match(/[_^]/) ||
    citedShip.length > 14;

  if (
    showImage &&
    previewAvatarIsValid &&
    !calm.disableRemoteContent &&
    !calm.disableAvatars
  ) {
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

  if (
    avatar &&
    showImage &&
    !calm.disableRemoteContent &&
    !calm.disableAvatars
  ) {
    return (
      <img
        className={classNames(className, classes, 'object-cover')}
        src={avatar}
        alt=""
        style={style}
        onLoad={load}
      />
    );
  }

  return (
    <div
      className={classNames(
        'relative flex flex-none items-center justify-center rounded bg-black',
        classes,
        size === 'xs' && 'p-1.5',
        size === 'small' && 'p-2',
        size === 'default' && 'p-3',
        size === 'huge' && 'p-3',
        className
      )}
      style={{ backgroundColor: adjustedColor, ...style }}
    >
      {!invalidShip && <urbit-sigil {...props} />}
    </div>
  );
}

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

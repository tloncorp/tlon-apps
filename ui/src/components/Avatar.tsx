import classNames from 'classnames';
import React, { useMemo } from 'react';
import { sigil, reactRenderer } from '@tlon/sigil-js';
import { deSig, Contact, cite } from '@urbit/api';
import { darken, lighten, parseToHsla } from 'color2k';
import { useCurrentTheme } from '../state/local';
import { normalizeUrbitColor } from '../logic/utils';
import { useContact } from '../state/contact';

export type AvatarSizes = 'xs' | 'small' | 'default';

interface AvatarProps {
  ship: string;
  size: AvatarSizes;
  className?: string;
}

interface AvatarMeta {
  classes: string;
  size: number;
}

const sizeMap: Record<AvatarSizes, AvatarMeta> = {
  xs: { classes: 'w-6 h-6 rounded', size: 12 },
  small: { classes: 'w-8 h-8 rounded', size: 16 },
  default: { classes: 'w-12 h-12 rounded-lg', size: 24 },
};

const foregroundFromBackground = (background: string): 'black' | 'white' => {
  const rgb = {
    r: parseInt(background.slice(1, 3), 16),
    g: parseInt(background.slice(3, 5), 16),
    b: parseInt(background.slice(5, 7), 16),
  };
  const brightness = (299 * rgb.r + 587 * rgb.g + 114 * rgb.b) / 1000;
  const whiteBrightness = 255;

  return whiteBrightness - brightness < 50 ? 'black' : 'white';
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

export default function Avatar({ ship, size, className }: AvatarProps) {
  const currentTheme = useCurrentTheme();
  const contact = useContact(ship);
  const { color, avatar } = contact || emptyContact;
  const { classes, size: sigilSize } = sizeMap[size];
  const adjustedColor = themeAdjustColor(
    normalizeUrbitColor(color),
    currentTheme
  );
  const foregroundColor = foregroundFromBackground(adjustedColor);
  const sigilElement = useMemo(() => {
    const citedShip = cite(ship);

    if (
      !ship ||
      ship === 'undefined' ||
      citedShip.match(/[_^]/) ||
      citedShip.length > 14
    ) {
      return null;
    }

    return sigil({
      patp: deSig(citedShip) || 'zod',
      renderer: reactRenderer,
      size: sigilSize,
      icon: true,
      colors: [adjustedColor, foregroundColor],
    });
  }, [ship, adjustedColor, foregroundColor, sigilSize]);

  if (avatar) {
    return <img className={classNames('', classes)} src={avatar} alt="" />;
  }

  return (
    <div
      className={classNames(
        'relative flex-none rounded bg-black',
        classes,
        size === 'xs' && 'p-1.5',
        size === 'small' && 'p-2',
        size === 'default' && 'p-3',
        className
      )}
      style={{ backgroundColor: adjustedColor }}
    >
      {sigilElement}
    </div>
  );
}

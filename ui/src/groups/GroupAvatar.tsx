import cn from 'classnames';
import React from 'react';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import { isColor } from '@/logic/utils';
import useMedia from '@/logic/useMedia';
import { useCalm } from '@/state/settings';

interface GroupAvatarProps {
  image?: string;
  size?: string;
  className?: string;
  title?: string;
}

const textSize = (size: string) => {
  const dims = parseInt(size.replace(/[^0-9.]/g, ''), 10);
  switch (dims) {
    case 7272:
      return 'text-3xl';
    case 2020:
      return 'text-xl';
    case 1616:
      return 'text-xl';
    case 1414:
      return 'text-xl';
    case 1212:
      return 'text-xl';
    case 66:
      return 'text-sm';
    default:
      return 'text-sm';
  }
};

export default function GroupAvatar({
  image,
  size = 'h-6 w-6',
  className,
  title,
}: GroupAvatarProps) {
  const dark = useMedia('(prefers-color-scheme: dark)');
  const calm = useCalm();
  let background;

  if (!calm.disableRemoteContent) {
    background = image || (dark ? '#333333' : '#E5E5E5');
  } else {
    background = dark ? '#333333' : '#E5E5E5';
  }

  return image && !calm.disableRemoteContent && !isColor(image) ? (
    <img className={cn('rounded', size, className)} src={image} />
  ) : (
    <ColorBoxIcon
      className={cn('rounded', size, textSize(size), className)}
      color={background}
      letter={title ? title.charAt(0) : ''}
    />
  );
}

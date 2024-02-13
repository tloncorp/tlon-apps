import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import { useIsDark } from '@/logic/useMedia';
import { isColor } from '@/logic/utils';
import { useAvatar } from '@/state/avatar';
import { useCalm } from '@/state/settings';
import cn from 'classnames';
import React, { useMemo } from 'react';

interface GroupAvatarProps {
  image?: string;
  size?: string;
  className?: string;
  title?: string;
  loadImage?: boolean;
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
    case 44:
      return 'text-xs';
    default:
      return 'text-sm';
  }
};

export default function GroupAvatar({
  image,
  size = 'h-6 w-6',
  className,
  title,
  loadImage = true,
}: GroupAvatarProps) {
  const { hasLoaded, load } = useAvatar(image || '');
  const imageIsColor = useMemo(() => image && isColor(image), [image]);
  const calm = useCalm();
  const showImage = useMemo(
    () =>
      image &&
      !calm.disableRemoteContent &&
      !imageIsColor &&
      (hasLoaded || loadImage),
    [image, calm.disableRemoteContent, imageIsColor, hasLoaded, loadImage]
  );
  const dark = useIsDark();
  const symbols = [...(title || '')];
  const background = useMemo(() => {
    if (image && imageIsColor) {
      return image;
    }
    return dark ? '#333333' : '#E5E5E5';
  }, [imageIsColor, dark, image]);

  return showImage ? (
    <img className={cn('rounded', size, className)} src={image} onLoad={load} />
  ) : (
    <ColorBoxIcon
      className={cn('rounded', size, textSize(size), className)}
      color={background}
      letter={title ? symbols[0] : ''}
    />
  );
}

import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, useMemo } from 'react';
import { getTokenValue, styled } from 'tamagui';

import { useCalm } from '../contexts';
import { Image, View } from '../core';
import { useSigilColors } from '../utils/colorUtils';
import UrbitSigil from './UrbitSigil';

export function Avatar({
  contact,
  contactId,
  size = '$2xl',
  ...props
}: {
  contact?: db.Contact | null;
  contactId: string;
  size?: AvatarFrameProps['size'];
} & AvatarFrameProps) {
  const colors = useSigilColors(contact?.color);
  const { disableAvatars } = useCalm();
  // TODO: check padding values against design
  const sigilSize = useMemo(() => (size ? getTokenValue(size) : 20) / 2, []);
  return (
    <AvatarFrame
      size={size}
      {...props}
      // @ts-expect-error custom color
      backgroundColor={colors.backgroundColor}
    >
      {contact?.avatarImage && !disableAvatars ? (
        <Image
          source={{
            uri: contact.avatarImage,
          }}
          height="100%"
          width="100%"
          contentFit="cover"
        />
      ) : !isNaN(sigilSize) ? (
        <UrbitSigil colors={colors} size={sigilSize} contactId={contactId} />
      ) : null}
    </AvatarFrame>
  );
}

const AvatarFrame = styled(View, {
  name: 'AvatarFrame',
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
  variants: {
    rounded: {
      true: {
        borderRadius: '$4xl',
      },
    },
    size: {
      $xl: {
        height: '$xl',
        width: '$xl',
        borderRadius: '$2xs',
      },
      $2xl: {
        height: '$2xl',
        width: '$2xl',
        borderRadius: '$xs',
      },
      $3xl: {
        height: '$3xl',
        width: '$3xl',
        borderRadius: '$xs',
      },
      $4xl: {
        height: '$4xl',
        width: '$4xl',
        borderRadius: '$s',
      },
      $5xl: {
        height: '$5xl',
        width: '$5xl',
        borderRadius: '$m',
      },
    },
  } as const,
});

type AvatarFrameProps = ComponentProps<typeof AvatarFrame>;
export type AvatarSize = AvatarFrameProps['size'];

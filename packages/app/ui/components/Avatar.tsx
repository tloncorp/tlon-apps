import * as db from '@tloncorp/shared/db';
import { Icon, IconType } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { UrbitSigil } from '@tloncorp/ui';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import React from 'react';
import {
  ColorTokens,
  Text,
  View,
  getTokenValue,
  isWeb,
  styled,
  useStyle,
} from 'tamagui';

import { useCalm, useContact } from '../contexts/appDataContext';
import * as utils from '../utils';
import { getChannelTypeIcon } from '../utils';
import { getContrastingColor, useSigilColors } from '../utils/colorUtils';

export const AvatarFrame = styled(View, {
  width: '$4xl',
  height: '$4xl',
  borderRadius: '$s',
  overflow: 'hidden',
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
      '$3.5xl': {
        height: '$3.5xl',
        width: '$3.5xl',
        borderRadius: '$s',
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
      $9xl: {
        height: '$9xl',
        width: '$9xl',
        borderRadius: '$xl',
      },
      custom: {},
    },
  } as const,
});

export type AvatarProps = ComponentProps<typeof AvatarFrame> & {
  ignoreCalm?: boolean;
  isGroupIcon?: boolean;
};

export const ContactAvatar = React.memo(function ContactAvatarComponent({
  contactId,
  contactOverride,
  overrideUrl,
  innerSigilSize,
  ignoreCalm = false,
  ...props
}: {
  contactId: string;
  contactOverride?: db.Contact;
  overrideUrl?: string;
  innerSigilSize?: number;
} & AvatarProps) {
  const dbContact = useContact(contactId);
  const contact = contactOverride ?? dbContact;

  return (
    <ImageAvatar
      imageUrl={overrideUrl ?? contact?.avatarImage ?? undefined}
      fallback={
        <SigilAvatar
          contactId={contactId}
          contactOverride={contactOverride}
          innerSigilSize={innerSigilSize}
          {...props}
        />
      }
      ignoreCalm={ignoreCalm}
      {...props}
    />
  );
});

export interface GroupImageShim {
  id: string;
  title?: string;
  iconImage?: string;
  iconImageColor?: string;
}

export const ChannelAvatar = React.memo(function ChannelAvatarComponent({
  model,
  useTypeIcon,
  dimmed,
  ...props
}: {
  model: db.Channel;
  useTypeIcon?: boolean;
  dimmed?: boolean;
} & AvatarProps) {
  const channelTitle = utils.useChannelTitle(model);

  if (useTypeIcon) {
    return <ChannelTypeAvatar channel={model} dimmed={dimmed} {...props} />;
  } else if (model.type === 'dm') {
    return (
      <ContactAvatar
        contactId={model.members?.[0]?.contactId ?? model.id}
        {...props}
      />
    );
  } else {
    const fallback = (
      <TextAvatar
        backgroundColor={
          model.iconImageColor ?? model.group?.iconImageColor ?? undefined
        }
        text={channelTitle}
        {...props}
      />
    );
    return (
      <ImageAvatar
        imageUrl={model.iconImage ?? model.group?.iconImage ?? undefined}
        fallback={fallback}
        isGroupIcon={true}
        {...props}
      />
    );
  }
});

export const ChannelTypeAvatar = React.memo(
  function ChannelTypeAvatarComponent({
    channel,
    dimmed,
    ...props
  }: {
    channel: db.Channel;
    dimmed?: boolean;
  } & ComponentProps<typeof AvatarFrame>) {
    return (
      <SystemIconAvatar
        {...props}
        color={dimmed ? '$tertiaryText' : undefined}
        backgroundColor={dimmed ? '$secondaryBackground' : undefined}
        icon={getChannelTypeIcon(channel.type) || 'Channel'}
      />
    );
  }
);

export const SystemIconAvatar = React.memo(function SystemIconAvatarComponent({
  icon,
  color,
  ...props
}: {
  icon: IconType;
  color?: ColorTokens;
} & ComponentProps<typeof AvatarFrame>) {
  return (
    <AvatarFrame
      {...props}
      backgroundColor={props.backgroundColor ?? '$secondaryBackground'}
    >
      <Icon
        type={icon}
        color={color ?? '$secondaryText'}
        width={'100%'}
        height={'100%'}
      />
    </AvatarFrame>
  );
});

export const ImageAvatar = function ImageAvatarComponent({
  imageUrl,
  fallback,
  isGroupIcon = false,
  ignoreCalm = false,
  ...props
}: {
  imageUrl?: string;
  fallback?: React.ReactNode;
} & AvatarProps) {
  const calmSettings = useCalm();
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const handleLoadError = useCallback(() => {
    setLoadFailed(true);
  }, []);
  const handleLoadEnd = useCallback(() => setIsLoading(false), []);
  // TODO: figure out how to sanitize svgs so we can support svg avatars
  const isSVG = imageUrl?.endsWith('.svg');

  const shouldShowImage =
    isGroupIcon || ignoreCalm || !calmSettings.disableAvatars;

  return imageUrl &&
    imageUrl !== '' &&
    !isSVG &&
    shouldShowImage &&
    !loadFailed ? (
    <AvatarFrame
      key={imageUrl}
      {...props}
      {...(isLoading ? { backgroundColor: '$secondaryBackground' } : {})}
    >
      <Image
        width={'100%'}
        height={'100%'}
        contentFit="cover"
        onError={handleLoadError}
        onLoadEnd={handleLoadEnd}
        source={{
          uri: imageUrl,
        }}
      />
    </AvatarFrame>
  ) : (
    fallback ?? null
  );
};

export const TextAvatar = React.memo(function TextAvatarComponent({
  text,
  backgroundColor = '$secondaryBackground',
  ...props
}: {
  text: string | null;
} & AvatarProps) {
  const fontSize = {
    $xl: 12,
    $2xl: 14,
    $3xl: 16,
    '$3.5xl': 16,
    $4xl: 16,
    $5xl: 24,
    $9xl: 32,
    // TODO: could be nice to implement some scaling logic? But also might be
    // nice to get rid of "custom"...
    custom: 16,
  }[props.size ?? '$4xl'];
  const finalBackgroundColor = useStyle(
    { backgroundColor: backgroundColor },
    { resolveValues: 'value' }
  ).backgroundColor as string;

  return (
    <AvatarFrame {...props} backgroundColor={backgroundColor}>
      <View flex={1} alignItems="center" justifyContent="center">
        <Text
          fontSize={fontSize}
          color={getContrastingColor(finalBackgroundColor)}
        >
          {text?.[0]?.toUpperCase()}
        </Text>
      </View>
    </AvatarFrame>
  );
});

// Hardcoded integer sizes for the inner sigil SVG. Fractional sizes render
// blurry and can shift the sigil off the pixel grid, especially for tiny
// avatars where the desktop tokens (14, 22) don't divide evenly. Inner size
// must also match the outer size's parity so the leftover margin splits evenly
// on both sides — otherwise the sigil shifts by a subpixel on non-retina.
function matchParity(value: number, base: number): number {
  const rounded = Math.floor(value);
  return rounded % 2 === base % 2 ? rounded : rounded + 1;
}
function getDefaultInnerSigilSize(sigilSize: number): number {
  // small sizes need a larger ratio to be recognizable
  if (sigilSize <= 16) return matchParity(sigilSize * 0.75, sigilSize);
  if (sigilSize <= 24) return matchParity(sigilSize * 0.625, sigilSize);
  // $3xl/$3.5xl: simplified sigils read better with a little color frame.
  if (sigilSize < 44) return matchParity(sigilSize * 0.55, sigilSize);
  // $4xl and up render with detail, so give the linework a bit more room.
  return matchParity(sigilSize * 0.625, sigilSize);
}

export const SigilAvatar = React.memo(function SigilAvatarComponent({
  contactId,
  contactOverride,
  innerSigilSize,
  renderDetail,
  size = '$4xl',
  ...props
}: {
  contactId: string;
  contactOverride?: db.Contact;
  innerSigilSize?: number;
  renderDetail?: boolean;
} & AvatarProps) {
  const dbContact = useContact(contactId);
  const contact = contactOverride ?? dbContact;
  const colors = useSigilColors(contact?.color);
  const styles = useStyle(props, { resolveValues: 'value' });
  const sigilSize = useMemo(() => {
    if (size && size !== 'custom') {
      return getTokenValue(size);
    } else {
      if (isWeb && (props.width || props.height)) {
        // Sigil size must be a number (because we need to multiply by it).
        // On web, `useStyle` will return a string.
        // We'll use the height or width prop if it's not a string, otherwise
        // default to 20.
        if (
          typeof props.width === 'string' ||
          typeof props.height === 'string'
        ) {
          return 20;
        }

        return props.width ?? props.height ?? 20;
      }

      return styles.width ?? styles.height ?? 20;
    }
  }, [size, styles.width, styles.height, props.width, props.height]);
  const defaultInnerSigilSize = useMemo(
    () => getDefaultInnerSigilSize(sigilSize),
    [sigilSize]
  );
  const finalInnerSigilSize = innerSigilSize ?? defaultInnerSigilSize;
  // sigil-js strokes are ~2px up through size 48 and thicken above 64, so
  // the overlaid detail linework only reads cleanly once the sigil itself is
  // large enough. Auto-enable it at $4xl and up, unless the caller opts out.
  const shouldRenderDetail = renderDetail ?? finalInnerSigilSize >= 24;

  return (
    <AvatarFrame
      {...props}
      size={size}
      alignItems={'center'}
      justifyContent="center"
      backgroundColor={colors.backgroundColor}
    >
      <UrbitSigil
        key={contactId}
        colors={colors}
        size={finalInnerSigilSize}
        contactId={contactId}
        renderDetail={shouldRenderDetail}
      />
    </AvatarFrame>
  );
});

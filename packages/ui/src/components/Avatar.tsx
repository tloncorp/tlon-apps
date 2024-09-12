import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import React from 'react';
import {
  ColorTokens,
  Text,
  View,
  getTokenValue,
  styled,
  useStyle,
} from 'tamagui';

import { useCalm, useContact } from '../contexts';
import * as utils from '../utils';
import { getChannelTypeIcon } from '../utils';
import { getContrastingColor, useSigilColors } from '../utils/colorUtils';
import { Icon, IconType } from './Icon';
import { Image } from './Image';
import UrbitSigil from './UrbitSigil';

const AvatarFrame = styled(View, {
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
};

export const ContactAvatar = React.memo(function ContactAvatComponent({
  contactId,
  overrideUrl,
  innerSigilSize,
  ...props
}: {
  contactId: string;
  overrideUrl?: string;
  innerSigilSize?: number;
} & AvatarProps) {
  const contact = useContact(contactId);
  return (
    <ImageAvatar
      imageUrl={overrideUrl ?? contact?.avatarImage ?? undefined}
      fallback={
        <SigilAvatar
          contactId={contactId}
          innerSigilSize={innerSigilSize}
          {...props}
        />
      }
      {...props}
    />
  );
});

export const GroupAvatar = React.memo(function GroupAvatarComponent({
  model,
  ...props
}: { model: db.Group } & AvatarProps) {
  const fallback = (
    <TextAvatar
      text={model.title ?? model.id.replace('~', '')}
      backgroundColor={model.iconImageColor ?? undefined}
      {...props}
    />
  );
  return (
    <ImageAvatar
      imageUrl={model.iconImage ?? undefined}
      fallback={fallback}
      {...props}
    />
  );
});

export const ChannelAvatar = React.memo(function ChannelAvatarComponent({
  model,
  useTypeIcon,
  ...props
}: {
  model: db.Channel;
  useTypeIcon?: boolean;
} & AvatarProps) {
  const channelTitle = utils.useChannelTitle(model);

  if (useTypeIcon) {
    return <ChannelTypeAvatar channel={model} {...props} />;
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
        {...props}
      />
    );
  }
});

export const ChannelTypeAvatar = React.memo(
  function ChannelTypeAvatarComponent({
    channel,
    ...props
  }: {
    channel: db.Channel;
  } & ComponentProps<typeof AvatarFrame>) {
    return (
      <SystemIconAvatar
        {...props}
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
  ...props
}: {
  imageUrl?: string;
  fallback?: React.ReactNode;
} & AvatarProps) {
  const calmSettings = useCalm();
  const [loadFailed, setLoadFailed] = useState(false);

  const handleLoadError = useCallback(() => {
    setLoadFailed(true);
  }, []);

  return imageUrl &&
    (props.ignoreCalm || !calmSettings.disableAvatars) &&
    !loadFailed ? (
    <AvatarFrame {...props}>
      <Image
        width={'100%'}
        height={'100%'}
        contentFit="cover"
        onError={handleLoadError}
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
  text: string;
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
          {text[0]?.toUpperCase()}
        </Text>
      </View>
    </AvatarFrame>
  );
});

export const SigilAvatar = React.memo(function SigilAvatarComponent({
  contactId,
  innerSigilSize,
  size = '$4xl',
  ...props
}: { contactId: string; innerSigilSize?: number } & AvatarProps) {
  const contact = useContact(contactId);
  const colors = useSigilColors(contact?.color);
  const styles = useStyle(props, { resolveValues: 'value' });
  const sigilSize = useMemo(() => {
    if (size && size !== 'custom') {
      return getTokenValue(size);
    } else {
      return styles.width ?? styles.height ?? 20;
    }
  }, [size, styles.width, styles.height]);

  return (
    <AvatarFrame
      {...props}
      size={size}
      alignItems={'center'}
      justifyContent="center"
      backgroundColor={colors.backgroundColor}
    >
      <UrbitSigil
        colors={colors}
        size={innerSigilSize ?? sigilSize * 0.5}
        contactId={contactId}
      />
    </AvatarFrame>
  );
});

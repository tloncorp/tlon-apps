import React from 'react';
import BubbleIcon from '@/components/icons/BubbleIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import UnknownAvatarIcon from '@/components/icons/UnknownAvatarIcon';
import { nestToFlag } from '@/logic/utils';

interface ChannelIconProps extends React.HTMLAttributes<SVGElement> {
  nest: string;
}

export default function ChannelIcon({ nest, ...rest }: ChannelIconProps) {
  const [app] = nestToFlag(nest);
  switch (app) {
    case 'chat':
      return <BubbleIcon {...rest} />;
    case 'heap':
      return <LinkIcon {...rest} />;
    default:
      return <UnknownAvatarIcon {...rest} />;
  }
}

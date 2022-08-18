import React from 'react';
import { nestToFlag } from '@/logic/utils';
import BubbleIcon from '@/components/icons/BubbleIcon';
import NotebookIcon from '@/components/icons/NotebookIcon';
import ShapesIcon from '@/components/icons/ShapesIcon';
import UnknownAvatarIcon from '@/components/icons/UnknownAvatarIcon';

interface ChannelIconProps extends React.HTMLAttributes<SVGElement> {
  nest: string;
}

export default function ChannelIcon({ nest, ...rest }: ChannelIconProps) {
  const [app] = nestToFlag(nest);
  switch (app) {
    case 'chat':
      return <BubbleIcon {...rest} />;
    case 'heap':
      return <ShapesIcon {...rest} />;
    case 'diary':
      return <NotebookIcon {...rest} />;
    default:
      return <UnknownAvatarIcon {...rest} />;
  }
}

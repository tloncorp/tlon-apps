import { Contact } from '@urbit/api';
import classNames from 'classnames';
import React, { PropsWithChildren } from 'react';

import { useIsMobile } from '@/logic/useMedia';
import { useContact } from '@/state/contact';
import { useCalm } from '@/state/settings';

type CoverProps = PropsWithChildren<{
  cover: string;
  className?: string;
}>;

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

export default function ProfileCoverImage({
  cover,
  className,
  children,
}: CoverProps) {
  const { disableRemoteContent } = useCalm();
  const isMobile = useIsMobile();

  return (
    <div
      className={classNames(
        'relative h-36 w-full rounded-[36px] bg-cover bg-center px-4',
        isMobile ? 'bg-gray-100 dark:bg-gray-200' : 'bg-gray-100',
        className
      )}
      style={
        cover && !disableRemoteContent
          ? { backgroundImage: `url(${cover})` }
          : {}
      }
    >
      {children}
    </div>
  );
}

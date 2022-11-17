import classNames from 'classnames';
import React, { PropsWithChildren } from 'react';
import { Contact } from '@urbit/api';
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

  return (
    <div
      className={classNames(
        'relative h-36 w-full rounded-t-lg bg-gray-100 bg-cover bg-center px-4',
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

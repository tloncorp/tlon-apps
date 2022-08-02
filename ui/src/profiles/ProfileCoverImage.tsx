import classNames from 'classnames';
import React, { PropsWithChildren } from 'react';
import { Contact } from '@urbit/api';
import { useContact } from '../state/contact';

type CoverProps = PropsWithChildren<{
  ship: string;
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
  ship,
  className,
  children,
}: CoverProps) {
  const contact = useContact(ship);
  const { cover } = contact || emptyContact;

  return (
    <div
      className={classNames(
        'relative h-36 w-full rounded-t-lg bg-gray-100 bg-cover bg-center px-4',
        className
      )}
      style={cover ? { backgroundImage: `url(${cover})` } : {}}
    >
      {children}
    </div>
  );
}

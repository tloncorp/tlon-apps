import cn from 'classnames';
import React, { PropsWithChildren } from 'react';
import useNavStore, { NavSecondaryLocation } from './Nav/useNavStore';

type NavTabProps = PropsWithChildren<{
  loc: NavSecondaryLocation;
  current: NavSecondaryLocation;
  className?: string;
}>;

export default function NavTab({
  loc,
  current,
  children,
  className,
}: NavTabProps) {
  const navigate = useNavStore((state) => state.navigateSecondary);

  return (
    <li
      className={cn(
        'flex-1 text-xs font-semibold',
        current === loc && 'text-gray-800',
        current !== loc && 'text-gray-400',
        className
      )}
    >
      <button
        className="flex h-full w-full flex-col items-center justify-center p-2"
        onClick={() => navigate(loc)}
      >
        {children}
      </button>
    </li>
  );
}

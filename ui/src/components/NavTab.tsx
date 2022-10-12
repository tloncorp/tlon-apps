import cn from 'classnames';
import React, { PropsWithChildren } from 'react';
import useNavStore, { NavSecondaryLocation } from '../nav/useNavStore';

type NavTabProps = PropsWithChildren<{
  loc?: NavSecondaryLocation;
  className?: string;
}>;

export default function NavTab({ loc, children, className }: NavTabProps) {
  const { navigate, current } = useNavStore((state) => ({
    navigate: state.navigateSecondary,
    current: state.secondary,
  }));

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
        onClick={() => loc && navigate(loc)}
      >
        {children}
      </button>
    </li>
  );
}

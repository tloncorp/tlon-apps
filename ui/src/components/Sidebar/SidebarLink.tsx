import cn from 'classnames';
import React, { PropsWithChildren } from 'react';
import { NavLink, NavLinkProps } from 'react-router-dom';
import RetainedStateLink from '../RetainedStateLink';

type SidebarProps = PropsWithChildren<{
  className?: string;
  icon: React.ReactNode | ((active: boolean) => React.ReactNode);
  retainState?: boolean;
}> &
  NavLinkProps;

export default function SidebarLink({
  icon,
  children,
  className,
  color,
  retainState = false,
  ...rest
}: SidebarProps) {
  const TheLink = retainState ? RetainedStateLink : NavLink;
  return (
    <li>
      <TheLink
        className={({ isActive }) =>
          cn(
            'default-focus flex items-center space-x-3 rounded-lg p-2 text-lg font-semibold hover:bg-gray-50 sm:text-base',
            isActive && 'bg-gray-50',
            color ?? 'text-gray-600',
            className
          )
        }
        {...rest}
      >
        {({ isActive }) => (
          <>
            {typeof icon === 'function' ? icon(isActive) : icon}
            {typeof children === 'string' ? <h3>{children}</h3> : children}
          </>
        )}
      </TheLink>
    </li>
  );
}

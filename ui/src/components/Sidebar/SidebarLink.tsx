import cn from 'classnames';
import React, { PropsWithChildren } from 'react';
import { NavLink, NavLinkProps } from 'react-router-dom';
import RetainedStateLink from '../RetainedStateLink';

type SidebarProps = PropsWithChildren<{
  actions?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  img?: string;
  retainState?: boolean;
}> &
  NavLinkProps;

export default function SidebarLink({
  actions,
  children,
  className,
  color,
  icon,
  img,
  retainState = false,
  ...rest
}: SidebarProps) {
  const TheLink = retainState ? RetainedStateLink : NavLink;
  return (
    <li>
      <TheLink
        className={({ isActive }) =>
          cn(
            'default-focus flex items-center space-x-3 rounded-lg p-2 text-base font-semibold hover:bg-gray-50',
            isActive && 'bg-gray-50',
            color ?? 'text-gray-600',
            className
          )
        }
        {...rest}
      >
        {/* Prioritize Icon over Image, otherwise fallback to placeholder */}
        {icon ? (
          icon
        ) : (img || '').length > 0 ? (
          <img
            className="h-6 w-6 rounded border-2 border-transparent"
            src={img}
          />
        ) : (
          <div className="h-6 w-6 rounded border-2 border-gray-100" />
        )}
        {typeof children === 'string' ? (
          <div
            title={children}
            className="text-light-gray-600 max-w-[128px] overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {children}
          </div>
        ) : (
          children
        )}
        {actions}
      </TheLink>
    </li>
  );
}

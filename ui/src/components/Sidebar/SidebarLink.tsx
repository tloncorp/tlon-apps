import cn from 'classnames';
import React, { PropsWithChildren } from 'react';
import { NavLink, NavLinkProps } from 'react-router-dom';

type SidebarProps = PropsWithChildren<{
  className?: string;
}> &
  NavLinkProps;

export default function SidebarLink({ to, children, className }: SidebarProps) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            'flex items-center space-x-3 rounded-md p-2 text-base font-semibold text-gray-600 hover:bg-gray-50',
            isActive && 'bg-gray-50',
            className
          )
        }
      >
        <div className="h-6 w-6 rounded border-2 border-gray-100" />
        {typeof children === 'string' ? <h3>{children}</h3> : children}
      </NavLink>
    </li>
  );
}

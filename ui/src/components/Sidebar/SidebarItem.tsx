import cn from 'classnames';
import React, { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { Link, useMatch } from 'react-router-dom';
import BulletIcon from '../icons/BulletIcon';

type SidebarProps = PropsWithChildren<{
  icon: React.ReactNode | ((active: boolean) => React.ReactNode);
  to?: string;
  hasActivity?: boolean;
  actions?: React.ReactNode;
  color?: string;
}> &
  ButtonHTMLAttributes<HTMLButtonElement>;

function Action({
  to,
  children,
  ...rest
}: Pick<SidebarProps, 'children' | 'to'> & Record<string, unknown>) {
  if (to) {
    return (
      <Link to={to} {...rest}>
        {children}
      </Link>
    );
  }

  return <button {...rest}>{children}</button>;
}

export default function SidebarItem({
  icon,
  to,
  color = 'text-gray-600',
  hasActivity = false,
  actions,
  className,
  children,
  ...rest
}: SidebarProps) {
  const matches = useMatch(to || 'DONT_MATCH');
  const active = !!matches;

  return (
    <li
      className={cn(
        'group relative flex w-full items-center justify-between rounded-lg text-lg font-semibold hover:bg-gray-50 sm:text-base',
        color,
        active && 'bg-gray-50'
      )}
    >
      <Action
        to={to}
        className={cn(
          'default-focus flex w-full flex-1 items-center space-x-3 rounded-lg p-2 font-semibold',
          !hasActivity && 'pr-4',
          hasActivity && 'pr-0',
          className
        )}
        {...rest}
      >
        {typeof icon === 'function' ? icon(active) : icon}
        <div
          title={typeof children === 'string' ? children : undefined}
          className="max-w-full flex-1 truncate text-left"
        >
          {children}
        </div>
        {hasActivity ? (
          <BulletIcon
            className="ml-auto h-6 w-6 text-blue transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
            aria-label="Has Activity"
          />
        ) : null}
      </Action>
      {actions ? (
        <div className="group absolute right-0 transition-opacity focus-visible:opacity-100">
          {actions}
        </div>
      ) : null}
    </li>
  );
}

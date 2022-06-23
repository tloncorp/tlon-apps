import cn from 'classnames';
import React, { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { Link, LinkProps, useMatch } from 'react-router-dom';

type SidebarProps = PropsWithChildren<{
  icon: React.ReactNode | ((active: boolean) => React.ReactNode);
  to?: string;
  actions?: React.ReactNode;
  color?: string;
  div?: boolean;
}> &
  ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<LinkProps, 'to'>;

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

function SidebarItemChild({
  icon,
  to,
  actions,
  className,
  children,
  ...rest
}: SidebarProps) {
  const matches = useMatch(to || 'DONT_MATCH');
  const active = !!matches;

  return (
    <>
      <Action
        to={to}
        className={cn(
          'default-focus flex w-full flex-1 items-center space-x-3 rounded-lg p-2 font-semibold',
          className
        )}
        {...rest}
      >
        {typeof icon === 'function' ? icon(active) : icon}
        <div
          title={typeof children === 'string' ? children : undefined}
          className={cn(
            'max-w-full flex-1 truncate text-left',
            actions && 'pr-4'
          )}
        >
          {children}
        </div>
      </Action>
      {actions ? <div className={cn('absolute right-0')}>{actions}</div> : null}
    </>
  );
}

export default function SidebarItem({
  icon,
  to,
  color = 'text-gray-600',
  actions,
  className,
  children,
  div = false,
  ...rest
}: SidebarProps) {
  const matches = useMatch(to || 'DONT_MATCH');
  const active = !!matches;

  return div ? (
    <div
      className={cn(
        'group relative flex w-full items-center justify-between rounded-lg text-lg font-semibold hover:bg-gray-50 sm:text-base',
        color,
        active && 'bg-gray-50'
      )}
    >
      <SidebarItemChild
        icon={icon}
        to={to}
        actions={actions}
        className={className}
        {...rest}
      >
        {children}
      </SidebarItemChild>
    </div>
  ) : (
    <li
      className={cn(
        'group relative flex w-full items-center justify-between rounded-lg text-lg font-semibold hover:bg-gray-50 sm:text-base',
        color,
        active && 'bg-gray-50'
      )}
    >
      <SidebarItemChild
        icon={icon}
        to={to}
        actions={actions}
        className={className}
        {...rest}
      >
        {children}
      </SidebarItemChild>
    </li>
  );
}

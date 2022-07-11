import cn from 'classnames';
import React, { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { Link, LinkProps, useMatch } from 'react-router-dom';

type SidebarProps = PropsWithChildren<{
  icon: React.ReactNode | ((active: boolean) => React.ReactNode);
  to?: string;
  actions?: React.ReactNode;
  color?: string;
  div?: boolean;
  highlight?: string;
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

export default function SidebarItem({
  icon,
  to,
  color = 'text-gray-600',
  highlight = 'bg-gray-50',
  actions,
  className,
  children,
  div = false,
  ...rest
}: SidebarProps) {
  const matches = useMatch(to || 'DONT_MATCH');
  const active = !!matches;
  const Wrapper = div ? 'div' : 'li';

  const hasHovers = highlight.search(/hover:/) !== -1;
  const hovers = (hl: string) =>
    hl.split(' ').filter((c) => c.startsWith('hover:'));

  return (
    <Wrapper
      className={cn(
        'group relative flex w-full items-center justify-between rounded-lg text-lg font-semibold sm:text-base',
        color,
        hasHovers ? hovers(highlight) : `hover:${highlight}`,
        active && highlight
      )}
    >
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
    </Wrapper>
  );
}

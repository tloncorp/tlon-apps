import cn from 'classnames';
import { mix } from 'color2k';
import React, {
  ButtonHTMLAttributes,
  PropsWithChildren,
  ReactHTML,
  useState,
} from 'react';
import { Link, LinkProps, useMatch } from 'react-router-dom';
import { useCurrentTheme } from '@/state/local';
import { isColor } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';

type SidebarProps = PropsWithChildren<{
  icon: React.ReactNode | ((active: boolean) => React.ReactNode);
  to?: string;
  defaultRoute?: boolean;
  actions?: React.ReactNode;
  // This is used for links we want to keep in an
  // "active" state even if the route is deeper than
  // the link's 'to' attribute
  inexact?: boolean;
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

const SidebarItem = React.forwardRef<HTMLLIElement, SidebarProps>(
  (
    {
      icon,
      to,
      color = 'text-gray-600',
      highlight = 'bg-gray-50',
      actions,
      className,
      children,
      inexact = false,
      div = false,
      defaultRoute = false,
      ...rest
    },
    ref
  ) => {
    const matchString = to && inexact ? `${to}/*` : to;
    const [hover, setHover] = useState(false);
    const matches = useMatch(
      (defaultRoute ? '/' : matchString) || 'DONT_MATCH'
    );
    const active = !!matches;
    const isMobile = useIsMobile();
    const Wrapper: keyof ReactHTML = div ? 'div' : 'li';
    const currentTheme = useCurrentTheme();

    const hasHoverColor = () => {
      switch (highlight) {
        case 'bg-gray-50': {
          return false;
        }
        default: {
          return true;
        }
      }
    };

    const customHoverHiglightStyles = () => {
      if (hasHoverColor() && isColor(highlight))
        return {
          backgroundColor:
            currentTheme === 'dark'
              ? mix(highlight, 'black', 0.7)
              : mix(highlight, 'white', 0.85),
        };
      return null;
    };

    const customActiveHiglightStyles = () => {
      if (hasHoverColor() && isColor(highlight))
        return {
          backgroundColor:
            currentTheme === 'dark'
              ? mix(highlight, 'black', 0.6)
              : mix(highlight, 'white', 0.75),
        };
      return null;
    };

    return (
      <Wrapper
        ref={ref as any}
        onMouseEnter={() => {
          setHover(true);
        }}
        onMouseLeave={() => {
          setHover(false);
        }}
        style={
          {
            ...(hasHoverColor() && hover && !active
              ? customHoverHiglightStyles()
              : null),
            ...(hasHoverColor() && active
              ? customActiveHiglightStyles()
              : null),
          } as React.CSSProperties
        }
        className={cn(
          'group relative flex w-full items-center justify-between rounded-lg text-lg font-semibold sm:text-base',
          color,
          !hasHoverColor() && !active ? `hover:${highlight}` : null,
          !hasHoverColor() && active && to !== '/' ? 'bg-gray-100' : null
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
              'max-w-full flex-1 text-left',
              isMobile ? 'line-clamp-1' : 'truncate',
              actions && 'pr-4'
            )}
          >
            {children}
          </div>
        </Action>
        {actions ? (
          <div className={cn('absolute right-0')}>{actions}</div>
        ) : null}
      </Wrapper>
    );
  }
);

export default SidebarItem;

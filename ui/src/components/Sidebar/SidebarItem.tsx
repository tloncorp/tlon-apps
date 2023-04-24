import cn from 'classnames';
import { mix } from 'color2k';
import React, {
  ButtonHTMLAttributes,
  PropsWithChildren,
  useState,
} from 'react';
import { Link, LinkProps, useMatch } from 'react-router-dom';
import { useTheme } from '@/state/settings';
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
  highlight?: string;
  transparent?: boolean;
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

const SidebarItem = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      icon,
      to,
      color = 'text-gray-800 sm:text-gray-600',
      highlight = 'bg-gray-50',
      actions,
      className,
      children,
      inexact = false,
      defaultRoute = false,
      transparent = false,
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
    const Wrapper = 'div';
    const theme = useTheme();
    const currentTheme = theme === 'dark' ? 'dark' : 'light';

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
            ...(hasHoverColor() && hover && !active && !transparent
              ? customHoverHiglightStyles()
              : null),
            ...(hasHoverColor() && active && !transparent
              ? customActiveHiglightStyles()
              : null),
            ...((transparent === true && hover) ||
            (transparent === true && active)
              ? { backgroundColor: 'rgba(0,0,0,0.3)' }
              : null),
          } as React.CSSProperties
        }
        className={cn(
          'group relative my-0.5 flex w-full items-center justify-between rounded-lg',
          color,
          !hasHoverColor() && !active ? `hover:${highlight}` : null,
          !hasHoverColor() && active && to !== '/' ? 'bg-gray-100' : null
        )}
      >
        <Action
          to={to}
          className={cn(
            'default-focus flex w-full flex-1 items-center space-x-3 rounded-lg p-2',
            className
          )}
          {...rest}
        >
          {typeof icon === 'function' ? icon(active) : icon}
          <div
            title={typeof children === 'string' ? children : undefined}
            className={cn(
              'max-w-full flex-1 text-left text-lg font-bold sm:text-base sm:font-semibold ',
              isMobile ? 'line-clamp-1' : 'truncate',
              actions && 'pr-4',
              !color ? 'text-gray-800 sm:text-gray-600' : color
            )}
          >
            {children}
          </div>
        </Action>
        {actions ? (
          <div className={cn('absolute right-2 sm:right-1')}>{actions}</div>
        ) : null}
      </Wrapper>
    );
  }
);

export default SidebarItem;

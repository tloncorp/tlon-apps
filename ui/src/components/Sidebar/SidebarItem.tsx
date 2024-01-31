import cn from 'classnames';
import { mix } from 'color2k';
import React, {
  ButtonHTMLAttributes,
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Link, LinkProps, useMatch } from 'react-router-dom';
import { useCurrentTheme } from '@/state/local';
import { isColor } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import CaretRightIcon from '../icons/CaretRightIcon';

type SidebarProps = PropsWithChildren<{
  icon: React.ReactNode | ((active: boolean) => React.ReactNode);
  to?: string;
  override?: boolean;
  defaultRoute?: boolean;
  actions?:
    | React.ReactNode
    | (({ hover }: { hover: boolean }) => React.ReactNode);
  // This is used for links we want to keep in an
  // "active" state even if the route is deeper than
  // the link's 'to' attribute
  inexact?: boolean;
  color?: string;
  highlight?: string;
  transparent?: boolean;
  fontWeight?: string;
  fontSize?: string;
  showCaret?: boolean;
}> &
  ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<LinkProps, 'to'>;

const Action = React.memo(
  ({
    to,
    children,
    ...rest
  }: Pick<SidebarProps, 'children' | 'to'> & Record<string, unknown>) => {
    if (to) {
      return (
        <Link to={to} {...rest}>
          {children}
        </Link>
      );
    }

    return <button {...rest}>{children}</button>;
  }
);

const SidebarItem = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      icon,
      to,
      override = false,
      color = 'text-gray-800 sm:text-gray-600',
      highlight = 'bg-gray-50',
      fontWeight,
      fontSize = 'text-lg',
      actions,
      className,
      children,
      inexact = false,
      defaultRoute = false,
      transparent = false,
      showCaret = false,
      ...rest
    },
    ref
  ) => {
    const matchString = useMemo(
      () => (to && inexact ? `${to}/*` : to),
      [to, inexact]
    );
    const [hover, setHover] = useState(false);
    const matches = useMatch(
      (defaultRoute ? '/' : matchString) || 'DONT_MATCH'
    );
    const active = useMemo(() => !!matches, [matches]);
    const isMobile = useIsMobile();
    const Wrapper = 'div';
    const currentTheme = useCurrentTheme();

    const hasHoverColor = useCallback(() => {
      switch (highlight) {
        case 'bg-gray-50': {
          return false;
        }
        default: {
          return true;
        }
      }
    }, [highlight]);

    const customHoverHiglightStyles = useCallback(() => {
      if (hasHoverColor() && isColor(highlight))
        return {
          backgroundColor:
            currentTheme === 'dark'
              ? mix(highlight, 'black', 0.7)
              : mix(highlight, 'white', 0.85),
        };
      return null;
    }, [currentTheme, hasHoverColor, highlight]);

    const customActiveHiglightStyles = useCallback(() => {
      if (hasHoverColor() && isColor(highlight))
        return {
          backgroundColor:
            currentTheme === 'dark'
              ? mix(highlight, 'black', 0.6)
              : mix(highlight, 'white', 0.75),
        };
      return null;
    }, [currentTheme, hasHoverColor, highlight]);

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
              ? { backgroundColor: 'transparent' }
              : null),
          } as React.CSSProperties
        }
        className={cn(
          'group relative my-0.5 flex w-full items-center justify-between rounded-lg',
          color,
          !hasHoverColor() && !active ? `hover:${highlight}` : null,
          !hasHoverColor() && active && (to !== '/' || override)
            ? 'bg-gray-100'
            : null
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
            data-testid={
              typeof children === 'string'
                ? `sidebar-item-text-${children}`
                : undefined
            }
            title={typeof children === 'string' ? children : undefined}
            className={cn(
              'max-w-full flex-1 text-left font-sans sm:text-base',
              isMobile ? 'line-clamp-1' : 'truncate',
              actions && 'pr-4',
              !fontWeight ? 'sm:font-semibold' : fontWeight,
              !color ? 'text-gray-800 sm:text-gray-600' : color,
              !fontSize ? 'text-lg' : fontSize
            )}
          >
            {children}
          </div>
          {showCaret && (
            <CaretRightIcon className="h-6 w-6 text-gray-200 group-hover:text-gray-500" />
          )}
        </Action>
        {actions ? (
          <div className={cn('absolute right-2')}>
            {typeof actions === 'function' ? actions({ hover }) : actions}
          </div>
        ) : null}
      </Wrapper>
    );
  }
);

export default SidebarItem;
